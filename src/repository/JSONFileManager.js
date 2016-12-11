// @flow

import FileManager from './FileManager';

class JSONFileManager extends FileManager {
  _path: string;

  createFile<TModel>(fileName: string, model: TModel): void {
    super.writeFile(fileName, JSON.stringify(model, null, 2));
  }

  getAllData<TModel>(): Array<TModel> {
    return super.getAllData().map(data => JSON.parse(data));
  }

  getFile<TModel>(fileName: string): ?TModel {
    const data = super.getFile(fileName);
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  writeFile<TModel>(fileName: string, model: TModel): void {
		return super.writeFile(fileName, JSON.stringify(model, null, 2));
  }
}

export default JSONFileManager;
