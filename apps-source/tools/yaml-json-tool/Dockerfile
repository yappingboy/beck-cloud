FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN GOFLAGS=-mod=mod CGO_ENABLED=0 go build -o /yaml-json-tool .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
RUN adduser -D -u 1000 yaml-json-tool
USER yaml-json-tool
COPY --from=builder /yaml-json-tool /yaml-json-tool
EXPOSE 8080
CMD ["/yaml-json-tool"]
