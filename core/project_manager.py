#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 多工程工作空间与软硬件确定性底座管理器 (Project & Workspace Manager)

核心职责：
  1. 多工程注册、自动发现与切换 (消除硬编码的 LAB7 路径)
  2. 软硬件单一事实源 (spec.json & pinout.json) 读写与引脚冲突预检 (PinMux Validator)
  3. 确定性生成嵌入式 C 头文件 `firmware/Drivers/bsp_pinout.h`
  4. 动态调用 `kicad-cli pcb drc`、`kicad-cli pcb render` (3D 渲染) 与 `arm-none-eabi-gcc` 编译验证
"""

import os
import re
import csv
import glob
import json
import time
import shutil
import zipfile
import subprocess
from typing import Dict, Any, List, Optional

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(PLATFORM_ROOT, "config")
REGISTRY_FILE = os.path.join(CONFIG_DIR, "projects_registry.json")

from core.config_manager import load_settings, save_settings
from core.mcu_database import check_mcu_specific_pin_rules, match_mcu_profile


def _ensure_lab7_ssot_files():
    """确保经典标杆工程 night-verson-goggle 根目录下拥有标准 spec.json 与 pinout.json"""
    lab7_dir = "/Users/zhenxian/Documents/XXG/Xter/projects/night-verson-goggle"
    if not os.path.exists(lab7_dir):
        return
    spec_path = os.path.join(lab7_dir, "spec.json")
    pinout_path = os.path.join(lab7_dir, "pinout.json")

    if not os.path.exists(spec_path):
        lab7_spec = {
            "project_name": "LAB7-Night-Vision-Mainboard",
            "project_summary": "LAB7 双筒微光夜视仪主控驱动板，支持 1.5V 干电池/锂电池供电升压、光敏自动调光、红外补光 PWM 控制、干簧管磁控与法拉第屏蔽笼。",
            "mechanical": {
                "width_mm": 59.0,
                "height_mm": 26.0,
                "thickness_mm": 1.0,
                "layers": 2,
                "fillet_mm": 1.0,
                "mounting_holes": "底边中心 Ø3.5mm 半圆定位避让缺口 + 15组带Ø0.8mm穿线孔焊盘",
                "height_limits": "正面限高 ≤ 4.5mm，背面扁平无高件",
                "keepouts": "板边 3.0mm 法拉第接地屏蔽缝合孔圈"
            },
            "power": {
                "input_source": "1.5V AA 干电池 / 3.7V 锂电池宽压输入",
                "operating_voltage": "3.3V 系统主轨 + 升压驱动轨",
                "boost_or_buck": "同步 Boost 升压拓扑 + 低噪声 LDO",
                "max_current": "500mA",
                "low_power_spec": "待机休眠电流 < 5uA",
                "protection": ["PMOS 防反接保护", "ESD TVS 静电防护", "法拉第笼环绕接地"]
            },
            "mcu": {
                "model": "STM32L011F4U6TR",
                "package": "UFQFPN-20",
                "debug_interface": "SWD (SWDIO/SWCLK/NRST/GND)",
                "firmware_framework": "纯嵌入式 C (CMSIS / LL 低功耗状态机)"
            },
            "peripherals": [
                "光敏传感器 ADC 采集 (LDR_ADC)",
                "红外补光灯 PWM 驱动 (IR_LED_PWM)",
                "双色状态指示灯 (LED_RED / LED_YEL)",
                "干簧管磁控翻转检测 (HALL_SW)",
                "双档位模式拨动开关 (MODE_SW1 / MODE_SW2)",
                "像管高压供电使能 (TUBE_PWR_EN)",
                "电池电量低压监测 (BAT_ADC)"
            ],
            "manufacturing": {
                "fab": "JLCPCB (嘉立创)",
                "finish": "ENIG (沉金 1.0mm)",
                "faraday_cage": True,
                "acid_trap_chamfer": True
            }
        }
        try:
            with open(spec_path, "w", encoding="utf8") as f:
                json.dump(lab7_spec, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    if not os.path.exists(pinout_path):
        lab7_pinout = [
            {"pin": "PA0", "net_name": "LDR_ADC", "function": "ADC_IN0", "description": "环境光敏电阻分压采样输入"},
            {"pin": "PA1", "net_name": "BAT_ADC", "function": "ADC_IN1", "description": "电池电压电量分压采样输入"},
            {"pin": "PA2", "net_name": "IR_PWM", "function": "TIM2_CH3", "description": "红外补光灯 MOSFET PWM 调光输出"},
            {"pin": "PA3", "net_name": "TUBE_EN", "function": "GPIO_Output", "description": "夜视像管升压电源使能控制"},
            {"pin": "PA4", "net_name": "HALL_INT", "function": "GPIO_EXTI4", "description": "干簧管磁控休眠唤醒中断输入"},
            {"pin": "PA5", "net_name": "SW_GEAR1", "function": "GPIO_Input", "description": "主拨动开关1档开机信号输入"},
            {"pin": "PA6", "net_name": "SW_GEAR2", "function": "GPIO_Input", "description": "主拨动开关2档红外开启信号输入"},
            {"pin": "PA7", "net_name": "LED_RED", "function": "GPIO_Output", "description": "红色低电量报警状态指示灯"},
            {"pin": "PB1", "net_name": "LED_IR_IND", "function": "GPIO_Output", "description": "黄色红外补光开启状态指示灯"},
            {"pin": "PA13", "net_name": "SWDIO", "function": "SYS_SWDIO", "description": "SWD 调试数据接口"},
            {"pin": "PA14", "net_name": "SWCLK", "function": "SYS_SWCLK", "description": "SWD 调试时钟接口"},
            {"pin": "NRST", "net_name": "NRST", "function": "SYS_NRST", "description": "系统低电平复位引脚"}
        ]
        try:
            with open(pinout_path, "w", encoding="utf8") as f:
                json.dump(lab7_pinout, f, indent=2, ensure_ascii=False)
        except Exception:
            pass


def validate_pinout_matrix(pinout: List[Dict[str, Any]], mcu_str: str = "") -> Dict[str, Any]:
    """对 pinout.json 执行引脚冲突、复用风险与 MCU 外设字典规则检查"""
    errors = []
    warnings = []
    seen_pins: Dict[str, str] = {}
    seen_nets: Dict[str, str] = {}

    for idx, item in enumerate(pinout, start=1):
        pin = str(item.get("pin", "")).strip().upper()
        net = str(item.get("net_name", "")).strip()
        func = str(item.get("function", "")).strip()

        if not pin or pin == "-":
            warnings.append(f"第 {idx} 行：未指定具体物理引脚编号 (网络: {net or '未命名'})。")
            continue
        if not net or net == "-":
            warnings.append(f"第 {idx} 行 ({pin})：未定义网络标号 (Net Name)。")

        # 1. 检查物理引脚重复分配（除非是电源/GND引脚）
        if pin not in ("GND", "VCC", "VDD", "3V3", "5V", "VBAT"):
            if pin in seen_pins and seen_pins[pin] != net:
                errors.append(
                    f"引脚冲突：{pin} 同时被分配给了网络 `{seen_pins[pin]}` 与 `{net}`！请修改其中一个。"
                )
            seen_pins[pin] = net

        # 2. 检查同名网络跨多个非电源引脚
        if net and net.upper() not in ("GND", "VCC", "VDD", "3V3", "5V", "+3V3", "+5V"):
            if net in seen_nets and seen_nets[net] != pin:
                warnings.append(
                    f"网络跨接提示：网络 `{net}` 同时连接在引脚 `{seen_nets[net]}` 与 `{pin}`，请确认是否为故意短接。"
                )
            seen_nets[net] = pin

    # 3. 结合 MCU 外设字典执行芯片级规则校验 (ADC合法引脚、SWD/JTAG/Strapping占用、封装引脚上限)
    mcu_check = check_mcu_specific_pin_rules(pinout, mcu_str)
    for e in mcu_check.get("errors", []):
        if e not in errors:
            errors.append(e)
    for w in mcu_check.get("warnings", []):
        if w not in warnings:
            warnings.append(w)

    return {
        "valid": len(errors) == 0,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "errors": errors,
        "warnings": warnings,
        "total_pins": len(pinout),
        "mcu_profile": mcu_check.get("mcu_profile", {})
    }


def generate_bsp_pinout_header(spec: Dict[str, Any], pinout: List[Dict[str, Any]]) -> str:
    """根据 spec.json 与 pinout.json 确定性生成纯 C99 标准 `bsp_pinout.h` 头文件"""
    pname = spec.get("project_name", "AI_PCB_PROJECT")
    mcu_info = spec.get("mcu", {})
    mcu_model = mcu_info.get("model") or mcu_info.get("family") or "STM32_GENERIC"
    mcu_pkg = mcu_info.get("package", "QFN/TSSOP")
    mech = spec.get("mechanical", {})

    lines = [
        "/**",
        f" * @file    bsp_pinout.h",
        f" * @brief   软硬件协同单一事实源 (SSOT) 自动生成引脚定义头文件",
        f" * @project {pname}",
        f" * @mcu     {mcu_model} ({mcu_pkg})",
        f" * @board   {mech.get('width_mm', 50)}x{mech.get('height_mm', 30)}mm, {mech.get('layers', 2)} Layers",
        f" * @note    本文件由 AI-PCB Platform 根据 pinout.json 自动生成，请勿手工硬编码修改引脚宏。",
        " */",
        "",
        "#ifndef __BSP_PINOUT_H__",
        "#define __BSP_PINOUT_H__",
        "",
        "#ifdef __cplusplus",
        'extern "C" {',
        "#endif",
        "",
        "#include <stdint.h>",
        "",
        f'#define BSP_PROJECT_NAME        "{pname}"',
        f'#define BSP_TARGET_MCU          "{mcu_model}"',
        f"#define BSP_ASSIGNED_PIN_COUNT  ({len(pinout)}U)",
        "",
        "/* ========================================================================== */",
        "/* 1. 硬件网络与 MCU 物理引脚映射宏定义 (SSOT Pinout Macros)                    */",
        "/* ========================================================================== */"
    ]

    used_macros = set()
    struct_initializers = []

    for idx, item in enumerate(pinout):
        raw_pin = str(item.get("pin", f"PIN_{idx}")).strip()
        raw_net = str(item.get("net_name", f"SIG_{idx}")).strip()
        raw_func = str(item.get("function", "GPIO")).strip()
        raw_desc = str(item.get("description", "")).strip().replace('"', "'")

        macro_name = re.sub(r"[^A-Za-z0-9_]", "_", raw_net).upper().strip("_")
        if not macro_name or macro_name[0].isdigit():
            macro_name = f"NET_{macro_name}"
        if macro_name in used_macros:
            macro_name = f"{macro_name}_{idx}"
        used_macros.add(macro_name)

        # 解析类似 PA0 / PB12 的 Port 与 Pin 编号
        m_gpio = re.match(r"^P([A-I])(\d{1,2})$", raw_pin.upper())
        port_str = f"GPIO{m_gpio.group(1)}" if m_gpio else "SYS_PORT"
        pin_num = int(m_gpio.group(2)) if m_gpio else idx

        lines.append(f"/* [{raw_pin}] {raw_net} : {raw_desc} ({raw_func}) */")
        lines.append(f'#define PIN_{macro_name}_NAME          "{raw_pin}"')
        lines.append(f'#define PIN_{macro_name}_PORT_NAME     "{port_str}"')
        lines.append(f"#define PIN_{macro_name}_PIN_INDEX     ({pin_num}U)")
        lines.append(f"#define PIN_{macro_name}_BIT_MASK      (1UL << {pin_num}U)")
        lines.append(f'#define PIN_{macro_name}_ALT_FUNC      "{raw_func}"')
        lines.append("")

        struct_initializers.append(
            f'    {{ "{raw_pin}", "{port_str}", {pin_num}U, "{raw_net}", "{raw_func}", "{raw_desc}" }}'
        )

    lines.extend([
        "/* ========================================================================== */",
        "/* 2. 引脚描述符结构体与静态只读映射表                                          */",
        "/* ========================================================================== */",
        "typedef struct {",
        "    const char *pin_name;",
        "    const char *port_name;",
        "    uint8_t     pin_index;",
        "    const char *net_name;",
        "    const char *alt_function;",
        "    const char *description;",
        "} bsp_pin_descriptor_t;",
        "",
        "static const bsp_pin_descriptor_t g_bsp_pinout_table[BSP_ASSIGNED_PIN_COUNT > 0 ? BSP_ASSIGNED_PIN_COUNT : 1] = {",
    ])

    if struct_initializers:
        lines.append(",\n".join(struct_initializers))
    else:
        lines.append('    { "NONE", "NONE", 0U, "NONE", "NONE", "Empty Pinout" }')

    lines.extend([
        "};",
        "",
        "#ifdef __cplusplus",
        "}",
        "#endif",
        "",
        "#endif /* __BSP_PINOUT_H__ */",
        ""
    ])

    return "\n".join(lines)


def sync_project_bsp_header(project_dir: str) -> Optional[str]:
    """读取项目下的 spec.json 与 pinout.json 并自动同步写入 firmware/Drivers/bsp_pinout.h"""
    if not os.path.exists(project_dir):
        return None
    spec_file = os.path.join(project_dir, "spec.json")
    pinout_file = os.path.join(project_dir, "pinout.json")

    spec = {}
    pinout = []
    if os.path.exists(spec_file):
        try:
            with open(spec_file, "r", encoding="utf8") as f:
                spec = json.load(f)
        except Exception:
            pass
    if os.path.exists(pinout_file):
        try:
            with open(pinout_file, "r", encoding="utf8") as f:
                pinout = json.load(f)
        except Exception:
            pass

    if not spec and not pinout:
        return None

    header_code = generate_bsp_pinout_header(spec, pinout)
    drivers_dir = os.path.join(project_dir, "firmware", "Drivers")
    os.makedirs(drivers_dir, exist_ok=True)
    header_path = os.path.join(drivers_dir, "bsp_pinout.h")
    with open(header_path, "w", encoding="utf8") as f:
        f.write(header_code)
    return header_path


def save_project_ssot(project_dir: str, spec: Dict[str, Any], pinout: List[Dict[str, Any]]) -> Dict[str, Any]:
    """将更新后的 spec.json 与 pinout.json 写入工程目录，并同步刷新 bsp_pinout.h"""
    if not project_dir or not os.path.exists(project_dir):
        return {"success": False, "error": f"工程目录不存在: {project_dir}"}
    spec_file = os.path.join(project_dir, "spec.json")
    pinout_file = os.path.join(project_dir, "pinout.json")
    with open(spec_file, "w", encoding="utf8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)
    with open(pinout_file, "w", encoding="utf8") as f:
        json.dump(pinout, f, indent=2, ensure_ascii=False)
    header_path = sync_project_bsp_header(project_dir)
    return {"success": True, "spec_file": spec_file, "pinout_file": pinout_file, "bsp_header": header_path}


def _load_registry() -> List[str]:
    _ensure_lab7_ssot_files()
    os.makedirs(CONFIG_DIR, exist_ok=True)
    seed_dirs = [
        "/Users/zhenxian/Documents/XXG/Xter/projects/night-verson-goggle",
        "/Users/zhenxian/Documents/XXG/Xter/projects/night-verson-goggle/smart-env-alarm-01",
        "/Users/zhenxian/Documents/XXG/Xter/projects/test-nir-goggle"
    ]
    registered = []
    if os.path.exists(REGISTRY_FILE):
        try:
            with open(REGISTRY_FILE, "r", encoding="utf8") as f:
                registered = json.load(f)
        except Exception:
            registered = []

    for d in seed_dirs:
        if os.path.exists(d) and d not in registered:
            registered.append(d)

    # 扫描同级目录下带有 spec.json 或 hardware/*.kicad_pcb 的项目
    parent_root = os.path.dirname(PLATFORM_ROOT)
    if os.path.exists(parent_root):
        for entry in os.listdir(parent_root):
            full_p = os.path.join(parent_root, entry)
            if full_p == PLATFORM_ROOT or not os.path.isdir(full_p):
                continue
            if os.path.exists(os.path.join(full_p, "spec.json")) or glob.glob(os.path.join(full_p, "hardware", "*.kicad_pcb")):
                if full_p not in registered:
                    registered.append(full_p)

    valid_dirs = [p for p in registered if os.path.isdir(p)]
    with open(REGISTRY_FILE, "w", encoding="utf8") as f:
        json.dump(valid_dirs, f, indent=2, ensure_ascii=False)
    return valid_dirs


def register_project_dir(project_dir: str):
    dirs = _load_registry()
    abs_p = os.path.abspath(project_dir)
    if abs_p not in dirs and os.path.isdir(abs_p):
        dirs.insert(0, abs_p)
        with open(REGISTRY_FILE, "w", encoding="utf8") as f:
            json.dump(dirs, f, indent=2, ensure_ascii=False)


def list_projects() -> Dict[str, Any]:
    """列出所有受管工程及当前激活工程"""
    dirs = _load_registry()
    settings = load_settings()
    active_dir = settings.get("workspace", {}).get("active_project_dir", "")
    if not active_dir or not os.path.exists(active_dir):
        active_dir = dirs[0] if dirs else ""

    projects = []
    for d in dirs:
        spec_file = os.path.join(d, "spec.json")
        pinout_file = os.path.join(d, "pinout.json")
        spec = {}
        pinout = []
        if os.path.exists(spec_file):
            try:
                with open(spec_file, "r", encoding="utf8") as f:
                    spec = json.load(f)
            except Exception:
                pass
        if os.path.exists(pinout_file):
            try:
                with open(pinout_file, "r", encoding="utf8") as f:
                    pinout = json.load(f)
            except Exception:
                pass

        pcb_files = sorted(glob.glob(os.path.join(d, "hardware", "*.kicad_pcb")))
        sch_files = sorted(glob.glob(os.path.join(d, "hardware", "*.kicad_sch")))
        fw_files = sorted(
            glob.glob(os.path.join(d, "firmware", "**", "*.c"), recursive=True)
            + glob.glob(os.path.join(d, "firmware", "**", "*.h"), recursive=True)
        )

        mech = spec.get("mechanical", {})
        mcu = spec.get("mcu", {})
        projects.append({
            "project_dir": d,
            "folder_name": os.path.basename(d),
            "project_name": spec.get("project_name") or os.path.basename(d),
            "summary": spec.get("project_summary", ""),
            "mcu": mcu.get("model") or mcu.get("family") or "未指定",
            "dimensions": f"{mech.get('width_mm', '-')}x{mech.get('height_mm', '-')}mm ({mech.get('layers', 2)}L)",
            "pin_count": len(pinout),
            "has_pcb": len(pcb_files) > 0,
            "pcb_count": len(pcb_files),
            "has_sch": len(sch_files) > 0,
            "has_firmware": len(fw_files) > 0,
            "fw_files_count": len(fw_files),
            "is_active": os.path.abspath(d) == os.path.abspath(active_dir)
        })

    return {
        "active_project_dir": active_dir,
        "projects": projects
    }


def get_project_details(project_dir: Optional[str] = None) -> Dict[str, Any]:
    """获取指定工程的完整软硬件详情（SSOT、PCB、3D图、DRC、BOM、固件文件树）"""
    _ensure_lab7_ssot_files()
    settings = load_settings()
    if not project_dir:
        project_dir = settings.get("workspace", {}).get("active_project_dir")
    if not project_dir or not os.path.exists(project_dir):
        dirs = _load_registry()
        project_dir = dirs[0] if dirs else ""

    if not project_dir or not os.path.exists(project_dir):
        raise FileNotFoundError("未找到有效的工程目录")

    # 确保同步生成 bsp_pinout.h
    sync_project_bsp_header(project_dir)

    spec_file = os.path.join(project_dir, "spec.json")
    pinout_file = os.path.join(project_dir, "pinout.json")
    spec = {}
    pinout = []
    if os.path.exists(spec_file):
        try:
            with open(spec_file, "r", encoding="utf8") as f:
                spec = json.load(f)
        except Exception:
            pass
    if os.path.exists(pinout_file):
        try:
            with open(pinout_file, "r", encoding="utf8") as f:
                pinout = json.load(f)
        except Exception:
            pass

    mcu_str = (spec.get("mcu", {}) or {}).get("model") or (spec.get("mcu", {}) or {}).get("family") or ""
    pinout_validation = validate_pinout_matrix(pinout, mcu_str)
    bsp_header_code = generate_bsp_pinout_header(spec, pinout)

    hw_dir = os.path.join(project_dir, "hardware")
    out_dir = os.path.join(hw_dir, "out")
    pcb_files = sorted(glob.glob(os.path.join(hw_dir, "*.kicad_pcb")))
    # 优先将主文件 LAB7.kicad_pcb 或与工程同名文件排在第一位
    pcb_files.sort(key=lambda p: (0 if "test" not in os.path.basename(p).lower() else 1, os.path.basename(p)))
    sch_files = sorted(glob.glob(os.path.join(hw_dir, "*.kicad_sch")))

    # 查找 3D 渲染图
    top_img = None
    bot_img = None
    for cand in (
        glob.glob(os.path.join(out_dir, "*top*.png"))
        + glob.glob(os.path.join(hw_dir, "*top*.png"))
    ):
        top_img = cand
        break
    for cand in (
        glob.glob(os.path.join(out_dir, "*bottom*.png"))
        + glob.glob(os.path.join(hw_dir, "*bottom*.png"))
    ):
        bot_img = cand
        break

    # 查找最新 DRC 结果
    drc_data = None
    for drc_cand in [
        os.path.join(out_dir, "drc.json"),
        os.path.join(hw_dir, "drc_chamfer.json"),
        os.path.join(hw_dir, "drc.json"),
        os.path.join(project_dir, "LAB7-drc.json")
    ]:
        if os.path.exists(drc_cand):
            try:
                with open(drc_cand, "r", encoding="utf8") as f:
                    raw_drc = json.load(f)
                drc_data = {
                    "file": drc_cand,
                    "violations_count": len(raw_drc.get("violations", [])),
                    "unconnected_count": len(raw_drc.get("unconnected_items", [])),
                    "violations": raw_drc.get("violations", [])[:25],
                    "unconnected": raw_drc.get("unconnected_items", [])[:25]
                }
                break
            except Exception:
                pass

    # 查找 BOM CSV (优先常规 *-bom.csv，同时检测嘉立创 *_JLC_BOM.csv 与 *_JLC_CPL.csv)
    from core.scaffold_generator import match_lcsc_part, analyze_jlcpcb_dfm_and_cost, render_project_2d_svg
    bom_overrides = spec.get("bom_overrides", {})
    bom_rows = []
    bom_file = None
    for b_cand in (
        glob.glob(os.path.join(out_dir, "*-bom.csv"))
        + glob.glob(os.path.join(out_dir, "*bom*.csv"))
        + glob.glob(os.path.join(hw_dir, "*BOM*.csv"))
        + glob.glob(os.path.join(hw_dir, "*bom*.csv"))
    ):
        bom_file = b_cand
        try:
            with open(b_cand, "r", encoding="utf8", errors="ignore") as bf:
                reader = csv.DictReader(bf)
                for row in reader:
                    d_row = dict(row)
                    ref = d_row.get("Reference") or d_row.get("Ref") or d_row.get("Designator") or ""
                    val = d_row.get("Value") or d_row.get("Comment") or ""
                    fp = d_row.get("Footprint") or d_row.get("Package") or ""
                    ov = bom_overrides.get(ref, {})
                    if ov.get("Value"):
                        val = ov["Value"]
                        d_row["Value"] = val
                    lcsc_info = match_lcsc_part(ref, val, fp)
                    if ov.get("LCSC"):
                        d_row["LCSC"] = ov["LCSC"]
                    elif not d_row.get("LCSC") and not d_row.get("LCSC Part #"):
                        d_row["LCSC"] = lcsc_info["lcsc"]
                    else:
                        d_row["LCSC"] = d_row.get("LCSC") or d_row.get("LCSC Part #")
                    if ov.get("LibraryType"):
                        d_row["LibraryType"] = ov["LibraryType"]
                    elif not d_row.get("LibraryType") and not d_row.get("Library Type"):
                        d_row["LibraryType"] = lcsc_info["lib_type"]
                    else:
                        d_row["LibraryType"] = d_row.get("LibraryType") or d_row.get("Library Type")
                    bom_rows.append(d_row)
            break
        except Exception:
            pass

    jlc_bom_cands = sorted(glob.glob(os.path.join(out_dir, "*_JLC_BOM.csv")))
    jlc_cpl_cands = sorted(glob.glob(os.path.join(out_dir, "*_JLC_CPL.csv")) + glob.glob(os.path.join(out_dir, "*-pos.csv")))
    jlc_bom_file = jlc_bom_cands[0] if jlc_bom_cands else ""
    jlc_cpl_file = jlc_cpl_cands[0] if jlc_cpl_cands else ""

    # 查找 Gerber ZIP 与 EasyEDA Pro 工程包
    gerber_zip = None
    easyeda_zip = ""
    for z_cand in sorted(glob.glob(os.path.join(out_dir, "*.zip")) + glob.glob(os.path.join(hw_dir, "*.zip"))):
        bname_z = os.path.basename(z_cand)
        if "EasyEDA_Pro" in bname_z:
            easyeda_zip = z_cand
        elif "Full_Release_Bundle" not in bname_z and not gerber_zip:
            gerber_zip = z_cand

    # 查找 2D PCB 铜皮走线 SVG 与 2D 原理图 SVG (若存在 PCB 但尚未导出 SVG，则静默生成一次)
    pcb_svg_path = os.path.join(out_dir, "render_2d_pcb.svg")
    sch_svg_path = os.path.join(out_dir, "render_2d_sch.svg")
    if pcb_files and not os.path.exists(pcb_svg_path):
        try:
            render_project_2d_svg(project_dir, pcb_path=pcb_files[0], sch_path=sch_files[0] if sch_files else None)
        except Exception:
            pass
    pcb_2d_svg = pcb_svg_path if os.path.exists(pcb_svg_path) else ""
    sch_2d_svg = sch_svg_path if os.path.exists(sch_svg_path) else ""

    # 嘉立创 DFM 与基础库/扩展库费用体检
    jlc_dfm = analyze_jlcpcb_dfm_and_cost(project_dir, pcb_path=pcb_files[0] if pcb_files else None)

    # 查找固件源码文件及构建产物内存统计
    fw_dir = os.path.join(project_dir, "firmware")
    fw_files = []
    if os.path.exists(fw_dir):
        for root, _, files in os.walk(fw_dir):
            if "build" in root.split(os.sep):
                continue
            for fn in sorted(files):
                if fn.endswith((".c", ".h", ".s", "Makefile", "CMakeLists.txt", ".ld")):
                    full_fn = os.path.join(root, fn)
                    rel_fn = os.path.relpath(full_fn, project_dir)
                    fw_files.append({
                        "name": fn,
                        "rel_path": rel_fn,
                        "abs_path": full_fn,
                        "size_bytes": os.path.getsize(full_fn)
                    })

    # 读取已有 ELF / HEX / BIN 烧录固件及内存占用快照
    memory_usage = None
    fw_binaries = {"elf": "", "hex": "", "bin": ""}
    mcu_prof = match_mcu_profile(mcu_str)
    size_exe = shutil.which("arm-none-eabi-size")
    if os.path.exists(fw_dir):
        elf_cands = sorted(glob.glob(os.path.join(fw_dir, "**", "*.elf"), recursive=True))
        hex_cands = sorted(glob.glob(os.path.join(fw_dir, "**", "*.hex"), recursive=True))
        bin_cands = sorted(glob.glob(os.path.join(fw_dir, "**", "*.bin"), recursive=True))
        if elf_cands:
            fw_binaries["elf"] = elf_cands[0]
        if hex_cands:
            fw_binaries["hex"] = hex_cands[0]
        if bin_cands:
            fw_binaries["bin"] = bin_cands[0]

    if os.path.exists(fw_dir) and size_exe:
        elf_cands = glob.glob(os.path.join(fw_dir, "**", "*.elf"), recursive=True)
        obj_cands = glob.glob(os.path.join(fw_dir, "build", "*.o"))
        if elf_cands:
            res_sz = subprocess.run([size_exe, elf_cands[0]], capture_output=True, text=True, timeout=5)
            lines = res_sz.stdout.strip().splitlines() if res_sz.returncode == 0 else []
            if len(lines) >= 2 and len(lines[1].split()) >= 4:
                p = lines[1].split()
                tb, db, bb = int(p[0]), int(p[1]), int(p[2])
                ft = int(mcu_prof.get("flash_kb", 32)) * 1024
                rt = int(mcu_prof.get("ram_kb", 8)) * 1024
                memory_usage = {
                    "elf_name": os.path.basename(elf_cands[0]),
                    "elf_file": fw_binaries["elf"],
                    "hex_file": fw_binaries["hex"],
                    "bin_file": fw_binaries["bin"],
                    "mcu_id": mcu_prof["id"],
                    "text_bytes": tb,
                    "data_bytes": db,
                    "bss_bytes": bb,
                    "flash_used_bytes": tb + db,
                    "flash_total_bytes": ft,
                    "flash_pct": round((tb + db) * 100.0 / max(1, ft), 2),
                    "ram_used_bytes": db + bb,
                    "ram_total_bytes": rt,
                    "ram_pct": round((db + bb) * 100.0 / max(1, rt), 2)
                }
        elif obj_cands:
            res_sz = subprocess.run([size_exe, "-t"] + obj_cands, capture_output=True, text=True, timeout=5)
            lines = res_sz.stdout.strip().splitlines() if res_sz.returncode == 0 else []
            if len(lines) >= 2 and len(lines[-1].split()) >= 4 and lines[-1].split()[0].isdigit():
                p = lines[-1].split()
                tb, db, bb = int(p[0]), int(p[1]), int(p[2])
                ft = int(mcu_prof.get("flash_kb", 32)) * 1024
                rt = int(mcu_prof.get("ram_kb", 8)) * 1024
                memory_usage = {
                    "elf_name": f"{len(obj_cands)} object files (.o)",
                    "elf_file": fw_binaries["elf"],
                    "hex_file": fw_binaries["hex"],
                    "bin_file": fw_binaries["bin"],
                    "mcu_id": mcu_prof["id"],
                    "text_bytes": tb,
                    "data_bytes": db,
                    "bss_bytes": bb,
                    "flash_used_bytes": tb + db,
                    "flash_total_bytes": ft,
                    "flash_pct": round((tb + db) * 100.0 / max(1, ft), 2),
                    "ram_used_bytes": db + bb,
                    "ram_total_bytes": rt,
                    "ram_pct": round((db + bb) * 100.0 / max(1, rt), 2)
                }

    report_md = ""
    report_file = os.path.join(project_dir, "docs", "PIPELINE_DELIVERY_REPORT.md")
    if os.path.exists(report_file):
        try:
            with open(report_file, "r", encoding="utf8", errors="ignore") as rf:
                report_md = rf.read()
        except Exception:
            pass

    bundle_cands = sorted(glob.glob(os.path.join(out_dir, "*_Full_Release_Bundle.zip")))
    release_bundle = bundle_cands[0] if bundle_cands else ""

    # 扫描 C 源码中对 SSOT 引脚宏 (bsp_pinout.h) 的覆盖率
    pin_coverage = analyze_firmware_pin_coverage(project_dir, pinout, fw_files)

    # 检测跨模块协同状态 (SSOT pinout.json / spec.json 是否比 PCB 或 ELF 更新)
    pinout_mtime = os.path.getmtime(pinout_file) if os.path.exists(pinout_file) else 0
    pcb_mtime = os.path.getmtime(pcb_files[0]) if pcb_files and os.path.exists(pcb_files[0]) else 0
    elf_mtime = os.path.getmtime(fw_binaries["elf"]) if fw_binaries.get("elf") and os.path.exists(fw_binaries["elf"]) else 0
    cross_module_sync = {
        "pinout_mtime": round(pinout_mtime, 1),
        "pcb_mtime": round(pcb_mtime, 1),
        "elf_mtime": round(elf_mtime, 1),
        "pcb_needs_sync": bool(pinout_mtime > 0 and pcb_mtime > 0 and (pinout_mtime - pcb_mtime > 2.0)),
        "fw_needs_sync": bool(pinout_mtime > 0 and elf_mtime > 0 and (pinout_mtime - elf_mtime > 2.0)) or (pin_coverage.get("uncovered_count", 0) > 0)
    }

    # 构建 VS Code Explorer 风格工程文件树 (explorer_tree)
    explorer_tree = [
        {
            "group": "ssot",
            "title": "SSOT 规格与引脚契约",
            "files": [
                {"name": "spec.json", "rel_path": "spec.json", "abs_path": spec_file, "kind": "ssot_spec", "exists": os.path.exists(spec_file)},
                {"name": "pinout.json", "rel_path": "pinout.json", "abs_path": pinout_file, "kind": "ssot_pinout", "exists": os.path.exists(pinout_file)},
            ]
        },
        {
            "group": "hardware",
            "title": "hardware (KiCad & 2D/3D)",
            "files": (
                [{"name": os.path.basename(p), "rel_path": os.path.relpath(p, project_dir), "abs_path": p, "kind": "pcb_board", "exists": True} for p in pcb_files]
                + [{"name": os.path.basename(s), "rel_path": os.path.relpath(s, project_dir), "abs_path": s, "kind": "sch_sheet", "exists": True} for s in sch_files]
                + ([{"name": "render_2d_pcb.svg", "rel_path": "hardware/out/render_2d_pcb.svg", "abs_path": pcb_2d_svg, "kind": "pcb_2d_svg", "exists": True}] if pcb_2d_svg else [])
                + ([{"name": "render_2d_sch.svg", "rel_path": "hardware/out/render_2d_sch.svg", "abs_path": sch_2d_svg, "kind": "sch_2d_svg", "exists": True}] if sch_2d_svg else [])
            )
        },
        {
            "group": "production",
            "title": "production (嘉立创 BOM/Gerber)",
            "files": (
                ([{"name": os.path.basename(jlc_bom_file), "rel_path": os.path.relpath(jlc_bom_file, project_dir), "abs_path": jlc_bom_file, "kind": "jlc_bom", "exists": True}] if jlc_bom_file else [])
                + ([{"name": os.path.basename(jlc_cpl_file), "rel_path": os.path.relpath(jlc_cpl_file, project_dir), "abs_path": jlc_cpl_file, "kind": "jlc_cpl", "exists": True}] if jlc_cpl_file else [])
                + ([{"name": os.path.basename(gerber_zip), "rel_path": os.path.relpath(gerber_zip, project_dir), "abs_path": gerber_zip, "kind": "gerber_zip", "exists": True}] if gerber_zip else [])
            )
        },
        {
            "group": "firmware",
            "title": "firmware (C99 & ARM-GCC)",
            "files": [
                {"name": f["name"], "rel_path": f["rel_path"], "abs_path": f["abs_path"], "kind": "fw_source", "size_bytes": f.get("size_bytes", 0), "exists": True}
                for f in fw_files
            ]
        },
        {
            "group": "docs",
            "title": "docs (交付验收报告)",
            "files": (
                [{"name": "PIPELINE_DELIVERY_REPORT.md", "rel_path": "docs/PIPELINE_DELIVERY_REPORT.md", "abs_path": report_file, "kind": "delivery_report", "exists": True}]
                if os.path.exists(report_file) else []
            )
        }
    ]

    # 构建 VS Code PROBLEMS 面板统一诊断列表 (unified_diagnostics)
    unified_diagnostics = []
    for err_msg in pinout_validation.get("errors", []):
        unified_diagnostics.append({
            "severity": "error",
            "source": "SSOT PinMux",
            "file": "pinout.json",
            "line": 1,
            "message": str(err_msg),
            "target_tab": "intake"
        })
    for warn_msg in pinout_validation.get("warnings", []):
        unified_diagnostics.append({
            "severity": "warning",
            "source": "SSOT PinMux",
            "file": "pinout.json",
            "line": 1,
            "message": str(warn_msg),
            "target_tab": "intake"
        })
    if drc_data:
        for v in drc_data.get("violations", [])[:15]:
            unified_diagnostics.append({
                "severity": "error" if v.get("severity") == "error" else "warning",
                "source": "KiCad DRC",
                "file": os.path.basename(pcb_files[0]) if pcb_files else "board.kicad_pcb",
                "line": 1,
                "message": f"[{v.get('type', 'drc')}] {v.get('description', 'DRC violation')}",
                "target_tab": "pcb",
                "quick_fix_prompt": f"请自动修复 PCB DRC 违规：{v.get('type', '')} - {v.get('description', '')}"
            })
        for u in drc_data.get("unconnected", [])[:10]:
            unified_diagnostics.append({
                "severity": "error",
                "source": "KiCad Unconnected",
                "file": os.path.basename(pcb_files[0]) if pcb_files else "board.kicad_pcb",
                "line": 1,
                "message": f"[unconnected] {u.get('description', '未连接飞线')}",
                "target_tab": "pcb",
                "quick_fix_prompt": "请自动修复 PCB 中所有未连接的飞线 (Unconnected Items) 并重跑 DRC"
            })
    for item in pin_coverage.get("items", []):
        if not item.get("covered"):
            unified_diagnostics.append({
                "severity": "info",
                "source": "Pin Coverage",
                "file": "firmware/App/app_state_machine.c",
                "line": 1,
                "message": f"引脚 [{item.get('pin')}] {item.get('net_name')} ({item.get('macro')}) 尚未在 C 固件应用层被调用",
                "target_tab": "firmware",
                "quick_fix_prompt": f"请在 C 固件状态机中补全引脚 {item.get('pin')} ({item.get('macro')}) 的外设驱动逻辑并重编译"
            })

    return {
        "project_dir": project_dir,
        "project_name": spec.get("project_name") or os.path.basename(project_dir),
        "spec": spec,
        "pinout": pinout,
        "pinout_validation": pinout_validation,
        "bsp_header_code": bsp_header_code,
        "delivery_report": report_md,
        "release_bundle": release_bundle,
        "cross_module_sync": cross_module_sync,
        "explorer_tree": explorer_tree,
        "unified_diagnostics": unified_diagnostics,
        "hardware": {
            "pcb_files": pcb_files,
            "primary_pcb": pcb_files[0] if pcb_files else "",
            "sch_files": sch_files,
            "primary_sch": sch_files[0] if sch_files else "",
            "top_3d_img": top_img or "",
            "bottom_3d_img": bot_img or "",
            "pcb_2d_svg": pcb_2d_svg,
            "sch_2d_svg": sch_2d_svg,
            "drc": drc_data,
            "bom_file": bom_file or "",
            "bom_rows": bom_rows,
            "jlc_bom_file": jlc_bom_file,
            "jlc_cpl_file": jlc_cpl_file,
            "jlc_dfm": jlc_dfm,
            "gerber_zip": gerber_zip or "",
            "easyeda_zip": easyeda_zip
        },
        "firmware": {
            "has_makefile": os.path.exists(os.path.join(fw_dir, "Makefile")),
            "has_cmake": os.path.exists(os.path.join(fw_dir, "CMakeLists.txt")),
            "files": fw_files,
            "binaries": fw_binaries,
            "memory_usage": memory_usage,
            "pin_coverage": pin_coverage
        }
    }


def analyze_firmware_pin_coverage(project_dir: str, pinout: List[Dict[str, Any]], fw_files: List[Dict[str, Any]]) -> Dict[str, Any]:
    """扫描固件 C/H 源码对 SSOT 引脚定义 (bsp_pinout.h) 的驱动覆盖情况"""
    code_blobs: Dict[str, str] = {}
    for f in fw_files:
        name = f.get("name", "")
        if name == "bsp_pinout.h" or not name.endswith((".c", ".h")):
            continue
        ap = f.get("abs_path", "")
        if ap and os.path.exists(ap):
            try:
                with open(ap, "r", encoding="utf8", errors="ignore") as rf:
                    code_blobs[f.get("rel_path", name)] = rf.read()
            except Exception:
                pass

    items = []
    covered_count = 0
    uncovered_count = 0
    used_macros = set()

    for idx, p in enumerate(pinout):
        raw_pin = str(p.get("pin") or p.get("mcu_pin") or f"PIN_{idx}").strip()
        raw_net = str(p.get("net_name", f"SIG_{idx}")).strip()
        raw_func = str(p.get("function") or p.get("type_or_func") or "GPIO").strip()
        raw_desc = str(p.get("description") or p.get("notes") or "").strip()

        macro_name = re.sub(r"[^A-Za-z0-9_]", "_", raw_net).upper().strip("_")
        if not macro_name or macro_name[0].isdigit():
            macro_name = f"NET_{macro_name}"
        if macro_name in used_macros:
            macro_name = f"{macro_name}_{idx}"
        used_macros.add(macro_name)

        macro_prefix = f"PIN_{macro_name}_"
        is_sys = raw_net.upper() in ("SWDIO", "SWCLK", "NRST", "GND", "VCC", "+3V3") or raw_func.upper().startswith("SYS_")

        matched_files = []
        for rel_p, txt in code_blobs.items():
            if (macro_prefix in txt) or (raw_net in txt) or (f'"{raw_pin}"' in txt):
                matched_files.append(os.path.basename(rel_p))

        covered = len(matched_files) > 0 or is_sys
        if covered:
            covered_count += 1
        else:
            uncovered_count += 1

        items.append({
            "pin": raw_pin,
            "net_name": raw_net,
            "function": raw_func,
            "description": raw_desc,
            "macro_prefix": macro_prefix,
            "macro_index": f"PIN_{macro_name}_PIN_INDEX",
            "is_system": is_sys,
            "covered": covered,
            "used_in_files": matched_files
        })

    total = len(items)
    pct = round(covered_count * 100.0 / max(1, total), 1) if total > 0 else 100.0
    return {
        "total_pins": total,
        "covered_count": covered_count,
        "uncovered_count": uncovered_count,
        "coverage_pct": pct,
        "items": items
    }


def render_project_3d(project_dir: str, pcb_path: Optional[str] = None) -> Dict[str, Any]:
    """调用 kicad-cli pcb render 动态生成当前项目的 Top / Bottom 3D 渲染图"""
    if not pcb_path:
        pcb_files = sorted(glob.glob(os.path.join(project_dir, "hardware", "*.kicad_pcb")))
        pcb_files.sort(key=lambda p: (0 if "test" not in os.path.basename(p).lower() else 1, os.path.basename(p)))
        if not pcb_files:
            return {"success": False, "error": f"工程 {project_dir}/hardware 下未找到 .kicad_pcb 文件，请先调度 Agent 生成 PCB。"}
        pcb_path = pcb_files[0]

    if not os.path.exists(pcb_path):
        return {"success": False, "error": f"PCB 文件不存在: {pcb_path}"}

    exe = shutil.which("kicad-cli") or "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"
    if not os.path.exists(exe):
        return {"success": False, "error": "未找到 kicad-cli 可执行文件"}

    out_dir = os.path.join(project_dir, "hardware", "out")
    os.makedirs(out_dir, exist_ok=True)
    top_out = os.path.join(out_dir, "render_3d_top.png")
    bot_out = os.path.join(out_dir, "render_3d_bottom.png")

    t0 = time.time()
    cmd_top = [exe, "pcb", "render", "--side", "top", "-w", "1280", "-h", "800", "--quality", "basic", "-o", top_out, pcb_path]
    cmd_bot = [exe, "pcb", "render", "--side", "bottom", "-w", "1280", "-h", "800", "--quality", "basic", "-o", bot_out, pcb_path]

    res_top = subprocess.run(cmd_top, capture_output=True, text=True, timeout=60)
    res_bot = subprocess.run(cmd_bot, capture_output=True, text=True, timeout=60)
    elapsed = round(time.time() - t0, 2)

    if res_top.returncode == 0 and os.path.exists(top_out):
        return {
            "success": True,
            "pcb_path": pcb_path,
            "top_3d_img": top_out,
            "bottom_3d_img": bot_out if os.path.exists(bot_out) else "",
            "elapsed_sec": elapsed
        }
    return {
        "success": False,
        "error": (res_top.stderr or res_top.stdout or "渲染失败").strip()
    }


def verify_project_firmware(project_dir: str) -> Dict[str, Any]:
    """对工程的 firmware/ 目录执行 GCC 交叉编译、ELF 链接与 Flash/RAM 尺寸统计"""
    from core.scaffold_generator import compile_firmware_to_elf
    return compile_firmware_to_elf(project_dir)


def save_project_source_file(
    path: str,
    content: str,
    project_dir: Optional[str] = None,
    auto_compile: bool = False
) -> Dict[str, Any]:
    """保存用户在浏览器代码编辑器中修改的固件源码文件，可选立即触发交叉编译验证"""
    if not path:
        return {"success": False, "error": "未指定需要保存的源文件路径"}
    abs_path = os.path.abspath(path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    try:
        with open(abs_path, "w", encoding="utf8") as f:
            f.write(content)
    except Exception as e:
        return {"success": False, "error": f"写入文件失败: {e}"}

    if not project_dir:
        settings = load_settings()
        project_dir = settings.get("workspace", {}).get("active_project_dir", "")

    build_res = None
    if auto_compile and project_dir and os.path.exists(project_dir):
        build_res = verify_project_firmware(project_dir)

    return {
        "success": True,
        "path": abs_path,
        "name": os.path.basename(abs_path),
        "size_bytes": os.path.getsize(abs_path),
        "build": build_res,
        "compile": build_res,
        "detail": get_project_details(project_dir) if project_dir and os.path.exists(project_dir) else None
    }


def open_local_desktop_tool(
    project_dir: str,
    action: str = "finder",
    target_path: Optional[str] = None
) -> Dict[str, Any]:
    """一键在宿主机打开 Finder、KiCad PCB 编辑器或 VS Code"""
    if not project_dir or not os.path.exists(project_dir):
        return {"success": False, "error": f"工程目录不存在: {project_dir}"}

    act = (action or "finder").lower().strip()
    try:
        if act == "finder":
            p = target_path if (target_path and os.path.exists(target_path)) else project_dir
            subprocess.Popen(["open", p])
            return {"success": True, "action": "finder", "path": p, "message": f"已在 Finder 中打开目录: {os.path.basename(p)}"}

        elif act == "kicad":
            pcb_path = target_path
            if not pcb_path or not os.path.exists(pcb_path):
                pcbs = sorted(glob.glob(os.path.join(project_dir, "hardware", "*.kicad_pcb")))
                pcbs.sort(key=lambda x: (0 if "test" not in os.path.basename(x).lower() else 1, os.path.basename(x)))
                pcb_path = pcbs[0] if pcbs else ""
            if not pcb_path or not os.path.exists(pcb_path):
                return {"success": False, "error": "当前工程尚未生成 .kicad_pcb 文件，请先生成硬件工程或运行协同流水线"}
            if os.path.exists("/Applications/KiCad/KiCad.app"):
                subprocess.Popen(["open", "-a", "/Applications/KiCad/KiCad.app", pcb_path])
            else:
                subprocess.Popen(["open", pcb_path])
            return {"success": True, "action": "kicad", "path": pcb_path, "message": f"已调用桌面 KiCad 打开: {os.path.basename(pcb_path)}"}

        elif act == "vscode":
            code_exe = shutil.which("code")
            if code_exe:
                subprocess.Popen([code_exe, project_dir])
            elif os.path.exists("/Applications/Visual Studio Code.app"):
                subprocess.Popen(["open", "-a", "Visual Studio Code", project_dir])
            else:
                subprocess.Popen(["open", project_dir])
            return {"success": True, "action": "vscode", "path": project_dir, "message": f"已在 VS Code 中打开工程: {os.path.basename(project_dir)}"}

        elif act == "easyeda":
            from core.scaffold_generator import export_easyeda_pro_package
            res_pkg = export_easyeda_pro_package(project_dir)
            for app_cand in ["/Applications/JLCEDA-Pro.app", "/Applications/EasyEDA-Pro.app"]:
                if os.path.exists(app_cand):
                    subprocess.Popen(["open", "-a", app_cand])
                    return {
                        "success": True,
                        "action": "easyeda",
                        "easyeda_zip": res_pkg.get("easyeda_zip", ""),
                        "message": f"已启动本地嘉立创 EDA 专业版并生成导入包: {os.path.basename(res_pkg.get('easyeda_zip', ''))}"
                    }
            return {
                "success": True,
                "action": "easyeda",
                "easyeda_zip": res_pkg.get("easyeda_zip", ""),
                "editor_url": "https://pro.lceda.cn/editor",
                "message": "已生成嘉立创 EDA 专业版无损导入包 (*_EasyEDA_Pro_Project.zip)，可在嘉立创 EDA 网页端或桌面端【文件 -> 导入 -> KiCad】直接打开！"
            }

        return {"success": False, "error": f"未知的本地打开动作: {act}"}
    except Exception as e:
        return {"success": False, "error": f"启动本地工具失败: {e}"}


def export_all_in_one_bundle(project_dir: str) -> Dict[str, Any]:
    """将工程的 SSOT、KiCad 原理图/PCB、Gerber ZIP、BOM、3D 渲染图、C 固件源码、编译产物 (.elf/.hex/.bin) 及交付报告打包为单一全套交付包"""
    if not project_dir or not os.path.exists(project_dir):
        return {"success": False, "error": f"工程目录不存在: {project_dir}"}

    # 确保同步 bsp_pinout.h
    sync_project_bsp_header(project_dir)

    spec_file = os.path.join(project_dir, "spec.json")
    pname = os.path.basename(project_dir)
    if os.path.exists(spec_file):
        try:
            with open(spec_file, "r", encoding="utf8") as f:
                s = json.load(f)
                pname = s.get("project_name") or pname
        except Exception:
            pass

    safe_name = re.sub(r"[^A-Za-z0-9_-]", "_", pname)
    out_dir = os.path.join(project_dir, "hardware", "out")
    os.makedirs(out_dir, exist_ok=True)
    bundle_path = os.path.join(out_dir, f"{safe_name}_Full_Release_Bundle.zip")

    # 精准收集核心软硬件交付物，避免将无关大文件或子项目打入包内
    candidate_patterns = [
        "spec.json",
        "pinout.json",
        "README.md",
        "docs/PIPELINE_DELIVERY_REPORT.md",
        "docs/CONFIRMED_SPECIFICATION.md",
        "hardware/*.kicad_pcb",
        "hardware/*.kicad_sch",
        "hardware/*.kicad_pro",
        "hardware/*bom*.csv",
        "hardware/*BOM*.csv",
        "hardware/scripts/*.py",
        "hardware/out/*.png",
        "hardware/out/*Gerber*.zip",
        "hardware/out/*bom*.csv",
        "hardware/out/*_JLC_*.csv",
        "hardware/out/*-pos.csv",
        "hardware/out/drc.json",
        "firmware/Makefile",
        "firmware/CMakeLists.txt",
        "firmware/*.ld",
        "firmware/Drivers/*.h",
        "firmware/Drivers/*.c",
        "firmware/App/*.h",
        "firmware/App/*.c",
        "firmware/Inc/*.h",
        "firmware/Src/*.c",
        "firmware/build/*.elf",
        "firmware/build/*.hex",
        "firmware/build/*.bin",
        "firmware/build/*.map"
    ]

    matched_files = []
    seen_abs = set()
    for pat in candidate_patterns:
        for full_p in sorted(glob.glob(os.path.join(project_dir, pat))):
            abs_p = os.path.abspath(full_p)
            if not os.path.isfile(abs_p) or abs_p == os.path.abspath(bundle_path) or abs_p in seen_abs:
                continue
            seen_abs.add(abs_p)
            matched_files.append(abs_p)

    added_files = []
    with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for abs_p in matched_files:
            rel_p = os.path.relpath(abs_p, project_dir)
            zf.write(abs_p, arcname=os.path.join(safe_name, rel_p))
            added_files.append(rel_p)

    size_kb = round(os.path.getsize(bundle_path) / 1024.0, 1) if os.path.exists(bundle_path) else 0.0
    return {
        "success": True,
        "bundle_zip": bundle_path,
        "bundle_name": os.path.basename(bundle_path),
        "size_kb": size_kb,
        "files_count": len(added_files),
        "files": added_files
    }

