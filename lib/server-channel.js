var xpush = require('xpush');

var mongoPersister = require('./persister/mongodb/persister');
var utils = require('./utils');

var CONS = require('./constants');

var Busboy = require('busboy');
var fs = require('fs');
var path = require('path');
var shortId = require('shortid');
var send = require('send');
var Gcm = require('./gcm').Gcm;

var ChannelServer = exports.ChannelServer = function (options, cb) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  this.globalSocketIds = {};
  this.users = {}; // 현재 접속한 사용자 목록

  this.serverName; // 서버 번호

  this.server = xpush.createChannelServer(options);
  this.redisClient = this.server.sessionManager.redisClient;
  this.gcmObject = {};

  // 내부의 채널 사용자를 가지고 있는 배열!
  this.channels = {};
  this.addUserToChannels = function (_a, _c, _u) {

    if (typeof _u == 'string') {
      var _user = this.channels[_a + '^' + _c];
      if (!_user) {
        this.channels[_a + '^' + _c] = [_u];
      } else {
        var _ii = _user.indexOf(_u);
        if (_ii == -1) {
          this.channels[_a + '^' + _c].push(_u);
        }
      }
    } else {
      for( var inx = 0; inx < _u.length ; inx++ ){ 
        this.addUserToChannels(_a, _c, _u[inx]);
      }
    }
  };

  this.removeUserFromChannels = function (_a, _c, _u) {
    if (typeof _u == 'string') {
      var _user = this.channels[_a + '^' + _c];
      if (_user && _user.length > 0 ) {
        var _ii = _user.indexOf(_u);
        if (_ii > -1) {
          this.channels[_a + '^' + _c].splice(_ii, 1);
        }
      }
    } else {
      for( var inx = 0; inx < _u.length ; inx++ ){ 
        this.removeUserFromChannels(_a, _c, _u[inx]);
      }      
    }
  };

  var self = this;

  for (var key in options.apps) {
    var appId = options.apps[key].id;
    var gcmApiKey = options.apps[key].notification.gcm.apiKey;

    // Server config에 Gcm Server key 가 있으면, Gcm 정보를 초기화한다.
    if (gcmApiKey !== '') {
      var gcm = new Gcm(gcmApiKey);
      this.gcmObject[appId] = gcm;
    }
  }

  this.server.onConnection(function (socket) {
    console.log("================= onConnection");
    var _query = socket.handshake.query;


    socket.emit('socket.address', {ip: socket.handshake.address});


    if (typeof _query.D == 'undefined') socket.handshake.query.D = '_';

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
        // 만약 Channel 이 없는 경우 생성한다! (Exceptional Cases)
        if (data.nModified == 0 && data.n == 0) { // NOT MODIFIED (NOT EXISTED)  - data : { ok: 1, nModified: 0, n: 0 }

          var __q = {
            A: _query.A,
            C: _query.C,
            U: params.U
          };

          if (params.DT) __q['DT'] = params.DT;

          mongoPersister.createChannel(__q, function (err, data) {

            if (err) {

              if (err.code == 11000) { // 이미 채널이 있는 경우 !! MONGODB ERR CODE : E11000
                console.warn(err.message);

                self.addUserToChannels(_query.A, _query.C, params.U);

                mongoPersister.addChannelUser({
                  A: _query.A,
                  C: _query.C,
                  U: params.U
                }, function (err, data) {
                  if (err) {
                    console.error(err, data);
                  } else {
                    console.info('  -----> [' + _query.A + '^' + _query.C + '] data was saved. (Don\'t worry!)');
                  }

                  if (callback) callback({status: 'ERR-INTERNAL', message: err});
                });

              } else {

                if (callback) callback({status: 'ERR-INTERNAL', message: err});

              }

            } else {
              self.addUserToChannels(_query.A, _query.C, params.U);

              if (callback) callback({status: 'ok'});
            }

          });
        } else {
          self.addUserToChannels(_query.A, _query.C, params.U);

          if (callback) callback({status: 'ok'});
        }

      });

    });

    /**
     * channel 추방시킨다)
     * @name ban
     * @event
     * @param {params} : U
     *        {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('channel.ban', function (params, callback) {

      if (!params.U || params.U.length === 0) {
        callback({
          status: 'ERR-PARAM',
          message: '[channel.ban] U(user id) parameter is mandatory !.'
        });
        return;
      }

      // Channel내의 user array에서 현재 user를 뺀다.
      mongoPersister.exitChannel({
        A: _query.A,
        C: _query.C,
        U: params.U
      }, function (err, channels) {
        if (err) {
          if (callback) callback({
            status: 'ERR-INTERNAL',
            message: err
          });

        } else {

          self.removeUserFromChannels(_query.A, _query.C, params.U);

          if (callback) callback({
            status: 'ok'
          });
            
        }
      });
    });

    socket.on('channel.create', function (params, callback) {
      console.log("======= channel.create");
      var _query = socket.handshake.query;
      if (typeof _query.D == 'undefined') socket.handshake.query.D = '_';

      if (!params.U || params.U.length === 0) {
        params.U = _query.U;
      }

      // MongoDB에 저장
      mongoPersister.createChannel({
        A: _query.A,
        C: params.C, // optional (can auto-generate !)
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
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      });
    });

    /**
     * Channel 정보를 조회한 후, callback으로 return한다
     * @name channel-get
     * @event
     * @param {callback} callback - Channel object를 callback으로 넘겨준다.
     */
    socket.on('channel.get', function (callback) {

      mongoPersister.getChannel({
        A: socket.handshake.query.A,
        C: socket.handshake.query.C
      }, function (err, channel, msg) {
        if (err) {
          if (callback) callback({
            status: 'ERR-INTERNAL',
            message: err
          });
        } else {
          if (channel) {
            if (callback) callback({
              status: 'ok',
              result: channel
            });
          } else {
            console.log('channel is not existed!'.red);
            if (callback) callback({
              status: 'ERR-NOTEXIST',
              message: 'channel is not existed!'
            });
          }
        }
      });
    });

    // 채널에서 나가기 ! (params 가 필요 없음)
    socket.on('channel.leave', function (callback) {

      // Channel내의 user array에서 현재 user를 뺀다.
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

          self.removeUserFromChannels(_query.A, _query.C, _query.U);

          if (callback) callback({
            status: 'ok'
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
        } else {
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      });
    });

    socket.on('message.received', function (data, callback) {
      if (data && !callback) {
        callback = data;
        data = {};
      }

      var query = {A: socket.handshake.query.A, U: socket.handshake.query.U, C: socket.handshake.query.C};
      if( data && data.TS ){
        query.TS = data.TS;
      }

      mongoPersister.receiveMessage(query
      , function (err, data) {
        if (err) {
          console.error(err);
          if (callback) callback({status: 'ERR-INTERNAL', message: err});
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

    // 체널의 전체 사용자 목록
    var _channelUsers = self.channels[data.A + '^' + data.C];
    //console.log( "=== _channelUsers === ", _channelUsers);

    if (_channelUsers) {
      var _absentUsers = utils.cloneObject(_channelUsers);

      if (_socketIds) {
        //console.log( self.server.io.of('/channel').connected );
        for (var id in _socketIds.sockets) {

          var _temp = self.server.io.of('/channel').connected[id];

          if (_temp) {
            var _user = self.users[data.A + '^' + _temp._userId];

            if (!_user) {
              console.warn(_temp._userId + ' : ' + _user);
            } else {
              // 현재 접속된 사용자는 _absentUsers 에서 제거한다
              var _ii = _absentUsers.indexOf(_temp._userId);
              if (_ii > -1) {
                _absentUsers.splice(_ii, 1);
              }
            }
          }
        }
      }

      //console.log( "=== _absentUsers === ", _absentUsers);
      // Global Socket 이 있는지 확인해서 전송
      _absentUsers.forEach(function (userId) {

        var rData = data;
        self.redisClient.hgetall(CONS.XC_U + ':' + data.A + ':' + userId, function (err, res) {

          if (err) {
            console.error(err);
          } else {
            for (var _i in res) {

              // _i : device(D)
              // res[_i] : serverName(S), -1 이면 연결되지 않은 것임
              if (res[_i] == self.serverName) {

                var _socketId = self.globalSocketIds[data.A + '^' + userId + '^' + _i];
                var _socket = self.server.io.of('/global').connected[_socketId];
                if (_socket && _socket.id != undefined) {

                  if( data.event == 'disconnect' ){
                    _socket.emit("_event", {
                      event: 'DISCONNECT',
                      NM: 'system', // name
                      C: data.C,  // channel
                      DT:{ 'UO' :{ 'U':data.U }, USC : data.count },
                      TS: data.TS  // timestamp
                    });  
                  } else {
                    _socket.emit("_event", {
                      event: 'NOTIFICATION',
                      NM: data.NM, // name
                      DT: data.DT, // data
                      C: data.C,  // channel
                      TS: data.TS  // timestamp
                    });                  
                  }
                  console.log("emit global _event");
                } else {
                  console.error('global socket was not existed.....');
                }

              } else {
                //retreive GCM
                mongoPersister.retrieveUser({A: rData.A, U: userId, D: _i}, function (err, result) {

                  if (err) console.error(err);

                  result.forEach(function (user) {
                    if (user.DS[_i].N) {
                      // DT 가 없는 경우에는 return
                      if( !rData.DT ){
                        return;
                      }
                      // GCM이 활성화되어 있으면, GCM 메시지를 전송한다.
                      if (self.gcmObject[rData.A] && self.gcmObject[rData.A].sender != undefined) {
                        var gcmIds = [];
                        gcmIds.push(user.DS[_i].N);
                        var data = null;
                        if (typeof rData.DT == 'string') {
                          data = {
                            'title': rData.DT,
                            'message': rData.DT
                          };
                        } else {
                          data = rData.DT;
                          if (rData.DT.UO) {
                            data.NM = rData.DT.UO.NM;
                          }
                          data.timestamp = rData.TS; // @ TODO 'timesteamp' is the reserved keyword from GCM ?
                        }
                        self.gcmObject[rData.A].send(gcmIds, data);
                      }
                    }
                  });
                });
              }
            }
          }
        });
      });

      // data storage 에 저장.
      if( data.NM != 'system' ){

        var NU = utils.cloneObject(_channelUsers);
        if( data.DT && data.DT.UO && data.DT.UO.U ){
  	      var inx = NU.indexOf( data.DT.UO.U );
          if( inx > 0 ) NU.splice(inx, 1);
        }

        mongoPersister.storeMessage({
          A: data.A,
          C: data.C,
          NM: data.NM,
          US: _channelUsers,
          DT: data.DT,
          TS: data.TS,
          NU: NU,
        }, function (err) {
          if (err) {
            console.log(err);
          }
        });
      }

    } else {
      console.warn(' ***** channel data is empty **** '); // @ TODO 채널이 생성되지 않은 상태에서 접속하면 에러가 남 (어떻게 해야 할지 확인 필요!!!!)
    }

  });

  // 체널 정보 수정시 (연결 / 종료)
  this.server.on('channel', function (data) {

    console.log('[EVENT] CHANNEL (' + data.event + ') ' + JSON.stringify(data));

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

        if (err == 'WARN-NOTEXIST') {

          console.log(err.message);

        } else if (err) {
          console.error(err);
        } else {
          if (result && result.US && result.US.length > 0) {
            var _uArray = [];
            result.US.forEach(function (user) {
              _uArray.push(user.U);
            });
            self.channels[data.A + '^' + data.C] = _uArray;
          }
        }

      });
    } else if (data.event == 'disconnect') { // Channel 이 종료된 경우

      data.TS = Date.now();
      self.server.emit('message', data );

      var _existedUser = self.users[data.A + '^' + data.U];
      if (_existedUser) {
        self.users[data.A + '^' + data.U][data.D] = false;
      } else {
        console.log(self.channels[data.A + '^' + data.C]);
        delete self.channels[data.A + '^' + data.C];
      }

      if (data.option) {
        if (data.option.indexOf('autoLeave') > -1) {
          mongoPersister.exitChannel({
            A: data.A,
            C: data.C,
            U: data.U
          }, function (err, channels) {
            if (err) {
              console.error(err);
            }
          });
        }
      }
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
        if (socket.connected == false) return;  // 디비에서 조회 이전에 disconnect 가 될 수 있음.

        result.forEach(function (user) {

          // #### [on REDIS] 접속자의 장치별 접속 현황.
          for (var device in user.DS) {  // CF. user.DS[device] --> { N: null }
            if (_D_ == device) { // 실제 접속한 Client Device
              self.redisClient.hset(CONS.XC_U + ':' + _A_ + ':' + _U_, _D_, self.serverName);
            } else {
              self.redisClient.hsetnx(CONS.XC_U + ':' + _A_ + ':' + _U_, _D_, -1);
            }
          }
          // All stalk app key add to redis - XC_A:A:(stalk app key)

          if (user.DT) {
            var appKeys = socket.handshake.query.AK = user.DT.A ? user.DT.A : [];
            appKeys.forEach(function (appKey) { // stalk application keys
              self.redisClient.hincrby(CONS.XC_A + ':' + _A_ + ":" + appKey, _U_ + '^' + self.serverName, 1, function (err, count) {
              });
            });
          } else {
            socket.handshake.query.AK = [];
          }
        });


        // #### [on REDIS] 어플리케이션의 사용자별 접속 현황.
        self.redisClient.hincrby(CONS.XC_A + ':' + _A_, _U_ + '^' + self.serverName, 1, function (err, count) {
          // #### [on REDIS] 서버별 접속 Client 현황.(서버 비정상 종료 후 Redis 정리 용)
          self.redisClient.hset(CONS.XC_S + ':' + self.serverName, _A_ + '^' + _U_ + '^' + _D_, count);
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

        if (socket.handshake.query.AK) { // 레디스에 데이터가 생성되기 이전에 disconnect가 되었을 경우

          var appKeys = socket.handshake.query.AK;
          appKeys.forEach(function (appKey) {
            self.redisClient.hdel(CONS.XC_A + ':' + _A_ + ":" + appKey, _U_ + '^' + self.serverName);
          })

          self.redisClient.hset(CONS.XC_U + ':' + _A_ + ':' + _U_, _D_, -1);
          self.redisClient.hincrby(CONS.XC_A + ':' + _A_, _U_ + '^' + self.serverName, -1, function (err, count) {

            if (err) {
              console.error(err);
            } else {
              if (count <= 0) {
                self.redisClient.hdel(CONS.XC_A + ':' + _A_, _U_ + '^' + self.serverName);
                self.redisClient.hdel(CONS.XC_S + ':' + self.serverName, _A_ + '^' + _U_ + '^' + _D_);
              }
            }

          });
        }
      });

      socket.on('ping', function () {
        socket.emit('pong');
      });

      /**
       * Channel을 생성한 후, 생성한 정보를 callback으로 넘겨준다.
       * @name channel-create
       * @event입
       * @param {object} params - JSON 형태의 data ( U, 없으면 접속자 정보로 자동 기 )
       * @param {callback} callback - Channel 정보를 callback으로 넘겨준다.
       */
      socket.on('channel.create', function (params, callback) {

        var _query = socket.handshake.query;
        if (typeof _query.D == 'undefined') socket.handshake.query.D = '_';

        if (!params.U || params.U.length === 0) {
          params.U = _query.U;
        }

        // MongoDB에 저장
        mongoPersister.createChannel({
          A: _query.A,
          C: params.C, // optional (can auto-generate !)
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
       * Channel list를 조회한 후, array를 callback으로 넘겨준다.
       * @name channel-list
       * @event
       * @param {callback} callback - Channel arary를 callback으로 넘겨준다.
       */
      socket.on('channel.list', function (callback) {
        var _query = socket.handshake.query;

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

      /**
       * Channel 정보를 조회한 후, callback으로 return한다
       * @name channel-get
       * @event
       * @param {object} params - JSON 형태의 data ( C )
       * @param {callback} callback - Channel object를 callback으로 넘겨준다.
       */
      socket.on('channel.get', function (params, callback) {
        mongoPersister.getChannel({
          A: socket.handshake.query.A,
          C: params.C
        }, function (err, channel, msg) {
          if (err) {
            if (callback) callback({
              status: 'ERR-INTERNAL',
              message: err
            });
          } else {
            if (channel) {
              if (callback) callback({
                status: 'ok',
                result: channel
              });
            } else {
              console.log('channel is not existed!'.red);
              if (callback) callback({
                status: 'ERR-NOTEXIST',
                message: 'channel is not existed!'
              });
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

        var query = {
          A: socket.handshake.query.A,
          U: socket.handshake.query.U
        };

        if( data.TS ){
          query.TS = data.TS;
        }

        if( data.C ){
          query.C = data.C; 
        }

        mongoPersister.getMessages(query
        , function (err, data) {
          if (err) {
            console.error(err);
            if (callback) callback({status: 'ERR-INTERNAL', message: err});
          } else {
            if (callback) callback({
              status: 'ok',
              result: data
            });
          }
        });
      });

      socket.on('message.received', function (data, callback) {
        if (data && !callback) {
          callback = data;
          data = {};
        }
   
        var query = {A: socket.handshake.query.A, U: socket.handshake.query.U};
        if( data && data.TS ){
          query.TS = data.TS;  
        }

        mongoPersister.receiveMessages(query
        , function (err, data) {
          if (err) {
            console.error(err);
            if (callback) callback({status: 'ERR-INTERNAL', message: err});
          } else {
            if (callback) callback({
              status: 'ok',
              result: data
            });
          }
        });
      });

      /**
       * Group내 포함된 User 목록을 조회한다.
       * @name group-list
       * @event
       * @param {object} params - JSON 형태의 data ( GR )
       * @param {callback} callback - User 목록을 callback으로 전송한다.
       */
      socket.on('group.list', function (params, callback) {
        if (!params.GR) {
          callback({
            status: 'ERR-PARAM',
            message: '[group-remove] GR(group id) parameter is mandatory !.'
          });
          return;
        }

        mongoPersister.listGroup({
          A: socket.handshake.query.A,
          GR: params.GR
        }, function (err, users) {
          if (err) {
            if (callback) callback({status: 'ERR-INTERNAL', message: err});
          } else {
            if (callback) callback({status: 'ok', result: users});
          }
        });
      });

      /**
       * 하나 또는 다수의 User의 group id를 추가한다.
       * @name group-add
       * @event
       * @param {object} params - JSON 형태의 data ( U, GR )
       * @param {callback} callback - 결과를 callback으로 전송한다.
       */
      socket.on('group.add', function (params, callback) {
        if (!params.U || !params.GR) {
          callback({
            status: 'ERR-PARAM',
            message: '[group-remove] U(user id), GR(group id) parameter is mandatory !.'
          });
          return;
        }

        mongoPersister.addGroupId({
          A: socket.handshake.query.A,
          U: params.U,
          GR: params.GR
        }, function (err) {
          if (err) {
            if (callback) callback({status: 'ERR-INTERNAL', message: err});
          } else {
            if (callback) callback({
              status: 'ok'
            });
          }
        });
      });

      /**
       * user를 group에서 삭제한다.
       * @name group-remove
       * @event
       * @param {object} params - JSON 형태의 data ( U, GR )
       * @param {callback} callback - 결과를 callback으로 전송한다.
       */
      socket.on('group.remove', function (params, callback) {
        if (!params.U || !params.GR) {
          callback({
            status: 'ERR-PARAM',
            message: '[group-remove] U(user id), GR(group id) parameter is mandatory !.'
          });
          return;
        }

        mongoPersister.removeGroupId({
          A: socket.handshake.query.A,
          U: params.U,
          GR: params.GR
        }, function (err) {
          if (err) {
            if (callback) callback({status: 'ERR-INTERNAL', message: err});
          } else {
            if (callback) callback({
              status: 'ok'
            });
          }
        });
      });

    });

    self.server.onPost('/upload', function (req, res, next) {

      var _app = req.headers['xp-a'];
      var _channel = req.headers['xp-c'];
      var _userInfo = JSON.parse(req.headers['xp-u']); //[U]^[D]^[TK]

      var _org = req.headers['xp-fu-org'];
      var _nm = req.headers['xp-fu-nm'];
      var _tp = req.headers['xp-fu-tp'];

      var isAuth = false;
      var _users = self.channels[_app + '^' + _channel];

      // token을 체크하여 login 상태인지 확인한다.
      for (var i = 0; _users && i < _users.length; i++) {
        if (_users[i] == _userInfo.U) { // @ TODO check token !!!!!!!! IMPORTANT
          isAuth = true;
          break;
        }
      }

      self.redisClient.hgetall(CONS.XC_U + ':' + _app + ':' + _userInfo.U, function (err, result) {
        if (err) {
          console.error(err);
          return;
        }

        for (var _i in result) {
          // _i : device(D)
          // res[_i] : serverName(S), -1 이면 연결되지 않은 것임

          if (result[_i] == self.serverName) {
            var _socketId = self.globalSocketIds[_app + '^' + _userInfo.U + '^' + _i];
            if (_socketId != undefined) {
              isAuth = true;
            }
          }
        }

        if (!isAuth) {
          res.send({
            status: 'ERR-AUTH',
            result: 'What the hell your token is not available!! Are you hack?'
          });
          return;
        }

        var uploadPath = path.join(
          options.home,
          options.upload || 'upload',
          _channel
        );

        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, 0766);

        var ext = (_org) ? _org.substring(_org.lastIndexOf('.') + 1, _org.length) : null;
        var fileName = _nm || shortId.generate();
        fileName = fileName.replace(/ /g, '');
        if (ext) fileName = fileName + '.' + ext;

        var busboy = new Busboy({headers: req.headers});
        busboy.on('file', function (__fieldname, __file, __filename, __encoding, __mimetype) {

          var fstream = fs.createWriteStream(path.join(uploadPath, fileName));
          __file.pipe(fstream);

        });
        busboy.on('finish', function () {

          res.send({
            status: 'ok',
            result: {
              channel: _channel,
              name: fileName
            }
          });

        });
        return req.pipe(busboy);
      });
    });

    self.server.onGet('/download/:app/:channel/:userId/:filename', function (req, res) {

      // TODO : check login
      var isConnected = true;

      if (isConnected) {

        var httpRoot = path.join(
          options.home,
          options.upload || 'upload');

        send(req, req.params.channel + '/' + req.params.filename, {root: httpRoot})
          .on('error', function (err) {
            res.statusCode = err.status || 500;
            res.end(err.message);
          })
          .on('directory', function () {
            res.statusCode = 301;
            res.setHeader('Location', req.url + '/');
            res.end('Redirecting to ' + req.url + '/');
          })
          //.on('headers', function (res, path, stat) {
          //  res.setHeader('Content-Disposition', 'attachment');
          //})
          .pipe(res);

      } else {

        res.statusCode = 404;
        res.end('Not connected in channel');

      }
    });
  });
};
