import SnowWatch, {HISTORY_FILE, SnowWatchOptions} from './SnowWatch';
import SnowForecastService, {SnowForecast, SnowReport} from './SnowForecastService';
import {DeviceConfig} from './SnowSenseConfig';
import fs from 'fs';
import path from 'path';
import {Logger} from 'homebridge';


// template options for default values, if not provided
const swOptions: SnowWatchOptions = {
  apiKey: 'xxx',
  apiVersion: '2.5',
  debugOn: false,
  location: '0,0',
  units: 'imperial',
  onlyWhenCold: false,
  coldTemperatureThreshold: 32,
  storagePath: './snowwatchtest',
};

const dConfig: DeviceConfig = {
  displayName: 'Test',
  hoursBeforeSnowIsSnowy: 0,
  hoursAfterSnowIsSnowy: 0,
  consecutiveHoursFutureIsSnowy: 0,
};

/**
 * Convenience function to make a SnowReport
 */
const makeForecast = (dt: number, hasSnow: boolean, temp: number): SnowReport => {
  return {
    'dt': dt,
    'temp': temp,
    'hasSnow': hasSnow,
    'hasPrecip': hasSnow,
  };
};

/**
 * Convenience function to make a list of hourly SnowReports given start time
 */
const makeForecastList = (count: number, dt: number, hasSnow: boolean, temp: number): SnowReport[] => {
  const list: SnowReport[] = [];
  for (let i = 0; i < count; i++) {
    list.push(makeForecast(dt + (i * 3600), hasSnow, temp));
  }
  return list;
};

const readMockForecast = async (watcher, forecast) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast').mockResolvedValueOnce(forecast);
  await watcher.updatePredictionStatus();
};

const deleteTestData = () => {
  const storagePath = swOptions.storagePath;
  try {
    if (fs.existsSync(storagePath)) {
      const filePath = path.join(storagePath, HISTORY_FILE);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      fs.rmdirSync(storagePath);
    }
  } catch (e: unknown) {
    // ignore
  }
};

// faking timers, so all date/times are relative to these
const nowTime = new Date(1670879317000);
const startDt = 1670878800;

/**
 * Return a date/time in seconds for a given hour number (relative to faked timers)
 * @param hourNum index of the hour, 0 is the current hour
 */
const dtHour = (hourNum: number) => {
  return startDt + (hourNum * 3600);
};

const debug = false;
const consoleInfo = jest.fn((...args) => debug ? console.info(...args) : undefined);
const consoleWarn = jest.fn((...args) => debug ? console.warn(...args) : undefined);
const consoleError = jest.fn((...args) => debug ? console.error(...args) : undefined);
const consoleDebug = jest.fn((...args) => debug ? console.debug(...args) : undefined);
const logger: Logger = {
  info: consoleInfo,
  warn: consoleWarn,
  error: consoleError,
  debug: consoleDebug,
  log: jest.fn(),
};

const getWatcher = async (options: SnowWatchOptions) => {
  await SnowWatch.init(logger, options);
  const watcher = SnowWatch.getInstance();
  await watcher.updatePredictionStatus();
  return watcher;
};

describe('SnowWatch', () => {
  let forecast: SnowForecast;

  beforeEach(() => {
    deleteTestData();
    jest.useFakeTimers().setSystemTime(new Date(nowTime));
  });

  afterEach(() => {
    deleteTestData();
    jest.restoreAllMocks();
    consoleError.mockClear();
  });

  describe('when we can not get SnowWatch instance', () => {
    it('should NOT get instance', () => {
      expect(SnowWatch.getInstance).toThrow('SnowWatch not initialized');
    });

    it('should set pastReports to an empty array when storagePath is undefined', () => {
      const options = {...swOptions, storagePath: ''};
      SnowWatch.init(logger, options);
      const watcher = SnowWatch.getInstance();
      expect(watcher.pastReports).toEqual([]);
    });

    it('should get instance, but no forecast', () => {
      SnowWatch.init(logger, swOptions);
      const watcher = SnowWatch.getInstance();
      expect(watcher).toBeDefined();
      expect(watcher.latestForecast).toBeUndefined();
    });

    it('should get instance, and a forecast', async () => {
      // mock the forecast service and its result
      const report = makeForecastList(3, dtHour(0), false, 35.24);
      forecast = {
        'current': makeForecast(1670879317, false, 35.24),
        'hourly': report,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);

      await SnowWatch.init(logger, swOptions);
      const watcher = SnowWatch.getInstance();
      await watcher.updatePredictionStatus();
      expect(watcher.latestForecast).toBeDefined();
      expect(watcher.latestForecast?.current.dt).toBe(1670879317);
      expect(watcher.latestForecast?.hourly).toHaveLength(3);
      expect(watcher.latestForecast?.hourly[0].dt).toBe(1670878800);
    });

    it('should get instance, but if forecast fails, we get nothing', async () => {
      // mock the forecast service to return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(null);

      await SnowWatch.init(logger, swOptions);
      const watcher = SnowWatch.getInstance();
      await watcher.updatePredictionStatus();
      expect(logger.error).toHaveBeenCalledWith('No forecast available');
      expect(watcher.latestForecast).toBeNull();
    });
  });

  describe('check issues with reading/writing history', () => {
    it('should read an empty history', async () => {
      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await SnowWatch.init(logger, swOptions);
      const watcher = SnowWatch.getInstance();
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.logger = logger;
      watcherProto.storagePath = swOptions.storagePath;
      const history = watcherProto.readPastReports(swOptions.storagePath);
      expect(history).toHaveLength(0);
    });

    it('should write and read reports', async () => {
      await SnowWatch.init(logger, swOptions);
      const watcher = SnowWatch.getInstance();
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.logger = logger;
      watcherProto.storagePath = swOptions.storagePath;
      const report = [makeForecast(1670879317, false, 35.24)];
      watcherProto.writePastReports(swOptions.storagePath, report);
      const history2 = watcherProto.readPastReports(swOptions.storagePath);
      expect(history2).toEqual(report);
    });

    it('should fail to read history with non-array', async () => {
      await SnowWatch.init(logger, swOptions);
      const watcher = SnowWatch.getInstance();
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.logger = logger;
      watcherProto.storagePath = swOptions.storagePath;
      const report = 'this is not a json file';
      watcherProto.writePastReports(swOptions.storagePath, report);
      const history2 = watcherProto.readPastReports(swOptions.storagePath);
      expect(logger.error).toHaveBeenCalledWith('Expected array, got string');
      expect(history2).toEqual([]);
    });

    it('should fail to read history with bad object', async () => {
      await SnowWatch.init(logger, swOptions);
      const watcher = SnowWatch.getInstance();
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.logger = logger;
      watcherProto.storagePath = swOptions.storagePath;
      const report = [{a: 10, b: 'hi there', c: 'wrong type'}];
      watcherProto.writePastReports(swOptions.storagePath, report);
      const history2 = watcherProto.readPastReports(swOptions.storagePath);
      expect(logger.error).toHaveBeenCalledWith('Expected SnowReport, got [object Object]');
      expect(history2).toEqual([]);
    });

    describe('handle readonly storage dir', () => {
      const filePath = path.join(swOptions.storagePath, HISTORY_FILE);
      beforeEach(() => {
        fs.mkdirSync(swOptions.storagePath, {mode: 0o555});
      });
      afterEach(() => {
        fs.rmdirSync(swOptions.storagePath);
      });

      it('should fail to write to readonly dir', async () => {
        await SnowWatch.init(logger, swOptions);
        const watcher = SnowWatch.getInstance();
        const watcherProto = Object.getPrototypeOf(watcher);
        watcherProto.logger = logger;
        watcherProto.storagePath = filePath;
        const report = [makeForecast(1670879317, false, 35.24)];
        watcherProto.writePastReports(watcherProto.storagePath, report);
        const history2 = watcherProto.readPastReports(swOptions.storagePath);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringMatching(/Error writing past reports to/),
          expect.anything(),
        );
        expect((logger.error as jest.Mock).mock.calls).toEqual(
          expect.arrayContaining([
            expect.arrayContaining([
              expect.anything(),
              expect.objectContaining({
                message: expect.stringMatching(/EACCES: permission denied, mkdir/),
              }),
            ]),
          ]),
        );
        expect(history2).toEqual([]);
      });
    });

    describe('handle readonly file', () => {
      const filePath = path.join(swOptions.storagePath, HISTORY_FILE);
      it('should fail to write to readonly dir', async () => {
        await SnowWatch.init(logger, swOptions);
        fs.mkdirSync(swOptions.storagePath, {mode: 0o777});
        fs.writeFileSync(filePath, 'hi there', {mode: 0o444});
        const watcher = SnowWatch.getInstance();
        const watcherProto = Object.getPrototypeOf(watcher);
        watcherProto.logger = logger;
        watcherProto.storagePath = swOptions.storagePath;
        const report = [makeForecast(1670879317, false, 35.24)];
        watcherProto.writePastReports(watcherProto.storagePath, report);
        const history2 = watcherProto.readPastReports(swOptions.storagePath);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringMatching(/Error writing past reports to/),
          expect.anything(),
        );
        expect((logger.error as jest.Mock).mock.calls).toEqual(
          expect.arrayContaining([
            expect.arrayContaining([
              expect.anything(),
              expect.objectContaining({
                message: expect.stringMatching(/EACCES: permission denied, open/),
              }),
            ]),
          ]),
        );
        expect(history2).toEqual([]);
      });
    });

    describe('handle unreadable file', () => {
      const filePath = path.join(swOptions.storagePath!, HISTORY_FILE);
      it('should fail to write to readonly dir', async () => {
        fs.mkdirSync(swOptions.storagePath!, {mode: 0o777});
        fs.writeFileSync(filePath, 'hi there', {mode: 0o000});
        await SnowWatch.init(logger, swOptions);
        const watcher = SnowWatch.getInstance();
        const watcherProto = Object.getPrototypeOf(watcher);
        watcherProto.logger = logger;
        watcherProto.storagePath = swOptions.storagePath;
        const history2 = watcherProto.readPastReports(swOptions.storagePath);
        expect(history2).toEqual([]);
      });
    });
  });

  describe('handle null/empty currentReport', () => {
    it('getSnowSenseValues should return isSnowingNow as false when currentReport is undefined', () => {
      const watcher = SnowWatch.getInstance();
      (watcher as any).currentReport = undefined;
      const values = watcher.getSnowSenseValues();
      expect(values.snowingNow).toBe(false);
    });
  });

  describe('snowing now but not past or future', () => {
    beforeEach(() => {
      forecast = {
        'current': makeForecast(1670879317, true, 35.24),
        'hourly': makeForecastList(3, dtHour(0), false, 35.24),
      };
      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    it('should be show snowing see snowing later', async () => {
      const watcher = await getWatcher(swOptions);
      const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 2, hoursAfterSnowIsSnowy: 2});
      expect(value).toBe(true);
    });

    it('should be show snowing see snowing later', async () => {
      const watcher = await getWatcher(swOptions);
      const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 0});
      expect(value).toBe(true);
    });
  });

  describe('when snow coming in three hours', () => {
    beforeEach(() => {
      const report1 = makeForecastList(3, dtHour(0), false, 35.24);
      const report2 = makeForecastList(2, dtHour(3), true, 35.24);
      forecast = {
        'current': makeForecast(1670879317, false, 35.24),
        'hourly': [...report1, ...report2],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when expecting snow in two hours', () => {
      it('should NOT see snowing later', async () => {
        const watcher = await getWatcher(swOptions);
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 2});
        expect(value).toBe(false);
      });
    });

    describe('when expecting snow in three hours', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher(swOptions);
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 3, hoursAfterSnowIsSnowy: 3});
        expect(value).toBe(true);
      });
    });

    describe('when expecting snow in zero hours', () => {
      it('should NOT be snowing now or later', async () => {
        const watcher = await getWatcher(swOptions);
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 0});
        expect(value).toBe(false);
      });
    });
  });


  describe('when cold snow coming in three hours', () => {
    beforeEach(() => {
      const report1 = makeForecastList(1, dtHour(0), false, 35.24);
      const report2 = makeForecastList(4, dtHour(1), true, 30.87);
      forecast = {
        'current': makeForecast(1670879317, false, 35.24),
        'hourly': [...report1, ...report2],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when expecting really cold snow', () => {
      it('should NOT see snowing later', async () => {
        const watcher = await getWatcher({...swOptions, onlyWhenCold: true, coldTemperatureThreshold: 20});
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 2, hoursAfterSnowIsSnowy: 2});
        expect(value).toBe(false);
      });
    });

    describe('when expecting regular cold snow', () => {
      it('should see snowing later when it dips below threshold', async () => {
        const watcher = await getWatcher({...swOptions, onlyWhenCold: true, coldTemperatureThreshold: 32});
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 2, hoursAfterSnowIsSnowy: 2});
        expect(value).toBe(true);
      });
    });
  });

  describe('when we have two consecutive hours of snow', () => {
    beforeEach(() => {
      const report1 = makeForecastList(1, dtHour(0), false, 35.24);
      const report2 = makeForecastList(2, dtHour(1), true, 32.87);
      const report3 = makeForecastList(2, dtHour(3), false, 32.87);
      forecast = {
        'current': makeForecast(1670879317, false, 35.24),
        'hourly': [...report1, ...report2, ...report3],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('expecting two consecutive hours of snow', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher(swOptions);
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
        const watcher = await getWatcher(swOptions);
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
        const watcher = await getWatcher(swOptions);
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 0});
        expect(value).toBe(false);
      });
    });
  });

  describe('when cold precipitation coming in three hours', () => {
    beforeEach(() => {
      const report1 = makeForecastList(3, dtHour(0), false, 35.24);
      const report2 = makeForecastList(2, dtHour(3), false, 30.61);
      report2[0].hasPrecip = true;
      report2[1].hasPrecip = true;

      forecast = {
        'current': makeForecast(1670879317, false, 35.24),
        'hourly': [...report1, ...report2],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when expecting cold precipitation in two hours', () => {
      it('should NOT see snowing later', async () => {
        const watcher = await getWatcher({...swOptions, coldPrecipitationThreshold: 32});
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 2, hoursAfterSnowIsSnowy: 2});
        expect(value).toBe(false);
      });
    });

    describe('when expecting cold precipitation in three hours', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher({...swOptions, coldPrecipitationThreshold: 32});
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 3, hoursAfterSnowIsSnowy: 3});
        expect(value).toBe(true);
      });
    });
  });

  describe('when it stopped snowing 2 hours ago', () => {
    const setupPastMocks = async (watcher, snowing: boolean[][]) => {
      for (let i = 0; i < snowing.length; i++) {
        const offsetHours = -(snowing.length - i - 1);
        const forecast = {
          'current': makeForecast(dtHour(offsetHours), snowing[i][0], 35.24),
          'hourly': makeForecastList(5, dtHour(offsetHours), snowing[i][1], 35.24),
        };
        await readMockForecast(watcher, forecast);
      }
    };

    describe('snowing now but not past or future', () => {
      beforeEach(async () => {
        await SnowWatch.init(logger, swOptions);
        const watcher = SnowWatch.getInstance();
        await setupPastMocks(watcher, [[false, false], [false, false], [false, false], [false, false]]);

        const report1 = makeForecastList(2, dtHour(0), false, 35.24);
        const report2 = makeForecastList(3, dtHour(2), false, 32.61);
        const report3 = makeForecastList(2, dtHour(5), false, 35.24);
        forecast = {
          'current': makeForecast(1670879317, true, 35.24),
          'hourly': [...report1, ...report2, ...report3],
        };
        // use the above forecast mock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast').mockResolvedValueOnce(forecast);
        await readMockForecast(watcher, forecast);
      });

      it('should only snowing now', () => {
        const watcher = SnowWatch.getInstance();
        const values = watcher.getSnowSenseValues();
        expect(values.snowingNow).toBe(true);
        expect(values.lastSnowTime).toBe(0);
        expect(values.pastConsecutiveHours).toBe(1);
        expect(values.nextSnowTime).toBeUndefined();
        expect(values.futureConsecutiveHours).toBe(0);
      });

      it('snowing now, so its all true', () => {
        const watcher = SnowWatch.getInstance();

        let value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 0});
        expect(value).toBe(true);

        value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 1, hoursAfterSnowIsSnowy: 1});
        expect(value).toBe(true);

        value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 2, hoursAfterSnowIsSnowy: 2});
        expect(value).toBe(true);

      });
    });

    describe('it snowed, stopped, then will snow again', () => {
      beforeEach(async () => {
        await SnowWatch.init(logger, swOptions);
        const watcher = SnowWatch.getInstance();
        await setupPastMocks(watcher, [[false, false], [true, false], [true, false], [false, false]]);

        const report1 = makeForecastList(2, dtHour(0), false, 35.24);
        const report2 = makeForecastList(3, dtHour(2), true, 32.61);
        const report3 = makeForecastList(2, dtHour(5), false, 35.24);
        forecast = {
          'current': makeForecast(1670879317, false, 35.24),
          'hourly': [...report1, ...report2, ...report3],
        };
        // use the above forecast mock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast').mockResolvedValueOnce(forecast);
        await readMockForecast(watcher, forecast);
      });

      it('should see old snow and future snow, but not now', () => {
        const watcher = SnowWatch.getInstance();
        const values = watcher.getSnowSenseValues();
        expect(values.snowingNow).toBe(false);
        expect(values.lastSnowTime).toBeCloseTo(1.143);
        expect(values.pastConsecutiveHours).toBe(2);
        expect(values.nextSnowTime).toBeCloseTo(1.856);
        expect(values.futureConsecutiveHours).toBe(3);
      });

      it('should see snowing later', async () => {
        const watcher = SnowWatch.getInstance();
        const values1 = watcher.getSnowSenseValues();
        const values2 = watcher.getSnowSenseValues();
        expect(values1).toEqual(values2);

        let value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 1});
        expect(value).toBe(false);

        value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 2});
        expect(value).toBe(true);

        value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 3});
        expect(value).toBe(true);

        value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 1, hoursAfterSnowIsSnowy: 0});
        expect(value).toBe(false);

        value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 2, hoursAfterSnowIsSnowy: 0});
        expect(value).toBe(true);

        value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 0});
        expect(value).toBe(false);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursAfterSnowIsSnowy: 2,
          hoursBeforeSnowIsSnowy: 0, consecutiveHoursFutureIsSnowy: 0,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursAfterSnowIsSnowy: 0,
          hoursBeforeSnowIsSnowy: 2, consecutiveHoursFutureIsSnowy: 2,
        });
        expect(value).toBe(true);

        value = watcher.snowSensorValue({
          ...dConfig,
          hoursAfterSnowIsSnowy: 0,
          hoursBeforeSnowIsSnowy: 2, consecutiveHoursFutureIsSnowy: 4,
        });
        expect(value).toBe(false);
      });
    });

    describe('it stopped snowing a little over two hours ago', () => {
      beforeEach(async () => {
        await SnowWatch.init(logger, swOptions);
        const watcher = SnowWatch.getInstance();
        await setupPastMocks(watcher, [[true, false], [true, false], [false, false], [false, false]]);
      });

      it('should see that it is NOT snowy', async () => {
        const watcher = SnowWatch.getInstance();
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 2, hoursAfterSnowIsSnowy: 2});
        expect(value).toBe(false);
      });

      it('should see it IS snowy', async () => {
        const watcher = SnowWatch.getInstance();
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 3, hoursAfterSnowIsSnowy: 3});
        expect(value).toBe(true);
      });

      it('should not be snowy', async () => {
        const watcher = SnowWatch.getInstance();
        const value = watcher.snowSensorValue({...dConfig, hoursBeforeSnowIsSnowy: 0, hoursAfterSnowIsSnowy: 0});
        expect(value).toBe(false);
      });

      it('should have the right values', () => {
        const watcher = SnowWatch.getInstance();
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
      await SnowWatch.init(logger, swOptions);
      const watcher = SnowWatch.getInstance();
      const spy = jest.spyOn(logger, 'debug');
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.debugOn = true;
      watcherProto.logger = logger;
      watcherProto.debug('test');
      expect(spy).toHaveBeenCalled();
    });
  });

});
