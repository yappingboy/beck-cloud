FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY . /usr/share/nginx/html/
COPY nginx-default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
