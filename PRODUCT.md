# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- **Frontend**: HTML5, Tailwind CSS, FontAwesome 6, Modern Dark Terminal Glassmorphism UI
- **Backend**: Python 3.12, FastAPI, Uvicorn, RESTful API
- **LLM Engine**: DeepSeek-V4-Flash via SiliconFlow API (`core/llm_client.py`)
- **EDA & Hardware Toolchain**: KiCad 10.0.5 CLI (`pcbnew`, DRC/ERC, 3D Render, Gerber Export)
- **Firmware Toolchain**: ARM GNU Toolchain (`arm-none-eabi-gcc` 16.2.0), Make / CMake, CMSIS
- **Agent Ecosystem**: Claude Code CLI (`claude`), Pi CLI (`pi`), Codex CLI (`codex`), Antigravity CLI (`agy`)

## Users

- **Primary Users**: 硬件工程师、嵌入式工程师、电子系统架构师及创客（Makers）。
- **Usage Situation**: 面对复杂的电路板开发与固件编写需求，需要借助终端 Coding Agent 实现端到端的全自动或半自动协同设计。
- **Core Job**: 用户上传需求附件（Excel/PDF/Word），通过系统智能提炼规格并在 Gate 1 完成审阅锁定，随后一键调度 Agent 完成 KiCad PCB 布局布线与嵌入式 C 固件编写。

## Product Purpose

- **Why it exists**: 消除软硬件协同设计中“需求口头传递、引脚分配冲突、EDA 规则手工复核繁重、嵌入式驱动重复编写”的高门槛低效痛点。
- **What it does**: 构建基于单一事实源 (SSOT: `spec.json` & `pinout.json`) 的 AI 软硬件全自动研发平台。
- **What success means**: 
  1. 需求上传后 3 秒内完成结构化参数与引脚矩阵提炼；
  2. 用户在 Gate 1 签署锁定需求；
  3. 选配 Agent（Antigravity/Claude/Pi/Codex）全自动输出 0 违规 KiCad 电路板、Gerber 打样包与 C 语言驱动。

## Positioning

首个真正打通「多格式技术文档提炼 ➔ 人机审核锁定 (Gate 1) ➔ 终端 Coding Agent 矩阵调度 ➔ KiCad EDA 官方 DRC 0 违规与固件编译闭环」的工业级软硬件 AI 协同平台。

## Operating Context

- **Local Host Environment**: macOS (Apple Silicon), Python 3.12 (`/opt/miniconda3`), KiCad CLI 10.0.5, Node v24.8.0.
- **Network & Proxy**: 本地代理运行于 `127.0.0.1:10020` / `127.0.0.1:7890`，支持透明 Git 与 NPM 加速。
- **Web UI URL**: `http://127.0.0.1:8989` (后台守护进程由 `./start.sh` 与 `./stop.sh` 管理)。
- **Target Project Directory**: `/Users/zhenxian/Documents/XXG/Xter/projects/` 下各工程独立沙箱。

## Capabilities and Constraints

- **Multi-Format Ingestion**: 原生解析 Excel (`.xlsx`/`.xls`)、Word (`.docx`/`.doc`)、PDF (`.pdf`) 与 Markdown/TXT。
- **Gate 1 Review Loop**: 严格禁止 Agent 在未经用户签署确认前擅自改动关键结构与电源参数。
- **Hardware Engineering Standards (嘉立创军规标准)**:
  - 板卡叠层：标准 2 层 / 4 层，1.0mm ~ 1.6mm 沉金工艺 (ENIG)；
  - 屏蔽机制：外沿必须环绕 3mm 法拉第接地屏蔽孔圈 (GND Via Fence)；
  - 布线几何：严禁 90° 直角与锐角走线，强制 45° 钝角走线，电源走线 ≥ 0.5mm；
  - 闭环验证：严格通过 `kicad-cli pcb drc` 官方审查（0 Violations / 0 Unconnected）。
- **Firmware Standards**:
  - 纯 C 语言编写（C99/C11），针对 STM32 / Cortex-M 平台；
  - 依据 `pinout.json` 自动生成引脚宏定义头文件 `bsp_pinout.h` 与外设驱动。

## Brand Commitments

- **Tone & Identity**: 专业硬核工业风、军规电子科技感、深色终端美学（Dark Terminal Glassmorphism）。
- **Palette Principles**: 深夜黑（Slate 950 / 900）、电路蓝（Sky 500）、沉金黄（Amber 400）、健康绿（Emerald 400）。

## Evidence on Hand

- **Benchmark Hardware**: LAB7 双筒夜视仪主板（双层 1.0mm 沉金板，179 个过孔，完整法拉第屏蔽笼，官方 DRC 0 违规交付）。
- **Benchmark Firmware**: STM32F401 / STM32L011 外设引脚映射表与 BSP 驱动库。
- **Visual Assets**: LAB7 Top/Bottom 3D 沉浸式渲染图（`/api/image/lab7_top`, `/api/image/lab7_bottom`）。

## Product Principles

1. **单一事实源 (SSOT First)**：硬件与固件必须严格以锁定的 `spec.json` 与 `pinout.json` 为唯一权威依据。
2. **工业军规制造第一 (DFM & DRC 0 违规)**：不妥协的电气间距与可制造性检查，设计成果必须可直接投产打样。
3. **极速提炼与深度设计解耦**：前端用高并发 Flash LLM 毫秒级提取，后台用顶级 Agent CLI (Antigravity/Claude/Codex) 攻坚长程复杂工程。
4. **开放 Agent 矩阵 (Multi-Agent Freedom)**：用户始终拥有选配自由，不锁定单一 Agent 厂商。
