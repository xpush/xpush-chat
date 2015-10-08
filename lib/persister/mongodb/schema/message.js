var mongoose = require('mongoose'),
  paginate = require('./paginate');

var messageModel = function () {

  var messageSchema = mongoose.Schema({
    A: String, // app
    C: String, // channel
    NM: String, // event NM
    US: [], // users
    DT: {}, // data
    TS: {type: Number} // created
  });

  messageSchema.plugin(paginate);

  return mongoose.model('Message', messageSchema);
};

module.exports = new messageModel();
