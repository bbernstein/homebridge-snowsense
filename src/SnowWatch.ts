import { Logger } from 'homebridge';
import SnowForecastService, { SnowForecast, SnowReport } from './SnowForecastService';
import { DeviceConfig, SnowSenseUnits } from './SnowSenseConfig';
import AxiosHttpClient from './AxiosHttpClient';
import fs from 'fs';
import path from 'path';

export const HISTORY_FILE = 'snowsense-history.json';

export type SnowWatchOptions = {
  apiKey: string;
  apiVersion: string;
  apiThrottleMinutes?: number;
  debugOn?: boolean;
  units?: SnowSenseUnits;
  location?: string;
  coldPrecipitationThreshold?: number;
  onlyWhenCold: boolean;
  coldTemperatureThreshold?: number;
  storagePath: string;
  historyFile: string;
};

interface SnowWatchValues {
  snowingNow: boolean;
  lastSnowTime?: number;
  pastConsecutiveHours: number;
  nextSnowTime?: number;
  futureConsecutiveHours: number;
}

export class SnowWatch {
  private readonly debugOn: boolean;
  private readonly coldPrecipitationThreshold?: number;
  private readonly snowForecastService: SnowForecastService;
  public latestForecast?: SnowForecast;
  private readonly onlyWhenCold: boolean;
  private readonly coldTemperatureThreshold?: number;
  public pastReports: SnowReport[] = [];
  private readonly storagePath: string;
  private readonly historyFile: string;
  public currentReport?: SnowReport;
  private futureReports: SnowReport[] = [];
  private isSetup = false;

  constructor(
    private readonly logger: Logger,
    private readonly options: SnowWatchOptions,
    snowForecastService?: SnowForecastService,
  ) {
    this.coldPrecipitationThreshold = options.coldPrecipitationThreshold;
    this.debugOn = !!options.debugOn;
    this.onlyWhenCold = options.onlyWhenCold;
    this.coldTemperatureThreshold = options.coldTemperatureThreshold;
    this.storagePath = options.storagePath;
    this.historyFile = HISTORY_FILE;
    this.pastReports = this.readPastReports(options.storagePath, options.historyFile);
    const httpClient = new AxiosHttpClient();
    const forecastOptions = {
      apiKey: options.apiKey,
      apiVersion: options.apiVersion,
      debugOn: options.debugOn,
      location: options.location,
      units: options.units,
      apiThrottleMinutes: options.apiThrottleMinutes,
    };
    this.snowForecastService = snowForecastService ?? new SnowForecastService(this.logger, httpClient, forecastOptions);
  }

  public getFutureReports(): SnowReport[] {
    return this.futureReports;
  }

  private deleteFile(filePath: string) {
    if (filePath) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e: unknown) {
          // ignore
        }
      }
    }
  }

  private readPastReports(storagePath: string, historyFile: string): SnowReport[] {
    if (!storagePath) {
      return [];
    }
    const filePath = path.join(storagePath, historyFile);
    try {
      if (fs.existsSync(filePath)) {
        const result = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SnowReport[];
        if (!Array.isArray(result)) {
          this.logger.error(`Expected array, got ${typeof result}`);
          this.deleteFile(filePath);
          return [];
        }
        if (result.length > 0) {
          const first = result[0] as SnowReport;
          if (!first || typeof first !== 'object' || first.dt === undefined || first.hasSnow === undefined) {
            this.logger.error(`Expected SnowReport, got ${first}`);
            this.deleteFile(filePath);
            return [];
          }
        }
        return result;
      }
    } catch (e: unknown) {
      this.logger.error(`Error reading past reports from ${storagePath}`, e);
      this.deleteFile(filePath);
    }
    return [];
  }

  private writePastReports(storagePath: string, historyFile: string, reports: SnowReport[]) {
    const filePath = path.join(storagePath, historyFile);
    try {
      fs.mkdirSync(storagePath, {recursive: true, mode: 0o755});
      fs.writeFileSync(filePath, JSON.stringify(reports), {encoding: 'utf8', flag: 'w'});
    } catch (e: unknown) {
      this.logger.error(`Error writing past reports to ${storagePath}`, e);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e: unknown) {
          // ignore
        }
      }
    }
  }

  private debug(message: string, ...parameters: unknown[]): void {
    if (this.debugOn) {
      this.logger.debug(message, ...parameters);
    }
  }

  /**
   * Set up the weather service if needed
   * @private
   */
  public async setup() {
    if (this.isSetup) {
      return;
    }
    await this.snowForecastService.setup();
    this.isSetup = true;
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
    await this.setup();
    const rawForecast = await this.snowForecastService.getSnowForecast();
    if (!rawForecast) {
      this.logger.error('No forecast available');
      this.latestForecast = undefined;
      return;
    }

    this.latestForecast = this.convertToMillis(rawForecast);
    this.addPastReport(this.latestForecast.current);
    this.currentReport = this.latestForecast.current;
    this.futureReports = this.latestForecast.hourly;

    // The rest of this is all for debug logging
    const now = new Date().getTime();
    const reports = [
      ...this.pastReports.filter((report) => now - report.dt <= 1000 * 60 * 60 * 6),
      this.currentReport as SnowReport,
      ...this.futureReports.filter((report) => report.dt >= now && report.dt - now <= 1000 * 60 * 60 * 6),
    ];
    this.debug('reports', this.reportHoursToString(reports));

    const values = this.getSnowSenseValues();
    this.debug('values', values);
  }

  private millisToHours(millis: number): number {
    return Math.floor(millis / 60 / 60 / 1000);
  }

  private addPastReport(report: SnowReport) {
    const nowMillis = new Date().getTime();
    this.pastReports.push({...report, dt: report.dt});
    // remember the past 24 hours of reports
    this.pastReports = this.pastReports
      .filter((report) => {
        const diff = nowMillis - report.dt;
        return diff < 60 * 60 * 24 * 1000;
      })
      .sort((a, b) => a.dt - b.dt)
      .reduce((acc: SnowReport[], report) => {
        const hour = Math.floor(report.dt / 60 / 60 / 1000) * 60 * 60 * 1000;
        if (acc.length === 0) {
          acc.push({...report, dt: hour});
        } else {
          const lastReport = acc[acc.length - 1];
          if (this.millisToHours(lastReport.dt) === this.millisToHours(report.dt)) {
            acc[acc.length - 1] = {
              dt: hour,
              temp: Math.min(lastReport.temp, report.temp),
              hasSnow: lastReport.hasSnow || report.hasSnow,
              hasPrecip: lastReport.hasPrecip || report.hasPrecip,
            };
          } else {
            acc.push({...report, dt: hour});
          }
        }
        return acc;
      }, []);

    // save this in case we shut down
    this.writePastReports(this.storagePath, this.historyFile, this.pastReports);
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

  private reportToString(timeMillis: number, report: SnowReport): string[] {
    const diff = Math.round((report.dt - timeMillis) / 60 / 60) / 1000;
    return [`${diff}`, `${this.isSnowyEnough(report) ? 'SNOW' : 'no'}`];
  }

  private reportHoursToString(reports: SnowReport[]): string {
    const now = new Date().getTime();
    const header = ['∆Hour', 'Snow'];
    const data = [header, ...reports.map((report) => this.reportToString(now, report))];
    const columnWidths = data[0].map((_, index) =>
      Math.max(...data.map(row => row[index].length + 1)),
    );

    const formattedData = data.map(row =>
      row.map((item, index) => item.padEnd(columnWidths[index])).join(' '),
    );
    return '\n' + formattedData.join('\n');
  }

  public getSnowSenseValues(): SnowWatchValues {
    // is it snowing now?
    const isSnowingNow = this.currentReport ? this.isSnowyEnough(this.currentReport) : false;

    // once it starts, how many consecutive hours is expected?
    const {consecutiveHours: nextConsecutiveHours, hoursUntilStart: nextSnowHours} =
      this.findStartAndConsecutiveSnowyHours(this.futureReports);

    // last time it snowed, how many consecutive hours did it snow?
    const {consecutiveHours: pastConsecutiveHours, hoursUntilStart: lastSnowHours} =
      this.findStartAndConsecutiveSnowyHours(this.pastReports, true);

    return {
      snowingNow: isSnowingNow,
      lastSnowTime: isSnowingNow ? 0 : lastSnowHours,
      pastConsecutiveHours: pastConsecutiveHours,
      nextSnowTime: nextSnowHours,
      futureConsecutiveHours: nextConsecutiveHours,
    };
  }

  public snowSensorValue(config: DeviceConfig): boolean {
    const values = this.getSnowSenseValues();
    const enoughConsecutiveFutureHours: boolean = !values.futureConsecutiveHours
      || (values.futureConsecutiveHours >= config.consecutiveHoursFutureIsSnowy);
    const enoughHoursUntilSnow: boolean = !!values.nextSnowTime
      && (values.nextSnowTime <= config.hoursBeforeSnowIsSnowy);
    const enoughHoursSinceSnow: boolean = !!values.lastSnowTime
      && (values.lastSnowTime <= config.hoursAfterSnowIsSnowy);

    const result = values.snowingNow
      || (enoughHoursUntilSnow && enoughConsecutiveFutureHours)
      || enoughHoursSinceSnow;
    this.debug(`result for ${config.displayName}`, result);
    return result;
  }
}
