# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN npm install --global pnpm@10.26.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig*.json ./
COPY lib/ lib/
COPY artifacts/hablar-coming-soon/ artifacts/hablar-coming-soon/
COPY attached_assets/ attached_assets/
RUN pnpm install --frozen-lockfile
# The production site is hosted at /. PORT is required while loading Vite config.
ARG SITE_ORIGIN
RUN NODE_ENV=production PORT=8080 BASE_PATH=/ pnpm --filter @workspace/hablar-coming-soon run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
ENV API_UPSTREAM=http://api:8080
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/artifacts/hablar-coming-soon/dist/public /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
