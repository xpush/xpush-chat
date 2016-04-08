var cassandra = require('cassandra-driver');

var db = function () {
  var initFlag = false;
  var client;
  return {

    config: function (addr, dbname, opts, callback) {
      if (!initFlag) {

        var addressArr = [];
        if( typeof addr == 'string' ){
          addressArr.push( addr );
        } else if ( Array.isArray(addr) ){
          addressArr = addressArr.concat( addr );
        }

        var keyspace = dbname ? dbname : 'xpush';

        client = new cassandra.Client( { contactPoints: addressArr, keyspace, keyspace } );
        client.connect( function( err, result){
          if( err ){
            console.log( ( err.message.indexOf( "Keyspace" ) > -1 && err.message.indexOf( "does not exist" ) > -1  ) );
            if (callback) callback(err);
          } else {
            initFlag = true;
            if (callback) callback(null, client);
          }
        });
      } else {
        if (callback) callback(null, client);
      }
    }
  };
};

module.exports = db();