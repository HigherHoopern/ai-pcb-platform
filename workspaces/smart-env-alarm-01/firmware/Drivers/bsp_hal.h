/**
 * @file    bsp_hal.h
 * @brief   基于 bsp_pinout.h (SSOT) 的硬件抽象层接口 (GPIO / ADC / PWM / I2C / SysTick)
 */
#ifndef __BSP_HAL_H__
#define __BSP_HAL_H__

#include <stdint.h>
#include <stdbool.h>
#include "bsp_pinout.h"

void     BSP_System_Init(void);
uint32_t BSP_GetTickMs(void);
void     BSP_DelayMs(uint32_t delay_ms);

void     BSP_GPIO_WritePin(uint8_t pin_idx, bool level);
bool     BSP_GPIO_ReadPin(uint8_t pin_idx);
void     BSP_GPIO_TogglePin(uint8_t pin_idx);

uint16_t BSP_ADC_ReadMillivolts(uint8_t pin_idx);
void     BSP_PWM_SetDutyPermille(uint8_t pin_idx, uint16_t duty_0_to_1000);
bool     BSP_I2C_ReadReg(uint8_t dev_addr, uint8_t reg_addr, uint8_t *buf, uint16_t len);
void     BSP_EnterLowPowerSleep(void);

#endif /* __BSP_HAL_H__ */
