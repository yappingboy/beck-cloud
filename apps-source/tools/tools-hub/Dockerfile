FROM caddy:2-alpine

# Expose the index at root
COPY index.html /usr/share/caddy/index.html

# Minimal Caddyfile embedded — http:// prefix keeps Caddy on port 80 (no auto-HTTPS)
RUN printf 'http://:\n\nroot * /usr/share/caddy\nfile_server\n' > /etc/caddy/Caddyfile

EXPOSE 80
