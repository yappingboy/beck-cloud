FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /converter .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
RUN adduser -D -u 1000 converter
USER converter
COPY --from=builder /converter /converter
EXPOSE 8080
CMD ["/converter"]
