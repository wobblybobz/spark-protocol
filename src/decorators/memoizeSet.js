// @flow

import type { Decorator, Descriptor } from './types';

export default <TType: Object>(
  getDataSelector: (...args: any) => Object,
): Decorator<TType> =>
  (target: TType, name: $Keys<TType>, descriptor: Descriptor): Descriptor => {
    const descriptorFunction = descriptor.value;

    descriptor.value = async function () {
      const args = arguments;
      const data = getDataSelector(...args);
      target._caches.forEach(
        cache => cache.selectKeys
          ? cache.memoized.delete(...cache.selectKeys(data))
          : cache.memoized.delete(),
      );
      return await descriptorFunction.call(this, ...args);
    };
    return descriptor
  };
