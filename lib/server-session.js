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

      console.log('/user/register', req.params);

      var err = utils.validEmptyParams(req, ['A', 'U', 'D']);
      if (err) {
        res.send({status: 'ERR-PARAM', message: err});
        return;
      }

      var _param = req.params;

      mongoPersister.registerUser({ //// A, U, PW, DT, D
          A: _param.A,
          U: _param.U,
          PW: utils.encrypto(_param.PW),
          D: _param.D,
          N: _param.N,
          DT: _param.DT
        },
        function (err, msg) {

          console.log(err, msg);
          if (err) {
            utils.sendErr(res, err);
          } else {
            res.send({status: 'ok'});
          }
        }
      );
    });

    self.server.onPost('/user/update', function (req, res, next) {

        console.log(req.params);

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
                res.send({status: err, message: 'update process is failed'});
              } else {
                utils.sendErr(res, err);
              }
            } else {
              res.send({status: 'ok', user: msg});
            }
          }
        );
      }
    );

    self.server.onPost('/user/list/active', function (req, res, next) {

        console.log(req.params);

        var err = utils.validEmptyParams(req, ['A']);
        if (err) {
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;


        self.redisClient.hgetall(CONS.XC_A + ':' + _param.A, function (err, data) {

          console.log(err, data);

          if (err) {
            console.error(err);
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

        mongoPersister.searchUser(
          query,
          column,
          option,
          function (err, users, count) {
            if (err) {
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

        mongoPersister.retrieveUser({
            A: _param.A,
            U: _param.U,
            D: _param.D
          },
          function (err, result) {
            if (err || !result) {
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
