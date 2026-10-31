---
name: lab7-qa-skill
description: >-
  蒸馏自《LAB7电路板研发问题 - 现场回复整理.docx》的企业级硬件与嵌入式开发知识库技能。
  支持在 Claude Code, Antigravity, Codex, Grok 中自动触发并指导电路板与固件设计。
metadata:
  author: AI-PCB Knowledge Distiller
  version: "1.0.0"
---

# lab7-qa-skill 知识库核心指导体系

本技能由 AI-PCB 平台蒸馏引擎自动构建，完整保留并结构化了源文档《LAB7电路板研发问题 - 现场回复整理.docx》的工业级工程指导规范。

## 1. 核心架构与知识索引路由 (Topic Router)

| 模块分册 | 对应文件 | 覆盖的核心内容与解答的问题 |
| :--- | :--- | :--- |
| **速查卡** | [`cheatsheet.md`](./cheatsheet.md) | 线宽载流对照表、工艺孔径间距速查 |
| **设计模式** | [`patterns.md`](./patterns.md) | 推荐最佳布局布线模式与六大反模式 |
| Ch 01 | [`chapters/ch01_概述与通用指导.md`](./chapters/ch01_概述与通用指导.md) | 概述与通用指导 |

## 2. 闭环执行准则
在任何硬件 PCB 与固件设计过程中：
1. 优先查阅 `cheatsheet.md` 与对应章节分册；
2. 严守 `patterns.md` 中的推荐模式，杜绝六大反模式；
3. 严格通过 KiCad CLI DRC/ERC 官方 0 违规验收方可导出生产交付包。
