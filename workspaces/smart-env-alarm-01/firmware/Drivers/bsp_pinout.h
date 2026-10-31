/**
 * @file    bsp_pinout.h
 * @brief   软硬件协同单一事实源 (SSOT) 自动生成引脚定义头文件
 * @project Smart-Env-Alarm-01
 * @mcu     STM32G030F6P6 (TSSOP-20)
 * @board   65.0x45.0mm, 2 Layers
 * @note    本文件由 AI-PCB Platform 根据 pinout.json 自动生成，请勿手工硬编码修改引脚宏。
 */

#ifndef __BSP_PINOUT_H__
#define __BSP_PINOUT_H__

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

#define BSP_PROJECT_NAME        "Smart-Env-Alarm-01"
#define BSP_TARGET_MCU          "STM32G030F6P6"
#define BSP_ASSIGNED_PIN_COUNT  (12U)

/* ========================================================================== */
/* 1. 硬件网络与 MCU 物理引脚映射宏定义 (SSOT Pinout Macros)                    */
/* ========================================================================== */
/* [PA0] MQ2_AO : MQ-2模拟输出，12位ADC采样烟雾浓度 (ADC_IN0) */
#define PIN_MQ2_AO_NAME          "PA0"
#define PIN_MQ2_AO_PORT_NAME     "GPIOA"
#define PIN_MQ2_AO_PIN_INDEX     (0U)
#define PIN_MQ2_AO_BIT_MASK      (1UL << 0U)
#define PIN_MQ2_AO_ALT_FUNC      "ADC_IN0"

/* [PA1] MQ2_DO : MQ-2数字输出（LM393比较器输出），下降沿触发报警中断 (EXTI1) */
#define PIN_MQ2_DO_NAME          "PA1"
#define PIN_MQ2_DO_PORT_NAME     "GPIOA"
#define PIN_MQ2_DO_PIN_INDEX     (1U)
#define PIN_MQ2_DO_BIT_MASK      (1UL << 1U)
#define PIN_MQ2_DO_ALT_FUNC      "EXTI1"

/* [PA2] BUZZER_PWM : 蜂鸣器驱动信号，2.7kHz PWM，经MOSFET低端开关 (TIM2_CH3 (PWM)) */
#define PIN_BUZZER_PWM_NAME          "PA2"
#define PIN_BUZZER_PWM_PORT_NAME     "GPIOA"
#define PIN_BUZZER_PWM_PIN_INDEX     (2U)
#define PIN_BUZZER_PWM_BIT_MASK      (1UL << 2U)
#define PIN_BUZZER_PWM_ALT_FUNC      "TIM2_CH3 (PWM)"

/* [PA3] LED_RUN : 绿色运行指示灯，正常时每2秒慢闪 (GPIO_OUT) */
#define PIN_LED_RUN_NAME          "PA3"
#define PIN_LED_RUN_PORT_NAME     "GPIOA"
#define PIN_LED_RUN_PIN_INDEX     (3U)
#define PIN_LED_RUN_BIT_MASK      (1UL << 3U)
#define PIN_LED_RUN_ALT_FUNC      "GPIO_OUT"

/* [PA4] LED_ALARM : 红色报警指示灯，报警时5Hz快闪 (GPIO_OUT) */
#define PIN_LED_ALARM_NAME          "PA4"
#define PIN_LED_ALARM_PORT_NAME     "GPIOA"
#define PIN_LED_ALARM_PIN_INDEX     (4U)
#define PIN_LED_ALARM_BIT_MASK      (1UL << 4U)
#define PIN_LED_ALARM_ALT_FUNC      "GPIO_OUT"

/* [PA5] KEY1 : 按键1：短按消音，长按3秒校准烟雾基准 (GPIO_IN (EXTI)) */
#define PIN_KEY1_NAME          "PA5"
#define PIN_KEY1_PORT_NAME     "GPIOA"
#define PIN_KEY1_PIN_INDEX     (5U)
#define PIN_KEY1_BIT_MASK      (1UL << 5U)
#define PIN_KEY1_ALT_FUNC      "GPIO_IN (EXTI)"

/* [PA6] KEY2 : 按键2：短按翻页，长按2秒自检 (GPIO_IN (EXTI)) */
#define PIN_KEY2_NAME          "PA6"
#define PIN_KEY2_PORT_NAME     "GPIOA"
#define PIN_KEY2_PIN_INDEX     (6U)
#define PIN_KEY2_BIT_MASK      (1UL << 6U)
#define PIN_KEY2_ALT_FUNC      "GPIO_IN (EXTI)"

/* [PB8] I2C1_SCL : I2C时钟线，连接SHT30和OLED，4.7kΩ上拉 (I2C1_SCL) */
#define PIN_I2C1_SCL_NAME          "PB8"
#define PIN_I2C1_SCL_PORT_NAME     "GPIOB"
#define PIN_I2C1_SCL_PIN_INDEX     (8U)
#define PIN_I2C1_SCL_BIT_MASK      (1UL << 8U)
#define PIN_I2C1_SCL_ALT_FUNC      "I2C1_SCL"

/* [PB9] I2C1_SDA : I2C数据线，连接SHT30和OLED，4.7kΩ上拉 (I2C1_SDA) */
#define PIN_I2C1_SDA_NAME          "PB9"
#define PIN_I2C1_SDA_PORT_NAME     "GPIOB"
#define PIN_I2C1_SDA_PIN_INDEX     (9U)
#define PIN_I2C1_SDA_BIT_MASK      (1UL << 9U)
#define PIN_I2C1_SDA_ALT_FUNC      "I2C1_SDA"

/* [PA13] SWDIO : SWD调试数据口，接ST-Link (SWDIO) */
#define PIN_SWDIO_NAME          "PA13"
#define PIN_SWDIO_PORT_NAME     "GPIOA"
#define PIN_SWDIO_PIN_INDEX     (13U)
#define PIN_SWDIO_BIT_MASK      (1UL << 13U)
#define PIN_SWDIO_ALT_FUNC      "SWDIO"

/* [PA14] SWCLK : SWD调试时钟口，接ST-Link (SWCLK) */
#define PIN_SWCLK_NAME          "PA14"
#define PIN_SWCLK_PORT_NAME     "GPIOA"
#define PIN_SWCLK_PIN_INDEX     (14U)
#define PIN_SWCLK_BIT_MASK      (1UL << 14U)
#define PIN_SWCLK_ALT_FUNC      "SWCLK"

/* [BOOT0] BOOT0 : 启动模式选择，10kΩ下拉到GND (BOOT0) */
#define PIN_BOOT0_NAME          "BOOT0"
#define PIN_BOOT0_PORT_NAME     "SYS_PORT"
#define PIN_BOOT0_PIN_INDEX     (11U)
#define PIN_BOOT0_BIT_MASK      (1UL << 11U)
#define PIN_BOOT0_ALT_FUNC      "BOOT0"

/* ========================================================================== */
/* 2. 引脚描述符结构体与静态只读映射表                                          */
/* ========================================================================== */
typedef struct {
    const char *pin_name;
    const char *port_name;
    uint8_t     pin_index;
    const char *net_name;
    const char *alt_function;
    const char *description;
} bsp_pin_descriptor_t;

static const bsp_pin_descriptor_t g_bsp_pinout_table[BSP_ASSIGNED_PIN_COUNT > 0 ? BSP_ASSIGNED_PIN_COUNT : 1] = {
    { "PA0", "GPIOA", 0U, "MQ2_AO", "ADC_IN0", "MQ-2模拟输出，12位ADC采样烟雾浓度" },
    { "PA1", "GPIOA", 1U, "MQ2_DO", "EXTI1", "MQ-2数字输出（LM393比较器输出），下降沿触发报警中断" },
    { "PA2", "GPIOA", 2U, "BUZZER_PWM", "TIM2_CH3 (PWM)", "蜂鸣器驱动信号，2.7kHz PWM，经MOSFET低端开关" },
    { "PA3", "GPIOA", 3U, "LED_RUN", "GPIO_OUT", "绿色运行指示灯，正常时每2秒慢闪" },
    { "PA4", "GPIOA", 4U, "LED_ALARM", "GPIO_OUT", "红色报警指示灯，报警时5Hz快闪" },
    { "PA5", "GPIOA", 5U, "KEY1", "GPIO_IN (EXTI)", "按键1：短按消音，长按3秒校准烟雾基准" },
    { "PA6", "GPIOA", 6U, "KEY2", "GPIO_IN (EXTI)", "按键2：短按翻页，长按2秒自检" },
    { "PB8", "GPIOB", 8U, "I2C1_SCL", "I2C1_SCL", "I2C时钟线，连接SHT30和OLED，4.7kΩ上拉" },
    { "PB9", "GPIOB", 9U, "I2C1_SDA", "I2C1_SDA", "I2C数据线，连接SHT30和OLED，4.7kΩ上拉" },
    { "PA13", "GPIOA", 13U, "SWDIO", "SWDIO", "SWD调试数据口，接ST-Link" },
    { "PA14", "GPIOA", 14U, "SWCLK", "SWCLK", "SWD调试时钟口，接ST-Link" },
    { "BOOT0", "SYS_PORT", 11U, "BOOT0", "BOOT0", "启动模式选择，10kΩ下拉到GND" }
};

#ifdef __cplusplus
}
#endif

#endif /* __BSP_PINOUT_H__ */
