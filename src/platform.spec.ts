import {SnowSensePlatform} from './platform';
import {API, Logger, PlatformAccessory, PlatformConfig} from 'homebridge';
import {BinaryLike} from 'crypto';
import {IsSnowyAccessory} from './platformAccessory';
import {SnowWatch} from './SnowWatch';
import {SnowSenseConfig} from './SnowSenseConfig';
import {PlatformName, PluginIdentifier} from 'homebridge/lib/api';

jest.mock('./SnowWatch');
jest.mock('./platformAccessory', () => {
  return {
    IsSnowyAccessory: jest.fn().mockImplementation((platform, accessory) => {
      return {
        platform: platform,
        accessory: accessory,
        updateValueIfChanged: jest.fn(),
        setCharacteristic: jest.fn(),
      };
    }),
  };
});

describe('SnowSensePlatform', () => {
  let platform: SnowSensePlatform;
  let mockLog: jest.Mocked<Logger>;
  let mockApi: jest.Mocked<API>;
  let mockConfig: PlatformConfig;

  beforeEach(() => {
    mockLog = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    mockApi = {
      on: jest.fn(),
      registerPlatformAccessories: jest.fn((pluginIdentifier: PluginIdentifier, platformName: PlatformName, accessories: PlatformAccessory[]) => {
        accessories.forEach(accessory => {
          platform.configureAccessory(accessory);
        });
        // platform.accessories.concat(accessories);
      }),
      unregisterPlatformAccessories: jest.fn(),
      updatePlatformAccessories: jest.fn(),
      hap: {
        Service: jest.fn(),
        Characteristic: jest.fn(),
        uuid: {
          generate: jest.fn((data: BinaryLike) => 'test-uuid') as jest.Mock<string, [BinaryLike]>,
        },
      },
      user: {
        configPath: jest.fn().mockReturnValue('/mock/config/path'),
        storagePath: jest.fn().mockReturnValue('/mock/storage/path'),
      },
      platformAccessory: jest.fn().mockImplementation((displayName, uuid) => {
        return {
          displayName,
          UUID: uuid,
          context: {
            device: {
              displayName: displayName,
            },
          },
          services: [],
          getService: jest.fn(),
          addService: jest.fn(),
        } as unknown as PlatformAccessory;
      }),
    } as unknown as jest.Mocked<API>;

    mockConfig = {
      name: 'Test Platform',
      platform: 'SnowSense',
    };

    platform = new SnowSensePlatform(mockLog, mockConfig, mockApi);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('constructor initializes correctly', () => {
    expect(platform.log).toBe(mockLog);
    expect(platform.platformConfig).toBe(mockConfig);
    expect(platform.api).toBe(mockApi);
    expect(platform.accessories).toEqual([]);
    expect(mockApi.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
  });

  describe('debug function', () => {
    it('should not log when debugOn is false', () => {
      platform['debug']('Test debug message');
      expect(mockLog.debug).not.toHaveBeenCalled();
    });

    it('should log when debugOn is true', () => {
      // Create a new platform instance with debugOn set to true
      const debugConfig = {...mockConfig, debugOn: true};
      const debugPlatform = new SnowSensePlatform(mockLog, debugConfig, mockApi);

      debugPlatform['debug']('Test debug message');
      expect(mockLog.debug).toHaveBeenCalledWith('Test debug message');
    });

    it('should log with parameters when debugOn is true', () => {
      const debugConfig = {...mockConfig, debugOn: true};
      const debugPlatform = new SnowSensePlatform(mockLog, debugConfig, mockApi);

      debugPlatform['debug']('Test message with %s', 'parameter');
      expect(mockLog.debug).toHaveBeenCalledWith('Test message with %s', 'parameter');
    });
  });

  test('configureAccessory adds accessory to accessories array', () => {
    const mockAccessory = {} as PlatformAccessory;
    platform.configureAccessory(mockAccessory);
    expect(platform.accessories).toContain(mockAccessory);
  });

  describe('discoverDevices', () => {
    test('discoverDevices creates and registers new accessories', () => {
      const mockDevice = {displayName: 'Test Device'};
      platform.platformConfig.sensors = [mockDevice];

      const mockUuid = 'test-uuid';
      (mockApi.hap.uuid.generate as jest.Mock).mockReturnValue(mockUuid);

      platform.discoverDevices(platform.platformConfig as SnowSenseConfig);

      expect(mockApi.platformAccessory).toHaveBeenCalledWith('Test Device', mockUuid);
      expect(mockApi.registerPlatformAccessories).toHaveBeenCalledWith(
        'homebridge-snowsense',
        'SnowSense',
        [expect.any(Object)],
      );
      expect(IsSnowyAccessory).toHaveBeenCalledWith(platform, expect.any(Object));
    });

    it('should correctly identify accessories to remove', () => {
      const mockAccessory1 = {displayName: 'Device1', UUID: 'uuid1'} as unknown as PlatformAccessory;
      const mockAccessory2 = {displayName: 'Device2', UUID: 'uuid2'} as unknown as PlatformAccessory;
      const mockAccessory3 = {displayName: 'Device3', UUID: 'uuid3'} as unknown as PlatformAccessory;

      platform.accessories = [mockAccessory1, mockAccessory2, mockAccessory3];

      (platform.platformConfig as any) = {
        ...platform.platformConfig,
        sensors: [
          {displayName: 'Device1'},
          {displayName: 'Device3'},
          {displayName: 'NewDevice'},
        ],
      };

      const unregisterSpy = jest.spyOn(platform.api, 'unregisterPlatformAccessories');

      platform.discoverDevices(platform.platformConfig as SnowSenseConfig);

      expect(unregisterSpy).toHaveBeenCalledWith(
        'homebridge-snowsense',
        'SnowSense',
        [mockAccessory2],
      );

      expect(platform.accessories).not.toContain(mockAccessory2);
      expect(platform.accessories).toContain(mockAccessory1);
      expect(platform.accessories).toContain(mockAccessory3);
    });

    it('should correctly identify accessories to remove when sensors are null set', () => {
      const mockAccessory1 = {displayName: 'Device1', UUID: 'uuid1'} as unknown as PlatformAccessory;
      const mockAccessory2 = {displayName: 'Device2', UUID: 'uuid2'} as unknown as PlatformAccessory;
      const mockAccessory3 = {displayName: 'Device3', UUID: 'uuid3'} as unknown as PlatformAccessory;

      platform.accessories = [mockAccessory1, mockAccessory2, mockAccessory3];

      (platform.platformConfig as any) = {
        ...platform.platformConfig,
        sensors: undefined,
      };

      const unregisterSpy = jest.spyOn(platform.api, 'unregisterPlatformAccessories');

      platform.discoverDevices(platform.platformConfig as SnowSenseConfig);

      expect(unregisterSpy).toHaveBeenCalledWith(
        'homebridge-snowsense',
        'SnowSense',
        [mockAccessory2],
      );

      expect(platform.accessories).not.toContain(mockAccessory1);
      expect(platform.accessories).not.toContain(mockAccessory2);
      expect(platform.accessories).not.toContain(mockAccessory3);
    });

    it('should generate a random name for devices with undefined displayName', () => {
      // Mock Math.random to return a predictable value
      const mockMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

      // Setup a device with undefined displayName
      const snowyDevices = [
        {displayName: undefined},
        {displayName: 'Device1'},
      ];

      // Mock the config
      (platform.platformConfig as any) = {
        ...platform.platformConfig,
        sensors: snowyDevices,
      };

      // Mock UUID generation to return predictable values
      let uuidCounter = 0;
      (platform.api.hap.uuid.generate as jest.Mock).mockImplementation(() => `mock-uuid-${uuidCounter++}`);

      // Spy on the registerPlatformAccessories method
      const registerSpy = jest.spyOn(platform.api, 'registerPlatformAccessories');

      // Call the method
      platform.discoverDevices(platform.platformConfig as SnowSenseConfig);

      // Assertions
      expect(registerSpy).toHaveBeenCalledWith(
        'homebridge-snowsense',
        'SnowSense',
        [
          expect.objectContaining({
            displayName: 'Snowy-xjylrx',
            UUID: 'mock-uuid-0',
          }),
        ],
      );
      expect(registerSpy).toHaveBeenCalledWith(
        'homebridge-snowsense',
        'SnowSense',
        [
          expect.objectContaining({
            displayName: 'Device1',
            UUID: 'mock-uuid-1',
          }),
        ],
      );

      // Restore the original Math.random
      mockMathRandom.mockRestore();
    });

    it('should handle existing accessories correctly', () => {
      // Setup existing accessories
      const existingAccessory1 = {
        displayName: 'ExistingDevice1',
        UUID: 'SNOWSENSE-ExistingDevice1',
        context: {device: {displayName: 'ExistingDevice1'}},
      } as unknown as PlatformAccessory;
      const existingAccessory2 = {
        displayName: 'ExistingDevice2',
        UUID: 'SNOWSENSE-ExistingDevice2',
        context: {device: {displayName: 'ExistingDevice2'}},
      } as unknown as PlatformAccessory;

      platform.accessories = [existingAccessory1, existingAccessory2];

      // Setup devices in config (mix of existing and new)
      const snowyDevices = [
        {displayName: 'ExistingDevice1'},  // Existing device
        {displayName: 'NewDevice'},        // New device
        {displayName: 'ExistingDevice2'},  // Existing device
      ];

      (platform.platformConfig as any) = {
        ...platform.platformConfig,
        sensors: snowyDevices,
      };

      // Mock UUID generation. Pass the seed instead of making a real uuid. The seed is ("SNOWSENSE-" + displayName)
      // above, you can see the test data has UUIDs that match this pattern
      (platform.api.hap.uuid.generate as jest.Mock).mockImplementation((seed) => seed);

      // Spies
      const registerSpy = jest.spyOn(mockApi, 'registerPlatformAccessories');
      const updateSpy = jest.spyOn(mockApi, 'updatePlatformAccessories');
      const unregisterSpy = jest.spyOn(mockApi, 'unregisterPlatformAccessories');

      // Call the method
      platform.discoverDevices(platform.platformConfig as SnowSenseConfig);

      // Assertions

      // Check that existing accessories were updated
      expect(updateSpy).toHaveBeenCalledWith([existingAccessory1]);
      expect(updateSpy).toHaveBeenCalledWith([existingAccessory2]);
      expect(updateSpy).toHaveBeenCalledTimes(2);

      // Check that new accessory was registered
      expect(registerSpy).toHaveBeenCalledWith(
        'homebridge-snowsense',
        'SnowSense',
        [expect.objectContaining({displayName: 'NewDevice', UUID: 'SNOWSENSE-NewDevice'})],
      );

      // Check that no accessories were unregistered
      expect(unregisterSpy).not.toHaveBeenCalled();

      // check that we registered the NewDevice
      expect(registerSpy).toHaveBeenCalledTimes(1);

      // Check that platform.accessories now contains all devices
      expect(platform.accessories).toHaveLength(3);
      expect(platform.accessories.map(a => a.displayName)).toEqual(
        expect.arrayContaining(['ExistingDevice1', 'ExistingDevice2', 'NewDevice']),
      );

      // Check that existing accessories maintained their UUIDs
      expect(platform.accessories.find(a => a.displayName === 'ExistingDevice1')?.UUID).toBe('SNOWSENSE-ExistingDevice1');
      expect(platform.accessories.find(a => a.displayName === 'ExistingDevice2')?.UUID).toBe('SNOWSENSE-ExistingDevice2');
    });
  });

  describe('updateAccessories', () => {
    test('updateAccessories updates all accessories', async () => {
      const mockAccessory1 = {
        displayName: 'Device 1',
        UUID: 'uuid1',
        context: {
          device: {
            displayName: 'Device 1',
          },
        },
        getService: jest.fn().mockReturnValue({
          updateCharacteristic: jest.fn(),
        }),
      } as unknown as PlatformAccessory;

      const mockAccessory2 = {
        displayName: 'Device 2',
        UUID: 'uuid2',
        context: {
          device: {
            displayName: 'Device 2',
          },
        },
        getService: jest.fn().mockReturnValue({
          updateCharacteristic: jest.fn(),
        }),
      } as unknown as PlatformAccessory;

      platform.snowyAccessories = [
        new IsSnowyAccessory(platform, mockAccessory1),
        new IsSnowyAccessory(platform, mockAccessory2),
      ];

      const mockWatcher = {
        updatePredictionStatus: jest.fn(),
        snowSensorValue: jest.fn().mockReturnValue(true),
      };
      (SnowWatch as jest.Mock).mockReturnValue(mockWatcher);

      await platform.updateAccessories();

      expect(mockWatcher.updatePredictionStatus).toHaveBeenCalled();
      expect(mockWatcher.snowSensorValue).toHaveBeenCalledTimes(2);
      expect(platform.snowyAccessories[0].updateValueIfChanged).toHaveBeenCalled();
      expect(platform.snowyAccessories[1].updateValueIfChanged).toHaveBeenCalled();
    });

    it('should log an error when updatePredictionStatus throws', async () => {
      // Mock the getWatcher method
      const mockWatcher = {
        updatePredictionStatus: jest.fn().mockRejectedValue(new Error('Weather update failed')),
        snowSensorValue: jest.fn().mockReturnValue(true),
      };
      jest.spyOn(platform, 'getWatcher').mockResolvedValue(mockWatcher as any);

      // Mock the log.error method
      const logErrorSpy = jest.spyOn(platform.log, 'error');

      // Call the method
      await platform.updateAccessories();

      // Check if the error was logged
      expect(logErrorSpy).toHaveBeenCalledWith('Error getting updated weather: Weather update failed');

      // Check that snowSensorValue was not called due to early return
      expect(mockWatcher.snowSensorValue).not.toHaveBeenCalled();
    });
  });

  describe('watchWeather', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    test('watchWeather sets up interval for updating accessories', async () => {
      const updateAccessoriesSpy = jest.spyOn(platform, 'updateAccessories').mockResolvedValue();

      await platform.watchWeather();

      expect(updateAccessoriesSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(platform.forecastFrequencyMillis);

      expect(updateAccessoriesSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('simulate DID_FINISH_LAUNCHING', () => {
    test('calls discoverDevices and startWatchingWeather when DID_FINISH_LAUNCHING is triggered', () => {
      // Spy on the methods we expect to be called
      const discoverDevicesSpy = jest.spyOn(platform, 'discoverDevices').mockImplementation();
      const startWatchingWeatherSpy = jest.spyOn(platform, 'startWatchingWeather').mockResolvedValue();

      // Get the callback function that was passed to api.on
      const didFinishLaunchingCallback = (mockApi.on as jest.Mock).mock.calls.find(
        call => call[0] === 'didFinishLaunching',
      )[1];

      // Call the callback function
      didFinishLaunchingCallback();

      // Verify that the methods were called
      expect(discoverDevicesSpy).toHaveBeenCalledWith(platform.platformConfig);
      expect(startWatchingWeatherSpy).toHaveBeenCalledWith(platform.platformConfig);
    });
  });
})
;
