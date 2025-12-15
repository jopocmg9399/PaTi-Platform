#!/bin/sh
set -e

echo "=== PocketBase v0.30.0 ==="

DATA_DIR="/pb_data"
mkdir -p "$DATA_DIR"

# ID de Google Drive
FILE_ID="1GRSSkUf4Tg-hCNlhkANFNoMlkRXvkNQL"
BACKUP_URL="https://drive.google.com/uc?export=download&id=${FILE_ID}"

# Solo descargar si no existe DB o está vacía
if [ ! -f "$DATA_DIR/data.db" ] || [ $(stat -c%s "$DATA_DIR/data.db" 2>/dev/null || echo 0) -lt 100000 ]; then
    echo "Descargando backup desde Google Drive..."
    
    # Método robusto para Google Drive
    for i in 1 2 3; do
        echo "Intento $i..."
        if curl -L -f -o "$DATA_DIR/data.db" "$BACKUP_URL"; then
            if [ -f "$DATA_DIR/data.db" ] && [ $(stat -c%s "$DATA_DIR/data.db") -gt 100000 ]; then
                echo "✓ Backup descargado ($(stat -c%s "$DATA_DIR/data.db") bytes)"
                break
            fi
        fi
        sleep 2
    done
else
    echo "✓ DB existente encontrada ($(stat -c%s "$DATA_DIR/data.db") bytes)"
fi

# Si no hay DB válida, PocketBase creará una nueva
echo "Iniciando PocketBase..."
exec ./pocketbase serve --http=0.0.0.0:8080 --dir="$DATA_DIR"