var mongoPersister = require('./lib/persister/mongodb/persister');

require('./lib/persister/mongodb/database').config('127.0.0.1:27017', 'XCHAT', function (err, message) {
    if (!err) {

      mongoPersister.addChannelUser({
        A: 'a',
        C: 'c',
        U: 'u',
        DT: 'dt'
      }, function (err, result) {
        console.log(err, result);
      });

    } else {
      console.error(err, message)
    }

  }
);