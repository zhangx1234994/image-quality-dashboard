#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "图处理看板 - 一键启动"
echo "=========================================="
echo ""

cd "$ROOT_DIR"

echo "🧱 第1步: 构建前端..."
npm run build

echo ""
echo "🛑 第2步: 停止旧服务..."
pkill -f "node server/server.cjs" 2>/dev/null || true
pkill -f "node server.cjs" 2>/dev/null || true
sleep 1

echo ""
echo "🚀 第3步: 启动后端服务..."
npm --prefix server start
