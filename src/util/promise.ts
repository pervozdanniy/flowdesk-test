export const timedOut = <T>(pr: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    pr,
    new Promise<never>((_, r) =>
      setTimeout(() => r(new Error(`Timeout ${ms} milliseconds exceeded`)), ms),
    ),
  ]);

export const withResolvers = <T>() => {
  let promise: Promise<T>,
    resolve!: (value: T) => void,
    reject!: (err?: unknown) => void;
  // eslint-disable-next-line prefer-const
  promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

export class AsyncCache<K = any, V = any> {
  private resolvers = new Map<K, any>();
  private data = new Map<K, V>();
  private rejected: unknown = null;

  init(key: K) {
    this.resolvers.set(key, withResolvers());
  }

  set(key: K, value: V) {
    if (!this.data.has(key)) {
      this.resolvers.get(key)?.resolve();
    }
    this.data.set(key, value);
  }

  delete(key: K) {
    this.data.delete(key);
    this.init(key);
  }

  async get(key: K) {
    if (this.rejected !== null) {
      throw this.rejected;
    }
    await this.resolvers.get(key);

    return this.data.get(key)!;
  }

  reject(reason?: unknown) {
    this.rejected = reason ?? new Error();
  }
}
