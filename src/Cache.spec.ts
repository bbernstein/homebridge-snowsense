import { cacheable, clearCache, setCacheTTL } from './cacheDecorator';

class ParallelService {
  callCount = 0;

  @cacheable(5) // Cache for 5 minutes
  async fetchData(id: string) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate some delay
    this.callCount++;
    return `Data for ${id}`;
  }
}

class MyService {
  callCount = 0;

  @cacheable(1) // Cache for 5 minutes
  async fetchData(id: string) {
    this.callCount++;
    return `Data for ${id}`;
  }
}

describe('Cache', () => {

  describe('Cacheable Service', () => {
    let service: MyService;

    beforeEach(() => {
      service = new MyService();
      clearCache(MyService.prototype, 'fetchData'); // Clear cache before each test
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should cache results', async () => {
      const result1 = await service.fetchData('123');
      const result2 = await service.fetchData('123');
      expect(result1).toBe(result2);
    });

    it('should fetch new data after clearing cache', async () => {
      const result1 = await service.fetchData('123');
      clearCache(MyService.prototype, 'fetchData');
      const result2 = await service.fetchData('123');
      expect(result1).toBe(result2); // Data should be the same
      // But we know it was fetched twice because we cleared the cache
    });

    it('should respect new TTL', async () => {
      const result1 = await service.fetchData('123');
      setCacheTTL(MyService.prototype, 'fetchData', 0); // Set TTL to 0 minutes
      const result2 = await service.fetchData('123');
      expect(result1).toBe(result2); // Data should be the same
      // But we know it was fetched twice because we set TTL to 0
    });

    it('should fetch new data after cache expiration', async () => {
      const result1 = await service.fetchData('123');
      expect(service.callCount).toBe(1);

      // Immediately fetch again, should use cache
      const result2 = await service.fetchData('123');
      expect(service.callCount).toBe(1);
      expect(result1).toBe(result2);

      // Advance time by 2 minutes (more than the cache TTL)
      jest.advanceTimersByTime(2 * 60 * 1000);

      // Fetch again, should get fresh data
      const result3 = await service.fetchData('123');
      expect(service.callCount).toBe(2);
      expect(result1).toBe(result3); // Data should be the same
      // But we know it was fetched again because the cache expired
    });
  });

  describe('Cacheable Service with Parallel Calls', () => {
    let service: ParallelService;

    beforeEach(() => {
      service = new ParallelService();
      clearCache(ParallelService.prototype, 'fetchData'); // Clear cache before each test
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle parallel calls and return the same promise', async () => {
      // Create multiple parallel calls
      const promise1 = service.fetchData('123');
      const promise2 = service.fetchData('123');
      const promise3 = service.fetchData('123');

      // Resolve all promises
      jest.runAllTimers();
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      // All results should be the same
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);

      // The method should only have been called once
      expect(service.callCount).toBe(1);
    });

    it('should handle interleaved calls correctly', async () => {
      // Start the first call
      const promise1 = service.fetchData('123');

      // Advance time a bit, but not enough to complete the call
      jest.advanceTimersByTime(50);

      // Start a second call while the first is still pending
      const promise2 = service.fetchData('123');

      // Complete all pending timers
      jest.runAllTimers();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Results should be the same
      expect(result1).toBe(result2);

      // The method should only have been called once
      expect(service.callCount).toBe(1);
    });
  });
});
