# AI-PCB Platform 架构设计白皮书
> **面向下一代 AI 编程 Agent（Claude Code / Antigravity / Codex / Grok）的嵌入式 C 与 PCB 全自动协同设计平台**

---

## 1. 架构愿景与设计理念

传统硬件开发通常割裂为两个孤岛：**硬件工程师画原理图与 PCB**，**嵌入式工程师写 C 驱动与业务逻辑**。由于引脚分配、外设重映射（Alternate Function）、上拉下拉状态、电源时序缺乏统一的数据源，经常导致软硬件联调返工甚至 PCB 重新打样。

**AI-PCB Platform** 的设计初衷是：**以单一事实数据源（Single Source of Truth, SSOT）驱动软硬件双轨协同设计（Dual-Track Co-Design）**。通过对输入需求进行规范化解析，全自动生成符合工业标准的 KiCad 原理图、PCB 布局布线，并同步生成完全匹配的嵌入式 C 固件代码与引脚映射表，最终通过 DRC/ERC/GCC 编译实现双重闭环交付。

---

## 2. 总体逻辑架构 (System Architecture)

平台由 5 大分层模块构成：

```
┌─────────────────────────────────────────────────────────────────────────┐
│              1. 交互与 Agent 适配层 (Interaction & Agent Layer)          │
│   · Claude Code CLI   · Antigravity IDE/CLI   · Codex/Grok Agent API    │
│   · 统一提示词协议 (Prompt Protocol) · 交互式检查点 (Checkpoint Gate)      │
├─────────────────────────────────────────────────────────────────────────┤
│              2. 知识库蒸馏引擎 (Knowledge Distillation Engine)           │
│   · 文档解析器 (PDF / Word DOCX / Markdown / Datasheet)                 │
│   · 规范萃取器 (规则 / 载流表 / DFM约束 / 拓扑模式)                      │
│   · 动态 Skill 生成器 (按 book-to-skill 架构生成 SKILL.md / 专题分册)    │
├─────────────────────────────────────────────────────────────────────────┤
│              3. 软硬件协同中枢 (Co-Design Core & SSOT)                  │
│   · 需求解析器 (Spec Parser) -> 规范化结构体 spec.json                  │
│   · 软硬件统一引脚映射器 (Pinout & Signal Matrix pinout.json)           │
│   · 环境预检探针 (Preflight Inspector: KiCad CLI / GCC / Python)        │
├───────────────────────────────────┬─────────────────────────────────────┤
│ 4. 硬件设计流水线 (Hardware Track) │ 5. 固件工程流水线 (Firmware Track)   │
│ · 原理图生成 (S-Expression Gen)   │ · 目标芯片寄存器/HAL/CMSIS 适配     │
│ · 封装库与选型 (Footprint Mapper) │ · 自动生成 BSP (GPIO/ADC/Timer/PWM) │
│ · 布局与禁布规整 (Shelf/HPWL)     │ · 设备驱动与传感器中间件            │
│ · 自动布线 (Grid A* / Fanout)     │ · 业务状态机与事件调度主循环         │
│ · 45° 钝角平滑 (Chamfer/Miter)    │ · 编译构建脚本 (Makefile / CMake)    │
│ · 铜皮灌铜与死铜剥离 (GND Flood)  │ · 编译语法与链接验证 (ARM-GCC)      │
├───────────────────────────────────┴─────────────────────────────────────┤
│              6. 工业级闭环验证与打样导出 (Verification & Release)         │
│ · KiCad CLI 官方 ERC 校验 (0 违规) · KiCad CLI 官方 DRC 校验 (0 违规)    │
│ · Gerber / 钻孔 / 贴片坐标 / BOM / 3D 高清渲染图一键打包                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心子系统与关键模块设计

### 3.1 环境预检探针 (Preflight Inspector)
当任何编程 Agent 在用户机器上启动设计流程时，首要任务是检测本地工具链可用性，并提供一键式无缝引导：
* **KiCad CLI 检测**：检测 `kicad-cli` 是否安装且版本 $\ge 8.0$。
  - 若未安装，自动检测操作系统并提示：
    - macOS: `brew install --cask kicad`
    - Ubuntu/Debian: `sudo add-apt-repository ppa:kicad/kicad-8.0-releases && sudo apt install kicad`
    - Windows: `winget install KiCad.KiCad`
* **嵌入式交叉编译器**：检测 `arm-none-eabi-gcc`，确保固件代码可在本地编译验证通过。
* **Python 及几何库**：检测 Python3 运行环境。

### 3.2 知识库蒸馏引擎 (Knowledge-to-Skill Distiller)
支持用户上传私有技术文档（如《企业高速PCB设计规范》、器件手册 Datasheet、立创EDA工艺手册等）：
1. **文档结构化**：利用正则与分词将文档切分为章节段落。
2. **规则与参数萃取**：自动提取阻抗几何、线宽载流、孔径约束、布局禁区、EMC 防护拓扑。
3. **Skill 规范化输出**：生成符合 Agent 标准技能格式的工程：
   - `SKILL.md`（路由索引与触发器）
   - `cheatsheet.md`（参数速查表）
   - `patterns.md`（推荐模式与 6 大反模式）
   - `chapters/*.md`（主题深入专题）

### 3.3 软硬件统一引脚中枢 (Pinout Matrix SSOT)
平台使用统一的 `pinout.json` 作为硬件与固件的唯一纽带：
```json
{
  "pin": "PA0",
  "pin_num": 6,
  "net_name": "LDR_ADC",
  "function": "ADC_IN0",
  "electrical_type": "analog_input",
  "description": "光敏传感器模拟电压采样",
  "pcb_trace_width_mm": 0.15,
  "firmware_bsp_handler": "bsp_adc_read_channel(ADC_CHANNEL_0)"
}
```
* **硬件端**：基于此生成 KiCad 原理图引脚网络连线与 PCB 走线逃逸。
* **固件端**：基于此自动生成 `bsp_gpio.h`、`bsp_gpio.c` 与外设初始化宏定义，彻底杜绝软硬件引脚定义冲突。

### 3.4 硬件流水线 (KiCad CLI 深度驱动)
* **S-Expression 原生生成**：直接生成 KiCad 标准 `.kicad_sch` 与 `.kicad_pcb` 语法树，兼容图形化 KiCad 随时人工接管。
* **A* 网格布线与拓扑优化**：支持 2 层/多层逃逸、电源线宽自适应加宽、45° 倒角平滑。
* **官方工具链验收**：
  ```bash
  kicad-cli sch erc --format json -o erc.json project.kicad_sch
  kicad-cli pcb drc --refill-zones --save-board --format json -o drc.json project.kicad_pcb
  ```

### 3.5 固件流水线 (Embedded C Automation)
* 分层架构：`App`（业务状态机） -> `Middleware`（滤波/消抖/算法） -> `BSP`（硬件抽象） -> `Core/CMSIS`。
* 自动生成 `Makefile` / `CMakeLists.txt`，并通过本地交叉编译器自动执行 `make` 校验编译结果（0 Error / 0 Warning）。

---

## 4. 人机协同闭环反馈流程 (Human-in-the-Loop Feedback Gates)

平台设计并非黑盒一次性运行，而是采用分阶段门禁（Quality Gates）：

| 阶段 | 交付物 (Deliverable) | 用户反馈重点 (Review Focus) | 批准后动作 |
| :--- | :--- | :--- | :--- |
| **Gate 1: 需求对标** | `spec_summary.md` 需求清单确认 | 板框尺寸、电压电流、外设功能是否完备 | 启动原理图设计与芯片选型 |
| **Gate 2: 原理图与引脚** | `pinout.json` / `sch_preview.pdf` | 引脚复用分配、接口极性是否满足现场接线 | 启动 PCB 物理布局 |
| **Gate 3: PCB 布局结构** | 布局图、限高与禁布区标注 | 元器件干涉、接插件朝向、安装孔位置 | 启动自动布线与加宽 |
| **Gate 4: 布线与 3D 效果** | 3D Top/Bottom 渲染图、DRC 报告 | 走线美观度、EMC 屏蔽地、45°倒角 | 导出生产打样与固件编写 |
| **Gate 5: 打样与固件** | `Gerber.zip` / `BOM.csv` / 固件编译固件 | 生产清单核对、物料可采购性、固件功能 | 交付投产 |
