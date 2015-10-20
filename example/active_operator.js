var util = require('../test/utils');

var address = '127.0.0.1:8888';


var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

var _app = 'LINK:STALK_IO';


util.post(_host, _port, '/user/list/active', {A: _app}, function (err, data) {

  if (data.status == 'ok') {
    console.log(data);
  } else {
    console.error(data.status, data);
  }

});

