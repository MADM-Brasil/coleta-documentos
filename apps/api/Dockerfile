# Assume que o contexto do build é a PRÓPRIA pasta apps/api (não a raiz do
# monorepo) — é o que o Dokploy usa de fato quando "Docker File" aponta pra um
# subdiretório, independente do que for configurado em "Docker Context Path".
# Por isso não depende do package.json/lockfile raiz: instala só com o
# package.json local (sem workspaces do npm).

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY prisma prisma
RUN npm install

COPY tsconfig.json ./
COPY src src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/dist dist
COPY prisma prisma
COPY package.json ./

EXPOSE 4000
CMD ["npm", "start"]
