import { SnowSenseConfig, SnowSenseUnits } from './SnowSenseConfig';
import { SnowSensePlatform } from './platform';
import { API, Logger, PlatformConfig } from 'homebridge';
import { SnowWatch } from './SnowWatch';
import tmp from 'tmp';
import { writeFileSync } from 'fs';

jest.mock('./SnowWatch', () => {
  const mock = {
    updatePredictionStatus: jest.fn(),
    // mock other instance methods as needed
  };

  return {
    __esModule: true, // this property makes it work
    default: jest.fn(),  // this mocks the default export
    SnowWatch: jest.fn().mockImplementation(() => mock),
  };
});

describe('SnowSensePlatform', () => {
  let log: Logger;
  let platformConfig: PlatformConfig;
  let api: API;
  let config: SnowSenseConfig;
  let configFile: tmp.FileResult;
  let storageDir: tmp.DirResult;

  beforeEach(() => {
    storageDir = tmp.dirSync();
    configFile = tmp.fileSync();
    const storagePathMock = jest.fn().mockReturnValue(storageDir.name);
    const configPathMock = jest.fn().mockReturnValue(configFile.name);

    const debug = true;
    const consoleInfo = jest.fn((...args) =>
      debug ? console.info(...args) : undefined,
    );
    const consoleWarn = jest.fn((...args) =>
      debug ? console.warn(...args) : undefined,
    );
    const consoleError = jest.fn((...args) =>
      debug ? console.error(...args) : undefined,
    );
    const consoleDebug = jest.fn((...args) =>
      debug ? console.debug(...args) : undefined,
    );
    log = {
      info: consoleInfo,
      warn: consoleWarn,
      error: consoleError,
      debug: consoleDebug,
      log: jest.fn(),
    };

    // log = {
    //   error: jest.fn(),
    //   warn: jest.fn(),
    //   info: jest.fn(),
    //   debug: jest.fn(),
    //   log: jest.fn(),
    // };
    platformConfig = {
      debugOn: true,
      platform: 'SnowSense',
      name: 'test',
    } as PlatformConfig;
    api = {
      hap: {
        Service: jest.fn(),
      },
      user: {
        configPath: configPathMock,
        storagePath: storagePathMock,
      },
      on: jest.fn(),
    } as unknown as API;
    config = {
      apiKey: 'test',
      apiVersion: 'test',
      debugOn: true,
      location: 'test',
      units: 'imperial',
      apiThrottleMinutes: 15,
      name: 'test',
      platforms: [],
    } as unknown as SnowSenseConfig;

    writeFileSync(configFile.name, JSON.stringify(config, null, 4), 'utf8');
  });

  afterEach(() => {
    storageDir.removeCallback();
    configFile.removeCallback();
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should set default values for configuration', () => {
      const platform = new SnowSensePlatform(log, platformConfig, api);

      expect(platform.log).toBe(log);
      expect(platform.platformConfig).toBe(platformConfig);
      expect(platform.api).toBe(api);
      expect(platform.debugOn).toBe(config.debugOn);

      expect(platform.accessories).toEqual([]);
      expect(platform.snowyAccessories).toEqual([]);
      expect(platform.forecastFrequencyMillis).toBe(
        1000 * 60 * (config.apiThrottleMinutes || 15),
      );
    });

    it('should set units to imperial if not specified', () => {
      const platform = new SnowSensePlatform(log, platformConfig, api);

      expect((platform.platformConfig as PlatformConfig).units).toEqual('imperial');
    });

    it('should not change units if already specified', () => {
      platformConfig.units = 'metric';
      const platform = new SnowSensePlatform(log, platformConfig, api);

      expect((platform.platformConfig as PlatformConfig).units).toEqual('metric');
    });
  });
});
