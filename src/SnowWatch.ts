import {Logger} from 'homebridge';
import SnowForecastService, {SnowForecast, SnowReport} from './SnowForecastService';
import {DeviceConfig} from './SnowSenseConfig';

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
   * If the current temperature is below this number and it's precipitating, consider it "snowing"
   */
  coldPrecipitationThreshold?: number;

  /**
   * Only consider it snowy if the given temperature is below coldPrecipitationThreshold
   */
  onlyWhenCold: boolean;

  /**
   * If onlyWhenCold is true, only consider it snowy if the given temperature is below this number
   */
  coldTemperatureThreshold?: number;
};

interface SnowWatchValues {
  snowingNow: boolean;
  lastSnowTime?: number;
  pastConsecutiveHours: number;
  nextSnowTime?: number;
  futureConsecutiveHours: number;
}

export default class SnowWatch {
  private static instance: SnowWatch;
  private apiKey?: string;
  private readonly debugOn: boolean;
  private readonly coldPrecipitationThreshold?: number;
  private readonly snowForecastService: SnowForecastService;
  public latestForecast?: SnowForecast; // made public for testing (hack)
  private isSetup: boolean;
  private readonly logger: Logger;
  private readonly onlyWhenCold: boolean;
  private readonly coldTemperatureThreshold?: number;
  private pastReports: SnowReport[] = [];
  private currentReport?: SnowReport;
  private futureReports: SnowReport[] = [];

  constructor(log: Logger, options: SnowWatchOptions) {
    this.coldPrecipitationThreshold = options.coldPrecipitationThreshold;
    this.apiKey = options.apiKey;
    this.debugOn = !!options.debugOn;
    this.isSetup = false;
    this.onlyWhenCold = options.onlyWhenCold;
    this.coldTemperatureThreshold = options.coldTemperatureThreshold;
    this.logger = log;
    this.snowForecastService = new SnowForecastService(this.logger,
      {
        apiKey: options.apiKey,
        apiVersion: options.apiVersion,
        debugOn: options.debugOn,
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
    const isSnowy = snowReport.hasSnow || isColdAndPrecipitating;
    if (this.onlyWhenCold && this.coldTemperatureThreshold !== undefined) {
      return isSnowy && snowReport.temp <= this.coldTemperatureThreshold;
    }
    return isSnowy;
  }

  private convertToMillis(forecast: SnowForecast): SnowForecast {
    return {
      current: {
        ...forecast.current,
        dt: forecast.current.dt * 1000,
      },
      hourly: forecast.hourly.map((hour) => ({
        ...hour,
        dt: hour.dt * 1000,
      })),
    };
  }

  /**
   * Get an updated snow report so we can check snowing status
   */
  public async updatePredictionStatus(): Promise<void> {
    // Get the latest forecast
    const rawForecast = await this.readSnowForecast();
    if (!rawForecast) {
      this.logger.error('No forecast available');
      return;
    }

    const forecast = this.convertToMillis(rawForecast);
    // remember the past 24 hours of reports
    const nowMillis = new Date().getTime();
    this.pastReports.push({...forecast.current, dt: forecast.current.dt});
    this.pastReports = this.pastReports
      .filter((report) => {
        const diff = nowMillis - report.dt;
        return diff < 60 * 60 * 24 * 1000;
      })
      .sort((a, b) => a.dt - b.dt);
    this.currentReport = forecast.current;
    this.futureReports = forecast.hourly;
  }

  private findStartAndConsecutiveSnowyHours(snowReports: SnowReport[], reverse = false): {
    hoursUntilStart: number | undefined;
    consecutiveHours: number;
  } {
    const reports = reverse ? [...snowReports].reverse() : snowReports;

    // calculate number of hours until snow and consecutive hours of snow
    const nowMillis = new Date().getTime();
    let preSnowHours = true;
    let lastSnowTime: number | undefined;
    let startSnowTime: number | undefined;
    for (const hourForecast of reports) {
      if (this.isSnowyEnough(hourForecast)) {
        preSnowHours = false;
        if (startSnowTime === undefined) {
          startSnowTime = hourForecast.dt;
          lastSnowTime = startSnowTime;
        } else {
          lastSnowTime = hourForecast.dt;
        }
      } else if (!preSnowHours) {
        break;
      }
    }

    const calcConsecutiveHours = startSnowTime !== undefined && lastSnowTime !== undefined
      ? Math.abs(lastSnowTime - startSnowTime) / 1000 / 60 / 60 + 1
      : 0;
    const nextSnowHours = startSnowTime !== undefined
      ? (startSnowTime - nowMillis) / 1000 / 60 / 60
      : undefined;

    return {
      hoursUntilStart: (!reverse || !nextSnowHours) ? nextSnowHours : -nextSnowHours,
      consecutiveHours: (!reverse || !calcConsecutiveHours) ? calcConsecutiveHours : calcConsecutiveHours,
    };
  }

  public getSnowSenseValues(): SnowWatchValues {
    // is it snowing now?
    const isSnowingNow = this.currentReport ? this.isSnowyEnough(this.currentReport) : false;

    const {consecutiveHours: nextConsecutiveHours, hoursUntilStart: nextSnowHours} =
      this.findStartAndConsecutiveSnowyHours(this.futureReports);
    const {consecutiveHours: pastConsecutiveHours, hoursUntilStart: lastSnowHours} =
      this.findStartAndConsecutiveSnowyHours(this.pastReports, true);

    this.debug('this.currentReport', this.currentReport);
    this.debug('this.pastReports', this.pastReports);
    this.debug('this.futureReports', this.futureReports.slice(0, 10));
    const result = {
      snowingNow: isSnowingNow,
      lastSnowTime: lastSnowHours,
      pastConsecutiveHours: pastConsecutiveHours,
      nextSnowTime: nextSnowHours,
      futureConsecutiveHours: nextConsecutiveHours,
    };
    this.debug('result', result);
    return result;
  }

  public snowSensorValue(config: DeviceConfig): boolean {
    const values = this.getSnowSenseValues();
    const enoughConsecutiveFutureHours: boolean = !values.futureConsecutiveHours
      || (values.futureConsecutiveHours >= config.consecutiveHoursFutureIsSnowy);
    const enoughConsecutivePastHours: boolean = !values.pastConsecutiveHours
      || (values.pastConsecutiveHours >= config.consecutiveHoursPastIsSnowy);
    const enoughHoursUntilSnow: boolean = !!values.nextSnowTime
      && (values.nextSnowTime <= config.hoursBeforeSnowIsSnowy);
    const enoughHoursSinceSnow: boolean = !!values.lastSnowTime
      && (values.lastSnowTime <= config.hoursAfterSnowIsSnowy);

    return values.snowingNow
      || (enoughHoursUntilSnow && enoughConsecutiveFutureHours)
      || (enoughHoursSinceSnow && enoughConsecutivePastHours);
  }
}
