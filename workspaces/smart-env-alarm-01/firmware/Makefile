# Auto-generated Makefile for Smart_Env_Alarm_01 (STM32G030F6P6)
TARGET = Smart_Env_Alarm_01
BUILD_DIR = build

CC = arm-none-eabi-gcc
OBJCOPY = arm-none-eabi-objcopy
SIZE = arm-none-eabi-size

CFLAGS = -mcpu=cortex-m0plus -mthumb -DSTM32G030xx -std=c99 -ffreestanding -Os \
         -Wall -Wextra -fdata-sections -ffunction-sections \
         -IApp -IDrivers -ICore

LDFLAGS = -mcpu=cortex-m0plus -mthumb -nostdlib -TCore/linker_flash.ld \
          -Wl,--gc-sections -Wl,-Map=$(BUILD_DIR)/$(TARGET).map

SRCS = Core/startup_minimal.c Drivers/bsp_hal.c App/app_state_machine.c App/main.c

all:
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) $(SRCS) $(LDFLAGS) -o $(BUILD_DIR)/$(TARGET).elf
	$(OBJCOPY) -O ihex $(BUILD_DIR)/$(TARGET).elf $(BUILD_DIR)/$(TARGET).hex
	$(OBJCOPY) -O binary $(BUILD_DIR)/$(TARGET).elf $(BUILD_DIR)/$(TARGET).bin
	$(SIZE) $(BUILD_DIR)/$(TARGET).elf
