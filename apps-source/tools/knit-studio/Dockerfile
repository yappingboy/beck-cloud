FROM node:24-alpine
# node:alpine ships a 'node' user at uid 1000 — matches the pod's runAsUser:1000
ENV NODE_ENV=production PORT=8080 LIBRARY_DIR=/data/library
WORKDIR /app
COPY server.js ./
COPY public ./public
# /data is a mounted volume; the app user must own the library path
RUN mkdir -p /data/library && chown -R node:node /data /app
USER node
EXPOSE 8080
CMD ["node", "server.js"]
