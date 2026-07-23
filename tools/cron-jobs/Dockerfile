FROM golang:1.22-alpine AS builder
RUN apk --no-cache build-base
WORKDIR /app
COPY go.mod go.sum ./ 2>/dev/null; go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=1 go build -o /cron-jobs .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates libstdc++
RUN adduser -D -u 1000 cron-jobs
USER cron-jobs
RUN mkdir -p /data
COPY --from=builder /cron-jobs /cron-jobs
EXPOSE 8080
CMD ["/cron-jobs"]
