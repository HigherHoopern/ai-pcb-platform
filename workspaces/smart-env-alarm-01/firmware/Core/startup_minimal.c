/**
 * @file    startup_minimal.c
 * @brief   Cortex-M 最小中断向量表与 C 运行时零初始化例程 (STM32G030F6P6)
 */
#include <stdint.h>

extern uint32_t _estack;
extern uint32_t _sidata;
extern uint32_t _sdata;
extern uint32_t _edata;
extern uint32_t _sbss;
extern uint32_t _ebss;

extern int main(void);
void Reset_Handler(void);
void Default_Handler(void);
void SysTick_Handler(void) __attribute__((weak, alias("Default_Handler")));

__attribute__((section(".isr_vector"), used))
void (* const g_pfnVectors[])(void) = {
    (void (*)(void))(&_estack),
    Reset_Handler,
    Default_Handler, /* NMI */
    Default_Handler, /* HardFault */
    0, 0, 0, 0, 0, 0, 0,
    Default_Handler, /* SVCall */
    0, 0,
    Default_Handler, /* PendSV */
    SysTick_Handler  /* SysTick */
};

void Reset_Handler(void)
{
    uint32_t *src = &_sidata;
    uint32_t *dst = &_sdata;
    while (dst < &_edata) {
        *dst++ = *src++;
    }
    dst = &_sbss;
    while (dst < &_ebss) {
        *dst++ = 0UL;
    }
    (void)main();
    while (1) { }
}

void Default_Handler(void)
{
    while (1) { }
}
