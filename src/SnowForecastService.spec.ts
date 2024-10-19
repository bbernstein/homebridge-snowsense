/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="../types/openweathermap" />

import SnowForecastService from './SnowForecastService';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { Logger } from 'homebridge';
import { HttpClient } from './HttpClient';
import { clearCache } from './cacheDecorator';

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

function createMockAxiosError(message: string, status?: number): AxiosError {
  return new AxiosError(message, 'ERR_NETWORK', undefined, undefined, status ? {status} as AxiosResponse : undefined);
}

class MockHttpClient implements HttpClient {
  private responses: Map<string, any> = new Map();

  setResponse(url: string, response: any) {
    this.responses.set(url, response);
  }

  async get<T>(url: string): Promise<{ data: T }> {
    const response = this.responses.get(url);
    if (response === undefined) {
      throw new Error(`No mock response set for URL: ${url}`);
    }
    if (response instanceof AxiosError) {
      throw response;
    }
    if (response instanceof Error) {
      throw response;
    }
    return {data: response as T};
  }
}

// In your test file
const mockHttpClient = new MockHttpClient();

describe('SnowForecastService', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockWeatherResponse: OpenWeatherResponse;
  let baseUrl = 'https://api.openweathermap.org/data/3.0/onecall';

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
    let apiUrl: string;
    beforeEach(() => {
      baseUrl = 'https://api.openweathermap.org/data/3.0/onecall';
      mockWeatherResponse = {
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

      const params = new URLSearchParams({
        lat: '40.7128',
        lon: '-74.0060',
        appid: 'test-api-key',
        units: 'imperial',
        exclude: 'minutely,alerts,daily',
      });
      apiUrl = `${baseUrl}?${params}`;
      service = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '11563', units: 'imperial', apiThrottleMinutes: 10});
      (service as any).weatherUrl = apiUrl;
    });

    it('should return weather data when API call is successful', async () => {
      (service as any).weatherUrl = apiUrl;
      mockHttpClient.setResponse(apiUrl, mockWeatherResponse);

      const result = await (service as any).getWeatherFromApi();
      expect(result).toEqual(mockWeatherResponse);
    });

    it('should throw an error when weatherUrl is not set', async () => {
      (service as any).weatherUrl = undefined;

      await expect((service as any).getWeatherFromApi()).rejects.toThrow('URL not yet set for openweathermap');
    });

    it('should throw an error with API message when Axios error occurs', async () => {
      const mockError = createMockAxiosError('Bad Request', 401);
      mockHttpClient.setResponse(apiUrl, mockError);
      await expect((service as any).getWeatherFromApi()).rejects.toThrow('Invalid OpenWeatherMap API key');
    });

    it('should throw an error when rate-limited status 429 occurs', async () => {
      const mockError = createMockAxiosError('OpenWeatherMap API rate limit exceeded', 429);
      mockHttpClient.setResponse(apiUrl, mockError);
      await expect((service as any).getWeatherFromApi()).rejects.toThrow('OpenWeatherMap API rate limit exceeded');
    });

    it('should throw an error with Axios error message when no response data', async () => {
      const mockError = createMockAxiosError('Network Error', 500);
      mockHttpClient.setResponse(apiUrl, mockError);

      await expect((service as any).getWeatherFromApi()).rejects.toThrow('Error getting weather from OpenWeatherMap: Network Error');
    });

    it('should throw an unexpected error for non-Axios errors', async () => {
      const mockError = new Error('Some unexpected error');
      mockHttpClient.setResponse(apiUrl, mockError);
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
      const snowForecastService = new SnowForecastService(mockLogger, mockHttpClient,
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

    it('should turn weather forecast into Snow forecast with default option values', async () => {
      const snowForecastService = new SnowForecastService(mockLogger, mockHttpClient,
        {units: 'imperial'});
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
      const snowForecastService = new SnowForecastService(mockLogger, mockHttpClient,
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
      const snowForecastService = new SnowForecastService(mockLogger, mockHttpClient,
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
  });

  describe('Test missing params', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fail when weatherUrl is missing', async () => {
      const snowForecastService = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'imperial', apiThrottleMinutes: 10});
      await snowForecastService.setup();
      expect(snowForecastService.units).toBe('imperial');
      const snowForecastProto = Object.getPrototypeOf(snowForecastService);
      snowForecastProto.weatherUrl = undefined;
      await expect(snowForecastProto.getWeatherFromApi()).rejects.toThrow('URL not yet set for openweathermap');
    });
  });

  describe('Zip to lat,lon', () => {
    let mockZipResponse: any;

    beforeEach(() => {
      mockZipResponse = {zip: '10001', name: 'New York', lat: 40.7128, lon: -74.0060, country: 'US'};
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should set lat,lon to values from zip api', async () => {
      const apiUrl = 'https://api.openweathermap.org/geo/1.0/zip?zip=10001&limit=1&appid=xxx';
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '10001', units: 'imperial', apiThrottleMinutes: 10});

      mockHttpClient.setResponse(apiUrl, mockZipResponse);

      await service.setup();
      expect(service.latLon).toStrictEqual({lat: 40.7128, lon: -74.0060});
    });

    it('should handle non-axios error from zip api', async () => {
      const apiUrl = 'https://api.openweathermap.org/geo/1.0/zip?zip=10001&limit=1&appid=xxx';
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '10001', units: 'imperial', apiThrottleMinutes: 10});
      const mockError = new Error('unknown error');
      mockHttpClient.setResponse(apiUrl, mockError);
      await expect(service.setup()).rejects.toThrow('Unexpected error getting location from zip code \'10001\': Error: unknown error');
    });


    it('should handle failed zip api', async () => {
      const apiUrl = 'https://api.openweathermap.org/geo/1.0/zip?zip=10001&limit=1&appid=xxx';
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '10001', units: 'imperial', apiThrottleMinutes: 10});
      const mockError = createMockAxiosError('Bad Request', 401);
      mockHttpClient.setResponse(apiUrl, mockError);
      await expect(service.setup()).rejects.toThrow('Error 401 getting location from zip code \'10001\': Bad Request');
    });

    it('should handle an error thrown due to bad zip code', async () => {
      const apiUrl = 'https://api.openweathermap.org/geo/1.0/zip?zip=10001&limit=1&appid=xxx';
      const mockError = createMockAxiosError('Resource Not Found', 404);
      mockHttpClient.setResponse(apiUrl, mockError);
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '10001', units: 'imperial', apiThrottleMinutes: 10});
      await expect(service.setup()).rejects.toThrow('No location found for zip code \'10001\'');
    });

    it('should handle an error thrown due to bad zip code and undefined response', async () => {
      const apiUrl = 'https://api.openweathermap.org/geo/1.0/zip?zip=10001&limit=1&appid=xxx';
      // don't use the mock creator for this since we need undefined response
      const mockError = createMockAxiosError('xxx');
      mockHttpClient.setResponse(apiUrl, mockError);
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '10001', units: 'imperial', apiThrottleMinutes: 10});
      await expect(service.setup()).rejects.toThrow('Error undefined getting location from zip code \'10001\': xxx');
    });
  });

  describe('City to lat,lon', () => {
    let mockCityResponse: any;
    beforeEach(() => {
      mockCityResponse = [{zip: '10001', name: 'New York', lat: 40.7128, lon: -74.0060, country: 'US'}];
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should set default values for location and units', async () => {
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          apiThrottleMinutes: 10,
        });
      expect(service.location).toBe('New York,NY,US');
      expect(service.units).toBe('imperial');
    });

    it('should set lat,lon to values from city api', async () => {
      const apiUrl = 'https://api.openweathermap.org/geo/1.0/direct?q=Newton%20Highlands%2C%20MA%2C%20US&limit=1&appid=xxx';
      mockHttpClient.setResponse(apiUrl, mockCityResponse);
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          location: 'Newton Highlands, MA, US',
          units: 'standard',
          apiThrottleMinutes: 10,
        });
      await service.setup();
      expect(service.latLon).toStrictEqual({lat: 40.7128, lon: -74.006});
      expect(service.units).toBe('standard');
    });

    it('should handle 401 when calling city api', async () => {
      const apiUrl = 'https://api.openweathermap.org/geo/1.0/direct?q=Newton%20Highlands%2C%20MA%2C%20US&limit=1&appid=xxx';
      const mockError = createMockAxiosError('Bad Request', 401);
      mockHttpClient.setResponse(apiUrl, mockError);
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          location: 'Newton Highlands, MA, US',
          units: 'standard',
          apiThrottleMinutes: 10,
        });
      await expect(service.setup()).rejects.toThrow('Bad Request');
    });

    it('should handle bad data from api', async () => {
      const apiUrl = 'https://api.openweathermap.org/geo/1.0/direct?q=Newton%20Highlands%2C%20MA%2C%20US&limit=1&appid=xxx';
      mockHttpClient.setResponse(apiUrl, []);
      const service = new SnowForecastService(mockLogger, mockHttpClient,
        {
          apiKey: 'xxx',
          apiVersion: '3.0',
          location: 'Newton Highlands, MA, US',
          units: 'standard',
          apiThrottleMinutes: 10,
        });
      await expect(service.setup()).rejects.toThrow('Did you include a country code');
    });
  });

  describe('Test bad api url', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fail when no url', async () => {
      const weather = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.weatherUrl = undefined;
      await expect(weatherProto.getWeatherFromApi()).rejects.toThrow('URL not yet set for openweathermap');
    });

    it('should fail when no url at forecast level', async () => {
      // try {
      const weather = new SnowForecastService(mockLogger, mockHttpClient,
        {apiKey: 'xxx', apiVersion: '3.0', location: '0,0', units: 'standard', apiThrottleMinutes: 10});
      await weather.setup();
      const weatherProto = Object.getPrototypeOf(weather);
      weatherProto.weatherUrl = undefined;
      clearCache(weatherProto, 'getSnowForecast');
      await expect(weatherProto.getSnowForecast()).rejects.toThrow('URL not yet set for openweathermap');
    });

    it('should work when there is a url', async () => {
      const apiUrl = 'https://openweathermap.org/data/2.5/onecall?lat=0&lon=0&units=standard&appid=xxx';
      mockHttpClient.setResponse(apiUrl, {a: 1, b: 2});
      const result = await mockHttpClient.get(apiUrl);
      expect(result).toStrictEqual({data: {a: 1, b: 2}});
    });

    it('should fail when api call throws error', async () => {
      axios.get = jest.fn()
        .mockImplementation(() => Promise.reject({response: {data: {message: 'fail'}}}));

      const weather = new SnowForecastService(mockLogger, mockHttpClient,
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

      const weather = new SnowForecastService(mockLogger, mockHttpClient,
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
