# Assume que o contexto do build é a PRÓPRIA pasta apps/web (não a raiz do
# monorepo) — é o que o Dokploy usa de fato quando "Docker File" aponta pra um
# subdiretório, independente do que for configurado em "Docker Context Path".
# Por isso não depende do package.json/lockfile raiz: instala só com o
# package.json local (sem workspaces do npm).

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Valor padrão fixo aqui (em vez de depender só do build arg do Dokploy, que não
# estava sendo repassado de forma confiável na prática) — pra trocar o domínio da
# API, muda o valor abaixo e refaz o build.
ARG VITE_API_URL=https://coleta-documentos-api.madmbrasil.com.br
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
