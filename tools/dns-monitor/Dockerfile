FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /dns-monitor .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
RUN adduser -D -u 1000 dns-monitor
USER dns-monitor
COPY --from=builder /dns-monitor /dns-monitor
EXPOSE 8080
CMD ["/dns-monitor"]
