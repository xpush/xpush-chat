var xpush = require('xpush');

var ChannelServer = exports.ChannelServer = function(options, cb) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self = this;

  this.server = xpush.createChannelServer(options);

  // Customizing connection events
  this.server.onConnection(function (socket) {
    var query = socket.handshake.query;

    console.log('CONNECTION - ' + query.A + " : " + query.C + " : " + query.U);

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

  this.server.on('started', function (url, port) {
    console.log(' >>>>>> Channel SERVER is started ' + url + ':' + port);
  });

};