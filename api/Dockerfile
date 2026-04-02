FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /bin/api .
RUN CGO_ENABLED=0 go build -o /bin/worker ./cmd/worker

FROM alpine:3.20

RUN apk add --no-cache ca-certificates
COPY --from=builder /bin/api /bin/api
COPY --from=builder /bin/worker /bin/worker

EXPOSE 8080
CMD ["/bin/api"]
