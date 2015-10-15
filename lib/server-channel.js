var xpush = require('xpush');

var mongoPersister = require('./persister/mongodb/persister');
var utils = require('./utils');

var CONS = require('./constants');

var ChannelServer = exports.ChannelServer = function (options, cb) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  this.globalSocketIds = {};
  this.users = {}; // 현재 접속한 사용자 목록
  this.channels = {};
  this.serverName; // 서버 번호

  this.server = xpush.createChannelServer(options);
  this.redisClient = this.server.sessionManager.redisClient;

  var self = this;

  this.server.onConnection(function (socket) {

    var _query = socket.handshake.query;

    if (typeof _query.D == 'undefined') socket.handshake.query.D = '_';

    /**
     * Channel을 생성한 후, 생성한 정보를 callback으로 넘겨준다.
     * @name channel-create
     * @event입
     * @param {object} params - JSON 형태의 data ( U, 없으면 접속자 정보로 자동 기 )
     * @param {callback} callback - Channel 정보를 callback으로 넘겨준다.
     */
    socket.on('channel.create', function (params, callback) {

      if (!params.U || params.U.length === 0) {
        params.U = _query.U;
      }

      // MongoDB에 저장
      mongoPersister.createChannel({
        A: _query.A,
        C: _query.C, // optional (can auto-generate !)
        U: params.U,
        DT: params.DT
      }, function (err, data) {

        if (err) {

          if (callback) {
            if (err == 'ERR-EXISTED') {
              // 채널이 존재할 경우 Warning 메시지를 return함
              callback({
                status: 'WARN-EXISTED',
                message: '[' + params.C + '] channel is alread existed'
              });
            } else {
              callback({
                status: 'ERR-INTERNAL',
                message: err
              });
            }
          }
        } else {
          /*
           // Redis에서 Channel Server 정보를 찾은 후, 각 서버에 publish 한다. @TODO check the comment
           self.server.sessionManager.retrieve(_query.A, data.C, function (res) {
           for (var key in res) {
           self.server.sessionManager.publish(
           key, {
           _type: 'createChannel',
           A: _query.A,
           C: params.C,
           US: data.US
           });
           }
           });

           // @TODO !!
           //self.channels[data.app+'^'+data.channel] = data.users;
           */
          if (callback) callback({
            status: 'ok',
            result: data
          });

        }
      });
    });


    /**
     * channel 참여한다.(or 참여 시킨다)
     * @name join
     * @event
     * @param {params} : U
     *        {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('channel.join', function (params, callback) {

      if (!params.U || params.U.length === 0) {
        callback({
          status: 'ERR-PARAM',
          message: '[channel.join] U(user id) parameter is mandatory !.'
        });
        return;
      }

      mongoPersister.addChannelUser({
        A: _query.A,
        C: _query.C,
        U: params.U
      }, function (err, data) {
        console.log(err, data);
      });

      if (callback) callback();

    });

    /**
     * Channel list를 조회한 후, array를 callback으로 넘겨준다.
     * @name channel-list
     * @event
     * @param {callback} callback - Channel arary를 callback으로 넘겨준다.
     */
    socket.on('channel.list', function (callback) {

      mongoPersister.listChannel({
        A: _query.A,
        U: _query.U
      }, function (err, channels) {
        if (err) {
          console.error(err);
          if (callback) callback({
            status: 'error',
            message: err
          });

        } else {
          if (callback) callback({
            status: 'ok',
            result: channels
          });
        }
      });
    });

    // 채널에서 나가기 ! (params 가 필요 없음)
    socket.on('channel.leave', function (params, callback) {

      // Channel내의 user array에서 현재 user를 뺀다.
      // @ TODO device 와 상관 없이 Channel 에서 모두 삭제 해야 함 (Channel 에는 Device 정보 가지고 있지 않도록 했음)
      mongoPersister.exitChannel({
        A: _query.A,
        C: _query.C,
        U: _query.U
      }, function (err, channels) {
        if (err) {
          if (callback) callback({
            status: 'ERR-INTERNAL',
            message: err
          });

        } else {

          /*
           // Channel 정보를 조회 후, 다른 서버에 채널 정보가 변경되었음을 알려준다.  @TODO check the comment
           self.server.sessionManager.retrieve(socket.handshake.query.A, params.C, function (res) {
           for (var key in res) {
           self.server.sessionManager.publish(
           key, {
           _type: 'exitChannelUser',
           A: socket.handshake.query.A,
           C: params.C,
           U: socket.handshake.query.U
           });
           }
           }); */

          if (callback) callback({
            status: 'ok',
            result: channels
          });
        }
      });

    });


    // add customized socket events
    socket.on('sessionCount', function (callback) {
      self.server.getSessionCount(socket, function (err, data) {
        // @ TODO 에러 처리 필요.
        callback({
          status: 'ok',
          result: data
        });

      });
    });

    // Messsage unread
    socket.on('message.unread', function (data, callback) {
      mongoPersister.getMessages({
        A: socket.handshake.query.A,
        C: socket.handshake.query.C,
        TS: data.TS
      }, function (err, data) {
        if (err) {
          console.error(err);
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

  });

  // this.server.onSend(function (socket) { });

  // 메시지 보내고 난 후 이벤트
  this.server.on('message', function (data) {

    var _socketIds = self.server.io.of('/channel').adapter.rooms[data.A + '^' + data.C];

    var _channelUsers = self.channels[data.A + '^' + data.C];
    var _absentUsers = utils.cloneObject(_channelUsers);

    if (_socketIds) {
      for (var id in _socketIds) {

        var _temp = self.server.io.of('/channel').connected[id];
        var _user = self.users[data.A + '^' + _temp._userId];

        if (!_user) { // 지금 채널서버에 사용자가 없다면 -> Global Socket 또는 GCM ?
          self.redisClient.hgetall(data.A + ':' + _temp._userId, function (err, res) {

            if (err) {
              console.error(err);
            } else {
              var items = [];
              for (var _i in res) {
                items.push(JSON.parse(res[_i]));
              }
            }
          });

        } else {
          var _ii = _absentUsers.indexOf(_temp._userId);
          _absentUsers.splice(_ii, 1);
        }

      }
    }

    // Global Socket 이 있는지 확인해서 전송
    _absentUsers.forEach(function (user) {
      // @ TODO !!!
      console.log(user);
    });


    // data storage 에 저장.
    mongoPersister.storeMessage({
      A: data.A,
      C: data.C,
      NM: data.name,
      US: _channelUsers,
      DT: data.data,
      // US: _users,// @ TODO 삭제할 필요 있음 // 체널별로 메시지를 저장하는 것이 좋겠음 !! 나중에 TS 로 가져올 것 !!
      TS: data.TS
    }, function (err) {
      if (err) {
        console.log(err);
      }
    });
  });

  // 체널 정보 수정시 (연결 / 종료)
  this.server.on('channel', function (data) {

    console.log('[EVENT] CHANNEL', data);

    if (data.event == 'connect') { // Channel 에 연결된 경우

      // LOCAL user 정보 설정
      var _existedUser = self.users[data.A + '^' + data.U];
      if (!_existedUser) {
        mongoPersister.retrieveUser({A: data.A, U: data.U}, function (err, result) {

          if (err) console.error(err);

          self.users[data.A + '^' + data.U] = {};

          result.forEach(function (user) {

            for (var device in user.DS) {  // CF. user.DS[device] --> { N: null }
              if (data.D == device) {
                self.users[data.A + '^' + data.U][device] = true;
              } else {
                self.users[data.A + '^' + data.U][device] = false;
              }
            }

          });

        });
      } else {
        self.users[data.A + '^' + data.U][data.D] = true;
      }

      //var _existedChannel = self.channels[data.A + '^' + data.C];
      mongoPersister.getChannel({A: data.A, C: data.C}, function (err, result) {
        if (err) {
          console.error(err);
        } else {
          if (result.US && result.US.length > 0) {
            var _uArray = [];
            result.US.forEach(function (user) {
              _uArray.push(user.U);
            });
            self.channels[data.A + '^' + data.C] = _uArray;
          }
        }

      });
    } else if (data.event == 'disconnect') { // Channel 이 종료된 경우

      var _existedUser = self.users[data.A + '^' + data.U];
      if (_existedUser) self.users[data.A + '^' + data.U][data.D] = false;
      delete self.channels[data.A + '^' + data.C];

    }

  });

  // SUBSCRUBE events (on REDIS)
  this.server.on('subscribe', function (receivedData) {

    if (receivedData._type == 'exitChannelUser') {

      var tmpChannels = self.channels[receivedData.A + '^' + receivedData.C];

      for (var j = 0; j < tmpChannels.length; j++) {
        if (tmpChannels[j] == receivedData.U) {
          tmpChannels.splice(j, 1);
          j--;
        }
      }
    }

  });


  this.server.on('started', function (url, port) {

    self.serverName = self.server.getServerName();

    /*************************************************************************
     * GLOBAL SOCKET
     *************************************************************************/

    self.server.io.of('/global').use(function (socket, callback) {

      // TODO 파라미터 검사 및 인증 !!

      callback(null, true);

    }).on('connection', function (socket) {

      var _A_ = socket.handshake.query.A; // application
      var _U_ = socket.handshake.query.U; // user id
      var _D_ = socket.handshake.query.D; // device id

      var _uKey = _A_ + '^' + _U_ + '^' + _D_;

      mongoPersister.retrieveUser({A: _A_, U: _U_}, function (err, result) {

        if (err) console.error(err);

        result.forEach(function (user) {

          for (var device in user.DS) {  // CF. user.DS[device] --> { N: null }
            if (_D_ == device) { // 실제 접속한 Client Device
              self.redisClient.hset(_A_ + ':' + _U_, _D_, self.serverName);
            } else {
              self.redisClient.hsetnx(_A_ + ':' + _U_, _D_, -1);
            }
          }

        });

        self.redisClient.hincrby(_A_, _U_ + '^' + self.serverName, 1, function (err, count) {
          console.log('---------------------------> ' + err, count);
          self.redisClient.hset(CONS.R_GLOBALSOCKET + ':' + serverName, _U_ + ':' + _D_, count);
        });

      });

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

        delete self.globalSocketIds[_uKey];

        self.redisClient.hset(_A_ + ':' + _U_, _D_, -1);
        self.redisClient.hincrby(_A_, _U_ + '^' + self.serverName, -1, function (err, count) {
          console.log('---------------------------> ' + err, count);

          if (err) {
            console.error(err);
          } else {
            if (count <= 0) {
              self.redisClient.hdel(_A_, _U_);
              self.redisClient.hdet(CONS.R_GLOBALSOCKET + ':' + serverName, _U_ + ':' + _D_);
            }
          }

        });

      });

      // Messsage unread for session
      socket.on('message.unread', function (data, callback) {
        if (data && !callback) {
          callback = data;
          data = {};
        }

        mongoPersister.getMessages({
          A: socket.handshake.query.A,
          TS: data.TS
        }, function (err, data) {
          if (err) {
            console.log(err);
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
    });

    console.log(' >>>>>> Channel SERVER is started ' + url + ':' + port);
  });

};
