/*
*   Copyright (C) 2013-2014 Spark Labs, Inc. All rights reserved. -  https://www.spark.io/
*
*   This file is part of the Spark-protocol module
*
*   This program is free software: you can redistribute it and/or modify
*   it under the terms of the GNU General Public License version 3
*   as published by the Free Software Foundation.
*
*   Spark-protocol is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*   GNU General Public License for more details.
*
*   You should have received a copy of the GNU General Public License
*   along with Spark-protocol.  If not, see <http://www.gnu.org/licenses/>.
*
*   You can download the source here: https://github.com/spark/spark-protocol
*
* @flow
*
*/

import chalk from 'chalk';
import settings from '../lib/logger';

function _transform(...params: Array<any>): Array<any> {
  return params.map((param: any): string => {
    if (typeof param === 'string') {
      return param;
    }

    return JSON.stringify(param);
  });
}

class Logger {
  static log(...params: Array<any>) {
    if (settings.SHOW_VERBOSE_DEVICE_LOGS) {
      console.log(_transform(...params));
    }
  }

  static info(...params: Array<any>) {
    console.log(chalk.cyan(_transform(...params)));
  }

  static warn(...params: Array<any>) {
    console.warn(chalk.yellow(_transform(...params)));
  }

  static error(...params: Array<any>) {
    console.error(chalk.red(_transform(...params)));
  }
}
export default Logger;
