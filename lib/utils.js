var crypto = require('crypto');
var restify = require('restify');
var fs = require('fs');

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

exports.getBaseDirPath = function (home) {

  var homePath = home || process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] + '/.xpush';

  try {
    if (!fs.existsSync(homePath)) fs.mkdirSync(homePath, parseInt('0766', 8));
  } catch (e) {
    console.log('Error creating xpush directory: ' + e);
  }

  return homePath;
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
