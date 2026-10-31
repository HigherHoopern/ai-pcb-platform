---
name: stm32-hal-ll-driver-expert
description: STM32 全系列 (F0/F1/F4/G0/L0/H7) CMSIS 与 C99 裸机非阻塞状态机驱动开发规范
---

# STM32 CMSIS / LL / HAL 零警告 C99 驱动专家 (v3.1.0)

## 1. 铁律约束 (Zero-Warning & SSOT Binding)
1. **100% 绑定 SSOT 引脚宏**：严禁在 `.c` 文件中硬编码 `GPIOA` 或引脚号，必须包含 `"bsp_pinout.h"` 并使用 `PIN_<NET>_PIN_INDEX` 与 `PIN_<NET>_PORT`。
2. **禁止阻塞死循环**：主循环禁止使用 `delay_ms(>5)`，所有按键扫描、传感器采样与报警闪烁必须基于 `BSP_GetTickMs()` 非阻塞时间戳。
3. **GCC `-Wall -Wextra -ffreestanding` 零警告**：所有未使用的静态辅助函数添加 `__attribute__((unused))`，无符号常量统一添加 `U` 后缀。
