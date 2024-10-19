import { cacheable, clearCache, setCacheTTL, cacheInstances } from './cacheDecorator';
import * as cacheModule from './Cache';

jest.mock('./Cache');

const MockCache = cacheModule.Cache as jest.MockedClass<typeof cacheModule.Cache>;

class TestService {
  @cacheable(5)
  async fetchData(id: string) {
    return `Data for ${id}`;
  }
}

describe('Cacheable Decorator Edge Cases', () => {
  let service: TestService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockClear: jest.Mock;
  let mockSetTTL: jest.Mock;

  beforeEach(() => {
    service = new TestService();
    mockGet = jest.fn();
    mockSet = jest.fn();
    mockClear = jest.fn();
    mockSetTTL = jest.fn();

    const mockCacheInstance = {
      get: mockGet,
      set: mockSet,
      clear: mockClear,
      setTTL: mockSetTTL,
    };

    MockCache.mockImplementation(() => mockCacheInstance as unknown as cacheModule.Cache<unknown>);

    // Ensure the cache is initialized for the TestService
    const cacheKey = 'TestService-fetchData';
    if (!cacheInstances.has(cacheKey)) {
      cacheInstances.set(cacheKey, new MockCache(5));
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
    cacheInstances.clear();
  });

  it('should handle undefined instance in clearCache', () => {
    expect(() => clearCache(TestService.prototype, 'nonExistentMethod')).not.toThrow();
  });

  it('should handle undefined instance in setCacheTTL', () => {
    expect(() => setCacheTTL(TestService.prototype, 'nonExistentMethod', 10)).not.toThrow();
  });

  it('should create cache instance on first method call', async () => {
    await service.fetchData('123');
    expect(MockCache).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('should not create new cache instance on subsequent calls', async () => {
    await service.fetchData('123');
    await service.fetchData('123');
    expect(MockCache).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('should call clear on existing cache instance', async () => {
    await service.fetchData('123');
    clearCache(TestService.prototype, 'fetchData');
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('should call setTTL on existing cache instance', async () => {
    await service.fetchData('123');
    setCacheTTL(TestService.prototype, 'fetchData', 10);
    expect(mockSetTTL).toHaveBeenCalledWith(10);
  });
});
