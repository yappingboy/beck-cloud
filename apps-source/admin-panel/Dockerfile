FROM golang:1.24-alpine AS builder

WORKDIR /build
COPY go.mod ./
RUN go mod download || true
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o admin-panel main.go

FROM alpine:3.21
WORKDIR /app
COPY --from=builder /build/admin-panel .
EXPOSE 8080
CMD ["./admin-panel"]
