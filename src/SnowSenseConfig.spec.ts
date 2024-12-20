import {deepEqual, upgradeConfigs, SnowSenseConfig, SnowSenseUnits} from './SnowSenseConfig';
import { readFileSync, writeFileSync } from 'fs';
import { Logger } from 'homebridge';

jest.mock('fs');
jest.mock('homebridge');

describe('SnowSenseConfig', () => {
  describe('deepEqual', () => {
    it('should compare primitive types', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('a', 'a')).toBe(true);
      expect(deepEqual('a', 'b')).toBe(false);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should compare simple arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
      expect(deepEqual([], [])).toBe(true);
    });

    it('should compare nested arrays', () => {
      expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
      expect(deepEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
      expect(deepEqual([1, [2, [3]]], [1, [2, [3]]])).toBe(true);
      expect(deepEqual([1, [2, [3]]], [1, [2, [4]]])).toBe(false);
    });

    it('should compare simple objects', () => {
      expect(deepEqual({a: 1, b: 2}, {a: 1, b: 2})).toBe(true);
      expect(deepEqual({a: 1, b: 2}, {b: 2, a: 1})).toBe(true);
      expect(deepEqual({a: 1, b: 2}, {a: 1, b: 3})).toBe(false);
      expect(deepEqual({a: 1, b: 2}, {a: 1})).toBe(false);
      expect(deepEqual({}, {})).toBe(true);
    });

    it('should compare nested objects', () => {
      expect(deepEqual({a: 1, b: {c: 2}}, {a: 1, b: {c: 2}})).toBe(true);
      expect(deepEqual({a: 1, b: {c: 2}}, {a: 1, b: {c: 3}})).toBe(false);
      expect(deepEqual({a: 1, b: {c: {d: 3}}}, {a: 1, b: {c: {d: 3}}})).toBe(true);
      expect(deepEqual({a: 1, b: {c: {d: 3}}}, {a: 1, b: {c: {d: 4}}})).toBe(false);
    });

    it('should compare mixed objects and arrays', () => {
      expect(deepEqual({a: [1, 2], b: {c: 3}}, {a: [1, 2], b: {c: 3}})).toBe(true);
      expect(deepEqual({a: [1, 2], b: {c: 3}}, {a: [1, 3], b: {c: 3}})).toBe(false);
      expect(deepEqual([{a: 1}, {b: 2}], [{a: 1}, {b: 2}])).toBe(true);
      expect(deepEqual([{a: 1}, {b: 2}], [{a: 1}, {b: 3}])).toBe(false);
    });

    it('should compare array vs object', () => {
      expect(deepEqual([1, 2, 3], {0: 1, 1: 2, 2: 3})).toBe(false);
      expect(deepEqual({length: 3, 0: 1, 1: 2, 2: 3}, [1, 2, 3])).toBe(false);
    });

    it('should compare empty array vs empty object', () => {
      expect(deepEqual([], {})).toBe(false);
    });

    it('should compare object with array-like keys', () => {
      expect(deepEqual({'0': 'a', '1': 'b', length: 2}, ['a', 'b'])).toBe(false);
    });

    it('should compare functions', () => {
      const func1 = () => 1;
      const func2 = () => 1;
      expect(deepEqual(func1, func1)).toBe(true);
      expect(deepEqual(func1, func2)).toBe(false);
    });

    it('should compare date objects', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-01-01');
      const date3 = new Date('2023-01-02');
      expect(deepEqual(date1, date2)).toBe(true);
      expect(deepEqual(date1, date3)).toBe(false);
    });

    it('should compare regexp objects', () => {
      expect(deepEqual(/abc/, /abc/)).toBe(true);
      expect(deepEqual(/abc/, /def/)).toBe(false);
    });

    it('should compare null and undefined in objects', () => {
      expect(deepEqual({a: null}, {a: null})).toBe(true);
      expect(deepEqual({a: undefined}, {a: undefined})).toBe(true);
      expect(deepEqual({a: null}, {a: undefined})).toBe(false);
    });

    it('should compare objects with prototype properties', () => {
      const proto = {b: 2};
      const obj1 = Object.create(proto);
      const obj2 = Object.create(proto);
      obj1.a = 1;
      obj2.a = 1;
      expect(deepEqual(obj1, obj2)).toBe(true);
    });
  });

  describe('upgradeConfigs', () => {
    let mockLogger: jest.Mocked<Logger>;
    let mockConfig: SnowSenseConfig;
    let mockReadFileSync: jest.MockedFunction<typeof readFileSync>;
    let mockWriteFileSync: jest.MockedFunction<typeof writeFileSync>;

    beforeAll(() => {
      mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
      mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
    });

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
      } as unknown as jest.Mocked<Logger>;

      mockConfig = {
        platform: 'SnowSense',
      } as SnowSenseConfig;

      mockReadFileSync.mockReset();
      mockWriteFileSync.mockReset();
      mockReadFileSync.mockReturnValue(JSON.stringify({platforms: [mockConfig]}));
    });

    it('should return early if no configPath provided', () => {
      upgradeConfigs(mockConfig, '', mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith('upgradeConfigs, no configPath provided, returning');
    });

    it('should set debugOn to false if undefined', () => {
      upgradeConfigs(mockConfig, 'path', mockLogger);
      expect(mockConfig.debugOn).toBe(false);
    });

    it('should create sensors from legacy config', () => {
      mockConfig.name = 'Legacy Sensor';
      mockConfig.hoursAfterSnowIsSnowy = 2;
      mockConfig.hoursBeforeSnowIsSnowy = 1;
      mockConfig.consecutiveHoursOfSnowIsSnowy = 3;

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockConfig.sensors).toEqual([{
        displayName: 'Legacy Sensor',
        hoursBeforeSnowIsSnowy: 1,
        hoursAfterSnowIsSnowy: 2,
        consecutiveHoursFutureIsSnowy: 3,
      }]);
    });

    it('should update sensors if they exist', () => {
      mockConfig.sensors = [{
        displayName: '',
        hoursBeforeSnowIsSnowy: 1,
        hoursAfterSnowIsSnowy: 2,
        consecutiveHoursFutureIsSnowy: 3,
      }];

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockConfig.sensors![0].displayName).toMatch(/^Snowy-/);
    });

    it('should update apiKey and apiVersion from legacy key', () => {
      mockConfig.key = 'oldApiKey';

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockConfig.apiKey).toBe('oldApiKey');
      expect(mockConfig.apiVersion).toBe('2.5');
      expect(mockConfig.key).toBeUndefined();
    });

    it('should set apiVersion to 3.0 if not defined', () => {
      upgradeConfigs(mockConfig, 'path', mockLogger);
      expect(mockConfig.apiVersion).toBe('3.0');
    });

    it('should update location from latitude and longitude', () => {
      mockConfig.latitude = 40.7128;
      mockConfig.longitude = -74.0060;

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockConfig.location).toBe('40.7128,-74.006');
      expect(mockConfig.latitude).toBeUndefined();
      expect(mockConfig.longitude).toBeUndefined();
    });

    it('should set units to imperial if invalid', () => {
      mockConfig.units = 'invalid' as SnowSenseUnits;

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockConfig.units).toBe('imperial');
    });

    it('should update hoursBeforeSnowIsSnowy from beforeSnowStarts', () => {
      mockConfig.beforeSnowStarts = 5;

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockConfig.hoursBeforeSnowIsSnowy).toBe(5);
      expect(mockConfig.beforeSnowStarts).toBeUndefined();
    });

    it('should update hoursAfterSnowIsSnowy from afterSnowStops', () => {
      mockConfig.afterSnowStops = 6;

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockConfig.hoursAfterSnowIsSnowy).toBe(6);
      expect(mockConfig.afterSnowStops).toBeUndefined();
    });

    it('should update apiThrottleMinutes from forecastFrequency', () => {
      mockConfig.forecastFrequency = 30;

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockConfig.apiThrottleMinutes).toBe(30);
      expect(mockConfig.forecastFrequency).toBeUndefined();
    });

    it('should write updated config to file', () => {
      mockConfig.key = 'oldApiKey';  // This will trigger a config change

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockWriteFileSync).toHaveBeenCalledWith('path', expect.any(String), 'utf8');
    });

    it('should handle file read/write errors', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error updating config file'));
    });

    it('should not write file if no changes made', () => {
      // Pre-set debugOn to avoid it being counted as a change
      mockConfig.debugOn = false;
      mockConfig.apiVersion = '3.0';

      upgradeConfigs(mockConfig, 'path', mockLogger);

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should set debugOn to false without triggering a write', () => {
      // Create a new config object without debugOn
      const configWithoutDebugOn: SnowSenseConfig = {
        ...mockConfig,
        apiVersion: '3.0',
      };
      delete configWithoutDebugOn.debugOn;

      upgradeConfigs(configWithoutDebugOn, 'path', mockLogger);

      expect(configWithoutDebugOn.debugOn).toBe(false);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

  });
});
