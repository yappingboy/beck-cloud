FROM golang:1.24-alpine AS builder
RUN apk add --no-cache build-base
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o /webhook-relay .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates libstdc++
RUN adduser -D -u 1000 webhook-relay
RUN mkdir -p /data && chown webhook-relay /data
USER webhook-relay
COPY --from=builder /webhook-relay /webhook-relay
EXPOSE 8080
CMD ["/webhook-relay"]
