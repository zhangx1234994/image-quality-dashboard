#!/bin/bash

echo "=========================================="
echo "图处理看板 - 一键启动"
echo "=========================================="
echo ""

cd "/Volumes/MAC 1/生成控制台"

# 第1步: 自动诊断和修复配置
echo "🔍 步骤1: 自动检测最佳数据库配置..."
node verify_and_fix.js

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 自动配置失败,请检查网络连接"
    exit 1
fi

echo ""
echo "=========================================="
echo ""

# 第2步: 停止旧服务
echo "🛑 步骤2: 停止旧服务..."
pkill -f "node server.js" 2>/dev/null
sleep 1

# 第3步: 启动新服务
echo "🚀 步骤3: 启动服务..."
echo ""

npm start &

# 等待服务启动
sleep 3

echo ""
echo "=========================================="
echo "✅ 服务已启动!"
echo ""
echo "📊 访问地址: http://localhost:3000/index.html"
echo ""
echo "💡 提示:"
echo "   - 在浏览器中打开上面的地址"
echo "   - 可以按操作类型、状态筛选"
echo "   - 点击图片可以放大查看"
echo ""
echo "⏹️  停止服务: pkill -f 'node server.js'"
echo "=========================================="
