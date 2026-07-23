FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /image-editor-api .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
RUN adduser -D -u 1000 image-editor
USER image-editor
RUN mkdir -p /data/images
COPY --from=builder /image-editor-api /image-editor-api
EXPOSE 8080
CMD ["/image-editor-api"]
