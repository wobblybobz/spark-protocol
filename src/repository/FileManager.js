// @flow

import fs from 'fs';
import path from 'path';

class FileManager {
  _path: string;
  _isJSON: boolean;

  constructor(path: string, isJSON: boolean = true) {
    this._path = path;
    this._isJSON = isJSON;
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
  }

  createFile(fileName: string, data: string): void {
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

  writeFile(fileName: string, data: string): void {
		fs.writeFileSync(
      path.join(this._path, fileName),
      data,
    );
  }
}

export default FileManager;
