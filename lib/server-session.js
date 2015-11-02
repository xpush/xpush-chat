var xpush = require('xpush');

var utils = require('./utils');
var CONS = require('./constants');
var mongoPersister = require('./persister/mongodb/persister');

var SessionServer = exports.SessionServer = function (options, cb) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self = this;

  this.server = xpush.createSessionServer(options);
  this.redisClient = this.server.sessionManager.redisClient;

  this.server.on('started', function (url, port) {

    self.server.onPost('/user/register', function (req, res, next) {

      console.log('[GET] /user/register ', req.params);

      var err = utils.validEmptyParams(req, ['A', 'U', 'D']);
      if (err) {
        res.send({status: 'ERR-PARAM', message: err});
        return;
      }

      var _param = req.params;
      if (_param.DT && typeof _param.DT == 'string') _param.DT = JSON.parse(_param.DT);

      mongoPersister.registerUser({ //// A, U, PW, DT, D
          A: _param.A,
          U: _param.U,
          PW: utils.encrypto(_param.PW),
          D: _param.D,
          N: _param.N,
          DT: _param.DT
        },
        function (err, msg) {
          if (err) {
            console.error(err, msg);
            utils.sendErr(res, err);
          } else {
            res.send({status: 'ok'});
          }
        }
      );
    });

    self.server.onPost('/user/update', function (req, res, next) {

        console.log('[POST] /user/update ', req.params);

        var err = utils.validEmptyParams(req, ['A', 'U', 'D', 'PW']);
        if (err) {
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;

        mongoPersister.updateUser({
            A: _param.A,
            U: _param.U,
            D: _param.D,
            PW: utils.encrypto(_param.PW),
            N: _param.N,
            DT: _param.DT,
          },
          function (err, msg) {
            if (err) {
              if (err == 'ERR-PASSWORD' || err == 'ERR-NOTEXIST') {
                console.warn(err, msg);
                res.send({status: err, message: 'update process is failed'});
              } else {
                console.error(err, msg);
                utils.sendErr(res, err);
              }
            } else {
              res.send({status: 'ok', user: msg});
            }
          }
        );
      }
    );

    self.server.onPost('/user/active', function (req, res, next) {

        console.log('[POST] /user/active', req.params);

        var err = utils.validEmptyParams(req, ['A','U']);
        if (err) {
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;
        var userId = _param.U;

        console.log('REDIS :    ['+CONS.XC_U + ':' + _param.A + ':' + _param.U+']');

        self.redisClient.hgetall(CONS.XC_U + ':' + _param.A + ':' + _param.U, function (err, data) {

          if (err) {
            console.error(err);
          } else {
            var result = {};

            var connected = false;
            for (var key in data) {
              if( data[key] != -1 ){
                connected = true;
              }
            }

            var result = {};
            result[userId]=connected;
            res.send({status: 'ok', result: result});
          }
        });
      }
    );

    self.server.onPost('/user/list/active', function (req, res, next) {

        console.log('[POST] /user/list/active ', req.params);

        var err = utils.validEmptyParams(req, ['A']);
        if (err) {
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;


        self.redisClient.hgetall(CONS.XC_A + ':' + _param.A, function (err, data) {

          if (err) {
            console.error(err, data);
            utils.sendErr(res, err);
          } else {

            var resultArray = [];
            for (var userId in data) {

              if (Number(data[userId]) > 0) {

                var _uInfo = userId.split('^'); // 0: userId, 1: serverName
                resultArray.push({
                  U: _uInfo[0],
                  S: _uInfo[1],
                  count: Number(data[userId])
                });
              }
            }

            res.send({status: 'ok', result: resultArray});
          }

        });

      }
    );

    self.server.onPost('/user/search', function (req, res, next) {

        console.log('[POST] /user/search ', req.params);

        var err = utils.validEmptyParams(req, ['A', 'K']);
        if (err) {
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;
        var option = _param.option;
        if (typeof option == 'string' || option instanceof String) {
          option = JSON.parse(option);
        }
        var key = "%" + _param.K + "%";

        var query = {"A": _param.A, "$or": [{"DT.NM": key}, {"U": key}]};
        var column = {"U": 1, "DT": 1, "A": 1, "_id": 0};

        var query = utils.likeQueryMaker(query);

        console.log(query);
        mongoPersister.searchUser(
          query,
          column,
          option,
          function (err, users, count) {
            if (err) {
              console.error(err, users, count);
              res.send({status: 'ERR-INTERNAL', message: err});
            } else {
              res.send({status: 'ok', result: {users: users, count: count}});
            }
          }
        );
      }
    );

    self.server.onPost('/auth', function (req, res, next) {

        var err = utils.validEmptyParams(req, ['A', 'U', 'D', 'PW']);
        if (err) {
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;

        console.log( "--- _param ---")
        console.log( _param );
        mongoPersister.retrieveUser({
            A: _param.A,
            U: _param.U,
            D: _param.D
          },
          function (err, result) {
            if (err || !result) {
              console.error(err, result);
              utils.sendErr(res, err);
              return;
            }

            var _user;
            if (result.length == 0) {
              res.send({status: 'ERR-NOTEXIST', message: 'auth process is failed'});
              return;
            } else {
              _user = result[0];

              if (_user.PW != utils.encrypto(_param.PW)) {
                res.send({status: 'ERR-PASSWORD', message: 'auth process is failed'});
                return;
              } else {
                _user._id = undefined;
                _user.PW = undefined;
              }
            }

            var serverNode = self.server.nodeManager.getServerNode(_param.A + _param.U);
            var _url = utils.setHttpProtocal(serverNode.url);

            res.send({
              status: 'ok',
              result: {
                'server': serverNode.name,
                'serverUrl': _url,
                'user': _user
              }
            });
          }
        );
      }
    );

  });


};
