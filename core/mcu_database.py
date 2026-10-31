#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 芯片硬件资源与引脚复用字典库 + 行业工程模板库 (MCU & Project Templates Database)

内置主流嵌入式 MCU 型号的硬件规格：
  - CPU 架构、编译参数 (-mcpu, -D 宏)、Flash 与 RAM 容量
  - 标准封装、推荐去耦电容配置、最大可用 IO 数量
  - 物理引脚字典、复用能力 (ADC / PWM / I2C / SPI / UART / SWD / EXTI) 与硬件设计禁忌提示
  - 5 大高频嵌入式硬件工程预设模板 (PROJECT_TEMPLATES)
"""

import re
import copy
from typing import Dict, Any, List, Optional

COMMON_PIN_FUNCTIONS: List[str] = [
    "GPIO_Output",
    "GPIO_Input",
    "GPIO_EXTI0",
    "GPIO_EXTI1",
    "GPIO_EXTI4",
    "ADC_IN0",
    "ADC_IN1",
    "ADC_IN2",
    "ADC_IN3",
    "TIM1_CH1_PWM",
    "TIM2_CH1_PWM",
    "TIM2_CH3_PWM",
    "TIM3_CH1_PWM",
    "I2C1_SCL",
    "I2C1_SDA",
    "SPI1_SCK",
    "SPI1_MISO",
    "SPI1_MOSI",
    "SPI1_NSS",
    "USART1_TX",
    "USART1_RX",
    "USART2_TX",
    "USART2_RX",
    "CAN_TX",
    "CAN_RX",
    "USB_DM",
    "USB_DP",
    "SYS_SWDIO",
    "SYS_SWCLK",
    "SYS_NRST"
]

MCU_PROFILES: Dict[str, Dict[str, Any]] = {
    "STM32G030F6P6": {
        "id": "STM32G030F6P6",
        "name": "STM32G030F6P6 (Cortex-M0+ 64MHz)",
        "vendor": "STMicroelectronics",
        "family": "STM32G0",
        "core": "ARM Cortex-M0+ @ 64MHz",
        "package": "TSSOP-20",
        "cpu_flag": "-mcpu=cortex-m0plus",
        "define_macro": "-DSTM32G030xx",
        "flash_kb": 32,
        "ram_kb": 8,
        "max_user_io": 18,
        "voltage": "2.0V ~ 3.6V",
        "special_pins": {
            "PA13": "SWDIO 默认调试口，不建议复用为重负载输出",
            "PA14": "SWCLK / BOOT0 共用引脚，上电期间避免外部强上拉导致误进 Bootloader",
            "NRST": "低电平复位引脚，建议配置 100nF 对地滤波电容"
        },
        "all_pins": [
            "PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7",
            "PB0", "PB1", "PA8", "PA9", "PA10", "PA11", "PA12", "PA13", "PA14", "PB6", "PB7", "NRST"
        ],
        "adc_pins": ["PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PB0", "PB1", "PA11", "PA12"],
        "i2c_pins": ["PB6", "PB7", "PB8", "PB9", "PA9", "PA10"],
        "pwm_pins": ["PA0", "PA1", "PA2", "PA3", "PA4", "PA6", "PA7", "PB0", "PB1", "PA8"],
        "common_functions": COMMON_PIN_FUNCTIONS
    },
    "STM32L011F4U6TR": {
        "id": "STM32L011F4U6TR",
        "name": "STM32L011F4U6TR (超低功耗 Cortex-M0+ 32MHz)",
        "vendor": "STMicroelectronics",
        "family": "STM32L0",
        "core": "ARM Cortex-M0+ Ultra-Low-Power @ 32MHz",
        "package": "UFQFPN-20",
        "cpu_flag": "-mcpu=cortex-m0plus",
        "define_macro": "-DSTM32L011xx",
        "flash_kb": 16,
        "ram_kb": 2,
        "max_user_io": 16,
        "voltage": "1.65V ~ 3.6V",
        "special_pins": {
            "PA13": "SWDIO 调试数据线",
            "PA14": "SWCLK 调试时钟线",
            "BOOT0": "必须通过 10kΩ 电阻可靠下拉至 GND"
        },
        "all_pins": [
            "PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7",
            "PB0", "PB1", "PA8", "PA9", "PA10", "PA13", "PA14", "PB6", "PB7", "NRST"
        ],
        "adc_pins": ["PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PB0", "PB1"],
        "i2c_pins": ["PA9", "PA10", "PB6", "PB7"],
        "pwm_pins": ["PA0", "PA1", "PA2", "PA3", "PA5", "PB1"],
        "common_functions": COMMON_PIN_FUNCTIONS
    },
    "STM32F103C8T6": {
        "id": "STM32F103C8T6",
        "name": "STM32F103C8T6 (Cortex-M3 72MHz 经典主力)",
        "vendor": "STMicroelectronics / GD32",
        "family": "STM32F1",
        "core": "ARM Cortex-M3 @ 72MHz",
        "package": "LQFP-48",
        "cpu_flag": "-mcpu=cortex-m3",
        "define_macro": "-DSTM32F103xB",
        "flash_kb": 64,
        "ram_kb": 20,
        "max_user_io": 37,
        "voltage": "2.0V ~ 3.6V",
        "special_pins": {
            "PB3": "默认 JTAG JTDO，作为普通 GPIO 需在固件开启 AFIO_MAPR_SWJ_CFG_JTAGDISABLE",
            "PB4": "默认 JTAG NJTRST，需禁用 JTAG 方可作为普通 GPIO",
            "PA15": "默认 JTAG JTDI，需禁用 JTAG 方可作为普通 GPIO",
            "PC13": "侵入检测/RTC 引脚，灌电流能力受限 (<3mA)，严禁直接驱动大电流负载"
        },
        "all_pins": [
            "PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PA8", "PA9", "PA10", "PA11", "PA12", "PA13", "PA14", "PA15",
            "PB0", "PB1", "PB3", "PB4", "PB5", "PB6", "PB7", "PB8", "PB9", "PB10", "PB11", "PB12", "PB13", "PB14", "PB15",
            "PC13", "PC14", "PC15", "NRST"
        ],
        "adc_pins": ["PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PB0", "PB1"],
        "i2c_pins": ["PB6", "PB7", "PB10", "PB11"],
        "pwm_pins": ["PA0", "PA1", "PA2", "PA3", "PA6", "PA7", "PA8", "PA9", "PA10", "PB0", "PB1", "PB6", "PB7", "PB8", "PB9"],
        "common_functions": COMMON_PIN_FUNCTIONS
    },
    "STM32F401CCU6": {
        "id": "STM32F401CCU6",
        "name": "STM32F401CCU6 (Cortex-M4F 84MHz 带浮点)",
        "vendor": "STMicroelectronics",
        "family": "STM32F4",
        "core": "ARM Cortex-M4F (FPU) @ 84MHz",
        "package": "UFQFPN-48",
        "cpu_flag": "-mcpu=cortex-m4",
        "define_macro": "-DSTM32F401xC",
        "flash_kb": 256,
        "ram_kb": 64,
        "max_user_io": 36,
        "voltage": "1.7V ~ 3.6V",
        "special_pins": {
            "VCAP1": "内核稳压引脚，必须外接 4.7uF 低 ESR 陶瓷电容至 GND",
            "BOOT0": "需通过 10kΩ 电阻下拉至 GND"
        },
        "all_pins": [
            "PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PA8", "PA9", "PA10", "PA11", "PA12", "PA13", "PA14", "PA15",
            "PB0", "PB1", "PB2", "PB3", "PB4", "PB5", "PB6", "PB7", "PB8", "PB9", "PB10", "PB12", "PB13", "PB14", "PB15",
            "PC13", "PC14", "PC15", "NRST"
        ],
        "adc_pins": ["PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PB0", "PB1"],
        "i2c_pins": ["PB6", "PB7", "PB8", "PB9", "PB10", "PB3"],
        "pwm_pins": ["PA0", "PA1", "PA2", "PA3", "PA5", "PA6", "PA7", "PA8", "PA9", "PA10", "PB0", "PB1", "PB6", "PB7", "PB8", "PB9"],
        "common_functions": COMMON_PIN_FUNCTIONS
    },
    "ESP32-S3-WROOM-1": {
        "id": "ESP32-S3-WROOM-1",
        "name": "ESP32-S3-WROOM-1 (双核 LX7 Wi-Fi/BLE 240MHz)",
        "vendor": "Espressif (乐鑫)",
        "family": "ESP32-S3",
        "core": "Xtensa Dual-Core LX7 @ 240MHz",
        "package": "Module-41",
        "cpu_flag": "-mcpu=cortex-m4",
        "define_macro": "-DESP32_S3",
        "flash_kb": 8192,
        "ram_kb": 512,
        "max_user_io": 36,
        "voltage": "3.0V ~ 3.6V (峰值电流 ≥ 500mA)",
        "special_pins": {
            "GPIO0": "Strapping 启动模式引脚，上电默认弱上拉，低电平进入下载模式",
            "GPIO3": "Strapping JTAG 信号源选择引脚",
            "GPIO45": "Strapping VDD_SPI 电压选择引脚，上电期间严禁外部拉高",
            "GPIO46": "Strapping ROM 日志打印控制引脚，上电期间建议下拉或悬空",
            "GPIO19": "USB_D- 原生差分引脚",
            "GPIO20": "USB_D+ 原生差分引脚"
        },
        "all_pins": [f"GPIO{i}" for i in range(0, 22)] + [f"GPIO{i}" for i in range(35, 49)] + ["EN"],
        "adc_pins": [f"GPIO{i}" for i in range(1, 21)],
        "i2c_pins": [f"GPIO{i}" for i in range(1, 49)],
        "pwm_pins": [f"GPIO{i}" for i in range(1, 49)],
        "common_functions": COMMON_PIN_FUNCTIONS
    }
}


PROJECT_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "env_alarm": {
        "id": "env_alarm",
        "title": "🌡️ 温湿度与气体传感报警节点",
        "badge": "传感器 / 物联网节点",
        "icon": "fa-solid fa-temperature-half text-amber-400",
        "default_name": "Smart-Env-Sensor-Node",
        "description": "集成 SHT30 温湿度 I2C 采集、MQ-2 烟雾模拟量 ADC + 阈值中断、OLED 显示屏与 PWM 蜂鸣器声光报警。",
        "spec": {
            "project_name": "Smart-Env-Sensor-Node",
            "project_summary": "智能温湿度与有害气体监测声光报警节点，带 I2C OLED 显示与低功耗定时巡检。",
            "mechanical": {
                "width_mm": 60.0,
                "height_mm": 40.0,
                "thickness_mm": 1.6,
                "layers": 2,
                "fillet_mm": 1.5,
                "mounting_holes": "四角 M2.5 金属化定位孔",
                "height_limits": "正面限高 ≤ 6.0mm",
                "keepouts": "板边 3.0mm 法拉第屏蔽笼接地过孔阵列"
            },
            "power": {
                "input_source": "USB Type-C 5V / 3.7V 锂电池双路供电",
                "operating_voltage": "3.3V",
                "boost_or_buck": "低静态电流 LDO (ME6211C33)",
                "max_current": "300mA",
                "low_power_spec": "支持周期休眠采样",
                "protection": ["PMOS 防反接保护", "ESD TVS 静电防护", "电源输入自恢复保险丝"]
            },
            "mcu": {
                "model": "STM32G030F6P6",
                "package": "TSSOP-20",
                "debug_interface": "SWD",
                "firmware_framework": "纯嵌入式 C99 (裸机非阻塞状态机)"
            },
            "peripherals": [
                "SHT30 温湿度传感器 (I2C1)",
                "MQ-2 烟雾传感器 (ADC + 数字比较中断)",
                "0.96寸 SSD1306 OLED 显示屏 (I2C1)",
                "无源蜂鸣器 PWM 驱动",
                "双色状态指示灯 (绿/红)",
                "消音与自检按键"
            ],
            "manufacturing": {
                "fab": "JLCPCB (嘉立创)",
                "finish": "ENIG (沉金)",
                "faraday_cage": True,
                "acid_trap_chamfer": True
            }
        },
        "pinout": [
            {"pin": "PA0", "net_name": "GAS_ADC", "function": "ADC_IN0", "description": "MQ-2 气体传感器模拟电压采样"},
            {"pin": "PA1", "net_name": "GAS_DOUT", "function": "GPIO_EXTI1", "description": "MQ-2 气体超限数字比较中断输入"},
            {"pin": "PA4", "net_name": "BUZZER_PWM", "function": "TIM14_CH1_PWM", "description": "无源蜂鸣器 2.7kHz PWM 报警驱动"},
            {"pin": "PA5", "net_name": "LED_RUN_GRN", "function": "GPIO_Output", "description": "系统正常巡检绿色心跳指示灯"},
            {"pin": "PA6", "net_name": "LED_ALM_RED", "function": "GPIO_Output", "description": "超限报警红色高亮闪烁指示灯"},
            {"pin": "PB0", "net_name": "KEY_MUTE", "function": "GPIO_Input", "description": "报警消音与自检用户按键 (低有效)"},
            {"pin": "PB6", "net_name": "I2C1_SCL", "function": "I2C1_SCL", "description": "SHT30 与 OLED 共用 I2C 时钟线"},
            {"pin": "PB7", "net_name": "I2C1_SDA", "function": "I2C1_SDA", "description": "SHT30 与 OLED 共用 I2C 数据线"},
            {"pin": "PA13", "net_name": "SWDIO", "function": "SYS_SWDIO", "description": "SWD 调试数据接口"},
            {"pin": "PA14", "net_name": "SWCLK", "function": "SYS_SWCLK", "description": "SWD 调试时钟接口"}
        ]
    },
    "motor_ctrl": {
        "id": "motor_ctrl",
        "title": "⚙️ 直流无刷/步进电机闭环驱动板",
        "badge": "工业控制 / 运动驱动",
        "icon": "fa-solid fa-gears text-sky-400",
        "default_name": "FOC-Motor-Driver-Ctrl",
        "description": "基于 STM32F103C8T6 的电机闭环控制板，含三相互补 PWM、母线电流/电压 ADC 采样、正交编码器接口与过流硬件保护。",
        "spec": {
            "project_name": "FOC-Motor-Driver-Ctrl",
            "project_summary": "12V~24V 直流无刷/步进电机闭环驱动控制板，支持三相 PWM 调制、电流采样、编码器反馈与 UART/CAN 总线通信。",
            "mechanical": {
                "width_mm": 70.0,
                "height_mm": 50.0,
                "thickness_mm": 1.6,
                "layers": 2,
                "fillet_mm": 2.0,
                "mounting_holes": "四角 M3 安装孔",
                "height_limits": "正面限高 ≤ 12.0mm",
                "keepouts": "功率地 PGND 与数字地 AGND 单点汇接 + 板边屏蔽孔"
            },
            "power": {
                "input_source": "12V ~ 24V 直流母线输入 (XT30 接口)",
                "operating_voltage": "24V 功率轨 + 5V 栅极驱动 + 3.3V MCU",
                "boost_or_buck": "DC-DC 同步降压 (24V->5V) + LDO (5V->3.3V)",
                "max_current": "5000mA",
                "low_power_spec": "硬件过流关断响应 < 2us",
                "protection": ["TVS 母线尖峰吸收", "低边采样电阻过流比较保护", "防反接 MOSFET"]
            },
            "mcu": {
                "model": "STM32F103C8T6",
                "package": "LQFP-48",
                "debug_interface": "SWD",
                "firmware_framework": "纯嵌入式 C99 (定时器中断闭环控制)"
            },
            "peripherals": [
                "TIM1 三相 PWM 输出 (PWM_U / PWM_V / PWM_W)",
                "母线电压与相电流 ADC 采样",
                "ABZ 正交编码器接口",
                "DRV_EN 使能与 nFAULT 硬件故障中断",
                "UART1 上位机调试接口"
            ],
            "manufacturing": {
                "fab": "JLCPCB (嘉立创)",
                "finish": "ENIG (沉金)",
                "faraday_cage": True,
                "acid_trap_chamfer": True
            }
        },
        "pinout": [
            {"pin": "PA0", "net_name": "IBUS_ADC", "function": "ADC_IN0", "description": "母线总电流运算放大器采样输入"},
            {"pin": "PA1", "net_name": "VBUS_ADC", "function": "ADC_IN1", "description": "12V/24V 母线电压分压监测输入"},
            {"pin": "PA8", "net_name": "PWM_UH", "function": "TIM1_CH1_PWM", "description": "U 相高边栅极 PWM 驱动输出"},
            {"pin": "PA9", "net_name": "PWM_VH", "function": "TIM1_CH2_PWM", "description": "V 相高边栅极 PWM 驱动输出"},
            {"pin": "PA10", "net_name": "PWM_WH", "function": "TIM1_CH3_PWM", "description": "W 相高边栅极 PWM 驱动输出"},
            {"pin": "PB0", "net_name": "DRV_EN", "function": "GPIO_Output", "description": "预驱芯片总使能控制信号"},
            {"pin": "PB1", "net_name": "DRV_NFAULT", "function": "GPIO_EXTI1", "description": "预驱过流/过温故障低电平中断"},
            {"pin": "PB6", "net_name": "ENC_A", "function": "TIM4_CH1", "description": "磁编码器/光电编码器 A 相脉冲"},
            {"pin": "PB7", "net_name": "ENC_B", "function": "TIM4_CH2", "description": "磁编码器/光电编码器 B 相脉冲"},
            {"pin": "PA2", "net_name": "UART2_TX", "function": "USART2_TX", "description": "上位机指令串口发送端"},
            {"pin": "PA3", "net_name": "UART2_RX", "function": "USART2_RX", "description": "上位机指令串口接收端"},
            {"pin": "PA13", "net_name": "SWDIO", "function": "SYS_SWDIO", "description": "SWD 调试数据接口"},
            {"pin": "PA14", "net_name": "SWCLK", "function": "SYS_SWCLK", "description": "SWD 调试时钟接口"}
        ]
    },
    "esp32_iot": {
        "id": "esp32_iot",
        "title": "📡 ESP32-S3 无线物联网边缘网关",
        "badge": "Wi-Fi / BLE / RS485",
        "icon": "fa-solid fa-tower-broadcast text-emerald-400",
        "default_name": "ESP32S3-IoT-Edge-Gateway",
        "description": "基于 ESP32-S3-WROOM-1 的无线边缘网关，集成原生 USB 接口、隔离 RS485 工业总线、I2C 环境传感与 RGB 状态灯。",
        "spec": {
            "project_name": "ESP32S3-IoT-Edge-Gateway",
            "project_summary": "支持 Wi-Fi/BLE 双模与 RS485 工业总线协议转换的物联网边缘网关主板。",
            "mechanical": {
                "width_mm": 65.0,
                "height_mm": 45.0,
                "thickness_mm": 1.6,
                "layers": 2,
                "fillet_mm": 1.5,
                "mounting_holes": "四角 M2.5 安装孔",
                "height_limits": "正面限高 ≤ 8.0mm",
                "keepouts": "天线净空区严禁铺铜 + 板边接地屏蔽孔"
            },
            "power": {
                "input_source": "DC 9V~24V 工业端子 / USB Type-C 5V",
                "operating_voltage": "3.3V (峰值电流 ≥ 800mA)",
                "boost_or_buck": "DC-DC 降压稳压 3.3V",
                "max_current": "1000mA",
                "low_power_spec": "支持 Modem-sleep 低功耗模式",
                "protection": ["RS485 A/B 端口防雷 TVS", "电源防反接保护", "USB ESD 阵列"]
            },
            "mcu": {
                "model": "ESP32-S3-WROOM-1",
                "package": "Module-41",
                "debug_interface": "USB-JTAG / UART0",
                "firmware_framework": "嵌入式 C99 状态机框架"
            },
            "peripherals": [
                "RS485 收发器 (UART1 + DE/RE 方向控制)",
                "板载温湿度传感器 (I2C)",
                "WS2812 RGB 彩灯控制",
                "原生 USB Type-C 差分接口 (GPIO19/20)",
                "配网复位按键 (BOOT)"
            ],
            "manufacturing": {
                "fab": "JLCPCB (嘉立创)",
                "finish": "ENIG (沉金)",
                "faraday_cage": True,
                "acid_trap_chamfer": True
            }
        },
        "pinout": [
            {"pin": "GPIO1", "net_name": "VIN_ADC", "function": "ADC_IN0", "description": "工业直流输入母线电压监测"},
            {"pin": "GPIO4", "net_name": "RS485_TX", "function": "USART1_TX", "description": "RS485 隔离收发器发送数据"},
            {"pin": "GPIO5", "net_name": "RS485_RX", "function": "USART1_RX", "description": "RS485 隔离收发器接收数据"},
            {"pin": "GPIO6", "net_name": "RS485_DE", "function": "GPIO_Output", "description": "RS485 发送/接收方向切换控制"},
            {"pin": "GPIO8", "net_name": "I2C_SDA", "function": "I2C1_SDA", "description": "板载传感器 I2C 数据线"},
            {"pin": "GPIO9", "net_name": "I2C_SCL", "function": "I2C1_SCL", "description": "板载传感器 I2C 时钟线"},
            {"pin": "GPIO18", "net_name": "LED_STATUS", "function": "GPIO_Output", "description": "网络通信状态指示灯"},
            {"pin": "GPIO19", "net_name": "USB_DM", "function": "USB_DM", "description": "USB 原生差分 D- 数据线"},
            {"pin": "GPIO20", "net_name": "USB_DP", "function": "USB_DP", "description": "USB 原生差分 D+ 数据线"}
        ]
    },
    "low_power_wearable": {
        "id": "low_power_wearable",
        "title": "🔋 超低功耗便携/光学驱动主板",
        "badge": "电池供电 / 紧凑穿戴",
        "icon": "fa-solid fa-battery-full text-purple-400",
        "default_name": "UltraLowPower-Optic-Board",
        "description": "基于 STM32L011F4U6TR 的超低功耗掌上/头戴设备主板，含电池电量监测、环境光自适应 PWM、霍尔磁控唤醒与法拉第屏蔽笼。",
        "spec": {
            "project_name": "UltraLowPower-Optic-Board",
            "project_summary": "超低功耗便携式光学控制板，待机电流 < 5uA，集成光敏 ADC、红外补光 PWM 与霍尔磁控休眠唤醒。",
            "mechanical": {
                "width_mm": 55.0,
                "height_mm": 26.0,
                "thickness_mm": 1.0,
                "layers": 2,
                "fillet_mm": 1.0,
                "mounting_holes": "两端 M2 定位孔",
                "height_limits": "正面限高 ≤ 4.2mm",
                "keepouts": "板边 3.0mm 法拉第屏蔽笼地孔"
            },
            "power": {
                "input_source": "1.5V AA 干电池 / 3.7V 锂电池",
                "operating_voltage": "3.3V",
                "boost_or_buck": "同步升压 Boost + 超低静态电流 LDO",
                "max_current": "400mA",
                "low_power_spec": "STOP 模式待机电流 < 3uA",
                "protection": ["PMOS 防反接保护", "ESD TVS 防护", "法拉第环绕屏蔽"]
            },
            "mcu": {
                "model": "STM32L011F4U6TR",
                "package": "UFQFPN-20",
                "debug_interface": "SWD",
                "firmware_framework": "纯嵌入式 C99 (低功耗状态机)"
            },
            "peripherals": [
                "环境光敏传感器 (LDR_ADC)",
                "电池电压采样 (BAT_ADC)",
                "红外补光灯 PWM (IR_PWM)",
                "主电源使能控制 (PWR_EN)",
                "霍尔干簧管唤醒中断 (HALL_INT)",
                "双色低压/补光指示灯"
            ],
            "manufacturing": {
                "fab": "JLCPCB (嘉立创)",
                "finish": "ENIG (沉金)",
                "faraday_cage": True,
                "acid_trap_chamfer": True
            }
        },
        "pinout": [
            {"pin": "PA0", "net_name": "LDR_ADC", "function": "ADC_IN0", "description": "环境光照强度分压采样"},
            {"pin": "PA1", "net_name": "BAT_ADC", "function": "ADC_IN1", "description": "电池实时电压采样"},
            {"pin": "PA2", "net_name": "IR_PWM", "function": "TIM2_CH3_PWM", "description": "红外补光灯 PWM 调光输出"},
            {"pin": "PA3", "net_name": "PWR_BOOST_EN", "function": "GPIO_Output", "description": "高压负载模块供电使能"},
            {"pin": "PA4", "net_name": "HALL_INT", "function": "GPIO_EXTI4", "description": "霍尔磁控翻转休眠唤醒中断"},
            {"pin": "PA5", "net_name": "MODE_SW1", "function": "GPIO_Input", "description": "模式拨档开关 1 输入"},
            {"pin": "PA7", "net_name": "LED_LOWBAT", "function": "GPIO_Output", "description": "低电量红色告警指示灯"},
            {"pin": "PB1", "net_name": "LED_IR_ON", "function": "GPIO_Output", "description": "红外工作状态黄色指示灯"},
            {"pin": "PA13", "net_name": "SWDIO", "function": "SYS_SWDIO", "description": "SWD 调试数据接口"},
            {"pin": "PA14", "net_name": "SWCLK", "function": "SYS_SWCLK", "description": "SWD 调试时钟接口"}
        ]
    },
    "custom_blank": {
        "id": "custom_blank",
        "title": "📄 空白自定义嵌入式硬件工程",
        "badge": "自由定制 / 快速起步",
        "icon": "fa-solid fa-file-circle-plus text-slate-300",
        "default_name": "Custom-Hardware-Board",
        "description": "提供最简核心最小系统（MCU + 3.3V LDO + 去耦电容 + SWD 调试口 + 状态灯 + 按键），适合完全从零自定义外设。",
        "spec": {
            "project_name": "Custom-Hardware-Board",
            "project_summary": "自定义嵌入式 C 与 KiCad PCB 协同开发工程。",
            "mechanical": {
                "width_mm": 50.0,
                "height_mm": 35.0,
                "thickness_mm": 1.6,
                "layers": 2,
                "fillet_mm": 1.5,
                "mounting_holes": "四角 M2.5 定位孔",
                "height_limits": "正面限高 ≤ 8.0mm",
                "keepouts": "板边 3.0mm 法拉第屏蔽笼缝合孔"
            },
            "power": {
                "input_source": "USB Type-C 5V / 3.7V 锂电池",
                "operating_voltage": "3.3V",
                "boost_or_buck": "LDO 稳压 3.3V",
                "max_current": "500mA",
                "low_power_spec": "支持待机休眠",
                "protection": ["PMOS 防反接保护", "ESD TVS 静电防护"]
            },
            "mcu": {
                "model": "STM32G030F6P6",
                "package": "TSSOP-20",
                "debug_interface": "SWD",
                "firmware_framework": "纯嵌入式 C99 (裸机/状态机)"
            },
            "peripherals": ["系统状态指示灯", "用户按键", "SWD 调试接口"],
            "manufacturing": {
                "fab": "JLCPCB (嘉立创)",
                "finish": "ENIG (沉金)",
                "faraday_cage": True,
                "acid_trap_chamfer": True
            }
        },
        "pinout": [
            {"pin": "PA0", "net_name": "USER_KEY1", "function": "GPIO_EXTI0", "description": "用户按键输入 (低电平有效)"},
            {"pin": "PA1", "net_name": "STATUS_LED", "function": "GPIO_Output", "description": "系统运行状态指示灯"},
            {"pin": "PA13", "net_name": "SWDIO", "function": "SYS_SWDIO", "description": "SWD 调试数据接口"},
            {"pin": "PA14", "net_name": "SWCLK", "function": "SYS_SWCLK", "description": "SWD 调试时钟接口"}
        ]
    }
}


def match_mcu_profile(mcu_str: str) -> Dict[str, Any]:
    """根据用户输入的型号模糊匹配最接近的 MCU 规格字典"""
    s = (mcu_str or "").upper().strip()
    for key, prof in MCU_PROFILES.items():
        if key in s or prof["family"].upper() in s:
            return prof
    if "L0" in s:
        return MCU_PROFILES["STM32L011F4U6TR"]
    if "F103" in s or "GD32" in s:
        return MCU_PROFILES["STM32F103C8T6"]
    if "F4" in s:
        return MCU_PROFILES["STM32F401CCU6"]
    if "ESP32" in s:
        return MCU_PROFILES["ESP32-S3-WROOM-1"]
    return MCU_PROFILES["STM32G030F6P6"]


def list_mcu_profiles() -> List[Dict[str, Any]]:
    return list(MCU_PROFILES.values())


def list_project_templates() -> List[Dict[str, Any]]:
    return [copy.deepcopy(t) for t in PROJECT_TEMPLATES.values()]


def get_project_template(template_id: str) -> Optional[Dict[str, Any]]:
    t = PROJECT_TEMPLATES.get(template_id)
    return copy.deepcopy(t) if t else None


def check_mcu_specific_pin_rules(pinout: List[Dict[str, Any]], mcu_str: str) -> Dict[str, Any]:
    """结合 MCU 专属字典检查 ADC 通道合法性、Strapping 陷阱与特殊引脚"""
    prof = match_mcu_profile(mcu_str)
    errors = []
    warnings = []
    special_map = prof.get("special_pins", {})
    adc_set = set(p.upper() for p in prof.get("adc_pins", []))

    for item in pinout:
        pin = str(item.get("pin", "")).strip().upper()
        net = str(item.get("net_name", "")).strip()
        func = str(item.get("function", "")).strip().upper()
        if not pin:
            continue

        # 1. 检查特殊引脚注意事项
        if pin in special_map:
            if pin in ("PA13", "PA14") and ("SWD" in func or "SW" in net.upper()):
                pass
            else:
                warnings.append(f"[{prof['id']} 硬件约束] 引脚 `{pin}` ({net}): {special_map[pin]}")

        # 2. 检查 ADC 功能是否分配到了不支持 ADC 的引脚上
        if "ADC" in func and adc_set and pin not in adc_set and re.match(r"^(P[A-I]\d+|GPIO\d+)$", pin):
            errors.append(
                f"[{prof['id']} 外设冲突] 引脚 `{pin}` (`{net}`) 被配置为 `{func}`，但该芯片的 `{pin}` 不支持硬件 ADC 采样通道！推荐改用: {', '.join(sorted(list(adc_set))[:6])}"
            )

    return {"errors": errors, "warnings": warnings, "profile": prof, "mcu_profile": prof}
