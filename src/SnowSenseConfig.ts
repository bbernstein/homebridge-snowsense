import {PlatformConfig} from 'homebridge/lib/bridgeService';

export interface SnowSenseConfig extends PlatformConfig {
  apiKey: string;
  apiVersion: string;
  apiThrottleMinutes: number;
  debugOn: boolean;
  units?: 'imperial' | 'metric' | 'standard';
  location: string;
  hoursBeforeSnowIsSnowy: number;
  hoursAfterSnowIsSnowy: number;
  coldPrecipitationThreshold?: number;
  onlyWhenCold: boolean;
  coldTemperatureThreshold?: number;
  consecutiveHoursOfSnowIsSnowy: number;

  // old configs
  latitude?: number;
  longitude?: number;
  afterSnowStops?: number;
  beforeSnowStarts?: number;
  forecastFrequency?: number;
  key?: string;
}
