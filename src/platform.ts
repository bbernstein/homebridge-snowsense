import {API, APIEvent, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, Service} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {IsSnowyAccessory} from './platformAccessory';
import SnowWatch from './SnowWatch';
import {readFileSync, writeFileSync} from 'fs';
import {SnowSenseConfig} from './SnowSenseConfig';
import {PlatformConfig} from 'homebridge/lib/bridgeService';
import {debug} from 'util';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SnowSensePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  // this is used to track restored cached accessories
  public accessories: PlatformAccessory[] = [];
  private snowyAccessories: IsSnowyAccessory[] = [];
  private readonly forecastFrequencyMillis = 1000 * 60 * 5;
  private readonly debugOn: boolean = false;

  constructor(
    public readonly log: Logger,
    public readonly platformConfig: PlatformConfig,
    public readonly api: API,
  ) {

    const config = platformConfig as SnowSenseConfig;
    if (config.units !== 'imperial' && config.units !== 'metric' && config.units !== 'standard') {
      config.units = 'imperial';
    }

    // if configs were from an old version, update and rewrite them
    this.upgradeConfigs(config);

    this.debugOn = config.debugOn;
    this.debug('Finished initializing platform:', config.name);
    this.forecastFrequencyMillis = 1000 * 60 * (config.apiThrottleMinutes || 15);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.discoverDevices(config);
      this.startWatchingWeather(config).then();
    });
  }

  private upgradeConfigs(config: SnowSenseConfig) {
    let configChanged = false;
    // read legacy configs, and see if anything changed
    if (!config.sensors
      && config.name
      && config.hoursAfterSnowIsSnowy
      && config.hoursBeforeSnowIsSnowy
      && config.consecutiveHoursOfSnowIsSnowy) {
      config.sensors = [{
        displayName: config.name,
        hoursBeforeSnowIsSnowy: config.hoursBeforeSnowIsSnowy,
        hoursAfterSnowIsSnowy: config.hoursAfterSnowIsSnowy,
        consecutiveHoursFutureIsSnowy: config.consecutiveHoursOfSnowIsSnowy,
        consecutiveHoursPastIsSnowy: 0,
      }];
      configChanged = true;
    }

    if (!config.apiKey && config.key) {
      config.apiKey = config.key;
      config.key = undefined;
      // if we had an old key, it was version v2.5, so let that keep working
      config.apiVersion = '2.5';
      configChanged = true;
    }
    if (!config.apiVersion) {
      config.apiVersion = '3.0';
      configChanged = true;
    }
    if (!config.location && config.latitude && config.longitude) {
      config.location = `${config.latitude},${config.longitude}`;
      config.latitude = undefined;
      config.longitude = undefined;
      configChanged = true;
    }
    if (config.units && !config.units.match(/^(imperial|metric)$/)) {
      config.units = 'imperial';
      configChanged = true;
    }
    if (!config.hoursBeforeSnowIsSnowy && config.beforeSnowStarts) {
      config.hoursBeforeSnowIsSnowy = config.beforeSnowStarts;
      config.beforeSnowStarts = undefined;
      configChanged = true;
    }
    if (!config.hoursAfterSnowIsSnowy && config.afterSnowStops) {
      config.hoursAfterSnowIsSnowy = config.afterSnowStops;
      config.afterSnowStops = undefined;
      configChanged = true;
    }
    if (!config.apiThrottleMinutes && config.forecastFrequency) {
      config.apiThrottleMinutes = config.forecastFrequency;
      config.forecastFrequency = undefined;
      configChanged = true;
    }
    if (configChanged) {
      this.log.info('Updating config to new format. ', config);
      const configPath = this.api.user.configPath();
      try {
        const allConfigs = JSON.parse(readFileSync(configPath, 'utf8'));
        // find the platform entry matching this platform
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const platformIndex = allConfigs.platforms.findIndex((c: any) => c.platform === config.platform);
        if (platformIndex >= 0) {
          // if it was found, replace that entry with the updated config and write it
          allConfigs.platforms[platformIndex] = config;
          writeFileSync(configPath, JSON.stringify(allConfigs, null, 4), 'utf8');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        this.log.error(`Error updating config file: ${e}`);
      }
    }
  }

  private async startWatchingWeather(config: SnowSenseConfig) {
    await SnowWatch.init(this.log,
      {
        apiKey: config.apiKey,
        apiVersion: config.apiVersion,
        debugOn: config.debugOn,
        location: config.location,
        units: config.units,
        apiThrottleMinutes: config.apiThrottleMinutes || 15,
        // hoursBeforeSnowIsSnowy: config.hoursBeforeSnowIsSnowy,
        // hoursAfterSnowIsSnowy: config.hoursAfterSnowIsSnowy,
        coldPrecipitationThreshold: config.coldPrecipitationThreshold,
        onlyWhenCold: config.onlyWhenCold,
        coldTemperatureThreshold: config.coldTemperatureThreshold,
        // consecutiveHoursFutureIsSnowy: config.consecutiveHoursFutureIsSnowy,
      });
    await this.watchWeather();
  }

  private static async updateAccessories(that: SnowSensePlatform) {
    const watcher = SnowWatch.getInstance();
    try {
      await watcher.updatePredictionStatus();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      that.log.error(`Error getting updated weather: ${e.message}`);
      return;
    }
    // const wasSnowing = watcher.snowedRecently();
    // const isSnowing = watcher.snowingNow();
    // const willSnow = watcher.snowingSoon();
    // const isSnowy = wasSnowing || isSnowing || willSnow;

    // tell all the accessories to update their values
    that.snowyAccessories.forEach(snowyAccessory => {
      debug('device:', snowyAccessory.accessory.context.device);
      const service = snowyAccessory.accessory.getService(that.Service.OccupancySensor);
      if (service) {
        const newValue = watcher.snowSensorValue(snowyAccessory.accessory.context.device);
        snowyAccessory.updateValueIfChanged(service, newValue);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debug(message: string, ...parameters: any[]): void {
    if (this.debugOn) {
      this.log.debug(message, ...parameters);
    }
  }

  private async watchWeather() {
    await SnowSensePlatform.updateAccessories(this);
    this.debug(`Updating weather (first time). frequency: ${this.forecastFrequencyMillis}`);
    await setInterval(async () => {
      this.debug(`Updating weather (repeating). frequency: ${this.forecastFrequencyMillis}`);
      await SnowSensePlatform.updateAccessories(this);
    }, this.forecastFrequencyMillis);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices(config: SnowSenseConfig) {
    const snowyDevices = config.sensors || [];
    const accessoriesToRemove = this.accessories
      .filter(accessory => snowyDevices && !snowyDevices.find(device => device.displayName === accessory.displayName));

    for (const accessory of accessoriesToRemove) {
      this.log.info('Removing old accessory from cache:', accessory.displayName);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories = this.accessories.filter(a => a.UUID !== accessory.UUID);
    }

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of snowyDevices) {
      if (!device.displayName) {
        device.displayName = 'Snowy-' + Math.random().toString(36).substring(7);
      }
      const uuid = this.api.hap.uuid.generate('SNOWSENSE-' + device.displayName);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);
        this.snowyAccessories.push(new IsSnowyAccessory(this, existingAccessory));
        this.debug('Created new SnowyAccessory object:', existingAccessory.displayName);
      } else {
        this.log.info('Adding new accessory:', device.displayName);
        const accessory = new this.api.platformAccessory(device.displayName, uuid);
        accessory.context.device = device;
        this.snowyAccessories.push(new IsSnowyAccessory(this, accessory));
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
