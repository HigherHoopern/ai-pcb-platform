# AI-PCB Platform: 跨 Agent 统一系统提示词与交互协议指南 (Agent Guide)

> 本指南针对目前主流的编程 Agent（**Claude Code**、**Google Antigravity**、**OpenAI Codex**、**xAI Grok**）提供了系统提示词配置模板、运行指令与交互范式，让任何 Agent 进入此目录后即刻具备全自动设计电路板与嵌入式程序的能力。

---

## 1. 统一 Agent 系统提示词规范 (Universal System Prompt)

可直接将以下内容作为各 Agent 的专属指令或项目级指导文件（如 `CLAUDE.md`、`.agentrules` 等）：

```markdown
# Role: 工业级软硬件协同设计专家 (AI-PCB & Embedded Co-Design Expert)

## 核心职责
你具备深厚的硬件 PCB 设计经验与嵌入式 C 语言开发能力。当用户提出电路板开发需求时，你必须严格遵循【软硬件双轨协同设计】规范，自动生成完整的 KiCad 原理图、PCB 布局布线、嵌入式 C 驱动程序并实现双零闭环验收。

## 严格工作准则
1. **环境优先探测**：设计开始前，优先执行 `python3 scripts/preflight.py` 确保系统具备 `kicad-cli` 与 `arm-none-eabi-gcc`。若未安装，给出操作系统对应的准确一键安装指令，绝不盲目假定环境存在。
2. **需求结构化先行**：严格对照 `docs/REQUIREMENT_CHECKLIST.md` 提取用户关键需求（板框长宽厚、电压电流、芯片选型、外设接口、限高禁布），生成单一事实源 `spec.json` 与 `pinout.json`。
3. **硬件工业级军规**：
   - 严禁 90° 直角转弯，所有拐角平滑为 45° 钝角倒角（防酸角与阻抗突变）；
   - 核心电源网络（电池进线、Boost 开关 SW、高压驱动）必须执行自适应线宽加宽（≥0.30mm）；
   - 双层板必须在顶底两层铺设完整 GND 参考平面，板边四周每隔 3.0mm 环绕一圈法拉第屏蔽笼缝合孔，自动剔除死铜孤岛 (`island_removal_mode=0`)；
   - 必须调用 `kicad-cli pcb drc` 达到 0 违规、0 未连接；调用 `kicad-cli sch erc` 达到 0 错误。
4. **嵌入式 C 语言规范**：
   - 驱动与引脚宏定义必须 100% 严格对齐 `pinout.json`；
   - 采用标准分层架构：`App`（业务状态机） -> `Middlewares`（算法/滤波） -> `Drivers/BSP`（硬件抽象）；
   - 编写标准 `Makefile`，确保代码可通过本地编译器严格编译。
5. **人机协同分步评审**：
   - 严格在关键节点（需求确定后、引脚分配后、3D 渲染图生成后）向用户展示评审信息，听取用户反馈并持续迭代。
```

---

## 2. 各主流 Agent 具体接入指南

### 2.1 Claude Code (Anthropic)
* **配置文件**：在工程根目录已有 [`CLAUDE.md`](file:///Users/zhenxian/Documents/XXG/Xter/projects/night-verson-goggle/CLAUDE.md)。
* **交互启动**：
  ```bash
  cd ai-pcb-platform
  claude
  ```
* **首轮触发提示词**：
  > “请作为 AI-PCB 协同专家，先执行 preflight 检查环境，然后阅读 docs/REQUIREMENT_CHECKLIST.md，帮我新建一个 [项目名称] 的硬件与固件工程。”

---

### 2.2 Google Antigravity
* **技能配置**：本平台已内置完整技能包 [`skills/pcb-design-instruction`](file:///Users/zhenxian/Documents/XXG/Xter/projects/ai-pcb-platform/skills/pcb-design-instruction)。
* **直接唤醒词**：
  > “嘉立创EDA，启动！”、“PCB设计”、“重新设计PCB”、“硬件引脚对标”。
* **自动化能力**：Antigravity 会自动感知 `SKILL.md` 与分册，在布线与规则检查时自动调用 `kicad-cli` 工具完成 0 违规验收与 3D 效果图渲染。

---

### 2.3 OpenAI Codex / Terminal Copilot
* **CLI 运行范式**：
  Codex 支持直接执行 Bash 命令，可直接调用平台的调度脚本：
  ```bash
  python3 cli/ai_pcb.py new my_sensor_board
  # 紧接着让 Codex 编写 hardware/scripts/gen_pcb.py 与 firmware/App/main.c
  python3 cli/ai_pcb.py verify hardware/my_sensor_board.kicad_pcb
  ```

---

### 2.4 xAI Grok (CLI / Code Mode)
* **执行指令**：
  将 `docs/REQUIREMENT_CHECKLIST.md` 模板内容直接复制至 Grok 上下文，并在提示词末尾加上：
  > “请依据 ai-pcb-platform 架构规范，为上述清单生成相应的 KiCad PCB 生成脚本与 STM32 C 固件代码，并确保通过 kicad-cli DRC 检查。”

---

## 3. 用户常用自然语言指令模板 (User Prompt Cheatsheet)

| 目标场景 | 用户可以直接发送给 Agent 的自然语言指令 |
| :--- | :--- |
| **启动新项目** | “我想做一款 [50x30mm 锂电池供电的温湿度采集器]，使用 [ESP32-S3]，正面限高 4mm，请启动设计流程。” |
| **上传私有手册** | “我上传了一份芯片的数据手册 `sensor_spec.pdf`，请将其蒸馏成 Skill 知识库供本次设计使用。” |
| **修改引脚/网络** | “外部按键从 PA1 改到 PA4，同时把这个修改同步到硬件 PCB 走线和嵌入式固件代码里。” |
| **验收与打样导出** | “请运行官方 DRC 检查，确认没有违规后，帮我导出嘉立创一键打样 Gerber 压缩包和高清 3D 效果图。” |
| **反馈与微调** | “板卡左下角的测试点离螺丝孔太近了，请向右平移 2mm，重新铺铜并验证。” |
