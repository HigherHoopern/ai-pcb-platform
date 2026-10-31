/**
 * @file    bsp_hal.c
 * @brief   基于 bsp_pinout.h 的硬件抽象层实现 (支持裸机寄存器映射与硬件状态模拟)
 */
#include "bsp_hal.h"

static volatile uint32_t s_sys_tick_ms = 0UL;
static volatile uint32_t s_gpio_out_shadow = 0UL;
static volatile uint32_t s_gpio_in_shadow  = 0xFFFFFFFFUL;
static volatile uint16_t s_pwm_duty_table[32] = {0};

/* Cortex-M SysTick 寄存器定义 */
#define SYSTICK_LOAD_REG  (*((volatile uint32_t *)0xE000E014UL))
#define SYSTICK_VAL_REG   (*((volatile uint32_t *)0xE000E018UL))
#define SYSTICK_CTRL_REG  (*((volatile uint32_t *)0xE000E010UL))

void SysTick_Handler(void)
{
    s_sys_tick_ms++;
}

void BSP_System_Init(void)
{
    /* 配置 1ms 系统节拍定时器 (假设默认 16MHz HSI) */
    SYSTICK_LOAD_REG = 16000UL - 1UL;
    SYSTICK_VAL_REG  = 0UL;
    SYSTICK_CTRL_REG = 0x07UL;

    /* 遍历 SSOT 引脚描述符表完成默认安全电平初始化 */
    for (uint32_t i = 0U; i < BSP_ASSIGNED_PIN_COUNT; i++) {
        uint8_t idx = g_bsp_pinout_table[i].pin_index & 0x1FU;
        s_gpio_out_shadow &= ~(1UL << idx);
    }
}

uint32_t BSP_GetTickMs(void)
{
    return s_sys_tick_ms;
}

void BSP_DelayMs(uint32_t delay_ms)
{
    uint32_t start = BSP_GetTickMs();
    while ((BSP_GetTickMs() - start) < delay_ms) {
        __asm volatile ("nop");
    }
}

void BSP_GPIO_WritePin(uint8_t pin_idx, bool level)
{
    uint8_t idx = pin_idx & 0x1FU;
    if (level) {
        s_gpio_out_shadow |= (1UL << idx);
    } else {
        s_gpio_out_shadow &= ~(1UL << idx);
    }
}

bool BSP_GPIO_ReadPin(uint8_t pin_idx)
{
    uint8_t idx = pin_idx & 0x1FU;
    return ((s_gpio_in_shadow >> idx) & 1UL) != 0UL;
}

void BSP_GPIO_TogglePin(uint8_t pin_idx)
{
    uint8_t idx = pin_idx & 0x1FU;
    s_gpio_out_shadow ^= (1UL << idx);
}

uint16_t BSP_ADC_ReadMillivolts(uint8_t pin_idx)
{
    /* 返回 12-bit 采样换算后的毫伏值 (带一阶 IIR 平滑) */
    static uint16_t s_filt_mv = 1650U;
    uint16_t raw_sample = (uint16_t)(1600U + ((s_sys_tick_ms + (uint32_t)pin_idx * 37UL) & 0x7FU));
    s_filt_mv = (uint16_t)(((uint32_t)s_filt_mv * 3UL + raw_sample) >> 2U);
    return s_filt_mv;
}

void BSP_PWM_SetDutyPermille(uint8_t pin_idx, uint16_t duty_0_to_1000)
{
    uint8_t idx = pin_idx & 0x1FU;
    s_pwm_duty_table[idx] = (duty_0_to_1000 > 1000U) ? 1000U : duty_0_to_1000;
}

bool BSP_I2C_ReadReg(uint8_t dev_addr, uint8_t reg_addr, uint8_t *buf, uint16_t len)
{
    (void)dev_addr;
    if (!buf || len == 0U) {
        return false;
    }
    for (uint16_t i = 0U; i < len; i++) {
        buf[i] = (uint8_t)(reg_addr + i);
    }
    return true;
}

void BSP_EnterLowPowerSleep(void)
{
    __asm volatile ("wfi");
}
