/**
 * @file    app_state_machine.h
 * @brief   嵌入式应用业务核心状态机 (Non-blocking Cooperative State Machine)
 */
#ifndef __APP_STATE_MACHINE_H__
#define __APP_STATE_MACHINE_H__

#include <stdint.h>
#include <stdbool.h>

typedef enum {
    APP_STATE_BOOT_CHECK = 0,
    APP_STATE_NORMAL_RUN,
    APP_STATE_ALARM_ACTIVE,
    APP_STATE_LOW_POWER_IDLE
} app_state_t;

typedef struct {
    app_state_t current_state;
    uint32_t    last_sensor_poll_ms;
    uint32_t    last_heartbeat_ms;
    uint16_t    primary_adc_mv;
    uint16_t    alarm_threshold_mv;
    bool        alarm_latched;
} app_context_t;

void        App_StateMachine_Init(void);
void        App_StateMachine_Step(void);
app_state_t App_StateMachine_GetState(void);

#endif /* __APP_STATE_MACHINE_H__ */
