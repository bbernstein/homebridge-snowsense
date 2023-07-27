import {PlatformConfig} from 'homebridge/lib/bridgeService';
import {readFileSync, writeFileSync} from 'fs';
import {Logger} from 'homebridge';

/**
 * Config for a single device
 */
export interface DeviceConfig {
  displayName: string;
  hoursBeforeSnowIsSnowy: number;
  hoursAfterSnowIsSnowy: number;
  consecutiveHoursFutureIsSnowy: number;
}

/**
 * Config for the platform
 */
export interface SnowSenseConfig extends PlatformConfig {
  apiKey: string;
  apiVersion: string;
  apiThrottleMinutes: number;
  debugOn: boolean;
  units?: 'imperial' | 'metric' | 'standard';
  location: string;
  coldPrecipitationThreshold?: number;
  onlyWhenCold: boolean;
  coldTemperatureThreshold?: number;
  sensors?: DeviceConfig[];

  // old configs
  hoursBeforeSnowIsSnowy: number;
  hoursAfterSnowIsSnowy: number;
  consecutiveHoursOfSnowIsSnowy: number;
  latitude?: number;
  longitude?: number;
  afterSnowStops?: number;
  beforeSnowStarts?: number;
  forecastFrequency?: number;
  key?: string;
}


/**
 *
 * @param obj1
 * @param obj2
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepEqual(obj1: any, obj2: any): boolean {
  // Check if the objects are arrays
  const isArr1 = Array.isArray(obj1);
  const isArr2 = Array.isArray(obj2);
  if (isArr1 && isArr2) {
    // If both objects are arrays, compare each element
    if (obj1.length !== obj2.length) {
      return false;
    }
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) {
        return false;
      }
    }
    return true;
  }
  if (isArr1 !== isArr2) {
    // If one object is an array and the other is not, they are not equal
    return false;
  }
  // If the objects are not arrays, continue with the original comparison
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  for (const key of keys1) {
    const val1 = obj1[key];
    const val2 = obj2[key];
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      if (!deepEqual(val1, val2)) {
        return false;
      }
    } else if (val1 !== val2) {
      return false;
    }
  }
  return true;
}

export function upgradeConfigs(config: SnowSenseConfig, configPath: string, logger: Logger) {
  let configChanged = false;
  // read legacy configs, and see if anything changed
  if (!config.sensors
    && config.name
    && config.hoursAfterSnowIsSnowy
    && config.hoursBeforeSnowIsSnowy
    && config.consecutiveHoursOfSnowIsSnowy) {
    config.sensors = [{
      displayName: config.name,
      hoursBeforeSnowIsSnowy: config.hoursBeforeSnowIsSnowy,
      hoursAfterSnowIsSnowy: config.hoursAfterSnowIsSnowy,
      consecutiveHoursFutureIsSnowy: config.consecutiveHoursOfSnowIsSnowy,
    }];
    configChanged = true;
  }
  if (config.sensors && config.sensors.length > 0) {
    const newSensors = config.sensors
      .map((sensor: DeviceConfig): DeviceConfig => ({
        displayName: sensor.displayName || 'Snowy-' + Math.random().toString(36).substring(7),
        hoursBeforeSnowIsSnowy: sensor.hoursBeforeSnowIsSnowy,
        hoursAfterSnowIsSnowy: sensor.hoursAfterSnowIsSnowy,
        consecutiveHoursFutureIsSnowy: sensor.consecutiveHoursFutureIsSnowy,
      }));
    const sensorChanged = !deepEqual(config.sensors, newSensors);
    if (sensorChanged) {
      config.sensors = newSensors;
      configChanged = true;
    }
  }
  if (!config.apiKey && config.key) {
    config.apiKey = config.key;
    config.key = undefined;
    // if we had an old key, it was version v2.5, so let that keep working
    config.apiVersion = '2.5';
    configChanged = true;
  }
  if (!config.apiVersion) {
    config.apiVersion = '3.0';
    configChanged = true;
  }
  if (!config.location && config.latitude && config.longitude) {
    config.location = `${config.latitude},${config.longitude}`;
    config.latitude = undefined;
    config.longitude = undefined;
    configChanged = true;
  }
  if (config.units && !config.units.match(/^(imperial|metric)$/)) {
    config.units = 'imperial';
    configChanged = true;
  }
  if (!config.hoursBeforeSnowIsSnowy && config.beforeSnowStarts) {
    config.hoursBeforeSnowIsSnowy = config.beforeSnowStarts;
    config.beforeSnowStarts = undefined;
    configChanged = true;
  }
  if (!config.hoursAfterSnowIsSnowy && config.afterSnowStops) {
    config.hoursAfterSnowIsSnowy = config.afterSnowStops;
    config.afterSnowStops = undefined;
    configChanged = true;
  }
  if (!config.apiThrottleMinutes && config.forecastFrequency) {
    config.apiThrottleMinutes = config.forecastFrequency;
    config.forecastFrequency = undefined;
    configChanged = true;
  }
  if (configChanged) {
    try {
      logger.info('Updating config to new format. ', config);
      const allConfigs = JSON.parse(readFileSync(configPath, 'utf8'));
      // find the platform entry matching this platform
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const platformIndex = allConfigs.platforms.findIndex((c: any) => c.platform === config.platform);
      if (platformIndex >= 0) {
        // if it was found, replace that entry with the updated config and write it
        allConfigs.platforms[platformIndex] = config;
        writeFileSync(configPath, JSON.stringify(allConfigs, null, 4), 'utf8');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      logger.error(`Error updating config file: ${e}`);
    }
  }
}
