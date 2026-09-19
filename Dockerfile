FROM ghcr.io/gleam-lang/gleam:v1.17.0-erlang-alpine AS build
WORKDIR /app

RUN apk add --no-cache nodejs npm

COPY gleam.toml manifest.toml ./
RUN gleam deps download

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY src ./src
COPY assets ./assets
COPY index.html style.css config.js ./
RUN gleam run -m lustre/dev build chipcafe \
  && cp index.html dist/index.html \
  && cp style.css dist/style.css \
  && cp config.js dist/config.js

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/
COPY docker-entrypoint.d/40-chipcafe-config.sh /docker-entrypoint.d/40-chipcafe-config.sh
EXPOSE 80
