import { IsSnowyAccessory } from './platformAccessory';
import { SnowSensePlatform } from './platform';
import { PlatformAccessory, Service } from 'homebridge';

describe('IsSnowyAccessory', () => {
  let platform: SnowSensePlatform;
  let accessory: PlatformAccessory;
  let service: Service;

  beforeEach(() => {
    const AccessoryInformation = Symbol('AccessoryInformation');
    const OccupancySensor = Symbol('OccupancySensor');

    // Mock the service
    service = {
      setCharacteristic: jest.fn(() => service),
      // Add any other methods you want to test here
    } as unknown as Service;

    // Mock the platform
    platform = {
      Service: {
        AccessoryInformation,
        OccupancySensor,
      },
      Characteristic: {
        Name: jest.fn(),
        Manufacturer: jest.fn(),
        Model: jest.fn(),
        OccupancyDetected: jest.fn(),
      },
      log: {
        info: jest.fn(),
      },
    } as unknown as SnowSensePlatform;

    // Mock the accessory
    accessory = {
      getService: jest.fn().mockImplementation((serviceType) => {
        if (serviceType === AccessoryInformation) {
          return service;
        } else if (serviceType === OccupancySensor) {
          return undefined;
        }
      }),
      addService: jest.fn().mockImplementation((serviceType) => {
        if (serviceType === OccupancySensor) {
          return service;
        }
      }),
      context: {
        device: {
          displayName: 'Test Device',
        },
      },
    } as unknown as PlatformAccessory;
  });

  it('should call getService and setCharacteristic in constructor', () => {
    new IsSnowyAccessory(platform, accessory);

    expect(accessory.getService).toHaveBeenCalledWith(platform.Service.AccessoryInformation);
    expect(service.setCharacteristic).toHaveBeenCalledWith(platform.Characteristic.Name, accessory.context.device.displayName);
    expect(service.setCharacteristic).toHaveBeenCalledWith(platform.Characteristic.Manufacturer, '@bbernstein');
    expect(service.setCharacteristic).toHaveBeenCalledWith(platform.Characteristic.Model, 'Snow Sense');
    expect(accessory.getService).toHaveBeenCalledWith(platform.Service.OccupancySensor);
    expect(service.setCharacteristic).toHaveBeenCalledWith(platform.Characteristic.OccupancyDetected, 0);
  });

  it('should call setCharacteristic and updateCharacteristic with value 1', () => {
    const value = true;
    const newValue = 1;
    const service = {
      updateCharacteristic: jest.fn(),
    };

    const accessoryInstance = new IsSnowyAccessory(platform, accessory);
    accessoryInstance.setCharacteristic(service, value);

    expect(platform.log.info).toHaveBeenCalledWith(`Setting value of ${accessoryInstance.accessory.displayName} to: `, newValue);
    expect(service.updateCharacteristic).toHaveBeenCalledWith(platform.Characteristic.OccupancyDetected, newValue);
  });

  it('should call updateValueIfChanged and setCharacteristic when value has changed', () => {
    const oldValue = false;
    const newValue = true;
    const service = {
      getCharacteristic: jest.fn().mockReturnValue({ value: oldValue ? 1 : 0 }),
      updateCharacteristic: jest.fn(),
    };

    const accessoryInstance = new IsSnowyAccessory(platform, accessory);
    accessoryInstance.updateValueIfChanged(service, newValue);

    expect(service.getCharacteristic).toHaveBeenCalledWith(platform.Characteristic.OccupancyDetected);
    expect(platform.log.info).toHaveBeenCalledWith(`Setting value of ${accessoryInstance.accessory.displayName} to: `, newValue ? 1 : 0);
    expect(service.updateCharacteristic).toHaveBeenCalledWith(platform.Characteristic.OccupancyDetected, newValue ? 1 : 0);
  });

  it('should call setCharacteristic and updateCharacteristic with 0', () => {
    const value = false;
    const newValue = 0;
    const service = {
      updateCharacteristic: jest.fn(),
    };

    const accessoryInstance = new IsSnowyAccessory(platform, accessory);
    accessoryInstance.setCharacteristic(service, value);

    expect(platform.log.info).toHaveBeenCalledWith(`Setting value of ${accessoryInstance.accessory.displayName} to: `, newValue);
    expect(service.updateCharacteristic).toHaveBeenCalledWith(platform.Characteristic.OccupancyDetected, newValue);
  });

  it('should not call setCharacteristic when value has not changed', () => {
    const oldValue = true;
    const newValue = true;
    const service = {
      getCharacteristic: jest.fn().mockReturnValue({ value: oldValue ? 1 : 0 }),
      updateCharacteristic: jest.fn(),
    };

    const accessoryInstance = new IsSnowyAccessory(platform, accessory);
    accessoryInstance.updateValueIfChanged(service, newValue);

    expect(service.getCharacteristic).toHaveBeenCalledWith(platform.Characteristic.OccupancyDetected);
    expect(platform.log.info).not.toHaveBeenCalled();
    expect(service.updateCharacteristic).not.toHaveBeenCalled();
  });
});
