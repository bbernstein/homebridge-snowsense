import {
  API,
  APIEvent,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IsSnowyAccessory } from './platformAccessory';
import {HISTORY_FILE, SnowWatch} from './SnowWatch';
import {DeviceConfig, SnowSenseConfig, upgradeConfigs} from './SnowSenseConfig';
import { debug } from 'util';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SnowSensePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public accessories: PlatformAccessory[] = [];
  public snowyAccessories: IsSnowyAccessory[] = [];
  public readonly forecastFrequencyMillis = 1000 * 60 * 5;
  public readonly debugOn: boolean = false;
  public watcher: SnowWatch | undefined;
  public config: PlatformConfig;

  constructor(
    public readonly log: Logger,
    public readonly platformConfig: PlatformConfig,
    public readonly api: API,
  ) {
    const config = platformConfig as SnowSenseConfig;
    if (
      config.units !== 'imperial' &&
      config.units !== 'metric' &&
      config.units !== 'standard'
    ) {
      config.units = 'imperial';
    }

    // if configs were from an old version, update and rewrite them
    upgradeConfigs(config, this.api.user.configPath(), this.log);

    this.debugOn = config.debugOn;
    this.debug('Finished initializing platform:', config.name);
    this.forecastFrequencyMillis =
      1000 * 60 * (config.apiThrottleMinutes || 15);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.discoverDevices(config);
      this.startWatchingWeather(config).then();
    });

    this.config = config;
  }

  public async getWatcher(): Promise<SnowWatch> {
    if (!this.watcher) {
      await this.startWatchingWeather(this.platformConfig as SnowSenseConfig);
    }
    return this.watcher as SnowWatch;
  }

  public async startWatchingWeather(config: SnowSenseConfig) {
    if (!this.watcher) {
      this.watcher = new SnowWatch(this.log, {
        apiKey: config.apiKey,
        apiVersion: config.apiVersion,
        debugOn: config.debugOn,
        location: config.location,
        units: config.units,
        apiThrottleMinutes: config.apiThrottleMinutes || 15,
        coldPrecipitationThreshold: config.coldPrecipitationThreshold,
        onlyWhenCold: config.onlyWhenCold,
        coldTemperatureThreshold: config.coldTemperatureThreshold,
        storagePath: this.api.user.storagePath(),
        historyFile: HISTORY_FILE,
      });
    }
    setImmediate(this.watchWeather.bind(this));
  }

  async updateAccessories() {
    const watcher = await this.getWatcher();
    try {
      await watcher.updatePredictionStatus();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      this.log.error(`Error getting updated weather: ${e.message}`);
      return;
    }

    // tell all the accessories to update their values
    this.snowyAccessories.forEach((snowyAccessory) => {
      debug('device:', snowyAccessory.accessory.context.device);
      const service = snowyAccessory.accessory.getService(
        this.Service.OccupancySensor,
      );
      if (service) {
        const newValue = watcher.snowSensorValue(
          snowyAccessory.accessory.context.device,
        );
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

  makeUuidForDevice(device: DeviceConfig): string {
    return this.api.hap.uuid.generate('SNOWSENSE-' + device.displayName);
  }

  async watchWeather() {
    await this.updateAccessories();
    this.debug(
      `Updating weather (first time). frequency: ${this.forecastFrequencyMillis}`,
    );
    setInterval(async () => {
      this.debug(
        `Updating weather (repeating). frequency: ${this.forecastFrequencyMillis}`,
      );
      await this.updateAccessories();
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

  addNewSnowyAccessory(accessory: PlatformAccessory) {
    this.snowyAccessories.push(new IsSnowyAccessory(this, accessory));
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices(config: SnowSenseConfig) {
    const snowyDevices = config.sensors || [];
    const accessoriesToRemove = this.accessories.filter(
      (accessory) =>
        snowyDevices &&
        !snowyDevices.find(
          (device) => device.displayName === accessory.displayName,
        ),
    );

    for (const accessory of accessoriesToRemove) {
      this.log.info(
        'Removing old accessory from cache:',
        accessory.displayName,
      );
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory,
      ]);
      this.accessories = this.accessories.filter(
        (a) => a.UUID !== accessory.UUID,
      );
    }

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of snowyDevices) {
      if (!device.displayName) {
        device.displayName = 'Snowy-' + Math.random().toString(36).substring(7);
      }
      const uuid = this.makeUuidForDevice(device);
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid,
      );
      if (existingAccessory) {
        this.log.info(
          'Restoring existing accessory from cache:',
          existingAccessory.displayName,
        );
        existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);
        this.addNewSnowyAccessory(existingAccessory);
        this.debug(
          'Created new SnowyAccessory object:',
          existingAccessory.displayName,
        );
      } else {
        this.log.info('Adding new accessory:', device.displayName);
        const accessory = new this.api.platformAccessory(
          device.displayName,
          uuid,
        );
        accessory.context.device = device;
        this.addNewSnowyAccessory(accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }
  }
}
