// @flow

import type { Decorator, Descriptor } from './types';

export default <TType: Object>(
  parameterKeys: ?Array<string> = null,
): Decorator<TType> =>
  (target: TType, name: $Keys<TType>, descriptor: Descriptor): Descriptor => {
    const descriptorFunction = descriptor.value;
    let fetchItemFunction = item => item;
    if (!parameterKeys) {
      fetchItemFunction = item => item;
    } else if (parameterKeys[0] === 'id') {
      fetchItemFunction = function (id: string) {
        return this.getById(id);
      };
    } else {
      fetchItemFunction = (keys: Array<string>) => function (...parameters) {
        return this.getAll()
          .filter(
            item => parameters.every(
              (param, index) => param === item[keys[index]],
            )
          );
      };
    }
    descriptor.value = async function () {
      const args = arguments;

      const result = await descriptorFunction.call(this, ...args);
      let item = {
        ...result,
        ...(await fetchItemFunction.call(this, ...args)),
      };

      target._caches.forEach(cache => {
        cache.keySets.forEach(keySet => {
          if (!keySet || !keySet.length) {
            cache.memoized.clear();
            return;
          }
          // Either get the parameter out of item or the args.
          const cacheParams = keySet.map(
            key => item[key] || args[keySet.indexOf(key)],
          );
          cache.memoized.delete(...cacheParams);
        });
      });

      return result;
    };
    return descriptor
  };
