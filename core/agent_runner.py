#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Coding Agent 调度与选配引擎 (Agent Dispatcher & Runner)

支持 4 种主流 Coding Agent CLI 工具：
  1. Pi CLI (pi) - 极速流式交互与轻量级代码生成
  2. Claude Code CLI (claude) - Anthropic 终端自主重构与自愈 Agent
  3. Codex CLI (codex) - OpenAI 终端代码智能补全与沙箱执行
  4. Antigravity CLI (agy / antigravity) - Google DeepMind 多智能体与高级工作空间

功能：
  - 自动探测宿主机是否安装各 Agent CLI，并融合用户在「配置中心」设定的自定义路径、模型参数与环境变量
  - 基于已锁定的 spec.json / pinout.json / bsp_pinout.h 生成各 Agent 定制化的开工 Prompt 与执行指令
  - 支持后台非交互异步执行 (Headless Task)、实时日志流查看与一键终止任务 (Kill Task)
  - 支持生成一键复制的终端交互式启动命令 (Interactive Command)
"""

import sys
import os
import subprocess
import shutil
import glob
import json
import time
import uuid
import signal

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLATFORM_ROOT not in sys.path:
    sys.path.insert(0, PLATFORM_ROOT)

from core.config_manager import load_settings
from core.project_manager import sync_project_bsp_header

AGENT_DEFINITIONS = {
    "claude": {
        "id": "claude",
        "name": "Claude Code CLI",
        "binaries": ["claude"],
        "vendor": "Anthropic",
        "icon": "fa-brain",
        "color": "from-amber-500 to-orange-600",
        "description": "擅长深度长文本推理、跨工程多文件自主重构与工具链自愈调用。",
        "model_flag": "--model",
        "install_guide": "npm install -g @anthropic-ai/claude-code",
        "recommended_for": ["全流程软硬件协同", "复杂 KiCad PCB 布局布线"]
    },
    "pi": {
        "id": "pi",
        "name": "Pi CLI",
        "binaries": ["pi"],
        "vendor": "Inflection / Pi AI",
        "icon": "fa-bolt-lightning",
        "color": "from-emerald-500 to-teal-600",
        "description": "极速响应、轻量灵动，擅长快速编写嵌入式 C 固件、外设驱动及单元测试。",
        "model_flag": "--model",
        "install_guide": "npm install -g @withpi/pi",
        "recommended_for": ["嵌入式 C 驱动开发", "快速寄存器定义"]
    },
    "codex": {
        "id": "codex",
        "name": "Codex CLI",
        "binaries": ["codex"],
        "vendor": "OpenAI",
        "icon": "fa-cube",
        "color": "from-sky-500 to-blue-600",
        "description": "代码结构精准度极高，内置沙箱验证机制，擅长严谨的编译构建与 DRC 修复。",
        "model_flag": "--model",
        "install_guide": "npm install -g @openai/codex",
        "recommended_for": ["DRC 冲突排查自愈", "Makefile / 构建系统生成"]
    },
    "antigravity": {
        "id": "antigravity",
        "name": "Antigravity CLI (agy)",
        "binaries": ["agy", "antigravity"],
        "vendor": "Google DeepMind",
        "icon": "fa-meteor",
        "color": "from-purple-500 to-indigo-600",
        "description": "具备 Subagent 多智能体协同、Skill 知识库蒸馏融合及高级上下文调度能力。",
        "model_flag": "--model",
        "install_guide": "官方安装包或 agy 安装命令",
        "recommended_for": ["全案系统级设计", "知识库蒸馏与多 Agent 协同"]
    }
}

RUNNING_TASKS = {}


def _get_agent_user_cfg(agent_id: str) -> dict:
    settings = load_settings()
    return settings.get("agents", {}).get(agent_id, {})


def find_executable(binaries, custom_bin: str = ""):
    """跨平台多候选路径搜索可执行程序，优先使用用户在配置中心指定的 custom_bin"""
    if custom_bin and custom_bin.strip():
        expanded = os.path.expanduser(custom_bin.strip())
        if os.path.isfile(expanded) and os.access(expanded, os.X_OK):
            return expanded
        found_custom = shutil.which(expanded)
        if found_custom:
            return found_custom

    for b in binaries:
        p = shutil.which(b)
        if p:
            return p
        candidates = [
            os.path.expanduser(f"~/.local/bin/{b}"),
            f"/usr/local/bin/{b}",
            f"/opt/homebrew/bin/{b}",
        ] + glob.glob(os.path.expanduser(f"~/.nvm/versions/node/*/bin/{b}"))
        for cand in candidates:
            if os.path.isfile(cand) and os.access(cand, os.X_OK):
                return cand
    return None


def detect_installed_agents():
    """检测当前机器安装的 Agent CLI 状态、版本及用户自定义配置"""
    results = {}
    for agent_id, meta in AGENT_DEFINITIONS.items():
        ucfg = _get_agent_user_cfg(agent_id)
        exe_path = find_executable(meta["binaries"], ucfg.get("custom_bin", ""))
        installed = exe_path is not None
        version = "未安装"
        if installed:
            try:
                res = subprocess.run([exe_path, "--version"], capture_output=True, text=True, timeout=3)
                v_out = res.stdout.strip() or res.stderr.strip()
                if v_out:
                    version = v_out.splitlines()[0]
                else:
                    version = "已就绪"
            except Exception:
                version = "已就绪"

        results[agent_id] = {
            "id": agent_id,
            "name": meta["name"],
            "vendor": meta["vendor"],
            "icon": meta["icon"],
            "color": meta["color"],
            "description": meta["description"],
            "installed": installed,
            "path": exe_path or "",
            "version": version,
            "install_guide": meta["install_guide"],
            "recommended_for": meta["recommended_for"],
            "custom_bin": ucfg.get("custom_bin", ""),
            "model_arg": ucfg.get("model_arg", ""),
            "extra_args": ucfg.get("extra_args", ""),
            "env_vars": ucfg.get("env_vars", {})
        }
    return results


def build_task_prompt(task_type, project_dir):
    """针对具体任务（全案设计/硬件PCB/嵌入式C/DRC自愈）构建结构化指令"""
    sync_project_bsp_header(project_dir)
    spec_file = os.path.join(project_dir, "spec.json")
    pinout_file = os.path.join(project_dir, "pinout.json")
    bsp_header_file = os.path.join(project_dir, "firmware", "Drivers", "bsp_pinout.h")

    spec = {}
    if os.path.exists(spec_file):
        try:
            with open(spec_file, "r", encoding="utf8") as f:
                spec = json.load(f)
        except Exception:
            pass

    pinout = []
    if os.path.exists(pinout_file):
        try:
            with open(pinout_file, "r", encoding="utf8") as f:
                pinout = json.load(f)
        except Exception:
            pass

    pname = spec.get("project_name", os.path.basename(project_dir))
    mech = spec.get("mechanical", {})
    pwr = spec.get("power", {})
    mcu = spec.get("mcu", {})

    base_context = f"""【工程上下文与单一事实源 (SSOT)】：
- 项目名称: {pname}
- 规范文件路径: {spec_file}
- 引脚映射文件: {pinout_file}
- 自动生成的 C 头文件: {bsp_header_file}
- 目标工作目录: {project_dir}
- 机械尺寸: {mech.get('width_mm', 50)} x {mech.get('height_mm', 30)} mm，板厚 {mech.get('thickness_mm', 1.0)}mm，{mech.get('layers', 2)}层板，倒角 R{mech.get('fillet_mm', 1.0)}mm。
- 供电系统: {pwr.get('input_source', '3.7V')}，拓扑: {pwr.get('boost_or_buck', 'LDO稳压')}。
- 主控芯片: {mcu.get('model', 'STM32')} ({mcu.get('package', 'QFN')})，调试接口: {mcu.get('debug_interface', 'SWD')}。
- 外设引脚: 共分配 {len(pinout)} 个引脚。
"""

    if task_type == "firmware":
        prompt = base_context + f"""
【核心任务：嵌入式 C 驱动与固件开发】
1. 平台已根据 `pinout.json` 自动生成了确定性头文件 `{project_dir}/firmware/Drivers/bsp_pinout.h`，请在代码中直接 `#include "bsp_pinout.h"` 并严禁硬编码冲突引脚。
2. 在 `{project_dir}/firmware/` 目录下创建驱动与主逻辑代码：
   - 生成外设驱动（GPIO 初始化、ADC 采样、Timer/PWM 控制、I2C/SPI 传感器驱动）。
   - 编写主业务状态机（`App/main.c`）与低功耗管理逻辑。
3. 编写 `Makefile`，支持通过 `arm-none-eabi-gcc` 一键编译验证。
4. 保证代码纯 C99 语言编写、函数注释完备、0 编译错误与 0 警告。
"""
    elif task_type == "pcb":
        prompt = base_context + f"""
【核心任务：KiCad 电路板布局布线与打样】
1. 在 `{project_dir}/hardware/` 目录下生成/更新 KiCad 原理图与 PCB 文件：
   - 遵循 `spec.json` 的外形尺寸（Edge.Cuts），严格打磨 R{mech.get('fillet_mm', 1.0)} 圆角与定位孔。
   - 外沿环绕 3mm 法拉第接地屏蔽孔圈 (GND Via Fence)，全板顶底双面连续接地铺铜。
   - 走线使用 45° 钝角走线，电源走线宽度不小于 0.5mm，剥离死铜孤岛。
2. 调用 `kicad-cli pcb drc --refill-zones --save-board` 执行官方电气 DRC 校验，确保 0 违规、0 未连接。
3. 调用 `kicad-cli pcb export gerbers` 与 `drill` 导出嘉立创标准打样生产压缩包。
"""
    elif task_type == "drc_fix":
        prompt = base_context + f"""
【核心任务：KiCad DRC 冲突自动排查与闭环修复】
1. 调用 `kicad-cli pcb drc --refill-zones --save-board --format json -o {project_dir}/hardware/out/drc.json {project_dir}/hardware/*.kicad_pcb` 检测错误。
2. 针对报告中的每个 Clearance 间距违规、Unconnected 未连接网络或短路报错：
   - 自动调整走线轨迹、重定位过孔或调整焊盘避让间距；
   - 重新刷新铺铜区域 (Zone Fill)。
3. 反复迭代修复，直至 DRC 报告实现 **0 Violations / 0 Unconnected**。
"""
    else:  # full
        prompt = base_context + f"""
【核心任务：软硬件联合全案协同设计 (Full Co-Design)】
请基于已锁定的需求模型 (SSOT)，完成全套软硬件闭环开发：
1. 硬件端：在 `{project_dir}/hardware/` 设计 KiCad 原理图与 PCB，完成 45° 平滑布线与接地法拉第屏蔽笼，运行 `kicad-cli` 达到 DRC 0 违规，导出打样文件。
2. 固件端：在 `{project_dir}/firmware/` 中直接引用已自动生成的 `Drivers/bsp_pinout.h`，编写配套的纯 C 语言驱动代码与应用状态机，完成 GCC 编译校验。
3. 最终在 `{project_dir}/docs/DELIVERY_REPORT.md` 中输出交付报告。
"""
    return prompt.strip()


def _build_cli_args_and_cmd(agent_id: str, exe: str, prompt_file: str, prompt_text: str, project_dir: str, interactive: bool = False):
    ucfg = _get_agent_user_cfg(agent_id)
    meta = AGENT_DEFINITIONS.get(agent_id, AGENT_DEFINITIONS["claude"])
    model_arg = (ucfg.get("model_arg") or "").strip()
    extra_args_str = (ucfg.get("extra_args") or "").strip()
    env_vars = ucfg.get("env_vars") or {}

    extra_tokens = extra_args_str.split() if extra_args_str else []
    model_tokens = [meta.get("model_flag", "--model"), model_arg] if model_arg else []

    env_prefix = ""
    if env_vars:
        pairs = [f'{k}="{v}"' for k, v in env_vars.items() if k and v]
        if pairs:
            env_prefix = " ".join(pairs) + " "

    extra_cli_display = " ".join(model_tokens + extra_tokens)
    if extra_cli_display:
        extra_cli_display = " " + extra_cli_display

    if agent_id == "codex":
        headless_cmd = f'cd "{project_dir}" && {env_prefix}{exe}{extra_cli_display} exec "$(cat {prompt_file})"'
        proc_args = [exe] + model_tokens + extra_tokens + ["exec", prompt_text]
    else:
        headless_cmd = f'cd "{project_dir}" && {env_prefix}{exe}{extra_cli_display} -p "$(cat {prompt_file})"'
        proc_args = [exe] + model_tokens + extra_tokens + ["-p", prompt_text]

    interactive_cmd = f'cd "{project_dir}" && {env_prefix}{exe}{extra_cli_display}'
    return {
        "headless_cmd": headless_cmd,
        "interactive_cmd": interactive_cmd,
        "proc_args": proc_args,
        "env_vars": env_vars
    }


def generate_agent_command(agent_id, task_type="full", project_dir=None, interactive=False):
    """为指定 Agent CLI 生成启动命令与提示词文件"""
    settings = load_settings()
    if not project_dir:
        project_dir = settings.get("workspace", {}).get("active_project_dir") or os.path.join(os.path.dirname(PLATFORM_ROOT), "night-verson-goggle")

    os.makedirs(project_dir, exist_ok=True)
    prompt_file = os.path.join(project_dir, f"PROMPT_{task_type.upper()}.txt")
    prompt_text = build_task_prompt(task_type, project_dir)

    with open(prompt_file, "w", encoding="utf8") as f:
        f.write(prompt_text)

    meta = AGENT_DEFINITIONS.get(agent_id, AGENT_DEFINITIONS["claude"])
    ucfg = _get_agent_user_cfg(agent_id)
    exe = find_executable(meta["binaries"], ucfg.get("custom_bin", "")) or meta["binaries"][0]

    cli_bundle = _build_cli_args_and_cmd(agent_id, exe, prompt_file, prompt_text, project_dir, interactive)

    return {
        "agent_id": agent_id,
        "agent_name": meta["name"],
        "task_type": task_type,
        "project_dir": project_dir,
        "prompt_file": prompt_file,
        "prompt_text": prompt_text,
        "command": cli_bundle["interactive_cmd"] if interactive else cli_bundle["headless_cmd"],
        "interactive_command": cli_bundle["interactive_cmd"],
        "model_arg": ucfg.get("model_arg", ""),
        "extra_args": ucfg.get("extra_args", "")
    }


def dispatch_agent_task(agent_id, task_type="full", project_dir=None):
    """启动 Agent 后台异步任务，输出实时重定向至日志文件"""
    info = generate_agent_command(agent_id, task_type, project_dir, interactive=False)
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    log_file = os.path.join(info["project_dir"], f"agent_{agent_id}_{task_id}.log")

    meta = AGENT_DEFINITIONS.get(agent_id, AGENT_DEFINITIONS["claude"])
    ucfg = _get_agent_user_cfg(agent_id)
    exe = find_executable(meta["binaries"], ucfg.get("custom_bin", ""))
    if not exe:
        raise RuntimeError(f"Agent '{agent_id}' ({meta['name']}) 未在宿主机安装，无法直接调度！请先执行: {meta['install_guide']}")

    cli_bundle = _build_cli_args_and_cmd(agent_id, exe, info["prompt_file"], info["prompt_text"], info["project_dir"], False)
    args = cli_bundle["proc_args"]

    proc_env = os.environ.copy()
    for k, v in (cli_bundle["env_vars"] or {}).items():
        if k and v:
            proc_env[str(k)] = str(v)

    log_fp = open(log_file, "w", encoding="utf8")
    log_fp.write(f"=== AI-PCB Platform 调度任务 [{task_id}] ===\n")
    log_fp.write(f"Agent: {meta['name']} ({exe})\n")
    if ucfg.get("model_arg"):
        log_fp.write(f"Model Override: {ucfg.get('model_arg')}\n")
    if ucfg.get("extra_args"):
        log_fp.write(f"Extra Args: {ucfg.get('extra_args')}\n")
    log_fp.write(f"Task: {task_type}\n")
    log_fp.write(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    log_fp.write(f"Working Dir: {info['project_dir']}\n")
    log_fp.write("================================================\n\n")
    log_fp.flush()

    try:
        proc = subprocess.Popen(
            args,
            cwd=info["project_dir"],
            stdout=log_fp,
            stderr=subprocess.STDOUT,
            env=proc_env,
            text=True,
            close_fds=True,
            start_new_session=True
        )
        task_info = {
            "task_id": task_id,
            "agent_id": agent_id,
            "agent_name": meta["name"],
            "task_type": task_type,
            "pid": proc.pid,
            "log_file": log_file,
            "project_dir": info["project_dir"],
            "start_time": time.time(),
            "process": proc,
            "log_fp": log_fp,
            "status": "running"
        }
        RUNNING_TASKS[task_id] = task_info
        return {
            "success": True,
            "task_id": task_id,
            "pid": proc.pid,
            "log_file": log_file,
            "agent_name": meta["name"],
            "message": f"已成功调度 {meta['name']} 开始执行 {task_type} 设计！"
        }
    except Exception as e:
        log_fp.write(f"\n[启动失败]: {e}\n")
        log_fp.close()
        raise


def kill_agent_task(task_id: str) -> dict:
    """安全终止正在后台运行的 Agent 进程"""
    task = RUNNING_TASKS.get(task_id)
    if not task:
        return {"success": False, "error": "任务未找到"}

    proc = task.get("process")
    if proc and proc.poll() is None:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except Exception:
            try:
                proc.terminate()
            except Exception:
                pass
        task["status"] = "terminated_by_user"
        try:
            with open(task["log_file"], "a", encoding="utf8") as f:
                f.write(f"\n\n[⚠️ 用户手动终止任务 @ {time.strftime('%H:%M:%S')}]\n")
        except Exception:
            pass
        return {"success": True, "task_id": task_id, "status": "terminated_by_user"}

    return {"success": True, "task_id": task_id, "status": task.get("status", "completed")}


def get_task_status(task_id):
    """查询任务执行状态及最新输出日志"""
    task = RUNNING_TASKS.get(task_id)
    if not task:
        return {"found": False, "error": "任务未找到"}

    proc = task.get("process")
    if proc and task.get("status") != "terminated_by_user":
        ret = proc.poll()
        if ret is None:
            task["status"] = "running"
        elif ret == 0:
            task["status"] = "completed"
        else:
            task["status"] = f"failed (code: {ret})"

    log_content = ""
    if os.path.exists(task["log_file"]):
        try:
            with open(task["log_file"], "r", encoding="utf8", errors="ignore") as f:
                lines = f.readlines()
                log_content = "".join(lines[-150:])
        except Exception:
            pass

    if task.get("agent_id") == "antigravity" and task.get("status") == "running":
        try:
            brain_dir = os.path.expanduser("~/.gemini/antigravity-cli/brain")
            transcripts = glob.glob(os.path.join(brain_dir, "*", ".system_generated", "logs", "transcript.jsonl"))
            if transcripts:
                transcripts.sort(key=os.path.getmtime, reverse=True)
                latest_t = transcripts[0]
                if os.path.getmtime(latest_t) >= task["start_time"] - 30:
                    with open(latest_t, "r", encoding="utf8", errors="ignore") as tf:
                        tlines = tf.readlines()
                    last_step = "0"
                    last_act = "深度推理与方案设计中"
                    for tl in tlines[-10:]:
                        try:
                            td = json.loads(tl)
                            if "step_index" in td:
                                last_step = str(td["step_index"])
                            if "tool_calls" in td and td["tool_calls"]:
                                tc = td["tool_calls"][0]
                                act = tc.get("args", {}).get("toolAction") or tc.get("declaration", {}).get("name") or ""
                                if act:
                                    last_act = act.strip('"\'')
                        except Exception:
                            pass

                    conv_id = os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(latest_t))))
                    status_note = f"""\n[⚡ Antigravity 实时执行动态 (PID: {task['pid']})]:
------------------------------------------------------
· 运行状态: 正在全自动执行中 (已连续运转 {int(time.time() - task['start_time'])} 秒)
· 当前进度: 已推进至第 【{last_step}】 步
· 当前动作: {last_act}
· 独立会话: {conv_id}
· 转录日志: {latest_t}
------------------------------------------------------
"""
                    log_content += status_note
        except Exception:
            pass

    return {
        "found": True,
        "task_id": task_id,
        "agent_name": task["agent_name"],
        "status": task["status"],
        "pid": task["pid"],
        "log_file": task["log_file"],
        "elapsed_sec": int(time.time() - task["start_time"]),
        "log_tail": log_content
    }
