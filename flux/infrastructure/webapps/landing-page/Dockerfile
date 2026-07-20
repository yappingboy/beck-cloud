FROM python:3.12-slim

# Apache 2.4 + mod_wsgi + essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    apache2 \
    libapache2-mod-wsgi-py3 \
    && pip install django==5.1 \
    && apt-get purge -y apache2-bin \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /tmp/*

# Remove default Apache config — we mount our own
RUN rm -f /etc/apache2/apache2.conf /etc/apache2/ports.conf \
    && rm -rf /etc/apache2/conf-enabled/* /etc/apache2/sites-enabled/* /etc/apache2/mods-enabled/*

# Set up app directory structure
RUN mkdir -p /app/beckcloud

WORKDIR /app
EXPOSE 80

CMD ["apachectl", "-D", "FOREGROUND"]
