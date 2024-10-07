declare global {
  interface WeatherCondition {
    id: number;
    main: string;
    description: string;
    icon: string;
  }

  interface CurrentWeather {
    dt: number;
    sunrise: number;
    sunset: number;
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
    dew_point: number;
    uvi: number;
    clouds: number;
    visibility: number;
    wind_speed: number;
    wind_deg: number;
    weather: WeatherCondition[];
  }

  interface HourlyForecast {
    dt: number;
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
    dew_point: number;
    uvi: number;
    clouds: number;
    visibility: number;
    wind_speed: number;
    wind_deg: number;
    wind_gust: number;
    weather: WeatherCondition[];
    pop: number;
  }

  interface OpenWeatherResponse {
    lat: number;
    lon: number;
    timezone: string;
    timezone_offset: number;
    current: CurrentWeather;
    hourly: HourlyForecast[];
  }

  interface GeocodingResponse {
    name: string;
    local_names?: { [key: string]: string };
    lat: number;
    lon: number;
    country: string;
    state?: string;
  }

  interface ZipCodeResponse {
    zip: string;
    name: string;
    lat: number;
    lon: number;
    country: string;
  }
}
export {};
