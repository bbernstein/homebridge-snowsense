/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="../types/openweathermap" />

import SnowForecastService from './SnowForecastService';
import axios from 'axios';
import {Logger} from 'homebridge';

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
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  describe('getWeatherFromApi', () => {
    let service: SnowForecastService;
    beforeEach(() => {
      service = new SnowForecastService(mockLogger,
        {apiKey: 'xxx', apiVersion: '3.0', location: '11563', units: 'imperial', apiThrottleMinutes: 10});
      (service as any).weatherUrl = 'https://api.openweathermap.org/mock/url';
    });

    it('should return weather data when API call is successful', async () => {
      const mockResponse: OpenWeatherResponse = {
        lat: 40.7127,
        lon: -74.006,
        timezone: 'America/New_York',
        timezone_offset: -14400,
        current: {
          dt: 1727472053,
          sunrise: 1727434133,
          sunset: 1727477083,
          temp: 70.81,
          feels_like: 71.06,
          pressure: 1015,
          humidity: 74,
          dew_point: 62.11,
          uvi: 0.13,
          clouds: 100,
          visibility: 10000,
          wind_speed: 8.05,
          wind_deg: 50,
          weather: [{
            id: 804,
            main: 'Clouds',
            description: 'overcast clouds',
            icon: '04d',
          }],
        },
        hourly: [
          {
            dt: 1727470800,
            temp: 70.81,
            feels_like: 71.06,
            pressure: 1015,
            humidity: 74,
            dew_point: 62.11,
            uvi: 0.13,
            clouds: 100,
            visibility: 10000,
            wind_speed: 4.65,
            wind_deg: 131,
            wind_gust: 5.48,
            weather: [{
              id: 804,
              main: 'Clouds',
              description: 'overcast clouds',
              icon: '04d',
            }],
            pop: 0,
          },
          {
            dt: 1727474400,
            temp: 70.86,
            feels_like: 71.02,
            pressure: 1015,
            humidity: 72,
            dew_point: 61.39,
            uvi: 0.1,
            clouds: 100,
            visibility: 10000,
            wind_speed: 4.16,
            wind_deg: 122,
            wind_gust: 5.46,
            weather: [{
              id: 804,
              main: 'Clouds',
              description: 'overcast clouds',
              icon: '04d',
            }],
            pop: 0,
          },
          {
            dt: 1727478000,
            temp: 70.72,
            feels_like: 70.83,
            pressure: 1015,
            humidity: 71,
            dew_point: 60.85,
            uvi: 0,
            clouds: 100,
            visibility: 10000,
            wind_speed: 4.79,
            wind_deg: 113,
            wind_gust: 6.98,
            weather: [{
              id: 804,
              main: 'Clouds',
              description: 'overcast clouds',
              icon: '04d',
            }],
            pop: 0,
          },
        ],
      };

      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({ data: mockResponse });

      const result = await (service as any).getWeatherFromApi();
      expect(result).toEqual(mockResponse);
    });

    it('should throw an error when weatherUrl is not set', async () => {
      (service as any).weatherUrl = undefined;

      await expect((service as any).getWeatherFromApi()).rejects.toThrow('URL not yet set for openweathermap');
    });

    it('should throw an error with API message when Axios error occurs', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          data: {
            message: 'API Error Message',
          },
        },
      };

      (axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValueOnce(mockError);

      await expect((service as any).getWeatherFromApi()).rejects.toThrow('Error getting weather from OpenWeatherMap: API Error Message');
    });

    it('should throw an error with Axios error message when no response data', async () => {
      const mockError = {
        isAxiosError: true,
        message: 'Network Error',
      };

      (axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValueOnce(mockError);

      await expect((service as any).getWeatherFromApi()).rejects.toThrow('Error getting weather from OpenWeatherMap: Network Error');
    });

    it('should throw an unexpected error for non-Axios errors', async () => {
      const mockError = new Error('Some unexpected error');

      (axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValueOnce(mockError);

      await expect((service as any).getWeatherFromApi()).rejects.toThrow(
        'Unexpected error getting weather from OpenWeatherMap: Error: Some unexpected error',
      );
    });
  });

  describe('Weather to Snow Forecast', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(1670879317));

      jest.spyOn(SnowForecastService.prototype as any, 'getLocationFromZip')
        .mockResolvedValueOnce({lat: 40.7128, lon: -74.006});

      jest.spyOn(SnowForecastService.prototype as any, 'getLocationFromCity')
        .mockResolvedValueOnce({lat: 40.7128, lon: -74.006});

      jest.spyOn(SnowForecastService.prototype as any, 'getWeatherFromApi')
        .mockResolvedValueOnce(weather);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should turn weather forecast into Snow forecast', async () => {
      const snowForecastService = new SnowForecastService(mockLogger,
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

    it('should turn weather forecast into Snow forecast with default throttle time', async () => {
      const snowForecastService = new SnowForecastService(mockLogger,
        {apiKey: 'xxx', apiVersion: '3.0', location: '11563', units: 'imperial'});
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
      const snowForecastService = new SnowForecastService(mockLogger,
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

      jest.spyOn(SnowForecastService.prototype as any, 'getWeatherFromApi')
        .mockResolvedValueOnce(weather);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // This test breaks when fakeTimers are used as that breaks the sleep function
    it('should block a simultaneous call to get weather', async () => {
      const snowForecastService = new SnowForecastService(mockLogger,
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
      const weather = new SnowForecastService(mockLogger,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.debugOn = true;
      weatherProto.logger = console;
      weatherProto.fetchLock = true;
      weatherProto.lockTimeoutMillis = 20;
      try {
        await weatherProto.getSnowForecast();
        expect(true).toBe(false);
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

      const weather = new SnowForecastService(mockLogger,
        {apiKey: 'xxx', apiVersion: '3.0', location: '02461', units: 'metric', apiThrottleMinutes: 10});
      await weather.setup();
      expect(weather.latLon).toStrictEqual({lat: 42.3168, lon: -71.2084});
      expect(weather.units).toBe('metric');
    });

    it('should handle failed zip api', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve(null));
      const weather = new SnowForecastService(mockLogger,
        {apiKey: 'xxx', apiVersion: '3.0', location: '02461', units: 'metric', apiThrottleMinutes: 10});
      try {
        await weather.setup();
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

      const weather = new SnowForecastService(mockLogger,
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

      const weather = new SnowForecastService(mockLogger,
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
      const weather = new SnowForecastService(mockLogger,
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
      } catch (e: any) {
        failed = true;
      } finally {
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect(failed).toBe(true);
      }

    });

    // it('should handle bad city api response', async () => {
    //   axios.get = jest.fn()
    //     .mockImplementationOnce(() => Promise.resolve(null));
    //   const weather = new SnowForecastService(mockLogger,
    //     {
    //       apiKey: 'xxx',
    //       apiVersion: '3.0',
    //       location: 'Newton Highlands, MA, US',
    //       units: 'standard',
    //       apiThrottleMinutes: 10,
    //     });
    //   let failed = false;
    //   try {
    //     await weather.setup();
    //   } catch (e: any) {
    //     expect(e.message).toBe('No location found for city (Newton Highlands, MA, US)');
    //     failed = true;
    //   } finally {
    //     expect(axios.get).toHaveBeenCalledTimes(1);
    //     expect(failed).toBe(true);
    //   }
    // });

    it('should handle bad data from api', async () => {
      axios.get = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({data: ''}));
      const weather = new SnowForecastService(mockLogger,
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

      const weather = new SnowForecastService(mockLogger,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();

      const weatherProto = Object.getPrototypeOf(weather);

      try {
        await weatherProto.getWeatherFromApi();
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

      const weather = new SnowForecastService(mockLogger,
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

      const weather = new SnowForecastService(mockLogger,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.weatherUrl = 'https://openweathermap.org/data/2.5/onecall?lat=0&lon=0&units=standard&appid=xxx';
      try {
        await weatherProto.getWeatherFromApi();
      } catch (e: any) {
        expect(e.message).toContain('Unexpected error getting weather from OpenWeatherMap:');
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
      // Create a mock function and assign it to mockLogger.debug
      mockLogger.debug = jest.fn();

      const weather = new SnowForecastService(mockLogger,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();
      const spy = jest.spyOn(mockLogger, 'debug');
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.debugOn = true;
      weatherProto.logger = mockLogger;
      weatherProto.debug('test');
      expect(spy).toHaveBeenCalled();
    });
  });
});
