var io = require('socket.io-client');
var util = require('./utils');
var faker = require('faker');

/************************
 로컬의 8000 포트의 Session 서버를 통해서 100개의 Channel 을 연결하고 메시지를 보내기
 USAGE : node stressTest.js 127.0.0.1:8000 100
 *************************/

var address = process.argv[2] || '127.0.0.1:8888';

var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

var _app = 'APP_TEST';

var socketOptions = {
  transsessionPorts: ['websocket'],
  'force new connection': true
};

var getQueryChannel = function (_channel, _user, _server, _data) {

  var query = 'A=' + _app + '&' +
    'C=' + _channel + '&' +
    'U=' + _user.replace(/\./g, '') + '&' +
    'D=' + 'D';

  if (_server) query = query + '&S=' + _server;
  if (_data) query = query + '&DT=' + _data;

  return query;

};

var getQueryGlobal = function (_user) {

  var query = 'A=' + _app + '&' +
    'U=' + _user.replace(/\./g, '') + '&' +
    'D=' + 'D';

  return query;

};


var servers = {};

var globalSocket = {};

var channelSocket = {};

describe("Chat Server", function () {

  it('1-1. (james) Connecting GLOBAL SOCKET', function (done) {

    var username = 'james';

    util.get(_host, _port, '/node/' + _app + '/' + username, function (err, data) {

      globalSocket['james'] = {};

      servers['james'] = data; // james 가 접속한 서버 정보

      var query = getQueryGlobal(username);
      globalSocket.james.io = io.connect(data.result.server.url + '/global?' + query, socketOptions);

      globalSocket.james.io.on('connect', function (data) {
        done();
      });
    });

  });

  it('1-2. (james) Connecting CHANNEL SOCKET', function (done) {

    var channel = 'CH1';
    var username = 'james';
    channelSocket['james'] = {};

    var query = getQueryChannel(channel, username, servers['james'].result.server.name);
    var url = servers['james'].result.server.url + '/channel?' + query;
    console.log(url);
    channelSocket.james.io = io.connect(url, socketOptions);

    channelSocket.james.io.on('connect', function (data) {
      channelSocket.james.io.emit('send', {'NM': 'message', 'DT': {'MG': faker.lorem.sentence()}});
      //setInterval(function () {}, 1000);
      done();

    });


  });

  it('2-1. (john) Connecting CHANNEL SOCKET', function (done) {

    var username = 'john';

    util.get(_host, _port, '/node/' + _app + '/' + username, function (err, data) {

      globalSocket['john'] = {};

      servers['john'] = data; // john 이 접속한 서버 정보

      var query = getQueryGlobal(username);
      globalSocket.john.io = io.connect(data.result.server.url + '/global?' + query, socketOptions);

      globalSocket.john.io.on('connect', function (data) {
        done();
      });
    });

  });

  it('2-2. (john) Connecting CHANNEL SOCKET', function (done) {

    var channel = 'CH1';
    var username = 'john';
    channelSocket['john'] = {};

    var query = getQueryChannel(channel, username, servers['john'].result.server.name);
    var url = servers['john'].result.server.url + '/channel?' + query;
    console.log(url);
    channelSocket.john.io = io.connect(url, socketOptions);

    channelSocket.john.io.on('connect', function (data) {
      channelSocket.john.io.emit('send', {'NM': 'message', 'DT': {'MG': faker.lorem.sentence()}});
      //setInterval(function () {}, 1000);
      done();

    });


  });


});