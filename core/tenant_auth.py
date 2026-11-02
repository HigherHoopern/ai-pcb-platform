# -*- coding: utf-8 -*-
"""
XterAI-PCB 商业化云端安全网关、License 授权鉴权、多租户物理隔离与 IP 防泄密引擎 (Phase 1)

核心职责：
1. 宿主机 C99 状态机仿真安全沙箱检查器 (audit_c_source_security)：
   拦截 system / popen / fork / exec / socket / fopen / unistd.h 等恶意系统调用，防止通过 C 仿真窃取云服务器文件。
2. License Key 鉴权与多租户工作空间物理隔离 (resolve_request_tenant)：
   支持将不同客户隔离至 workspaces/tenants/<tenant_id>/，防止跨租户越权访问。
3. Skill 知识库接口防爬取脱敏 (desensitize_skill_detail)：
   云端模式下向客户端隐藏 324 页《嘉立创实战指南》等核心蒸馏全文，仅返回章节大纲，而云端内部 AI 推理仍完整注入。
4. 内网大模型节点地址与密钥脱敏 (mask_cloud_settings)：
   隐藏私有 vLLM 推理集群内网 IP 与 API Key。
"""

import os
import re
import json
import glob
import shutil
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LICENSES_PATH = os.path.join(PLATFORM_ROOT, "config", "licenses.json")

# 危险 C 语言系统调用与头文件黑名单（严禁在云端宿主机 C99 仿真器中出现）
DANGEROUS_C_PATTERNS = [
    (r"\bsystem\s*\(", "禁止调用 system() 执行宿主机 Shell 命令"),
    (r"\bpopen\s*\(", "禁止调用 popen() 创建宿主机管道进程"),
    (r"\bfork\s*\(|\bvfork\s*\(", "禁止调用 fork()/vfork() 派生进程"),
    (r"\bexec[lv][pe]?\s*\(|\bexecve\s*\(", "禁止调用 exec*() 族函数执行外部程序"),
    (r"\bdlopen\s*\(|\bdlsym\s*\(", "禁止调用 dlopen() 动态加载外部库"),
    (r"\bsyscall\s*\(", "禁止直接调用底层 Linux/macOS syscall()"),
    (r"#\s*include\s*[<\"](unistd|sys/socket|netinet/in|arpa/inet|sys/wait|dlfcn|pwd|grp|dirent|fcntl)\.h[>\"]", "禁止包含宿主机系统网络/进程/目录遍历头文件"),
    (r"\bfopen\s*\(|\bfreopen\s*\(|\bremove\s*\(|\bunlink\s*\(|\brename\s*\(", "沙箱仿真禁止调用 fopen/unlink 等宿主机文件系统读写函数"),
    (r"__asm(?:__)?\s*(?:volatile)?\s*\([^)]*(?:syscall|int\s+\$0x80|svc\s+#?0)", "沙箱仿真禁止内联汇编系统调用指令注入"),
]


def audit_c_source_security(c_code: str, filename: str = "source.c") -> Dict[str, Any]:
    """
    对用户提交或工程内的 C99 源码进行 AST/正则级安全扫描，拦截任何试图访问宿主机文件系统、网络或 Shell 的恶意代码。
    """
    if not c_code:
        return {"safe": True, "violations": []}

    # 剥离单行与多行注释后再做关键扫描（同时也在原文扫描 #include）
    stripped = re.sub(r"/\*.*?\*/", " ", c_code, flags=re.DOTALL)
    stripped = re.sub(r"//.*?$", " ", stripped, flags=re.MULTILINE)

    violations: List[Dict[str, Any]] = []
    for pattern, reason in DANGEROUS_C_PATTERNS:
        for match in re.finditer(pattern, stripped):
            snippet = match.group(0).strip()
            line_no = stripped[:match.start()].count("\n") + 1
            violations.append({
                "file": filename,
                "line": line_no,
                "token": snippet,
                "reason": reason
            })

    return {
        "safe": len(violations) == 0,
        "violations": violations,
        "error": (
            f"🛡️ [C99 宿主机安全沙箱拦截] 检测到 {len(violations)} 处高危系统调用 "
            f"({', '.join(v['token'] for v in violations[:3])})，已阻断编译执行以保护云端主机安全。"
            if violations else ""
        )
    }


def audit_project_firmware_security(project_dir: str) -> Dict[str, Any]:
    """扫描指定工程 firmware/ 目录下全部 .c / .h 源文件的云端沙箱安全性"""
    if not project_dir or not os.path.exists(project_dir):
        return {"safe": True, "violations": []}

    fw_dir = os.path.join(project_dir, "firmware")
    if not os.path.exists(fw_dir):
        return {"safe": True, "violations": []}

    all_violations: List[Dict[str, Any]] = []
    for root, _, files in os.walk(fw_dir):
        if ".sim_build" in root or "build" in root:
            continue
        for fn in files:
            if fn.endswith((".c", ".h")):
                fp = os.path.join(root, fn)
                try:
                    with open(fp, "r", encoding="utf8", errors="ignore") as f:
                        code = f.read()
                    res = audit_c_source_security(code, filename=fn)
                    if not res["safe"]:
                        all_violations.extend(res["violations"])
                except Exception:
                    pass

    return {
        "safe": len(all_violations) == 0,
        "violations": all_violations
    }


def load_licenses_db() -> Dict[str, Any]:
    if os.path.exists(LICENSES_PATH):
        try:
            with open(LICENSES_PATH, "r", encoding="utf8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"cloud_settings": {}, "licenses": {}}


load_licenses_config = load_licenses_db


def get_tenant_workspace_root(tenant_id: str, is_cloud_mode: bool = True) -> str:
    return _ensure_tenant_workspace_initialized(tenant_id if is_cloud_mode else "default")


def _ensure_tenant_workspace_initialized(tenant_id: str) -> str:
    """
    确保租户专属工作空间目录存在；若为首次访问的新租户，自动初始化一套轻量示例工程，确保开箱即用。
    """
    base_ws = os.path.join(PLATFORM_ROOT, "workspaces")
    if not tenant_id or tenant_id == "default":
        os.makedirs(base_ws, exist_ok=True)
        return base_ws

    safe_tid = re.sub(r"[^A-Za-z0-9_\-]", "_", tenant_id)
    tenant_ws = os.path.join(base_ws, "tenants", safe_tid)
    os.makedirs(tenant_ws, exist_ok=True)

    # 检查租户目录下是否已有工程（含 spec.json 的子目录）
    existing = [
        d for d in os.listdir(tenant_ws)
        if os.path.isdir(os.path.join(tenant_ws, d)) and os.path.exists(os.path.join(tenant_ws, d, "spec.json"))
    ]
    if not existing:
        seed_src = os.path.join(base_ws, "smart-env-alarm-01")
        seed_dst = os.path.join(tenant_ws, "smart-env-alarm-01")
        if os.path.exists(seed_src) and not os.path.exists(seed_dst):
            try:
                shutil.copytree(seed_src, seed_dst)
            except Exception:
                pass
    return tenant_ws


def resolve_request_tenant(
    request: Any = None,
    explicit_license: str = "",
    require_auth_if_cloud: bool = False
) -> Dict[str, Any]:
    """
    解析当前 HTTP 请求的云端模式与租户身份上下文：
    - 本地开发模式（未开启 XTER_CLOUD_MODE 且未传云端 Header）：默认使用 default 管理员工作空间，100% 兼容本地开发。
    - 云端模式（开启 XTER_CLOUD_MODE=1 或携带 X-Cloud-Mode: 1 / Authorization: Bearer <LicenseKey>）：
      严格校验 License Key，映射独立租户目录 workspaces/tenants/<tenant_id>/，并启用 Skill 防爬脱敏。
    """
    db = load_licenses_db()
    licenses_map = db.get("licenses", {})

    env_cloud = os.environ.get("XTER_CLOUD_MODE", "0") == "1"
    hdr_cloud = False
    license_key = explicit_license.strip()

    if request is not None:
        headers = getattr(request, "headers", {}) or {}
        qparams = getattr(request, "query_params", {}) or {}
        hdr_cloud = str(headers.get("x-cloud-mode", "")).strip() == "1"
        if not license_key:
            auth_hdr = str(headers.get("authorization", "")).strip()
            if auth_hdr.lower().startswith("bearer "):
                license_key = auth_hdr[7:].strip()
            else:
                license_key = (
                    str(headers.get("x-license-key", "")).strip()
                    or str(qparams.get("license_key", "")).strip()
                )

    is_cloud_mode = env_cloud or hdr_cloud or bool(license_key)

    # 本地开发模式（无 License Header 且未强制开启云模式）
    if not is_cloud_mode:
        ws_root = _ensure_tenant_workspace_initialized("default")
        return {
            "authenticated": True,
            "is_cloud_mode": False,
            "license_key": "LOCAL-DEV-MODE",
            "tenant_id": "default",
            "owner": "本地研发工作台 (Local Dev)",
            "customer_name": "本地研发工作台 (Local Dev)",
            "tier": "enterprise_admin",
            "max_projects": 999,
            "can_view_full_skills": True,
            "can_configure_engine": True,
            "workspace_root": ws_root
        }

    # 云端模式：必须校验 License Key
    if not license_key:
        if require_auth_if_cloud:
            raise HTTPException(
                status_code=401,
                detail="云端分离模式要求提供有效的商业授权码 (Authorization: Bearer <LicenseKey>)。"
            )
        return {
            "authenticated": False,
            "is_cloud_mode": True,
            "error": "未提供商业授权码 (License Key)",
            "license_key": "",
            "tenant_id": "unauthorized"
        }

    if license_key not in licenses_map:
        if require_auth_if_cloud:
            raise HTTPException(
                status_code=403,
                detail=f"无效的商业授权码 ({license_key})，访问被云端安全网关拒绝。"
            )
        return {
            "authenticated": False,
            "is_cloud_mode": True,
            "error": "未提供有效的商业授权码 (License Key) 或授权已过期。",
            "license_key": license_key,
            "tenant_id": "unauthorized"
        }

    lic_info = licenses_map[license_key]
    if not lic_info.get("active", True):
        if require_auth_if_cloud:
            raise HTTPException(
                status_code=403,
                detail=f"授权码 {license_key} 已停用或过期。"
            )
        return {
            "authenticated": False,
            "is_cloud_mode": True,
            "error": f"授权码 {license_key} 已被停用，请联系管理员续期。",
            "license_key": license_key,
            "tenant_id": "unauthorized"
        }

    tenant_id = lic_info.get("tenant_id", "tenant_demo")
    ws_root = _ensure_tenant_workspace_initialized(tenant_id)
    owner_name = lic_info.get("owner") or lic_info.get("customer_name") or tenant_id
    tier_val = lic_info.get("tier", "pro")
    return {
        "authenticated": True,
        "is_cloud_mode": True,
        "license_key": license_key,
        "tenant_id": tenant_id,
        "owner": owner_name,
        "customer_name": owner_name,
        "tier": tier_val,
        "features": lic_info.get("features", []),
        "max_projects": lic_info.get("max_projects", 20),
        "can_view_full_skills": bool(lic_info.get("can_view_full_skills", False)) or tier_val == "enterprise_admin",
        "can_configure_engine": bool(lic_info.get("can_configure_engine", False)) or tier_val == "enterprise_admin",
        "expires_at": lic_info.get("expires_at", "2028-12-31"),
        "workspace_root": ws_root
    }


def _read_json_safe(fp: str, default: Any):
    if os.path.exists(fp):
        try:
            with open(fp, "r", encoding="utf8") as f:
                return json.load(f)
        except Exception:
            pass
    return default


def list_tenant_projects(tenant_ctx: Dict[str, Any]) -> Dict[str, Any]:
    """列出当前租户隔离工作空间下的工程列表，绝不泄露其他租户的工程"""
    ws_root = tenant_ctx.get("workspace_root") or os.path.join(PLATFORM_ROOT, "workspaces")
    projects = []
    for name in sorted(os.listdir(ws_root)):
        sub = os.path.join(ws_root, name)
        if not os.path.isdir(sub) or name == "tenants" or name.startswith("."):
            continue
        spec_file = os.path.join(sub, "spec.json")
        if os.path.exists(spec_file):
            spec = _read_json_safe(spec_file, {})
            pinout = _read_json_safe(os.path.join(sub, "pinout.json"), [])
            projects.append({
                "project_name": spec.get("project_name") or name,
                "folder_name": name,
                "project_dir": sub,
                "summary": spec.get("project_summary", ""),
                "mcu": (spec.get("mcu") or {}).get("model", "STM32"),
                "pin_count": len(pinout) if isinstance(pinout, list) else 0,
                "tenant_id": tenant_ctx.get("tenant_id", "default")
            })
    active_dir = projects[0]["project_dir"] if projects else ""
    return {
        "active_project_dir": active_dir,
        "projects": projects,
        "tenant_id": tenant_ctx.get("tenant_id", "default"),
        "customer_name": tenant_ctx.get("customer_name", "")
    }


def validate_tenant_project_path(path_str: str, tenant_ctx: Dict[str, Any]) -> str:
    """
    校验并修正租户传入的 project_dir / file_path：
    若处于多租户隔离模式（tenant_id != 'default'），确保路径严格位于该租户的 workspace_root 内，防止路径穿越读取其他客户或服务器源码。
    """
    ws_root = os.path.abspath(tenant_ctx.get("workspace_root") or os.path.join(PLATFORM_ROOT, "workspaces"))
    if tenant_ctx.get("tenant_id", "default") == "default" and not tenant_ctx.get("is_cloud_mode"):
        return path_str

    if not path_str:
        projs = list_tenant_projects(tenant_ctx).get("projects", [])
        return projs[0]["project_dir"] if projs else os.path.join(ws_root, "smart-env-alarm-01")

    abs_target = os.path.abspath(path_str)
    if abs_target.startswith(ws_root + os.sep) or abs_target == ws_root:
        return abs_target

    # 若试图访问其他租户的 /tenants/<other_tenant>/ 目录，立即阻断并返回 HTTP 403
    if (os.sep + "tenants" + os.sep) in abs_target:
        raise HTTPException(
            status_code=403,
            detail=f"多租户安全隔离拦截：禁止越权访问其他租户的私有工程路径 ({path_str})"
        )

    # 若客户端传了默认 workspaces/smart-env-alarm-01，自动重定向到该租户自己的 smart-env-alarm-01
    base_name = os.path.basename(abs_target.rstrip(os.sep))
    redirected = os.path.join(ws_root, base_name)
    if os.path.exists(redirected):
        return redirected

    raise HTTPException(
        status_code=403,
        detail=f"多租户安全隔离拦截：禁止越权访问非本租户工作空间路径 ({path_str})"
    )


def _extract_markdown_outline(md_text: str, doc_label: str) -> str:
    """从完整的 Skill Markdown 中仅提取章节标题大纲与前 260 字简介，用于云端防爬脱敏展示"""
    if not md_text:
        return ""
    lines = md_text.splitlines()
    headings = [ln.strip() for ln in lines if ln.strip().startswith("#")]
    toc_str = "\n".join(f"  {h}" for h in headings[:24])
    intro = "\n".join(ln for ln in lines[:10] if not ln.strip().startswith("---")).strip()[:260]
    return (
        f"# 🔒 {doc_label}（云端商业知识产权保护模式）\n\n"
        f"> **[XterAI Cloud IP Guard]**：该工业级硬件知识库全文（共 `{len(md_text)}` 字符）已加密存储于私有云服务器黑盒中。\n"
        f"> 当您使用 **AI 需求蒸馏、PCB 自动布局、DRC 冲突自愈、C99 固件生成与全局 Copilot** 时，云端引擎已在服务器内存内 100% 自动挂载全文规则；客户端 API 仅展示以下章节结构大纲以防止外部爬虫窃取核心资产。\n\n"
        f"## 📄 内容摘要\n{intro}...\n\n"
        f"## 📑 云端已挂载章节大纲 (共 {len(headings)} 节)\n```markdown\n{toc_str}\n```\n"
    )


def desensitize_skill_detail(skill_data: Dict[str, Any], tenant_ctx: Dict[str, Any]) -> Dict[str, Any]:
    """在云端模式下对 /api/skills/{id} 返回结果执行防爬取脱敏"""
    if not tenant_ctx.get("is_cloud_mode") or tenant_ctx.get("can_view_full_skills"):
        return {**skill_data, "cloud_protected": False}

    raw_skill = skill_data.get("skill_md", "")
    raw_cheat = skill_data.get("cheatsheet_md", "")
    raw_pat = skill_data.get("patterns_md", "")
    return {
        **skill_data,
        "cloud_protected": True,
        "raw_stats": {
            "skill_md_chars": len(raw_skill),
            "cheatsheet_md_chars": len(raw_cheat),
            "patterns_md_chars": len(raw_pat)
        },
        "skill_md": _extract_markdown_outline(raw_skill, f"{skill_data.get('title', skill_data.get('name'))} · 技能主说明书"),
        "cheatsheet_md": _extract_markdown_outline(raw_cheat, "量化工艺参数速查卡 (cheatsheet.md)"),
        "patterns_md": _extract_markdown_outline(raw_pat, "经典硬件电路与 C99 固件范式 (patterns.md)")
    }


def mask_cloud_settings(config_resp: Dict[str, Any], tenant_ctx: Dict[str, Any]) -> Dict[str, Any]:
    """在云端模式下向普通租户隐藏内网 vLLM 服务器 IP (如 100.113.144.63:8012) 与密钥"""
    if not tenant_ctx.get("is_cloud_mode") or tenant_ctx.get("can_configure_engine"):
        return config_resp

    raw_json = json.dumps(config_resp, ensure_ascii=False)
    raw_json = raw_json.replace("http://100.113.144.63:8012/v1", "https://cloud-vllm-cluster.internal/v1 (Cloud Protected)")
    raw_json = raw_json.replace("100.113.144.63", "cloud-vllm-cluster.internal")
    masked = json.loads(raw_json)
    for key in ("active_llm", "skill_llm"):
        if isinstance(masked.get(key), dict):
            masked[key]["base_url"] = "https://cloud-vllm-cluster.internal/v1 (Cloud Protected)"
            masked[key]["api_key"] = "sk-cloud-managed-****"
    llm_block = masked.get("llm") or (masked.get("settings") or {}).get("llm") or {}
    providers = llm_block.get("providers", {})
    for p_cfg in providers.values():
        if isinstance(p_cfg, dict):
            if "base_url" in p_cfg:
                p_cfg["base_url"] = "https://cloud-vllm-cluster.internal/v1 (Cloud Protected)"
            if "api_key" in p_cfg and p_cfg["api_key"]:
                p_cfg["api_key"] = "sk-cloud-managed-****"
    masked["cloud_tenant"] = {
        "tenant_id": tenant_ctx.get("tenant_id"),
        "customer_name": tenant_ctx.get("customer_name"),
        "tier": tenant_ctx.get("tier")
    }
    return masked
