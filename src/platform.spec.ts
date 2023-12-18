import { SnowSensePlatform } from './platform';
import { API, Logger, PlatformConfig } from 'homebridge';

describe('SnowSensePlatform', () => {
  let log: Logger;
  let platformConfig: PlatformConfig;
  let api: API;

  beforeEach(() => {
    log = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };
    platformConfig = {} as PlatformConfig;
    api = {
      hap: {
        Service: jest.fn(),
      },
      user: {
        configPath: jest.fn(),
      },
      on: jest.fn(),
    } as unknown as API;
  });

  it('should set default values for configuration', () => {
    const platform = new SnowSensePlatform(log, platformConfig, api);

    expect(platform.accessories).toEqual([]);
    expect(platform.snowyAccessories).toEqual([]);
    expect(platform.forecastFrequencyMillis).toEqual(1000 * 60 * 15);
    expect(platform.debugOn).toEqual(false);
  });

  it('should set units to imperial if not specified', () => {
    const platform = new SnowSensePlatform(log, platformConfig, api);

    expect((platform.platformConfig as any).units).toEqual('imperial');
  });

  it('should not change units if already specified', () => {
    platformConfig.units = 'metric';
    const platform = new SnowSensePlatform(log, platformConfig, api);

    expect((platform.platformConfig as any).units).toEqual('metric');
  });
});
