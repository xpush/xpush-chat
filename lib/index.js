var SessionServer = exports.SessionServer = require('./server-session').SessionServer;
var ChannelServer = exports.ChannelServer = require('./server-channel').ChannelServer;

var mongoDatabase = require('./persister/mongodb/database');
//var cassandraDatabase = require('./persister/cassandra/database');

var chkInitProcess = function (options) {
  if( options && options.cassandra ){
   /*8 TODO
    cassandraDatabase.config( 
      options && options.cassandra && options.cassandra.address ? options.cassandra.address : '',
      'xchat',
      options.cassandra && options.cassandra && options.cassandra.options ? options.cassandra.options : undefined,
      function (err, client) {
        if (err) {
          console.error('server starting ERROR : ' + err);
          process.exit(1);
        } else {
          // console.info(' - mongoDB is connected. ');
        }
      }
    );
   */
  } else {
    mongoDatabase.config(
      options && options.mongodb && options.mongodb.address ? options.mongodb.address : '',
      'XCHAT',
      options.mongodb && options.mongodb && options.mongodb.options ? options.mongodb.options : undefined,
      function (err, message) {
        if (err) {
          console.error('server starting ERROR : ' + err);
          process.exit(1);
        } else {
          // console.info(' - mongoDB is connected. ');
        }
      }
    );
  }
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

