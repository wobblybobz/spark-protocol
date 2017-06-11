// @flow

declare type CoapOptionType =
  | 'If-Match'
  | 'Uri-Host'
  | 'ETag'
  | 'If-None-Match'
  | 'Observe'
  | 'Uri-Port'
  | 'Location-Path'
  | 'Uri-Path'
  | 'Content-Format'
  | 'Max-Age'
  | 'Uri-Query'
  | 'Accept'
  | 'Location-Query'
  | 'Block2'
  | 'Block1'
  | 'Proxy-Uri'
  | 'Proxy-Scheme'
  | 'Size1';
  
declare type CoapOption = {
  name: CoapOptionType,
  value: Buffer,
};

declare class CoapPacket {
  messageId: number,
  options: Array<CoapOption>,
  payload: Buffer,
  static generate(options: CoapPacket): Buffer,
  token: Buffer,
}
