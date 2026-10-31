#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 智能需求提炼器 (Agent Requirement Distiller)

驱动引擎：SiliconFlow DeepSeek-V4-Flash
核心流程：
  1. 调用 doc_parser 深度解析 Excel (.xlsx/.xls), Word (.docx/.doc), PDF, Markdown 需求附件；
  2. 调用 DeepSeek-V4-Flash 大模型提炼硬件尺寸、电源架构、MCU选型、外设清单及引脚映射表 (Pinout Table)；
  3. 格式化为标准结构化对象，返回给前端或 CLI 等待用户确认 (Gate 1 评审门禁)。
"""

import sys, os, re, json
PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PLATFORM_ROOT)

from core.doc_parser import parse_document
from core.llm_client import call_llm
from core.config_manager import resolve_llm_config

SYSTEM_PROMPT = """你是一位精通工业级硬件与嵌入式 C 系统的首席架构师 AI。
你的任务是从用户上传的电路板需求描述、引脚定义表格或机械尺寸图纸中，深度提炼并规范化出完整的【硬件与嵌入式工程需求模型】。

请输出且仅输出合法的 JSON 对象，格式如下：
{
  "project_name": "项目英文或缩写名称 (如: LAB7-Night-Vision)",
  "project_summary": "100字以内的项目功能概括",
  "mechanical": {
    "width_mm": 50.0,
    "height_mm": 30.0,
    "thickness_mm": 1.0,
    "layers": 2,
    "fillet_mm": 1.0,
    "mounting_holes": "安装孔/定位孔描述",
    "height_limits": "元器件限高描述",
    "keepouts": "禁布区描述"
  },
  "power": {
    "input_source": "供电类型与电压 (如: 1.5V干电池 / 3.7V锂电 / USB 5V)",
    "operating_voltage": "系统主工作电压 (如: 3.3V)",
    "boost_or_buck": "升降压拓扑要求",
    "max_current": "最大负载电流",
    "low_power_spec": "低功耗指标 (如休眠 < 10uA)",
    "protection": ["防反接保护", "ESD/TVS静电防护"]
  },
  "mcu": {
    "model": "推荐或指定的MCU型号 (如: STM32L011F4U6TR / ESP32-S3)",
    "package": "封装 (如: QFN-20 / LQFP-48)",
    "debug_interface": "SWD / JTAG / UART",
    "firmware_framework": "纯嵌入式 C (裸机/CMSIS) / FreeRTOS"
  },
  "peripherals": ["外设1", "外设2", "外设3"],
  "pinout_table": [
    {
      "pin": "MCU引脚 (如 PA0)",
      "net_name": "网络标号 (如 LDR_ADC)",
      "function": "复用功能 (如 ADC_IN0)",
      "description": "功能与连接描述"
    }
  ],
  "manufacturing": {
    "fab": "JLCPCB (嘉立创)",
    "finish": "ENIG (沉金)",
    "faraday_cage": true,
    "acid_trap_chamfer": true
  }
}
务必保证输出的 JSON 语法完全合法，严禁输出任何额外的解释文本。"""

def distill_requirements(file_paths = None, custom_text: str = "") -> dict:
    processed_files = []
    combined_content = ""

    # 兼容单个路径或路径列表
    if file_paths:
        if isinstance(file_paths, str):
            file_paths = [file_paths]
        for idx, fp in enumerate(file_paths, start=1):
            if fp and os.path.exists(fp):
                try:
                    parsed = parse_document(fp)
                    processed_files.append(parsed["filename"])
                    combined_content += f"=== 需求材料 [{idx}/{len(file_paths)}]: {parsed['filename']} ({parsed['file_type'].upper()}) ===\n"
                    combined_content += parsed["full_text"].strip() + "\n\n"
                except Exception as ex:
                    print(f"[Warn] 解析文件 {fp} 失败: {ex}")
                    combined_content += f"=== 需求材料 [{idx}]: {os.path.basename(fp)} (解析异常: {ex}) ===\n\n"

    if custom_text and custom_text.strip():
        combined_content += f"=== 用户自定义设计说明与补充要求 ===\n{custom_text.strip()}\n\n"

    if not combined_content.strip():
        raise ValueError("请至少上传一个需求文件或输入自定义需求描述！")

    source_name = ", ".join(processed_files) if processed_files else "自定义需求输入"
    source_type = f"多文件协同 ({len(processed_files)} 份材料)" if len(processed_files) > 1 else ("单文件解析" if processed_files else "TEXT")

    # 限制输入长度，避免超出上下文窗口（截取前 15000 字）
    if len(combined_content) > 15000:
        combined_content = combined_content[:15000] + "\n...(后文截断)..."

    user_prompt = f"""以下是硬件与嵌入式项目的全量需求材料（已汇总 {len(processed_files)} 个附件与用户补充要求）：

{combined_content}

请综合交叉分析上述所有文档（包含机械尺寸、引脚映射、电源拓扑、器件选型与固件逻辑），提取全部关键参数与引脚定义，输出符合规范的纯 JSON 对象。"""

    llm_cfg = resolve_llm_config("req_distill")
    active_model_label = f"{llm_cfg.get('provider_name')} · {llm_cfg.get('model_name')}"
    print(f"[*] 正在调用 {active_model_label} 交叉提炼多文档需求 ({source_name})...")
    raw_response = call_llm(user_prompt, system_prompt=SYSTEM_PROMPT, json_mode=True, temperature=llm_cfg.get("temperature", 0.1), task_type="req_distill")

    # 清洗 JSON
    clean_json_str = raw_response.strip()
    if clean_json_str.startswith("```json"):
        clean_json_str = clean_json_str[7:]
    if clean_json_str.startswith("```"):
        clean_json_str = clean_json_str[3:]
    if clean_json_str.endswith("```"):
        clean_json_str = clean_json_str[:-3]
    clean_json_str = clean_json_str.strip()

    try:
        spec_data = json.loads(clean_json_str)
    except json.JSONDecodeError as e:
        print(f"[Warn] JSON 解析失败，尝试正则抓取: {e}")
        m = re.search(r'\{.*\}', clean_json_str, re.DOTALL)
        if m:
            spec_data = json.loads(m.group(0))
        else:
            raise RuntimeError(f"无法将大模型输出解析为有效 JSON: {clean_json_str[:200]}")

    # 生成供用户审阅的人类友好 Markdown
    review_md = f"""# 📋 硬件与嵌入式需求对标确认单 (Gate 1 评审)
> **需求来源**：`{source_name}` ({source_type})  
> **提炼引擎**：`{active_model_label}`  
> **当前状态**：**⏳ 等待用户审查确认 (Pending User Confirmation)**

---

### 1. 结构与尺寸规格
* **板卡外形**：{spec_data.get('mechanical', {}).get('width_mm', 50)} × {spec_data.get('mechanical', {}).get('height_mm', 30)} mm (板厚 {spec_data.get('mechanical', {}).get('thickness_mm', 1.0)} mm)
* **叠层方案**：标准 {spec_data.get('mechanical', {}).get('layers', 2)} 层板 (双面接地铺铜)
* **倒角与避空**：四角 R{spec_data.get('mechanical', {}).get('fillet_mm', 1.0)} 倒角 | 定位孔: {spec_data.get('mechanical', {}).get('mounting_holes', '无')}
* **限高与禁布**：{spec_data.get('mechanical', {}).get('height_limits', '正面常规限高')}

### 2. 电源系统与电气防护
* **供电源**：{spec_data.get('power', {}).get('input_source', '3.7V 锂电池')}
* **升压/降压需求**：{spec_data.get('power', {}).get('boost_or_buck', 'LDO 输出 3.3V')}
* **低功耗指标**：{spec_data.get('power', {}).get('low_power_spec', '待机休眠')}
* **安全保护**：{", ".join(spec_data.get('power', {}).get('protection', ['防反接', 'ESD']))}

### 3. 主控芯片与固件框架
* **主控型号**：`{spec_data.get('mcu', {}).get('model', 'STM32')}` (封装: `{spec_data.get('mcu', {}).get('package', 'QFN')}`)
* **调试接口**：`{spec_data.get('mcu', {}).get('debug_interface', 'SWD')}`
* **开发框架**：`{spec_data.get('mcu', {}).get('firmware_framework', '纯嵌入式 C')}`

### 4. 识别到的外设列表
{chr(10).join([f"* [x] **{p}**" for p in spec_data.get('peripherals', [])])}

### 5. 软硬件协同引脚映射表 (Pinout Matrix)
| 引脚 (Pin) | 网络名称 (Net) | 复用功能 (Function) | 功能说明 (Description) |
| :--- | :--- | :--- | :--- |
"""
    for pin in spec_data.get("pinout_table", []):
        review_md += f"| `{pin.get('pin', '-')}` | **`{pin.get('net_name', '-')}`** | `{pin.get('function', '-')}` | {pin.get('description', '-')} |\n"

    # 生成供后续 Coding Agent 一键开工的 Action Plan Prompt
    mech = spec_data.get('mechanical', {})
    pwr = spec_data.get('power', {})
    mcu = spec_data.get('mcu', {})
    agent_prompt = f"""【已确认工程需求】：{spec_data.get('project_name', 'Hardware-Project')}
【功能概括】：{spec_data.get('project_summary', '')}
【机械尺寸】：{mech.get('width_mm', 50)} x {mech.get('height_mm', 30)} mm，板厚 {mech.get('thickness_mm', 1.0)}mm，{mech.get('layers', 2)}层板，四角倒角 R{mech.get('fillet_mm', 1.0)}mm。
【供电系统】：{pwr.get('input_source', '3.7V')}，拓扑：{pwr.get('boost_or_buck', 'LDO')}，保护机制：{', '.join(pwr.get('protection', []))}。
【主控芯片】：{mcu.get('model', 'STM32')} ({mcu.get('package', 'QFN')})，{mcu.get('debug_interface', 'SWD')} 调试接口。
【外设清单】：{', '.join(spec_data.get('peripherals', []))}
【引脚定义】：共分配 {len(spec_data.get('pinout_table', []))} 个功能引脚。
【工业军规】：嘉立创沉金 ENIG 标准，外沿环绕 3mm 法拉第接地屏蔽笼，死铜孤岛全面剥离，45° 钝角防酸角平滑走线。
请 Coding Agent 基于单一事实源 (SSOT) 开始设计 KiCad 原理图、PCB 布局布线及配套嵌入式 C 语言驱动代码，并执行 kicad-cli DRC 0 违规验收。"""

    return {
        "filename": source_name,
        "file_type": source_type,
        "spec": spec_data,
        "review_md": review_md,
        "agent_prompt": agent_prompt,
        "status": "pending_user_confirmation"
    }

def distill_requirements_from_file(file_path: str) -> dict:
    return distill_requirements(file_path=file_path)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        res = distill_requirements_from_file(sys.argv[1])
        print(res["review_md"])
