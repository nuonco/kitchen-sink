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

# One image, every Relay role: /bin/api dispatches on RELAY_MODE (api /
# worker / echo / generate — see main.go), which is how the chart runs the
# ingest API, the delivery engine, the echo receiver and the event-generator
# CronJob from this single image (components/chart/values.yaml points them all
# at img_api). /bin/worker is a compat shim identical to RELAY_MODE=worker.
# -a rebuilds every package instead of trusting the build cache.
RUN CGO_ENABLED=0 go build -a -trimpath -ldflags="-s -w" -o /out/api . \
    && CGO_ENABLED=0 go build -a -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker \
    && test -x /out/api \
    && test -x /out/worker

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

# Deliberately still root, unlike the ui image: this service reads the mounted
# service account token to reach the Kubernetes API, and that is behaviour there
# is no way to verify outside a cluster. Worth revisiting with a real install.
COPY --from=builder /out/api /bin/api
COPY --from=builder /out/worker /bin/worker

EXPOSE 8080
CMD ["/bin/api"]
