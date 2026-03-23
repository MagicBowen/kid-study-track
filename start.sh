#!/bin/bash

echo "🚀 启动学习计划跟踪系统..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js"
    echo "   访问 https://nodejs.org/ 下载安装"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

# 确保数据目录存在
mkdir -p data/backups
mkdir -p uploads

# 启动服务器
echo ""
echo "✅ 启动服务器..."
echo "📱 学生界面: http://localhost:3000"
echo "👁️  家长界面: 点击顶部导航切换"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

node src/server.js
