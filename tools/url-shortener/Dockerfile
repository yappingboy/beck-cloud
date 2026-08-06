FROM golang:1.22-alpine AS builder
RUN apk add --no-cache build-base
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o /shortener .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates libstdc++
RUN adduser -D -u 1000 shortener
RUN mkdir -p /data && chown shortener /data
USER shortener
COPY --from=builder /shortener /shortener
EXPOSE 8080
CMD ["/shortener"]
