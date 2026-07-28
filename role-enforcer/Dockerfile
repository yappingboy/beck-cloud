FROM golang:1.22-bookworm AS builder

WORKDIR /app
COPY go.mod ./
COPY . .
RUN go mod tidy
RUN go build -ldflags="-s -w" -o /role-enforcer .

FROM alpine:3.19

RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /role-enforcer .

EXPOSE 8080

USER 65534:65534

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["/app/role-enforcer"]
