# Usar imagen Alpine oficial más pequeña
FROM alpine:3.18

# Instalar dependencias mínimas
RUN apk add --no-cache \
    ca-certificates \
    wget \
    unzip

# Descargar PocketBase
RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v0.22.17/pocketbase_0.22.17_linux_amd64.zip \
    && unzip pocketbase_0.22.17_linux_amd64.zip \
    && chmod +x /pocketbase \
    && rm pocketbase_0.22.17_linux_amd64.zip

# Crear directorio para datos
RUN mkdir -p /pb_data

# Exponer puerto
EXPOSE 8080

# Comando de inicio
CMD ["/pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb_data"]ta"]