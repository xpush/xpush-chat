var http = require('http');

exports.get = function (host, port, path, cb) {

  var optionsget = {
    host: host,
    port: port,
    path: path,
    method: 'GET'
  };

  var reqGet = http.request(optionsget, function (res) {
    var result = "";
    res.on('data', function (chunk) {
      result += chunk;
    });

    res.on('end', function () {
      cb(null, JSON.parse(result));
    });
  });

  reqGet.end();
  reqGet.on('error', function (e) {
    console.error(e);
  });

};