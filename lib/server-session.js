var xpush = require('xpush');
var mongoPersister = require('./persister/mongodb/persister');
var utils = require('./utils');

SessionServer = exports.SessionServer = function (options, cb) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self = this;

  this.server = xpush.createSessionServer(options);

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

  });

};