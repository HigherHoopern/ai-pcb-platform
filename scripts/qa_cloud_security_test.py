#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""商业化云端分离架构 & 跨平台客户端打包 (Phase 1 ~ Phase 4) 全栈安全与多租户验收测试套件"""

import os
import sys
import json
import shutil
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8989"
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def http_req(path: str, method: str = "GET", payload: dict = None, headers: dict = None):
    url = BASE_URL + path
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    data_bytes = None
    if payload is not None:
        data_bytes = json.dumps(payload).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data_bytes, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def run_all_tests():
    passed = 0
    failed = 0

    def check(name: str, cond: bool, detail: str = ""):
        nonlocal passed, failed
        if cond:
            passed += 1
            print(f"  ✅ [PASS] {name} {f'({detail})' if detail else ''}")
        else:
            failed += 1
            print(f"  ❌ [FAIL] {name} {f'({detail})' if detail else ''}")

    print("=" * 76)
    print("🛡️  Xter AI-PCB 商业化云端分离架构 & 客户端打包 (Phase 1~4) 安全验收测试")
    print("=" * 76)

    # -------------------------------------------------------------------------
    # 1. Phase 1: License 鉴权与未授权拦截测试
    # -------------------------------------------------------------------------
    print("\n[Phase 1.1] 云端多租户 License Key 鉴权与未授权访问拦截")
    st_no_key, _ = http_req("/api/projects", headers={"X-Cloud-Mode": "1"})
    check("云端模式无 License Key 访问 /api/projects 自动拦截 (HTTP 401)", st_no_key == 401, f"status={st_no_key}")

    st_bad_key, _ = http_req(
        "/api/projects",
        headers={"X-Cloud-Mode": "1", "Authorization": "Bearer XTER-INVALID-9999"}
    )
    check("云端模式伪造 License Key 访问自动拦截 (HTTP 403)", st_bad_key == 403, f"status={st_bad_key}")

    st_ver, res_ver = http_req(
        "/api/cloud/verify_license",
        method="POST",
        payload={"license_key": "XTER-PRO-2026-CLIENT01"}
    )
    check(
        "合法商业授权码 XTER-PRO-2026-CLIENT01 在线验权通过",
        st_ver == 200 and res_ver.get("valid") is True and res_ver.get("tenant_id") == "tenant_client01",
        f"tenant={res_ver.get('tenant_id')}, tier={res_ver.get('tier')}"
    )

    # -------------------------------------------------------------------------
    # 2. Phase 1: 多租户独立工作空间物理隔离测试 (Client 01 vs Client 02)
    # -------------------------------------------------------------------------
    print("\n[Phase 1.2] 多租户独立工作空间物理隔离 (Tenant Isolation)")
    h_client1 = {"X-Cloud-Mode": "1", "Authorization": "Bearer XTER-PRO-2026-CLIENT01"}
    h_client2 = {"X-Cloud-Mode": "1", "Authorization": "Bearer XTER-PRO-2026-CLIENT02"}

    st_c1_create, res_c1_create = http_req(
        "/api/projects/create",
        method="POST",
        payload={"project_name": "client01-confidential-pcb", "auto_scaffold": False},
        headers=h_client1
    )
    c1_proj_dir = res_c1_create.get("project_dir", "") if isinstance(res_c1_create, dict) else ""
    check(
        "租户 Client 01 创建私有硬件工程落在独立沙箱目录",
        st_c1_create == 200 and "tenants/tenant_client01" in c1_proj_dir,
        f"dir={c1_proj_dir}"
    )

    st_c2_list, res_c2_list = http_req("/api/projects", headers=h_client2)
    c2_projs = res_c2_list.get("projects", []) if isinstance(res_c2_list, dict) else (res_c2_list if isinstance(res_c2_list, list) else [])
    c2_dirs = [p.get("project_dir", "") for p in c2_projs]
    check(
        "租户 Client 02 工程列表完全看不见 Client 01 的私有工程",
        st_c2_list == 200 and c1_proj_dir not in c2_dirs and len(c2_dirs) >= 1,
        f"client02_projects_count={len(c2_dirs)}"
    )

    st_cross_read, _ = http_req(
        f"/api/projects/detail?project_dir={urllib.parse.quote(c1_proj_dir)}",
        headers=h_client2
    )
    check(
        "租户 Client 02 越权读取 Client 01 工程路径被强制阻断 (HTTP 403)",
        st_cross_read == 403,
        f"status={st_cross_read}"
    )

    # 清理测试创建的租户临时项目
    if c1_proj_dir and os.path.exists(c1_proj_dir) and "tenants/tenant_client01" in c1_proj_dir:
        shutil.rmtree(c1_proj_dir, ignore_errors=True)

    # -------------------------------------------------------------------------
    # 3. Phase 1: 324 页嘉立创蒸馏知识库 (pcb-design-skill) 防扒取脱敏保护
    # -------------------------------------------------------------------------
    print("\n[Phase 1.3] 324页《嘉立创PCB智造实战指南》Skill 核心知识库防爬脱敏与内网算力 IP 隐藏")
    st_sk_cloud, res_sk_cloud = http_req("/api/skills/pcb-design-skill", headers=h_client1)
    cloud_total_len = sum(
        len(res_sk_cloud.get(k, "")) for k in ("skill_md", "cheatsheet_md", "patterns_md")
    ) if isinstance(res_sk_cloud, dict) else 0
    check(
        "云端租户请求 /api/skills/pcb-design-skill 自动执行章节摘要脱敏保护",
        st_sk_cloud == 200
        and res_sk_cloud.get("cloud_protected") is True
        and 300 < cloud_total_len < 4500,
        f"cloud_protected=True, desensitized_total_len={cloud_total_len} chars"
    )

    st_sk_local, res_sk_local = http_req("/api/skills/pcb-design-skill")
    local_total_len = sum(
        len(res_sk_local.get(k, "")) for k in ("skill_md", "cheatsheet_md", "patterns_md")
    ) if isinstance(res_sk_local, dict) else 0
    check(
        "本地开发模式 / 企业管理员保留完整 324 页蒸馏知识库全文",
        st_sk_local == 200 and local_total_len > 14000,
        f"full_skill_total_len={local_total_len} chars"
    )

    st_cfg_cloud, res_cfg_cloud = http_req("/api/config", headers=h_client1)
    cfg_dump = json.dumps(res_cfg_cloud, ensure_ascii=False)
    check(
        "云端租户请求 /api/config 完全隐藏内网算力 IP (100.113.144.63)",
        st_cfg_cloud == 200 and "100.113.144.63" not in cfg_dump and "cloud-vllm-cluster.internal" in cfg_dump,
        "100.113.144.63 -> masked"
    )

    st_cfg_save, _ = http_req(
        "/api/config/save",
        method="POST",
        payload={"llm": {}},
        headers=h_client1
    )
    check(
        "普通云端客户禁止篡改云端全局 LLM 路由配置 (HTTP 403)",
        st_cfg_save == 403,
        f"status={st_cfg_save}"
    )

    # -------------------------------------------------------------------------
    # 4. Phase 1: C99 宿主机在线仿真沙箱恶意系统调用拦截
    # -------------------------------------------------------------------------
    print("\n[Phase 1.4] C99 宿主机状态机仿真沙箱安全审计 (阻止恶意系统命令与文件越权读取)")
    malicious_c = """
    #include <stdlib.h>
    #include <sys/socket.h>
    void hack_host(void) {
        system("cat ../core/tenant_auth.py");
        FILE *fp = fopen("/etc/passwd", "r");
    }
    """
    st_sim_hack, res_sim_hack = http_req(
        "/api/firmware/simulate",
        method="POST",
        payload={"custom_c_code": malicious_c, "ticks": 6}
    )
    check(
        "C99 仿真接口精准拦截包含 system() / fopen() / <sys/socket.h> 的恶意 C 代码",
        st_sim_hack == 200
        and res_sim_hack.get("success") is False
        and res_sim_hack.get("security_blocked") is True
        and len(res_sim_hack.get("violations", [])) >= 3,
        f"blocked_violations={len(res_sim_hack.get('violations', []))}"
    )

    # -------------------------------------------------------------------------
    # 5. Phase 2 / Phase 3 / Phase 4: 前端桥接、纯前端发行包与桌面客户端工程验证
    # -------------------------------------------------------------------------
    print("\n[Phase 2/3/4] 动态云端网关桥接、dist-client 零后端审计与 Tauri 跨平台打包验证")
    st_bridge_js, raw_bridge_js = http_req("/static/cloud_bridge.js")
    check(
        "前端动态云端网关与双模桥接脚本 (/static/cloud_bridge.js) 正常加载",
        st_bridge_js == 200 and "openCloudLicenseModal" in str(raw_bridge_js) and "sync_and_open_local_tool" in str(raw_bridge_js),
        f"len={len(str(raw_bridge_js))} bytes"
    )

    audit_file = os.path.join(ROOT_DIR, "dist-client", "CLIENT_BUILD_AUDIT.json")
    audit_data = json.load(open(audit_file, encoding="utf8")) if os.path.exists(audit_file) else {}
    sec_audit = audit_data.get("security_audit", {})
    check(
        "Phase 3 纯前端发行包 (dist-client/) 通过零 Python 源码与零 Skill 原文泄露审计",
        sec_audit.get("passed") is True
        and sec_audit.get("python_backend_files_count") == 0
        and sec_audit.get("distilled_skill_markdown_files_count") == 0
        and sec_audit.get("internal_vllm_ip_leaks_count") == 0,
        f"files={audit_data.get('files_count')}, py=0, skills=0, ip_leaks=0"
    )

    tauri_conf = os.path.join(ROOT_DIR, "desktop-client", "src-tauri", "tauri.conf.json")
    tauri_rs = os.path.join(ROOT_DIR, "desktop-client", "src-tauri", "src", "main.rs")
    gh_wf = os.path.join(ROOT_DIR, ".github", "workflows", "build-desktop-installers.yml")
    docker_cloud = os.path.join(ROOT_DIR, "Dockerfile.cloud")
    check(
        "Phase 4 跨平台桌面客户端 (macOS .dmg / Windows .exe) Tauri 工程与云端 Docker 部署套件完备",
        all(os.path.exists(p) for p in (tauri_conf, tauri_rs, gh_wf, docker_cloud)),
        "tauri.conf.json + main.rs + GitHub Actions + Dockerfile.cloud Ready"
    )

    print("\n" + "=" * 76)
    print(f"📊 商业化云端分离架构验收汇总: {passed}/{passed + failed} 项通过 (失败 {failed} 项)")
    print("=" * 76)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
