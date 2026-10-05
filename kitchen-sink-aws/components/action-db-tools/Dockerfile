FROM alpine:3.22

RUN apk add --no-cache \
      postgresql17-client \
      ca-certificates

LABEL org.opencontainers.image.source="https://github.com/nuonco/kitchen-sink" \
      org.opencontainers.image.description="Image for the kitchen-sink db_* actions"
