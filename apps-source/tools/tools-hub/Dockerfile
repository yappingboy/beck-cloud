FROM caddy:2-alpine

# Expose the index at root
COPY index.html /usr/share/caddy/index.html

# Minimal Caddyfile embedded
RUN printf ':\n\nroot * /usr/share/caddy\nfile_server\n' > /etc/caddy/Caddyfile

EXPOSE 80
