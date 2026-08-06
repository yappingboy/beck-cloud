FROM golang:1.22-alpine AS builder
RUN apk add --no-cache build-base
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o /cron-jobs .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates libstdc++
RUN adduser -D -u 1000 cron-jobs
RUN mkdir -p /data && chown cron-jobs /data
USER cron-jobs
COPY --from=builder /cron-jobs /cron-jobs
EXPOSE 8080
CMD ["/cron-jobs"]
