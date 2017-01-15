// @flow

export type Decorator<TType> = (
  target: TType,
  name: $Keys<TType>,
  descriptor: Descriptor,
) => Descriptor;

export type Descriptor = {
  configurable: boolean,
  enumerable: boolean,
  value: Function,
  writeable: boolean,
};
