/* eslint-disable */

import test from 'ava';
import sinon from 'sinon';
import FirmwareManager from '../src/lib/FirmwareManager';

test('should subscribe to event', t => {
  const SYSTEM = {
    f: [],
    v: {},
    p: 8,
    m: [
      {
        s: 16384,
        l: 'm',
        vc: 30,
        vv: 30,
        f: 'b',
        n: '0',
        v: 11,
        d: [],
      },
      {
        s: 262144,
        l: 'm',
        vc: 30,
        vv: 30,
        f: 's',
        n: '1',
        v: 109,
        d: [],
      },
      {
        s: 262144,
        l: 'm',
        vc: 30,
        vv: 30,
        f: 's',
        n: '2',
        v: 109,
        d: [
          {
            f: 's',
            n: '1',
            v: 109,
            _: '',
          },
        ],
      },
      {
        s: 131072,
        l: 'm',
        vc: 30,
        vv: 26,
        u: '9AA9B022074E20643188FEC98EB2FEE61E72BB6B5BEDDEAAACB77070E7CFCE3C',
        f: 'u',
        n: '1',
        v: 5,
        d: [
          {
            f: 's',
            n: '2',
            v: 1002,
            _: '',
          },
        ],
      },
      {
        s: 131072,
        l: 'f',
        vc: 30,
        vv: 0,
        d: [],
      },
    ],
  };

  FirmwareManager.getOtaSystemUpdateConfig(SYSTEM);
});
