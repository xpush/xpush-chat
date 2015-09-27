var Channel = require('./schema/channel');
var User = require('./schema/user');
var UnreadMessage = require('./schema/unreadMessage');

var shortId = require('shortid');


/**
 * User 정보가 조회
 * @name retrieveUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 조회 후 수행할 callback function
 */
exports.retrieveUser = function (input, done) { // A, U, D

  var q = {A: input.A, U: input.U};
  if (input.D) {
    q['DS.' + input.D] = {'$exists': true};
  }

  var query = User.find(q);

  query.exec(function (err, results) {
    if (err) console.error(err);
    return done(null, results);
  });

};


exports.addChannelUser = function (input, done) { // A, C, U, DT

  var _user = {U: input.U};

  var query = {A: input.A, C: input.C};
  var update = {'$addToSet': {US: {$each: _user}}, '$set': {DT: input.DT}};
  Channel.update(query, update, {"multi": true}, function (err, data) {
    if (err) return done(err);
    none(null, input);
  });

};

/**
 * 특정 Channel에서 나간다.
 * @name exitChannel
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C )
 * @param {callback} done - User 추가 후 수행할 callback function
 */
exports.exitChannel = function (input, done) { // A, C, U

  var query = {
    A: input.A,
    C: input.C,
    'US.U': input.U
  };

  var update = {
    '$pull': {US: {U: input.U}}
  };

  // Channel User 목록에서 지운다.
  Channel.findOneAndUpdate(query, update, {"multi": true, "select": 'US'}, function (err, data) {
    if (err) {
      console.log(err);
      if (done) done(err);
    } else {

      if (!data) {
        if (done) {
          return done('ERR-NOTEXIST', data);
        } else {
          return;
        }
      }

      // Channel에 한명도 존재하지 않으면, Channel을 삭제한다.
      if (!data.US || data.US.length === 0) {

        Channel.remove({_id: data._id}, function (err) {
          if (done) done(err);
        });

      } else {
        if (done) done(null, data);
      }
    }
  });
};

/**
 * unread Message를 DB에서 조회한다.
 * @name unReadMessages
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C, U, D )
 * @param {callback} done - Message 저장 후 수행할 callback function
 */
exports.unReadMessages = function (input, done) { // A, C, U, D

  var queryCond = {A: input.A, U: input.U};
  if (input.C) queryCond['C'] = input.C;
  if (input.D) queryCond['D'] = input.D;

  UnreadMessage.find(queryCond, {'_id': 0, 'NM': 1, 'MG': 1, 'TS': 1}).populate('MG').exec(function (err, messages) {
    if (err) {
      done(err);
    } else {
      done(null, messages);
    }
  });
};

/**
 * Message를 DB에서 삭제한다.
 * @name removeUnReadMessages
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C, U, D )
 * @param {callback} done - Message 삭제 후 수행할 callback function
 */
exports.removeUnReadMessages = function (input, done) { // A, C, U, D

  var queryCond = {A: input.A, U: input.U};
  if (input.C) queryCond['C'] = input.C;
  if (input.D) queryCond['D'] = input.D;

  UnreadMessage.remove(queryCond).exec(function (err) {
    if (err) {
      done(err);
    } else {
      done(null, 'ok');
    }
  });
};


