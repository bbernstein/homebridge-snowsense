import {PlatformAccessory, Service} from 'homebridge';
import {SnowSensePlatform} from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class IsSnowyAccessory {
  private service: Service;

  constructor(
    private readonly platform: SnowSensePlatform,
    public readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    accessory.getService(platform.Service.AccessoryInformation)!
      .setCharacteristic(platform.Characteristic.Name, accessory.context.device.displayName)
      .setCharacteristic(platform.Characteristic.Manufacturer, '@bbernstein')
      .setCharacteristic(platform.Characteristic.Model, 'Snow Sense');

    this.service = accessory.getService(platform.Service.OccupancySensor) ||
      accessory.addService(platform.Service.OccupancySensor);

    this.service.setCharacteristic(platform.Characteristic.Name, accessory.context.device.displayName);
    this.service.setCharacteristic(platform.Characteristic.OccupancyDetected, 0);
  }

  public setCharacteristic(service, value: boolean) {
    const newValue = value ? 1 : 0;
    this.platform.log.info(`Setting value of ${this.accessory.displayName} to: `, newValue);
    service.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, newValue);
  }

  public updateValueIfChanged(service, value: boolean) {
    const oldCharacteristicValue = service.getCharacteristic(this.platform.Characteristic.OccupancyDetected);
    const oldValue: boolean = oldCharacteristicValue.value === 1; // 1 is true, 0 is false
    if (oldValue !== value) {
      this.setCharacteristic(service, value);
    }
  }
}
