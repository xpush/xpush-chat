var crypto = require("crypto");
var restify = require('restify');


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