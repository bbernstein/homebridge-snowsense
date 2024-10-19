import { Cache } from './Cache';

interface PendingPromise<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export const cacheInstances = new Map<string, Cache<unknown>>();
const pendingPromises = new Map<string, PendingPromise<unknown>>();

export function cacheable(ttlMinutes: number) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const cacheKey = `${target.constructor.name}-${propertyKey}`;

    if (!cacheInstances.has(cacheKey)) {
      cacheInstances.set(cacheKey, new Cache<unknown>(ttlMinutes));
    }

    descriptor.value = async function (...args: unknown[]) {
      const cache = cacheInstances.get(cacheKey)!;
      const key = `${propertyKey}-${JSON.stringify(args)}`;

      const cachedResult = cache.get(key);
      if (cachedResult !== undefined && cachedResult !== null) {
        return cachedResult;
      }

      if (pendingPromises.has(key)) {
        return pendingPromises.get(key)!.promise;
      }

      let promiseResolve: (value: unknown) => void;
      let promiseReject: (reason?: unknown) => void;
      const promise = new Promise((resolve, reject) => {
        promiseResolve = resolve;
        promiseReject = reject;
      });

      pendingPromises.set(key, { promise, resolve: promiseResolve!, reject: promiseReject! });

      try {
        const result = await originalMethod.apply(this, args);
        cache.set(key, result);
        const pendingPromise = pendingPromises.get(key);
        pendingPromise!.resolve(result);
        return result;
      } finally {
        pendingPromises.delete(key);
      }
    };

    return descriptor;
  };
}

// Utility functions for testing
export function clearCache(target: object, propertyKey: string): void {
  const cacheKey = `${target.constructor.name}-${propertyKey}`;
  const instance = cacheInstances.get(cacheKey);
  instance?.clear();
}

export function setCacheTTL(target: object, propertyKey: string, ttlMinutes: number): void {
  const cacheKey = `${target.constructor.name}-${propertyKey}`;
  cacheInstances.get(cacheKey)?.setTTL(ttlMinutes);
}
