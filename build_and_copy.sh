#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "$PROJECT_DIR"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "=== Building frontend... ==="
cd "$FRONTEND_DIR"

npm run build

echo "--- Build completed successfully. ---"

echo "=== Copying files to backend... ==="
cd "$PROJECT_DIR"

mkdir -p "$BACKEND_DIR/templates"
mkdir -p "$BACKEND_DIR/static/assets"

echo "--- Copying index.html ---"
cp -v "$FRONTEND_DIR/dist/index.html" "$BACKEND_DIR/templates/"

echo "--- Replacing asset files ---"
rm -rf "$BACKEND_DIR/static/assets"
mkdir -p "$BACKEND_DIR/static/assets"
cp -rv "$FRONTEND_DIR/dist/assets/." "$BACKEND_DIR/static/assets/"

echo "=== Copy complete. ==="
