# Build a partir da raiz do monorepo (Dokploy: "Build Context Path" = raiz do repo,
# "Dockerfile Path" = apps/web/Dockerfile).
# VITE_API_URL precisa ser passado como build arg (não env var em runtime) — o Vite
# embute esse valor no bundle estático na hora do build, ex:
# --build-arg VITE_API_URL=https://forms-madm-api.SEU_DOMINIO

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
# npm precisa achar o package.json dos DOIS workspaces (o lockfile referencia
# apps/api e apps/web juntos), mesmo buildando só o front aqui.
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=apps/web --include-workspace-root

COPY apps/web apps/web

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build --workspace=apps/web

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
