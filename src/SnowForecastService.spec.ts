import SnowForecastService from './SnowForecastService';


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

describe('Weather', () => {

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
    const weather = new SnowForecastService(console,
      {apiKey: 'xxx', location: '11563', units: 'imperial', apiThrottleMinutes: 10});
    await weather.setup();
    const forecast = await weather.getSnowForecast();
    expect(forecast).toBeDefined();
    expect(forecast.current.temp).toBe(31.24);
    expect(forecast.current.hasSnow).toBe(false);
    expect(forecast.current.hasPrecip).toBe(false);
    expect(forecast.hourly.map(h => (h.temp))).toStrictEqual([31.24, 30.87, 30.33, 29.61, 28.71]);
    expect(forecast.hourly.map(h => (h.hasSnow))).toStrictEqual([false, false, false, false, true]);
    expect(forecast.hourly.map(h => (h.hasPrecip))).toStrictEqual([false, false, true, true, true]);
  });
});
