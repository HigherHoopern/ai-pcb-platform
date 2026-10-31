/**
 * @file    main.c
 * @project Smart_Env_Alarm_01
 * @mcu     STM32G030F6P6
 * @brief   嵌入式 C 主程序入口 (由 AI-PCB Platform 自动生成并与 pinout.json 严格同步)
 */
#include "bsp_pinout.h"
#include "bsp_hal.h"
#include "app_state_machine.h"

int main(void)
{
    /* 1. 初始化时钟、SysTick 与 SSOT 引脚硬件抽象层 */
    BSP_System_Init();

    /* 2. 初始化应用层非阻塞状态机 */
    App_StateMachine_Init();

    /* 3. 主事件调度循环 */
    while (1) {
        App_StateMachine_Step();
    }
}
