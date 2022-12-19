import { Service, PlatformAccessory } from 'homebridge';
import { SnowSensePlatform } from './platform';

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
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, '@bbernstein')
            .setCharacteristic(this.platform.Characteristic.Model, 'Snow Sense');

        this.service = this.accessory.getService(this.platform.Service.OccupancySensor) ||
            this.accessory.addService(this.platform.Service.OccupancySensor);

        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
    }

    public updateValueIfChanged(service, value: boolean) {
        const oldCharacteristicValue = service.getCharacteristic(this.platform.Characteristic.OccupancyDetected);
        const oldValue: 0 | 1 = oldCharacteristicValue.value ? 1 : 0;
        const newValue: 0 | 1 = value ? 1 : 0;
        if (oldValue !== newValue) {
            this.platform.log.debug(`Changing value of ${ this.accessory.displayName } to: `, newValue);
            service.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, newValue);
        }
    }
}
