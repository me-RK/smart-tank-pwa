/*
 * Smart Tank ESP32 Configuration File
 * 
 * This file contains all configurable parameters for the Smart Tank system.
 * Modify these values according to your specific setup and requirements.
 */

#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "Sivagami Illam 2.4G"
#define WIFI_PASSWORD "Sivagami@27"
#define WIFI_TIMEOUT 30000  // 30 seconds

// WebSocket Configuration
#define WEBSOCKET_PORT 81
#define WEBSOCKET_PING_INTERVAL 30000  // 30 seconds
#define WEBSOCKET_PONG_TIMEOUT 3000    // 3 seconds

// Pin Definitions
#define RELAY1_PIN 25
#define RELAY2_PIN 26
#define OUTPUT1_PIN 18
#define OUTPUT2_PIN 19
#define STATUS_PIN 23
#define FAULT_PIN 15
#define BUZZER_PIN 13
#define CONFIG_PIN 34

// Sensor Configuration
#define SENSOR_A_BAUD 115200
#define SENSOR_B_BAUD 115200
#define SENSOR_COMMAND 0x55
#define SENSOR_RESPONSE_DELAY 50
#define SENSOR_READ_DELAY_A 1000  // milliseconds
#define SENSOR_READ_DELAY_B 1000  // milliseconds

// System Configuration
#define SYSTEM_CHECK_INTERVAL 1000    // 1 second
#define DATA_SEND_INTERVAL 1000       // 1 second
#define FAULT_CHECK_INTERVAL 100      // 100ms
#define BUZZER_FAULT_DURATION 100     // 100ms

// Sensor Limits
#define MIN_SENSOR_VALUE 0
#define MAX_SENSOR_VALUE 5000  // 5 meters in mm
#define SENSOR_TIMEOUT 5000    // 5 seconds

// Task Configuration
#define TASK_STACK_SIZE 2048
#define TASK_PRIORITY_HIGH 3
#define TASK_PRIORITY_NORMAL 1
#define TASK_PRIORITY_LOW 0

// Core Assignment
#define SENSOR_A_CORE 0
#define SENSOR_B_CORE 1

// Debug Configuration
#define DEBUG_SERIAL_BAUD 115200
#define DEBUG_ENABLED true
#define DEBUG_SENSOR_DATA true
#define DEBUG_WEBSOCKET true
#define DEBUG_SYSTEM_STATUS true

// Safety Configuration
#define MAX_PUMP_RUNTIME 300000  // 5 minutes in milliseconds
#define FAULT_BUZZER_PATTERN 3   // Number of beeps for fault
#define SYSTEM_RESET_TIMEOUT 60000  // 1 minute

// JSON Buffer Sizes
#define JSON_BUFFER_SIZE 1024
#define JSON_SENSOR_DATA_SIZE 512
#define JSON_STATUS_SIZE 256

// Network Configuration
#define MAX_CLIENTS 4
#define CONNECTION_TIMEOUT 30000  // 30 seconds

// EEPROM Configuration
#define EEPROM_SIZE 512
#define EEPROM_WIFI_SSID_ADDR 0
#define EEPROM_WIFI_PASS_ADDR 64
#define EEPROM_SENSOR_DELAY_A_ADDR 128
#define EEPROM_SENSOR_DELAY_B_ADDR 132

// Version Information
#define FIRMWARE_VERSION "1.0.0"
#define HARDWARE_VERSION "ESP32-DevKit"
#define BUILD_DATE __DATE__
#define BUILD_TIME __TIME__

#endif // CONFIG_H
