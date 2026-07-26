FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o auth-service .

FROM alpine:3.19
RUN adduser -D -u 1000 appuser
WORKDIR /app
COPY --from=builder /build/auth-service .
USER appuser
EXPOSE 8080
CMD ["./auth-service"]
