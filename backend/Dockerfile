FROM alpine:3.18

RUN apk update && apk add --no-cache \
    wget \
    unzip \
    ca-certificates \
    curl

# Descargar PocketBase 0.22.17
RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v0.22.17/pocketbase_0.22.17_linux_amd64.zip \
    && unzip -q pocketbase_0.22.17_linux_amd64.zip \
    && chmod +x pocketbase \
    && rm pocketbase_0.22.17_linux_amd64.zip

# Crear directorio
RUN mkdir -p /pb_data

# Copiar script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]