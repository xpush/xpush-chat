var crypto = require('crypto');
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
    cp.exec('taskkill /PID ' + process.pid + ' /T /F', function (error, stdout, stderr) {
      // console.log('stdout: ' + stdout);
      // console.log('stderr: ' + stderr);
      // if(error !== null) {
      //      console.log('exec error: ' + error);
      // }
    });
  } else {
    var callback = callback || function () {
      };
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

exports.cloneObject = function (obj) {
  var clonedObjectsArray = [];
  var originalObjectsArray = []; //used to remove the unique ids when finished
  var next_objid = 0;

  function objectId(obj) {
    if (obj == null) return null;
    if (obj.__obj_id == undefined) {
      obj.__obj_id = next_objid++;
      originalObjectsArray[obj.__obj_id] = obj;
    }
    return obj.__obj_id;
  }

  function cloneRecursive(obj) {
    if (null == obj || typeof obj == "string" || typeof obj == "number" || typeof obj == "boolean") return obj;

    // Handle Date
    if (obj instanceof Date) {
      var copy = new Date();
      copy.setTime(obj.getTime());
      return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
      var copy = [];
      for (var i = 0; i < obj.length; ++i) {
        copy[i] = cloneRecursive(obj[i]);
      }
      return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
      if (clonedObjectsArray[objectId(obj)] != undefined)
        return clonedObjectsArray[objectId(obj)];

      var copy;
      if (obj instanceof Function)//Handle Function
        copy = function () {
          return obj.apply(this, arguments);
        };
      else
        copy = {};

      clonedObjectsArray[objectId(obj)] = copy;

      for (var attr in obj)
        if (attr != "__obj_id" && obj.hasOwnProperty(attr))
          copy[attr] = cloneRecursive(obj[attr]);

      return copy;
    }


    throw new Error("Unable to copy obj! Its type isn't supported.");
  }

  var cloneObj = cloneRecursive(obj);


  //remove the unique ids
  for (var i = 0; i < originalObjectsArray.length; i++) {
    delete originalObjectsArray[i].__obj_id;
  }

  return cloneObj;
};
