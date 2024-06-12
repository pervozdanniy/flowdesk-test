export const timedOut = <T>(pr: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    pr,
    new Promise<never>((_, r) =>
      setTimeout(() => r(new Error(`Timeout ${ms} milliseconds exceeded`)), ms),
    ),
  ]);

export const withResolvers = <T>() => {
  let promise: Promise<T>,
    resolve: (value: T) => void,
    reject: (err?: unknown) => void;
  // eslint-disable-next-line prefer-const
  promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};
