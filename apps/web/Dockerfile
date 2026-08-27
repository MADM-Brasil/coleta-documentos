FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web ./apps/web

# VITE_API_URL é embutida no bundle em tempo de BUILD (não dá pra trocar depois
# só mudando variável de ambiente do container — precisa rebuildar a imagem).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm install --workspace=apps/web
RUN npm run build --workspace=apps/web

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
