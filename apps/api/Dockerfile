FROM node:20-bookworm-slim

WORKDIR /app

# Prisma precisa do OpenSSL disponível no sistema.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copia só os manifestos primeiro (cache de camada) — o package.json do apps/web
# precisa existir pro npm resolver os workspaces do monorepo, mesmo instalando
# só o workspace da API.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api ./apps/api

RUN npm install --workspace=apps/api
RUN npm run build --workspace=apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "start"]
