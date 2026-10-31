#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 知识库蒸馏引擎 (Knowledge-to-Skill Distiller v2.5)

核心能力：
  将用户上传的硬件设计指南、厂商工艺手册、元器件 Datasheet（PDF 全书带书签目录、Word .docx/.doc、Excel、Markdown）
  通过 doc_parser 与配置的 LLM (skill_distill 路由，默认本地 vLLM Qwen3.8-27B) 全书跨章节深度蒸馏，
  构建符合 Agent 技能规范的工业级 Skill 知识库：
    - SKILL.md (主控规范、全书章节路由索引、核心触发器与蒸馏元数据)
    - cheatsheet.md (全书核心工艺参数、线宽线距/过孔/叠层阻抗/钢网/SMT 公差速查表)
    - patterns.md (全流程推荐硬件/DFM 设计模式与典型制造反模式)
    - chapters/*.md (按真实章节切分的 AI 核心提要 + 完整章节原文分册)
"""

import sys
import os
import re
import json
import time
import shutil
import argparse
from typing import List, Tuple, Dict, Any

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLATFORM_ROOT not in sys.path:
    sys.path.insert(0, PLATFORM_ROOT)

from core.doc_parser import parse_document
from core.llm_client import call_llm
from core.config_manager import resolve_llm_config


def parse_source_document(file_path: str) -> Dict[str, Any]:
    try:
        return parse_document(file_path)
    except Exception as e:
        print(f"[Warn] doc_parser 解析异常，回退纯文本读取: {e}", flush=True)
        try:
            with open(file_path, "r", encoding="utf8", errors="ignore") as f:
                txt = f.read()
            return {
                "file_type": "text",
                "filename": os.path.basename(file_path),
                "total_pages": 1,
                "toc_chapters": [],
                "full_text": txt,
                "tables": []
            }
        except Exception:
            return {"file_type": "unknown", "filename": os.path.basename(file_path), "full_text": ""}


def segment_into_chapters(raw_text: str, doc_meta: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """优先使用 PDF 原生书签目录切分真实章节；若无书签则使用抗噪正则切分章节"""
    if doc_meta and doc_meta.get("toc_chapters"):
        toc_chaps = doc_meta["toc_chapters"]
        if len(toc_chaps) >= 2:
            return toc_chaps

    lines = raw_text.splitlines()
    chapters: List[Dict[str, Any]] = []
    curr_title = "概述与通用指导"
    curr_lines: List[str] = []

    # 严格匹配真实章标题，避免误匹配表格小数 (如 4.5 ~ 4.7)、目录省略号行或课后习题序号
    pattern = re.compile(
        r'^(第\s*[0-9一二三四五六七八九十百]+\s*[章篇部][^\n。；，]*|Chapter\s+\d+[^\n]*|#{1,3}\s+\S+|[一二三四五六七八九十]+、\s*\S+)',
        re.IGNORECASE
    )

    for line in lines:
        s = line.strip()
        if not s:
            continue
        # 排除目录页带大量省略号/点号的行
        if "……" in s or "..." in s or "…" in s:
            curr_lines.append(s)
            continue
        if len(s) <= 48 and pattern.match(s):
            if curr_lines and sum(len(x) for x in curr_lines) > 300:
                chapters.append({
                    "title": curr_title.lstrip("# ").strip(),
                    "raw_title": curr_title.lstrip("# ").strip(),
                    "start_page": 0,
                    "end_page": 0,
                    "sub_sections": [],
                    "content": "\n".join(curr_lines)
                })
                curr_lines = []
            curr_title = s.lstrip("# ").strip()
        else:
            curr_lines.append(s)

    if curr_lines:
        chapters.append({
            "title": curr_title,
            "raw_title": curr_title,
            "start_page": 0,
            "end_page": 0,
            "sub_sections": [],
            "content": "\n".join(curr_lines)
        })

    if len(chapters) == 1 and len(chapters[0]["content"]) > 8000:
        chunks = []
        words = raw_text.split("\n")
        chunk_size = max(80, len(words) // 8)
        for i in range(0, len(words), chunk_size):
            idx = i // chunk_size + 1
            chunks.append({
                "title": f"专题分册_{idx}",
                "raw_title": f"专题分册_{idx}",
                "start_page": 0,
                "end_page": 0,
                "sub_sections": [],
                "content": "\n".join(words[i:i + chunk_size])
            })
        return chunks

    return chapters


def _score_technical_line(line: str) -> int:
    """对单行文本计算工程技术信息密度得分，优先提取含工艺参数、公差、单位、规则的行"""
    s = line.strip()
    if len(s) < 6:
        return 0
    score = 0
    if re.search(r'\d+(\.\d+)?\s*(mm|mil|oz|μm|um|℃|Ω|ohm|kHz|MHz|GHz|V|mA|A|%|dB)\b', s, re.I):
        score += 5
    if any(k in s for k in ("线宽", "线距", "过孔", "焊盘", "阻焊", "丝印", "铜厚", "叠层", "阻抗", "板厚", "拼板", "V-CUT", "邮票孔", "钢网", "锡膏", "回流焊", "波峰焊", "BGA", "QFN", "DRC", "DFM", "Gerber", "BOM", "坐标", "嘉立创", "最小", "公差", "间距", "规则")):
        score += 3
    if any(k in s for k in ("注意", "禁止", "必须", "推荐", "建议", "要求", "不得", "避免", "防止", "标准", "范围", "表 ")):
        score += 2
    return score


def _extract_chapter_high_signal_excerpt(ch: Dict[str, Any], max_chars: int = 1500) -> str:
    """从单个章节中提取高信息密度的参数、表格与工程规则摘要，确保跨全书无死角采样"""
    content = ch.get("content", "")
    lines = [ln.strip() for ln in content.splitlines() if ln.strip() and not ln.strip().startswith("[Page ")]
    if not lines:
        return ""

    # 1. 章节开头导读（前 350 字）
    intro = "\n".join(lines[:12])[:380]

    # 2. 按技术密度筛选关键参数与规则行
    scored = []
    for idx, ln in enumerate(lines[12:], start=12):
        sc = _score_technical_line(ln)
        if sc >= 3:
            scored.append((sc, idx, ln))

    # 取高分段落并保持原文先后顺序
    scored.sort(key=lambda x: (-x[0], x[1]))
    top_selected = sorted(scored[:35], key=lambda x: x[1])

    tech_lines = []
    used_len = len(intro)
    for _, _, ln in top_selected:
        if used_len + len(ln) + 1 > max_chars:
            break
        tech_lines.append(ln)
        used_len += len(ln) + 1

    sub_str = ""
    if ch.get("sub_sections"):
        sub_str = "小节结构: " + " / ".join(ch["sub_sections"][:15]) + "\n"

    return f"### 【{ch['title']}】\n{sub_str}{intro}\n" + "\n".join(tech_lines)


def _build_full_book_digest(chapters: List[Dict[str, Any]], max_total_chars: int = 18000) -> str:
    """跨全书所有章节均匀提取高密度工程规范与工艺参数，供大门径 LLM 全书综合蒸馏"""
    if not chapters:
        return ""
    per_chap_budget = max(900, min(2200, max_total_chars // max(1, len(chapters))))
    parts = []
    for ch in chapters:
        parts.append(_extract_chapter_high_signal_excerpt(ch, max_chars=per_chap_budget))
    return "\n\n".join(parts)[:max_total_chars]


def _distill_with_llm(chapters: List[Dict[str, Any]], raw_text: str, skill_name: str, source_filename: str, total_pages: int = 0):
    """使用配置的 skill_distill 模型（默认 Qwen3.8-27B）执行三阶段全书深度蒸馏"""
    llm_cfg = resolve_llm_config("skill_distill")
    provider_label = f"{llm_cfg.get('provider_name')} · {llm_cfg.get('model_name')}"
    print(f"      正在构建跨章节高密度技术采样索引 (覆盖全书 {total_pages or '?'} 页 / {len(chapters)} 个章节)...", flush=True)
    full_book_digest = _build_full_book_digest(chapters, max_total_chars=18000)
    print(f"      已生成全书核心工程特征摘要: {len(full_book_digest)} 字符", flush=True)

    cheatsheet_md = None
    patterns_md = None
    chapter_summaries: Dict[str, str] = {}

    # 阶段 3A: 深度生成 cheatsheet.md
    print(f"      [阶段 3A/3] 调用 [{provider_label}] 深度萃取全书核心工艺参数与速查表 (cheatsheet.md)...", flush=True)
    t0 = time.time()
    sys_cheat = (
        "你是资深 PCB 硬件工程专家与 DFM 智造工艺总工。请基于用户提供的全书各章节技术摘录，"
        "直接输出一份内容详实、数据精确、结构清晰的 Markdown 工业级速查卡（不要使用 ```markdown 代码块包裹，直接输出 Markdown 正文）。\n"
        "必须包含以下核心板块（使用 Markdown 表格与分级列表，保留书中的真实数值、公差、板厚、铜厚、线宽线距、过孔、阻焊、拼板、钢网及 SMT 贴片参数）：\n"
        "1. 文档与工艺体系概览\n"
        "2. PCB 叠层、板厚、铜厚与阻抗控制参数速查表\n"
        "3. 走线线宽/线距、过孔(Via)、焊盘与安全间距硬性约束表\n"
        "4. 阻焊(Solder Mask)、丝印(Silkscreen)、外形公差与拼板(V-CUT/邮票孔/工艺边)规范\n"
        "5. 激光钢网开口、SMT 贴片元器件封装间距与回流焊/波峰焊工艺红线\n"
        "6. Gerber / 钻孔 / BOM / CPL 坐标文件投产前核查清单"
    )
    user_cheat = (
        f"技能名称: {skill_name}\n"
        f"源文档: 《{source_filename}》 (共 {total_pages} 页, {len(chapters)} 章)\n\n"
        f"全书各章节高密度技术摘录:\n{full_book_digest}"
    )
    try:
        resp_cheat = call_llm(
            user_cheat,
            system_prompt=sys_cheat,
            json_mode=False,
            temperature=0.15,
            max_tokens=3600,
            task_type="skill_distill"
        )
        if resp_cheat and len(resp_cheat.strip()) > 200:
            cheatsheet_md = resp_cheat.strip().removeprefix("```markdown").removeprefix("```").removesuffix("```").strip()
            print(f"      ✓ cheatsheet.md 萃取完成 ({len(cheatsheet_md)} 字符, 耗时 {time.time() - t0:.1f}s)", flush=True)
    except Exception as e:
        print(f"      [Warn] 阶段 3A LLM 萃取异常: {e}", flush=True)

    # 阶段 3B: 深度生成 patterns.md
    print(f"      [阶段 3B/3] 调用 [{provider_label}] 深度萃取全流程设计模式与 DFM 反模式 (patterns.md)...", flush=True)
    t1 = time.time()
    sys_pat = (
        "你是资深 PCB 硬件工程专家与 DFM 智造工艺总工。请基于用户提供的全书各章节技术摘录，"
        "直接输出一份结构严谨、实战指导性极强的 Markdown 硬件设计与智造模式指南（不要使用 ```markdown 代码块包裹，直接输出 Markdown 正文）。\n"
        "必须包含以下板块：\n"
        "1. 原理图与元器件封装库设计标准模式 (Schematic & Footprint Best Practices)\n"
        "2. 模块化 PCB 布局与关键器件摆放模式 (Placement Patterns: 电源/MCU/高频/接口/可制造性)\n"
        "3. 高可靠布线、敷铜、泪滴与信号/电源完整性模式 (Routing & Plane Patterns)\n"
        "4. 嘉立创 DFM 工艺适配、拼板、钢网与 SMT 量产协同模式 (DFM & PCBA Assembly Patterns)\n"
        "5. 十大典型硬件与制造反模式及整改方案 (Top 10 Anti-Patterns & Fixes，以“错误做法 -> 制造风险 -> 规范整改”结构详述)"
    )
    try:
        resp_pat = call_llm(
            user_cheat,
            system_prompt=sys_pat,
            json_mode=False,
            temperature=0.2,
            max_tokens=3600,
            task_type="skill_distill"
        )
        if resp_pat and len(resp_pat.strip()) > 200:
            patterns_md = resp_pat.strip().removeprefix("```markdown").removeprefix("```").removesuffix("```").strip()
            print(f"      ✓ patterns.md 萃取完成 ({len(patterns_md)} 字符, 耗时 {time.time() - t1:.1f}s)", flush=True)
    except Exception as e:
        print(f"      [Warn] 阶段 3B LLM 萃取异常: {e}", flush=True)

    # 阶段 3C: 生成各章节结构化核心工程导读与路由说明
    print(f"      [阶段 3C/3] 调用 [{provider_label}] 生成全书 {len(chapters)} 个章节的工程核心导读...", flush=True)
    t2 = time.time()
    sys_chap = (
        "你是硬件知识库构建专家。请为下面列出的每个章节生成一段精炼的工程核心要点摘要。\n"
        "请严格按照每行一个章节的格式输出：\n"
        "CH_INDEX|核心工程职责与涵盖的工艺/设计关键点（60~120字，包含具体技术名词与参数维度）\n"
        "不要输出多余解释。"
    )
    chap_list_prompt = "\n\n".join(
        f"CH_{i:02d} ({ch['title']}):\n{_extract_chapter_high_signal_excerpt(ch, max_chars=700)}"
        for i, ch in enumerate(chapters, 1)
    )
    try:
        resp_chap = call_llm(
            chap_list_prompt[:16000],
            system_prompt=sys_chap,
            json_mode=False,
            temperature=0.15,
            max_tokens=2400,
            task_type="skill_distill"
        )
        for line in resp_chap.splitlines():
            line = line.strip().lstrip("-* ")
            if "|" in line and line.upper().startswith("CH_"):
                k, v = line.split("|", 1)
                chapter_summaries[k.strip().upper()] = v.strip()
        print(f"      ✓ 章节导读生成完成 (成功解析 {len(chapter_summaries)}/{len(chapters)} 章, 耗时 {time.time() - t2:.1f}s)", flush=True)
    except Exception as e:
        print(f"      [Warn] 阶段 3C 章节导读生成异常: {e}", flush=True)

    return cheatsheet_md, patterns_md, chapter_summaries, llm_cfg


def distill_to_skill(source_path: str, skill_name: str, output_dir: str) -> bool:
    t_start = time.time()
    os.makedirs(output_dir, exist_ok=True)
    chap_dir = os.path.join(output_dir, "chapters")
    # 清理旧的分册文件，防止历史残余碎片文件留存
    if os.path.exists(chap_dir):
        shutil.rmtree(chap_dir, ignore_errors=True)
    os.makedirs(chap_dir, exist_ok=True)

    print(f"\n[1/4] 读取并深度解析原始知识库: {source_path}", flush=True)
    doc_meta = parse_source_document(source_path)
    raw_text = doc_meta.get("full_text", "")
    total_pages = doc_meta.get("total_pages", 0)
    if not raw_text:
        print(f"[Error] 无法从 {source_path} 提取有效文本内容！", flush=True)
        return False
    print(f"      成功提取文档: 共 {total_pages or 1} 页 | 总文本长度: {len(raw_text):,} 字符", flush=True)

    print("[2/4] 基于原生目录书签与语义结构进行章节切分...", flush=True)
    chaps = segment_into_chapters(raw_text, doc_meta=doc_meta)
    print(f"      识别到真实章节分册: {len(chaps)} 个", flush=True)

    print("[3/4] 启动本地大模型跨章节深度知识蒸馏 (cheatsheet + patterns + 章节导读)...", flush=True)
    llm_cheat, llm_pat, chap_summaries, llm_cfg = _distill_with_llm(
        chaps, raw_text, skill_name, os.path.basename(source_path), total_pages=total_pages
    )

    chap_table_rows = []
    for idx, ch in enumerate(chaps, 1):
        title = ch["title"]
        raw_title = ch.get("raw_title") or title
        content = ch["content"]
        sub_sections = ch.get("sub_sections") or []
        safe_name = re.sub(r'[^\w\u4e00-\u9fa5]', '_', raw_title)[:32].strip('_') or f"part_{idx}"
        chap_fname = f"ch{idx:02d}_{safe_name}.md"
        chap_fpath = os.path.join(chap_dir, chap_fname)

        ch_key = f"CH_{idx:02d}"
        ai_summary = chap_summaries.get(ch_key) or (
            "涵盖 " + "、".join(s.split(" (P.")[0] for s in sub_sections[:6])
            if sub_sections else f"涵盖 {title} 的核心设计规范、工艺约束与工程实践细则。"
        )

        with open(chap_fpath, "w", encoding="utf8") as f:
            f.write(f"# {title}\n\n")
            f.write(f"> **AI 蒸馏核心导读**：{ai_summary}\n\n")
            if sub_sections:
                f.write("## 本章小节目录索引\n\n")
                for s in sub_sections:
                    f.write(f"- {s}\n")
                f.write("\n---\n\n")
            f.write("## 章节完整原文与技术规范\n\n")
            f.write(f"{content}\n")

        chap_table_rows.append(
            f"| Ch {idx:02d} | [`chapters/{chap_fname}`](./chapters/{chap_fname}) | **{title}**：{ai_summary} |"
        )

    with open(os.path.join(output_dir, "cheatsheet.md"), "w", encoding="utf8") as f:
        if llm_cheat:
            f.write(llm_cheat + "\n")
        else:
            f.write(f"# {skill_name} · 核心参数工业级速查卡 (Cheatsheet)\n\n" + _build_full_book_digest(chaps, 8000))

    with open(os.path.join(output_dir, "patterns.md"), "w", encoding="utf8") as f:
        if llm_pat:
            f.write(llm_pat + "\n")
        else:
            f.write(f"# {skill_name} · 推荐设计模式与反模式\n\n" + _build_full_book_digest(chaps, 8000))

    elapsed = round(time.time() - t_start, 1)
    model_used = f"{llm_cfg.get('provider_name', 'Local vLLM')} ({llm_cfg.get('model_name', 'Qwen3.8-27B')})"

    print("[4/4] 生成主控规范索引 SKILL.md...", flush=True)
    with open(os.path.join(output_dir, "SKILL.md"), "w", encoding="utf8") as f:
        f.write(f"""---
name: {skill_name}
description: >-
  蒸馏自《{os.path.basename(source_path)}》（共 {total_pages or 1} 页 / {len(chaps)} 个章节 / {len(raw_text):,} 字符）的企业级硬件与 PCB 智造知识库技能。
  支持在 Antigravity, Claude Code, Codex, Pi 中自动触发并指导原理图、PCB 布局布线、DFM 工艺检查与 SMT 量产设计。
metadata:
  author: AI-PCB Knowledge Distiller
  version: "2.5.0"
  source_file: "{os.path.basename(source_path)}"
  total_pages: {total_pages or 1}
  total_chapters: {len(chaps)}
  total_characters: {len(raw_text)}
  distilled_by_model: "{llm_cfg.get('model_name', 'Qwen3.8-27B')}"
  distill_elapsed_sec: {elapsed}
---

# {skill_name} · 工业级硬件与 PCB 智造知识库体系

本技能由 AI-PCB 平台蒸馏引擎通过 **{model_used}** 全书跨章节深度萃取构建，完整覆盖源文档《{os.path.basename(source_path)}》（共 **{total_pages or 1} 页**、**{len(chaps)} 个章节**、**{len(raw_text):,} 字符**）的工艺参数、设计规范与量产实战准则。

## 1. 核心架构与全书章节路由索引 (Topic Router)

| 模块分册 | 对应文件 | 覆盖的核心内容与工程职责 |
| :--- | :--- | :--- |
| **核心参数速查卡** | [`cheatsheet.md`](./cheatsheet.md) | 全书关键工艺参数、叠层阻抗、线宽线距、过孔焊盘、拼板钢网与 SMT 公差速查表 |
| **设计模式与反模式** | [`patterns.md`](./patterns.md) | 原理图/封装、布局布线、DFM/CAM 核查推荐模式与十大典型制造反模式 |
{chr(10).join(chap_table_rows)}

## 2. Coding Agent 闭环执行准则
在执行任何硬件原理图设计、PCB 布局布线、DFM 制造检查与生产文件（Gerber / 钻孔 / BOM / CPL）导出时：
1. **参数先行**：优先查阅 [`cheatsheet.md`](./cheatsheet.md) 获取精确的线宽、间距、孔径、阻焊桥、板边净距及钢网/SMT 工艺公差；
2. **模式约束**：严格遵循 [`patterns.md`](./patterns.md) 中的布局布线与 DFM 设计模式，主动规避反模式；
3. **章节深潜**：遇到特定专题（如叠层阻抗、V-CUT/邮票孔拼板、BGA/QFN 焊盘、激光钢网或嘉立创 CAM 审核），按上表路由按需加载 `chapters/chXX_*.md` 查阅完整章节原文；
4. **零违规交付**：严格通过 KiCad CLI DRC/ERC 官方 0 违规验收方可导出生产交付包。
""")

    print(
        f"\n[Success] 全书知识库深度蒸馏完成！共解析 {total_pages or 1} 页 / {len(chaps)} 章，总耗时 {elapsed}s。输出目录: {output_dir}",
        flush=True
    )
    return True


def main():
    parser = argparse.ArgumentParser(description="AI-PCB 知识库蒸馏引擎")
    parser.add_argument("input", help="输入的技术文档文件路径 (DOCX/PDF/XLSX/MD/TXT)")
    parser.add_argument("--name", default="custom-hardware-skill", help="输出技能名称 (例如: pcb-design-skill)")
    parser.add_argument("--out", default=None, help="目标输出目录 (默认在 platform/skills/<name>)")

    args = parser.parse_args()
    if not os.path.exists(args.input):
        print(f"[Error] 输入文件不存在: {args.input}", flush=True)
        return 1

    out_dir = args.out or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills", args.name)
    success = distill_to_skill(args.input, args.name, out_dir)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
