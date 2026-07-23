FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./ 2>/dev/null; go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -o /yaml-json-tool .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
RUN adduser -D -u 1000 yaml-json-tool
USER yaml-json-tool
COPY --from=builder /yaml-json-tool /yaml-json-tool
EXPOSE 8080
CMD ["/yaml-json-tool"]
