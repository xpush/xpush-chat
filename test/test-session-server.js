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

describe("Chat Server", function () {

  /* Test 1 - A Single User */
  it('Should broadcast new user once they connect', function (done) {

    var app = 'APP_TEST';
    var channel = 'CHANNEL_TEST';
    var user = '1USER_TEST';

    util.get(_host, _port, '/node/' + app + '/' + channel, function (err, data) {

      console.log(data);

      var query =
          'A=' + app + '&' +
          'C=' + channel + '&' +
          'U=' + user.replace(/\./g, '') + '&' +
          'D=DEVAPP&' +
          'S=' + data.result.server.name + '&' +
          'DT={"user":"' + user + '"}'
        ;

      var socketOptions = {
        transsessionPorts: ['websocket']
        , 'force new connection': true
      };


      console.log(data.result.server.url);
      var channelSocket = io.connect(data.result.server.url + '/channel?' + query, socketOptions);

      channelSocket.on('connect', function (data) {

        setInterval(function () {
          channelSocket.emit('send', {'NM': 'message', 'DT': {'MG': faker.lorem.sentence()}});
        }, 1000);
        done();
        //channelSocket.emit('send2', {'NM':'message', 'DT': { 'MG' : faker.lorem.sentence() } });

      });


    });


  });

});