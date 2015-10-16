var path = require('path');
var utils = require('../utils');
var spawn = require('child_process').spawn;

exports.startDaemon = function (options) {

  var monitorFilePath = path.resolve(__dirname /*, '..', 'lib'*/) + '/daemon-process';

  console.log(process.execPath);
  console.log(monitorFilePath);

  var monitor = spawn(process.execPath, [monitorFilePath],
    {
      stdio: ['ipc', null, null],
      detached: true,
      env: {
        X_TYPE: 'CHANNEL',
        X_PID: process.pid,
        X_PATH: utils.getBaseDirPath(options['home']),
        X_PORT: options['port']
      }
    });

  monitor.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });

  monitor.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  monitor.on('close', function (code) {
    console.log('child process exited with code ' + code);
  });

  monitor.on('exit', function (code) {
    console.error('XPUSH Monitor died unexpectedly with exit code %d', code);
  });

  monitor.send(JSON.stringify(options));

  monitor.disconnect();
  //monitor.unref();

  return monitor;
};

