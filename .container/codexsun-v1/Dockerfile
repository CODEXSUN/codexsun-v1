ARG NODE_RUNTIME_VERSION=26.5.0
ARG NGINX_BASE_IMAGE=nginx:1.28-alpine

FROM node:${NODE_RUNTIME_VERSION}-bookworm-slim AS dependencies

ARG NPM_RUNTIME_VERSION
WORKDIR /app
RUN npm install --global npm@${NPM_RUNTIME_VERSION}
COPY package.json package-lock.json .npmrc tsconfig.json tsconfig.base.json turbo.json ./
COPY tools ./tools
COPY packages ./packages
COPY apps ./apps
COPY devkits ./devkits
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000

FROM dependencies AS api-build
RUN npm run build -w @codexsun/framework \
  && npm run build -w @codexsun/accounts-api \
  && npm run build -w @codexsun/auditor-api \
  && npm run build -w @codexsun/billing-api \
  && npm run build -w @codexsun/chat-api \
  && npm run build -w @codexsun/codexsun-api \
  && npm run build -w @codexsun/core-api \
  && npm run build -w @codexsun/crm-api \
  && npm run build -w @codexsun/data-bridge-api \
  && npm run build -w @codexsun/data-migration-api \
  && npm run build -w @codexsun/docs-api \
  && npm run build -w @codexsun/ecommerce-api \
  && npm run build -w @codexsun/frappe-api \
  && npm run build -w @codexsun/himsx-api \
  && npm run build -w @codexsun/hrms-api \
  && npm run build -w @codexsun/logicx-erp-api \
  && npm run build -w @codexsun/mail-api \
  && npm run build -w @codexsun/marketing-api \
  && npm run build -w @codexsun/notes-api \
  && npm run build -w @codexsun/project-manager-api \
  && npm run build -w @codexsun/qcafe-api \
  && npm run build -w @codexsun/sites-api \
  && npm run build -w @codexsun/sportsclub-api \
  && npm run build -w @codexsun/tconnect-api \
  && npm run build -w @codexsun/zetro-api \
  && npm run build -w @codexsun/zuno-api \
  && npm run build -w @codexsun/platform-api

FROM dependencies AS web-build
RUN npm run build -w @codexsun/framework \
  && npm run build -w @codexsun/platform-web

FROM dependencies AS shop-build
RUN npm run build -w @codexsun/ecommerce-storefront

FROM dependencies AS worker-build
RUN npm run build -w @codexsun/worker-api

FROM dependencies AS chatb-build
RUN npm run build -w @codexsun/chatb-api

FROM dependencies AS production-dependencies
RUN npm ci --omit=dev --ignore-scripts --no-audit --workspace=@codexsun/platform-api --include-workspace-root=false --fetch-retries=2 --fetch-timeout=60000

FROM dependencies AS realtime-dependencies
RUN npm ci --omit=dev --ignore-scripts --no-audit --workspace=@codexsun/worker-api --workspace=@codexsun/chatb-api --include-workspace-root=false --fetch-retries=5

FROM node:${NODE_RUNTIME_VERSION}-bookworm-slim AS api
WORKDIR /app
COPY --from=dependencies /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=30 update \
  && apt-get install -y --no-install-recommends ca-certificates mariadb-client \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /storage/app/public /storage/public /storage/tenants /storage/backups/database /app/apps/platform/web/public \
  && ln -s /storage/tenants /app/storage \
  && touch /app/.env \
  && chown -R node:node /storage /app/.env /app/apps
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --chmod=755 --from=api-build /app/packages/framework ./packages/framework
COPY --chmod=755 --from=api-build /app/apps/qcafe/api ./apps/qcafe/api
COPY --chmod=755 --from=api-build /app/dist/apps ./dist/apps
COPY --chmod=755 --from=api-build /app/dist/devkits ./dist/devkits
COPY --chmod=755 --from=api-build /app/dist/packages ./dist/packages
COPY --chmod=755 tools/register-production-package-resolution.mjs ./tools/register-production-package-resolution.mjs
COPY --chmod=755 .container/codexsun-v1/api-entrypoint.sh /usr/local/bin/codexsun-api-entrypoint
ENV NODE_ENV=production
USER node
ARG CODEXSUN_VERSION
ARG CODEXSUN_REVISION
ARG PLATFORM_API_PORT
LABEL org.opencontainers.image.version="$CODEXSUN_VERSION" org.opencontainers.image.revision="$CODEXSUN_REVISION"
EXPOSE ${PLATFORM_API_PORT}
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=10 CMD node -e "fetch('http://127.0.0.1:'+process.env.PLATFORM_API_PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["codexsun-api-entrypoint"]

FROM node:${NODE_RUNTIME_VERSION}-bookworm-slim AS worker
ARG CODEXSUN_VERSION
ARG CODEXSUN_REVISION
LABEL org.opencontainers.image.version="$CODEXSUN_VERSION" org.opencontainers.image.revision="$CODEXSUN_REVISION"
WORKDIR /app
COPY --from=realtime-dependencies /app/node_modules ./node_modules
COPY --from=worker-build /app/apps/worker/api/package.json ./package.json
COPY --from=worker-build /app/dist/apps/worker/api ./dist/apps/worker/api
USER node
ENV NODE_ENV=production
ENV CODEXSUN_WORKER_PORT=17040
EXPOSE 17040
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:'+process.env.CODEXSUN_WORKER_PORT+'/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "dist/apps/worker/api/server.js"]

FROM node:${NODE_RUNTIME_VERSION}-bookworm-slim AS chatb
ARG CODEXSUN_VERSION
ARG CODEXSUN_REVISION
LABEL org.opencontainers.image.version="$CODEXSUN_VERSION" org.opencontainers.image.revision="$CODEXSUN_REVISION"
WORKDIR /app
COPY --from=realtime-dependencies /app/node_modules ./node_modules
COPY --from=chatb-build /app/apps/chatb/api/package.json ./package.json
COPY --from=chatb-build /app/dist/apps/chatb/api ./dist/apps/chatb/api
USER node
ENV NODE_ENV=production
ENV CODEXSUN_CHATB_PORT=17031
EXPOSE 17031
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:'+process.env.CODEXSUN_CHATB_PORT+'/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "dist/apps/chatb/api/server.js"]

FROM ${NGINX_BASE_IMAGE} AS web
ARG CODEXSUN_VERSION
ARG CODEXSUN_REVISION
LABEL org.opencontainers.image.version="$CODEXSUN_VERSION" org.opencontainers.image.revision="$CODEXSUN_REVISION"
COPY .container/codexsun-v1/nginx-web.conf /etc/nginx/templates/default.conf.template
COPY --from=web-build /app/dist/apps/platform/web /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1

FROM ${NGINX_BASE_IMAGE} AS shop
ARG CODEXSUN_VERSION
ARG CODEXSUN_REVISION
LABEL org.opencontainers.image.version="$CODEXSUN_VERSION" org.opencontainers.image.revision="$CODEXSUN_REVISION"
COPY .container/codexsun-v1/nginx-shop.conf /etc/nginx/templates/default.conf.template
COPY --from=shop-build /app/dist/apps/ecommerce/storefront /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1
