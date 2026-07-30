FROM ghcr.io/gleam-lang/gleam:v1.17.0-erlang-alpine AS build
WORKDIR /app

COPY gleam.toml manifest.toml ./
RUN gleam deps download

COPY src ./src
COPY index.html style.css ./
RUN gleam run -m lustre/dev build chipcafe \
  && cp index.html dist/index.html \
  && cp style.css dist/style.css

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/
EXPOSE 80
