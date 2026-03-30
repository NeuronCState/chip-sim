#!/bin/bash
# ============================================
#  Chip Sim · 嵌入式电路仿真平台 启动脚本
#  前端: http://localhost:8005
#  后端: http://localhost:8006
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BACKEND_PORT=8006
FRONTEND_PORT=8005

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   ⚡ Chip Sim · 嵌入式电路仿真平台      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# 清理已有进程
echo -e "${YELLOW}🧹 清理端口占用...${NC}"
# 杀掉占用前端端口的进程
FRONTEND_PID_ON_PORT=$(lsof -ti:$FRONTEND_PORT 2>/dev/null)
if [ -n "$FRONTEND_PID_ON_PORT" ]; then
    echo -e "${YELLOW}  端口 $FRONTEND_PORT 被进程 $FRONTEND_PID_ON_PORT 占用，正在终止...${NC}"
    kill -9 $FRONTEND_PID_ON_PORT 2>/dev/null
    sleep 1
fi
# 杀掉占用后端端口的进程
BACKEND_PID_ON_PORT=$(lsof -ti:$BACKEND_PORT 2>/dev/null)
if [ -n "$BACKEND_PID_ON_PORT" ]; then
    echo -e "${YELLOW}  端口 $BACKEND_PORT 被进程 $BACKEND_PID_ON_PORT 占用，正在终止...${NC}"
    kill -9 $BACKEND_PID_ON_PORT 2>/dev/null
    sleep 1
fi
pkill -f "vite.*--port $FRONTEND_PORT" 2>/dev/null
pkill -f "go run.*-port $BACKEND_PORT" 2>/dev/null
sleep 1

# 安装/修复前端依赖
if [ ! -d "frontend/node_modules" ] || [ ! -f "frontend/node_modules/.bin/vite" ]; then
    echo -e "${YELLOW}📦 正在安装前端依赖...${NC}"
    cd frontend && rm -rf node_modules && npm install && cd ..
fi

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 正在关闭服务...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    pkill -f "vite.*--port $FRONTEND_PORT" 2>/dev/null
    pkill -f "go run.*-port $BACKEND_PORT" 2>/dev/null
    wait 2>/dev/null
    echo -e "${GREEN}✅ 已停止${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# 生成 vite 配置
cat > "$SCRIPT_DIR/frontend/vite.config.ts" << EOF
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: $FRONTEND_PORT,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:$BACKEND_PORT',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:$BACKEND_PORT',
      },
      '/health': {
        target: 'http://localhost:$BACKEND_PORT',
      },
    },
  },
})
EOF

# 启动后端
echo -e "${GREEN}🔧 启动后端 (Go) → http://localhost:$BACKEND_PORT${NC}"
cd "$SCRIPT_DIR/backend"
go run ./cmd/server/main.go -port $BACKEND_PORT &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ 后端启动失败（端口 $BACKEND_PORT 可能被占用）${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 后端就绪${NC}"

# 启动前端
echo -e "${GREEN}🎨 启动前端 (React + Vite) → http://localhost:$FRONTEND_PORT${NC}"
cd "$SCRIPT_DIR/frontend"
npx vite --host 0.0.0.0 --port $FRONTEND_PORT &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

sleep 4

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🌐 打开浏览器访问:                      ║${NC}"
echo -e "${CYAN}║                                          ║${NC}"
echo -e "${CYAN}║  ${GREEN}http://localhost:$FRONTEND_PORT${CYAN}                  ║${NC}"
echo -e "${CYAN}║                                          ║${NC}"
echo -e "${CYAN}║  后端 API: http://localhost:$BACKEND_PORT          ${CYAN}║${NC}"
echo -e "${CYAN}║  按 Ctrl+C 停止所有服务                  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

wait
