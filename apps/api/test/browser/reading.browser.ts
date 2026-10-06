import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { type Browser, expect as browserExpect, chromium, type Page } from "@playwright/test";
import request from "supertest";
import { requestBudgetKey } from "../../src/common/middleware/request-budget";
import type { PrismaService } from "../../src/database/prisma.service";
import { emailConfig } from "../../src/email/config";
import { emailKey, unseal } from "../../src/email/outbox";
import { signInWithCode } from "../fixtures/sign-in";

const root = resolve(__dirname, "../../../..");
let app: INestApplication;
let prisma: PrismaService;
let browser: Browser;
let web: ReturnType<typeof Bun.spawn>;
let ingress: ReturnType<typeof Bun.serve>;
let directory: string;
let origin: string;
let apiOrigin: string;
let webOrigin = "";
let owner: string;
let cookie: string;
let otherCookie: string;
let hubId: string;
let handle: string;
const emptyHandle = `empty-${"long".repeat(13)}`;
let hubMode: "normal" | "failure" | "timeout" = "normal";
const hubReads: { path: string; token?: string }[] = [];
let statusMode:
  | "normal"
  | "degraded"
  | "unavailable"
  | "failure"
  | "offline"
  | "timeout"
  | "malformed"
  | "throttled" = "normal";
const statusReads: { path: string; token?: string }[] = [];
let privateId: string;
let parentId: string;
let sectionId: string;
let linkToken: string;
const longTitle = `A reader's reference library ${"LongTitle".repeat(15)}`;
let exploreMode: "normal" | "empty" | "failure" = "normal";
let captureReferer: string | null = null;
let capture: ReturnType<typeof Bun.serve>;
const publicIds: string[] = [];
let delayedDocument: { path: string; started: () => void; released: Promise<void> } | undefined;

async function create(title: string, slug: string, published = false) {
  const result = await request(app.getHttpServer())
    .post("/api/v1/collections")
    .auth(owner, { type: "bearer" })
    .send({
      title,
      slug,
      published,
      description: "Collected notes and practical references.\nA second line for reading.",
      tags: ["reading", "reference"],
    })
    .expect(201);
  return result.body.data.id as string;
}
async function change(id: string, action: string) {
  return request(app.getHttpServer())
    .post(`/api/v1/collections/${id}/${action}`)
    .auth(owner, { type: "bearer" })
    .expect(201);
}
async function freshPage(js = true) {
  const context = await browser.newContext({ javaScriptEnabled: js });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(10000);
  return { page, close: () => context.close() };
}
async function ready(page: Page, path = "/") {
  const response = await page.goto(origin + path, { waitUntil: "domcontentloaded" });
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await browserExpect(page.locator("h1")).toBeVisible();
}

async function documentFrom(source: string, headers: Record<string, string> = {}) {
  // Bun's node:http client currently ignores localAddress. Use Node only for
  // this socket fixture so two actual loopback clients reach the production
  // web entry point; the application and test runner still run under Bun.
  const child = Bun.spawn(
    [
      "node",
      "-e",
      `
    const { request } = require("node:http");
    const { origin, source, headers } = JSON.parse(process.argv[1]);
    const req = request(origin, { localAddress: source, headers }, response => {
      response.pipe(process.stdout);
    });
    req.on("error", () => process.exit(1));
    req.setTimeout(10000, () => req.destroy());
    req.end();
  `,
      JSON.stringify({ origin: webOrigin, source, headers }),
    ],
    {
      stdout: "pipe",
      stderr: "ignore",
    },
  );
  const body = await new Response(child.stdout).text();
  if (await child.exited) throw new Error("Socket fixture request failed");
  return body;
}

beforeAll(async () => {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.EMAIL_PROVIDER !== "capture" ||
    !new URL(process.env.DATABASE_URL ?? "").pathname.startsWith("/test_")
  )
    throw new Error("Browser tests require isolated capture configuration");
  directory = await mkdtemp(join(tmpdir(), "web-reading-"));
  // Production-shaped path routing: /api reaches Nest; everything else Next.
  ingress = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req, server) {
      const url = new URL(req.url);
      if (delayedDocument?.path === url.pathname) {
        const delayed = delayedDocument;
        delayed.started();
        await delayed.released;
      }
      const upstream = url.pathname.startsWith("/api/") ? apiOrigin : webOrigin;
      if (!upstream) return new Response("Starting", { status: 503 });
      try {
        return await fetch(upstream + url.pathname + url.search, {
          method: req.method,
          headers: (() => {
            const headers = new Headers(req.headers);
            headers.set("accept-encoding", "identity");
            headers.set("x-forwarded-for", server.requestIP(req)?.address ?? "127.0.0.1");
            headers.delete("x-web-read-source");
            return headers;
          })(),
          redirect: "manual",
          body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        return new Response("Unavailable", { status: 503 });
      }
    },
  });
  origin = `http://127.0.0.1:${ingress.port}`;
  process.env.BETTER_AUTH_URL = origin;
  const { AppModule } = await import("../../src/app.module.js");
  const { configureApp } = await import("../../src/app.setup.js");
  const { PrismaService: Prisma } = await import("../../src/database/prisma.service.js");
  const { RedisQueueReadinessService } = await import(
    "../../src/modules/health/redis-queue-readiness.service.js"
  );
  // Override only the dependency probes; all persistence and the actual health
  // service/controller/error stack remain real inside this isolated fixture.
  class BrowserPrisma extends Prisma {
    override async ping() {
      if (statusMode === "unavailable") throw new Error("PRIVATE DATABASE FAILURE");
      await super.ping();
    }
  }
  class BrowserQueueReadiness extends RedisQueueReadinessService {
    override async ping() {
      if (statusMode === "degraded") throw new Error("PRIVATE QUEUE FAILURE");
      await super.ping();
    }
  }
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Prisma)
    .useClass(BrowserPrisma)
    .overrideProvider(RedisQueueReadinessService)
    .useClass(BrowserQueueReadiness)
    .compile();
  app = module.createNestApplication({ bodyParser: false, logger: false });
  app.use(
    (
      req: { url: string; headers: Record<string, string | undefined> },
      res: {
        status: (code: number) => { json: (body: unknown) => void };
        setHeader: (name: string, value: string) => void;
        destroy: () => void;
      },
      next: () => void,
    ) => {
      if (req.url.startsWith("/api/v1/status")) {
        statusReads.push({ path: req.url, token: req.headers["x-share-token"] });
        if (statusMode === "offline") {
          res.destroy();
          return;
        }
        if (statusMode === "malformed") {
          res.status(200).json({
            data: {
              status: "PRIVATE UNKNOWN STATUS",
              dependencies: { postgres: "PRIVATE CONNECTION" },
            },
          });
          return;
        }
        if (statusMode === "throttled") {
          res.setHeader("Retry-After", "2");
          res
            .status(429)
            .json({ error: { code: "too_many_requests", message: "PRIVATE RATE LIMIT" } });
          return;
        }
        if (statusMode === "failure" || statusMode === "timeout") {
          const fail = () =>
            res
              .status(503)
              .json({ error: { code: "service_unavailable", message: "PRIVATE STATUS DETAIL" } });
          if (statusMode === "timeout") setTimeout(fail, 8500);
          else fail();
          return;
        }
      }
      if (req.url.startsWith("/api/v1/hubs/")) {
        hubReads.push({ path: req.url, token: req.headers["x-share-token"] });
        if (hubMode !== "normal" && !req.url.includes("/collections/")) {
          const fail = () =>
            res
              .status(503)
              .json({ error: { code: "service_unavailable", message: "PRIVATE HUB DETAIL" } });
          if (hubMode === "timeout") setTimeout(fail, 8500);
          else fail();
          return;
        }
      }
      if (req.url.startsWith("/api/v1/explore") && exploreMode !== "normal") {
        if (exploreMode === "empty")
          res.status(200).json({ data: [], meta: { limit: 20, nextCursor: null } });
        else
          res
            .status(503)
            .json({ error: { code: "service_unavailable", message: "PRIVATE INTERNAL DETAIL" } });
      } else next();
    },
  );
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  apiOrigin = await app.getUrl();
  prisma = app.get(Prisma);
  const signed = await signInWithCode(app.getHttpServer(), {
    email: "reader-owner@example.com",
    name: "Reader",
  });
  owner = signed.headers["set-auth-token"];
  cookie =
    (signed.headers["set-cookie"] as unknown as string[])
      .map((value) => value.split(";")[0])
      .find((value) => value.startsWith("better-auth.session_token=")) ?? "";
  expect(cookie).not.toBe("");
  const profile = await request(app.getHttpServer())
    .get("/api/v1/profile")
    .auth(owner, { type: "bearer" })
    .expect(200);
  hubId = profile.body.data.hubId;
  handle = profile.body.data.handle;
  await prisma.hub.update({
    where: { id: hubId },
    data: { description: "References for curious readers.\nCollected with care." },
  });
  const other = await signInWithCode(app.getHttpServer(), {
    email: "empty-reader@example.com",
    name: "Other reader",
  });
  const otherToken = other.headers["set-auth-token"];
  otherCookie =
    (other.headers["set-cookie"] as unknown as string[])
      .map((value) => value.split(";")[0])
      .find((value) => value.startsWith("better-auth.session_token=")) ?? "";
  await request(app.getHttpServer())
    .patch("/api/v1/profile")
    .auth(otherToken, { type: "bearer" })
    .send({ handle: emptyHandle })
    .expect(200);
  await request(app.getHttpServer())
    .post("/api/v1/collections")
    .auth(otherToken, { type: "bearer" })
    .send({ slug: "private-reading", title: "Other private collection" })
    .expect(201);
  for (let i = 0; i < 23; i++)
    publicIds.push(await create(`Reading collection ${i + 1}`, `reading-${i}`, true));
  parentId = await create(longTitle, "reading-guide", true);
  publicIds.push(parentId);
  privateId = await create("Private title should never leak", "private-reading");
  sectionId = await create("A useful section", "useful-section");
  await request(app.getHttpServer())
    .post(`/api/v1/collections/${parentId}/collections`)
    .auth(owner, { type: "bearer" })
    .send({ collectionId: sectionId })
    .expect(201);
  const resources = await request(app.getHttpServer())
    .get(`/api/v1/collections/${parentId}/resources`)
    .auth(owner, { type: "bearer" })
    .expect(200);
  const sectionResource = resources.body.data.find(
    (item: { linkedCollectionId: string }) => item.linkedCollectionId === sectionId,
  );
  await request(app.getHttpServer())
    .patch(`/api/v1/collections/${parentId}/resources/${sectionResource.id}`)
    .auth(owner, { type: "bearer" })
    .send({
      titleOverride: "Curated section title",
      tags: ["section-tag"],
      version: sectionResource.version,
    })
    .expect(200);
  capture = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      if (new URL(req.url).pathname === "/reference") captureReferer = req.headers.get("referer");
      return new Response("External reference opened");
    },
  });
  await request(app.getHttpServer())
    .post(`/api/v1/collections/${parentId}/resources/external`)
    .auth(owner, { type: "bearer" })
    .send({
      url: `http://127.0.0.1:${capture.port}/reference`,
      titleOverride: "Open the reference",
      position: 1,
    })
    .expect(201);
  for (let position = 2; position < 22; position++) {
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${parentId}/resources/external`)
      .auth(owner, { type: "bearer" })
      .send({
        url: `https://example.com/reference/${position}`,
        titleOverride: `Reference ${position}`,
        position,
      })
      .expect(201);
  }
  const link = await request(app.getHttpServer())
    .put(`/api/v1/collections/${parentId}/link-sharing`)
    .auth(owner, { type: "bearer" })
    .send({ enabled: true })
    .expect(200);
  linkToken = link.body.data.token;
  const reserved = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = reserved.port;
  await reserved.stop(true);
  webOrigin = `http://127.0.0.1:${port}`;
  web = Bun.spawn(["bun", "server.ts"], {
    cwd: resolve(root, "apps/web"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      API_INTERNAL_ORIGIN: apiOrigin,
      WEB_PORT: String(port),
      WEB_TRUSTED_PROXY_CIDRS: "127.0.0.1",
    },
    stdout: Bun.file(join(directory, "web.log")),
    stderr: Bun.file(join(directory, "web-error.log")),
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (web.exitCode !== null) throw new Error("Web fixture exited before readiness");
    try {
      if ((await fetch(webOrigin, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {}
    if (attempt === 99) throw new Error("Web fixture did not become ready");
    await Bun.sleep(100);
  }
  browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_CHROME_PATH ??
      (!process.env.CI && existsSync("/usr/bin/google-chrome-stable")
        ? "/usr/bin/google-chrome-stable"
        : undefined),
    args: ["--no-sandbox"],
    ignoreDefaultArgs: ["--disable-back-forward-cache"],
  });
}, 60000);

beforeEach(async () => {
  await prisma.requestBudget.deleteMany();
});
afterAll(async () => {
  await browser?.close();
  if (web) {
    web.kill();
    const timer = setTimeout(() => web.kill("SIGKILL"), 2000);
    await web.exited;
    clearTimeout(timer);
  }
  await ingress?.stop(true);
  await capture?.stop(true);
  await app?.close();
  if (directory) {
    const output = await readFile(join(directory, "web.log"), "utf8").catch(() => "");
    if (linkToken) expect(output).not.toContain(linkToken);
    await rm(directory, { recursive: true, force: true });
  }
}, 10000);

describe("explore to resource: production browser journey", () => {
  it("reads real aggregate status and rechecks with or without JavaScript", async () => {
    for (const js of [true, false]) {
      const { page, close } = await freshPage(js);
      try {
        statusMode = "normal";
        const api = await request(app.getHttpServer()).get("/api/v1/status").expect(200);
        expect(api.body.data.status).toBe("ready");
        await ready(page);
        const navigation = page
          .getByRole("navigation", { name: "Main navigation" })
          .getByRole("link", { name: "Service status", exact: true });
        await navigation.focus();
        await navigation.press("Enter");
        expect(new URL(page.url()).pathname).toBe("/status");
        await browserExpect(page.locator("h1")).toHaveText("All systems ready");
        statusMode = "degraded";
        const degraded = await request(app.getHttpServer()).get("/api/v1/status").expect(200);
        expect(degraded.body.data.status).toBe("degraded");
        await page.getByRole("button", { name: "Check again", exact: true }).click();
        await browserExpect(page.locator("h1")).toHaveText("Some services are limited");
        await browserExpect(
          page.getByText("You can still browse collections.", { exact: false }),
        ).toBeVisible();
        await page.getByRole("link", { name: "Explore collections", exact: true }).click();
        await browserExpect(page.locator(".collection-row")).toHaveCount(20);
        await ready(page, "/status");
        statusMode = "unavailable";
        const unavailable = await request(app.getHttpServer()).get("/api/v1/status").expect(503);
        expect(unavailable.body.error.code).toBe("dependencies_unavailable");
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await browserExpect(page.locator("h1")).toHaveText("Temporarily unavailable");
        const html = await page.content();
        for (const secret of [
          "postgres",
          "redis_queue",
          "PRIVATE DATABASE",
          "PRIVATE QUEUE",
          "dependencies_unavailable",
        ])
          expect(html).not.toContain(secret);
        statusMode = "normal";
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await browserExpect(page.locator("h1")).toHaveText("All systems ready");
      } finally {
        statusMode = "normal";
        await close();
      }
    }
  }, 20000);

  it("distinguishes unconfirmed status, honors throttling, and recovers without polling", async () => {
    const { page, close } = await freshPage();
    try {
      for (const mode of ["failure", "offline", "malformed", "timeout"] as const) {
        statusMode = mode;
        await ready(page, "/status?s=status-must-ignore-this");
        await browserExpect(page.locator("h1")).toHaveText("We couldn't check the service");
        await browserExpect(page.locator("body")).not.toContainText("PRIVATE");
        expect(await page.content()).not.toContain("PRIVATE STATUS DETAIL");
        expect(await page.content()).not.toContain("PRIVATE UNKNOWN STATUS");
        statusMode = "normal";
        const requests = statusReads.length;
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await browserExpect(page.locator("h1")).toHaveText("All systems ready");
        expect(statusReads.length).toBe(requests + 1);
        expect(new URL(page.url()).search).toBe("");
      }
      statusMode = "throttled";
      await ready(page, "/status");
      await browserExpect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled();
      const requests = statusReads.length;
      statusMode = "normal";
      await browserExpect(
        page.getByRole("button", { name: "Try again", exact: true }),
      ).toBeEnabled();
      expect(statusReads.length).toBe(requests);
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await browserExpect(page.locator("h1")).toHaveText("All systems ready");
      expect(statusReads.every((read) => read.path === "/api/v1/status" && !read.token)).toBe(true);
    } finally {
      statusMode = "normal";
      await close();
    }
    const plain = await freshPage(false);
    try {
      statusMode = "throttled";
      await ready(plain.page, "/status");
      await browserExpect(
        plain.page.getByText("Wait 2 seconds, then", { exact: false }),
      ).toBeVisible();
      statusMode = "normal";
      await plain.page.getByRole("link", { name: "check the service again", exact: true }).click();
      await browserExpect(plain.page.locator("h1")).toHaveText("All systems ready");
    } finally {
      statusMode = "normal";
      await plain.close();
    }
  }, 30000);

  it("keeps status accessible on narrow screens and revalidates history and cancelled rechecks", async () => {
    const { page, close } = await freshPage();
    let release = () => {};
    try {
      await ready(page, "/status");
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await browserExpect(
          page.getByRole("button", { name: "Check again", exact: true }),
        ).toBeVisible();
      }
      await page.screenshot({ path: "/tmp/w3-status-desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
      statusMode = "degraded";
      await page.reload();
      await page.screenshot({ path: "/tmp/w3-status-phone.png" });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });
      await page.getByRole("link", { name: "Explore collections", exact: true }).click();
      statusMode = "unavailable";
      await page.goBack();
      await browserExpect(page.locator("h1")).toHaveText("Temporarily unavailable");
      let started = () => {};
      const waiting = new Promise<void>((resolve) => {
        started = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      delayedDocument = { path: "/status", started, released };
      const aborted = page.waitForEvent("requestfailed", {
        predicate: (req) => req.isNavigationRequest() && new URL(req.url()).pathname === "/status",
      });
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .click({ noWaitAfter: true });
      await waiting;
      await page.keyboard.press("Escape");
      const protocol = await page.context().newCDPSession(page);
      await protocol.send("Page.stopLoading");
      await protocol.detach();
      expect((await aborted).failure()?.errorText).toContain("ERR_ABORTED");
      await browserExpect(page.locator("h1")).toBeHidden();
      await browserExpect(page.getByRole("status")).toHaveText("Loading page…");
      delayedDocument = undefined;
      release();
      statusMode = "normal";
      const reload = page.getByRole("button", { name: "Reload this page", exact: true });
      await reload.focus();
      await browserExpect(reload).toBeFocused();
      await reload.press("Enter");
      await browserExpect(page.locator("h1")).toHaveText("All systems ready");
    } finally {
      delayedDocument = undefined;
      release();
      statusMode = "normal";
      await close();
    }
  }, 20000);

  it("recovers cancelled document navigation with fresh authorization", async () => {
    const { page, close } = await freshPage();
    let release = () => {};
    let unpublished = false;
    try {
      for (const entry of [`/c/${parentId}`, `/@${handle}/reading-guide`]) {
        for (const revoke of [false, true]) {
          await ready(page, entry);
          let started = () => {};
          const waiting = new Promise<void>((resolve) => {
            started = resolve;
          });
          const released = new Promise<void>((resolve) => {
            release = resolve;
          });
          delayedDocument = { path: `/c/${sectionId}`, started, released };
          const aborted = page.waitForEvent("requestfailed", {
            predicate: (req) =>
              req.isNavigationRequest() && req.url() === `${origin}/c/${sectionId}`,
          });
          await page
            .getByRole("link", { name: "Curated section title" })
            .click({ noWaitAfter: true });
          await waiting;
          await page.keyboard.press("Escape");
          // Headless key dispatch does not invoke Chromium's browser-chrome
          // Stop command. Drive that native cancellation explicitly as well.
          const protocol = await page.context().newCDPSession(page);
          await protocol.send("Page.stopLoading");
          await protocol.detach();
          expect((await aborted).failure()?.errorText).toContain("ERR_ABORTED");
          await browserExpect(page.getByRole("status")).toHaveText("Loading page…");
          expect(page.url()).toBe(origin + entry);
          await browserExpect(page.locator("h1")).toBeHidden();
          if (revoke) {
            await change(parentId, "unpublish");
            unpublished = true;
          }
          delayedDocument = undefined;
          release();
          const reload = page.getByRole("button", { name: "Reload this page", exact: true });
          if (!revoke) await page.screenshot({ path: "/tmp/w3-navigation-recovery.png" });
          await reload.focus();
          await browserExpect(reload).toBeFocused();
          await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            reload.press("Enter"),
          ]);
          await browserExpect(page.locator("h1")).toHaveText(
            revoke ? "This collection isn't available." : longTitle,
          );
          await browserExpect(page.locator(".navigation-loading")).toBeHidden();
          if (revoke) {
            await browserExpect(page.locator(".resource-row")).toHaveCount(0);
            await change(parentId, "publish");
            unpublished = false;
          }
        }
      }
    } finally {
      delayedDocument = undefined;
      release();
      if (unpublished) await change(parentId, "publish");
      await close();
    }
  }, 20000);

  it("browses public hubs as anonymous, owner and another user without private data", async () => {
    for (const session of [undefined, cookie, otherCookie]) {
      const { page, close } = await freshPage();
      try {
        if (session) {
          const [name, ...value] = session.split("=");
          await page.context().addCookies([{ name, value: value.join("="), url: origin }]);
        }
        await ready(page, `/@${handle}?s=discovery-must-ignore-this`);
        await browserExpect(page.locator("h1")).toHaveText(`@${handle}`);
        await browserExpect(
          page.getByText("References for curious readers.", { exact: false }),
        ).toBeVisible();
        await browserExpect(page.locator(".collection-row")).toHaveCount(20);
        const more = page.getByRole("link", { name: "More collections", exact: true });
        await more.focus();
        await more.press("Enter");
        await browserExpect(page.locator(".collection-row")).toHaveCount(24);
        await browserExpect(
          page.getByRole("link", { name: "All collections loaded" }),
        ).toBeFocused();
        await browserExpect(page.locator('p[aria-live="polite"]')).toHaveText(
          "4 more collections loaded.",
        );
        await browserExpect(page.locator("body")).not.toContainText("Private title");
        await browserExpect(page.locator("body")).not.toContainText("Other private");
        await browserExpect(
          page.getByRole("link", { name: "A useful section", exact: true }),
        ).toHaveCount(0);
        await browserExpect(
          page.getByRole("link", { name: longTitle, exact: true }),
        ).toHaveAttribute("href", `/@${handle}/reading-guide`);
        await ready(page, `/@${emptyHandle}`);
        await browserExpect(page.getByText("No published collections here yet.")).toBeVisible();
        await browserExpect(page.locator(".collection-row")).toHaveCount(0);
        await browserExpect(page.locator("body")).not.toContainText("Other private");
        expect(
          hubReads
            .filter((read) => !read.path.includes("/collections/"))
            .every((read) => !read.token && !read.path.includes("s=")),
        ).toBe(true);
      } finally {
        await close();
      }
    }
  }, 30000);

  it("follows hub, pretty URL, section and external resource with keyboard, narrow widths and no JavaScript", async () => {
    for (const js of [true, false]) {
      const { page, close } = await freshPage(js);
      try {
        if (js)
          await page.addInitScript(() => {
            Object.defineProperty(navigator, "clipboard", {
              value: { writeText: () => Promise.reject(new Error("Unavailable")) },
            });
          });
        await ready(page, `/@${handle}`);
        for (const width of [320, 390, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          ).toBe(true);
        }
        if (js) {
          await page.screenshot({ path: "/tmp/w3-hub-desktop.png" });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.screenshot({ path: "/tmp/w3-hub-phone.png" });
        } else {
          await page.getByRole("link", { name: "More collections", exact: true }).click();
          await browserExpect(page.locator(".collection-row")).toHaveCount(4);
          await ready(page, `/@${handle}`);
        }
        const collection = page.getByRole("link", { name: longTitle, exact: true });
        await collection.focus();
        await collection.press("Enter");
        expect(new URL(page.url()).pathname).toBe(`/@${handle}/reading-guide`);
        await browserExpect(page.locator("h1")).toHaveText(longTitle);
        await page.reload();
        await browserExpect(page.locator(".resource-row")).toHaveCount(20);
        if (js) {
          await page.getByRole("button", { name: "Copy link", exact: true }).click();
          await browserExpect(
            page.getByRole("textbox", { name: "Copy this link", exact: true }),
          ).toHaveValue(`${origin}/c/${parentId}`);
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          ).toBe(true);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "";
          });
        }
        await page.getByRole("link", { name: "More resources", exact: true }).click();
        await browserExpect(page.locator(".resource-row")).toHaveCount(js ? 22 : 2);
        await ready(page, `/@${handle}/reading-guide`);
        await page.getByRole("link", { name: "Curated section title" }).click();
        expect(new URL(page.url()).pathname).toBe(`/c/${sectionId}`);
        await browserExpect(page.locator("h1")).toHaveText("A useful section");
        await page.getByRole("link", { name: longTitle }).click();
        await page.getByRole("link", { name: `@${handle}`, exact: true }).click();
        await page.getByRole("link", { name: longTitle }).click();
        await page.getByRole("link", { name: "Open the reference" }).click();
        await browserExpect(page.locator("body")).toHaveText("External reference opened");
        expect(captureReferer).toBeNull();
      } finally {
        await close();
      }
    }
  }, 40000);

  it("keeps hub continuation context through throttling, timeout, duplicates and invalid cursors", async () => {
    const { page, close } = await freshPage();
    try {
      await ready(page, `/@${handle}`);
      const pattern = `**/api/v1/hubs/${hubId}?**`;
      await page.route(
        pattern,
        (route) =>
          route.fulfill({
            status: 429,
            headers: { "Retry-After": "1" },
            json: { error: { code: "too_many_requests", message: "PRIVATE RAW ERROR" } },
          }),
        { times: 1 },
      );
      await page.getByRole("link", { name: "More collections", exact: true }).click();
      await browserExpect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled();
      await browserExpect(page.locator(".collection-row")).toHaveCount(20);
      await page.route(
        pattern,
        async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 11000));
          await route.abort().catch(() => {});
        },
        { times: 1 },
      );
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await browserExpect(
        page.getByText("Couldn't load more. Your current results are still here."),
      ).toBeVisible({ timeout: 12000 });
      await browserExpect(page.locator(".collection-row")).toHaveCount(20);
      await page.route(
        pattern,
        async (route) => {
          const response = await route.fetch();
          const body = await response.json();
          body.data.collections.push(body.data.collections[0]);
          await route.fulfill({ response, json: body });
        },
        { times: 1 },
      );
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await browserExpect(page.locator(".collection-row")).toHaveCount(24);
      await browserExpect(page.locator('p[aria-live="polite"]')).toHaveText(
        "4 more collections loaded.",
      );
      await ready(page, `/@${handle}`);
      await page.route(
        pattern,
        (route) => route.fulfill({ status: 400, json: { error: { code: "invalid_cursor" } } }),
        { times: 1 },
      );
      await page.getByRole("link", { name: "More collections", exact: true }).click();
      await page.getByRole("link", { name: "Reload list", exact: true }).click();
      expect(new URL(page.url()).pathname).toBe(`/@${handle}`);
      await browserExpect(page.locator(".collection-row")).toHaveCount(20);
      await ready(page, `/@${handle}?cursor=invalid`);
      await browserExpect(page.locator("h1")).toHaveText("This list has changed.");
      await page.getByRole("link", { name: "Reload collections", exact: true }).click();
      expect(new URL(page.url()).pathname).toBe(`/@${handle}`);
      await ready(page, `/@${handle}/reading-guide?cursor=invalid`);
      await page.getByRole("link", { name: "Reload collection", exact: true }).click();
      expect(new URL(page.url()).pathname).toBe(`/@${handle}/reading-guide`);
    } finally {
      await close();
    }
  }, 30000);

  it("keeps copied ID links readable after handle and slug renames", async () => {
    const { page, close } = await freshPage();
    const renamed = "renamed-reader";
    async function renameSlug(slug: string) {
      const current = await request(app.getHttpServer())
        .get(`/api/v1/collections/${parentId}`)
        .auth(owner, { type: "bearer" })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/collections/${parentId}`)
        .auth(owner, { type: "bearer" })
        .send({ slug, version: current.body.data.version })
        .expect(200);
    }
    try {
      await ready(page, `/@${handle}/reading-guide`);
      await request(app.getHttpServer())
        .patch("/api/v1/profile")
        .auth(owner, { type: "bearer" })
        .send({ handle: renamed })
        .expect(200);
      await renameSlug("renamed-guide");
      await ready(page, `/@${renamed}/renamed-guide`);
      await browserExpect(page.locator("h1")).toHaveText(longTitle);
      await ready(page, `/c/${parentId}`);
      await browserExpect(page.locator("h1")).toHaveText(longTitle);
      await browserExpect(
        page.getByRole("link", { name: `@${renamed}`, exact: true }),
      ).toBeVisible();
      for (const path of [`/@${handle}/reading-guide`, `/@${renamed}/reading-guide`]) {
        await ready(page, path);
        await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
      }
    } finally {
      await request(app.getHttpServer())
        .patch("/api/v1/profile")
        .auth(owner, { type: "bearer" })
        .send({ handle })
        .expect(200);
      await renameSlug("reading-guide");
      await close();
    }
  }, 20000);

  it("fails safely for invalid routes and hub lookup failures, retaining authorized ID reading", async () => {
    const { page, close } = await freshPage();
    try {
      for (const path of ["/@missing-reader", "/@ab", "/@bad%2Fhandle"]) {
        await ready(page, path);
        await browserExpect(page.locator("h1")).toHaveText("This hub isn't available.");
      }
      for (const path of [
        `/@${handle}/private-reading`,
        `/@${handle}/missing`,
        `/@${emptyHandle}/reading-guide`,
        `/@${handle}/bad%2Fslug`,
      ]) {
        await ready(page, path);
        await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
        await browserExpect(page.locator("body")).not.toContainText("Private title");
      }
      for (const path of [
        "/not-a-page",
        "/unrelated/reading-guide",
        `/@${handle}/reading-guide/useful-section`,
      ]) {
        await ready(page, path);
        await browserExpect(page.locator("h1")).toHaveText("This page isn't available.");
      }
      hubMode = "failure";
      await ready(page, `/@${handle}/reading-guide`);
      await browserExpect(page.locator("h1")).toHaveText("We couldn't load this page.");
      await browserExpect(page.locator("body")).not.toContainText(longTitle);
      await browserExpect(page.locator("body")).not.toContainText("PRIVATE HUB DETAIL");
      await ready(page, `/c/${parentId}`);
      await browserExpect(page.locator("h1")).toHaveText(longTitle);
      await browserExpect(page.getByRole("link", { name: `@${handle}`, exact: true })).toHaveCount(
        0,
      );
      hubMode = "timeout";
      await ready(page, `/@${handle}`);
      await browserExpect(page.locator("h1")).toHaveText("We couldn't load this page.");
      hubMode = "normal";
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await browserExpect(page.locator("h1")).toHaveText(`@${handle}`);
    } finally {
      hubMode = "normal";
      await close();
    }
  }, 25000);

  it("revalidates pretty history and scopes shared access away from public hub discovery", async () => {
    const { page, close } = await freshPage();
    try {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: { writeText: () => Promise.reject(new Error("Unavailable")) },
        });
      });
      await ready(page, `/@${handle}/reading-guide`);
      await page.getByRole("link", { name: `@${handle}`, exact: true }).click();
      await change(parentId, "unpublish");
      await page.goBack();
      await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
      await ready(page, `/@${handle}/reading-guide?s=${linkToken}`);
      await browserExpect(page.locator("h1")).toHaveText(longTitle);
      await page.getByRole("button", { name: "Copy link", exact: true }).click();
      await browserExpect(
        page.getByRole("textbox", { name: "Copy this link", exact: true }),
      ).toHaveValue(`${origin}/c/${parentId}`);
      await page.getByRole("button", { name: "Copy shared access link", exact: true }).click();
      await browserExpect(
        page.getByRole("textbox", { name: "Copy this link", exact: true }),
      ).toHaveValue(`${origin}/c/${parentId}?s=${linkToken}`);
      await browserExpect(
        page.getByRole("link", { name: `@${handle}`, exact: true }),
      ).toHaveAttribute("href", `/@${handle}`);
      expect(
        hubReads
          .filter((read) => !read.path.includes("/collections/"))
          .every((read) => !read.token && !read.path.includes("s=")),
      ).toBe(true);
      await page.getByRole("link", { name: "Curated section title" }).click();
      expect(new URL(page.url()).searchParams.get("s")).toBe(linkToken);
      await browserExpect(page.locator("h1")).toHaveText("A useful section");
      const previousToken = linkToken;
      const rotated = await request(app.getHttpServer())
        .put(`/api/v1/collections/${parentId}/link-sharing`)
        .auth(owner, { type: "bearer" })
        .send({ enabled: true, rotate: true })
        .expect(200);
      linkToken = rotated.body.data.token;
      await ready(page, `/@${handle}/reading-guide?s=${previousToken}`);
      await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
      await ready(page, `/@${handle}`);
      await browserExpect(page.getByRole("link", { name: longTitle, exact: true })).toHaveCount(0);
    } finally {
      await change(parentId, "publish");
      await close();
    }
  }, 20000);

  it("isolates SSR client budgets and refuses forged source attribution", async () => {
    const key = (source: string) =>
      requestBudgetKey("read", source, process.env.BETTER_AUTH_SECRET ?? "");
    const first = "127.0.0.2";
    const second = "127.0.0.3";
    expect(await documentFrom(first)).toContain('class="collection-row"');
    expect(await documentFrom(second)).toContain('class="collection-row"');
    expect(await prisma.requestBudget.findUnique({ where: { key: key(first) } })).toMatchObject({
      count: 1,
    });
    expect(await prisma.requestBudget.findUnique({ where: { key: key(second) } })).toMatchObject({
      count: 1,
    });
    await prisma.requestBudget.update({ where: { key: key(first) }, data: { count: 300 } });
    const denied = await documentFrom(first, {
      "x-forwarded-for": second,
      "x-web-read-source": "forged-proof",
    });
    expect(denied).not.toContain('class="collection-row"');
    expect(await documentFrom(second)).toContain('class="collection-row"');
    expect(await prisma.requestBudget.findUnique({ where: { key: key(second) } })).toMatchObject({
      count: 2,
    });
    // A trusted ingress can append its actual source, but an arbitrary leftmost
    // header still cannot impersonate another visitor.
    expect(
      await documentFrom("127.0.0.1", { "x-forwarded-for": `${second}, ${first}` }),
    ).not.toContain('class="collection-row"');
    await prisma.requestBudget.deleteMany();
    await request(app.getHttpServer())
      .get("/api/v1/explore")
      .set("x-web-read-source", "forged-proof")
      .expect(200);
    const direct = await prisma.requestBudget.findFirstOrThrow();
    await prisma.requestBudget.update({ where: { key: direct.key }, data: { count: 300 } });
    await request(app.getHttpServer())
      .get("/api/v1/explore")
      .set("x-web-read-source", "different-forged-proof")
      .set("x-forwarded-for", second)
      .expect(429);
  });

  it("loads more, keeps focus, supports no-JavaScript continuation and renders safe empty state", async () => {
    const { page, close } = await freshPage();
    try {
      await ready(page);
      await browserExpect(page.locator(".collection-row")).toHaveCount(20);
      const more = page.getByRole("link", { name: "More collections", exact: true });
      await more.focus();
      await more.press("Enter");
      await browserExpect(page.locator(".collection-row")).toHaveCount(24);
      await browserExpect(page.getByRole("link", { name: "All collections loaded" })).toBeFocused();
      await browserExpect(page.locator('p[aria-live="polite"]')).toHaveText(
        "4 more collections loaded.",
      );
      await page.goto(`${origin}/?cursor=invalid`);
      await browserExpect(page.locator("h1")).toHaveText("This list has changed.");
    } finally {
      await close();
    }
    const plain = await freshPage(false);
    try {
      await ready(plain.page);
      await plain.page.getByRole("link", { name: "More collections", exact: true }).click();
      await browserExpect(plain.page.locator(".collection-row")).toHaveCount(4);
      await ready(plain.page, `/c/${parentId}`);
      await plain.page.getByRole("link", { name: "More resources", exact: true }).click();
      await browserExpect(plain.page.locator(".resource-row")).toHaveCount(2);
    } finally {
      await plain.close();
    }
  }, 20000);

  it("reads sections, wraps at all target widths, supports keyboard and clipboard fallback", async () => {
    const { page, close } = await freshPage();
    try {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: { writeText: () => Promise.reject(new Error("Unavailable")) },
        });
      });
      await ready(page, `/c/${parentId}`);
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await browserExpect(
          page.getByRole("button", { name: "Copy link", exact: true }),
        ).toBeVisible();
      }
      await browserExpect(page.locator(".resource-row")).toHaveCount(20);
      await page.getByRole("link", { name: "More resources", exact: true }).click();
      await browserExpect(page.locator(".resource-row")).toHaveCount(22);
      await browserExpect(page.getByRole("link", { name: "All resources loaded" })).toBeFocused();
      await page.goto(`${origin}/c/${parentId}?cursor=invalid`);
      await browserExpect(page.locator("h1")).toHaveText("This list has changed.");
      await page.getByRole("link", { name: "Reload collection", exact: true }).click();
      await browserExpect(page.locator("h1")).toHaveText(longTitle);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });
      const contrast = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        const style = getComputedStyle(document.documentElement);
        const luminance = (token: string) => {
          ctx.fillStyle = style.getPropertyValue(token).trim();
          ctx.fillRect(0, 0, 1, 1);
          const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data)
            .slice(0, 3)
            .map((value) => {
              const v = value / 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        return [
          ["--color-ink", "--color-canvas"],
          ["--color-muted", "--color-surface"],
          ["--color-primary", "--color-canvas"],
        ].map(([fg, bg]) => {
          const a = luminance(fg),
            b = luminance(bg);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      });
      expect(contrast.every((ratio) => ratio >= 4.5)).toBe(true);
      await page.getByRole("button", { name: "Copy link", exact: true }).click();
      await browserExpect(page.getByRole("textbox", { name: "Copy this link" })).toHaveValue(
        `${origin}/c/${parentId}`,
      );
      await page.screenshot({ path: "/tmp/w3-reader-desktop.png", fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "/tmp/w3-reader-phone.png", fullPage: true });
      await browserExpect(page.getByText("section-tag", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Curated section title" }).click();
      await browserExpect(page.locator("h1")).toHaveText("A useful section");
      await browserExpect(page.getByText("No resources in this collection yet.")).toBeVisible();
      await page.getByRole("link", { name: longTitle }).click();
      await page.getByRole("link", { name: "Open the reference" }).click();
      await browserExpect(page.locator("body")).toHaveText("External reference opened");
      expect(captureReferer).toBeNull();
    } finally {
      await close();
    }
  }, 20000);

  it("handles continuation failures and Retry-After without losing existing results", async () => {
    const { page, close } = await freshPage();
    try {
      await ready(page);
      await page.route(
        "**/api/v1/explore?**",
        (route) =>
          route.fulfill({
            status: 429,
            headers: { "Retry-After": "1", "content-type": "application/json" },
            body: JSON.stringify({
              error: { code: "too_many_requests", message: "PRIVATE RAW ERROR" },
            }),
          }),
        { times: 1 },
      );
      await page.getByRole("link", { name: "More collections", exact: true }).click();
      await browserExpect(page.locator(".collection-row")).toHaveCount(20);
      await browserExpect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled();
      await browserExpect(page.locator("body")).not.toContainText("PRIVATE RAW ERROR");
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await browserExpect(page.locator(".collection-row")).toHaveCount(24);
    } finally {
      await close();
    }
  }, 15000);

  it("keeps hidden/missing/malformed collections equivalent and clears history after unpublish", async () => {
    const { page, close } = await freshPage();
    try {
      for (const id of [privateId, crypto.randomUUID(), "invalid"]) {
        await ready(page, `/c/${id}`);
        await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
        await browserExpect(page.locator("body")).not.toContainText("Private title");
      }
      await ready(page, `/c/${parentId}`);
      await page.getByRole("link", { name: "← Explore" }).click();
      await change(parentId, "unpublish");
      await page.goBack();
      await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
    } finally {
      await change(parentId, "publish");
      await close();
    }
  }, 20000);

  it("preserves subtree tokens only for explicit sharing, then removes content after rotation", async () => {
    await change(parentId, "unpublish");
    const { page, close } = await freshPage();
    try {
      await ready(page, `/c/${parentId}?s=${linkToken}`);
      await browserExpect(page.locator('a[href="/"]')).toHaveCount(2);
      expect(
        await page.getByRole("link", { name: "Open the reference" }).getAttribute("href"),
      ).not.toContain(linkToken);
      await browserExpect(page.getByText("section-tag", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Curated section title" }).click();
      expect(new URL(page.url()).searchParams.get("s")).toBe(linkToken);
      await browserExpect(page.locator("h1")).toHaveText("A useful section");
      await request(app.getHttpServer())
        .put(`/api/v1/collections/${parentId}/link-sharing`)
        .auth(owner, { type: "bearer" })
        .send({ enabled: true, rotate: true })
        .expect(200);
      await page.reload();
      await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
      expect(
        await page.evaluate(
          () => Object.keys(localStorage).length + Object.keys(sessionStorage).length,
        ),
      ).toBe(0);
    } finally {
      await change(parentId, "publish");
      await close();
    }
  }, 15000);

  it("issues a real browser cookie and prevents cross-user/expired-session restoration", async () => {
    const { page, close } = await freshPage();
    try {
      await ready(page);
      const email = "reader-owner@example.com";
      expect(
        await page.evaluate(
          async (value) =>
            (
              await fetch("/api/v1/auth/code/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: value }),
              })
            ).status,
          email,
        ),
      ).toBe(200);
      const row = await prisma.emailOutbox.findFirstOrThrow({
        where: {
          recipientKey: emailKey(emailConfig().suppressionSecret, "recipient", email),
          state: "pending",
        },
        orderBy: { createdAt: "desc" },
      });
      const code = unseal(row.payload ?? "", process.env.BETTER_AUTH_SECRET ?? "").text.match(
        /\b\d{8}\b/,
      )?.[0];
      expect(
        await page.evaluate(
          async (body) =>
            (
              await fetch("/api/v1/auth/code/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              })
            ).status,
          { email, code },
        ),
      ).toBe(200);
      await ready(page, `/c/${privateId}`);
      await browserExpect(page.locator("h1")).toHaveText("Private title should never leak");
      const other = await freshPage();
      try {
        await ready(other.page, `/c/${privateId}`);
        await browserExpect(other.page.locator("h1")).toHaveText(
          "This collection isn't available.",
        );
      } finally {
        await other.close();
      }
      await ready(page, `/@${handle}/private-reading`);
      await browserExpect(page.locator("h1")).toHaveText("Private title should never leak");
      await prisma.session.updateMany({ data: { expiresAt: new Date(0) } });
      await page.getByRole("link", { name: "← Explore" }).click();
      await page.goBack();
      await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
      await ready(page, `/c/${privateId}`);
      await browserExpect(page.locator("h1")).toHaveText("This collection isn't available.");
    } finally {
      await close();
    }
  }, 20000);

  it("shows complete empty and unavailable states without leaking remote errors", async () => {
    const { page, close } = await freshPage();
    try {
      exploreMode = "empty";
      await ready(page);
      await browserExpect(page.getByText("No published collections yet.")).toBeVisible();
      exploreMode = "failure";
      await page.reload();
      await browserExpect(page.locator("h1")).toHaveText("We couldn't load this page.");
      await browserExpect(page.locator("body")).not.toContainText("PRIVATE INTERNAL DETAIL");
      exploreMode = "normal";
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await browserExpect(page.locator(".collection-row")).toHaveCount(20);
    } finally {
      exploreMode = "normal";
      await close();
    }
  }, 15000);

  it("rejects unsafe cookie requests independent of body type, origin absence and bearer headers", async () => {
    const signed = await signInWithCode(app.getHttpServer(), { email: "csrf-reader@example.com" });
    const token = signed.headers["set-auth-token"];
    const session = (signed.headers["set-cookie"] as unknown as string[])
      .map((value) => value.split(";")[0])
      .join("; ");
    for (const sentOrigin of [undefined, "null", "https://untrusted.example"]) {
      for (const type of ["application/json", "multipart/form-data; boundary=fixture"]) {
        const req = request(app.getHttpServer())
          .post("/api/v1/imports")
          .set("Cookie", session)
          .set("Content-Type", type)
          .auth(token, { type: "bearer" });
        if (sentOrigin) req.set("Origin", sentOrigin);
        await req.send(type === "application/json" ? "{}" : "--fixture--").expect(403);
      }
      const req = request(app.getHttpServer())
        .post(`/api/v1/collections/${privateId}/unpublish`)
        .set("Cookie", session);
      if (sentOrigin) req.set("Origin", sentOrigin);
      await req.expect(403);
    }
    // Trusted cookie and cookie-free bearer reach the API authority, not middleware rejection.
    await request(app.getHttpServer())
      .get("/api/v1/profile")
      .auth(token, { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .set("Cookie", session)
      .set("Origin", origin)
      .send({ bio: "Browser boundary verified" })
      .expect(200);
  }, 15000);
});
