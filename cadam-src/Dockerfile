# CADAM — self-hosted build for BeckCloud
# Fork of https://github.com/Adam-CAD/CADAM with:
#  - Ollama provider (ollama-ai-provider) for local LLMs
#  - default model pointed at local Ollama
#  - billing no-op (ENVIRONMENT=local)
#  - Sentry stripped (no org on build)

FROM node:22-slim AS build
WORKDIR /app
ENV HUSKY=0
RUN mkdir -p /dev/shm && mount -o remount,size=2G /dev/shm 2>/dev/null || true
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
COPY . .
ARG VITE_SUPABASE_URL=http://supabase:54321
ARG VITE_SUPABASE_ANON_KEY=placeholder
ARG ENVIRONMENT=local
ARG OLLAMA_BASE_URL=http://172.16.0.7:11434
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    ENVIRONMENT=$ENVIRONMENT \
    OLLAMA_BASE_URL=$OLLAMA_BASE_URL
ENV SENTRY_DISABLE=true
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/cadam /usr/share/nginx/html/cadam
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/cadam/ >/dev/null || exit 1
