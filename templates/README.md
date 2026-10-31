# AI-PCB Platform 标准软硬件工程模板库 (Templates)

本目录存放平台确定性代码与 EDA 脚手架生成模板（由 [`core/scaffold_generator.py`](../core/scaffold_generator.py) 驱动）：

1. **嵌入式 C 固件模板体系**：
   - `Drivers/bsp_pinout.h`：基于 `pinout.json` 100% 确定性生成的引脚宏与描述符表
   - `Drivers/bsp_hal.h` & `Drivers/bsp_hal.c`：GPIO / ADC / PWM / I2C / SysTick 硬件抽象层
   - `App/app_state_machine.h` & `App/app_state_machine.c`：非阻塞协作式业务状态机
   - `App/main.c`：主循环与低功耗调度入口
   - `Core/startup_minimal.c` & `Core/linker_flash.ld`：适配目标 MCU Flash/RAM 容量的启动向量表与链接脚本
   - `Makefile`：支持 `arm-none-eabi-gcc -ffreestanding` 独立构建 `.elf` / `.hex` / `.bin`

2. **KiCad 硬件模板体系**：
   - 标准 2 层 / 4 层沉金 `.kicad_pcb` 生成器（含 R 角板框、M2.5 定位孔、3mm 法拉第屏蔽过孔环、双面 GND 铺铜、45° 布线与 0 DRC 违规拓扑）
   - 标准 `.kicad_sch` 原理图与 `BOM.csv` 生产物料清单生成器
