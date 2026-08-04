# ---- Build Stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY server.js ./
COPY package.json ./

# ---- Runtime Stage ----
FROM node:22-alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy built application
COPY --from=build --chown=appuser:appgroup /app /app

# Create necessary directories
RUN mkdir -p /app/public /var/lib/beckcloud /var/log/beckcloud \
    && chown -R appuser:appgroup /app /var/lib/beckcloud /var/log/beckcloud

# Switch to non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "server.js"]
