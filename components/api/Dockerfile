# Build context is components/api, matching `directory` in
# components/images/api.toml.
#
# KNOWN NUON RUNNER BEHAVIOUR: the runner builds this with kaniko, and kaniko
# RUN steps have been seen executing against a polluted, non-isolated host
# filesystem, where a package manager reports dependencies "already satisfied"
# and the image silently ships a stale tree. The defence is to wipe the caches a
# step depends on before it runs, and to rebuild rather than trust a cache.

FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /src
COPY go.mod go.sum ./

# Module and build caches go first, so nothing can be satisfied from a stale
# copy left behind on the host.
RUN rm -rf /go/pkg/mod /root/.cache/go-build \
    && go mod download

COPY . .

# Both binaries ship in this image: the chart runs /bin/api in its api
# deployment and /bin/worker in its worker deployment, from the same image
# (components/chart/values.yaml points worker.image at img_api too). -a rebuilds
# every package instead of trusting the build cache.
RUN CGO_ENABLED=0 go build -a -trimpath -ldflags="-s -w" -o /out/api . \
    && CGO_ENABLED=0 go build -a -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker \
    && test -x /out/api \
    && test -x /out/worker

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab

COPY --from=builder /out/api /bin/api
COPY --from=builder /out/worker /bin/worker

USER nonroot:nonroot
EXPOSE 8080
CMD ["/bin/api"]
