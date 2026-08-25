# Build context is components/ui, matching `directory` in
# components/images/ui.toml.
#
# KNOWN NUON RUNNER BEHAVIOUR: the runner builds this with kaniko, and kaniko
# RUN steps have been seen executing against a polluted, non-isolated host
# filesystem. A package manager then reports dependencies "already satisfied"
# and the image silently ships a stale tree. The defence is the same in every
# stage below: wipe the directory a step owns immediately before writing it, and
# never trust a cache. Combined with .dockerignore, every build rewrites the
# full tree.

FROM node:22-alpine AS frontend

WORKDIR /build/frontend

# Sources are copied before the install so that a node_modules or dist that
# arrived with them is destroyed by the rm below rather than reused.
COPY frontend/ ./
RUN rm -rf node_modules dist /root/.npm \
    && npm ci --no-audit --no-fund \
    && npm run build \
    && test -f dist/index.html

FROM golang:1.24-alpine AS server

WORKDIR /src
COPY go.mod go.sum* *.go ./

# frontend/dist is embedded into the binary by //go:embed, so it is the one
# directory where a stale copy would be invisible in the final image.
RUN rm -rf frontend
COPY --from=frontend /build/frontend/dist ./frontend/dist

# -a rebuilds every package instead of trusting the build cache.
RUN CGO_ENABLED=0 go build -a -trimpath -ldflags="-s -w" -o /out/ui .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates \
    && addgroup -S app \
    && adduser -S -G app app

COPY --from=server /out/ui /bin/ui

USER app
EXPOSE 3000
CMD ["/bin/ui"]
