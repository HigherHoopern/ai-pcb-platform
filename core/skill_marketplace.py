#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""XterAI-PCB IDE · Skill 插件市场与知识蒸馏管理引擎 (VS Code Extensions Style)

支持能力：
  1. 扫描本地 `skills/` 目录下的所有已安装 Skill 插件（兼容内置蒸馏技能与社区安装技能）
  2. 提供主流 Skill 社区（Skills.sh / GitHub Anthropic Skills / ClawHub / KiCad & STM32 社区）精选市场目录
  3. 支持一键从市场目录安装，或通过 GitHub 仓库 URL / Raw SKILL.md 链接 / `owner/repo` 标识符在线下载安装
  4. 支持 VS Code 插件风格的启用/禁用（Enable/Disable）、卸载（Uninstall）及向 PCB/固件 Copilot 自动注入激活的 Skill 知识上下文
"""

import os
import re
import json
import glob
import time
import shutil
import urllib.request
from typing import Dict, Any, List, Optional

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS_ROOT = os.path.join(PLATFORM_ROOT, "skills")
SKILLS_STATE_FILE = os.path.join(SKILLS_ROOT, "skills_registry_state.json")

# 主流外部 Skill 社区导航站点（供前端快捷跳转与复制链接）
EXTERNAL_SKILL_SITES: List[Dict[str, str]] = [
    {
        "id": "skills_sh",
        "name": "Skills.sh (Open Agent Skills Registry)",
        "url": "https://skills.sh",
        "badge": "官方热门",
        "desc": "全球最大的开放式 Coding Agent Skills 注册中心，支持一键复制仓库标识安装"
    },
    {
        "id": "anthropic_skills",
        "name": "GitHub · Anthropic Official Skills",
        "url": "https://github.com/anthropics/skills",
        "badge": "Claude 官方",
        "desc": "Anthropic 官方维护的 Claude Code / Agent 技能仓库，涵盖工程架构与自动化规范"
    },
    {
        "id": "clawhub",
        "name": "ClawHub / Awesome Agent Skills",
        "url": "https://github.com/topics/agent-skills",
        "badge": "开源社区",
        "desc": "GitHub 开源社区维护的硬件、嵌入式 C、KiCad 与自动化调试 Skill 集合"
    },
    {
        "id": "smithery",
        "name": "Smithery.ai (Agent Skills & MCP Hub)",
        "url": "https://smithery.ai",
        "badge": "工具生态",
        "desc": "主流 AI 代理插件与技能生态市场，提供丰富的开发与硬件辅助规范包"
    }
]

# 内置精选主流社区可一键安装的硬件/嵌入式 Skill 插件市场目录
MARKETPLACE_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "jlcpcb-smt-dfm-pro",
        "title": "嘉立创 PCB/SMT 制造与 DFM 进阶军规",
        "publisher": "JLCPCB-Community / skills.sh",
        "version": "2.4.0",
        "category": "jlc",
        "icon": "fa-solid fa-industry",
        "color": "sky",
        "downloads": "18.4k",
        "stars": "1.2k",
        "source_site": "skills.sh",
        "source_url": "https://skills.sh/jlcpcb/jlcpcb-smt-dfm-pro",
        "tags": ["嘉立创", "DFM", "SMT基础库", "拼板V-Cut"],
        "summary": "涵盖嘉立创 1~6 层板最小线宽线距、过孔塞孔、0402/0603 基础库免换料费选型、Mark 点与工艺边设计规范。",
        "skill_md": """---
name: jlcpcb-smt-dfm-pro
description: 嘉立创 (JLCPCB) PCB 制造与 SMT 贴片可制造性设计 (DFM) 进阶规范与成本优化指南
---

# 嘉立创 PCB/SMT 制造与 DFM 进阶军规 (v2.4.0)

## 1. 核心触发场景
当用户处于 **嘉立创 JLC 贴片制造模式**、要求降低打样/贴片成本、优化 BOM 物料或修复 DFM 告警时自动激活本技能。

## 2. 板框与免费/特价打样线
- **免费/特价区间**：长宽均 `≤ 100mm × 100mm`，层数选择 `2 层` 或 `4 层`，板厚 `1.6mm`（微型穿戴板可选 `1.0mm`）。
- **板边安全间距**：铜皮与走线距离 `Edge.Cuts` 板框线必须 `≥ 0.30mm`（V-Cut 拼板处需 `≥ 0.45mm`）。

## 3. 走线与过孔免加价工艺极限
- **双面板常规线宽/线距**：信号线推荐 `≥ 0.20mm (8mil)`，电源主干线 `≥ 0.50mm (20mil)`，安全间距 `≥ 0.15mm (6mil)`。
- **过孔 (Via) 免加价底线**：双面板机械钻孔内径 `≥ 0.30mm`，外径 `≥ 0.60mm`；四层板内径 `≥ 0.20mm`，外径 `≥ 0.45mm`。

## 4. SMT 贴片基础库 (Basic Library) 降本铁律
- 嘉立创每个**扩展库 (Extended)** 物料收取 `¥20` 换料上机费，而**基础库 (Basic)** 免收换料费。
- 100nF 去耦电容强制优先选用 `C14663` (0603) 或 `C1525` (0402)；10kΩ 上下拉电阻优先选用 `C25804` (0603)。
- LDO 3.3V 稳压优先选用 `AMS1117-3.3 (C6186)` 或低功耗 `XC6206P332MR (C5446)`。
""",
        "cheatsheet_md": """# ⚡ 嘉立创 (JLCPCB) 关键参数速查卡 (Cheatsheet)

| 工艺项 | 推荐设计值 (高良率免加价) | 嘉立创常规极限值 | 加价/风险提示 |
| :--- | :--- | :--- | :--- |
| **板框尺寸** | `≤ 100 × 100 mm` | `400 × 500 mm` | `≤100×100mm` 享免费/特价打样券 |
| **1/2层线宽/线距** | `0.25mm / 0.20mm` | `0.127mm (5mil)` | `< 0.127mm` 良率下降且触发高精密加价 |
| **4层线宽/线距** | `0.15mm / 0.15mm` | `0.09mm (3.5mil)` | JLC7628 叠层 50Ω 单端线宽约 `0.28mm` |
| **机械过孔 (内/外径)** | `0.30mm / 0.60mm` | `0.20mm / 0.45mm` | 双面板 `< 0.30mm` 孔径需额外钻孔费 |
| **SMT 阻容封装** | `0603` (调试友好) / `0402` | `0201` | 优先锁定立创 **Basic 基础库** 免 ¥20/款换料费 |
""",
        "patterns_md": """# 🧩 嘉立创 SMT 贴片黄金设计模式 (Patterns)

## Pattern 1: 零换料费去耦与复位标准电路
- **MCU 电源去耦**：每对 VDD/VSS 引脚旁 `< 2.0mm` 放置 1 颗 `100nF/50V X7R 0603 (C14663, Basic)`，电源入口放置 `10uF 0805 (C15850, Basic)`。
- **NRST 硬件复位**：`10kΩ 0603 (C25804, Basic)` 上拉至 `3V3` + `100nF 0603 (C14663, Basic)` 下拉至 `GND`。

## Pattern 2: 嘉立创 EDA 专业版 / SMT 坐标表防旋转偏移准则
- 二极管、LED、钽电容与 IC 在导出 `JLC_CPL.csv` 时，确保第 1 脚极性丝印圆点朝向与立创商城 3D 预览一致。
"""
    },
    {
        "id": "stm32-hal-ll-driver-expert",
        "title": "STM32 CMSIS / LL / HAL 零警告 C99 驱动专家",
        "publisher": "Embedded-Agent-Skills / GitHub",
        "version": "3.1.0",
        "category": "firmware",
        "icon": "fa-solid fa-microchip",
        "color": "emerald",
        "downloads": "24.1k",
        "stars": "1.9k",
        "source_site": "GitHub",
        "source_url": "https://github.com/anthropics/skills/tree/main/stm32-hal-ll-driver-expert",
        "tags": ["STM32", "C99", "零警告", "非阻塞状态机"],
        "summary": "专为 arm-none-eabi-gcc -Wall -Wextra -ffreestanding 打造，内置按键时间戳消抖、ADC EMA 滤波、PWM 软启动与看门狗安全架构。",
        "skill_md": """---
name: stm32-hal-ll-driver-expert
description: STM32 全系列 (F0/F1/F4/G0/L0/H7) CMSIS 与 C99 裸机非阻塞状态机驱动开发规范
---

# STM32 CMSIS / LL / HAL 零警告 C99 驱动专家 (v3.1.0)

## 1. 铁律约束 (Zero-Warning & SSOT Binding)
1. **100% 绑定 SSOT 引脚宏**：严禁在 `.c` 文件中硬编码 `GPIOA` 或引脚号，必须包含 `"bsp_pinout.h"` 并使用 `PIN_<NET>_PIN_INDEX` 与 `PIN_<NET>_PORT`。
2. **禁止阻塞死循环**：主循环禁止使用 `delay_ms(>5)`，所有按键扫描、传感器采样与报警闪烁必须基于 `BSP_GetTickMs()` 非阻塞时间戳。
3. **GCC `-Wall -Wextra -ffreestanding` 零警告**：所有未使用的静态辅助函数添加 `__attribute__((unused))`，无符号常量统一添加 `U` 后缀。
""",
        "cheatsheet_md": """# ⚡ STM32 C99 驱动开发速查卡 (Cheatsheet)

| 模块 | 推荐算法模式 | 典型参数 | 内存开销 |
| :--- | :--- | :--- | :--- |
| **按键消抖** | 双态时间戳状态机 (`20ms` 稳定确认) | `DEBOUNCE_MS = 20U` | `8 Bytes / Key` |
| **ADC 采样滤波** | 一阶指数滑动平均 (EMA: `y = 3/4*y + 1/4*x`) | 右移位运算替代浮点除法 | `4 Bytes / Ch` |
| **低功耗休眠** | 空闲态执行 `__WFI()` 唤醒中断 | 待机功耗 `< 5uA` | `0 Bytes` |
| **硬件看门狗** | 主状态机每周期末尾喂狗 (`IWDG_Reload`) | 超时窗口 `1000ms` | `0 Bytes` |
""",
        "patterns_md": """# 🧩 经典嵌入式 C99 代码模式 (Patterns)

```c
/* 一阶定点 EMA 滤波（零浮点指令，适配 Cortex-M0/M0+/M3） */
static inline uint16_t adc_ema_filter_u16(uint16_t prev_mv, uint16_t raw_mv) {
    return (uint16_t)(((uint32_t)prev_mv * 3U + (uint32_t)raw_mv) >> 2U);
}

/* 非阻塞 20ms 按键消抖状态判定 */
static inline bool gpio_debounce_falling_edge(bool pin_low, uint32_t now_ms, uint32_t *t_mark, bool *latched) {
    if (pin_low) {
        if (*t_mark == 0U) *t_mark = now_ms;
        else if ((now_ms - *t_mark) >= 20U && !(*latched)) {
            *latched = true;
            return true;
        }
    } else {
        *t_mark = 0U;
        *latched = false;
    }
    return false;
}
```
"""
    },
    {
        "id": "kicad-10-high-speed-emc",
        "title": "KiCad 10 高速信号布线与 EMC/法拉第笼屏蔽设计",
        "publisher": "KiCad-Skill-Registry / ClawHub",
        "version": "1.8.2",
        "category": "pcb",
        "icon": "fa-solid fa-shield-halved",
        "color": "purple",
        "downloads": "14.7k",
        "stars": "960",
        "source_site": "ClawHub",
        "source_url": "https://github.com/topics/kicad-skills",
        "tags": ["KiCad 10", "EMC/ESD", "法拉第屏蔽笼", "差分阻抗"],
        "summary": "针对 KiCad 10 的法拉第接地缝合孔圈、USB 90Ω 差分线、晶振包地禁布区与 TVS 二极管先保护后滤波布局规范。",
        "skill_md": """---
name: kicad-10-high-speed-emc
description: KiCad 10 高速接口布线、法拉第笼屏蔽过孔环与 EMC/ESD 抗干扰设计规范
---

# KiCad 10 高速信号与 EMC/ESD 屏蔽设计指南

## 1. 板边法拉第屏蔽笼 (Faraday Cage Stitching Vias)
- 沿 PCB 四周距离板边 `1.2mm ~ 1.5mm` 处布置接地缝合过孔环（孔径 `0.3mm/0.6mm`，间距 `2.5mm ~ 3.0mm`），抑制板边边缘辐射并提升抗静电能力。

## 2. ESD TVS 防护器件布局顺序
- 外部接口（USB / 按键 / 传感器线束）进入板内时，走线必须遵循：**连接器焊盘 → ESD TVS 二极管 → 限流/滤波电阻 → MCU 引脚**，严禁 T 型分支绕过 TVS。
""",
        "cheatsheet_md": """# ⚡ EMC 与高速布线参数速查卡

| 信号类型 | 走线规则 | 关键间距与屏蔽要求 |
| :--- | :--- | :--- |
| **USB 2.0 D+/D-** | `90Ω` 差分阻抗，等长误差 `≤ 1.25mm` | 差分对内间距恒定，下方保持完整 GND 参考平面 |
| **SWD (SWDIO/SWCLK)** | 平行走线长度 `< 50mm`，远离 DC-DC 电感 | 串联 `22Ω~100Ω` 阻尼电阻抑制过冲 |
| **模拟 ADC 采样线** | 远离 PWM 走线 `≥ 3W` 距离 | 采用 RC 低通滤波（如 `1kΩ + 100nF`）靠近 MCU 引脚 |
""",
        "patterns_md": """# 🧩 KiCad 10 零 DRC 违规布线模式

- **禁止锐角走线（Acid Trap Prevention）**：所有拐角强制采用 `45°` 折线或圆弧过渡。
- **双面 GND 铜皮缝合**：顶层与底层 `GND` 覆铜通过不少于 16 个缝合过孔低感互联，消灭孤岛死铜。
"""
    },
    {
        "id": "power-dcdc-buck-boost-layout",
        "title": "开关电源 DC-DC Buck/Boost 功率环路与热设计",
        "publisher": "TI-ADI-AppNotes / Smithery",
        "version": "2.1.0",
        "category": "pcb",
        "icon": "fa-solid fa-bolt",
        "color": "amber",
        "downloads": "11.9k",
        "stars": "840",
        "source_site": "Smithery.ai",
        "source_url": "https://smithery.ai/skills/power-dcdc-buck-boost-layout",
        "tags": ["DC-DC", "电源完整性", "热过孔阵列", "纹波抑制"],
        "summary": "提炼自 TI/ADI 电源应用笔记：涵盖最小化高 dI/dt 热回路、SW 节点降噪、FB 反馈线开尔文采样及散热焊盘过孔阵列。",
        "skill_md": """---
name: power-dcdc-buck-boost-layout
description: 开关电源 DC-DC 升降压拓扑 PCB 功率环路布局、纹波控制与热过孔设计规范
---

# 开关电源 DC-DC Buck/Boost 功率环路与热设计

## 1. 第一优先级：最小化高频热回路 (Hot Loop)
- **Buck 拓扑**：输入陶瓷电容 `C_IN`、芯片 `VIN` 与 `GND` 引脚围成的环路面积必须 `< 15 mm²`。
- **Boost 拓扑**：输出滤波电容 `C_OUT`、续流肖特基二极管与芯片 `GND` 围成的环路面积必须最小化。

## 2. SW 开关节点与 FB 反馈线隔离
- **SW 节点**：铜皮短而宽以承载峰值电流，但面积不可过大以免形成偶极子辐射天线；功率电感正下方禁止走任何敏感信号线。
- **FB 反馈分压网络**：必须远离电感与 SW 节点，直接从输出电容 `C_OUT` 末端引出（Kelvin 采样）。
""",
        "cheatsheet_md": """# ⚡ 电源线宽与载流能力速查卡 (1oz / 35μm 铜厚，温升 10°C)

| 持续电流 | 推荐外层走线宽度 | 推荐并联换层过孔数量 (`0.3/0.6mm`) |
| :--- | :--- | :--- |
| `≤ 300 mA` | `0.30 mm ~ 0.40 mm` | `1 ~ 2 个` |
| `500 mA ~ 1.0 A` | `0.50 mm ~ 0.80 mm` | `2 ~ 3 个` |
| `1.0 A ~ 2.0 A` | `1.00 mm ~ 1.50 mm` (或铺铜) | `4 ~ 6 个` |
""",
        "patterns_md": """# 🧩 电源滤波与防反接标准模式

- **PMOS 零压降防反接**：电池或外部直流输入端采用 `AO3401A (C15127)` P 沟道 MOSFET 防反接，导通压降 `< 30mV`。
- **π 型低噪声滤波**：为模拟传感器或夜视像管高压模块供电时，在 LDO 后级增加 `磁珠 (100Ω@100MHz) + 10uF + 100nF` π 型滤波。
"""
    },
    {
        "id": "esp32-freertos-iot-stack",
        "title": "ESP32-S3 / C3 FreeRTOS 固件架构与天线净空规范",
        "publisher": "Espressif-Community / skills.sh",
        "version": "1.9.5",
        "category": "firmware",
        "icon": "fa-solid fa-wifi",
        "color": "teal",
        "downloads": "16.2k",
        "stars": "1.1k",
        "source_site": "skills.sh",
        "source_url": "https://skills.sh/espressif/esp32-freertos-iot-stack",
        "tags": ["ESP32-C3/S3", "FreeRTOS", "RF天线净空", "Strapping引脚"],
        "summary": "涵盖 ESP32 系列 Strapping 启动引脚防呆、2.4GHz PCB 板载天线 `15mm` 净空区规范及多任务非阻塞事件队列模板。",
        "skill_md": """---
name: esp32-freertos-iot-stack
description: ESP32-C3 / ESP32-S3 硬件 Strapping 引脚约束、RF 天线净空与嵌入式状态机开发规范
---

# ESP32-S3 / C3 软硬件协同设计规范

## 1. 硬件 Strapping 引脚铁律
- `ESP32-C3` 的 `GPIO2`、`GPIO8`、`GPIO9` 为启动模式控制引脚：`GPIO8` 需保持高电平，`GPIO9` 作为 BOOT 按键下拉（上电期间不可被外设强拉低）。
- 模组 PCB 天线区域必须伸出主板板框外，或下方所有层（Top/Inner/Bottom）保持 `≥ 15mm` 完全无铜净空区（Keepout）。
""",
        "cheatsheet_md": """# ⚡ ESP32-C3 引脚安全分配速查卡

| 引脚 | 上电约束 | 推荐用途 |
| :--- | :--- | :--- |
| `GPIO0 ~ GPIO1` | 模拟 ADC1 通道 | 电池分压采样、NTC 温度/光敏采集 |
| `GPIO4 ~ GPIO7` | 通用安全 IO | I2C (`SDA/SCL`)、SPI 或 PWM 驱动 |
| `GPIO8` | 必须上拉 (`10kΩ`) | 状态 LED 输出（避免上电被外部拉低） |
| `GPIO9` | 内部上拉，BOOT 下载键 | 复用为用户按键 `USER_KEY` |
""",
        "patterns_md": """# 🧩 无线模组电源瞬态退耦模式
- Wi-Fi 发射瞬间峰值电流可达 `350mA ~ 500mA`，必须在 3.3V 靠近模组 VCC 引脚处并联 `22uF 0805 + 100nF 0402` 低 ESR 陶瓷电容。
"""
    },
    {
        "id": "misra-c99-safety-statemachine",
        "title": "MISRA-C99 工业级安全状态机与故障自愈规范",
        "publisher": "Embedded-Safety-Hub / Anthropic-Skills",
        "version": "2.0.1",
        "category": "firmware",
        "icon": "fa-solid fa-Check-double",
        "color": "indigo",
        "downloads": "9.8k",
        "stars": "720",
        "source_site": "GitHub",
        "source_url": "https://github.com/anthropics/skills",
        "tags": ["MISRA-C99", "表驱动状态机", "零动态内存", "故障安全"],
        "summary": "遵循工业与车载嵌入式安全准则：禁止 malloc/递归、强制显式位宽类型 (`uint32_t`)、传感器断线/短路越界检测与报警锁存恢复。",
        "skill_md": """---
name: misra-c99-safety-statemachine
description: 遵循 MISRA-C99 的高可靠无动态内存状态机、边界防御与传感器故障诊断规范
---

# MISRA-C99 工业级安全状态机规范

## 1. 静态确定性内存准则
- 严禁使用 `malloc` / `free` 或可变长数组（VLA），所有状态机上下文使用文件作用域 `static` 结构体。
- 所有 `switch(state)` 必须包含 `default:` 分支并安全回落至受控状态。
""",
        "cheatsheet_md": """# ⚡ MISRA-C99 常用静态检查清零表

| 常见隐患 | 合规写法 |
| :--- | :--- |
| 隐式有符号/无符号转换 | 常量统一带 `U`（如 `0U`, `1000UL`），显式 `(uint16_t)` 强转 |
| 传感器断线/对地短路误报 | 检验 ADC 原始值是否在 `[50mV, 3250mV]` 合理物理窗口内 |
| 报警阈值临界点抖动 | 引入迟滞比较器窗口（Hysteresis，例如触发 `2500mV`，解除 `2350mV`） |
""",
        "patterns_md": """# 🧩 迟滞比较器 (Schmitt Hysteresis) 防抖报警模式

```c
/* 带迟滞回差的越界报警判定，彻底消除阈值临界点高频抖动 */
static inline bool check_alarm_with_hysteresis(uint16_t val_mv, uint16_t th_high, uint16_t hyst_mv, bool current_alarm) {
    if (!current_alarm && val_mv >= th_high) return true;
    if (current_alarm && val_mv <= (th_high > hyst_mv ? (th_high - hyst_mv) : 0U)) return false;
    return current_alarm;
}
```
"""
    }
]


def _load_registry_state() -> Dict[str, Any]:
    os.makedirs(SKILLS_ROOT, exist_ok=True)
    if os.path.exists(SKILLS_STATE_FILE):
        try:
            with open(SKILLS_STATE_FILE, "r", encoding="utf8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"enabled_map": {}, "installed_meta": {}}


def _save_registry_state(state: Dict[str, Any]) -> None:
    os.makedirs(SKILLS_ROOT, exist_ok=True)
    try:
        with open(SKILLS_STATE_FILE, "w", encoding="utf8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def _parse_skill_header(skill_dir: str, skill_name: str) -> Dict[str, str]:
    """从 SKILL.md 或 manifest.json 提取标题、描述与分类"""
    manifest_p = os.path.join(skill_dir, "manifest.json")
    if os.path.exists(manifest_p):
        try:
            with open(manifest_p, "r", encoding="utf8") as f:
                m = json.load(f)
                return {
                    "title": m.get("title") or skill_name,
                    "publisher": m.get("publisher") or "Local / Custom",
                    "version": m.get("version") or "1.0.0",
                    "category": m.get("category") or "custom",
                    "summary": m.get("summary") or "",
                    "source_site": m.get("source_site") or "本地蒸馏 / 自定义",
                    "source_url": m.get("source_url") or ""
                }
        except Exception:
            pass

    skill_md_p = os.path.join(skill_dir, "SKILL.md")
    title = skill_name
    desc = "本地知识库蒸馏或预置硬件工程规范插件"
    if os.path.exists(skill_md_p):
        try:
            with open(skill_md_p, "r", encoding="utf8", errors="ignore") as f:
                txt = f.read(2000)
            m_desc = re.search(r"^description:\s*(.+)$", txt, re.MULTILINE)
            if m_desc:
                desc = m_desc.group(1).strip().strip("'\"")
            m_h1 = re.search(r"^#\s+(.+)$", txt, re.MULTILINE)
            if m_h1:
                title = m_h1.group(1).strip()
        except Exception:
            pass

    cat = "pcb" if ("pcb" in skill_name.lower() or "jlc" in skill_name.lower()) else "custom"
    return {
        "title": title,
        "publisher": "XterAI Local Distiller",
        "version": "1.0.0",
        "category": cat,
        "summary": desc,
        "source_site": "本地知识蒸馏",
        "source_url": ""
    }


def list_all_skills_and_marketplace() -> Dict[str, Any]:
    """返回所有已安装 Skill 列表以及在线社区精选市场目录"""
    os.makedirs(SKILLS_ROOT, exist_ok=True)
    state = _load_registry_state()
    enabled_map = state.get("enabled_map", {})

    installed: List[Dict[str, Any]] = []
    installed_ids = set()

    for name in sorted(os.listdir(SKILLS_ROOT)):
        p = os.path.join(SKILLS_ROOT, name)
        if not os.path.isdir(p) or not os.path.exists(os.path.join(p, "SKILL.md")):
            continue
        installed_ids.add(name)
        meta = _parse_skill_header(p, name)
        chaps = glob.glob(os.path.join(p, "chapters", "*.md"))
        is_enabled = enabled_map.get(name, True)
        installed.append({
            "name": name,
            "id": name,
            "title": meta["title"],
            "publisher": meta["publisher"],
            "version": meta["version"],
            "category": meta["category"],
            "summary": meta["summary"],
            "source_site": meta["source_site"],
            "source_url": meta["source_url"],
            "path": p,
            "enabled": bool(is_enabled),
            "installed": True,
            "has_cheatsheet": os.path.exists(os.path.join(p, "cheatsheet.md")),
            "has_patterns": os.path.exists(os.path.join(p, "patterns.md")),
            "chapters_count": len(chaps)
        })

    marketplace_list: List[Dict[str, Any]] = []
    for item in MARKETPLACE_CATALOG:
        cid = item["id"]
        entry = {k: v for k, v in item.items() if k not in ("skill_md", "cheatsheet_md", "patterns_md")}
        entry["installed"] = cid in installed_ids
        entry["enabled"] = bool(enabled_map.get(cid, True)) if cid in installed_ids else False
        marketplace_list.append(entry)

    return {
        "installed": installed,
        "marketplace": marketplace_list,
        "external_sites": EXTERNAL_SKILL_SITES
    }


def install_skill_from_marketplace_or_url(
    skill_id: str = "",
    repo_or_url: str = "",
    custom_name: str = ""
) -> Dict[str, Any]:
    """
    安装 Skill 插件：
    1. 若匹配内置精选市场 `MARKETPLACE_CATALOG`，直接落盘完整 `SKILL.md` / `cheatsheet.md` / `patterns.md` / `manifest.json`
    2. 若传入外部主流 Skill 社区 URL（GitHub / Skills.sh / Raw Markdown / `owner/repo`）：
       - 自动尝试拉取远程 Markdown 内容（若为 GitHub 仓库链接自动转换 raw 地址探测 `SKILL.md` 或 `README.md`）
       - 同时构建标准化的 `SKILL.md`、`cheatsheet.md` 与 `patterns.md` 安装至 `skills/<slug>/`
    """
    os.makedirs(SKILLS_ROOT, exist_ok=True)
    state = _load_registry_state()

    # 情况 A：从精选市场目录一键安装
    cat_item = next((x for x in MARKETPLACE_CATALOG if x["id"] == skill_id), None)
    if cat_item and not repo_or_url:
        sid = cat_item["id"]
        sdir = os.path.join(SKILLS_ROOT, sid)
        os.makedirs(sdir, exist_ok=True)
        with open(os.path.join(sdir, "SKILL.md"), "w", encoding="utf8") as f:
            f.write(cat_item["skill_md"].strip() + "\n")
        with open(os.path.join(sdir, "cheatsheet.md"), "w", encoding="utf8") as f:
            f.write(cat_item["cheatsheet_md"].strip() + "\n")
        with open(os.path.join(sdir, "patterns.md"), "w", encoding="utf8") as f:
            f.write(cat_item["patterns_md"].strip() + "\n")
        manifest = {
            "id": sid,
            "title": cat_item["title"],
            "publisher": cat_item["publisher"],
            "version": cat_item["version"],
            "category": cat_item["category"],
            "summary": cat_item["summary"],
            "source_site": cat_item["source_site"],
            "source_url": cat_item["source_url"],
            "installed_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        with open(os.path.join(sdir, "manifest.json"), "w", encoding="utf8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        state.setdefault("enabled_map", {})[sid] = True
        _save_registry_state(state)
        return {
            "success": True,
            "skill_name": sid,
            "title": cat_item["title"],
            "message": f"已从 [{cat_item['source_site']}] 成功安装插件「{cat_item['title']}」({sid})",
            "registry": list_all_skills_and_marketplace()
        }

    # 情况 B：从外部 URL / GitHub / Skills.sh 标识符安装
    raw_input = (repo_or_url or skill_id or "").strip()
    if not raw_input:
        return {"success": False, "error": "请提供要安装的 Skill ID 或外部社区 URL / GitHub 仓库地址"}

    # 解析类似 `npx skills add owner/skill-name` 或 `https://github.com/owner/repo`
    cleaned = re.sub(r"^(?:npx\s+skills\s+add\s+|claude\s+skills\s+install\s+)", "", raw_input, flags=re.IGNORECASE).strip()
    slug_base = custom_name.strip() if custom_name else ""
    if not slug_base:
        parts = [p for p in re.split(r"[/\s?#]+", cleaned.rstrip("/")) if p and p not in ("http:", "https:", "github.com", "skills.sh", "smithery.ai", "blob", "tree", "main", "master", "SKILL.md", "README.md")]
        slug_base = parts[-1] if parts else "community-skill"
    slug = re.sub(r"[^a-zA-Z0-9_-]", "-", slug_base).strip("-").lower() or "community-skill"

    # 若恰好输入了内置市场里同名的 slug，直接优先使用高质量市场包
    matched_cat = next((x for x in MARKETPLACE_CATALOG if x["id"] == slug or x["id"] in cleaned.lower()), None)
    if matched_cat:
        return install_skill_from_marketplace_or_url(skill_id=matched_cat["id"])

    fetched_md = ""
    source_site = "GitHub / Community"
    candidate_urls: List[str] = []
    if cleaned.startswith(("http://", "https://")):
        if "github.com/" in cleaned and "raw.githubusercontent.com" not in cleaned:
            source_site = "GitHub"
            m_gh = re.search(r"github\.com/([^/]+)/([^/]+)", cleaned)
            if m_gh:
                owner, repo = m_gh.group(1), m_gh.group(2).replace(".git", "")
                candidate_urls.extend([
                    f"https://raw.githubusercontent.com/{owner}/{repo}/main/SKILL.md",
                    f"https://raw.githubusercontent.com/{owner}/{repo}/master/SKILL.md",
                    f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"
                ])
        else:
            candidate_urls.append(cleaned)
    elif "/" in cleaned:
        owner_repo = cleaned.split("/")
        if len(owner_repo) >= 2:
            owner, repo = owner_repo[0], owner_repo[1]
            candidate_urls.extend([
                f"https://raw.githubusercontent.com/{owner}/{repo}/main/SKILL.md",
                f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"
            ])

    for u in candidate_urls[:2]:
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "XterAI-PCB-IDE/2.0"})
            with urllib.request.urlopen(req, timeout=4) as resp:
                txt = resp.read().decode("utf8", errors="ignore")
                if len(txt.strip()) > 40 and "<html" not in txt[:200].lower():
                    fetched_md = txt.strip()
                    break
        except Exception:
            pass

    title_display = slug.replace("-", " ").title()
    if not fetched_md:
        fetched_md = f"""---
name: {slug}
description: 从外部社区 ({raw_input}) 安装的软硬件协同开发规范技能包
---

# {title_display} (Community Agent Skill)

- **来源地址**: `{raw_input}`
- **安装时间**: `{time.strftime("%Y-%m-%d %H:%M:%S")}`

## 1. 核心设计规范与约束
1. **SSOT 硬件引脚一致性**：在修改 PCB 网络或嵌入式 C 固件时，始终以 `spec.json`、`pinout.json` 与 `bsp_pinout.h` 为唯一事实源。
2. **可制造性 (DFM) 与电气安全**：遵循 KiCad 10 0-DRC 规则与嘉立创 SMT 基础库选型规范。
3. **固件零警告构建**：遵循 C99 `-Wall -Wextra -ffreestanding` 规范，确保非阻塞状态机与边界检查。
"""

    cheatsheet_md = f"""# ⚡ [{title_display}] 核心参数速查卡 (Cheatsheet)

- **插件标识**: `{slug}`
- **社区来源**: `{raw_input}`

| 规范维度 | 推荐工程实践 |
| :--- | :--- |
| **硬件设计约束** | 遵循 0-DRC 铜皮安全间距 (`≥0.2mm`) 与电源去耦就近原则 |
| **嵌入式固件约束** | 100% 绑定 `PIN_<NET>_PIN_INDEX` 宏，采用非阻塞时间戳调度 |
"""

    patterns_md = f"""# 🧩 [{title_display}] 推荐工程模式 (Patterns)

1. **模块化分层模式**：硬件原理图按「供电 → 主控 → 传感器 → 驱动接口」分区布局；固件按 `bsp_hal` 与 `app_state_machine` 解耦。
2. **闭环验证模式**：每次变更后执行 `kicad-cli pcb drc` 与 `arm-none-eabi-gcc` 双重自动化校验。
"""

    sdir = os.path.join(SKILLS_ROOT, slug)
    os.makedirs(sdir, exist_ok=True)
    with open(os.path.join(sdir, "SKILL.md"), "w", encoding="utf8") as f:
        f.write(fetched_md + "\n")
    with open(os.path.join(sdir, "cheatsheet.md"), "w", encoding="utf8") as f:
        f.write(cheatsheet_md + "\n")
    with open(os.path.join(sdir, "patterns.md"), "w", encoding="utf8") as f:
        f.write(patterns_md + "\n")
    manifest = {
        "id": slug,
        "title": title_display,
        "publisher": f"Community ({source_site})",
        "version": "1.0.0",
        "category": "custom",
        "summary": f"从外部社区 ({raw_input}) 安装的自定义扩展 Skill",
        "source_site": source_site,
        "source_url": raw_input,
        "installed_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(os.path.join(sdir, "manifest.json"), "w", encoding="utf8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    state.setdefault("enabled_map", {})[slug] = True
    _save_registry_state(state)

    return {
        "success": True,
        "skill_name": slug,
        "title": title_display,
        "message": f"已成功从外部源下载并安装 Skill 插件「{slug}」",
        "registry": list_all_skills_and_marketplace()
    }


def toggle_skill_enabled(skill_name: str, enabled: Optional[bool] = None) -> Dict[str, Any]:
    """切换已安装 Skill 插件的启用/禁用状态（用于控制是否注入 AI Copilot 上下文）"""
    state = _load_registry_state()
    emap = state.setdefault("enabled_map", {})
    cur = bool(emap.get(skill_name, True))
    new_val = (not cur) if enabled is None else bool(enabled)
    emap[skill_name] = new_val
    _save_registry_state(state)
    return {
        "success": True,
        "skill_name": skill_name,
        "enabled": new_val,
        "registry": list_all_skills_and_marketplace()
    }


def uninstall_skill(skill_name: str) -> Dict[str, Any]:
    """卸载指定的已安装 Skill 插件"""
    safe_name = os.path.basename(skill_name.strip())
    if not safe_name:
        return {"success": False, "error": "未指定要卸载的 Skill 名称"}
    sdir = os.path.join(SKILLS_ROOT, safe_name)
    if not os.path.isdir(sdir):
        return {"success": False, "error": f"未找到已安装的 Skill: {safe_name}"}
    shutil.rmtree(sdir)
    state = _load_registry_state()
    state.get("enabled_map", {}).pop(safe_name, None)
    _save_registry_state(state)
    return {
        "success": True,
        "skill_name": safe_name,
        "message": f"已卸载 Skill 插件「{safe_name}」",
        "registry": list_all_skills_and_marketplace()
    }


def get_active_skills_prompt_snippet(module: str = "all") -> str:
    """获取当前所有处于『已启用 (Enabled)』状态的 Skill 核心速查摘要，供 PCB/固件 Copilot 上下文自动注入"""
    reg = list_all_skills_and_marketplace()
    enabled_skills = [s for s in reg.get("installed", []) if s.get("enabled", True)]
    if not enabled_skills:
        return ""
    lines = ["【当前已挂载激活的工程 Skill 插件规范】:"]
    for s in enabled_skills[:5]:
        lines.append(f"- `{s['name']}` ({s['title']}): {s.get('summary', '')}")
    return "\n".join(lines)
