var utils = require('./../utils');

var envType = process.env.X_TYPE; // SESSION, CHANNEL
var envPid = process.env.X_PID;   // Process Id
var envPath = process.env.X_PATH; // home dir path
var envPort = process.env.X_PORT;

var pidFilePath = utils.getPidFilePath(envPath, envType, envPort);

console.log('MONITOR:[' + envType + '][' + envPid + '][' + envPath + '][' + envPort + ']');

function exit() {
  process.exit(0);
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);

var debug = function () {
  console.log('DEBUG!');
};

var checkProcess = function () {


  var isRunning = utils.checkProcess(envPid);

  console.log('isRunning : ' + isRunning);

  if (isRunning) {

    console.info('PID: %s, TYPE: %s, PORT: %s', envPid, envType, envPort);

    setTimeout(checkProcess, 500);

  } else {

    console.info('DO SOMETHING AFTER SHUTDOWN.');
    setTimeout(debug, 3000);

  }

};

var pid = require('./../pid').create(pidFilePath);
pid.removeOnExit();

checkProcess();
