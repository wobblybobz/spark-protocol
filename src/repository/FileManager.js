// @flow

import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';

class FileManager {
  _path: string;
  _isJSON: boolean;

  constructor(path: string, isJSON: boolean = true) {
    this._path = path;
    this._isJSON = isJSON;
    if (!fs.existsSync(path)) {
      mkdirp.sync(path);
    }
  }

  createFile(fileName: string, data: string | Buffer): void {
    if (fs.existsSync(path.join(this._path, fileName))) {
      return;
    }

		this.writeFile(fileName, data);
  }

  deleteFile(fileName: string): void {
    const filePath = path.join(this._path, fileName);
    if (!fs.existsSync(filePath)) {
      return;
    }

    fs.unlink(filePath);
  }

  getAllData(): Array<string> {
    return fs.readdirSync(this._path)
      .filter(fileName => fileName.endsWith('.json'))
      .map(
        fileName => fs.readFileSync(
          path.join(this._path, fileName),
          'utf8',
        ),
      );
  }

  getFile(fileName: string): ?string {
    const filePath = path.join(this._path, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath, 'utf8');
  }

  getFileBuffer(fileName: string): ?Buffer {
    const filePath = path.join(this._path, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  }


  hasFile(fileName: string): bool {
    const filePath = path.join(this._path, fileName);
    return fs.existsSync(filePath);
  }

  writeFile(fileName: string, data: string | Buffer): void {
		fs.writeFileSync(
      path.join(this._path, fileName),
      data,
    );
  }
}

export default FileManager;
