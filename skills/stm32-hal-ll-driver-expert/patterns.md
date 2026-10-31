# 🧩 经典嵌入式 C99 代码模式 (Patterns)

```c
/* 一阶定点 EMA 滤波（零浮点指令，适配 Cortex-M0/M0+/M3） */
static inline uint16_t adc_ema_filter_u16(uint16_t prev_mv, uint16_t raw_mv) {
    return (uint16_t)(((uint32_t)prev_mv * 3U + (uint32_t)raw_mv) >> 2U);
}

/* 非阻塞 20ms 按键消抖状态判定 */
static inline bool gpio_debounce_falling_edge(bool pin_low, uint32_t now_ms, uint32_t *t_mark, bool *latched) {
    if (pin_low) {
        if (*t_mark == 0U) *t_mark = now_ms;
        else if ((now_ms - *t_mark) >= 20U && !(*latched)) {
            *latched = true;
            return true;
        }
    } else {
        *t_mark = 0U;
        *latched = false;
    }
    return false;
}
```
