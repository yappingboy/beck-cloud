FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /hasher .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
RUN adduser -D -u 1000 hasher
USER hasher
COPY --from=builder /hasher /hasher
EXPOSE 8080
CMD ["/hasher"]
