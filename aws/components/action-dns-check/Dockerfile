FROM alpine:3.22

RUN apk add --no-cache \
      bind-tools \
      ca-certificates \
      curl \
      jq

LABEL org.opencontainers.image.source="https://github.com/nuonco/kitchen-sink" \
      org.opencontainers.image.description="Image for the kitchen-sink dns_check action"
