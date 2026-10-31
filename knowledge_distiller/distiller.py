#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 知识库蒸馏引擎 (Knowledge-to-Skill Distiller)

核心能力：
  将用户上传的硬件设计指南、厂商工艺手册、元器件 Datasheet（Word .docx/.doc, PDF, Excel, Markdown）
  通过 doc_parser 与配置的 LLM (skill_distill 路由) 全自动蒸馏并重构成符合 Agent 技能规范的工业级 Skill 库：
    - SKILL.md (主控规范、路由索引与触发器)
    - cheatsheet.md (速查卡：从文档提炼的关键电气参数/线宽载流/寄存器/封装约束)
    - patterns.md (设计模式与反模式)
    - chapters/*.md (主题深入专题分册)
"""

import sys
import os
import re
import json
import argparse

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLATFORM_ROOT not in sys.path:
    sys.path.insert(0, PLATFORM_ROOT)

from core.doc_parser import parse_document
from core.llm_client import call_llm
from core.config_manager import resolve_llm_config


def extract_text_from_file(file_path):
    try:
        parsed = parse_document(file_path)
        return parsed.get("full_text", "")
    except Exception as e:
        print(f"[Warn] doc_parser 解析异常，回退纯文本读取: {e}")
        try:
            with open(file_path, "r", encoding="utf8", errors="ignore") as f:
                return f.read()
        except Exception:
            return ""


def segment_into_chapters(raw_text):
    """智能切分章节：识别如 第x章、1.1、Chapter、--- Page 等"""
    lines = raw_text.splitlines()
    chapters = []
    curr_title = "概述与通用指导"
    curr_lines = []

    pattern = re.compile(
        r'^(第[0-9一二三四五六七八九十]+[章节部分]|[\d]+\.[\d]*\s+|Chapter\s+\d+|[一二三四五六七八九十]、|#{1,3}\s+)',
        re.IGNORECASE
    )

    for line in lines:
        s = line.strip()
        if not s:
            continue
        if len(s) < 65 and pattern.match(s):
            if curr_lines:
                chapters.append((curr_title.lstrip("# ").strip(), "\n".join(curr_lines)))
                curr_lines = []
            curr_title = s.lstrip("# ").strip()
        else:
            curr_lines.append(s)

    if curr_lines:
        chapters.append((curr_title, "\n".join(curr_lines)))

    if len(chapters) == 1 and len(chapters[0][1]) > 5000:
        chunks = []
        words = raw_text.split("\n")
        chunk_size = max(50, len(words) // 5)
        for i in range(0, len(words), chunk_size):
            chunks.append((f"专题分册_{i // chunk_size + 1}", "\n".join(words[i:i + chunk_size])))
        return chunks

    return chapters


def _distill_with_llm(raw_text: str, skill_name: str, source_filename: str):
    """调用配置的 skill_distill 模型提炼专属速查表与设计模式"""
    llm_cfg = resolve_llm_config("skill_distill")
    print(f"      正在调用 [{llm_cfg.get('provider_name')} · {llm_cfg.get('model_name')}] 深度萃取参数与设计规范...")
    excerpt = raw_text[:12000]
    sys_prompt = """你是资深硬件 PCB 与嵌入式 C 系统架构专家。
请根据用户提供的技术文档/数据手册内容，提炼出结构化的 JSON 对象，包含两个 Markdown 字段：
1. "cheatsheet_md": 提炼该文档中的核心电气参数、引脚/寄存器定义、线宽/间距/封装约束、典型工作条件速查表（使用 Markdown 标题与表格）。
2. "patterns_md": 提炼该文档中的推荐硬件/软件设计模式（Best Practices）以及必须避免的反模式/注意事项（Anti-Patterns）。
仅输出合法 JSON 对象。"""
    user_prompt = f"技能名称: {skill_name}\n源文档: {source_filename}\n\n文档内容节选:\n{excerpt}"
    try:
        resp = call_llm(user_prompt, system_prompt=sys_prompt, json_mode=True, task_type="skill_distill")
        clean = resp.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(clean)
        if data.get("cheatsheet_md") and data.get("patterns_md"):
            return data["cheatsheet_md"], data["patterns_md"]
    except Exception as e:
        print(f"      [提示] LLM 深度萃取跳过，使用标准工程规范模板 ({e})")
    return None, None


def distill_to_skill(source_path, skill_name, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    chap_dir = os.path.join(output_dir, "chapters")
    os.makedirs(chap_dir, exist_ok=True)

    print(f"\n[1/4] 读取并解析原始知识库: {source_path}")
    raw_text = extract_text_from_file(source_path)
    if not raw_text:
        print(f"[Error] 无法从 {source_path} 提取有效文本内容！")
        return False
    print(f"      成功提取文本长度: {len(raw_text)} 字符")

    print("[2/4] 进行主题聚类与章节分册...")
    chaps = segment_into_chapters(raw_text)
    print(f"      识别到专题分册: {len(chaps)} 个")

    chap_table_rows = []
    for idx, (title, content) in enumerate(chaps, 1):
        safe_name = re.sub(r'[^\w\u4e00-\u9fa5]', '_', title)[:30].strip('_') or f"part_{idx}"
        chap_fname = f"ch{idx:02d}_{safe_name}.md"
        chap_fpath = os.path.join(chap_dir, chap_fname)
        with open(chap_fpath, "w", encoding="utf8") as f:
            f.write(f"# {title}\n\n{content}\n")
        chap_table_rows.append(f"| Ch {idx:02d} | [`chapters/{chap_fname}`](./chapters/{chap_fname}) | {title} |")

    print("[3/4] 萃取速查卡与设计模式 (cheatsheet & patterns)...")
    llm_cheat, llm_pat = _distill_with_llm(raw_text, skill_name, os.path.basename(source_path))

    with open(os.path.join(output_dir, "cheatsheet.md"), "w", encoding="utf8") as f:
        if llm_cheat:
            f.write(llm_cheat)
        else:
            f.write(f"""# {skill_name} · 核心参数工业级速查卡 (Cheatsheet)

## 1. 基础工艺与物理约束
* 最小走线线宽 / 线距：常规建议 ≥ 0.127mm (5 mil)；密集引脚局部可放宽至 3.5~4 mil
* 最小通孔钻孔：0.25mm / 0.45mm 焊盘 (嘉立创标准免加价工艺)
* 板边绝缘净距：CNC 边缘 ≥ 0.30mm；V-CUT 拼板线 ≥ 0.40mm
* 阻焊桥间隙：绿色阻焊 ≥ 0.10mm (4 mil)；彩色油墨 ≥ 0.127mm (5 mil)

## 2. 载流与电源线宽参考 (1oz 铜厚，温升 < 10℃)
| 信号/网络类型 | 推荐线宽 (mm / mil) | 最大安全载流 (A) | 典型应用场景 |
| :--- | :--- | :--- | :--- |
| 常规信号走线 | 0.15 mm (6 mil) | ~ 0.5 A | 数字 GPIO、ADC 模拟采集、I2C/SPI |
| 模拟参考基准 | 0.20 mm (8 mil) | ~ 0.8 A | VREF、敏感低噪传感器偏置 |
| 电源主干网 | 0.30~0.50 mm (12~20 mil)| 1.2 ~ 1.8 A | 3.3V/5V 主电源轨、LDO 输出 |
| 开关高频动力 | 0.80~1.50 mm (铺铜优先)| 3.0 ~ 6.0 A | DCDC Boost/Buck SW 节点、电池进线 |
""")

    with open(os.path.join(output_dir, "patterns.md"), "w", encoding="utf8") as f:
        if llm_pat:
            f.write(llm_pat)
        else:
            f.write(f"""# {skill_name} · 推荐设计模式与六大反模式

## 推荐模式 (Best Practices)
1. **法拉第屏蔽笼模式 (Faraday Cage Pattern)**：在双层或多层板外边沿，以 2.5~3.5mm 间距环绕布置一圈接地缝合过孔，大幅提高金属壳体内的 ESD/EMI 免疫力。
2. **热回路最小化模式 (Hot-Loop Minimization)**：DCDC 输入电容 -> 上管/下管 -> 电感 -> 输出电容构成的交流脉冲回路面积必须最小。
3. **45° 钝角折线模式 (Chamfering Pattern)**：所有转角平滑为 135° 钝角，彻底消除直角酸角与高频阻抗突变。

## 六大反模式 (Anti-Patterns to Avoid)
1. **反模式 1：直角走线 (Right-Angle Acid Trap)**
2. **反模式 2：悬空孤铜 (Floating Dead Copper Island)**
3. **反模式 3：参考平面跨分割 (Crossing Plane Splits)**
4. **反模式 4：反馈线紧贴电感 (FB Sensitive Node Near SW Node)**
5. **反模式 5：去耦电容远离引脚 (Decoupling Capacitor Placed Far From IC)**
6. **反模式 6：裸铜焊盘混入 SMT 贴片坐标表 (Ghost Pads in Pick-and-Place)**
""")

    print("[4/4] 生成主控规范索引 SKILL.md...")
    with open(os.path.join(output_dir, "SKILL.md"), "w", encoding="utf8") as f:
        f.write(f"""---
name: {skill_name}
description: >-
  蒸馏自《{os.path.basename(source_path)}》的企业级硬件与嵌入式开发知识库技能。
  支持在 Claude Code, Antigravity, Codex, Pi 中自动触发并指导电路板与固件设计。
metadata:
  author: AI-PCB Knowledge Distiller
  version: "2.0.0"
---

# {skill_name} 知识库核心指导体系

本技能由 AI-PCB 平台蒸馏引擎自动构建，完整保留并结构化了源文档《{os.path.basename(source_path)}》的工业级工程指导规范。

## 1. 核心架构与知识索引路由 (Topic Router)

| 模块分册 | 对应文件 | 覆盖的核心内容与解答的问题 |
| :--- | :--- | :--- |
| **速查卡** | [`cheatsheet.md`](./cheatsheet.md) | 关键电气参数、线宽载流、寄存器与工艺间距速查 |
| **设计模式** | [`patterns.md`](./patterns.md) | 推荐最佳布局布线/驱动设计模式与反模式 |
{"\n".join(chap_table_rows)}

## 2. 闭环执行准则
在任何硬件 PCB 与固件设计过程中：
1. 优先查阅 `cheatsheet.md` 与对应章节分册；
2. 严守 `patterns.md` 中的推荐模式，杜绝反模式；
3. 严格通过 KiCad CLI DRC/ERC 官方 0 违规验收与 GCC 编译校验方可导出生产交付包。
""")

    print(f"\n[Success] 知识库已成功蒸馏为 Skill 规范！输出目录: {output_dir}")
    return True


def main():
    parser = argparse.ArgumentParser(description="AI-PCB 知识库蒸馏引擎")
    parser.add_argument("input", help="输入的技术文档文件路径 (DOCX/PDF/XLSX/MD/TXT)")
    parser.add_argument("--name", default="custom-hardware-skill", help="输出技能名称 (例如: pcb-instruction)")
    parser.add_argument("--out", default=None, help="目标输出目录 (默认在 platform/skills/<name>)")

    args = parser.parse_args()
    if not os.path.exists(args.input):
        print(f"[Error] 输入文件不存在: {args.input}")
        return 1

    out_dir = args.out or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills", args.name)
    success = distill_to_skill(args.input, args.name, out_dir)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
