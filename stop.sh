#!/usr/bin/env bash
# ==============================================================================
# AI-PCB Platform 停止脚本 (stop.sh)
# 用于安全停止在后台运行的 Web 服务
# ==============================================================================

set -e

# 获取脚本所在绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="${SCRIPT_DIR}/.server.pid"
PORT=8989

# ANSI 颜色输出
GREEN="\033[92m"
CYAN="\033[96m"
YELLOW="\033[93m"
RED="\033[91m"
RESET="\033[0m"

echo -e "\n${CYAN}======================================================${RESET}"
echo -e "${CYAN}             AI-PCB Platform 停止管理器               ${RESET}"
echo -e "${CYAN}======================================================${RESET}"

stopped=0

# 1. 尝试通过 PID 文件停止
if [ -f "${PID_FILE}" ]; then
    PID=$(cat "${PID_FILE}")
    if ps -p "${PID}" > /dev/null 2>&1; then
        echo -e "  [*] 正在停止进程 (PID: ${PID})..."
        kill "${PID}" 2>/dev/null || true
        
        # 等待进程完全退出
        for i in {1..10}; do
            if ! ps -p "${PID}" > /dev/null 2>&1; then
                break
            fi
            sleep 0.3
        done
        
        # 如果仍在运行，强制杀掉
        if ps -p "${PID}" > /dev/null 2>&1; then
            echo -e "  [${YELLOW}! WARN${RESET}] 进程未响应，正在强制终止..."
            kill -9 "${PID}" 2>/dev/null || true
        fi
        stopped=1
    fi
    rm -f "${PID_FILE}"
fi

# 2. 检查端口残留进程 (避免僵尸或由其他方式启动的 server.py)
PORT_PIDS=$(lsof -ti:${PORT} 2>/dev/null || true)
if [ -n "${PORT_PIDS}" ]; then
    for p in ${PORT_PIDS}; do
        echo -e "  [*] 清理占用端口 ${PORT} 的残留进程 (PID: ${p})..."
        kill -9 "${p}" 2>/dev/null || true
        stopped=1
    done
fi

if [ ${stopped} -eq 1 ]; then
    echo -e "  [${GREEN}✓ SUCCESS${RESET}] AI-PCB Platform 服务已安全停止！"
else
    echo -e "  [${YELLOW}! INFO${RESET}] 未检测到正在运行的 AI-PCB Platform 服务。"
fi

echo -e "${CYAN}======================================================${RESET}\n"
