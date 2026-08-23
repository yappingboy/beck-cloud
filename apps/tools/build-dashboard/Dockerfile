FROM node:22-alpine

# kubectl - used by the dashboard to inspect and trigger build jobs
RUN apk add --no-cache curl bash && \
    curl -sL https://dl.k8s.io/release/v1.32.0/bin/linux/amd64/kubectl -o /usr/local/bin/kubectl && \
    chmod +x /usr/local/bin/kubectl

WORKDIR /app
COPY index.html server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
