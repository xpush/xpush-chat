var io = require('socket.io-client');
var util = require('../test/utils');
var faker = require('faker');
var async = require('async');


var device = process.argv[2] || 'dev1';

var address = '127.0.0.1:8888';


var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

var _app = 'LINK:STALK_IO';

var _channel = 'channel_12345';

var user = {
  'A': _app,
  'D': device,
  'U': 'james',
  'PW': 'password',
  'DT': {'name': 'James Jung', 'tel': '010-1234-5678'}
};

var GLOBAL_SOCKET;
var CHANNEL_SOCKET;

var isGlobalConnected = false;
var isChannelConnected = false;

async.series([

  function (callback) { // 사용자 정보 UPDATE

    util.post(_host, _port, '/user/update', user, function (err, data) {

      if (data.status == 'ok') {
        callback(null, data);
      } else {

        util.post(_host, _port, '/user/register', user, function (err, data) {
          if (data.status == 'ok') {
            callback(null, data);
          } else {
            callback(data.status, data.message);
          }
        });

      }
    });

  },
  function (callback) { // Global Socket 연결
    util.get(_host, _port, '/node/' + _app + '/' + user.U, function (err, data) {
      var query = 'A=' + user.A + '&U=' + user.U + '&D=' + user.D;
      GLOBAL_SOCKET = io.connect(data.result.server.url + '/global?' + query, util.socketOptions);
      GLOBAL_SOCKET.on('connect', function (data) {
        console.log('Glocal Socket 연결 ! ');
        if (!isGlobalConnected) { // 재연결 되는 경우를 고려함 !
          isGlobalConnected = true;
          callback(null);
        }
      });
    });
  },
  function (callback) {

    GLOBAL_SOCKET.emit('channel.create', {U: 'james', C: _channel, DT: {text: 'ABCDE'}}, function (result, data) {

      util.get(_host, _port, '/node/' + _app + '/' + _channel, function (err, data) {

        var query = 'A=' + user.A + '&U=' + user.U + '&D=' + user.D + '&C=' + _channel + '&S=' + data.result.server.name;
        CHANNEL_SOCKET = io.connect(data.result.server.url + '/channel?' + query, util.socketOptions);

        CHANNEL_SOCKET.on('message', function (data) {
          console.info(' ** MESSAGE ** ', data);
        });

        CHANNEL_SOCKET.on('connect', function (data) {

          setTimeout(function () {
            CHANNEL_SOCKET.emit('send', {'NM': 'message', 'DT': {'NO': 1, 'MG': faker.lorem.sentence()}});
            CHANNEL_SOCKET.emit('send', {'NM': 'message', 'DT': {'NO': 2, 'MG': faker.lorem.sentence()}});
            CHANNEL_SOCKET.emit('send', {'NM': 'message', 'DT': {'NO': 3, 'MG': faker.lorem.sentence()}});
            CHANNEL_SOCKET.emit('send', {'NM': 'message', 'DT': {'NO': 4, 'MG': faker.lorem.sentence()}});

            if (!isChannelConnected) { // 재연결 되는 경우를 고려함 !
              isChannelConnected = true;
              callback(null);
            }

          }, 1500);

        });

      });
    });

  },
  function (callback) {
    CHANNEL_SOCKET.emit('channel.join', {U: 'john'}, function (result) {
      console.log(result);
      callback(null, result);
    });
  }
], function (err, results) {

  console.log(err, results);

});
