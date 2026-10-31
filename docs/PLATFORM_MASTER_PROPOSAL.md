# AI-PCB Platform 总体规划与设计方案全景白皮书 (Master Proposal)
> **项目定位**：面向下一代编程 Agent（Claude Code / Antigravity / Codex / Grok）的嵌入式 C 语言程序与 PCB 电路板全自动协同开发平台  
> **版本**：v1.0.0  
> **作者**：Antigravity Hardware & Embedded Engineering

---

## 1. 方案背景与核心痛点

在传统的电子研发模式中，硬件电路设计与嵌入式软件开发长期存在协同壁垒：
1. **软硬件割裂，引脚打架频繁**：硬件原理图设计时引脚分配随意，未充分考虑单片机内部定时器通道、ADC 采样引脚复用限制，导致软件开发时不得不改板重新飞线。
2. **知识资产沉淀难**：大厂优秀的企业设计规范（动辄数十页的 Word/PDF 设计指南、芯片手册）无法直接被自动化工具消费，容易被新人遗忘或违反。
3. **缺少闭环机器验证**：许多 AI 方案仅能“写代码”或“画示意草图”，无法在用户本地真实调用 EDA 内核（如 `kicad-cli`）进行 DRC/ERC 物理间距与电气冲突验证，产出的电路板无法投产。

**AI-PCB Platform** 通过软硬件单一事实源（SSOT）、本地 EDA 探针检测、知识库自动蒸馏以及分阶段人机协同反馈，彻底打通“自然语言需求 -> 工业级 PCB 打样包 + 嵌入式 C 固件”的全流程闭环。

---

## 2. 平台核心功能全景

```
AI-PCB Platform 核心功能矩阵
├── [环境智能探针] Preflight Inspector
│   ├── 自动探测 kicad-cli (版本 >= 8.0/10.0)
│   ├── 自动探测 arm-none-eabi-gcc 交叉编译器
│   ├── 自动探测 Python3 与 Git/Git LFS
│   └── 缺失工具链时输出针对 macOS/Linux/Windows 的一键式安装指令
│
├── [知识库蒸馏引擎] Knowledge-to-Skill Distiller
│   ├── 支持用户上传 PDF / Word (.docx) / Markdown / Datasheet
│   ├── 自动提取设计约束：线宽载流、阻抗几何、安全间距、去耦与布局模式
│   └── 自动重构为符合 book-to-skill 架构的标准 Agent 技能库
│
├── [软硬件协同设计中枢] Co-Design SSOT Engine
│   ├── 需求结构化建模 (spec.json)
│   ├── 软硬件引脚映射矩阵 (pinout.json)
│   └── 硬件网络标号与固件 BSP 宏定义 100% 自动双向对齐
│
├── [硬件自动化流水线] Hardware Track (KiCad CLI Driven)
│   ├── 原理图 S-Expression 自动生成与符号映射
│   ├── kicad-cli sch erc 电气规则 0 错误校验
│   ├── 物理布局自适应规整与空间限高/禁布区排布
│   ├── A* 网格拓扑布线与大电流动力走线自适应加宽
│   ├── 全板 45° 钝角防酸角倒角平滑 (Chamfering/Miter)
│   ├── 双面接地铺铜、死铜孤岛全面剥离与板边法拉第屏蔽笼缝合孔
│   ├── kicad-cli pcb drc 官方 0 违规、0 未连接双零验收
│   └── 导出生产文件：Gerber 压缩包、钻孔报告、SMT 坐标 (POS)、BOM、高清 3D 渲染图
│
├── [固件自动化流水线] Firmware Track (Embedded C Driven)
│   ├── 基于 pinout.json 自动生成 CMSIS / HAL / LL 初始化代码
│   ├── 自动生成分层 BSP 驱动 (bsp_gpio, bsp_adc, bsp_pwr, bsp_timer)
│   ├── 中间件算法 (按键消抖、状态指示灯闪烁引擎、电池采样滤波)
│   ├── 业务状态机主循环事件调度
│   └── 本地 arm-none-eabi-gcc 严格编译语法与链接检查 (0 Error / 0 Warning)
│
└── [人机协同质量门禁] Human-in-the-Loop Feedback Gates
    ├── Gate 1: 需求清单对标确认
    ├── Gate 2: 软硬件引脚分配确认
    ├── Gate 3: 布局与限高审查确认
    ├── Gate 4: 3D 效果图与 DRC 验收确认
    └── Gate 5: 最终打样与固件源码交付
```

---

## 3. 规范落地目录结构与文件组织

平台完整保存在 `/Users/zhenxian/Documents/XXG/Xter/projects/ai-pcb-platform`：

```
ai-pcb-platform/
├── README.md                      # 平台总览与快速入门向导
├── cli/
│   └── ai_pcb.py                  # 平台统一命令行主入口 (preflight / distill / new / verify)
├── core/                          # 核心算法 (需求解析器、引脚协调器、DRC/ERC自动化管道)
├── docs/                          # 核心方案与标准文档
│   ├── ARCHITECTURE.md            # 平台技术架构白皮书
│   ├── REQUIREMENT_CHECKLIST.md   # 电路板与嵌入式系统设计需求清单 (必填向导)
│   ├── WORKFLOW_AND_GATES.md      # 7 步工作流与 5 大质量门禁指南
│   ├── AGENT_PROMPT_GUIDE.md      # Claude Code / Antigravity / Codex / Grok 接入指南
│   └── PLATFORM_MASTER_PROPOSAL.md# 本方案全景白皮书
├── knowledge_distiller/
│   └── distiller.py               # 知识库文档智能蒸馏引擎 (DOCX/PDF -> Skill)
├── scripts/
│   └── preflight.py               # 宿主机环境预检检测器 (KiCad / GCC / Python)
├── skills/                        # 蒸馏产物与内置技能库
│   ├── pcb-design-instruction/    # 内置 8.6万字企业级 PCB 设计军规 (v2.0)
│   └── lab7-qa-skill/             # 实测蒸馏生成的现场答疑技能
└── templates/                     # 固件分层架构与硬件 S 表达式模板
```

---

## 4. 实施路线图 (Implementation Roadmap)

| 阶段 | 周期 | 核心建设目标 | 达成标志 |
| :--- | :--- | :--- | :--- |
| **P0 基础骨架 (已完成)** | 即刻 | 目录创建、预检脚本、知识库蒸馏引擎、需求清单模板、架构白皮书全部就绪 | `preflight.py` 与 `distiller.py` 经测试 100% 运行通过 |
| **P1 模板与芯片库沉淀** | 1~2 周 | 沉淀 STM32L0/G0、ESP32-S3、RP2040 基础外设模板与常用阻容二三极管标准封装库 | 常见芯片可 10 秒内生成干净基础框架 |
| **P2 跨 Agent 插件化包装** | 2~3 周 | 封装 Claude Code 扩展、Antigravity 独立插件、VS Code 任务集成与一键运行按钮 | 用户单句对话即拉起全流程设计 |
| **P3 闭环云端打样直连** | 4~6 周 | 对接主流 PCB 板厂（嘉立创 OpenAPI / 华秋 EDA），支持一键上传 Gerber 并实时获取试产报价 | 从 AI 设计到顺丰发货的全自动化闭环 |
