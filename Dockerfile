# lir-web on Cloud Run: nginx serving the static page on port 8080.
# Pinned to the stable minor line (1.30); bump on purpose.
FROM nginx:1.30-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY deploy/40-lir-config.sh /docker-entrypoint.d/40-lir-config.sh
COPY index.html aprobar.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY schema /usr/share/nginx/html/schema
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-lir-config.sh \
    && chmod +x /docker-entrypoint.d/40-lir-config.sh
EXPOSE 8080
