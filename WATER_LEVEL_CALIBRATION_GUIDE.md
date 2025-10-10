# Water Level Calibration Guide

## Overview

This guide explains how to properly calibrate the ultrasonic sensor water level calculations for accurate tank level monitoring.

## Understanding the New Calculation System

### How Ultrasonic Sensors Work
- Ultrasonic sensors measure the distance from the sensor to the water surface
- The sensor is mounted on the upper surface of the tank
- Sensor readings are in millimeters (mm)
- **Smaller distance = Higher water level**
- **Larger distance = Lower water level**

### Key Variables

#### 1. Tank Dimensions
- `upperTankHeightA/B`: Total physical height of the tank (cm)
- `lowerTankHeightA/B`: Total physical height of the tank (cm)

#### 2. Calibration Points
- `upperWaterFullHeightA/B`: Distance from sensor when tank is **FULL** (cm)
- `upperWaterEmptyHeightA/B`: Distance from sensor when tank is **EMPTY** (cm)
- `lowerWaterFullHeightA/B`: Distance from sensor when tank is **FULL** (cm)
- `lowerWaterEmptyHeightA/B`: Distance from sensor when tank is **EMPTY** (cm)

#### 3. Sensor Offsets
- `upperSensorOffsetA/B`: Compensation for sensor mounting position (cm)
- `lowerSensorOffsetA/B`: Compensation for sensor mounting position (cm)

#### 4. Validation Limits
- `minSensorReading`: Minimum valid sensor reading (mm) - default: 20mm
- `maxSensorReading`: Maximum valid sensor reading (mm) - default: 4000mm

## Calibration Process

### Step 1: Physical Setup
1. Mount ultrasonic sensor on the upper surface of the tank
2. Ensure sensor is pointing directly down toward the water surface
3. Note the sensor's mounting height from the tank bottom

### Step 2: Measure Calibration Points

#### For Full Tank (100% water level):
1. Fill tank to maximum safe level
2. Measure distance from sensor to water surface
3. Record this value as `waterFullHeight` (should be small, e.g., 5cm)

#### For Empty Tank (0% water level):
1. Drain tank to minimum level (but not completely dry)
2. Measure distance from sensor to water surface
3. Record this value as `waterEmptyHeight` (should be large, e.g., 70cm)

### Step 3: Calculate Sensor Offset
If your sensor is not mounted exactly at the tank top:
```
Sensor Offset = Tank Height - Actual Mounting Height
```

### Step 4: Configure in Web App
1. Go to Settings → Tank Configuration
2. Enter the measured values:
   - **Full Distance**: Distance when tank is full (small value)
   - **Empty Distance**: Distance when tank is empty (large value)
   - **Sensor Offset**: Compensation for mounting position

## Example Calibration

### Tank Specifications:
- Tank height: 75cm
- Sensor mounted at tank top
- Full tank: 5cm from sensor to water
- Empty tank: 70cm from sensor to water

### Configuration Values:
```
Tank Height: 75cm
Full Distance: 5cm    (when tank is 100% full)
Empty Distance: 70cm  (when tank is 0% full)
Sensor Offset: 0cm    (sensor at tank top)
```

## Calculation Formula

The system uses this improved calculation:

```cpp
// Convert sensor reading from mm to cm
float sensorDistanceCm = (sensorReadingMm / 10.0) + sensorOffsetCm;

// Calculate percentage
if (sensorDistanceCm <= fullDistanceCm) {
    waterLevelPercentage = 100.0;  // Tank is full
} else if (sensorDistanceCm >= emptyDistanceCm) {
    waterLevelPercentage = 0.0;    // Tank is empty
} else {
    // Linear interpolation between full and empty
    float totalRange = emptyDistanceCm - fullDistanceCm;
    float currentRange = sensorDistanceCm - fullDistanceCm;
    waterLevelPercentage = 100.0 - ((currentRange / totalRange) * 100.0);
}
```

## Troubleshooting

### Common Issues:

#### 1. Inverted Readings
- **Problem**: Water level shows 100% when tank is empty
- **Solution**: Swap the full and empty distance values

#### 2. Incorrect Percentage Range
- **Problem**: Water level never reaches 100% or 0%
- **Solution**: Adjust full/empty distance values to match actual measurements

#### 3. Erratic Readings
- **Problem**: Water level jumps around
- **Solution**: Check sensor mounting, add sensor offset compensation

#### 4. Invalid Readings
- **Problem**: System shows "Invalid reading"
- **Solution**: Check sensor limits (min/max reading values)

### Validation Checks:
- Full distance should be **smaller** than empty distance
- Sensor readings should be within min/max limits
- Tank height should be larger than empty distance

## Best Practices

1. **Calibrate with Real Water**: Use actual water levels, not theoretical measurements
2. **Multiple Measurements**: Take several readings at each calibration point
3. **Account for Sensor Mounting**: Include sensor offset if not mounted at tank top
4. **Test Edge Cases**: Verify readings at 0%, 50%, and 100% levels
5. **Regular Recalibration**: Recalibrate if sensor position changes

## Web App Integration

The web app now includes:
- Tank dimension configuration
- Sensor calibration settings
- Real-time water level display
- Calibration validation
- Error handling for invalid readings

## Technical Notes

- All distances are measured in centimeters (cm)
- Sensor readings are in millimeters (mm)
- The system automatically converts units
- Invalid readings are handled gracefully
- Calibration changes trigger immediate recalculation

## Support

If you encounter issues with calibration:
1. Check the Serial Monitor for detailed calculation logs
2. Verify sensor readings are within expected ranges
3. Ensure calibration values are logically consistent
4. Test with known water levels to validate accuracy
