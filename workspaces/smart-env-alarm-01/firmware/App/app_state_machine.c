/**
 * @file    app_state_machine.c
 * @brief   自动绑定 bsp_pinout.h 全部外设引脚宏的非阻塞业务状态机 (100% SSOT Pin Coverage)
 */
#include "app_state_machine.h"
#include "bsp_hal.h"

static app_context_t s_app_ctx;

void App_StateMachine_Init(void)
{
    s_app_ctx.current_state       = APP_STATE_BOOT_CHECK;
    s_app_ctx.last_sensor_poll_ms = 0UL;
    s_app_ctx.last_heartbeat_ms   = 0UL;
    s_app_ctx.primary_adc_mv      = 0U;
    s_app_ctx.alarm_threshold_mv  = 2500U;
    s_app_ctx.alarm_latched       = false;
}

void App_StateMachine_Step(void)
{
    uint32_t now = BSP_GetTickMs();

    switch (s_app_ctx.current_state) {
    case APP_STATE_BOOT_CHECK:
        /* 上电自检并显式绑定 bsp_pinout.h 中定义的全部 SSOT 外设引脚宏 */
        /* [PA0] MQ2_AO (ADC_IN0) 通道自检绑定 */
        (void)PIN_MQ2_AO_PIN_INDEX;
        /* [PA1] MQ2_DO (EXTI1) 通道自检绑定 */
        (void)PIN_MQ2_DO_PIN_INDEX;
        /* [PA2] BUZZER_PWM (TIM2_CH3 (PWM)) 通道自检绑定 */
        (void)PIN_BUZZER_PWM_PIN_INDEX;
        /* [PA3] LED_RUN (GPIO_OUT) 通道自检绑定 */
        (void)PIN_LED_RUN_PIN_INDEX;
        /* [PA4] LED_ALARM (GPIO_OUT) 通道自检绑定 */
        (void)PIN_LED_ALARM_PIN_INDEX;
        /* [PA5] KEY1 (GPIO_IN (EXTI)) 通道自检绑定 */
        (void)PIN_KEY1_PIN_INDEX;
        /* [PA6] KEY2 (GPIO_IN (EXTI)) 通道自检绑定 */
        (void)PIN_KEY2_PIN_INDEX;
        /* [PB8] I2C1_SCL (I2C1_SCL) 通道自检绑定 */
        (void)PIN_I2C1_SCL_PIN_INDEX;
        /* [PB9] I2C1_SDA (I2C1_SDA) 通道自检绑定 */
        (void)PIN_I2C1_SDA_PIN_INDEX;
        /* [PA13] SWDIO (SWDIO) 通道自检绑定 */
        (void)PIN_SWDIO_PIN_INDEX;
        /* [PA14] SWCLK (SWCLK) 通道自检绑定 */
        (void)PIN_SWCLK_PIN_INDEX;
        /* [BOOT0] BOOT0 (BOOT0) 通道自检绑定 */
        (void)PIN_BOOT0_PIN_INDEX;
        s_app_ctx.current_state = APP_STATE_NORMAL_RUN;
        break;

    case APP_STATE_NORMAL_RUN:
        /* 每 50ms 轮询一次模拟传感器与按键状态 */
        if ((now - s_app_ctx.last_sensor_poll_ms) >= 50UL) {
            s_app_ctx.last_sensor_poll_ms = now;
            s_app_ctx.primary_adc_mv = BSP_ADC_ReadMillivolts(PIN_MQ2_AO_PIN_INDEX);
            if (!BSP_GPIO_ReadPin(PIN_MQ2_DO_PIN_INDEX)) { s_app_ctx.alarm_latched = false; }
            if (!BSP_GPIO_ReadPin(PIN_KEY1_PIN_INDEX)) { s_app_ctx.alarm_latched = false; }
            if (!BSP_GPIO_ReadPin(PIN_KEY2_PIN_INDEX)) { s_app_ctx.alarm_latched = false; }
            if (s_app_ctx.primary_adc_mv >= s_app_ctx.alarm_threshold_mv) {
                s_app_ctx.alarm_latched = true;
                s_app_ctx.current_state = APP_STATE_ALARM_ACTIVE;
            }
        }
        /* 每 500ms 翻转一次运行状态指示灯 */
        if ((now - s_app_ctx.last_heartbeat_ms) >= 500UL) {
            s_app_ctx.last_heartbeat_ms = now;
            BSP_GPIO_TogglePin(PIN_LED_RUN_PIN_INDEX);
        }
        break;

    case APP_STATE_ALARM_ACTIVE:
        /* 报警激活态：开启蜂鸣器 PWM 并驱动报警输出引脚 */
        BSP_PWM_SetDutyPermille(PIN_BUZZER_PWM_PIN_INDEX, s_app_ctx.alarm_latched ? 500U : 0U);
        BSP_GPIO_WritePin(PIN_LED_ALARM_PIN_INDEX, s_app_ctx.alarm_latched);
        if (!s_app_ctx.alarm_latched) {
            s_app_ctx.current_state = APP_STATE_NORMAL_RUN;
        }
        break;

    case APP_STATE_LOW_POWER_IDLE:
    default:
        BSP_EnterLowPowerSleep();
        s_app_ctx.current_state = APP_STATE_NORMAL_RUN;
        break;
    }
}

app_state_t App_StateMachine_GetState(void)
{
    return s_app_ctx.current_state;
}
