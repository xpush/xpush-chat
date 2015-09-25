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

var _app = 'app';

var socketOptions = {
  transsessionPorts: ['websocket'],
  'force new connection': true
};

var getQueryChannel = function (_channel, _user, _server, _data) {

  var query = 'A=' + _app + '&' +
    'C=' + _channel + '&' +
    'U=' + _user.replace(/\./g, '') + '&' +
    'D=' + 'dev1';

  if (_server) query = query + '&S=' + _server;
  if (_data) query = query + '&DT=' + _data;

  return query;

};

var getQueryGlobal = function (_user) {

  var query = 'A=' + _app + '&' +
    'U=' + _user.replace(/\./g, '') + '&' +
    'D=' + 'dev1';

  return query;

};

var users = {
  'james': {
    'A': _app,
    'D': 'dev1',
    'U': 'james',
    'PW': 'password'
  },
  'john': {
    'A': _app,
    'D': 'dev1',
    'U': 'john',
    'PW': 'password'
  }
};

var servers = {};

var globalSocket = {};

var channelSocket = {};

describe("Chat Server", function () {


  it('0-1. (james) Connecting GLOBAL SOCKET', function (done) {

    var param = users.james;
    param.DT = {'name': 'James Jung', 'tel': '010-1111-2234'};

    util.post(_host, _port, '/user/update', param, function (err, data) {

      console.error(err, data);

      if (data.status == 'ok') {
        done();
      }
    });

  });
  it('0-2. (john) ', function (done) {

    var param = users.john;
    param.DT = {'name': 'John Kim', 'tel': '010-1234-5678'};
    util.post(_host, _port, '/user/update', param, function (err, data) {
      if (data.status == 'ok') {
        done();
      }
    });

  });

  it('1-1. (james) ', function (done) {

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

    channelSocket.james.io.on('message', function (data) {
      console.info('(james)', data);
    });

    channelSocket.james.io.on('connect', function (data) {

      channelSocket.james.io.emit('join', {U: 'james'}, function (result) {
        setTimeout(function () {
          channelSocket.james.io.emit('send', {'NM': 'message', 'DT': {'MG': faker.lorem.sentence()}});
          done();
        }, 1500);
      });

    });


  });

  it('2-1. (john) Connecting GLOBAL SOCKET', function (done) {

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

    channelSocket.john.io = io.connect(url, socketOptions);

    channelSocket.john.io.on('message', function (data) {
      console.info('(john)', data);
    });

    channelSocket.john.io.on('connect', function (data) {

      channelSocket.john.io.emit('join', {U: 'john'}, function (result) {
        setTimeout(function () {
          channelSocket.john.io.emit('send', {'NM': 'message', 'DT': {'MG': faker.lorem.sentence()}});
          done();
        }, 1500);
      });
    });

  });


  it('3-1. (james) disconnect CHANNEL SOCKET', function (done) {

    channelSocket.james.io.disconnect();

    setTimeout(function () {
      done();
    }, 800);

  });


  it('4-1. (john) send message', function (done) {

    channelSocket.john.io.emit('send', {'NM': 'message', 'DT': {'NO': 1, 'MG': faker.lorem.sentence()}});
    channelSocket.john.io.emit('send', {'NM': 'message', 'DT': {'NO': 2, 'MG': faker.lorem.sentence()}});
    channelSocket.john.io.emit('send', {'NM': 'message', 'DT': {'NO': 3, 'MG': faker.lorem.sentence()}});
    channelSocket.john.io.emit('send', {'NM': 'message', 'DT': {'NO': 4, 'MG': faker.lorem.sentence()}});

    setTimeout(function () {
      channelSocket.john.io.disconnect();
      done();
    }, 800);

  });


  it('ending.. ', function (done) {

    globalSocket.james.io.disconnect();
    globalSocket.john.io.disconnect();

    setTimeout(function () {
      done();
    }, 1000);

  });

});