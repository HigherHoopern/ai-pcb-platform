#!/usr/bin/env bash
# ==============================================================================
# AI-PCB Platform 启动脚本 (start.sh)
# 用于在后台启动 Web 前端服务并在浏览器中打开控制台
# ==============================================================================

set -e

# 获取脚本所在绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="${SCRIPT_DIR}/.server.pid"
LOG_FILE="${SCRIPT_DIR}/server.log"
PORT=8989
HOST="127.0.0.1"
URL="http://${HOST}:${PORT}"

# ANSI 颜色输出
GREEN="\033[92m"
CYAN="\033[96m"
YELLOW="\033[93m"
RED="\033[91m"
RESET="\033[0m"

echo -e "\n${CYAN}======================================================${RESET}"
echo -e "${CYAN}             AI-PCB Platform 启动管理器               ${RESET}"
echo -e "${CYAN}======================================================${RESET}"

# 1. 检查是否已经在运行
is_running=0
if [ -f "${PID_FILE}" ]; then
    PID=$(cat "${PID_FILE}")
    if ps -p "${PID}" > /dev/null 2>&1; then
        is_running=1
    fi
fi

# 检查端口是否被占用
PORT_PID=$(lsof -ti:${PORT} 2>/dev/null | head -n 1 || true)
if [ -n "${PORT_PID}" ]; then
    is_running=1
    PID="${PORT_PID}"
fi

if [ "${is_running}" -eq 1 ]; then
    echo -e "  [${YELLOW}! WARN${RESET}] AI-PCB Platform 服务已在运行中 (PID: ${PID})"
    echo -e "  [${GREEN}✓ READY${RESET}] 控制台访问地址: ${CYAN}${URL}${RESET}"
    
    # 尝试唤起浏览器
    if command -v open > /dev/null 2>&1; then
        open "${URL}"
    elif command -v xdg-open > /dev/null 2>&1; then
        xdg-open "${URL}" > /dev/null 2>&1 || true
    fi
    echo -e "${CYAN}------------------------------------------------------${RESET}\n"
    exit 0
fi

# 2. 检查 Python3
if ! command -v python3 > /dev/null 2>&1; then
    echo -e "  [${RED}✗ ERROR${RESET}] 未找到 python3，请先安装 Python 3.8 及以上版本！"
    exit 1
fi

# 3. 后台启动服务
echo -e "  [*] 正在启动 AI-PCB Platform 服务 (端口: ${PORT})..."
nohup python3 "${SCRIPT_DIR}/web/server.py" > "${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"

# 4. 等待服务就绪并健康检查
max_retries=15
count=0
started=0

while [ ${count} -lt ${max_retries} ]; do
    if curl -s "${URL}/api/preflight" > /dev/null 2>&1; then
        started=1
        break
    fi
    sleep 0.5
    count=$((count + 1))
done

if [ ${started} -eq 1 ]; then
    echo -e "  [${GREEN}✓ SUCCESS${RESET}] AI-PCB Platform Web 服务启动成功！"
    echo -e "  [${GREEN}✓ READY${RESET}]   本地访问地址: ${CYAN}${URL}${RESET}"
    echo -e "  [${GREEN}✓ READY${RESET}]   进程 PID:     ${SERVER_PID}"
    echo -e "  [${GREEN}✓ READY${RESET}]   运行日志文件: ${LOG_FILE}"
    echo -e "\n  [💡 提示] 停止服务请执行: ${YELLOW}./stop.sh${RESET}"

    # 5. 自动在浏览器中打开前端
    if command -v open > /dev/null 2>&1; then
        open "${URL}"
    elif command -v xdg-open > /dev/null 2>&1; then
        xdg-open "${URL}" > /dev/null 2>&1 || true
    fi
else
    echo -e "  [${RED}✗ ERROR${RESET}] 服务启动超时，请检查日志: ${LOG_FILE}"
    tail -n 20 "${LOG_FILE}"
    exit 1
fi

echo -e "${CYAN}======================================================${RESET}\n"
