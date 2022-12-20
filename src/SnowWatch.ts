import {Logger} from 'homebridge';
import SnowForecastService, {SnowForecast, SnowReport} from './SnowForecastService';

export type SnowWatchOptions = {
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

  /**
   * How many hours in the future to look for snow to consider it "snowing soon"
   */
  hoursBeforeSnowIsSnowy?: number;

  /**
   * How many hours in the past to look for snow to consider it "was snowing recently"
   */
  hoursAfterSnowIsSnowy?: number;

  /**
   * If the current temperature is below this number and it's precipitating, consider it "snowing"
   */
  coldPrecipitationThreshold?: number;
};

export default class SnowWatch {
  private static instance: SnowWatch;
  private apiKey?: string;
  private readonly coldPrecipitationThreshold?: number;
  private readonly hoursUntilSnowPredicted: number;
  private readonly hoursSinceSnowStopped: number;
  private lastTimeSnowForecasted?: number;
  private currentlySnowing: boolean;
  private snowPredicted: boolean;
  private hasSnowed: boolean;
  private readonly snowForecastService: SnowForecastService;
  private latestForecast?: SnowForecast;
  private isSetup: boolean;
  private readonly logger: Logger;

  constructor(log: Logger, options: SnowWatchOptions) {
    this.hoursUntilSnowPredicted = options.hoursBeforeSnowIsSnowy || 3;
    this.hoursSinceSnowStopped = options.hoursAfterSnowIsSnowy || 3;
    this.coldPrecipitationThreshold = options.coldPrecipitationThreshold;
    this.apiKey = options.apiKey;
    this.currentlySnowing = false;
    this.snowPredicted = false;
    this.hasSnowed = false;
    this.isSetup = false;
    this.logger = log;
    this.snowForecastService = new SnowForecastService(this.logger,
      {
        apiKey: options.apiKey,
        location: options.location,
        units: options.units,
        apiThrottleMinutes: options.apiThrottleMinutes,
      });
  }

  /**
   * Initialize the singleton instance of the SnowWatch class
   * @param log The logger to use
   * @param options The options for the service
   */
  public static async init(log: Logger, options: SnowWatchOptions) {
    SnowWatch.instance = new SnowWatch(log, options);
  }

  /**
   * Get the singleton instance of the SnowWatch class
   */
  public static getInstance() {
    if (!SnowWatch.instance) {
      throw new Error('SnowWatch not initialized');
    }

    return SnowWatch.instance;
  }

  /**
   * Set up the weather service if needed
   * @private
   */
  private async setup() {
    if (this.isSetup) {
      return;
    }
    await this.snowForecastService.setup();
    this.isSetup = true;
  }

  /**
   * Read the weather and hold onto the latest forecast
   */
  private async readSnowForecast(): Promise<SnowForecast | undefined> {
    await this.setup();
    if (!this.snowForecastService) {
      throw new Error('Weather service not initialized');
    }
    this.latestForecast = await this.snowForecastService.getSnowForecast();
    return this.latestForecast;
  }


  /**
   * Is the given report snowy enough to call it "snowy"?
   * If we are considering precipitation and below freezing, then it is snowy
   * Or if it is just Snowing
   *
   * @param snowReport The report to check
   * @private
   */
  private isSnowyEnough(snowReport: SnowReport): boolean {
    const isColdAndPrecipitating = (this.coldPrecipitationThreshold !== undefined) &&
      snowReport.temp < this.coldPrecipitationThreshold && snowReport.hasPrecip;
    return (snowReport.hasSnow || isColdAndPrecipitating);
  }

  /**
   * Did it snow recently? Like in the last number of hours configured?
   *
   * @returns true if it snowed recently
   */
  public snowedRecently(): boolean {
    const millisInPast = new Date().getTime() - (this.hoursSinceSnowStopped * 60 * 60 * 1000);
    const timeLastPredicted = this.lastTimeSnowForecasted ? new Date(this.lastTimeSnowForecasted) : '[NEVER]';
    this.logger.debug(`Last time snow forecasted: ${timeLastPredicted}`);
    const result = (this.lastTimeSnowForecasted !== undefined) && (millisInPast <= this.lastTimeSnowForecasted);
    if (!result) {
      this.hasSnowed = false;
    }
    return result;
  }

  /**
   * Does it look like it will be snowing soonn?
   * Check if it's snowing now or if it's predicted to snow in the next few hours
   *
   * @returns true if it's snowing now or if it's predicted to snow in the next few hours
   */
  public snowingSoon(): boolean {
    return this.currentlySnowing || this.snowPredicted
  }

  public setSnowForecastedTime(time: Date) {
    this.lastTimeSnowForecasted = time.getTime();
  }

  /**
   * Is it currently snowing?
   *
   * @returns true if it's currently snowing
   */
  public snowingNow(): boolean {
    return this.currentlySnowing;
  }

  /**
   * Get an updated snow report so we can check snowing status
   */
  public async updatePredictionStatus() {
    // Get the latest forecast
    const forecast = await this.readSnowForecast();
    if (!forecast) {
      this.logger.error('No forecast available');
      return;
    }
    const nowMillis = new Date().getTime();
    const millisInFuture = nowMillis + (this.hoursUntilSnowPredicted * 60 * 60 * 1000);
    this.currentlySnowing = this.isSnowyEnough(forecast.current);
    const hoursWithSnowPredicted = forecast.hourly
      // Filter out any snow reports that are too far in the future or not snowing
      .filter((snowReport) => {
        return (snowReport.dt * 1000 < millisInFuture && this.isSnowyEnough(snowReport));
      });
    this.snowPredicted = hoursWithSnowPredicted.length > 0;
    if (this.snowPredicted) {
      const predictedTime = new Date(hoursWithSnowPredicted[0].dt * 1000);
      this.logger.debug(`Snow predicted at ${predictedTime} (current time is ${new Date()})`);
    }
    this.snowPredicted = forecast.hourly
      // Filter out any snow reports that are too far in the future or not snowing
      .filter((snowReport) => {
        return (snowReport.dt * 1000 < millisInFuture && this.isSnowyEnough(snowReport));
      })
      // if there were any snowy hours, then snow is predicted
      .length > 0;

    this.hasSnowed = this.hasSnowed || this.currentlySnowing;

    this.logger.debug(`Snowing now: ${this.currentlySnowing
    }, Snowing soon: ${this.snowPredicted
    }, Snowed recently: ${this.hasSnowed}`);

    if (this.currentlySnowing || this.snowPredicted) {
      this.setSnowForecastedTime(new Date());
      return true;
    }
    return false;
  }
}
