#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform Web 平台后端服务 (FastAPI v2.0 - 通用化平台版)

提供现代交互式 Web 界面与 RESTful API：
  1. 仪表盘与环境预检：真实探测 KiCad CLI、ARM GCC、Python、Git 及当前激活 LLM 模型
  2. 模型与 Agent 配置中心：支持多 Provider 配置、分场景模型路由、API 连通性测试、Agent 参数与环境变量定制
  3. 多工程工作空间切换：支持工程自动发现、切换、新建及 SSOT (spec.json & pinout.json) 实时同步
  4. 软硬件协同中枢：支持文档提炼与表单直填合一、引脚冲突智能预检、确定性生成 `bsp_pinout.h`
  5. 闭环验收中心：动态调用 `kicad-cli pcb drc`、`kicad-cli pcb render` (实时 3D 渲染) 与 `arm-none-eabi-gcc` 固件验证
"""

import sys
import os
import glob
import json
import shutil
import subprocess
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLATFORM_ROOT not in sys.path:
    sys.path.insert(0, PLATFORM_ROOT)
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
DISTILLER_PY = os.path.join(PLATFORM_ROOT, "knowledge_distiller", "distiller.py")

from core.config_manager import load_settings, save_settings, resolve_llm_config
from core.tenant_auth import (
    resolve_request_tenant,
    validate_tenant_project_path,
    list_tenant_projects,
    desensitize_skill_detail,
    mask_cloud_settings,
    load_licenses_config
)
from core.llm_client import test_llm_connection
from core.agent_runner import (
    detect_installed_agents,
    generate_agent_command,
    dispatch_agent_task,
    get_task_status,
    kill_agent_task
)
from core.project_manager import (
    list_projects,
    get_project_details,
    register_project_dir,
    validate_pinout_matrix,
    generate_bsp_pinout_header,
    sync_project_bsp_header,
    save_project_ssot,
    render_project_3d,
    verify_project_firmware,
    save_project_source_file,
    open_local_desktop_tool,
    export_all_in_one_bundle
)
from core.mcu_database import (
    list_mcu_profiles,
    list_project_templates,
    get_project_template,
    match_mcu_profile
)
from core.scaffold_generator import (
    generate_firmware_scaffold,
    compile_firmware_to_elf,
    generate_hardware_scaffold,
    export_production_package,
    export_jlcpcb_smt_files,
    export_easyeda_pro_package,
    render_project_2d_svg,
    update_bom_lcsc_item,
    optimize_bom_to_jlc_basic,
    analyze_jlcpcb_dfm_and_cost
)
from core.pipeline_orchestrator import (
    start_autonomous_pipeline,
    get_pipeline_status,
    stop_pipeline,
    auto_heal_pcb_drc
)
from core.copilot_engine import (
    get_copilot_history,
    run_copilot_turn,
    clear_copilot_history,
    rollback_copilot_snapshot
)

app = FastAPI(title="AI-PCB Platform v2.0 (Cloud & Desktop Dual-Mode)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if os.path.exists(STATIC_DIR):
    from fastapi.staticfiles import StaticFiles
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ==============================================================================
# 0. 商业化云端分离架构 & 多租户 License 鉴权 API (Phase 1 Cloud Security Hub)
# ==============================================================================
@app.get("/api/cloud/status")
def api_cloud_status(request: Request):
    """查询当前服务的云端分离模式状态、当前租户隔离信息与核心 IP 防护策略"""
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=False)
    lic_cfg = load_licenses_config()
    return {
        "success": True,
        "cloud_mode_env": os.environ.get("XTER_CLOUD_MODE", "0") == "1",
        "tenant": {
            "authenticated": tenant_ctx.get("authenticated", True),
            "is_cloud_mode": tenant_ctx.get("is_cloud_mode", False),
            "tenant_id": tenant_ctx.get("tenant_id", "default"),
            "owner": tenant_ctx.get("owner", ""),
            "tier": tenant_ctx.get("tier", "local_dev"),
            "features": tenant_ctx.get("features", []),
            "workspace_root": tenant_ctx.get("workspace_root", ""),
        },
        "ip_protection": {
            "core_python_hidden": True,
            "skill_full_markdown_protected": True,
            "vllm_internal_ip_masked": True,
            "c99_host_sandbox_enabled": True,
        },
        "available_demo_keys": list((lic_cfg.get("licenses") or {}).keys())
    }


@app.post("/api/cloud/verify_license")
def api_verify_license(data: dict):
    """校验客户输入的商业授权码 (License Key) 并初始化独立租户工作空间"""
    raw_key = (data.get("license_key") or "").strip()
    lic_cfg = load_licenses_config()
    licenses_map = lic_cfg.get("licenses", {})
    if not raw_key or raw_key not in licenses_map:
        return {
            "success": False,
            "valid": False,
            "error": "无效的商业授权码 (Invalid License Key)，请核对您的企业/专业版 License Key。"
        }
    info = licenses_map[raw_key]
    if not info.get("active", True):
        return {
            "success": False,
            "valid": False,
            "error": f"授权码已停用或过期 (Expires: {info.get('expires_at', 'unknown')})"
        }
    from core.tenant_auth import get_tenant_workspace_root
    tenant_id = info.get("tenant_id", "tenant_unknown")
    ws_root = get_tenant_workspace_root(tenant_id, is_cloud_mode=True)
    return {
        "success": True,
        "valid": True,
        "license_key": raw_key,
        "tenant_id": tenant_id,
        "owner": info.get("owner", ""),
        "tier": info.get("tier", "pro"),
        "expires_at": info.get("expires_at", ""),
        "max_projects": info.get("max_projects", 20),
        "features": info.get("features", []),
        "workspace_root": ws_root,
        "message": f"✅ 商业授权验证通过：{info.get('owner')} ({info.get('tier').upper()})，已挂载独立租户沙箱！"
    }


def _get_tool_version(cmd_args, default_desc: str) -> str:
    try:
        res = subprocess.run(cmd_args, capture_output=True, text=True, timeout=3)
        out = (res.stdout.strip() or res.stderr.strip())
        if out:
            return out.splitlines()[0]
    except Exception:
        pass
    return default_desc


@app.api_route("/bom", methods=["GET", "HEAD"])
def get_bom_page():
    bom_path = os.path.join(STATIC_DIR, "bom_details.html")
    if os.path.exists(bom_path):
        return FileResponse(bom_path)
    raise HTTPException(status_code=404, detail="BOM page not found")


@app.get("/api/preflight")
def get_preflight():
    pf_script = os.path.join(PLATFORM_ROOT, "scripts", "preflight.py")
    res = subprocess.run([sys.executable, pf_script], capture_output=True, text=True)

    agents = detect_installed_agents()
    kicad_exe = shutil.which("kicad-cli") or (
        "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"
        if os.path.exists("/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli")
        else None
    )
    gcc_exe = shutil.which("arm-none-eabi-gcc")

    kicad_ver = _get_tool_version([kicad_exe, "version"], "未安装") if kicad_exe else "未安装"
    gcc_ver = _get_tool_version([gcc_exe, "--version"], "未安装") if gcc_exe else "未安装"
    llm_cfg = resolve_llm_config("req_distill")

    tools = [
        {
            "id": "kicad",
            "name": "KiCad CLI 引擎",
            "status": bool(kicad_exe),
            "version": kicad_ver,
            "desc": f"{kicad_ver} 官方 EDA 内核" if kicad_exe else "未安装 kicad-cli"
        },
        {
            "id": "gcc",
            "name": "ARM 交叉编译器",
            "status": bool(gcc_exe),
            "version": gcc_ver,
            "desc": gcc_ver if gcc_exe else "未安装 arm-none-eabi-gcc"
        },
        {
            "id": "python",
            "name": "Python 3 运行时",
            "status": sys.version_info >= (3, 8),
            "version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "desc": f"Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        },
        {
            "id": "git",
            "name": "Git & LFS",
            "status": bool(shutil.which("git")),
            "version": "已就绪" if shutil.which("git") else "未安装",
            "desc": "工程与版本控制"
        }
    ]
    return {
        "all_ready": res.returncode == 0,
        "raw_output": res.stdout,
        "tools": tools,
        "agents": agents,
        "active_llm": llm_cfg
    }


# ==============================================================================
# 1. 模型与 Agent 配置中心 API (Model & Agent Configuration Hub)
# ==============================================================================
@app.get("/api/config")
def get_config(request: Request):
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    resp = {
        "settings": load_settings(),
        "active_llm": resolve_llm_config("req_distill"),
        "skill_llm": resolve_llm_config("skill_distill"),
        "agents_detected": detect_installed_agents(),
        "tenant": {
            "is_cloud_mode": tenant_ctx.get("is_cloud_mode", False),
            "tenant_id": tenant_ctx.get("tenant_id", "default"),
            "owner": tenant_ctx.get("owner", ""),
            "tier": tenant_ctx.get("tier", "local_dev"),
        }
    }
    return mask_cloud_settings(resp, tenant_ctx)


@app.post("/api/config/save")
def save_config_endpoint(data: dict, request: Request):
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    if tenant_ctx.get("is_cloud_mode") and tenant_ctx.get("tier") != "enterprise_admin":
        raise HTTPException(status_code=403, detail="云端租户模式下，仅企业管理员 (Enterprise Admin) 可修改全局算力与模型路由配置。")
    current = load_settings()
    if "llm" in data:
        current["llm"] = data["llm"]
    if "agents" in data:
        current["agents"] = data["agents"]
    if "workspace" in data:
        current["workspace"].update(data["workspace"])
    saved = save_settings(current)
    return {
        "success": True,
        "settings": saved,
        "active_llm": resolve_llm_config("req_distill"),
        "agents_detected": detect_installed_agents()
    }


@app.post("/api/config/llm/test")
def test_llm_endpoint(data: dict):
    return test_llm_connection(override_config=data if data else None)


# ==============================================================================
# 2. 多工程工作空间与 SSOT 管理 API (Multi-Project Workspace)
# ==============================================================================
@app.get("/api/projects")
def api_list_projects(request: Request):
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    if tenant_ctx.get("is_cloud_mode") and tenant_ctx.get("tenant_id") != "tenant_admin_master":
        return list_tenant_projects(tenant_ctx)
    return list_projects()


@app.post("/api/projects/select")
def api_select_project(data: dict, request: Request):
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    project_dir = validate_tenant_project_path(data.get("project_dir", ""), tenant_ctx)
    if not project_dir or not os.path.exists(project_dir):
        raise HTTPException(status_code=400, detail=f"工程目录不存在: {project_dir}")
    if not tenant_ctx.get("is_cloud_mode"):
        register_project_dir(project_dir)
        settings = load_settings()
        settings.setdefault("workspace", {})["active_project_dir"] = project_dir
        save_settings(settings)
    return {
        "success": True,
        "active_project_dir": project_dir,
        "detail": get_project_details(project_dir)
    }


@app.get("/api/projects/detail")
def api_get_project_detail(request: Request, project_dir: Optional[str] = Query(None)):
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    try:
        resolved_dir = validate_tenant_project_path(project_dir, tenant_ctx) if tenant_ctx.get("is_cloud_mode") else project_dir
        return {"success": True, "detail": get_project_details(resolved_dir)}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/projects/create")
def api_create_project(data: dict, request: Request):
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    template_id = data.get("template_id") or ""
    tpl = get_project_template(template_id) if template_id else None

    raw_name = (
        data.get("project_name")
        or (tpl["default_name"] if tpl else None)
        or "New-Hardware-Project"
    ).strip()
    folder_slug = raw_name.lower().replace(" ", "_").replace("/", "_")
    if tenant_ctx.get("is_cloud_mode") and tenant_ctx.get("tenant_id") != "tenant_admin_master":
        parent_dir = tenant_ctx["workspace_root"]
    else:
        default_ws_root = load_settings().get("workspace", {}).get("projects_root") or os.path.join(PLATFORM_ROOT, "workspaces")
        parent_dir = data.get("parent_dir") or default_ws_root
    out_dir = os.path.join(parent_dir, folder_slug)

    os.makedirs(os.path.join(out_dir, "hardware", "scripts"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "hardware", "out"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "firmware", "App"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "firmware", "Drivers"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "docs"), exist_ok=True)

    if data.get("spec"):
        spec = data["spec"]
    elif tpl and tpl.get("spec"):
        spec = tpl["spec"]
        spec["project_name"] = raw_name
        if data.get("summary"):
            spec["project_summary"] = data["summary"]
        if data.get("width_mm"):
            spec["mechanical"]["width_mm"] = float(data["width_mm"])
        if data.get("height_mm"):
            spec["mechanical"]["height_mm"] = float(data["height_mm"])
        if data.get("layers"):
            spec["mechanical"]["layers"] = int(data["layers"])
        if data.get("power_source"):
            spec["power"]["input_source"] = data["power_source"]
        if data.get("mcu_model"):
            spec["mcu"]["model"] = data["mcu_model"]
            prof = match_mcu_profile(data["mcu_model"])
            spec["mcu"]["package"] = data.get("mcu_package") or prof.get("package", "TSSOP-20")
    else:
        mcu_model = data.get("mcu_model", "STM32G030F6P6")
        prof = match_mcu_profile(mcu_model)
        spec = {
            "project_name": raw_name,
            "project_summary": data.get("summary", "新建软硬件协同工程"),
            "mechanical": {
                "width_mm": float(data.get("width_mm", 50.0)),
                "height_mm": float(data.get("height_mm", 35.0)),
                "thickness_mm": float(data.get("thickness_mm", 1.6)),
                "layers": int(data.get("layers", 2)),
                "fillet_mm": 1.5,
                "mounting_holes": "四角 M2.5 定位孔",
                "height_limits": "正面限高 ≤ 8.0mm",
                "keepouts": "板边 3.0mm 法拉第屏蔽笼缝合孔"
            },
            "power": {
                "input_source": data.get("power_source", "USB Type-C 5V / 3.7V 锂电池"),
                "operating_voltage": "3.3V",
                "boost_or_buck": "LDO 稳压 3.3V",
                "max_current": "500mA",
                "low_power_spec": "支持待机休眠",
                "protection": ["PMOS 防反接保护", "ESD TVS 静电防护"]
            },
            "mcu": {
                "model": mcu_model,
                "package": data.get("mcu_package") or prof.get("package", "TSSOP-20"),
                "debug_interface": "SWD",
                "firmware_framework": "纯嵌入式 C (裸机/状态机)"
            },
            "peripherals": ["状态指示 LED", "用户按键 KEY1", "I2C 传感器接口", "SWD 调试接口"],
            "manufacturing": {
                "fab": "JLCPCB (嘉立创)",
                "finish": "ENIG (沉金)",
                "faraday_cage": True,
                "acid_trap_chamfer": True
            }
        }

    pinout = data.get("pinout") or (tpl.get("pinout") if tpl else None) or [
        {"pin": "PA0", "net_name": "USER_KEY1", "function": "GPIO_EXTI0", "description": "用户按键输入 (低电平有效)"},
        {"pin": "PA1", "net_name": "STATUS_LED", "function": "GPIO_Output", "description": "系统运行状态指示灯"},
        {"pin": "PB6", "net_name": "I2C1_SCL", "function": "I2C1_SCL", "description": "传感器 I2C 时钟线"},
        {"pin": "PB7", "net_name": "I2C1_SDA", "function": "I2C1_SDA", "description": "传感器 I2C 数据线"},
        {"pin": "PA13", "net_name": "SWDIO", "function": "SYS_SWDIO", "description": "SWD 调试数据接口"},
        {"pin": "PA14", "net_name": "SWCLK", "function": "SYS_SWCLK", "description": "SWD 调试时钟接口"}
    ]

    with open(os.path.join(out_dir, "spec.json"), "w", encoding="utf8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)
    with open(os.path.join(out_dir, "pinout.json"), "w", encoding="utf8") as f:
        json.dump(pinout, f, indent=2, ensure_ascii=False)

    sync_project_bsp_header(out_dir)
    if data.get("auto_scaffold", True):
        try:
            generate_firmware_scaffold(out_dir, overwrite=True)
            compile_firmware_to_elf(out_dir)
            generate_hardware_scaffold(out_dir, overwrite=True)
            render_project_3d(out_dir)
        except Exception:
            pass
    if not tenant_ctx.get("is_cloud_mode"):
        register_project_dir(out_dir)
        settings = load_settings()
        settings.setdefault("workspace", {})["active_project_dir"] = out_dir
        save_settings(settings)

    return {
        "success": True,
        "project_dir": out_dir,
        "tenant_id": tenant_ctx.get("tenant_id", "default"),
        "detail": get_project_details(out_dir)
    }


@app.get("/api/templates")
def api_list_templates():
    return {
        "success": True,
        "templates": list_project_templates(),
        "mcus": list_mcu_profiles()
    }


@app.get("/api/mcus")
def api_list_mcus():
    return {"success": True, "mcus": list_mcu_profiles()}


@app.post("/api/pinout/validate")
def api_validate_pinout(data: dict):
    spec = data.get("spec") or {}
    pinout = data.get("pinout") or []
    mcu_str = (spec.get("mcu") or {}).get("model") or data.get("mcu_model") or ""
    validation = validate_pinout_matrix(pinout, mcu_str)
    bsp_code = generate_bsp_pinout_header(spec, pinout)
    return {
        "success": True,
        "validation": validation,
        "bsp_header_code": bsp_code
    }


# ==============================================================================
# 3. Coding Agent 调度 API
# ==============================================================================
@app.get("/api/agents")
def get_agents():
    return detect_installed_agents()


@app.post("/api/agents/command")
def get_agent_command(data: dict):
    agent_id = data.get("agent_id", "antigravity")
    task_type = data.get("task_type", "full")
    project_dir = data.get("project_dir")
    interactive = data.get("interactive", False)
    return generate_agent_command(agent_id, task_type, project_dir, interactive)


@app.post("/api/agents/dispatch")
def dispatch_agent(data: dict):
    agent_id = data.get("agent_id", "antigravity")
    task_type = data.get("task_type", "full")
    project_dir = data.get("project_dir")
    try:
        res = dispatch_agent_task(agent_id, task_type, project_dir)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/agents/task/{task_id}")
def check_task(task_id: str):
    return get_task_status(task_id)


@app.post("/api/agents/task/{task_id}/kill")
def stop_task(task_id: str):
    return kill_agent_task(task_id)


# ==============================================================================
# 4. 需求上传、提炼与 Gate 1 锁定签署 API
# ==============================================================================
@app.post("/api/spec/generate")
async def generate_spec(data: dict):
    p_name = data.get("name", "untitled_board")
    w = float(data.get("width", 50))
    h = float(data.get("height", 30))
    th = float(data.get("thickness", 1.0))
    layers = int(data.get("layers", 2))
    mcu = data.get("mcu", "STM32L011")
    pwr = data.get("power", "3.7V Lithium Battery")
    periph = data.get("peripherals", [])
    notes = data.get("notes", "")

    spec = {
        "project_name": p_name,
        "mechanical": {
            "width_mm": w, "height_mm": h, "thickness_mm": th,
            "layers": layers, "fillet_mm": float(data.get("fillet", 1.0))
        },
        "power": {
            "input_source": pwr,
            "protection": ["防反接保护", "ESD/TVS防护"] if data.get("protection") else []
        },
        "mcu": {
            "model": mcu,
            "debug_interface": data.get("debug", "SWD")
        },
        "peripherals": periph,
        "manufacturing": {
            "fab": "JLCPCB",
            "finish": data.get("finish", "ENIG"),
            "faraday_cage": data.get("faraday_cage", True)
        }
    }

    prompt = f"""【项目需求】：{p_name}
【机械尺寸】：{w} x {h} mm，板厚 {th}mm，{layers}层板，四角倒角 R{data.get('fillet', 1.0)}mm。
【供电系统】：{pwr}，包含防反接保护与 ESD 防护。
【主控方案】：{mcu}，提供 {data.get('debug', 'SWD')} 调试接口。
【外设清单】：{", ".join(periph) if periph else "无特殊外设"}
【特殊工况】：表面工艺采用 {data.get('finish', 'ENIG')}，板边布置 3mm 间距法拉第屏蔽笼地孔，死铜孤岛完全剥离。
【附加说明】：{notes}
请遵循 AI-PCB 平台规范，生成软硬件单一事实源引脚映射表，并设计原理图、PCB并编写嵌入式 C 驱动程序，确保通过 kicad-cli DRC 官方 0 违规验收。"""

    return {"spec": spec, "prompt": prompt}


@app.post("/api/requirements/upload")
async def upload_requirement_files(
    files: list[UploadFile] = File(None),
    file: UploadFile = File(None),
    custom_text: str = Form("")
):
    upload_dir = os.path.join(PLATFORM_ROOT, "docs", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    saved_paths = []

    if files:
        for f in files:
            if f and f.filename:
                temp_path = os.path.join(upload_dir, f.filename)
                with open(temp_path, "wb") as out_f:
                    out_f.write(await f.read())
                saved_paths.append(temp_path)

    if file and file.filename and file.filename not in [os.path.basename(p) for p in saved_paths]:
        temp_path = os.path.join(upload_dir, file.filename)
        with open(temp_path, "wb") as out_f:
            out_f.write(await file.read())
        saved_paths.append(temp_path)

    from core.agent_distiller import distill_requirements
    try:
        distill_res = distill_requirements(file_paths=saved_paths, custom_text=custom_text)
        return {"success": True, "data": distill_res}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/requirements/confirm")
async def confirm_requirements(data: dict):
    """用户审核并锁定需求 (Gate 1 Sign-Off)，同步写入 spec.json、pinout.json 与 bsp_pinout.h"""
    project_name = (data.get("project_name") or "Hardware-Project").strip()
    spec = data.get("spec") or {}
    pinout = data.get("pinout_table") or []
    user_comments = data.get("comments") or "用户已签署通过"
    target_dir = data.get("project_dir")

    if target_dir and os.path.exists(target_dir):
        out_dir = os.path.abspath(target_dir)
    else:
        slug = project_name.lower().replace(" ", "_").replace("/", "_")
        default_ws_root = load_settings().get("workspace", {}).get("projects_root") or os.path.join(PLATFORM_ROOT, "workspaces")
        out_dir = os.path.join(default_ws_root, slug)

    os.makedirs(os.path.join(out_dir, "hardware", "out"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "firmware", "Drivers"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "firmware", "App"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "docs"), exist_ok=True)

    spec["project_name"] = project_name
    spec["pinout_table"] = pinout

    with open(os.path.join(out_dir, "spec.json"), "w", encoding="utf8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)

    with open(os.path.join(out_dir, "pinout.json"), "w", encoding="utf8") as f:
        json.dump(pinout, f, indent=2, ensure_ascii=False)

    bsp_path = sync_project_bsp_header(out_dir)
    register_project_dir(out_dir)

    settings = load_settings()
    settings.setdefault("workspace", {})["active_project_dir"] = out_dir
    save_settings(settings)

    conf_md = f"""# 📋 已锁定工程需求确认单 (Gate 1 Confirmed)
> **项目名称**：`{project_name}`  
> **工程路径**：`{out_dir}`  
> **确认状态**：**✅ 用户已签署锁定 (Locked & Approved)**  
> **自动生成 BSP 头文件**：`{bsp_path or 'firmware/Drivers/bsp_pinout.h'}`  
> **用户备注**：{user_comments}  

## 需求模型 (spec.json)
```json
{json.dumps(spec, indent=2, ensure_ascii=False)}
```

## 引脚定义矩阵 (pinout.json)
共分配 {len(pinout)} 个硬件外设引脚。
"""
    with open(os.path.join(out_dir, "docs", "CONFIRMED_SPECIFICATION.md"), "w", encoding="utf8") as f:
        f.write(conf_md)

    from core.agent_runner import build_task_prompt
    prompt = data.get("agent_prompt") or build_task_prompt("full", out_dir)
    return {
        "success": True,
        "project_dir": out_dir,
        "bsp_header_path": bsp_path,
        "message": f"需求已确认锁定，并已自动生成 C 头文件 bsp_pinout.h ({out_dir})！",
        "agent_prompt": prompt,
        "detail": get_project_details(out_dir)
    }


# ==============================================================================
# 5. 知识库蒸馏与查看 API
# ==============================================================================
@app.post("/api/distill")
async def distill_upload(file: UploadFile = File(...), skill_name: str = Form("custom-skill")):
    import asyncio
    upload_dir = os.path.join(PLATFORM_ROOT, "docs", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    temp_path = os.path.join(upload_dir, file.filename)

    with open(temp_path, "wb") as f:
        f.write(await file.read())

    res = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, DISTILLER_PY, temp_path, "--name", skill_name],
        capture_output=True,
        text=True
    )

    return {
        "success": res.returncode == 0,
        "log": (res.stdout or "") + ("\n" + res.stderr if res.stderr else ""),
        "skill_name": skill_name
    }


from core.skill_marketplace import (
    list_all_skills_and_marketplace,
    install_skill_from_marketplace_or_url,
    toggle_skill_enabled,
    uninstall_skill
)


@app.get("/api/skills")
def list_skills():
    reg = list_all_skills_and_marketplace()
    return reg.get("installed", [])


@app.get("/api/skills/marketplace")
def api_skills_marketplace():
    reg = list_all_skills_and_marketplace()
    return {"success": True, **reg}


@app.post("/api/skills/install")
def api_install_skill(data: dict):
    skill_id = data.get("skill_id", "")
    repo_or_url = data.get("repo_or_url") or data.get("url", "")
    custom_name = data.get("custom_name", "")
    return install_skill_from_marketplace_or_url(
        skill_id=skill_id,
        repo_or_url=repo_or_url,
        custom_name=custom_name
    )


@app.post("/api/skills/toggle")
def api_toggle_skill(data: dict):
    skill_name = data.get("skill_name") or data.get("skill_id", "")
    enabled = data.get("enabled")
    return toggle_skill_enabled(skill_name=skill_name, enabled=enabled)


@app.post("/api/skills/uninstall")
def api_uninstall_skill(data: dict):
    skill_name = data.get("skill_name") or data.get("skill_id", "")
    return uninstall_skill(skill_name=skill_name)


@app.get("/api/skills/{skill_name}")
def get_skill_detail(skill_name: str, request: Request):
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    p = os.path.join(PLATFORM_ROOT, "skills", skill_name)
    if not os.path.isdir(p):
        # 支持直接预览尚未安装的市场精选 Skill
        reg = list_all_skills_and_marketplace()
        from core.skill_marketplace import MARKETPLACE_CATALOG
        cat = next((x for x in MARKETPLACE_CATALOG if x["id"] == skill_name), None)
        if cat:
            raw_cat = {
                "name": cat["id"],
                "title": cat["title"],
                "publisher": cat["publisher"],
                "version": cat["version"],
                "category": cat["category"],
                "summary": cat["summary"],
                "source_site": cat["source_site"],
                "source_url": cat["source_url"],
                "installed": False,
                "enabled": False,
                "skill_md": cat["skill_md"],
                "cheatsheet_md": cat["cheatsheet_md"],
                "patterns_md": cat["patterns_md"]
            }
            return desensitize_skill_detail(raw_cat, tenant_ctx)
        raise HTTPException(status_code=404, detail="Skill not found")

    def _read_opt(fname):
        fp = os.path.join(p, fname)
        if os.path.exists(fp):
            with open(fp, "r", encoding="utf8", errors="ignore") as f:
                return f.read()
        return ""

    reg = list_all_skills_and_marketplace()
    inst = next((x for x in reg.get("installed", []) if x["name"] == skill_name), {})
    raw_skill = {
        "name": skill_name,
        "title": inst.get("title", skill_name),
        "publisher": inst.get("publisher", "Local / Custom"),
        "version": inst.get("version", "1.0.0"),
        "category": inst.get("category", "custom"),
        "summary": inst.get("summary", ""),
        "source_site": inst.get("source_site", "本地知识蒸馏"),
        "source_url": inst.get("source_url", ""),
        "installed": True,
        "enabled": inst.get("enabled", True),
        "skill_md": _read_opt("SKILL.md"),
        "cheatsheet_md": _read_opt("cheatsheet.md"),
        "patterns_md": _read_opt("patterns.md")
    }
    return desensitize_skill_detail(raw_skill, tenant_ctx)


# ==============================================================================
# 6. 软硬件闭环审查 API (DRC / 3D 渲染 / 固件编译 / 文件预览)
# ==============================================================================
@app.get("/api/projects/file")
@app.get("/api/projects/download")
def serve_project_file(path: str = Query(...)):
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {path}")
    return FileResponse(path, filename=os.path.basename(path))


@app.get("/api/projects/read_source")
def read_project_source(path: str = Query(""), file_path: str = Query("")):
    target_p = path or file_path
    if not target_p or not os.path.isfile(target_p):
        raise HTTPException(status_code=404, detail=f"源文件不存在: {target_p}")
    try:
        with open(target_p, "r", encoding="utf8", errors="ignore") as f:
            content = f.read()
        return {"success": True, "path": target_p, "name": os.path.basename(target_p), "content": content}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/projects/save_source")
def api_save_project_source(data: dict):
    path = data.get("path") or data.get("file_path", "")
    content = data.get("content", "")
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    auto_compile = bool(data.get("auto_compile", False))
    return save_project_source_file(path=path, content=content, project_dir=project_dir, auto_compile=auto_compile)


@app.post("/api/projects/open_local")
def api_open_local_tool(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    action = data.get("action", "finder")
    target_path = data.get("target_path")
    return open_local_desktop_tool(project_dir=project_dir, action=action, target_path=target_path)


@app.post("/api/projects/export_bundle")
def api_export_all_bundle(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    res = export_all_in_one_bundle(project_dir=project_dir)
    return {
        "success": res.get("success", False),
        "bundle": res,
        "detail": get_project_details(project_dir) if project_dir and os.path.exists(project_dir) else None
    }


@app.get("/api/projects/file-preview")
def api_preview_project_file(path: str = "", project_dir: str = ""):
    from core.project_manager import preview_project_file
    if not path:
        raise HTTPException(status_code=400, detail="缺少文件路径参数 path")
    return preview_project_file(project_dir=project_dir or None, file_path=path)


@app.post("/api/projects/file-save")
def api_save_project_file(data: dict):
    from core.project_manager import save_project_file_content
    path = data.get("path", "")
    content = data.get("content", "")
    project_dir = data.get("project_dir") or ""
    if not path:
        raise HTTPException(status_code=400, detail="缺少文件路径参数 path")
    res = save_project_file_content(project_dir=project_dir or None, file_path=path, content=content)
    return {
        "success": res.get("success", False),
        "result": res,
        "detail": get_project_details(project_dir or None) if res.get("success") else None
    }


@app.post("/api/projects/fs/create")
def api_create_project_fs_item(data: dict, request: Request):
    from core.project_manager import create_project_fs_item
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    project_dir = data.get("project_dir") or ""
    if project_dir:
        assert_tenant_owns_project_path(tenant_ctx, project_dir)
    item_type = data.get("item_type") or "dir"
    rel_path = data.get("rel_path") or ""
    content = data.get("content")
    return create_project_fs_item(
        project_dir=project_dir or None,
        item_type=item_type,
        rel_path=rel_path,
        content=content
    )


@app.post("/api/projects/fs/rename")
def api_rename_project_fs_item(data: dict, request: Request):
    from core.project_manager import rename_project_fs_item
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    project_dir = data.get("project_dir") or ""
    if project_dir:
        assert_tenant_owns_project_path(tenant_ctx, project_dir)
    old_rel_path = data.get("old_rel_path") or ""
    new_rel_path = data.get("new_rel_path") or ""
    return rename_project_fs_item(
        project_dir=project_dir or None,
        old_rel_path=old_rel_path,
        new_rel_path=new_rel_path
    )


@app.post("/api/projects/fs/delete")
def api_delete_project_fs_item(data: dict, request: Request):
    from core.project_manager import delete_project_fs_item
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    project_dir = data.get("project_dir") or ""
    if project_dir:
        assert_tenant_owns_project_path(tenant_ctx, project_dir)
    rel_path = data.get("rel_path") or ""
    return delete_project_fs_item(
        project_dir=project_dir or None,
        rel_path=rel_path
    )


@app.get("/api/image/default_top")
def get_top_img():
    active_dir = load_settings().get("workspace", {}).get("active_project_dir", "")
    candidates = [
        os.path.join(active_dir, "hardware", "out", "render_3d_top.png") if active_dir else "",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "workspaces", "smart-env-alarm-01", "hardware", "out", "render_3d_top.png"),
    ]
    for p in candidates:
        if p and os.path.exists(p):
            return FileResponse(p)
    raise HTTPException(status_code=404)


@app.get("/api/image/default_bottom")
def get_bot_img():
    active_dir = load_settings().get("workspace", {}).get("active_project_dir", "")
    candidates = [
        os.path.join(active_dir, "hardware", "out", "render_3d_bottom.png") if active_dir else "",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "workspaces", "smart-env-alarm-01", "hardware", "out", "render_3d_bottom.png"),
    ]
    for p in candidates:
        if p and os.path.exists(p):
            return FileResponse(p)
    raise HTTPException(status_code=404)


@app.post("/api/verify/drc")
async def run_drc(request: Request):
    board_path = ""
    project_dir = ""
    ctype = request.headers.get("content-type", "")
    if "application/json" in ctype:
        try:
            body = await request.json()
            board_path = body.get("board_path") or body.get("pcb_path") or ""
            project_dir = body.get("project_dir") or ""
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            board_path = str(form.get("board_path") or "")
            project_dir = str(form.get("project_dir") or "")
        except Exception:
            pass

    if not board_path:
        settings = load_settings()
        active_dir = project_dir or settings.get("workspace", {}).get("active_project_dir", "")
        pcb_cands = sorted(glob.glob(os.path.join(active_dir, "hardware", "*.kicad_pcb")))
        pcb_cands.sort(key=lambda p: (0 if "test" not in os.path.basename(p).lower() else 1, os.path.basename(p)))
        board_path = pcb_cands[0] if pcb_cands else ""

    if not board_path or not os.path.exists(board_path):
        return {"success": False, "error": f"当前工程未找到 .kicad_pcb 文件 ({board_path or '无'})"}

    out_dir = os.path.join(os.path.dirname(board_path), "out")
    os.makedirs(out_dir, exist_ok=True)
    drc_json_path = os.path.join(out_dir, "drc.json")

    exe = shutil.which("kicad-cli") or "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"
    res = subprocess.run(
        [exe, "pcb", "drc", "--refill-zones", "--save-board", "--format", "json", "-o", drc_json_path, board_path],
        capture_output=True,
        text=True
    )
    d = json.load(open(drc_json_path, encoding="utf8")) if os.path.exists(drc_json_path) else {}
    violations = d.get("violations", [])
    unconnected = d.get("unconnected_items", [])
    drc_payload = {
        "board_path": board_path,
        "violations_count": len(violations),
        "unconnected_count": len(unconnected),
        "violations": violations[:30],
        "unconnected": unconnected[:30],
    }
    return {
        "success": res.returncode == 0,
        "board_path": board_path,
        "violations_count": len(violations),
        "unconnected_count": len(unconnected),
        "violations": violations[:30],
        "unconnected": unconnected[:30],
        "drc": drc_payload,
        "raw": res.stdout or res.stderr
    }


@app.post("/api/verify/render3d")
def api_render_3d(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    pcb_path = data.get("pcb_path")
    return render_project_3d(project_dir, pcb_path)


@app.post("/api/verify/firmware")
def api_verify_firmware(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    return verify_project_firmware(project_dir)


@app.post("/api/scaffold/firmware")
def api_scaffold_firmware(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    overwrite = bool(data.get("overwrite", True))
    scaf_res = generate_firmware_scaffold(project_dir, overwrite=overwrite)
    build_res = compile_firmware_to_elf(project_dir)
    return {
        "success": scaf_res.get("success", False) and build_res.get("success", False),
        "scaffold": scaf_res,
        "build": build_res,
        "detail": get_project_details(project_dir)
    }


@app.post("/api/scaffold/hardware")
def api_scaffold_hardware(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    overwrite = bool(data.get("overwrite", True))
    hw_res = generate_hardware_scaffold(project_dir, overwrite=overwrite)
    render_res = render_project_3d(project_dir, hw_res.get("pcb_path"))
    return {
        "success": hw_res.get("success", False),
        "hardware": hw_res,
        "render": render_res,
        "detail": get_project_details(project_dir)
    }


@app.post("/api/scaffold/export")
def api_scaffold_export(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    pcb_path = data.get("pcb_path")
    exp_res = export_production_package(project_dir, pcb_path)
    return {
        "success": exp_res.get("success", False),
        "export": exp_res,
        "detail": get_project_details(project_dir)
    }


@app.post("/api/verify/drc_heal")
def api_drc_self_heal(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    pcb_path = data.get("pcb_path")
    if not pcb_path and project_dir:
        pcbs = sorted(glob.glob(os.path.join(project_dir, "hardware", "*.kicad_pcb")))
        pcbs.sort(key=lambda p: (0 if "test" not in os.path.basename(p).lower() else 1, os.path.basename(p)))
        pcb_path = pcbs[0] if pcbs else ""
    heal_res = auto_heal_pcb_drc(pcb_path)
    return {
        "success": heal_res.get("success", False),
        "heal": heal_res,
        "detail": get_project_details(project_dir) if project_dir else None
    }


@app.post("/api/pipeline/start")
def api_start_pipeline(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    mode = data.get("mode", "fast_deterministic")
    override_agents = data.get("agents_map")
    try:
        res = start_autonomous_pipeline(project_dir=project_dir, mode=mode, override_agents=override_agents, blocking=False)
        return {"success": True, "pipeline": res}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/pipeline/status/{pipeline_id}")
def api_get_pipeline_status(pipeline_id: str):
    return get_pipeline_status(pipeline_id)


@app.post("/api/pipeline/stop/{pipeline_id}")
def api_stop_pipeline(pipeline_id: str):
    return stop_pipeline(pipeline_id)


# ==============================================================================
# 7. P4/P5: 嘉立创 (JLCPCB / LCSC / EasyEDA) 制造增强、SSOT 快捷引脚同步与双模块 Copilot API
# ==============================================================================
@app.post("/api/verify/render2d")
def api_render_2d_svg(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    pcb_path = data.get("pcb_path")
    sch_path = data.get("sch_path")
    res = render_project_2d_svg(project_dir, pcb_path=pcb_path, sch_path=sch_path)
    return {
        "success": res.get("success", False),
        "svg": res,
        "detail": get_project_details(project_dir) if project_dir and os.path.exists(project_dir) else None
    }


@app.post("/api/pcb/export_jlc")
def api_export_jlcpcb_smt(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    pcb_path = data.get("pcb_path")
    jlc_res = export_jlcpcb_smt_files(project_dir, pcb_path=pcb_path)
    prod_res = export_production_package(project_dir, pcb_path=pcb_path)
    return {
        "success": jlc_res.get("success", False),
        "jlc": jlc_res,
        "export": prod_res,
        "detail": get_project_details(project_dir) if project_dir and os.path.exists(project_dir) else None
    }


@app.post("/api/pcb/export_easyeda")
def api_export_easyeda_pro(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    pcb_path = data.get("pcb_path")
    res = export_easyeda_pro_package(project_dir, pcb_path=pcb_path)
    return {
        "success": res.get("success", False),
        "easyeda": res,
        "detail": get_project_details(project_dir) if project_dir and os.path.exists(project_dir) else None
    }


@app.post("/api/pcb/bom/update")
def api_update_bom_lcsc(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    reference = data.get("reference", "")
    lcsc_code = data.get("lcsc") or data.get("lcsc_code", "")
    lib_type = data.get("lib_type") or data.get("library_type", "Basic")
    value = data.get("value")
    res = update_bom_lcsc_item(project_dir, reference=reference, lcsc_code=lcsc_code, lib_type=lib_type, value=value)
    return {
        "success": res.get("success", False),
        "update": res,
        "detail": get_project_details(project_dir) if project_dir and os.path.exists(project_dir) else None
    }


@app.post("/api/pcb/bom/optimize_jlc")
def api_optimize_bom_jlc_basic(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    res = optimize_bom_to_jlc_basic(project_dir)
    return {
        "success": res.get("success", False),
        "optimize": res,
        "detail": get_project_details(project_dir) if project_dir and os.path.exists(project_dir) else None
    }


@app.post("/api/ssot/quick_pinout")
def api_save_quick_pinout(data: dict):
    """在 PCB 工坊或固件工坊内直接修改共享引脚表 (pinout.json)，自动刷新 bsp_pinout.h 并可选一键重绘 PCB 或重编译固件"""
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    if not project_dir or not os.path.exists(project_dir):
        return {"success": False, "error": "工程目录不存在"}
    cur_detail = get_project_details(project_dir)
    spec = data.get("spec") or cur_detail.get("spec", {})
    pinout = data.get("pinout")
    if not isinstance(pinout, list):
        return {"success": False, "error": "引脚表格式无效"}

    mcu_str = (spec.get("mcu") or {}).get("model") or ""
    validation = validate_pinout_matrix(pinout, mcu_str)
    save_res = save_project_ssot(project_dir, spec, pinout)

    rebuild_pcb = bool(data.get("rebuild_pcb") or data.get("auto_rebuild_pcb", False))
    recompile_fw = bool(data.get("recompile_fw") or data.get("auto_compile_fw", False))
    hw_res = None
    fw_res = None
    if rebuild_pcb:
        hw_res = generate_hardware_scaffold(project_dir, overwrite=True)
        render_project_3d(project_dir, hw_res.get("pcb_path"))
    if recompile_fw:
        fw_res = compile_firmware_to_elf(project_dir)

    return {
        "success": save_res.get("success", False),
        "validation": validation,
        "hardware": hw_res,
        "firmware_build": fw_res,
        "detail": get_project_details(project_dir)
    }


@app.get("/api/copilot/history")
def api_get_copilot_history(project_dir: Optional[str] = Query(None)):
    pdir = project_dir or load_settings().get("workspace", {}).get("active_project_dir", "")
    return {
        "success": True,
        "project_dir": pdir,
        "history": get_copilot_history(pdir)
    }


@app.post("/api/copilot/chat")
def api_copilot_chat(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    module = data.get("module", "pcb")
    message = data.get("message", "")
    engine_type = data.get("engine_type") or data.get("engine", "llm")
    agent_id = data.get("agent_id", "antigravity")
    active_file_path = data.get("active_file_path", "")
    eda_mode = data.get("eda_mode", "kicad")
    llm_provider = data.get("llm_provider", "")
    llm_model = data.get("llm_model", "")
    return run_copilot_turn(
        project_dir=project_dir,
        module=module,
        message=message,
        engine_type=engine_type,
        agent_id=agent_id,
        active_file_path=active_file_path,
        eda_mode=eda_mode,
        llm_provider=llm_provider,
        llm_model=llm_model
    )


@app.post("/api/copilot/rollback")
def api_copilot_rollback(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    snapshot_id = data.get("snapshot_id", "")
    return rollback_copilot_snapshot(project_dir=project_dir, snapshot_id=snapshot_id)


@app.post("/api/copilot/clear")
def api_copilot_clear(data: dict):
    project_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    module = data.get("module", "all")
    return clear_copilot_history(project_dir=project_dir, module=module)


@app.post("/api/firmware/simulate")
def api_firmware_simulate(data: dict, request: Request):
    tenant_ctx = resolve_request_tenant(request, require_auth_if_cloud=True)
    from core.firmware_simulator import run_firmware_simulation
    raw_dir = data.get("project_dir") or load_settings().get("workspace", {}).get("active_project_dir", "")
    project_dir = validate_tenant_project_path(raw_dir, tenant_ctx) if tenant_ctx.get("is_cloud_mode") else raw_dir
    adc_mv = int(data.get("adc_mv", 1200))
    temp_c = float(data.get("temp_c", 26.5))
    vbat_mv = int(data.get("vbat_mv", 3300))
    button_pressed = bool(data.get("button_pressed", False))
    ticks = int(data.get("ticks", 12))
    custom_c_code = str(data.get("custom_c_code") or "")
    return run_firmware_simulation(
        project_dir=project_dir,
        adc_mv=adc_mv,
        temp_c=temp_c,
        vbat_mv=vbat_mv,
        button_pressed=button_pressed,
        ticks=ticks,
        custom_c_code=custom_c_code
    )


@app.api_route("/", methods=["GET", "HEAD"])
def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8989)
