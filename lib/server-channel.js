var xpush = require('xpush');
var mongoPersister = require('./mongodb-persister/mongoPersister');

ChannelServer = exports.ChannelServer = function (options, cb) {


  // GLOBAL SOCKET IDs.
  this.globalSocketIds = {};

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self = this;

  this.server = xpush.createChannelServer(options);

  // Customizing connection events
  this.server.onConnection(function (socket) {

    var _query = socket.handshake.query;

    console.log('CONNECTION - ' + _query.A + " : " + _query.C + " : " + _query.U);

    /**
     * channel 참여한다.
     * @name join
     * @event
     * @param {params} : U, DT
     *        {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('join', function (params, callback) {

      mongoPersister.addChannelUser({
        A: _query.A,
        C: _query.C,
        U: params.U,
        DT: params.DT
      }, function (err, datas) {
        console.log("====join", arguments);
        if (err) {
          if (callback) callback({status: 'ERR-INTERNAL', message: err});
        }

        for (var x = 0; x < datas.length; x++) {
          self.server.channels[_query.A + '^' + _query.C].push({
            U: datas[x].U,
            D: datas[x].D,
            N: datas[x].N
          });
        }

        if (callback) callback({
          status: 'ok'
        });

      });

    });

    /**
     * 현재 channel의 unread message를 조회한다.
     * @name message-unread
     * @event
     * @param {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('message-unread', function (callback) {
      mongoPersister.unReadMessages({
        A: _query.A,
        C: _query.C,
        U: _query.U,
        D: _query.D
      }, function (err, data) {
        if (err) {
          if (callback) callback({status: 'ERR-INTERNAL', message: err});
          return;
        } else {
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      });
    });

    /**
     * 현재 channel의 unread message를 삭제한다.
     * @name message-received
     * @event
     * @param {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('message-received', function (callback) {
      mongoPersister.removeUnReadMessages({
        A: _query.A,
        C: _query.C,
        U: _query.U,
        D: _query.D
      }, function (err, data) {
        if (err) {
          if (callback) callback({status: 'ERR-INTERNAL', message: err});
          return;
        } else {
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      });
    });

    // add customized socket events
    socket.on('sessionCount', function (callback) {
      server.getSessionCount(socket, function (err, data) {

        callback({
          status: 'ok',
          result: data
        });

      });
    });

  });

  this.server.onSend(function (socket) {

    var _uKey = socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D;

    console.log('<' + _uKey + ">");


    var _socketIds = self.server.io.of('/channel').adapter.rooms[_room];
    if (_socketIds) {
      for (var id in _socketIds) {
        console.log(self.server.io.of('/channel').connected[id]);
      }
    }

    /*
    var _socketId = self.globalSocketIds[_uKey];
    if (_socketId) {
      var _socket = self.server.io.of('/global').connected[_socketId];
      if (_socket && _socket.id != undefined) {

      }
    }
    */


  });

  this.server.on('started', function (url, port) {

    /*************************************************************************
     * GLOBAL SOCKET
     *************************************************************************/

    self.server.io.of('/global').use(function (socket, callback) {

      // TODO 파라미터 검사 및 인증 !!

      callback(null, true);

    }).on('connection', function (socket) {

      var _uKey = socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D;

      /**
       * global socket의 중복여부를 체크한다. global socket의 ID는 application ID, User ID, device ID를 조합하여 생성한다.
       */
      var _socketId = self.globalSocketIds[_uKey];
      var _socket = self.server.io.of('/global').connected[_socketId];

      // 이미 존재하는 session 소켓이 있는 경우, 다른 브라우져에서 로그인을 하고 있는 상태이기 때문에, 해당 브라우져로 LOGOUT 이벤트를 발생시킨다.
      if (_socket && _socket.id != undefined) {

        _socket.emit('_event', {
          event: 'LOGOUT',
          A: socket.handshake.query.A,
          U: socket.handshake.query.U,
          D: socket.handshake.query.D
        });
        _socket.disconnect();

        delete self.globalSocketIds[_uKey];
      }

      // global socket id를 local storage에 저장한다.
      self.globalSocketIds[_uKey] = socket.id;

      socket.on('disconnect', function () {

        var _uKey = socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D;

        delete self.globalSocketIds[_uKey];
      });

    });

    console.log(' >>>>>> Channel SERVER is started ' + url + ':' + port);
  });


};