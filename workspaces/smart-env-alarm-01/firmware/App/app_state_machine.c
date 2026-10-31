/**
 * @file    app_state_machine.c
 * @brief   自动绑定 bsp_pinout.h 外设引脚的非阻塞业务状态机 (AI Copilot 对话增强版)
 * @project Smart-Env-Alarm-01 (STM32G030F6P6)
 * @prompt  请在状态机中增加非阻塞式按键消抖与一阶 EMA ADC 滤波状态机，并立即调用 GCC 重新编译验证
 */
#include "app_state_machine.h"
#include "bsp_hal.h"

static app_context_t s_app_ctx;
static uint8_t       s_key_debounce_cnt   = 0U;
static bool          s_key_stable_pressed = false;
static uint16_t      s_adc_ema_mv         = 1650U;

/**
 * @brief 一阶指数移动平均 (EMA) ADC 滤波器，消除电源与传感器高频毛刺
 */
static uint16_t App_FilterAdcEma(uint16_t raw_mv, uint16_t prev_ema)
{
    return (uint16_t)(((uint32_t)raw_mv + (uint32_t)prev_ema * 3UL) >> 2U);
}

/**
 * @brief 非阻塞式按键消抖检测 (连续 4 个采样周期一致才确认状态翻转)
 */
static void App_ProcessKeyDebounce(bool raw_pressed)
{
    if (raw_pressed != s_key_stable_pressed) {
        s_key_debounce_cnt++;
        if (s_key_debounce_cnt >= 4U) {
            s_key_stable_pressed = raw_pressed;
            s_key_debounce_cnt = 0U;
            if (s_key_stable_pressed && s_app_ctx.alarm_latched) {
                /* 用户按下消音/复位键，解除报警锁定 */
                s_app_ctx.alarm_latched = false;
            }
        }
    } else {
        s_key_debounce_cnt = 0U;
    }
}

void App_StateMachine_Init(void)
{
    s_app_ctx.current_state       = APP_STATE_BOOT_CHECK;
    s_app_ctx.last_sensor_poll_ms = 0UL;
    s_app_ctx.last_heartbeat_ms   = 0UL;
    s_app_ctx.primary_adc_mv      = 1650U;
    s_app_ctx.alarm_threshold_mv  = 2500U;
    s_app_ctx.alarm_latched       = false;
    s_key_debounce_cnt            = 0U;
    s_key_stable_pressed          = false;
}

void App_StateMachine_Step(void)
{
    uint32_t now = BSP_GetTickMs();

    switch (s_app_ctx.current_state) {
    case APP_STATE_BOOT_CHECK:
        /* 上电自检所有在 bsp_pinout.h 中分配的 GPIO 引脚 */
        for (uint32_t i = 0U; i < BSP_ASSIGNED_PIN_COUNT; i++) {
            BSP_GPIO_WritePin(g_bsp_pinout_table[i].pin_index, false);
        }
        s_app_ctx.current_state = APP_STATE_NORMAL_RUN;
        break;

    case APP_STATE_NORMAL_RUN:
        /* 每 20ms 执行一次非阻塞按键消抖与 ADC EMA 滤波采样 */
        if ((now - s_app_ctx.last_sensor_poll_ms) >= 20UL) {
            s_app_ctx.last_sensor_poll_ms = now;
            bool key_raw = (BSP_ASSIGNED_PIN_COUNT > 0U)
                ? !BSP_GPIO_ReadPin(g_bsp_pinout_table[0].pin_index)
                : false;
            App_ProcessKeyDebounce(key_raw);

            uint16_t raw_mv = BSP_ADC_ReadMillivolts(0U);
            s_adc_ema_mv = App_FilterAdcEma(raw_mv, s_adc_ema_mv);
            s_app_ctx.primary_adc_mv = s_adc_ema_mv;

            if (s_app_ctx.primary_adc_mv >= s_app_ctx.alarm_threshold_mv) {
                s_app_ctx.alarm_latched = true;
                s_app_ctx.current_state = APP_STATE_ALARM_ACTIVE;
            }
        }
        /* 每 500ms 翻转一次运行状态指示灯 */
        if ((now - s_app_ctx.last_heartbeat_ms) >= 500UL) {
            s_app_ctx.last_heartbeat_ms = now;
            if (BSP_ASSIGNED_PIN_COUNT > 1U) {
                BSP_GPIO_TogglePin(g_bsp_pinout_table[1].pin_index);
            }
        }
        break;

    case APP_STATE_ALARM_ACTIVE:
        /* 报警激活态：开启蜂鸣器间歇 PWM (50% 占空比) 并检测消抖按键或信号恢复 */
        BSP_PWM_SetDutyPermille(0U, ((now >> 7U) & 1UL) ? 500U : 0U);
        if (s_adc_ema_mv < (s_app_ctx.alarm_threshold_mv - 150U)) {
            s_app_ctx.alarm_latched = false;
        }
        if (!s_app_ctx.alarm_latched) {
            BSP_PWM_SetDutyPermille(0U, 0U);
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
