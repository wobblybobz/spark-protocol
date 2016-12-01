'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (code, path) {
  var uri = code + path;

  //find the slash.
  var idx = uri.indexOf('/');

  // this assumes all the messages are one character for now.
  // if we wanted to change this, we'd need to find the first non message char,
  // '/' or '?',
  // or use the real coap parsing stuff
  return uri.substr(0, idx + 2);
};