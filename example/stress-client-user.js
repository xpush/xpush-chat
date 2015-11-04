var io = require('../node_modules/socket.io-client'),
  utils = require('../test/utils'),
  faker = require('faker');

/************************
 로컬의 8888 포트의 Session 서버를 통해서 100개의 Channel 을 연결하고 메시지를 보내기
 USAGE : node stress-client-user.js 127.0.0.1:8000 10 10
 *************************/

var address = process.argv[2];        // session 서버 주소
var count = process.argv[3] || 1;   // Client 쓰레드 수(Optional)
var maxChannel = process.argv[4] || 10;  // Client 가 연결하는 Channel 수 (Optional)

var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

var count_connected = 1;
var count_error = 1;
var count_disconnected = 1;

var run = function () {


  var app = 'LINK:STALK_IO';
  var channel = "CHANNEL_" + faker.random.number(parseInt(maxChannel));
  var userId = faker.internet.userName();

  console.log('CHANNEL : ', address + '/node/' + app + '/' + channel);

  utils.get(_host, _port, '/node/' + app + '/' + channel, function (err, data) {

    if (err) {
      console.error(err);
      return;
    }

    var query =
      'A=' + app + '&' +
      'U=' + userId + '&' +
      'D=' + '_' + '&' +
      'C=' + channel + '&' +
      'DT={"user":"' + userId + '"}&' +
      'S=' + data.result.server.name;

    var channelSocket = io.connect(data.result.server.url + '/channel?' + query, utils.socketOptions);

    channelSocket.on('connect', function () {

      console.log(count_connected + '. connected');
      count_connected = count_connected + 1;

      channelSocket.emit('channel.join', {U: 'john'}, function (err) {

        if (err) {
          console.error(err)
        } else {
          setInterval(function () {
            channelSocket.emit('send', {'NM': 'message', 'DT': {'MG': faker.lorem.sentence()}});
          }, 1500);
        }

      });

    });

    channelSocket.on('message', function (data) {
      console.log(data);
    });

    channelSocket.on('error', function (data) {
      console.error(count_error + " " + data);
      count_error = count_error + 1;
    });

    channelSocket.on('disconnect', function () {
      console.log(count_disconnected + '. disconnected');
      count_disconnected = count_disconnected + 1;
    });

  });

};

for (var a = 0; a < count; a++) {
  run();
}