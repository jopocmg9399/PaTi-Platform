FROM alpine:3.18

RUN apk update && apk add --no-cache \
    wget \
    unzip \
    ca-certificates

RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v0.22.17/pocketbase_0.22.17_linux_amd64.zip \
    && unzip pocketbase_0.22.17_linux_amd64.zip \
    && chmod +x pocketbase \
    && rm pocketbase_0.22.17_linux_amd64.zip

RUN mkdir -p /pb_data

EXPOSE 8080

CMD ["./pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb_data"]
