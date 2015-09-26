var io = require('socket.io-client');
var util = require('./utils');
var faker = require('faker');
var async = require('async');

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

var users = {
  'james': {
    'A': _app,
    'D': 'dev1',
    'U': 'james',
    'PW': 'password',
    'DT': {'name': 'James Jung', 'tel': '010-1111-2234'}
  },
  'john': {
    'A': _app,
    'D': 'dev1',
    'U': 'john',
    'PW': 'password',
    'DT': {'name': 'John Kim', 'tel': '010-1234-5678'}
  }
};

var channel = 'CH00001';

var globalServer = {};
var globalSocket = {};

var channelServer = {};
var channelSocket = {};

describe("Chat Server", function () {

  it('[1] 사용자 등록(수정) ', function (done) {

    async.parallel(
      [
        function (callback) { // # 1 users.james
          util.post(_host, _port, '/user/update', users.james, function (err, data) {
            if (data.status == 'ok') callback();
          });
        },
        function (callback) { // # 2 users.john
          util.post(_host, _port, '/user/update', users.john, function (err, data) {
            if (data.status == 'ok') callback();
          });
        }
      ],
      function (err, results) {
        if (!err) done();
      }
    );

  });


  it('[2] Global Socket 연결 ', function (done) {

    async.parallel(
      [
        function (callback) { // # 1 users.james
          util.get(_host, _port, '/node/' + _app + '/' + users.james.U, function (err, data) {
            globalServer['james'] = data;
            globalSocket['james'] = {};
            var query = 'A=' + users.james.A + '&U=' + users.james.U + '&D=' + users.james.D;
            globalSocket.james.io = io.connect(data.result.server.url + '/global?' + query, socketOptions);
            globalSocket.james.io.on('connect', function (data) {
              callback();
            });
          });
        },
        function (callback) { // # 2 users.john
          util.get(_host, _port, '/node/' + _app + '/' + users.john.U, function (err, data) {
            globalServer['john'] = data;
            globalSocket['john'] = {};
            var query = 'A=' + users.john.A + '&U=' + users.john.U + '&D=' + users.john.D;
            globalSocket.john.io = io.connect(data.result.server.url + '/global?' + query, socketOptions);
            globalSocket.john.io.on('connect', function (data) {
              callback();
            });
          });
        }
      ],
      function (err, results) {
        if (!err) done();
      }
    );

  });


  it('[3] Channel 생성 (james) ', function (done) {

    // james 가 채팅방에 입장한 후 john 을 추가 한다.
    util.get(_host, _port, '/node/' + _app + '/' + channel, function (err, data) {
      channelServer['james'] = data;
      channelSocket['james'] = {};

      var query = 'A=' + users.james.A + '&U=' + users.james.U + '&D=' + users.james.D + '&C=' + channel + '&S=' + data.result.server.name;
      channelSocket.james.io = io.connect(data.result.server.url + '/channel?' + query, socketOptions);

      channelSocket.james.io.on('message', function (data) {
        console.info(' ** MESSAGE ** ', data);
      });

      channelSocket.james.io.on('connect', function (data) {

        // channel 에 연결된 이후 john 을 추가 한다.
        channelSocket.james.io.emit('join', {U: 'john'}, function (result) {

          setTimeout(function () {
            channelSocket.james.io.emit('send', {'NM': 'message', 'DT': {'MG': faker.lorem.sentence()}});
            done();
          }, 1500);

        });

      });


    });


  });


  it('[9999]. Channel Socket 끊기 (james) ', function (done) {

    channelSocket.james.io.disconnect();

    setTimeout(function () {
      done();
    }, 800);

  });

  /*
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
   */

  it(' [종료] ', function (done) {

    globalSocket.james.io.disconnect();
    globalSocket.john.io.disconnect();

    setTimeout(function () {
      done();
    }, 1000);

  });

});