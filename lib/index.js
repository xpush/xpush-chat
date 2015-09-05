var SessionServer = exports.SessionServer = require('./server-session').SessionServer;
var ChannelServer = exports.ChannelServer = require('./server-channel').ChannelServer;


var chkInitProcess = function (options) {
  console.log(options);
};


/**
 * Create channel server
 * @name createChannelServer
 * @function createChannelServer
 */
exports.createChannelServer = function (options, cb) {

  chkInitProcess(options);

  var server;
  server = new ChannelServer(options, cb);
  return server;
};

/**
 * Create session server
 * @name createSessionServer
 * @function createSessionServer
 */
exports.createSessionServer = function (options, cb) {

  chkInitProcess(options);

  var server;
  server = new SessionServer(options, cb);
  return server;
};

