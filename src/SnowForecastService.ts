import { Logger } from 'homebridge';
import { SnowSenseUnits } from './SnowSenseConfig';
import { HttpClient } from './HttpClient';
import axios from 'axios';

/**
 * A single snapshot of data needed to determine if it might be snowing
 * based on a weather information for that time.
 */
export type SnowReport = {
  dt: number;
  temp: number;
  hasSnow: boolean;
  hasPrecip: boolean;
};

/**
 * Snow forecasts for current and future hours
 */
export type SnowForecast = {
  current: SnowReport;
  hourly: SnowReport[];
};

export type SnowForecastOptions = {
  /**
   * Get an api key from https://openweathermap.org/api
   */
  apiKey?: string;
  /**
   * Latest version is 3.0, but allow using 2.5 for backwards compatibility
   */
  apiVersion?: string;
  /**
   * Show debug logging
   */
  debugOn?: boolean;
  /**
   * Do not call the api more often than this number of minutes
   */
  apiThrottleMinutes?: number;

  /**
   * Units to request from weather api
   */
  units?: SnowSenseUnits;

  /**
   * Location to request from weather api
   * This is in format of one of these:
   * - city,state,country (eg, "New York,NY,US")
   * - zip (eg, "10001")
   * - latitude,longitude (eg, "40.7143,-74.006")
   */
  location?: string;
};

export default class SnowForecastService {
  protected readonly apiKey: string;
  protected readonly apiVersion: string;
  protected readonly debugOn: boolean;
  public readonly location: string;
  protected weatherUrl?: string;
  public readonly units: string;
  protected weatherCache?: SnowForecast;
  protected latestWeatherTime?: Date;
  protected logger: Logger;
  protected fetchLock: boolean;
  protected readonly apiThrottleMillis: number;
  public latLon?: { lat: number; lon: number };
  protected lockTimeoutMillis = 2000;

  constructor(
    log: Logger,
    private readonly httpClient: HttpClient,
    {
      apiKey = '',
      apiVersion = '3.0',
      debugOn = false,
      location = 'New York,NY,US',
      units = 'imperial',
      apiThrottleMinutes = 15,
    }: SnowForecastOptions,
  ) {
    this.logger = log;
    this.fetchLock = false;

    this.apiKey = apiKey;
    this.apiVersion = apiVersion;
    this.debugOn = debugOn;
    this.location = location;
    this.units = units;

    // no more frequently than every 5 minutes, default to 15 minutes
    this.apiThrottleMillis = Math.max(apiThrottleMinutes, 5) * 60 * 1000;
  }

  private debug(message: string, ...parameters: unknown[]): void {
    if (this.debugOn) {
      this.logger.debug(message, ...parameters);
    }
  }

  /**
   * Set up the instance of this class, includes an async conversion of the location
   */
  public async setup() {
    this.latLon = await this.convertLocationToLatLong(this.location);

    const apiKey = this.apiKey;
    this.weatherUrl = `https://api.openweathermap.org/data/${this.apiVersion}/onecall?lat=${
      this.latLon.lat}&lon=${this.latLon.lon}&appid=${apiKey}&units=${
      this.units}&exclude=minutely,alerts,daily`;
  }

  /**
   * Convert a location description to a latitude-longitude pair
   * @param location a city, zip code or latitude-longitude pair as a string
   * @private
   */
  private async convertLocationToLatLong(location: string): Promise<{ lat: number; lon: number }> {

    // If the location is a latitude-longitude pair, return it as-is
    if (this.isLatLong(location)) {
      return this.parseLatLong(location);
    }

    if (this.isZipCode(location)) {
      // If the location is a zip code, use the OpenWeatherMap API to convert it
      return this.getLocationFromZip(location);
    }

    // Otherwise, assume the location is a city name
    return this.getLocationFromCity(location);
  }

  private parseLatLong(location: string): { lat: number; lon: number } {
    const [lat, lon] = location.split(',').map(str => parseFloat(str.trim()));
    return {lat, lon};
  }

  /**
   * Return a latitude-longitude pair for the given zip code\
   * https://api.openweathermap.org/geo/1.0/direct?q=springfield,oh,us&limit=1&appid=<API-ID>
   *
   * @param zip a five-digit zip code
   * @private
   */
  private async getLocationFromZip(zip: string): Promise<{ lat: number; lon: number }> {
    // If the location is a zip code, use the OpenWeatherMap API to convert it
    this.debug(`Converting zip code ${zip} to latitude-longitude pair`);
    const geocodingApiUrl = `https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(
      zip)}&limit=1&appid=${this.apiKey}`;
    const response = await this.httpClient.get<ZipCodeResponse>(geocodingApiUrl);
    this.debug(`converting zip=[${zip}] TO lat=[${response.data.lat}] lon=[${response.data.lon}]`);
    return {lat: response.data.lat, lon: response.data.lon};
  }

  /**
   * Given a city, return the latitude and longitude of that city
   * url example:
   * https://api.openweathermap.org/geo/1.0/direct?q=springfield,oh,us&limit=1&appid=<API-ID>
   *
   * @param city the city to look up in the form of city,state,country
   * @private
   */
  private async getLocationFromCity(city: string): Promise<{ lat: number; lon: number }> {
    this.debug(`converting city=[${city}]`);
    const geocodingApiUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
      city)}&limit=1&appid=${this.apiKey}`;
    const response = await this.httpClient.get<GeocodingResponse[]>(geocodingApiUrl);
    if (!response.data || response.data.length === 0) {
      throw new Error(`No location found for city (${city}) *** Did you include a country code? eg "New York, NY, US" ***`);
    }
    return {lat: response.data[0].lat, lon: response.data[0].lon};
  }

  /**
   * Is the given string a zip code?
   * @param location is a location description that may be a zip code
   * @private
   */
  private isZipCode(location: string): boolean {
    // Use a regular expression to match the string against a pattern for a
    // zip code, which consists of five digits
    const zipCodeRegex = /^\d{5}$/;

    // Check if the string matches the regular expressions
    return zipCodeRegex.test(location);
  }

  /**
   * Is the given string a latitude-longitude pair?
   *
   * @param location is the place description
   * @private
   */
  private isLatLong(location: string): boolean {
    // Use a regular expression to match the string against a pattern for a
    // latitude-longitude pair, which consists of two decimal numbers separated
    // by a comma and possibly a space
    const latLongRegex = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;

    // Check if the string matches the regular expressions
    if (latLongRegex.test(location)) {
      return true;
    }

    // If the string does not match either of the regular expressions,
    // consider it invalid
    return false;
  }

  /**
   * Get a full SnowForecast by reading a full weather forecast from OpenWeatherMap.
   *
   * @returns SnowForecast
   */
  public async getSnowForecast(): Promise<SnowForecast> {
    // if another instance is already fetching, wait for it to finish
    const endTime: number = new Date().getTime() + this.lockTimeoutMillis;
    while (new Date().getTime() < endTime && this.fetchLock) {
      await new Promise(r => setTimeout(r, 10));
    }
    // if we are still locked, throw an error
    if (this.fetchLock) {
      throw new Error('Weather fetch is locked');
    }
    try {
      this.fetchLock = true;
      const now = new Date();
      if (this.weatherCache &&
        this.latestWeatherTime &&
        (now.getTime() - this.latestWeatherTime.getTime()) < this.apiThrottleMillis) {
        this.debug('Using cached weather');
      } else {
        this.debug('Fetching new weather');
        const forecast: OpenWeatherResponse = await this.getWeatherFromApi();

        // console.log('current weather', forecast.current.weather);
        // console.log('hour1 weather', forecast.hourly[0].weather);
        // console.log('forecast', forecast);

        this.weatherCache = this.adjustForOpenWeatherMap(forecast);
        // make one-liner output for debugging
        const hours = this.weatherCache.hourly.slice(0, 7).map(h => h.hasSnow).join(',');
        this.debug(`Now and next 6 hours: ${hours}`);

        this.latestWeatherTime = now;
      }
      return this.weatherCache;
    } finally {
      this.fetchLock = false;
    }
  }

  /**
   * OpenWeatherMap returns a 48-hour forecast of the weather
   * API documented here: https://openweathermap.org/api/one-call-3
   *
   * @returns a raw forecast from OpenWeatherMap
   * @throws Error if there is no url yet or call fails
   * @private
   */
  private async getWeatherFromApi(): Promise<OpenWeatherResponse> {
    if (!this.weatherUrl) {
      throw new Error('URL not yet set for openweathermap');
    }
    try {
      const response = await this.httpClient.get<OpenWeatherResponse>(this.weatherUrl);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.status === 401) {
          throw new Error('Invalid OpenWeatherMap API key');
        }
        if (error.status === 429) {
          throw new Error('OpenWeatherMap API rate limit exceeded');
        }
        throw new Error(`Error getting weather from OpenWeatherMap: ${error.message}`);
      }
      // This is not an Axios error
      throw new Error(`Unexpected error getting weather from OpenWeatherMap: ${error}`);
    }
  }

  /**
   * Convert current and hourly forecasts into SnowReports for each hour
   *
   * @param data Raw data result from OpenWeatherMap API
   * @returns SnowForecast for current and each hour in the weather forecast
   * @private
   */
  private adjustForOpenWeatherMap(data: OpenWeatherResponse): SnowForecast {
    return {
      current: this.adjustWeatherForOpenWeatherMap(data.current),
      hourly: data.hourly.map((forecast: HourlyForecast) => this.adjustWeatherForOpenWeatherMap(forecast)),
    };
  }

  /**
   * Use the given raw weather forecast to return fields needed for a SnowReport
   * It's possible that a client will assume snow from the temperature and precipitation rather than the hasSnow boolean
   * This uses the id field as described here: https://openweathermap.org/weather-conditions
   *
   * @param forecast is a weather forecast for current time or another hour
   * @returns a SnowReport for the given hour
   * @private
   */
  private adjustWeatherForOpenWeatherMap(forecast: CurrentWeather | HourlyForecast): SnowReport {
    const id = forecast.weather[0].id;
    const hasSnow = id >= 600 && id < 700;
    const hasPrecipitation = id >= 200 && id < 700;

    return {
      dt: forecast.dt,
      temp: forecast.temp,
      hasSnow: hasSnow,
      hasPrecip: hasPrecipitation,
    };
  }
}
