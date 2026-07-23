FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /beckflow .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
RUN adduser -D -u 1000 beckflow
USER beckflow
COPY --from=builder /beckflow /beckflow
EXPOSE 8080
CMD ["/beckflow"]
