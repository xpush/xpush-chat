var crypto = require("crypto");
var restify = require('restify');
var psTree = require('ps-tree');


exports.encrypto = function (s, t) {
  if (!t) t = "sha256";
  var _c = crypto.createHash(t);
  _c.update(s, "utf8"); //utf8 here
  return _c.digest("base64");
};

exports.sendErr = function (response, err) {
  response.send({status: 'ERR-INTERNAL', message: err});
};

exports.validEmptyParams = function (req, paramArray) {

  for (var i in paramArray) {
    if (!req.params[paramArray[i]]) {
      return new restify.InvalidArgumentError('[' + paramArray[i] + '] must be supplied');
    }
  }

  return false;
};

exports.setHttpProtocal = function (_url) {
  if (!/^http:\/\//.test(_url) && !/^https:\/\//.test(_url)) {
    return 'http://' + _url;
  }
};


exports.killProcess = function (pid, signal, callback) {

  var isWin = /^win/.test(process.platform);
  if (isWin) {
    var cp = require('child_process');

    // 윈도우 시스템의 경우 !
    // /T (terminates all the sub processes)
    // /F (forcefully terminating)
    cp.exec('taskkill /PID ' + processing.pid + ' /T /F', function (error, stdout, stderr) {
      // console.log('stdout: ' + stdout);
      // console.log('stderr: ' + stderr);
      // if(error !== null) {
      //      console.log('exec error: ' + error);
      // }
    });
  } else {
    var callback = callback || function () {};
    var signal = signal || 'SIGKILL';
    var killTree = true; // 주의 !!! 관련 프로세스를 죽이지 말아야 하는 경우는, Session 이나 Channel 서버임 !! 고려할 것 !
    if (killTree) {
      psTree(pid, function (err, children) {
        [pid].concat(
          children.map(function (p) {
            return p.PID;
          })
        ).forEach(function (tpid) {
            try {
              process.kill(tpid, signal)
            }
            catch (ex) {
            }
          });
        callback();
      });
    } else {
      try {
        process.kill(pid, signal)
      }
      catch (ex) {
      }
      callback();
    }
  }
};
