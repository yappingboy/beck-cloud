FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /qr-generator .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates git
RUN adduser -D -u 1000 qr-generator
USER qr-generator
COPY --from=builder /qr-generator /qr-generator
EXPOSE 8080
CMD ["/qr-generator"]
