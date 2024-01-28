import { SnowSenseConfig, SnowSenseUnits } from './SnowSenseConfig';
import { SnowSensePlatform } from './platform';
import { API, Logger, PlatformConfig } from 'homebridge';
import { SnowWatch } from './SnowWatch';
import * as tmp from 'tmp';
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

SnowWatch.init = jest.fn();  // this mocks the static method
SnowWatch.getInstance = jest.fn().mockReturnValue({
  updatePredictionStatus: jest.fn(),
  // return other mocked instance methods as needed
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

      expect((platform.platformConfig as any).units).toEqual('imperial');
    });

    it('should not change units if already specified', () => {
      platformConfig.units = 'metric';
      const platform = new SnowSensePlatform(log, platformConfig, api);

      expect((platform.platformConfig as any).units).toEqual('metric');
    });

    it('should correctly handle DID_FINISH_LAUNCHING event', () => {
      const platform = new SnowSensePlatform(log, platformConfig, api);
      const discoverDevicesSpy = jest.spyOn(platform, 'discoverDevices');
      const startWatchingWeatherSpy = jest.spyOn(
        platform,
        'startWatchingWeather',
      );

      // Simulate the DID_FINISH_LAUNCHING event
      const callback = (api.on as jest.Mock).mock.calls[0][1];
      callback();

      expect(discoverDevicesSpy).toHaveBeenCalledWith(platformConfig);
      expect(startWatchingWeatherSpy).toHaveBeenCalledWith(platformConfig);
    });
  });

  describe('UpdateAccessories', () => {
    let platform: SnowSensePlatform;
    let snowWatch: SnowWatch;

    beforeEach(() => {
      platform = new SnowSensePlatform(log, platformConfig, api);
      snowWatch = SnowWatch.getInstance();
    });

    it('should initialize SnowWatch and start watching weather', async () => {
      const config: SnowSenseConfig = {
        apiKey: 'testApiKey',
        apiVersion: 'testApiVersion',
        apiThrottleMinutes: 15,
        debugOn: true,
        units: 'imperial' as SnowSenseUnits,
        location: 'testLocation',
        coldPrecipitationThreshold: 0,
        onlyWhenCold: false,
        coldTemperatureThreshold: 0,
        sensors: [
          {
            displayName: 'testSensor',
            hoursBeforeSnowIsSnowy: 1,
            hoursAfterSnowIsSnowy: 1,
            consecutiveHoursFutureIsSnowy: 1,
          },
        ],
        platform: 'SnowSense',
        name: 'testName',
      };

      await platform.startWatchingWeather(config);

      expect(SnowWatch.init).toHaveBeenCalledWith(platform.log, {
        apiKey: config.apiKey,
        apiVersion: config.apiVersion,
        debugOn: config.debugOn,
        location: config.location,
        units: config.units,
        apiThrottleMinutes: config.apiThrottleMinutes,
        coldPrecipitationThreshold: config.coldPrecipitationThreshold,
        onlyWhenCold: config.onlyWhenCold,
        coldTemperatureThreshold: config.coldTemperatureThreshold,
        storagePath: platform.api.user.storagePath(),
      });

      jest.advanceTimersByTime(platform.forecastFrequencyMillis);
      expect(snowWatch.updatePredictionStatus).toHaveBeenCalled();
    });
  });
});
