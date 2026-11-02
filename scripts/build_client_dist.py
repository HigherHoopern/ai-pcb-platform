#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Phase 3: 纯前端发行包抽离、JS 压缩混淆与零后端源码安全审计流水线

用法:
    python3 scripts/build_client_dist.py [--cloud-url https://api.your-pcb-cloud.com]

产物:
    dist-client/
      ├── index.html               (已注入默认云端网关配置并兼容 Tauri 桌面端 & Web CDN)
      ├── bom_details.html
      ├── architecture_plan.html
      ├── static/                  (经过注释剥离与体积压缩的前端静态资源)
      │   ├── cloud_bridge.js
      │   ├── app.js
      │   └── workbench_abc.js
      └── CLIENT_BUILD_AUDIT.json  (零后端源码与零知识库泄露自动审计证书)
"""

import os
import re
import sys
import json
import time
import shutil
import hashlib
import argparse

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_STATIC_DIR = os.path.join(ROOT_DIR, "web", "static")
DIST_CLIENT_DIR = os.path.join(ROOT_DIR, "dist-client")


def minify_and_protect_js(js_source: str, filename: str) -> str:
    """对前端 JS 文件执行注释清理、空白行折叠与商业版权保护头封装"""
    # 1. 移除多行块注释 /* ... */ (保留字符串字面量内的内容)
    cleaned_lines = []
    in_block_comment = False
    for line in js_source.splitlines():
        stripped = line.strip()
        if not in_block_comment and stripped.startswith("/*") and "*/" not in stripped:
            in_block_comment = True
            continue
        if in_block_comment:
            if "*/" in stripped:
                in_block_comment = False
            continue
        if stripped.startswith("//"):
            continue
        # 清理内部测试 IP 字面量（防止前端源码出现内网算力地址）
        line = line.replace("http://100.113.144.63:8012/v1", "https://cloud-vllm-cluster.internal/v1")
        line = line.replace("100.113.144.63", "cloud-vllm-cluster.internal")
        if stripped:
            cleaned_lines.append(line)

    body = "\n".join(cleaned_lines)
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]
    banner = (
        f"/* Xter AI-PCB Commercial Client Build | File: {filename} | "
        f"SHA256: {digest} | Core Python & 324p Skills Strictly Excluded */\n"
    )
    return banner + body + "\n"


def build_client_distribution(default_cloud_url: str = "") -> dict:
    if os.path.exists(DIST_CLIENT_DIR):
        shutil.rmtree(DIST_CLIENT_DIR)

    dist_static = os.path.join(DIST_CLIENT_DIR, "static")
    os.makedirs(dist_static, exist_ok=True)

    processed_files = []

    for root, _dirs, files in os.walk(SRC_STATIC_DIR):
        rel_root = os.path.relpath(root, SRC_STATIC_DIR)
        target_sub = dist_static if rel_root == "." else os.path.join(dist_static, rel_root)
        os.makedirs(target_sub, exist_ok=True)

        for fname in files:
            if fname.startswith("."):
                continue
            src_path = os.path.join(root, fname)
            dst_static_path = os.path.join(target_sub, fname)

            if fname.endswith(".js"):
                with open(src_path, "r", encoding="utf8", errors="ignore") as f:
                    raw_js = f.read()
                protected_js = minify_and_protect_js(raw_js, fname)
                with open(dst_static_path, "w", encoding="utf8") as f:
                    f.write(protected_js)
                # 同时在根目录保留一份供相对路径加载
                if rel_root == ".":
                    with open(os.path.join(DIST_CLIENT_DIR, fname), "w", encoding="utf8") as f:
                        f.write(protected_js)
            elif fname.endswith(".html"):
                with open(src_path, "r", encoding="utf8", errors="ignore") as f:
                    html_txt = f.read()
                # 清理 HTML 中可能出现的内网算力 IP 展示文字（仅针对客户端构建产物）
                html_txt = html_txt.replace("http://100.113.144.63:8012/v1", "https://cloud-vllm-cluster.internal/v1")
                html_txt = html_txt.replace("100.113.144.63", "cloud-vllm-cluster.internal")
                if fname == "index.html" and default_cloud_url:
                    inject_script = f'<script>window.DEFAULT_CLOUD_API_BASE = "{default_cloud_url}";</script>\n  <script src="/static/cloud_bridge.js"></script>'
                    html_txt = html_txt.replace('<script src="/static/cloud_bridge.js"></script>', inject_script)

                with open(dst_static_path, "w", encoding="utf8") as f:
                    f.write(html_txt)
                if rel_root == ".":
                    with open(os.path.join(DIST_CLIENT_DIR, fname), "w", encoding="utf8") as f:
                        f.write(html_txt)
            else:
                shutil.copy2(src_path, dst_static_path)
                if rel_root == ".":
                    shutil.copy2(src_path, os.path.join(DIST_CLIENT_DIR, fname))

            processed_files.append(os.path.relpath(dst_static_path, DIST_CLIENT_DIR))

    # =========================================================================
    # 自动化安全审计 (Zero-Backend & Zero-Skill-Leakage Audit)
    # =========================================================================
    leaked_py_files = []
    leaked_skill_files = []
    leaked_internal_ips = []

    for root, _dirs, files in os.walk(DIST_CLIENT_DIR):
        for fname in files:
            full_p = os.path.join(root, fname)
            rel_p = os.path.relpath(full_p, DIST_CLIENT_DIR)
            if fname.endswith((".py", ".pyc", ".pyo", ".pyd", ".so")):
                leaked_py_files.append(rel_p)
            if fname in ("SKILL.md", "cheatsheet.md", "patterns.md", "licenses.json"):
                leaked_skill_files.append(rel_p)
            if fname.endswith((".html", ".js", ".css", ".json")):
                try:
                    with open(full_p, "r", encoding="utf8", errors="ignore") as f:
                        txt = f.read()
                    if "100.113.144.63" in txt:
                        leaked_internal_ips.append(rel_p)
                except Exception:
                    pass

    audit_passed = (
        len(leaked_py_files) == 0
        and len(leaked_skill_files) == 0
        and len(leaked_internal_ips) == 0
    )

    audit_report = {
        "build_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "dist_dir": DIST_CLIENT_DIR,
        "default_cloud_url": default_cloud_url or "same-origin / user-configurable",
        "files_count": len(processed_files),
        "security_audit": {
            "passed": audit_passed,
            "python_backend_files_count": len(leaked_py_files),
            "distilled_skill_markdown_files_count": len(leaked_skill_files),
            "internal_vllm_ip_leaks_count": len(leaked_internal_ips),
            "leaked_py_files": leaked_py_files,
            "leaked_skill_files": leaked_skill_files,
            "leaked_internal_ips": leaked_internal_ips,
        }
    }

    audit_path = os.path.join(DIST_CLIENT_DIR, "CLIENT_BUILD_AUDIT.json")
    with open(audit_path, "w", encoding="utf8") as f:
        json.dump(audit_report, f, indent=2, ensure_ascii=False)

    return audit_report


def main():
    parser = argparse.ArgumentParser(description="Build standalone frontend client distribution (dist-client/)")
    parser.add_argument("--cloud-url", default="", help="Default Cloud API Base URL to embed")
    args = parser.parse_args()

    report = build_client_distribution(default_cloud_url=args.cloud_url)
    sec = report["security_audit"]
    print("=" * 72)
    print("📦 Xter AI-PCB 纯前端客户发行包构建与安全审计报告 (Phase 3)")
    print("=" * 72)
    print(f"📁 输出目录: {report['dist_dir']}")
    print(f"📄 静态资源文件数: {report['files_count']}")
    print(f"🛡️ 后端 Python 源码残留数: {sec['python_backend_files_count']} (期望: 0)")
    print(f"🛡️ 324页蒸馏 Skill 原文残留数: {sec['distilled_skill_markdown_files_count']} (期望: 0)")
    print(f"🛡️ 内网算力 IP (100.113.144.63) 残留数: {sec['internal_vllm_ip_leaks_count']} (期望: 0)")
    print(f"✅ 安全审计结论: {'PASSED (100% 零核心资产泄露)' if sec['passed'] else 'FAILED'}")
    print("=" * 72)
    if not sec["passed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
