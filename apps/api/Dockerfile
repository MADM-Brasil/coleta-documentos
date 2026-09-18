# Build a partir da raiz do monorepo (Dokploy: "Build Context Path" = raiz do repo,
# "Dockerfile Path" = apps/api/Dockerfile) — precisa do root package.json/lockfile
# pro npm workspaces resolver as dependências certas.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
# npm precisa achar o package.json dos DOIS workspaces (o lockfile referencia
# apps/api e apps/web juntos), mesmo buildando só a API aqui.
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace=apps/api --include-workspace-root

COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# npm workspaces hospeda (hoist) a maioria das deps em /app/node_modules — o Node
# resolve pra cima a partir de apps/api/ automaticamente, não precisa duplicar.
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/package.json apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["npm", "start"]
