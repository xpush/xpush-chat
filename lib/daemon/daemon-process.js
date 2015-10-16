var utils = require('./../utils');

var envType = process.env.X_TYPE; // SESSION, CHANNEL
var envPid = process.env.X_PID;   // Process Id
var envPath = process.env.X_PATH; // home dir path
var envPort = process.env.X_PORT

var started = false;

console.log('MONITOR:[' + envType + '][' + envPid + '][' + envPath + '][' + envPort + ']');

function exit() {
  process.exit(0);
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
process.on('message', function (data) {

  // TODO data 는 어떻게 활용 할 것인가 ?

  if (!started) {
    started = true;
    checkProcess();
  }
});

var debug = function () {
  console.log('DEBUG!');
};

var checkProcess = function () {


  var isRunning = utils.checkProcess(envPid);

  if (isRunning) {

    console.info('PID: %s, TYPE: %s, PORT: %s', envPid, envType, envPort);

    setTimeout(checkProcess, 500);

  } else {

    console.info('DO SOMETHING AFTER SHUTDOWN.');
    setTimeout(debug, 100000);

  }

};

var pid = require('./../pid').create(envPath + '/XPUSH.' + envType + '.' + envPort + '.pid');
pid.removeOnExit();

checkProcess();
