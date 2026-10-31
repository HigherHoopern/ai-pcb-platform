#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 统一命令行主入口 (Universal Agent CLI Interface v2.0)

支持 Claude Code, Antigravity, Codex, Pi 以及终端用户直接调用：
  · preflight: 检查宿主机 KiCad CLI、ARM GCC、Python 环境与激活模型
  · config: 查看、切换或测试 LLM 模型服务商与 Agent 配置
  · distill: 将技术文档或数据手册蒸馏为标准 Skill 技能
  · new: 根据需求清单初始化新工程（软硬件协同结构 + 自动生成 bsp_pinout.h）
  · verify: 调用 kicad-cli 执行官方 DRC/ERC 与固件编译双闭环校验
  · agent: 选配与调度 Coding Agent
  · ui: 启动 Web 可视化平台
"""

import sys
import os
import subprocess
import argparse
import json

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLATFORM_ROOT not in sys.path:
    sys.path.insert(0, PLATFORM_ROOT)

SCRIPTS_DIR = os.path.join(PLATFORM_ROOT, "scripts")
DISTILLER = os.path.join(PLATFORM_ROOT, "knowledge_distiller", "distiller.py")


def cmd_preflight(args):
    pf = os.path.join(SCRIPTS_DIR, "preflight.py")
    return subprocess.run([sys.executable, pf]).returncode


def cmd_config(args):
    from core.config_manager import load_settings, save_settings, resolve_llm_config
    from core.llm_client import test_llm_connection

    settings = load_settings()
    if args.provider:
        if args.provider not in settings["llm"]["providers"]:
            print(f"[Error] 未知服务商 '{args.provider}'。可选: {', '.join(settings['llm']['providers'].keys())}")
            return 1
        settings["llm"]["active_provider"] = args.provider
        if args.model:
            settings["llm"]["providers"][args.provider]["default_model"] = args.model
        if args.api_key:
            settings["llm"]["providers"][args.provider]["api_key"] = args.api_key
        if args.base_url:
            settings["llm"]["providers"][args.provider]["base_url"] = args.base_url
        save_settings(settings)
        print(f"[✓ SUCCESS] 已更新激活服务商为: {args.provider}")

    active = resolve_llm_config("req_distill")
    print("\n======================================================")
    print("          AI-PCB Platform 当前 LLM 模型配置            ")
    print("======================================================")
    print(f"  · 激活服务商: {active['provider_name']} ({active['provider_id']})")
    print(f"  · 当前模型:   {active['model_name']}")
    print(f"  · 接口地址:   {active['base_url']}")
    print(f"  · API Key:    {'已配置 (***' + active['api_key'][-4:] + ')' if len(active.get('api_key', '')) > 4 else ('已配置' if active.get('api_key') else '未配置')}")
    print("------------------------------------------------------")

    if args.test:
        print("  [*] 正在测试 API 连通性...")
        res = test_llm_connection()
        if res["success"]:
            print(f"  [✓ PASS] 响应延迟: {res['latency_ms']} ms | 回复: {res['reply']}")
        else:
            print(f"  [✗ FAIL] 连接失败: {res['error']}")
            return 1
    return 0


def cmd_distill(args):
    return subprocess.run([sys.executable, DISTILLER, args.file, "--name", args.name]).returncode


def cmd_new(args):
    from core.project_manager import register_project_dir, sync_project_bsp_header
    from core.scaffold_generator import generate_firmware_scaffold, compile_firmware_to_elf, generate_hardware_scaffold

    prj_dir = os.path.abspath(args.output or os.path.join(os.path.dirname(PLATFORM_ROOT), args.name))
    os.makedirs(os.path.join(prj_dir, "hardware", "scripts"), exist_ok=True)
    os.makedirs(os.path.join(prj_dir, "hardware", "out"), exist_ok=True)
    os.makedirs(os.path.join(prj_dir, "firmware", "App"), exist_ok=True)
    os.makedirs(os.path.join(prj_dir, "firmware", "Drivers"), exist_ok=True)
    os.makedirs(os.path.join(prj_dir, "docs"), exist_ok=True)

    spec_template = {
        "project_name": args.name,
        "project_summary": "软硬件协同新建工程",
        "mechanical": {
            "width_mm": 50.0,
            "height_mm": 30.0,
            "thickness_mm": 1.2,
            "layers": 2,
            "fillet_mm": 1.5
        },
        "mcu": {
            "model": "STM32G030F6P6",
            "package": "TSSOP-20",
            "debug_interface": "SWD",
            "firmware_framework": "纯嵌入式 C"
        },
        "power": {
            "input_source": "USB 5V / 3.7V Battery",
            "operating_voltage": "3.3V",
            "boost_or_buck": "LDO 3.3V",
            "protection": ["防反接保护", "ESD防护"]
        },
        "peripherals": ["STATUS_LED", "USER_KEY1", "SWD"]
    }
    pinout_template = [
        {"pin": "PA0", "net_name": "USER_KEY1", "function": "GPIO_EXTI0", "description": "用户按键输入"},
        {"pin": "PA1", "net_name": "STATUS_LED", "function": "GPIO_Output", "description": "状态指示灯"},
        {"pin": "PA13", "net_name": "SWDIO", "function": "SYS_SWDIO", "description": "SWD 数据线"},
        {"pin": "PA14", "net_name": "SWCLK", "function": "SYS_SWCLK", "description": "SWD 时钟线"}
    ]
    with open(os.path.join(prj_dir, "spec.json"), "w", encoding="utf8") as f:
        json.dump(spec_template, f, indent=2, ensure_ascii=False)
    with open(os.path.join(prj_dir, "pinout.json"), "w", encoding="utf8") as f:
        json.dump(pinout_template, f, indent=2, ensure_ascii=False)

    bsp_h = sync_project_bsp_header(prj_dir)
    generate_firmware_scaffold(prj_dir, overwrite=False)
    compile_firmware_to_elf(prj_dir)
    generate_hardware_scaffold(prj_dir, overwrite=False)
    register_project_dir(prj_dir)

    print(f"\n[Success] 新工程已初始化并完成软硬件骨架生成: {prj_dir}")
    print("  ├── spec.json                       (需求参数模型)")
    print("  ├── pinout.json                     (软硬件统一引脚矩阵)")
    print("  ├── firmware/Drivers/bsp_pinout.h   (已自动生成 C99 宏定义头文件)")
    print("  ├── firmware/build/*.elf            (已生成标准 C99 固件并完成 ARM-GCC 编译)")
    print("  ├── hardware/*.kicad_pcb            (已生成 0 违规 KiCad PCB、原理图与 BOM)")
    print("  └── docs/                           (技术说明文档)")
    return 0


def cmd_scaffold(args):
    from core.scaffold_generator import (
        generate_firmware_scaffold,
        compile_firmware_to_elf,
        generate_hardware_scaffold,
        export_production_package
    )
    from core.project_manager import render_project_3d

    prj_dir = os.path.abspath(args.dir)
    if not os.path.exists(prj_dir):
        print(f"[Error] 工程目录不存在: {prj_dir}")
        return 1

    do_all = not (args.fw or args.hw or args.export)
    if args.fw or do_all:
        print(f"[*] 正在为 {prj_dir} 生成标准 C99 固件工程骨架并编译 ELF...")
        generate_firmware_scaffold(prj_dir, overwrite=True)
        fw_res = compile_firmware_to_elf(prj_dir)
        print(fw_res.get("log", ""))

    if args.hw or do_all:
        print(f"\n[*] 正在为 {prj_dir} 生成 KiCad 硬件基准 PCB、原理图、BOM 与 3D 视图...")
        hw_res = generate_hardware_scaffold(prj_dir, overwrite=True)
        print(f"  [✓ PCB] {hw_res.get('pcb_path')} (DRC 违规: {hw_res.get('drc', {}).get('violations_count', 0)}, 未连接: {hw_res.get('drc', {}).get('unconnected_count', 0)})")
        r3d = render_project_3d(prj_dir, hw_res.get("pcb_path"))
        if r3d.get("success"):
            print(f"  [✓ 3D]  已生成 Top/Bottom 3D 渲染图 ({r3d.get('elapsed_sec')}s)")

    if args.export or do_all:
        print(f"\n[*] 正在导出嘉立创 Gerber + Drill + POS 生产制造包...")
        exp_res = export_production_package(prj_dir)
        if exp_res.get("success"):
            print(f"  [✓ ZIP] {exp_res.get('zip_path')} ({exp_res.get('size_kb')} KB)")
    return 0


def cmd_pipeline(args):
    from core.pipeline_orchestrator import start_autonomous_pipeline
    prj_dir = os.path.abspath(args.dir) if args.dir else None
    res = start_autonomous_pipeline(project_dir=prj_dir, mode=args.mode, blocking=True)
    print(res.get("log_text", ""))
    if res.get("report_path"):
        print(f"\n[📄 交付报告]: {res['report_path']}")
    return 0 if res.get("status") == "completed" else 1


def cmd_verify(args):
    target = args.board
    print(f"[Verify] 正在调用 kicad-cli 对 {target} 进行官方 DRC 验证...")
    if os.path.exists(target):
        res = subprocess.run(
            ["kicad-cli", "pcb", "drc", "--refill-zones", "--save-board", "--format", "json", "-o", "/tmp/_cli_drc.json", target],
            capture_output=True,
            text=True
        )
        print(res.stdout or res.stderr)
        return res.returncode
    else:
        print(f"[Error] 未找到目标电路板文件: {target}")
        return 1


def cmd_ui(args):
    port = args.port
    print("\n======================================================")
    print("        AI-PCB Platform Web 可视化前端服务             ")
    print("======================================================")
    print(f"  👉 正在启动本地可视化交互界面: http://127.0.0.1:{port}")
    print("  按 Ctrl+C 可停止服务\n")
    import webbrowser
    try:
        webbrowser.open(f"http://127.0.0.1:{port}")
    except Exception:
        pass
    import uvicorn
    from web.server import app
    uvicorn.run(app, host="127.0.0.1", port=port)
    return 0


def cmd_agent(args):
    from core.agent_runner import detect_installed_agents, generate_agent_command, dispatch_agent_task, get_task_status
    import time

    if args.list:
        agents = detect_installed_agents()
        print("\n======================================================")
        print("          AI-PCB Platform 支持的 Coding Agent 矩阵      ")
        print("======================================================")
        for aid, a in agents.items():
            st = "✓ 已就绪" if a["installed"] else "✗ 未安装"
            print(f"  [{st}] {a['name']} ({a['vendor']})")
            if a["installed"]:
                print(f"        版本: {a['version']}")
                print(f"        路径: {a['path']}")
            else:
                print(f"        安装指引: {a['install_guide']}")
            if a.get("model_arg"):
                print(f"        指定模型: {a['model_arg']}")
            print(f"        擅长领域: {', '.join(a['recommended_for'])}")
            print("  ----------------------------------------------------")
        return 0

    agent_id = args.agent or "claude"
    task_type = args.task or "full"
    prj_dir = os.path.abspath(args.dir) if args.dir else None

    if args.cmd:
        info = generate_agent_command(agent_id, task_type, prj_dir, interactive=args.interactive)
        print("\n[生成的终端执行指令]:")
        print("------------------------------------------------------")
        print(info["command"])
        print("------------------------------------------------------")
        print(f"[提示词文件保存于]: {info['prompt_file']}\n")
        return 0

    if args.run:
        print(f"\n[*] 正在启动 {agent_id} 执行任务 [{task_type}]...")
        res = dispatch_agent_task(agent_id, task_type, prj_dir)
        print(f"[✓ SUCCESS] {res['message']}")
        print(f"  · 任务 ID:   {res['task_id']}")
        print(f"  · 进程 PID:  {res['pid']}")
        print(f"  · 实时日志:  {res['log_file']}\n")
        return 0

    print("请指定 --list、--cmd 或 --run。使用 -h 查看完整参数。")
    return 0


def main():
    parser = argparse.ArgumentParser(description="AI-PCB Platform 统一脚手架 v2.0")
    sub = parser.add_subparsers(dest="command", help="子命令")

    sub.add_parser("preflight", help="运行工具链环境预检 (KiCad, GCC, Python, Agent CLIs)")

    p_cfg = sub.add_parser("config", help="查看、切换或测试 LLM 模型服务商配置")
    p_cfg.add_argument("--provider", "-p", help="切换激活的服务商 (siliconflow/deepseek/openai/anthropic_compat/ollama)")
    p_cfg.add_argument("--model", "-m", help="设置默认模型名称")
    p_cfg.add_argument("--api-key", "-k", help="设置 API Key")
    p_cfg.add_argument("--base-url", "-u", help="设置 Base URL")
    p_cfg.add_argument("--test", "-t", action="store_true", help="测试当前 LLM API 连通性")

    p_agent = sub.add_parser("agent", help="选配与调度 Coding Agent (Claude, Pi, Codex, Antigravity)")
    p_agent.add_argument("--list", "-l", action="store_true", help="列出所有受支持的 Agent 及其状态")
    p_agent.add_argument("--agent", "-a", choices=["claude", "pi", "codex", "antigravity"], default="claude", help="选择 Agent CLI")
    p_agent.add_argument("--task", "-t", choices=["full", "pcb", "firmware", "drc_fix"], default="full", help="执行任务类型")
    p_agent.add_argument("--dir", "-d", default=None, help="目标工程目录")
    p_agent.add_argument("--cmd", "-c", action="store_true", help="生成终端运行指令")
    p_agent.add_argument("--run", "-r", action="store_true", help="在后台启动 Agent 异步执行任务")
    p_agent.add_argument("--interactive", "-i", action="store_true", help="生成交互式终端指令")

    p_ui = sub.add_parser("ui", help="启动本地 Web 可视化交互前端")
    p_ui.add_argument("--port", "-p", type=int, default=8989, help="端口号 (默认 8989)")

    p_dist = sub.add_parser("distill", help="将技术文档蒸馏为 Skill 知识库")
    p_dist.add_argument("file", help="文档路径 (.docx / .pdf / .xlsx / .md)")
    p_dist.add_argument("--name", default="custom-skill", help="技能名称")

    p_new = sub.add_parser("new", help="初始化软硬件协同新工程")
    p_new.add_argument("name", help="工程名称 (如: smart-sensor-board)")
    p_new.add_argument("--output", "-o", default=None, help="目标目录")

    p_scaf = sub.add_parser("scaffold", help="基于工程 SSOT 生成标准 C99 固件、0 违规 KiCad PCB 与 Gerber 打样包")
    p_scaf.add_argument("--dir", "-d", required=True, help="目标工程目录")
    p_scaf.add_argument("--fw", action="store_true", help="生成 C99 固件并编译 ELF")
    p_scaf.add_argument("--hw", action="store_true", help="生成 KiCad PCB/SCH/BOM 与 3D 渲染")
    p_scaf.add_argument("--export", action="store_true", help="导出嘉立创 Gerber + Drill + POS ZIP")

    p_pipe = sub.add_parser("pipeline", help="运行 5 阶段多 Agent 软硬件全自动协同流水线 (含 DRC 自愈与交付报告)")
    p_pipe.add_argument("--dir", "-d", default=None, help="目标工程目录 (默认使用当前激活工程)")
    p_pipe.add_argument("--mode", "-m", choices=["fast_deterministic", "multi_agent_cli"], default="fast_deterministic", help="执行模式")

    p_ver = sub.add_parser("verify", help="运行 KiCad 官方 DRC 验证")
    p_ver.add_argument("board", help="PCB 文件路径")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return 0

    if args.command == "preflight":
        return cmd_preflight(args)
    if args.command == "config":
        return cmd_config(args)
    if args.command == "agent":
        return cmd_agent(args)
    if args.command == "ui":
        return cmd_ui(args)
    if args.command == "distill":
        return cmd_distill(args)
    if args.command == "new":
        return cmd_new(args)
    if args.command == "scaffold":
        return cmd_scaffold(args)
    if args.command == "pipeline":
        return cmd_pipeline(args)
    if args.command == "verify":
        return cmd_verify(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
