import SnowWatch from './SnowWatch';
import SnowForecastService from './SnowForecastService';

describe('SnowWatch', () => {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let forecast, forecast1, forecast2: any;
  const nowTime = new Date(1670879317000);
  const nowSecs = nowTime.getTime() / 1000;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(nowTime));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when snow coming in three hours', () => {
    beforeEach(() => {
      forecast = {
        'current': {'dt': 1670879317, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
        'hourly': [
          {'dt': 1670878800, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670882400, 'temp': 35.87, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670886000, 'temp': 35.33, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670889600, 'temp': 35.61, 'hasSnow': true, 'hasPrecip': true},
          {'dt': 1670893200, 'temp': 35.71, 'hasSnow': true, 'hasPrecip': true},
        ],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when expecting snow in two hours', () => {
      beforeEach(() => {

        SnowWatch.init(console,
          {
            apiKey: 'xxx',
            apiVersion: '2.5',
            debugOn: false,
            location: '0,0',
            units: 'imperial',
            hoursAfterSnowIsSnowy: 2,
            hoursBeforeSnowIsSnowy: 2,
          });
      });

      it('should NOT see snowing later', async () => {
        const watcher = SnowWatch.getInstance();
        expect(watcher).toBeDefined();
        await watcher.updatePredictionStatus();
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(false);
      });
    });

    describe('when expecting snow in three hours', () => {
      beforeEach(() => {
        SnowWatch.init(console,
          {
            apiKey: 'xxx',
            debugOn: false,
            apiVersion: '2.5',
            location: '0,0',
            units: 'imperial',
            hoursAfterSnowIsSnowy: 3,
            hoursBeforeSnowIsSnowy: 3,
          });
      });

      it('should see snowing later', async () => {
        const watcher = SnowWatch.getInstance();
        expect(watcher).toBeDefined();
        await watcher.updatePredictionStatus();
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(true);
        expect(watcher.snowedRecently()).toBe(true);
      });
    });
  });

  describe('when cold precipitation coming in three hours', () => {
    beforeEach(() => {
      forecast = {
        'current': {'dt': 1670879317, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
        'hourly': [
          {'dt': 1670878800, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670882400, 'temp': 35.87, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670886000, 'temp': 35.33, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670889600, 'temp': 30.61, 'hasSnow': false, 'hasPrecip': true},
          {'dt': 1670893200, 'temp': 30.71, 'hasSnow': false, 'hasPrecip': true},
        ],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when expecting cold precipitation in two hours', () => {
      beforeEach(() => {

        SnowWatch.init(console,
          {
            apiKey: 'xxx',
            apiVersion: '2.5',
            debugOn: false,
            location: '0,0',
            units: 'imperial',
            hoursAfterSnowIsSnowy: 2,
            hoursBeforeSnowIsSnowy: 2,
            coldPrecipitationThreshold: 32,
          });
      });

      it('should NOT see snowing later', async () => {
        const watcher = SnowWatch.getInstance();
        expect(watcher).toBeDefined();
        await watcher.updatePredictionStatus();
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(false);
      });
    });

    describe('when expecting cold precipitation in three hours', () => {
      beforeEach(() => {
        SnowWatch.init(console,
          {
            apiKey: 'xxx',
            apiVersion: '2.5',
            debugOn: false,
            location: '0,0',
            units: 'imperial',
            hoursAfterSnowIsSnowy: 3,
            hoursBeforeSnowIsSnowy: 3,
            coldPrecipitationThreshold: 32,
          });
      });

      it('should see snowing later', async () => {
        const watcher = SnowWatch.getInstance();
        expect(watcher).toBeDefined();
        await watcher.updatePredictionStatus();
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

      forecast = {
        'current': {'dt': 1670879317, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
        'hourly': [
          {'dt': 1670878800, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670882400, 'temp': 35.87, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670886000, 'temp': 35.33, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670889600, 'temp': 30.61, 'hasSnow': false, 'hasPrecip': false},
          {'dt': 1670893200, 'temp': 30.71, 'hasSnow': false, 'hasPrecip': false},
        ],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast);
    });

    describe('when not snowy when it stopped 2 hours ago', () => {
      beforeEach(() => {

        SnowWatch.init(console,
          {
            apiKey: 'xxx',
            apiVersion: '2.5',
            debugOn: false,
            location: '0,0',
            units: 'imperial',
            hoursAfterSnowIsSnowy: 3,
            hoursBeforeSnowIsSnowy: 3,
          });
      });

      it('should see that it snowed recently', async () => {
        const watcher = SnowWatch.getInstance();
        watcher.setSnowForecastedTime(twoHoursAgo);
        await watcher.updatePredictionStatus();
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(true);
      });

      it('should see it did not snow recently', async () => {
        const watcher = SnowWatch.getInstance();
        watcher.setSnowForecastedTime(threeHoursAgo);
        await watcher.updatePredictionStatus();
        expect(watcher.snowingNow()).toBe(false);
        expect(watcher.snowingSoon()).toBe(false);
        expect(watcher.snowedRecently()).toBe(true);
      });
    });
  });

  describe('when its three hours after last snow', () => {
    const laterSecs = nowSecs + 60 * 60 * 3;
    const hourSecs = 60 * 60;
    beforeEach(() => {
      forecast1 = {
        'current': {'dt': nowSecs, 'temp': 35.24, 'hasSnow': true, 'hasPrecip': true},
        'hourly': [
          {'dt': nowSecs + hourSecs, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
          {'dt': nowSecs + hourSecs * 2, 'temp': 35.87, 'hasSnow': false, 'hasPrecip': false},
          {'dt': nowSecs + hourSecs * 3, 'temp': 35.33, 'hasSnow': false, 'hasPrecip': false},
          {'dt': nowSecs + hourSecs * 4, 'temp': 30.61, 'hasSnow': false, 'hasPrecip': false},
        ],
      };
      forecast2 = {
        'current': {'dt': laterSecs, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
        'hourly': [
          {'dt': laterSecs + hourSecs, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
          {'dt': laterSecs + hourSecs * 2, 'temp': 35.87, 'hasSnow': false, 'hasPrecip': false},
          {'dt': laterSecs + hourSecs * 3, 'temp': 35.33, 'hasSnow': false, 'hasPrecip': false},
          {'dt': laterSecs + hourSecs * 4, 'temp': 30.61, 'hasSnow': false, 'hasPrecip': false},
        ],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast1)
        .mockResolvedValueOnce(forecast2)
        .mockResolvedValueOnce(forecast2);

      SnowWatch.init(console,
        {
          apiKey: 'xxx',
          apiVersion: '2.5',
          debugOn: false,
          location: '0,0',
          units: 'imperial',
          hoursAfterSnowIsSnowy: 3,
          hoursBeforeSnowIsSnowy: 3,
        });
    });

    it('should see it did not snow recently', async () => {
      const watcher = SnowWatch.getInstance();

      // now
      jest.useFakeTimers().setSystemTime(new Date(nowSecs * 1000));
      await watcher.updatePredictionStatus();

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

  describe('Zero hours before and after (only on when currently snowing) ', () => {
    const laterSecs = nowSecs + 10;
    const hourSecs = 60 * 60;
    beforeEach(() => {
      forecast1 = {
        'current': {'dt': nowSecs, 'temp': 35.24, 'hasSnow': true, 'hasPrecip': true},
        'hourly': [
          {'dt': nowSecs + hourSecs, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
          {'dt': nowSecs + hourSecs * 2, 'temp': 35.87, 'hasSnow': false, 'hasPrecip': false},
          {'dt': nowSecs + hourSecs * 3, 'temp': 35.33, 'hasSnow': false, 'hasPrecip': false},
          {'dt': nowSecs + hourSecs * 4, 'temp': 30.61, 'hasSnow': false, 'hasPrecip': false},
        ],
      };
      forecast2 = {
        'current': {'dt': laterSecs, 'temp': 35.24, 'hasSnow': false, 'hasPrecip': false},
        'hourly': [
          {'dt': laterSecs + hourSecs, 'temp': 35.24, 'hasSnow': true, 'hasPrecip': false},
          {'dt': laterSecs + hourSecs * 2, 'temp': 35.87, 'hasSnow': false, 'hasPrecip': false},
          {'dt': laterSecs + hourSecs * 3, 'temp': 35.33, 'hasSnow': false, 'hasPrecip': false},
          {'dt': laterSecs + hourSecs * 4, 'temp': 30.61, 'hasSnow': false, 'hasPrecip': false},
        ],
      };

      // use the above forecast mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getSnowForecast')
        .mockResolvedValueOnce(forecast1)
        .mockResolvedValueOnce(forecast2)
        .mockResolvedValueOnce(forecast2);

      SnowWatch.init(console,
        {
          apiKey: 'xxx',
          apiVersion: '2.5',
          location: '0,0',
          units: 'imperial',
          hoursAfterSnowIsSnowy: 0,
          hoursBeforeSnowIsSnowy: 0,
        });
    });

    it('should see it did not snow recently', async () => {
      const watcher = SnowWatch.getInstance();

      jest.useFakeTimers().setSystemTime(new Date(nowSecs * 1000));
      await watcher.updatePredictionStatus();

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


});
