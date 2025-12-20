FROM alpine:3.18

RUN apk update && apk add --no-cache \
    wget \
    unzip \
    ca-certificates \
    curl

# DESCARGAR LA MISMA VERSIÓN QUE USAS LOCALMENTE
RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v0.30.0/pocketbase_0.30.0_linux_amd64.zip \
    && unzip -q pocketbase_0.30.0_linux_amd64.zip \
    && chmod +x pocketbase \
    && rm pocketbase_0.30.0_linux_amd64.zip

RUN mkdir -p /pb_data

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]