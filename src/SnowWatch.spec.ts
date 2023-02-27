import SnowWatch, {SnowWatchOptions} from './SnowWatch';
import SnowForecastService, {SnowForecast, SnowReport} from './SnowForecastService';

// template options for default values, if not provided
const swOptions: SnowWatchOptions = {
  apiKey: 'xxx',
  apiVersion: '2.5',
  debugOn: false,
  location: '0,0',
  units: 'imperial',
  hoursAfterSnowIsSnowy: 2,
  hoursBeforeSnowIsSnowy: 2,
  onlyWhenCold: false,
  coldTemperatureThreshold: 32,
  consecutiveHoursOfSnowIsSnowy: 0,
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

// faking timers, so all date/times are relative to these
const nowTime = new Date(1670879317000);
const nowSecs = nowTime.getTime() / 1000;
const startDt = 1670878800;
const hourSecs = 3600; // convenience const, seconds in an hour

/**
 * Return a date/time in seconds for a given hour number (relative to faked timers)
 * @param hourNum index of the hour, 0 is the current hour
 */
const dtHour = (hourNum: number) => {
  return startDt + (hourNum * 3600);
};

const getWatcher = async (options: SnowWatchOptions) => {
  await SnowWatch.init(console, options);
  const watcher = SnowWatch.getInstance();
  await watcher.updatePredictionStatus();
  return watcher;
};

describe('SnowWatch', () => {
  let forecast, forecast1, forecast2: SnowForecast;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(nowTime));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when we can not get SnowWatch instannce', () => {
    it('should NOT get instance', () => {
      expect(SnowWatch.getInstance).toThrow('SnowWatch not initialized');
    });

    it('should get instance, but no forecast', () => {
      SnowWatch.init(console, swOptions);
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

      SnowWatch.init(console, swOptions);
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

      SnowWatch.init(console, swOptions);
      const watcher = SnowWatch.getInstance();
      await watcher.updatePredictionStatus();
      expect(watcher.latestForecast).toBeNull();
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
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(false);
      });
    });

    describe('when expecting snow in three hours', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher({...swOptions, hoursBeforeSnowIsSnowy: 3, hoursAfterSnowIsSnowy: 3});
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(true);
        expect(watcher.snowedRecently()).toBe(true);
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
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(false);
      });
    });

    describe('when expecting regular cold snow', () => {
      it('should see snowing later when it dips below threshold', async () => {
        const watcher = await getWatcher({...swOptions, onlyWhenCold: true, coldTemperatureThreshold: 32});
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(true);
        expect(watcher.snowedRecently()).toBe(true);
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
        const watcher = await getWatcher({...swOptions, consecutiveHoursOfSnowIsSnowy: 2});
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(true);
        expect(watcher.snowedRecently()).toBe(true);
      });
    });

    describe('expecting fail to see three consecutive hours of snow', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher({...swOptions, consecutiveHoursOfSnowIsSnowy: 3});
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(false);
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
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(false);
      });
    });

    describe('when expecting cold precipitation in three hours', () => {
      it('should see snowing later', async () => {
        const watcher = await getWatcher({
          ...swOptions, hoursAfterSnowIsSnowy: 3, hoursBeforeSnowIsSnowy: 3, coldPrecipitationThreshold: 32,
        });
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(true);
        expect(watcher.snowedRecently()).toBe(true);
      });
    });
  });

  describe('when it stopped snowing 2 hours ago', () => {
    const twoHoursAgo = new Date(nowTime.getTime() - 2 * 60 * 60 * 1000);
    const threeHoursAgo = new Date(nowTime.getTime() - 3 * 60 * 60 * 1000);

    beforeEach(() => {

      const report1 = makeForecastList(5, dtHour(0), false, 35.24);
      forecast = {
        'current': makeForecast(1670879317, false, 35.24),
        'hourly': report1,
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when not snowy when it stopped 2 hours ago', () => {
      beforeEach(() => {
        SnowWatch.init(console, {...swOptions, hoursAfterSnowIsSnowy: 3, hoursBeforeSnowIsSnowy: 3});
      });

      it('should see that it snowed recently', async () => {
        const watcher = SnowWatch.getInstance();
        watcher.setSnowForecastedTime(twoHoursAgo); // this feels hacky, but it works
        await watcher.updatePredictionStatus();
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(true);
      });

      it('should see it did not snow recently', async () => {
        const watcher = SnowWatch.getInstance();
        watcher.setSnowForecastedTime(threeHoursAgo); // this feels hacky, but it works
        await watcher.updatePredictionStatus();
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(true);
      });
    });
  });

  describe('when its three hours after last snow', () => {
    const laterSecs = nowSecs + 60 * 60 * 3;
    beforeEach(() => {
      forecast1 = {
        'current': makeForecast(nowSecs, true, 35.24),
        'hourly': makeForecastList(4, nowSecs + hourSecs, false, 35.24),
      };
      forecast2 = {
        'current': makeForecast(laterSecs, false, 35.24),
        'hourly': makeForecastList(4, laterSecs + hourSecs, false, 35.24),
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast1)
        .mockResolvedValueOnce(forecast2)
        .mockResolvedValueOnce(forecast2);
    });

    it('should see it did not snow recently', async () => {
      // now
      jest.useFakeTimers().setSystemTime(new Date(nowSecs * 1000));
      const watcher = await getWatcher({...swOptions, hoursAfterSnowIsSnowy: 3, hoursBeforeSnowIsSnowy: 3});

      expect(watcher.snowingNow()).toBe(true);
      expect(watcher.snowingSoon()).toBe(true);
      expect(watcher.snowedRecently()).toBe(true);

      // not quite 3 hours later
      jest.useFakeTimers().setSystemTime(new Date((laterSecs - 100) * 1000));
      await watcher.updatePredictionStatus();

      expect(watcher.snowingNow()).toBe(false);
      expect(watcher.snowingSoon()).toBe(false);
      expect(watcher.snowedRecently()).toBe(true);

      // over 3 hours later
      jest.useFakeTimers().setSystemTime(new Date((laterSecs + 1) * 1000));
      await watcher.updatePredictionStatus();

      expect(watcher.snowingNow()).toBe(false);
      expect(watcher.snowingSoon()).toBe(false);
      expect(watcher.snowedRecently()).toBe(false);
    });
  });

  describe('zero hours before and after (only on when currently snowing)', () => {
    const laterSecs = nowSecs + 10;
    beforeEach(() => {

      forecast1 = {
        'current': makeForecast(nowSecs, true, 35.24),
        'hourly': makeForecastList(4, nowSecs + hourSecs, false, 35.24),
      };

      const report2 = makeForecastList(4, laterSecs + hourSecs, false, 35.24);
      report2[0].hasSnow = true;
      forecast2 = {
        'current': makeForecast(laterSecs, false, 35.24),
        'hourly': report2,
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast1)
        .mockResolvedValueOnce(forecast2)
        .mockResolvedValueOnce(forecast2);
    });

    it('should see it did not snow recently', async () => {
      jest.useFakeTimers().setSystemTime(new Date(nowSecs * 1000));
      const watcher = await getWatcher({...swOptions, hoursAfterSnowIsSnowy: 0, hoursBeforeSnowIsSnowy: 0});

      expect(watcher.snowingNow()).toBe(true);
      expect(watcher.snowingSoon()).toBe(true);
      expect(watcher.snowedRecently()).toBe(true);

      jest.useFakeTimers().setSystemTime(new Date(laterSecs * 1000));
      await watcher.updatePredictionStatus();

      expect(watcher.snowingNow()).toBe(false);
      expect(watcher.snowingSoon()).toBe(false);
      expect(watcher.snowedRecently()).toBe(false);
    });
  });

  describe('Test debug logging', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should output to console.debug', async () => {
      await SnowWatch.init(console, swOptions);
      const watcher = SnowWatch.getInstance();
      const spy = jest.spyOn(console, 'debug');
      const watcherProto = Object.getPrototypeOf(watcher);
      watcherProto.debugOn = true;
      watcherProto.logger = console;
      watcherProto.debug('test');
      expect(spy).toHaveBeenCalled();
    });
  });

});
