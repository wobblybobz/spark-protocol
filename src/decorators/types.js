// @flow

export type Cache = {
  fnName: string,
  keySets: Array<Array<string>>,
  memoized: Function,
};

export type Decorator<TType> = (
  descriptor: Descriptor,
  name: $Keys<TType>,
  target: TType,
) => Descriptor;

export type Descriptor = {
  configurable: boolean,
  enumerable: boolean,
  value: Function,
  writeable: boolean,
};
