#!/bin/bash
set -e

APP_DIR="/opt/be-your-hero"
BACKEND_DIR="$APP_DIR/backend"
DATA_DIR="$BACKEND_DIR/data"

echo "========================================="
echo "   Be Your Hero - 云服务器部署脚本"
echo "========================================="
echo ""

# 1. Update system
echo "[1/7] 更新系统..."
apt-get update -qq
apt-get install -y -qq curl wget unzip git nginx

# 2. Install Node.js 18
echo "[2/7] 安装 Node.js 18..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "18" ]; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y -qq nodejs
fi
node -v
npm -v

# 3. Install PM2
echo "[3/7] 安装 PM2..."
npm install -g pm2@latest

# 4. Install dependencies
echo "[4/7] 安装项目依赖..."
cd "$BACKEND_DIR"
npm ci --production

# 5. Setup data directory
echo "[5/7] 配置数据目录..."
mkdir -p "$DATA_DIR"
touch "$DATA_DIR/game.db"
chmod 755 "$DATA_DIR"
chmod 644 "$DATA_DIR/game.db"

# 6. Create .env if not exists
echo "[6/7] 检查环境配置..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    cat > "$BACKEND_DIR/.env" << 'EOF'
PORT=8080
NODE_ENV=production
LLM_PROVIDER=mock
LLM_API_KEY=
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=60000
EOF
    echo "      已创建默认 .env，请编辑配置你的 LLM API 密钥"
    echo "      路径: $BACKEND_DIR/.env"
fi

# 7. Start with PM2
echo "[7/7] 启动服务..."
cd "$APP_DIR"
pm2 delete be-your-hero 2>/dev/null || true
pm2 start backend/ecosystem.config.js

echo ""
echo "========================================="
echo "   部署完成!"
echo "========================================="
echo ""
echo "访问地址:"
echo "  http://$(curl -s ifconfig.me):8080"
echo ""
echo "管理命令:"
echo "  pm2 status           - 查看状态"
echo "  pm2 logs be-your-hero - 查看日志"
echo "  pm2 restart all      - 重启服务"
echo ""
echo "记得编辑 .env 配置 LLM API 密钥!"
echo "  nano $BACKEND_DIR/.env"
