import {HISTORY_FILE, SnowWatch, SnowWatchOptions} from './SnowWatch';
import SnowForecastService, { SnowForecast, SnowReport } from './SnowForecastService';
import { DeviceConfig } from './SnowSenseConfig';
import { Logger, Logging } from 'homebridge';
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('./SnowForecastService');
// jest.mock('fs');

/**
 * Convenience function to make a SnowReport
 */
const makeForecast = (
  dt: number,
  hasSnow: boolean,
  temp: number,
): SnowReport => {
  return {
    dt: dt,
    temp: temp,
    hasSnow: hasSnow,
    hasPrecip: hasSnow,
  };
};

/**
 * Convenience function to make a list of hourly SnowReports given start time
 */
const makeForecastList = (
  count: number,
  dt: number,
  hasSnow: boolean,
  temp: number,
): SnowReport[] => {
  const list: SnowReport[] = [];
  for (let i = 0; i < count; i++) {
    list.push(makeForecast(dt + i * 3600, hasSnow, temp));
  }
  return list;
};

const readMockForecast = async (watcher, forecast) => {
  jest
    .spyOn(SnowForecastService.prototype, 'getSnowForecast')
    .mockResolvedValueOnce(forecast);
  await watcher.updatePredictionStatus();
};

// faking timers, so all date/times are relative to these
const nowTime = new Date(1670879317000);
const startDt = 1670878800;

/**
 * Return a date/time in seconds for a given hour number (relative to faked timers)
 * @param hourNum index of the hour, 0 is the current hour
 */
const dtHour = (hourNum: number) => {
  return startDt + hourNum * 3600;
};

const debug = false;
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

describe('SnowWatch', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockSnowForecastService: jest.Mocked<SnowForecastService>;
  let defaultOptions: SnowWatchOptions;
  let snowWatch: SnowWatch;
  let logger: Logger;
  let getWatcher: (options: SnowWatchOptions) => Promise<SnowWatch>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    mockSnowForecastService = {
      getSnowForecast: jest.fn(),
    } as unknown as jest.Mocked<SnowForecastService>;

    jest.useFakeTimers().setSystemTime(new Date(nowTime));

    const randomStr = Math.random().toString(36).substring(7);
    const tmpdir = path.join(os.tmpdir(), 'snowsense-test-' + randomStr);

    defaultOptions = {
      apiKey: 'test-api-key',
      apiVersion: '3.0',
      debugOn: false,
      location: 'test-location',
      units: 'imperial',
      onlyWhenCold: false,
      storagePath: tmpdir,
      historyFile: HISTORY_FILE,
      coldPrecipitationThreshold: 0.1,
    };

    logger = {
      info: consoleInfo,
      warn: consoleWarn,
      error: consoleError,
      debug: consoleDebug,
      log: jest.fn(),
    } as unknown as Logging;

    getWatcher = async (options: SnowWatchOptions) => {
      const watcher = new SnowWatch(logger, options);
      await watcher.updatePredictionStatus();
      return watcher;
    };

    snowWatch = new SnowWatch(mockLogger, defaultOptions, mockSnowForecastService);
  });

  afterEach(() => {
    try {
      fs.rmSync(defaultOptions.storagePath, { recursive: true });
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code !== 'ENOENT') {
        console.error('Error removing tmpdir:', e);
      }
    }
    jest.resetAllMocks();
  });

  // } catch (e: unknown) {
  //   if (e instanceof Error) {
  //     logger.error(`Error updating config file: ${e}`);
  //   }
  // }



  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(snowWatch['debugOn']).toBe(false);
      expect(snowWatch['onlyWhenCold']).toBe(false);
      expect(snowWatch['storagePath']).toContain('/snowsense');
    });

    it('should create SnowForecastService if not provided', () => {
      const newSnowWatch = new SnowWatch(mockLogger, defaultOptions);
      expect(newSnowWatch['snowForecastService']).toBeDefined();
    });

    it('should have a working setup method', async () => {
      const newSnowWatch = new SnowWatch(mockLogger, defaultOptions);
      await newSnowWatch.setup();
      expect(newSnowWatch['snowForecastService']).toBeDefined();
      expect(newSnowWatch['snowForecastService'].setup).toHaveBeenCalledTimes(1);
    });

    it('a second call to setup should not do anything extra', async () => {
      // check that when SnowWatch.setup is called twice, that snowForecastService.setup() is only called once
      const newSnowWatch = new SnowWatch(mockLogger, defaultOptions);
      await newSnowWatch.setup();
      await newSnowWatch.setup();
      // SnowWatch.snowForecastService.setup() should only be called once
      expect(newSnowWatch['snowForecastService'].setup).toHaveBeenCalledTimes(1);
    });
  });

  describe('updatePredictionStatus', () => {
    it('should update forecast when available', async () => {
      const mockForecast: SnowForecast = {
        current: { dt: 1000, temp: 0, hasSnow: true, hasPrecip: true },
        hourly: [
          { dt: 2000, temp: 1, hasSnow: false, hasPrecip: false },
          { dt: 3000, temp: 2, hasSnow: true, hasPrecip: true },
        ],
      };

      const rawForecast: SnowForecast = {
        current: { dt: 1, temp: 0, hasSnow: true, hasPrecip: true },
        hourly: [
          { dt: 2, temp: 1, hasSnow: false, hasPrecip: false },
          { dt: 3, temp: 2, hasSnow: true, hasPrecip: true },
        ],
      };
      mockSnowForecastService.getSnowForecast.mockResolvedValue(rawForecast);
      mockSnowForecastService.setup = jest.fn();
      await snowWatch.updatePredictionStatus();

      expect(snowWatch.currentReport).toEqual(mockForecast.current);
      expect(snowWatch.getFutureReports()).toEqual(mockForecast.hourly);
    });
  });

  describe('snowSensorValue', () => {
    it('should return true when it is currently snowing', () => {
      snowWatch.currentReport = { dt: 1000, temp: 0, hasSnow: true, hasPrecip: true };

      const config: DeviceConfig = {
        displayName: 'Test Sensor',
        hoursBeforeSnowIsSnowy: 0,
        hoursAfterSnowIsSnowy: 0,
        consecutiveHoursFutureIsSnowy: 0,
      };

      expect(snowWatch.snowSensorValue(config)).toBe(true);
    });

    // Add more tests for different scenarios...
  });

  describe('when we can not get SnowWatch instance', () => {
    it('should set pastReports to an empty array when storagePath is undefined', () => {
      const options = { ...defaultOptions, storagePath: '' };
      const watcher = new SnowWatch(logger, options);
      expect(watcher.pastReports).toEqual([]);
    });

    it('should get instance, but no forecast', () => {
      const watcher = new SnowWatch(logger, defaultOptions);
      expect(watcher).toBeDefined();
      expect(watcher.latestForecast).toBeUndefined();
    });

    it('should get instance, and a forecast', async () => {
      // mock the forecast service and its result
      const report = makeForecastList(3, dtHour(0), false, 35.24);
      const forecast: SnowForecast = {
        current: makeForecast(1670879317, false, 35.24),
        hourly: report,
      };
      jest
        .spyOn(SnowForecastService.prototype as SnowForecastService, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);

      const watcher = new SnowWatch(logger, defaultOptions);
      await watcher.updatePredictionStatus();
      expect(watcher.latestForecast).toBeDefined();
      expect(watcher.latestForecast?.current.dt).toBe(1670879317000);
      expect(watcher.latestForecast?.hourly).toHaveLength(3);
      expect(watcher.latestForecast?.hourly[0].dt).toBe(1670878800000);
    });

    it('should get instance, but if forecast fails, we get nothing', async () => {
      // mock the forecast service to return null
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(null);

      const watcher = new SnowWatch(logger, defaultOptions);
      await watcher.updatePredictionStatus();
      expect(logger.error).toHaveBeenCalledWith('No forecast available');
      expect(watcher.latestForecast).toBeUndefined();
    });
  });

  describe('check issues with reading/writing history', () => {
    it('should read an empty history', async () => {
      // use the above forecast mock
      // const options = { ...defaultOptions, storagePath: '' };
      const watcher = new SnowWatch(logger, defaultOptions);
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.logger = logger;
      watcherProto.storagePath = defaultOptions.storagePath;
      const history = watcherProto.readPastReports(defaultOptions.storagePath, HISTORY_FILE);
      expect(history).toHaveLength(0);
    });

    it('should write and read reports', async () => {
      const watcher = new SnowWatch(logger, defaultOptions);
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.logger = logger;
      watcherProto.storagePath = defaultOptions.storagePath;
      const report = [makeForecast(1670879317, false, 35.24)];
      watcherProto.writePastReports(defaultOptions.storagePath, HISTORY_FILE, report);
      const history2 = watcherProto.readPastReports(defaultOptions.storagePath, HISTORY_FILE);
      expect(history2).toEqual(report);
    });

    it('should fail to read history with non-array', async () => {
      const watcher = new SnowWatch(logger, defaultOptions);
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.logger = logger;
      watcherProto.storagePath = defaultOptions.storagePath;
      const report = 'this is not a json file';
      watcherProto.writePastReports(defaultOptions.storagePath, HISTORY_FILE, report);
      const history2 = watcherProto.readPastReports(defaultOptions.storagePath, HISTORY_FILE);
      expect(logger.error).toHaveBeenCalledWith('Expected array, got string');
      expect(history2).toEqual([]);
    });

    it('should fail to read history with bad object', async () => {
      const watcher = new SnowWatch(logger, defaultOptions);
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.logger = logger;
      watcherProto.storagePath = defaultOptions.storagePath;
      const report = [{a: 10, b: 'hi there', c: 'wrong type'}];
      watcherProto.writePastReports(defaultOptions.storagePath, HISTORY_FILE, report);
      const history2 = watcherProto.readPastReports(defaultOptions.storagePath, HISTORY_FILE);
      expect(logger.error).toHaveBeenCalledWith(
        'Expected SnowReport, got [object Object]',
      );
      expect(history2).toEqual([]);
    });

    describe('handle readonly storage dir', () => {
      it('should fail to write to readonly dir', () => {
        const watcher = new SnowWatch(logger, defaultOptions);
        const watcherProto = Object.getPrototypeOf(watcher);
        fs.mkdirSync(defaultOptions.storagePath, { mode: 0o555 });
        watcherProto.logger = logger;
        const report = [makeForecast(1670879317, false, 35.24)];
        watcherProto.writePastReports(defaultOptions.storagePath, HISTORY_FILE, report);
        const history2 = watcherProto.readPastReports(defaultOptions.storagePath, HISTORY_FILE);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringMatching(/Error writing past reports to/),
          expect.anything(),
        );
        expect((logger.error as jest.Mock).mock.calls[0][1].message).toMatch('EACCES: permission denied, open');
        expect(history2).toEqual([]);
      });
    });

    describe('handle readonly file', () => {
      it('should fail to write to readonly dir', async () => {
        const filePath = path.join(defaultOptions.storagePath, HISTORY_FILE);
        const watcher = new SnowWatch(logger, defaultOptions);
        fs.mkdirSync(defaultOptions.storagePath, { mode: 0o777 });
        fs.writeFileSync(filePath, 'hi there', { mode: 0o444 });
        const watcherProto = Object.getPrototypeOf(watcher);
        watcherProto.logger = logger;
        watcherProto.storagePath = defaultOptions.storagePath;
        const report = [makeForecast(1670879317, false, 35.24)];
        watcherProto.writePastReports(defaultOptions.storagePath, HISTORY_FILE, report);
        const history2 = watcherProto.readPastReports(defaultOptions.storagePath, HISTORY_FILE);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringMatching(/Error writing past reports to/),
          expect.anything(),
        );
        expect((logger.error as jest.Mock).mock.calls).toEqual(
          expect.arrayContaining([
            expect.arrayContaining([
              expect.anything(),
              expect.objectContaining({
                message: expect.stringMatching(
                  /EACCES: permission denied, open/,
                ),
              }),
            ]),
          ]),
        );
        expect(history2).toEqual([]);
      });
    });

    describe('handle unreadable file', () => {
      it('should fail to write to readonly dir', async () => {
        const filePath = path.join(defaultOptions.storagePath!, HISTORY_FILE);
        fs.mkdirSync(defaultOptions.storagePath!, { mode: 0o777 });
        fs.writeFileSync(filePath, 'hi there', { mode: 0o000 });
        const watcher = new SnowWatch(logger, defaultOptions);
        const watcherProto = Object.getPrototypeOf(watcher);
        watcherProto.logger = logger;
        watcherProto.storagePath = defaultOptions.storagePath;
        const history2 = watcherProto.readPastReports(defaultOptions.storagePath, HISTORY_FILE);
        expect(history2).toEqual([]);
      });
    });
  });

  describe('handle null/empty currentReport', () => {
    it('getSnowSenseValues should return isSnowingNow as false when currentReport is undefined', () => {
      const watcher = new SnowWatch(logger, defaultOptions);
      watcher.currentReport = undefined;
      const values = watcher.getSnowSenseValues();
      expect(values.snowingNow).toBe(false);
    });
  });

  describe('snowing now but not past or future', () => {
    let forecast: SnowForecast;
    const dConfig: DeviceConfig = {
      displayName: 'Test',
      hoursBeforeSnowIsSnowy: 0,
      hoursAfterSnowIsSnowy: 0,
      consecutiveHoursFutureIsSnowy: 0,
    };

    beforeEach(() => {
      forecast = {
        current: makeForecast(1670879317, true, 35.24),
        hourly: makeForecastList(3, dtHour(0), false, 35.24),
      };
      // use the above forecast mock
      jest
        .spyOn(SnowForecastService.prototype, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    it('should be show snowing see snowing later', async () => {
      const watcher = await getWatcher(defaultOptions);
      const value = watcher.snowSensorValue({
        ...dConfig,
        hoursBeforeSnowIsSnowy: 2,
        hoursAfterSnowIsSnowy: 2,
      });
      expect(value).toBe(true);
    });

    it('should be show snowing see snowing later', async () => {
      const watcher = await getWatcher(defaultOptions);
      const value = watcher.snowSensorValue({
        ...dConfig,
        hoursBeforeSnowIsSnowy: 0,
        hoursAfterSnowIsSnowy: 0,
      });
      expect(value).toBe(true);
    });
  });

  describe('when snow coming in three hours', () => {
    let forecast: SnowForecast;
    const dConfig: DeviceConfig = {
      displayName: 'Test',
      hoursBeforeSnowIsSnowy: 0,
      hoursAfterSnowIsSnowy: 0,
      consecutiveHoursFutureIsSnowy: 0,
    };

    beforeEach(() => {
      const report1 = makeForecastList(3, dtHour(0), false, 35.24);
      const report2 = makeForecastList(2, dtHour(3), true, 35.24);
      forecast = {
        current: makeForecast(1670879317, false, 35.24),
        hourly: [...report1, ...report2],
      };

      // use the above forecast mock
      jest
        .spyOn(SnowForecastService.prototype, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when expecting snow in two hours', () => {
      it('should NOT see snowing later', async () => {
        const watcher = await getWatcher(defaultOptions);
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
        });
        expect(value).toBe(false);
      });
    });

    describe('when expecting snow in three hours', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher(defaultOptions);
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 3,
          hoursAfterSnowIsSnowy: 3,
        });
        expect(value).toBe(true);
      });
    });

    describe('when expecting snow in zero hours', () => {
      it('should NOT be snowing now or later', async () => {
        const watcher = await getWatcher(defaultOptions);
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 0,
          hoursAfterSnowIsSnowy: 0,
        });
        expect(value).toBe(false);
      });
    });
  });

  describe('when cold snow coming in three hours', () => {
    let forecast: SnowForecast;
    const dConfig: DeviceConfig = {
      displayName: 'Test',
      hoursBeforeSnowIsSnowy: 0,
      hoursAfterSnowIsSnowy: 0,
      consecutiveHoursFutureIsSnowy: 0,
    };

    beforeEach(() => {
      const report1 = makeForecastList(1, dtHour(0), false, 35.24);
      const report2 = makeForecastList(4, dtHour(1), true, 30.87);
      forecast = {
        current: makeForecast(1670879317, false, 35.24),
        hourly: [...report1, ...report2],
      };

      // use the above forecast mock
      jest
        .spyOn(SnowForecastService.prototype, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when expecting really cold snow', () => {
      it('should NOT see snowing later', async () => {
        const watcher = await getWatcher({
          ...defaultOptions,
          onlyWhenCold: true,
          coldTemperatureThreshold: 20,
        });
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
          hoursAfterSnowIsSnowy: 2,
        });
        expect(value).toBe(false);
      });
    });

    describe('when expecting regular cold snow', () => {
      it('should see snowing later when it dips below threshold', async () => {
        const watcher = await getWatcher({
          ...defaultOptions,
          onlyWhenCold: true,
          coldTemperatureThreshold: 32,
        });
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
          hoursAfterSnowIsSnowy: 2,
        });
        expect(value).toBe(true);
      });
    });
  });

  describe('when we have two consecutive hours of snow', () => {
    let forecast: SnowForecast;
    const dConfig: DeviceConfig = {
      displayName: 'Test',
      hoursBeforeSnowIsSnowy: 0,
      hoursAfterSnowIsSnowy: 0,
      consecutiveHoursFutureIsSnowy: 0,
    };

    beforeEach(() => {
      const report1 = makeForecastList(1, dtHour(0), false, 35.24);
      const report2 = makeForecastList(2, dtHour(1), true, 32.87);
      const report3 = makeForecastList(2, dtHour(3), false, 32.87);
      forecast = {
        current: makeForecast(1670879317, false, 35.24),
        hourly: [...report1, ...report2, ...report3],
      };

      // use the above forecast mock
      jest
        .spyOn(SnowForecastService.prototype, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('expecting two consecutive hours of snow', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher(defaultOptions);
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
          consecutiveHoursFutureIsSnowy: 2,
        });
        expect(value).toBe(true);
      });
    });

    describe('expecting fail to see three consecutive hours of snow', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher(defaultOptions);
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
          consecutiveHoursFutureIsSnowy: 3,
        });
        expect(value).toBe(false);
      });
    });

    describe('when expecting snow in zero hours', () => {
      it('should see not snowing now or later', async () => {
        const watcher = await getWatcher(defaultOptions);
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 0,
          hoursAfterSnowIsSnowy: 0,
        });
        expect(value).toBe(false);
      });
    });
  });

  describe('when cold precipitation coming in three hours', () => {
    let forecast: SnowForecast;
    const dConfig: DeviceConfig = {
      displayName: 'Test',
      hoursBeforeSnowIsSnowy: 0,
      hoursAfterSnowIsSnowy: 0,
      consecutiveHoursFutureIsSnowy: 0,
    };

    beforeEach(() => {
      const report1 = makeForecastList(3, dtHour(0), false, 35.24);
      const report2 = makeForecastList(2, dtHour(3), false, 30.61);
      report2[0].hasPrecip = true;
      report2[1].hasPrecip = true;

      forecast = {
        current: makeForecast(1670879317, false, 35.24),
        hourly: [...report1, ...report2],
      };

      // use the above forecast mock
      jest
        .spyOn(SnowForecastService.prototype, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when expecting cold precipitation in two hours', () => {
      it('should NOT see snowing later', async () => {
        const watcher = await getWatcher({
          ...defaultOptions,
          coldPrecipitationThreshold: 32,
        });
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
          hoursAfterSnowIsSnowy: 2,
        });
        expect(value).toBe(false);
      });
    });

    describe('when expecting cold precipitation in three hours', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher({
          ...defaultOptions,
          coldPrecipitationThreshold: 32,
        });
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 3,
          hoursAfterSnowIsSnowy: 3,
        });
        expect(value).toBe(true);
      });
    });
  });

  describe('when it stopped snowing 2 hours ago', () => {
    let forecast: SnowForecast;
    const dConfig: DeviceConfig = {
      displayName: 'Test',
      hoursBeforeSnowIsSnowy: 0,
      hoursAfterSnowIsSnowy: 0,
      consecutiveHoursFutureIsSnowy: 0,
    };

    const setupPastMocks = async (watcher, snowing: boolean[][]) => {
      for (let i = 0; i < snowing.length; i++) {
        const offsetHours = -(snowing.length - i - 1);
        const forecast = {
          current: makeForecast(dtHour(offsetHours), snowing[i][0], 35.24),
          hourly: makeForecastList(
            5,
            dtHour(offsetHours),
            snowing[i][1],
            35.24,
          ),
        };
        await readMockForecast(watcher, forecast);
      }
    };

    describe('snowing now but not past or future', () => {
      let watcher: SnowWatch;
      beforeEach(async () => {
        watcher = new SnowWatch(logger, defaultOptions);
        await setupPastMocks(watcher, [
          [false, false],
          [false, false],
          [false, false],
          [false, false],
        ]);

        const report1 = makeForecastList(2, dtHour(0), false, 35.24);
        const report2 = makeForecastList(3, dtHour(2), false, 32.61);
        const report3 = makeForecastList(2, dtHour(5), false, 35.24);
        forecast = {
          current: makeForecast(1670879317, true, 35.24),
          hourly: [...report1, ...report2, ...report3],
        };
        // use the above forecast mock
        jest
          .spyOn(SnowForecastService.prototype, 'getSnowForecast')
          .mockResolvedValueOnce(forecast);
        await readMockForecast(watcher, forecast);
      });

      it('should only snowing now', () => {
        const values = watcher.getSnowSenseValues();
        expect(values.snowingNow).toBe(true);
        expect(values.lastSnowTime).toBe(0);
        expect(values.pastConsecutiveHours).toBe(1);
        expect(values.nextSnowTime).toBeUndefined();
        expect(values.futureConsecutiveHours).toBe(0);
      });

      it('snowing now, so its all true', () => {
        let value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 0,
          hoursAfterSnowIsSnowy: 0,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 1,
          hoursAfterSnowIsSnowy: 1,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
          hoursAfterSnowIsSnowy: 2,
        });
        expect(value).toBe(true);
      });
    });

    describe('it snowed, stopped, then will snow again', () => {
      let watcher: SnowWatch;
      let forecast: SnowForecast;
      const dConfig: DeviceConfig = {
        displayName: 'Test',
        hoursBeforeSnowIsSnowy: 0,
        hoursAfterSnowIsSnowy: 0,
        consecutiveHoursFutureIsSnowy: 0,
      };

      beforeEach(async () => {
        watcher = new SnowWatch(logger, defaultOptions);
        await setupPastMocks(watcher, [
          [false, false],
          [true, false],
          [true, false],
          [false, false],
        ]);

        const report1 = makeForecastList(2, dtHour(0), false, 35.24);
        const report2 = makeForecastList(3, dtHour(2), true, 32.61);
        const report3 = makeForecastList(2, dtHour(5), false, 35.24);
        forecast = {
          current: makeForecast(1670879317, false, 35.24),
          hourly: [...report1, ...report2, ...report3],
        };
        // use the above forecast mock
        jest
          .spyOn(SnowForecastService.prototype, 'getSnowForecast')
          .mockResolvedValueOnce(forecast);
        await readMockForecast(watcher, forecast);
      });

      it('should see old snow and future snow, but not now', () => {
        const values = watcher.getSnowSenseValues();
        expect(values.snowingNow).toBe(false);
        expect(values.lastSnowTime).toBeCloseTo(1.143);
        expect(values.pastConsecutiveHours).toBe(2);
        expect(values.nextSnowTime).toBeCloseTo(1.856);
        expect(values.futureConsecutiveHours).toBe(3);
      });

      it('should see snowing later', async () => {
        const values1 = watcher.getSnowSenseValues();
        const values2 = watcher.getSnowSenseValues();
        expect(values1).toEqual(values2);

        let value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 0,
          hoursAfterSnowIsSnowy: 1,
        });
        expect(value).toBe(false);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 0,
          hoursAfterSnowIsSnowy: 2,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 0,
          hoursAfterSnowIsSnowy: 3,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 1,
          hoursAfterSnowIsSnowy: 0,
        });
        expect(value).toBe(false);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
          hoursAfterSnowIsSnowy: 0,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 0,
          hoursAfterSnowIsSnowy: 0,
        });
        expect(value).toBe(false);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursAfterSnowIsSnowy: 2,
          hoursBeforeSnowIsSnowy: 0,
          consecutiveHoursFutureIsSnowy: 0,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursAfterSnowIsSnowy: 0,
          hoursBeforeSnowIsSnowy: 2,
          consecutiveHoursFutureIsSnowy: 2,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursAfterSnowIsSnowy: 0,
          hoursBeforeSnowIsSnowy: 2,
          consecutiveHoursFutureIsSnowy: 4,
        });
        expect(value).toBe(false);
      });
    });

    describe('it stopped snowing a little over two hours ago', () => {
      let watcher: SnowWatch;

      const dConfig: DeviceConfig = {
        displayName: 'Test',
        hoursBeforeSnowIsSnowy: 0,
        hoursAfterSnowIsSnowy: 0,
        consecutiveHoursFutureIsSnowy: 0,
      };

      beforeEach(async () => {
        watcher = new SnowWatch(logger, defaultOptions);
        await setupPastMocks(watcher, [
          [true, false],
          [true, false],
          [false, false],
          [false, false],
        ]);
      });

      it('should see that it is NOT snowy', async () => {
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 2,
          hoursAfterSnowIsSnowy: 2,
        });
        expect(value).toBe(false);
      });

      it('should see it IS snowy', async () => {
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 3,
          hoursAfterSnowIsSnowy: 3,
        });
        expect(value).toBe(true);
      });

      it('should not be snowy', async () => {
        const value = watcher.snowSensorValue({
          ...dConfig,
          hoursBeforeSnowIsSnowy: 0,
          hoursAfterSnowIsSnowy: 0,
        });
        expect(value).toBe(false);
      });

      it('should have the right values', () => {
        const values = watcher.getSnowSenseValues();
        expect(values.snowingNow).toBe(false);
        expect(values.lastSnowTime).toBeCloseTo(2.1436);
        expect(values.pastConsecutiveHours).toBeCloseTo(2);
        expect(values.nextSnowTime).toBeUndefined();
        expect(values.futureConsecutiveHours).toBe(0);
      });
    });
  });

  describe('Test debug logging', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should output to logger.debug', async () => {
      const watcher = new SnowWatch(logger, defaultOptions);
      const spy = jest.spyOn(logger, 'debug');
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.debugOn = true;
      watcherProto.logger = logger;
      watcherProto.debug('test');
      expect(spy).toHaveBeenCalled();
    });
  });
});
