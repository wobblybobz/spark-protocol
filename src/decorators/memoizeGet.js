// @flow

import type { Decorator, Descriptor } from './types';

import memoize from 'memoizee';

type MemoizeConfig = {
  maxAge?: number,
  promise?: boolean,
};

const DEFAULT_MAX_AGE = 3600 * 1000; // 1 hour
const DEFAULT_PARAMETERS = {
  promise: true,
  maxAge: DEFAULT_MAX_AGE,
};

/* eslint-disable no-param-reassign */
export default <TType: Object>(
  selectKeys: ?(data: Object) => Array<mixed> = null,
  config: ?MemoizeConfig = null,
): Decorator<TType> =>
  (target: TType, name: $Keys<TType>, descriptor: Descriptor): Descriptor => {
    const descriptorFunction = descriptor.value;
    const memoized = memoize(
      descriptorFunction,
      {
        ...DEFAULT_PARAMETERS,
        ...config,
      },
    );
    descriptor.value = memoized;
    if (!target._caches) {
      target._caches = [];
    }
    target._caches.push({
      memoized,
      selectKeys,
    });
    return descriptor;
  };
