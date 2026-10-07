import { lookup } from "node:dns/promises";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { LinkPreview } from "@nslinkhub/types";
import { appError } from "../../common/errors/app-exception";
import { AuthGuard } from "../../common/guards/auth.guard";
import { apiOk } from "../../common/utils/response.util";
import { canonicalizeUrl, publicLinkUrl } from "../../common/utils/url.util";
import { fetchPageTitle, linkTitlesEnabled } from "./page-title";

// Looks up a link's title before it is saved, so the save form can show it. Signed-in only, read-only (never under the write lock), with its
// own small request budget ("lookup"); the fetch has the same SSRF guards as
// background lookups. Disabled under test unless LINK_TITLES=on.
@Controller("api/v1/link-preview")
@UseGuards(AuthGuard)
export class LinkPreviewController {
  @Get()
  async preview(@Query("url") raw: unknown) {
    let url: string;
    try {
      if (typeof raw !== "string" || raw.length > 2048) throw new Error();
      const parsed = new URL(raw);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password)
        throw new Error();
      url = canonicalizeUrl(parsed.href);
    } catch {
      throw appError("bad_request");
    }
    url = publicLinkUrl(url);
    const title = linkTitlesEnabled() ? await fetchPageTitle(url) : null;
    const preview: LinkPreview = {
      url,
      title,
      status: title ? "found" : (await hostMissing(url)) ? "no_domain" : "untitled",
    };
    return apiOk(preview);
  }
}

// Only a definite "no such host" answer marks a typo; timeouts, blocked sites
// and other failures stay saveable. Hosts here already passed the public-link
// rule, so they are names, never IP literals or reserved test domains.
async function hostMissing(url: string) {
  const host = new URL(url).hostname;
  if (!linkTitlesEnabled()) return false;
  try {
    await Promise.race([
      lookup(host),
      new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 2000)),
    ]);
    return false;
  } catch (error) {
    return ["ENOTFOUND", "ENODATA"].includes((error as NodeJS.ErrnoException).code ?? "");
  }
}
