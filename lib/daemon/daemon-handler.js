var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var utils = require('../utils');

exports.startDaemon = function (options, callback) {

  var pidFilePath = utils.getPidFilePath(options['home'], 'CHANNEL', options['port']);

  if (fs.existsSync(pidFilePath)) {

    if (callback) callback('PID_EXISTED');

  } else {

    var monitorFilePath = path.resolve(__dirname) + '/daemon-process';

    var basePath = utils.getBaseDirPath(options['home']);
    var logFilePath = utils.getDaemonLogFilePath(options['home'], 'CHANNEL', options['port']);

    var
      out = fs.openSync(logFilePath, 'a'),
      err = fs.openSync(logFilePath, 'a');

    spawn(process.execPath, [monitorFilePath], {
      stdio: ['ignore', out, err],
      detached: true,
      env: {
        X_TYPE: 'CHANNEL',
        X_PID: process.pid,
        X_PATH: basePath,
        X_PORT: options['port']
      }
    }).unref();

    if (callback) callback(null);

  }

};

