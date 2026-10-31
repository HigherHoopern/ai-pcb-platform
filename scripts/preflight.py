#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 运行环境预检引擎 (Preflight Inspector)

自动检测宿主机工具链状态：
  1. KiCad CLI (硬件 ERC/DRC 与 Gerber 导出核心引擎)
  2. ARM 嵌入式 GCC 编译器 (固件编译与语法静态校验)
  3. Python 3.8+ 及基础依赖
  4. Git & Git LFS (大文件与版本管理)

若缺少任何必要工具，自动输出操作系统专属的一键安装指令。
"""

import sys, os, subprocess, platform, shutil

COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_CYAN = "\033[96m"
COLOR_RESET = "\033[0m"

def log_ok(title, msg):
    print(f"  [{COLOR_GREEN}✓ READY{COLOR_RESET}] {title}: {msg}")

def log_warn(title, msg, fix=None):
    print(f"  [{COLOR_YELLOW}! WARN {COLOR_RESET}] {title}: {msg}")
    if fix:
        print(f"            {COLOR_CYAN}建议安装: {fix}{COLOR_RESET}")

def log_error(title, msg, fix=None):
    print(f"  [{COLOR_RED}✗ ERROR{COLOR_RESET}] {title}: {msg}")
    if fix:
        print(f"            {COLOR_CYAN}必装命令: {fix}{COLOR_RESET}")

def get_os():
    sys_name = platform.system().lower()
    if "darwin" in sys_name: return "macos"
    if "linux" in sys_name: return "linux"
    if "windows" in sys_name: return "windows"
    return "unknown"

def check_kicad():
    exe = shutil.which("kicad-cli")
    os_name = get_os()
    
    # macOS 常规安装路径补丁
    if not exe and os_name == "macos":
        mac_path = "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"
        if os.path.exists(mac_path):
            exe = mac_path

    if not exe:
        fix_cmds = {
            "macos": "brew install --cask kicad",
            "linux": "sudo add-apt-repository ppa:kicad/kicad-8.0-releases -y && sudo apt update && sudo apt install -y kicad",
            "windows": "winget install KiCad.KiCad"
        }
        log_error("KiCad CLI", "未在系统 PATH 中找到 kicad-cli (必须依赖)", fix_cmds.get(os_name, "请前往 https://www.kicad.org/download/ 下载安装"))
        return False
    
    try:
        res = subprocess.run([exe, "version"], capture_output=True, text=True, timeout=5)
        ver = res.stdout.strip() or res.stderr.strip()
        log_ok("KiCad CLI", f"{ver} ({exe})")
        return True
    except Exception as e:
        log_error("KiCad CLI", f"执行异常: {e}")
        return False

def check_arm_gcc():
    exe = shutil.which("arm-none-eabi-gcc")
    os_name = get_os()
    if not exe:
        fix_cmds = {
            "macos": "brew install --cask gcc-arm-embedded",
            "linux": "sudo apt-get update && sudo apt-get install -y gcc-arm-none-eabi",
            "windows": "winget install Arm.GnuArmEmbeddedToolchain"
        }
        log_warn("ARM GCC", "未安装 arm-none-eabi-gcc (可选: 若仅设计PCB可跳过；若需本地编译固件则必须安装)", fix_cmds.get(os_name, "请安装 ARM GNU Toolchain"))
        return True
    
    try:
        res = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=5)
        ver_line = res.stdout.splitlines()[0] if res.stdout else "unknown"
        log_ok("ARM GCC", f"{ver_line} ({exe})")
        return True
    except Exception as e:
        log_warn("ARM GCC", f"执行异常: {e}")
        return True

def check_python():
    v = sys.version_info
    ver_str = f"{v.major}.{v.minor}.{v.micro}"
    if v.major >= 3 and v.minor >= 8:
        log_ok("Python 3", f"{ver_str} ({sys.executable})")
        return True
    else:
        log_error("Python 3", f"版本过低 ({ver_str})，需 Python 3.8 及以上")
        return False

def check_git_and_lfs():
    git_exe = shutil.which("git")
    if not git_exe:
        log_error("Git", "未检测到 Git 命令行")
        return False
    
    lfs_exe = shutil.which("git-lfs")
    if not lfs_exe:
        os_name = get_os()
        fix_cmds = {
            "macos": "brew install git-lfs && git lfs install",
            "linux": "sudo apt install -y git-lfs && git lfs install",
            "windows": "winget install GitHub.GitLFS"
        }
        log_warn("Git LFS", "未安装 git-lfs (大文件文档管理建议安装)", fix_cmds.get(os_name))
    else:
        log_ok("Git & LFS", "已就绪")
    return True

def check_agent_clis():
    print(f"\n{COLOR_CYAN}  --- Coding Agent CLI 编程助手状态 ---{COLOR_RESET}")
    agents = [
        ("Claude Code CLI", ["claude"], "npm install -g @anthropic-ai/claude-code"),
        ("Pi CLI", ["pi"], "npm install -g @withpi/pi"),
        ("Codex CLI", ["codex"], "npm install -g @openai/codex"),
        ("Antigravity CLI", ["agy", "antigravity"], "curl -fsSL https://antigravity.google/install.sh | sh")
    ]
    ready_count = 0
    for name, binaries, install_cmd in agents:
        exe = None
        for b in binaries:
            p = shutil.which(b)
            if p:
                exe = p
                break
            candidates = [
                os.path.expanduser(f"~/.local/bin/{b}"),
                f"/usr/local/bin/{b}",
                f"/opt/homebrew/bin/{b}",
            ] + glob.glob(os.path.expanduser(f"~/.nvm/versions/node/*/bin/{b}"))
            for cand in candidates:
                if os.path.isfile(cand) and os.access(cand, os.X_OK):
                    exe = cand
                    break
            if exe: break

        if exe:
            try:
                res = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=3)
                ver = (res.stdout.strip() or res.stderr.strip() or "已就绪").splitlines()[0]
                log_ok(name, f"{ver} ({exe})")
                ready_count += 1
            except Exception:
                log_ok(name, f"已就绪 ({exe})")
                ready_count += 1
        else:
            log_warn(name, "未安装", install_cmd)
    
    return ready_count > 0

def main():
    import glob
    print(f"\n{COLOR_CYAN}======================================================{COLOR_RESET}")
    print(f"{COLOR_CYAN}       AI-PCB Platform 宿主机工具链环境预检            {COLOR_RESET}")
    print(f"{COLOR_CYAN}======================================================{COLOR_RESET}")
    
    all_ok = True
    all_ok &= check_python()
    all_ok &= check_kicad()
    all_ok &= check_arm_gcc()
    all_ok &= check_git_and_lfs()
    has_agents = check_agent_clis()
    
    print(f"{COLOR_CYAN}------------------------------------------------------{COLOR_RESET}")
    if all_ok:
        print(f"{COLOR_GREEN}✓ 核心硬件环境与编译器完全就绪！{COLOR_RESET}")
        if has_agents:
            print(f"{COLOR_GREEN}✓ 检测到宿主机已配置 Coding Agent CLI，可直接选配一键开工！{COLOR_RESET}\n")
        else:
            print(f"{COLOR_YELLOW}! 提示: 尚未安装任何 Agent CLI，建议安装 Claude Code, Pi, Codex 或 Antigravity。{COLOR_RESET}\n")
        return 0
    else:
        print(f"{COLOR_RED}✗ 缺少必要的核心依赖（如 KiCad），请先按照上述指引安装后再启动平台。{COLOR_RESET}\n")
        return 1

if __name__ == "__main__":
    import glob
    sys.exit(main())

