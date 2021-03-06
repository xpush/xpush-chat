var xpush = require('xpush');

var utils = require('./utils');
var CONS = require('./constants');
var mongoPersister = require('./persister/mongodb/persister');
var fs = require('fs');
var path = require('path');
var send = require('send');

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
        if (_param.DT && typeof _param.DT == 'string') _param.DT = JSON.parse(_param.DT);

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

        var err = utils.validEmptyParams(req, ['A', 'U']);
        if (err) {
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;
        var userId = _param.U;

        console.log('REDIS :    [' + CONS.XC_U + ':' + _param.A + ':' + _param.U + ']');

        self.redisClient.hgetall(CONS.XC_U + ':' + _param.A + ':' + _param.U, function (err, data) {

          if (err) {
            console.error(err);
          } else {
            var result = {};

            var connected = false;
            for (var key in data) {
              if (data[key] != -1) {
                connected = true;
              }
            }

            var result = {};
            result[userId] = connected;
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
          console.error(err);
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;

        mongoPersister.retrieveUser({
            A: _param.A,
            U: _param.U
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
              var passwordCorrect = false;

              for (var inx = 0; !_user && inx < result.length; inx++) {
                var _device = _param.D;

                if (result[inx].PW == utils.encrypto(_param.PW)) {
                  passwordCorrect = true;

                  if (_device && result[inx].DS[_device]) {
                    _user = result[inx];
                    _user._id = undefined;
                    _user.PW = undefined;
                    console.log("===");
                  }
                }
              }

              if (!passwordCorrect) {
                res.send({status: 'ERR-PASSWORD', message: 'auth process is failed'});
                return;
              } else if (!_user) {
                res.send({status: 'NOT-EXIST-DEVICE', message: 'auth process is failed'});
                return;
              }
            }

            var serverNode = self.server.nodeManager.getServerNode(_param.A + _param.U);

            var _url;
            if (serverNode.url) _url = utils.setHttpProtocal(serverNode.url);

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

    self.server.onPost('/device/add', function (req, res, next) {

        var err = utils.validEmptyParams(req, ['A', 'U', 'D', 'PW']);
        if (err) {
          console.error(err);
          res.send({status: 'ERR-PARAM', message: err});
          return;
        }

        var _param = req.params;

        mongoPersister.retrieveUser({
            A: _param.A,
            U: _param.U,
            PW: utils.encrypto(_param.PW)
          },
          function (err, result) {
            if (err || !result) {
              console.error(err, result);
              utils.sendErr(res, err);
              return;
            }

            var _user;
            if (result.length == 0) {
              res.send({status: 'ERR-NOTEXIST', message: 'user is not exist'});
              return;
            } else {
              _user = result[0];
            }

            mongoPersister.addDevice({
                A: _param.A,
                U: _param.U,
                D: _param.D
              },
              function (err, result) {
                if (err) {
                  console.error(err);
                  utils.sendErr(res, err);
                  return;
                }

                var serverNode = self.server.nodeManager.getServerNode(_param.A + _param.U);

                var _url;
                if (serverNode.url) _url = utils.setHttpProtocal(serverNode.url);

                _user._id = undefined;
                _user.PW = undefined;

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
      }
    );

    self.server.onPost('/upload', function (req, res, next) {

      var _app = req.headers['xp-a'];
      var _channel = req.headers['xp-c'];
      var _userInfo;
      try {
        _userInfo = JSON.parse(req.headers['xp-u']);
      } catch (err) {
        console.log(err);
      }

      var _org = req.headers['xp-fu-org'];
      var _nm = req.headers['xp-fu-nm'];
      var _tp = req.headers['xp-fu-tp'];

      var isAuth = true;

      if (!isAuth) {
        res.send({
          status: 'ERR-AUTH',
          result: 'What the hell your token is not available!! Are you hack?'
        });
        return;
      }

      var uploadPath = path.join(
        options.home,
        options.upload || 'upload'
      );

      var tmpFileName = req.files.file.path.replace(uploadPath + "/", "");
      var downloadUrl = "http://" + options.host + ":" + options.port + '/download/' + tmpFileName;

      res.send({
        status: 'ok',
        result: {
          url: downloadUrl
        }
      });
    });

    self.server.onGet('/download/:filename', function (req, res) {

      // TODO : check login
      var isConnected = true;

      if (isConnected) {

        var httpRoot = path.join(
          options.home,
          options.upload || 'upload');

        send(req, req.params.filename, {root: httpRoot})
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
