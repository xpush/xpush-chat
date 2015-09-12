var mongoDatabase = require('./mongodb-persister/database');

var SessionServer = exports.SessionServer = require('./server-session').SessionServer;
var ChannelServer = exports.ChannelServer = require('./server-channel').ChannelServer;


var chkInitProcess = function (options) {

  mongoDatabase.config(
    options && options.mongodb && options.mongodb.address ? options.mongodb.address : '',
    'XCHAT',
    options.mongodb && options.mongodb && options.mongodb.options ? options.mongodb.options : undefined,
    function (err, message) {
      if (err) {
        console.error('Channel server startup ERROR : ' + err);
        process.exit(1);
      } else {
        console.info(' XCHAT - mongoDB is connected. ')
      }
    }
  );

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

