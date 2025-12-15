#!/bin/sh
set -e

echo "=== Iniciando PocketBase ==="

# Directorio para datos
DATA_DIR="/pb_data"
mkdir -p "$DATA_DIR"
echo "Directorio de datos: $DATA_DIR"

# ID de Google Drive
FILE_ID="1GRSSkUf4Tg-hCNlhkANFNoMlkRXvkNQL"

# Función simple para descargar
download_backup() {
    echo "Descargando backup desde Google Drive..."
    
    # URL de descarga directa
    URL="https://drive.google.com/uc?export=download&id=$FILE_ID"
    
    # Intento 1: Descarga directa
    echo "Intento 1: Descarga directa..."
    if curl -L -f -o "$DATA_DIR/data.db" "$URL"; then
        echo "✓ Descarga exitosa"
        return 0
    fi
    
    # Intento 2: Con manejo de cookies
    echo "Intento 2: Con manejo de cookies..."
    COOKIE_FILE="/tmp/gdrive_cookies.txt"
    
    # Obtener página inicial
    curl -c "$COOKIE_FILE" -s -L "$URL" > /tmp/gdrive_page.html
    
    # Buscar token de confirmación
    if grep -q "confirm=" /tmp/gdrive_page.html; then
        CONFIRM=$(grep -o "confirm=[^&]*" /tmp/gdrive_page.html | head -1 | cut -d= -f2)
        echo "Token de confirmación: $CONFIRM"
        
        URL_WITH_CONFIRM="https://drive.google.com/uc?export=download&id=$FILE_ID&confirm=$CONFIRM"
        if curl -L -b "$COOKIE_FILE" -o "$DATA_DIR/data.db" "$URL_WITH_CONFIRM"; then
            echo "✓ Descarga con token exitosa"
            rm -f "$COOKIE_FILE" /tmp/gdrive_page.html
            return 0
        fi
    fi
    
    # Limpiar
    rm -f "$COOKIE_FILE" /tmp/gdrive_page.html
    echo "✗ Todos los intentos fallaron"
    return 1
}

# Verificar si ya existe DB
if [ ! -f "$DATA_DIR/data.db" ] || [ ! -s "$DATA_DIR/data.db" ]; then
    echo "Base de datos no encontrada o vacía."
    
    if download_backup; then
        echo "✓ Backup restaurado exitosamente."
        echo "Tamaño: $(ls -lh "$DATA_DIR/data.db" 2>/dev/null || echo 'archivo descargado')"
    else
        echo "✗ No se pudo descargar backup."
        echo "✓ Iniciando con base de datos vacía."
        # Eliminar archivo vacío si existe
        rm -f "$DATA_DIR/data.db"
    fi
else
    echo "✓ Base de datos existente encontrada."
    echo "Tamaño: $(ls -lh "$DATA_DIR/data.db" 2>/dev/null || echo 'archivo existe')"
fi

# Iniciar PocketBase
echo "Iniciando PocketBase..."
echo "Comando: ./pocketbase serve --http=0.0.0.0:8080 --dir=$DATA_DIR"
exec ./pocketbase serve --http=0.0.0.0:8080 --dir="$DATA_DIR"