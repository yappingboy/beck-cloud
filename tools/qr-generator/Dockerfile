FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /qr-generator .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
RUN adduser -D -u 1000 qr-generator
USER qr-generator
COPY --from=builder /qr-generator /qr-generator
EXPOSE 8080
CMD ["/qr-generator"]
