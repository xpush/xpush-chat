var ps = require('ps-node');

var envType = process.env.X_TYPE; // SESSION, CHANNEL
var envPid = process.env.X_PID;// Process Id
var envPath = process.env.X_PATH; // home dir path
var envPort = process.env.X_PORT;

console.log('XMON:['+envType+']['+envPid+']['+envPath+']['+envPort+']');

function exit() {
  process.exit(0);
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);

var checkProcess = function () {

  // A simple pid lookup
  ps.lookup({pid: envPid}, function (err, resultList) {

    console.info(err, resultList);

    if (err) {
      throw new Error(err);
    }

    var process = resultList[0];

    if (process) {

      console.log('PID: %s, COMMAND: %s, ARGUMENTS: %s', process.pid, process.command, process.arguments);
      setTimeout(checkProcess, 100);

    } else {

      console.log('No such process found!');
      console.log('DO SOMETHING AFTER SHUTDOWN.');

    }

  });

};

var pid = require('./pid').create(envPath + '/XPUSH.' + envType + '.' + envPort + '.pid');
pid.removeOnExit();

checkProcess();