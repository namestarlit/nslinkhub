FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS build
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
RUN bun run api:build

FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
WORKDIR /app
# The same immutable artifact runs the explicit Prisma release migration.
# Keep its pinned CLI dependencies; no installation or compilation at startup.
COPY --from=build --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/packages ./packages
COPY --from=build --chown=bun:bun /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=bun:bun /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=bun:bun /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=bun:bun /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build --chown=bun:bun /app/apps/api/src/config/secret.ts ./apps/api/src/config/secret.ts
COPY --from=build --chown=bun:bun /app/apps/api/package.json /app/apps/api/tsconfig.runtime.json ./apps/api/
COPY --from=build --chown=bun:bun /app/package.json /app/bun.lock ./
WORKDIR /app/apps/api
ENV NODE_ENV=production PORT=4000
USER bun
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 CMD ["bun", "-e", "const r=await fetch('http://127.0.0.1:4000/api/v1/health',{signal:AbortSignal.timeout(2500)});process.exit(r.ok?0:1)"]
CMD ["bun", "--tsconfig-override", "tsconfig.runtime.json", "dist/src/entrypoint.js"]
