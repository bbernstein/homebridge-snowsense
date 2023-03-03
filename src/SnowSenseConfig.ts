import {PlatformConfig} from 'homebridge/lib/bridgeService';

export interface DeviceConfig {
  displayName: string;
  hoursBeforeSnowIsSnowy: number;
  hoursAfterSnowIsSnowy: number;
  consecutiveHoursFutureIsSnowy: number;
  consecutiveHoursPastIsSnowy: number;
}

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
  sensors?: [DeviceConfig];

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
