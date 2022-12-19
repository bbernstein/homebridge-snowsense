import axios from 'axios';
import {Logger} from 'homebridge';

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
  apiKey: string;

  /**
   * Do not call the api more often than this number of minutes
   */
  apiThrottleMinutes?: number;

  /**
   * Units to request from weather api
   */
  units?: 'imperial' | 'metric' | 'standard';

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
  private readonly apiKey: string = '';
  private readonly location: string = '';
  private weatherUrl?: string;
  private readonly units: string = '';
  private weatherCache?: SnowForecast;
  private latestWeatherTime?: Date;
  private logger: Logger;
  private fetchLock: boolean;
  private readonly apiThrottleMillis;

  constructor(log: Logger, options: SnowForecastOptions) {
    this.logger = log;
    this.fetchLock = false;

    this.apiKey = options.apiKey;
    this.location = options.location || 'New York,NY,US';
    this.units = this.sanitizeUnits(options.units || 'imperial');

    // no more frequently than every 5 minutes, default to 15 minutes
    const throttleMinutes = options.apiThrottleMinutes || 15;
    this.apiThrottleMillis = Math.max(throttleMinutes, 5) * 60 * 1000;
  }

  /**
   * Set up the instance of this class, includes an async conversion of the locationn
   */
  public async setup() {
    const latlon: { lat: number; lon: number } = await this.convertLocationToLatLong(this.location);
    this.weatherUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${
      latlon.lat}&lon=${latlon.lon}&appid=${this.apiKey}&units=${
      this.units}&exclude=minutely,alerts,daily`;
  }


  /**
   * Return a sanitized version of the given string, which is either 'imperial' or 'metric'
   *
   * @param units type of units, either 'imperial' or 'metric'
   * @private
   */
  private sanitizeUnits(units: string) {
    if (units === 'imperial' || units === 'metric' || units === 'standard') {
      return units;
    }
    return 'imperial';
  }

  /**
   * Convert a location description to a latitude-longitude pair
   * @param location a city, zip code or latitude-longitude pair as a strinng
   * @private
   */
  private async convertLocationToLatLong(location: string): Promise<{ lat: number; lon: number }> {

    // If the location is a latitude-longitude pair, return it as-is
    if (this.isLatLong(location)) {
      const latlon: number[] = location.split(',').map(str => parseFloat(str));
      return {lat: latlon[0], lon: latlon[1]};
    }

    if (this.isZipCode(location)) {
      // If the location is a zip code, use the OpenWeatherMap API to convert it
      return await this.getLocationFromZip(location);
    }

    // Otherwise, assume the location is a city name
    return await this.getLocationFromCity(location);
  }

  /**
   * Return a latitude-longitude pair for the given zip code\
   * https://api.openweathermap.org/geo/1.0/direct?q=springfield,oh,us&limit=1&appid=<API-ID>
   *
   * @param zip a five digit zip code
   * @private
   */
  private async getLocationFromZip(zip: string): Promise<{ lat: number; lon: number }> {
    this.logger.debug(`zip=${zip}`);
    const geocodingApiUrl = `https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(
      zip)}&limit=1&appid=${this.apiKey}`;
    const response = await axios.get(geocodingApiUrl);
    if (!response.data || response.data.cod) {
      throw new Error(`No location found for zip code (${zip})`);
    }
    return response.data;
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
    const geocodingApiUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
      city)}&limit=1&appid=${this.apiKey}`;
    return axios.get(geocodingApiUrl).then((response) => {
      if (response.data.length === 0) {
        throw new Error(`No location found for city (${city})`);
      }
      return response.data[0];
    });
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
    if (zipCodeRegex.test(location)) {
      return true;
    }

    // If the string does not match either of the regular expressions,
    // consider it invalid
    return false;
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
   * Helper to sleep for a given number of milliseconds
   * @param ms milliseconds to sleep
   * @private
   */
  private async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Get a full SnowForecast by reading a full weather forecast from OpenWeatherMap.
   *
   * @returns SnowForecast
   */
  public async getSnowForecast(): Promise<SnowForecast> {
    // if another instance is already fetching, wait for it to finish
    for (let i = 0; i < 20 && this.fetchLock; i++) {
      await this.sleep(100);
    }
    // if we are still locked, throw a nerror
    if (this.fetchLock) {
      throw new Error('Weather fetch is locked');
    }
    try {
      this.fetchLock = true;
      const now = new Date();
      if (this.weatherCache &&
        this.latestWeatherTime &&
        (now.getTime() - this.latestWeatherTime.getTime()) < this.apiThrottleMillis) {
        this.logger.debug('Using cached weather');
      } else {
        this.logger.debug('Fetching new weather');
        try {
          const forecast = await this.getWeatherFromApi();
          this.weatherCache = this.adjustForOpenWeatherMap(forecast);

          // make one-liner output for debugging
          const hours = this.weatherCache.hourly.slice(0, 4).map(h => h.hasSnow).join(',');
          this.logger.debug(`Cur and 3 hours snow: ${hours}`);

          this.latestWeatherTime = now;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          this.logger.error(err);
          throw err;
        }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getWeatherFromApi(): Promise<any> {
    if (!this.weatherUrl) {
      throw new Error('URL not yet set for openweathermap');
    }
    const response = await axios.get(this.weatherUrl);
    return response.data;
  }

  /**
   * Convert current and hourly forecasts into SnowReports for each hour
   *
   * @param data Raw data result from OpenWeatherMap API
   * @returns SnowForecast for current and each hour in the weather forecast
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private adjustForOpenWeatherMap(data: any): SnowForecast {
    return {
      current: this.adjustWeatherForOpenWeatherMap(data.current),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hourly: data.hourly.map((forecast: any) => this.adjustWeatherForOpenWeatherMap(forecast)),
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
  private adjustWeatherForOpenWeatherMap(forecast): SnowReport {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = forecast.weather.find((w: any) => w.id).id;
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
