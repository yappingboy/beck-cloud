FROM golang:1.22-alpine AS builder
RUN apk --no-cache build-base
WORKDIR /app
COPY . .
RUN CGO_ENABLED=1 go build -o /webhook-relay .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates libstdc++
RUN adduser -D -u 1000 webhook-relay
USER webhook-relay
RUN mkdir -p /data
COPY --from=builder /webhook-relay /webhook-relay
EXPOSE 8080
CMD ["/webhook-relay"]
