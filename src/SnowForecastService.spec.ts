import SnowForecastService from './SnowForecastService';
import axios from 'axios';


// To see all possible weather conditions, look here:
// https://openweathermap.org/weather-conditions
// the only thing that matters there is the 'id' field
const weather = {
  current: {dt: 1670879317, temp: 31.24, weather: [{'id': 800, 'main': 'Clear'}]},
  hourly: [
    {dt: 1670878800, temp: 31.24, weather: [{'id': 800, 'main': 'Clear'}]},
    {dt: 1670882400, temp: 30.87, weather: [{'id': 804, 'main': 'Clouds'}]},
    {dt: 1670886000, temp: 30.33, weather: [{'id': 501, 'main': 'Rain'}]},
    {dt: 1670889600, temp: 29.61, weather: [{'id': 500, 'main': 'Rain'}]},
    {dt: 1670893200, temp: 28.71, weather: [{'id': 600, 'main': 'Snow'}]},
  ],
};

const zipToLocationData = {
  zip: '02461',
  name: 'Newton',
  lat: 42.3168,
  lon: -71.2084,
  country: 'US',
};

const cityToLocationData = [
  {
    name: 'Newton Highlands',
    lat: 42.3219158,
    lon: -71.2071228,
    country: 'US',
    state: 'Massachusetts',
  },
];

jest.mock('axios');

describe('SnowForecastService', () => {

  describe('Weather to Snow Forecast', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(1670879317));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getLocationFromZip')
        .mockResolvedValueOnce({lat: 40.7128, lon: -74.006});

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getLocationFromCity')
        .mockResolvedValueOnce({lat: 40.7128, lon: -74.006});

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getWeatherFromApi')
        .mockResolvedValueOnce(weather);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should turn weather forecast into Snow forecast', async () => {
      const snowForecastService = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '11563', units: 'imperial', apiThrottleMinutes: 10});
      await snowForecastService.setup();
      expect(snowForecastService.units).toBe('imperial');
      const forecast = await snowForecastService.getSnowForecast();
      expect(forecast).toBeDefined();
      expect(forecast.current.temp).toBe(31.24);
      expect(forecast.current.hasSnow).toBe(false);
      expect(forecast.current.hasPrecip).toBe(false);
      expect(forecast.hourly.map(h => (h.temp))).toStrictEqual([31.24, 30.87, 30.33, 29.61, 28.71]);
      expect(forecast.hourly.map(h => (h.hasSnow))).toStrictEqual([false, false, false, false, true]);
      expect(forecast.hourly.map(h => (h.hasPrecip))).toStrictEqual([false, false, true, true, true]);
    });

    it('should use cached weather on second try', async () => {
      const snowForecastService = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '11563', units: 'imperial', apiThrottleMinutes: 10});
      await snowForecastService.setup();
      expect(snowForecastService.units).toBe('imperial');
      // first call
      const forecast1 = await snowForecastService.getSnowForecast();
      expect(forecast1).toBeDefined();

      // second call (should be using cached version)
      const forecast = await snowForecastService.getSnowForecast();
      expect(forecast).toBeDefined();

      expect(forecast.current.temp).toBe(31.24);
      expect(forecast.current.hasSnow).toBe(false);
      expect(forecast.current.hasPrecip).toBe(false);
      expect(forecast.hourly.map(h => (h.temp))).toStrictEqual([31.24, 30.87, 30.33, 29.61, 28.71]);
      expect(forecast.hourly.map(h => (h.hasSnow))).toStrictEqual([false, false, false, false, true]);
      expect(forecast.hourly.map(h => (h.hasPrecip))).toStrictEqual([false, false, true, true, true]);
    });
  });

  describe('Try simultaneous calls', () => {
    beforeEach(() => {
      jest.useRealTimers();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(SnowForecastService.prototype as any, 'getWeatherFromApi')
        .mockResolvedValueOnce(weather);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // This test breaks when fakeTimers are used as that breaks the sleep function
    it('should block a simultaneous call to get weather', async () => {
      const snowForecastService = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'imperial', apiThrottleMinutes: 10});
      await snowForecastService.setup();
      expect(snowForecastService.units).toBe('imperial');

      // first call
      const forecast1p = snowForecastService.getSnowForecast();

      // second call (should be using cached version)
      const forecast = await snowForecastService.getSnowForecast();
      expect(forecast).toBeDefined();

      const forecast1 = await forecast1p;
      expect(forecast1).toBeDefined();

      expect(forecast).toStrictEqual(forecast1);
    });

    // This test breaks when fakeTimers are used as that breaks the sleep function
    it('should timeout when it takes too long', async () => {
      const weather = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.debugOn = true;
      weatherProto.logger = console;
      weatherProto.fetchLock = true;
      weatherProto.lockTimeoutMillis = 20;
      try {
        await weatherProto.getSnowForecast();
        expect(true).toBe(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        expect(e.message).toBe('Weather fetch is locked');
      }
    });
  });

  describe('Zip to lat,lon', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should set lat,lon to values from zip api', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({data: zipToLocationData}));

      const weather = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '02461', units: 'metric', apiThrottleMinutes: 10});
      await weather.setup();
      expect(weather.latLon).toStrictEqual({lat: 42.3168, lon: -71.2084});
      expect(weather.units).toBe('metric');
    });

    it('should handle failed zip api', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve(null));
      const weather = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '02461', units: 'metric', apiThrottleMinutes: 10});
      try {
        await weather.setup();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        expect(e.message).toBe('No location found for zip code (02461)');
      }
    });

  });

  describe('City to lat,lon', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should set default values for location and units', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({data: cityToLocationData}));

      const weather = new SnowForecastService(console,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          apiThrottleMinutes: 10,
        });
      expect(weather.location).toBe('New York,NY,US');
      expect(weather.units).toBe('imperial');
    });

    it('should set lat,lon to values from city api', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({data: cityToLocationData}));

      const weather = new SnowForecastService(console,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          location: 'Newton Highlands, MA, US',
          units: 'standard',
          apiThrottleMinutes: 10,
        });
      await weather.setup();
      expect(weather.latLon).toStrictEqual({lat: 42.3219158, lon: -71.2071228});
      expect(weather.units).toBe('standard');
    });

    it('should handle 401 when calling city api', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({cod: 401, message: 'fail'}));
      const weather = new SnowForecastService(console,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          location: 'Newton Highlands, MA, US',
          units: 'standard',
          apiThrottleMinutes: 10,
        });
      let failed = false;
      try {
        await weather.setup();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        expect(e.message).toBe('fail');
        failed = true;
      } finally {
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect(failed).toBe(true);
      }

    });

    it('should handle bad city api response', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve(null));
      const weather = new SnowForecastService(console,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          location: 'Newton Highlands, MA, US',
          units: 'standard',
          apiThrottleMinutes: 10,
        });
      let failed = false;
      try {
        await weather.setup();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        expect(e.message).toBe('No location found for city (Newton Highlands, MA, US)');
        failed = true;
      } finally {
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect(failed).toBe(true);
      }

    });

    it('should handle bad data from api', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({data: ''}));
      const weather = new SnowForecastService(console,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          location: 'Newton Highlands, MA, US',
          units: 'standard',
          apiThrottleMinutes: 10,
        });
      let failed = false;
      try {
        await weather.setup();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        expect(e.message).toContain('Did you include a country code');
        failed = true;
      } finally {
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect(failed).toBe(true);
      }
    });
  });

  describe('Test bad api url', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fail when no url', async () => {
      axios.get = jest.fn()
        .mockImplementation(() => Promise.resolve({data: {a: 1, b: 2}}));

      const weather = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();

      const weatherProto = Object.getPrototypeOf(weather);

      try {
        await weatherProto.getWeatherFromApi();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        expect(e.message).toContain('URL not yet set for openweathermap');
        return;
      }
      expect(false).toBe(true);

      weatherProto.weatherUrl = 'https://openweathermap.org/data/2.5/onecall?lat=0&lon=0&units=standard&appid=xxx';
      const result = await weatherProto.getWeatherFromApi();
      expect(result).toStrictEqual({a: 1, b: 2});
    });

    it('should work when there is a url', async () => {
      axios.get = jest.fn()
        .mockImplementation(() => Promise.resolve({data: {a: 1, b: 2}}));

      const weather = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.weatherUrl = 'https://openweathermap.org/data/2.5/onecall?lat=0&lon=0&units=standard&appid=xxx';
      const result = await weatherProto.getWeatherFromApi();
      expect(result).toStrictEqual({a: 1, b: 2});
    });

    it('should fail when api call throws error', async () => {
      axios.get = jest.fn()
        .mockImplementation(() => Promise.reject({response: {data: {message: 'fail'}}}));

      const weather = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.weatherUrl = 'https://openweathermap.org/data/2.5/onecall?lat=0&lon=0&units=standard&appid=xxx';
      try {
        await weatherProto.getWeatherFromApi();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        expect(e.message).toContain('Error getting weather from OpenWeatherMap: fail');
        return;
      }
      expect(false).toBe(true);
    });
  });

  describe('Test debug logging', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should output to console.debug', async () => {
      // Create a mock function and assign it to console.debug
      console.debug = jest.fn();

      const weather = new SnowForecastService(console,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();
      const spy = jest.spyOn(console, 'debug');
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.debugOn = true;
      weatherProto.logger = console;
      weatherProto.debug('test');
      expect(spy).toHaveBeenCalled();
    });
  });
});
