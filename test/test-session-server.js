var io = require('socket.io-client');


describe("Chat Server", function () {

  /* Test 1 - A Single User */
  it('Should broadcast new user once they connect', function (done) {
    var client = io.connect(socketURL, options);

  });

});