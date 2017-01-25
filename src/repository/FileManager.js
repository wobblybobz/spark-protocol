// @flow

import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';

class FileManager {
  _dirPath: string;
  _isJSON: boolean;

  constructor(dirPath: string, isJSON: boolean = true) {
    this._dirPath = dirPath;
    this._isJSON = isJSON;
    if (!fs.existsSync(dirPath)) {
      mkdirp.sync(dirPath);
    }
  }

  createFile(fileName: string, data: string | Buffer) {
    if (fs.existsSync(path.join(this._dirPath, fileName))) {
      return;
    }

    this.writeFile(fileName, data);
  }

  deleteFile(fileName: string) {
    const filePath = path.join(this._dirPath, fileName);
    if (!fs.existsSync(filePath)) {
      return;
    }

    fs.unlink(filePath);
  }

  getAllData(): Array<string> {
    return fs.readdirSync(this._dirPath)
      .filter((fileName: string): boolean => fileName.endsWith('.json'))
      .map(
        (fileName: string): string => fs.readFileSync(
          path.join(this._dirPath, fileName),
          'utf8',
        ),
      );
  }

  getFile(fileName: string): ?string {
    const filePath = path.join(this._dirPath, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath, 'utf8');
  }

  getFileBuffer(fileName: string): ?Buffer {
    const filePath = path.join(this._dirPath, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  }


  hasFile(fileName: string): boolean {
    const filePath = path.join(this._dirPath, fileName);
    return fs.existsSync(filePath);
  }

  writeFile(fileName: string, data: string | Buffer) {
    fs.writeFileSync(
      path.join(this._dirPath, fileName),
      data,
    );
  }
}

export default FileManager;
