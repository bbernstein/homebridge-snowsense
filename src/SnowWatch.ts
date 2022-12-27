import {Logger} from 'homebridge';
import SnowForecastService, {SnowForecast, SnowReport} from './SnowForecastService';

export type SnowWatchOptions = {
  /**
   * Get an api key from https://openweathermap.org/api
   */
  apiKey: string;
  /**
   * Latest version is 3.0, but allow using 2.5 for backwards compatibility
   */
  apiVersion: string;
  /**
   * Do not call the api more often than this number of minutes
   */
  apiThrottleMinutes?: number;
  /**
   * Show debug logging
   */
  debugOn?: boolean;
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
  private readonly debugOn: boolean;
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
    this.hoursUntilSnowPredicted = options.hoursBeforeSnowIsSnowy !== undefined ? options.hoursBeforeSnowIsSnowy : 3;
    this.hoursSinceSnowStopped = options.hoursAfterSnowIsSnowy !== undefined ? options.hoursAfterSnowIsSnowy : 3;
    this.coldPrecipitationThreshold = options.coldPrecipitationThreshold;
    this.apiKey = options.apiKey;
    this.debugOn = !!options.debugOn;
    this.currentlySnowing = false;
    this.snowPredicted = false;
    this.hasSnowed = false;
    this.isSetup = false;
    this.logger = log;
    this.snowForecastService = new SnowForecastService(this.logger,
      {
        apiKey: options.apiKey,
        apiVersion: options.apiVersion,
        debugOn : options.debugOn,
        location: options.location,
        units: options.units,
        apiThrottleMinutes: options.apiThrottleMinutes,
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debug(message: string, ...parameters: any[]): void {
    if (this.debugOn) {
      this.logger.debug(message, ...parameters);
    }
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
    return this.hasSnowed;
  }

  public checkSnowedRecently() {
    const millisInPast = new Date().getTime() - (this.hoursSinceSnowStopped * 60 * 60 * 1000);
    const timeLastPredicted = this.lastTimeSnowForecasted ? new Date(this.lastTimeSnowForecasted) : '[NEVER]';
    if (this.lastTimeSnowForecasted) {
      const timeSinceLastPredicted = new Date().getTime() - this.lastTimeSnowForecasted;
      const timeUntilTurnOff = (this.hoursSinceSnowStopped * 60 * 60 * 1000) - timeSinceLastPredicted;
      this.debug(`Last predicted: ${timeLastPredicted} (${timeSinceLastPredicted / 1000 / 60
      } minutes ago), expires in ${timeUntilTurnOff / 1000 / 60} minutes`);
    }
    this.hasSnowed = (this.lastTimeSnowForecasted !== undefined) && (millisInPast <= this.lastTimeSnowForecasted);
  }

  /**
   * Does it look like it will be snowing soonn?
   * Check if it's snowing now or if it's predicted to snow in the next few hours
   *
   * @returns true if it's snowing now or if it's predicted to snow in the next few hours
   */
  public snowingSoon(): boolean {
    return this.currentlySnowing || this.snowPredicted;
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

    // is it snowing now?
    this.currentlySnowing = this.isSnowyEnough(forecast.current);

    // is it snowing in the next x hours (where x = hoursUntilSnowPredicted)?
    const hoursWithSnowPredicted = forecast.hourly
      // Filter out any snow reports that are too far in the future or not snowing
      .filter((snowReport) => {
        return (snowReport.dt * 1000 < millisInFuture && this.isSnowyEnough(snowReport));
      });
    this.snowPredicted = hoursWithSnowPredicted.length > 0;

    // just for debugging, if snow coming, output which hour that is
    if (this.snowPredicted) {
      const predictedTime = new Date(hoursWithSnowPredicted[0].dt * 1000);
      this.debug(`Snow predicted in ${(predictedTime.getTime() - new Date().getTime()) / 1000 / 60} minutes`);
    }

    // if it's snowing now or soon, reset the timer of when sonw was last forecasted
    if (this.currentlySnowing || this.snowPredicted) {
      this.setSnowForecastedTime(new Date());
    }

    // update the "has snowed" flag
    this.checkSnowedRecently();

    this.logger.info(`Snowing now: ${this.currentlySnowing
    }, Snowing soon: ${this.snowPredicted
    }, Snowed recently: ${this.hasSnowed}`);
  }
}
