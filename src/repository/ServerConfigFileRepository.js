// @flow

import fs from 'fs';
import ursa from 'ursa';

class ServerConfigFileRepository {
  _serverKeyFileName: string;
  constructor(serverKeyFileName: string) {
    this._serverKeyFileName = serverKeyFileName;
  }

  setupKeys(): void {
    //
    //  Load the provided key, or generate one
    //
    if (!fs.existsSync(this._serverKeyFileName)) {
      console.warn("Creating NEW server key");
      const keys = ursa.generatePrivateKey();

      const extIdx = this._serverKeyFileName.lastIndexOf(".");
      const derFilename =
        this._serverKeyFileName.substring(0, extIdx) + ".der";
      const pubPemFilename =
        this._serverKeyFileName.substring(0, extIdx) + ".pub.pem";

      fs.writeFileSync(this._serverKeyFileName, keys.toPrivatePem('binary'));
      fs.writeFileSync(pubPemFilename, keys.toPublicPem('binary'));

      //DER FORMATTED KEY for the core hardware
      //TODO: fs.writeFileSync(derFilename, keys.toPrivatePem('binary'));
    }
  }
}

export default ServerConfigFileRepository;
