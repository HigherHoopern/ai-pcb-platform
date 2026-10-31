# AI-PCB Platform: 嵌入式 C 与 PCB 全自动协同设计平台
> **面向 AI 编程 Agent (Claude Code, Antigravity, Codex, Grok) 的通用硬件敏捷开发脚手架**

---

## 🌟 核心特性

1. **多 Agent 原生兼容**：
   - 完美适配终端环境下的 `claude code`、`antigravity`、`codex`、`grok` 等 AI 编程助手。
   - 提供 Agent 提示词指令规范与分阶段评审检查点（Quality Gates）。
2. **软硬件协同设计 (SSOT Co-Design)**：
   - 输入需求文本 -> 自动生成 KiCad 原理图与 2层/多层 PCB 布局布线。
   - 同步生成引脚严格对齐的嵌入式 C 固件代码（BSP、驱动、状态机、Makefile）。
3. **环境预检与防呆**：
   - 自动检测本地 `kicad-cli`、`arm-none-eabi-gcc`、`python3`；环境缺失时输出针对 macOS/Linux/Windows 的一键安装命令。
4. **知识库蒸馏引擎 (Knowledge Distiller)**：
   - 支持上传 DOCX、PDF、Markdown 格式的企业规范与芯片手册，一键自动蒸馏为工业级标准 Skill。
5. **官方工具链 0 违规双闭环**：
   - KiCad 官方 `kicad-cli pcb drc` 0 违规、`kicad-cli sch erc` 0 错误；ARM GCC 0 编译错误。

---

## 📁 平台目录结构

```
ai-pcb-platform/
├── cli/
│   └── ai_pcb.py               # 统一命令行调度入口 (preflight / distill / new / verify)
├── core/                       # 平台核心引擎 (需求解析、引脚映射、DRC/ERC自动化)
├── docs/
│   ├── ARCHITECTURE.md         # 平台完整技术架构白皮书
│   └── REQUIREMENT_CHECKLIST.md # 电路板与固件设计需求清单 (必看)
├── knowledge_distiller/
│   └── distiller.py            # 知识库文档蒸馏引擎 (DOCX/PDF -> Skill)
├── scripts/
│   └── preflight.py            # 宿主机环境预检检测器
├── skills/                     # 蒸馏技能与规则库 (内置 pcb-design-instruction)
└── templates/                  # 原理图、布局算法、固件 BSP 基础模板
```

---

## 🚀 快速上手 (Quickstart)

### 第一步：环境预检
在终端运行预检命令，确保本地已具备 KiCad 与编译环境：
```bash
python3 cli/ai_pcb.py preflight
```
> 如果提示缺少 `kicad-cli`，按提示执行 `brew install --cask kicad` 即可。

### 第二步：知识库蒸馏 (可选)
如果您有私有的 PCB 规范手册或器件文档，可直接蒸馏为专有 Skill：
```bash
python3 cli/ai_pcb.py distill docs/your_spec.docx --name "my-company-rules"
```

### 第三步：输入需求并启动设计
参考 [`docs/REQUIREMENT_CHECKLIST.md`](./docs/REQUIREMENT_CHECKLIST.md) 的清单项，向任何编程 Agent（如 Claude Code / Antigravity）输入需求提示词：

> **“我要开发一款 [板卡名称]，尺寸 [长x宽]，使用 [MCU型号]，供电为 [电源参数]，包含外设 [外设列表]，请按 ai-pcb-platform 流程设计原理图、PCB并编写嵌入式 C 驱动程序。”**

Agent 将自动依据平台脚手架执行软硬件生成、A* 网格布线、45°平滑倒角，并调用 `kicad-cli` 进行双“零”验证与打样导出。
