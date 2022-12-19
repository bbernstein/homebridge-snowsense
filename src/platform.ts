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

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {IsSnowyAccessory} from './platformAccessory';
import SnowWatch from './SnowWatch';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SnowSensePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  private snowyAccessories: IsSnowyAccessory[] = [];

  private readonly forecastFrequencyMillis = 1000 * 60 * 5;

  private nextDelayTime = 1000;

  // public readonly weatherReader: Weather;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.nextDelayTime = 1000;
    this.log.debug('Finished initializing platform:', this.config.name);
    this.forecastFrequencyMillis = 1000 * 60 * config.apiThrottleMinutes;

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
      this.startWatchingWeather(config).then();
    });
  }

  private async startWatchingWeather(config: PlatformConfig) {
    await SnowWatch.init(this.log,
      {
        apiKey: config.apiKey,
        location: config.loction,
        units: config.units,
        apiThrottleMinutes: config.apiThrottleMinutes,
        hoursBeforeSnowIsSnowy: config.hoursBeforeSnowIsSnowy,
        hoursAfterSnowIsSnowy: config.hoursAfterSnowIsSnowy,
        coldPrecipitationThreshold: config.coldPrecipitationThreshold,
      });
    await this.watchWeather();
  }

  private static async updateAccessories(that: SnowSensePlatform) {
    const watcher = SnowWatch.getInstance();
    await watcher.updatePredictionStatus();
    const wasSnowing = watcher.snowedRecently();
    const isSnowing = watcher.snowingNow();
    const willSnow = watcher.snowingSoon();
    const isSnowy = wasSnowing || isSnowing || willSnow;

    // tell all the accessories to update their values
    that.snowyAccessories.forEach(snowyAccessory => {
      const uid = snowyAccessory.accessory.context.device.uid;
      const service = snowyAccessory.accessory.getService(that.Service.OccupancySensor);
      if (service) {
        let newValue = false;
        switch (uid) {
          // case 'WAS_SNOWING':
          //   newValue = wasSnowing;
          //   break;
          // case 'IS_SNOWING':
          //   newValue = isSnowing;
          //   break;
          // case 'WILL_SNOW':
          //   newValue = willSnow;
          //   break;
          case 'IS_SNOWY':
            newValue = isSnowy;
            break;
        }
        snowyAccessory.updateValueIfChanged(service, newValue);
      }
    });
  }

  private async watchWeather() {
    await SnowSensePlatform.updateAccessories(this);
    this.log.debug(`Updating weather (first time). frequency: ${this.forecastFrequencyMillis}`);
    await setInterval(async () => {
      this.log.debug(`Updating weather (repeating). frequency: ${this.forecastFrequencyMillis}`);
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
  discoverDevices() {

    // Which devices are we going to create?
    // For now, we will just create the most broad one: Is Snowy
    // The others may be connfusing for users and might not be as practical.
    // perhaps we can remove them completely.
    const snowyDevices = [
      {
        uid: 'IS_SNOWY',
        displayName: 'Is Snowy',
      },
      // {
      //   uid: 'WAS_SNOWING',
      //   displayName: 'Was Snowing',
      // },
      // {
      //   uid: 'IS_SNOWING',
      //   displayName: 'Is Snowing',
      // },
      // {
      //   uid: 'WILL_SNOW',
      //   displayName: 'Snow Predicted',
      // },
    ];

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of snowyDevices) {

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.uid);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.snowyAccessories.push(new IsSnowyAccessory(this, existingAccessory));

        this.log.debug('Created new SnowyAccessory object:', existingAccessory.displayName);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.displayName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.displayName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        this.snowyAccessories.push(new IsSnowyAccessory(this, accessory));

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

}
