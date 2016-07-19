var Channel = require('./schema/channel');
var User = require('./schema/user');
var Message = require('./schema/message');
var async = require('async');
var shortId = require('shortid');
var extend = require('extend')


/**
 * User 정보가 조회
 * @name retrieveUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 조회 후 수행할 callback function
 */
exports.retrieveUser = function (input, done) { // A, U, D

  var q = {A: input.A, U: input.U};
  if (input.PW) {
    q.PW = input.PW;
  }

  var query = User.find(q);
  if (input.D) {
    query.exists('DS.' + input.D, true);
  }

  query.exec(function (err, results) {
    if (err) console.error(err);
    done(null, results);
  });

};

/**
 * User를 등록한다.
 * @name registerUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 등록 후 수행할 callback function
 */
exports.registerUser = function (input, done) { // A, U, PW, DT, D, N

  var query = {A: input.A, U: input.U};

  var data = {
    PW: input.PW,
    DT: input.DT,
    GR: []
  };

  // notiId는 DS.deviceId.N 형태로 저장됨. ex) DS.android01.N
  if (input.N) {
    data['DS.' + input.D + '.N'] = input.N;
  } else {
    data['DS.' + input.D + '.N'] = null;
  }

  var q = User.find(query);
  if (input.D) {
    q.exists('DS.' + input.D, true);
  }

  q.exec(function (err, doc) {
    if (err) return done(err);
    if (doc.length > 0) {
      return done('ERR-USER_EXIST');
    }
    for (var k in data) {
      query[k] = data[k];
    }
    var newUser = new User(query);
    newUser.save(function (err) {
      if (err) return done(err);
      if (done) done(null);
    });

  });


  /*
   User.update(query, { '$set': data }, { upsert: true }, function(err) {
   if (err) return done(err);
   if (done) done(null);
   });
   */
};

/**
 * User 정보가 있는지 확인 후에 있는 경우 수정한다. deviceId를 필수로 입력받아야 한다.
 * @name updateUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 수정 후 수행할 callback function
 */
exports.updateUser = function (input, done) { // A, U, D, PW, N, DT

  var query = {A: input.A, U: input.U};

  var q = User.findOne(query);
  if (input.D) {
    q.exists('DS.' + input.D, true);
  }

  // User 정보 조회
  q.exec(function (err, user) {

    if (err) return done(err);
    if (!err && !user) {
      return done('ERR-NOTEXIST');
    }

    // PW가 동잃한지 비교한다.
    if (user.PW != input.PW) {
      return done('ERR-PASSWORD');
    }

    if( input.N ){

      var newDevice = {};
      for( var key in user.DS ){
        if( key != input.D ){
          newDevice[key] = user.DS[key];
        }
      }
      newDevice[input.D] = {"N":input.N};
      user.DS = newDevice;

    }

    if( input.DT ){
      user.DT = input.DT;
    }

    user.save(function (err) {
      if (err) return done(err);
      //Return 할때 PW를 삭제하고 return함
      user.PW = undefined;
      done(null, user);
    });
  });
};

/**
 * User 목록을 조회한다. 페이징을 하거나 전체조회를 한다.
 * @name queryUser
 * @function
 * @param {string} _A - Appication Id
 * @param {object} _query - 조회조건으로 사용할 JSON 형태의 data
 * @param {object} _column - 조회결과에 포함될 column ( {'U' : 1, 'PW' : 0 } )
 * @param {object} _options - JSON 형태의 data
 * @param {callback} done - 조회 후 수행할 callback function
 */
exports.searchUser = function (_query, _column, _options, done) {

  var isPaging = false;

  // options에 pageNum이나 pageSize가 포함되어 있는 경우, 페이지네이션을 통해 User 목록을 조회한다.
  if (_options && _options.pageNum && _options.pageSize) isPaging = true;

  if (isPaging) {

    var addedOptions = {
      columns: _column,
      skipCount: false
    };

    if (_options.sortBy)    addedOptions['sortBy'] = _options.sortBy;
    if (_options.skipCount) addedOptions['skipCount'] = _options.skipCount;

    User.paginate(_query, _options.pageNum, _options.pageSize, function (error, pageCount, paginatedResults, itemCount) {
      if (error) {
        return done(error);
      } else {
        return done(null, paginatedResults, itemCount);
      }
    }, addedOptions);

  } else {
    User.find(_query, _column, function (err, users) {
      if (err) {
        return done(err);
      }
      return done(null, users);
    });

  }
};

/*************************************************************************************************************/
/*  CHANNEL  *************************************************************************************************/
/*************************************************************************************************************/

/**
 * Channel 정보를 생성한다.
 * @name createChannel
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - Channel 정보 생성 후 수행할 callback function
 */
exports.createChannel = function (input, done) { // A, C, U, DT

  if (!input.C) input.C = shortId.generate();

  var newChannel = {
    _id: input.A + '^' + input.C,
    A: input.A,
    C: input.C,
    US: []
  };

  if (input.U) {
    if (typeof input.U == 'string') {
      newChannel.US = {U: input.U};
    } else if (input.U instanceof Object) {
      var uArr = [];
      if (input.U.length > 0) {
        for (var i in input.U) {
          uArr.push({'U': input.U[i]});
        }
        newChannel.US = uArr;
      } else {
        newChannel.US = input.U;
      }
    }
  }
  if (input.DT) newChannel['DT'] = input.DT;

  var _c = new Channel(newChannel);
  _c.save(function (err, channel) {
    if (err) return done(err);
    done(null, channel);
  });

  /*

   async.waterfall([

   function (callback) {

   // 중복방지를 위해 id는 applicationId+^+channelId로 생성함
   var channel = {
   _id: input.A + '^' + input.C,
   A: input.A,
   C: input.C,
   US: {}
   };
   if (input.DT) channel['DT'] = input.DT;

   // U 에 포함된 userId에 대한 validation 처리.
   if (input.U) {

   var query = {A: input.A};
   var isExistedUsers = false;

   // string type 인 경우 한명
   if (typeof input.U == 'string') {
   query['U'] = input.U;
   isExistedUsers = true;

   // string type 인 아닌 경우
   } else {
   if (input.U.length == 1) {
   query['U'] = input.U[0];
   isExistedUsers = true;
   } else if (input.U.length > 1) {
   query['$or'] = [];
   for (var i in input.U) {
   query['$or'].push({
   U: input.U[i]
   });
   }
   isExistedUsers = true;
   }
   }

   // 생성한 쿼리로 User가 있는지 조회한다.
   if (isExistedUsers) {

   User.find(query, {U: 1, DS: 1, _id: 0}, function (err, doc) {

   var result = [];

   // 조회된 User list 를 사용하여 US array 를 생성한다.
   for (var i = 0; i < doc.length; i++) {
   var devs = doc[i].DS;
   var keys = Object.keys(devs);
   keys.forEach(function (key) {
   var _t = {};
   _t['U'] = doc[i].U;
   _t['D'] = key;
   _t['N'] = devs[key].N;

   result.push(_t);
   });
   }

   if (err) done(err);

   channel.US = result;
   callback(null, channel);
   });

   } else {
   callback(null, channel);
   }

   } else {
   callback(null, channel);
   }

   },

   function (newChannel, callback) {

   // 입력받은 channelId가 없는 경우, 자동으로 channelId를 생성한다.
   if (!newChannel.C) {
   newChannel.C = shortId.generate();
   newChannel._id = newChannel.A + '^' + newChannel.C
   console.log("======== newChannel ", newChannel);
   var _c = new Channel(newChannel);
   _c.save(done);
   callback(null, newChannel);

   } else {

   // channelId가 있는면, Channel 정보를 생성 후 리턴한다.
   Channel.findOne({
   A: input.A,
   C: input.C
   },
   function (err, doc) {
   if (err) return done(err);

   if (!doc) {
   var _c = new Channel(newChannel);
   _c.save(done);
   callback(null, newChannel);

   } else {
   //이미 있는 경우, 존재한다는 메시지만 리턴한다.
   return done('ERR-EXISTED');
   }
   });
   }
   }
   ], function (er, result) {

   }); */

};

/**
 * User가 포함된 Channel list 를 조회한다.
 * @name listChannel
 * @function
 * @param {object} input - JSON 형태의 input data ( A, U )
 * @param {callback} done - Channel 정보 조회 후 수행할 callback function
 */
exports.listChannel = function (input, done) { // A, U
  var query = {A: input.A, 'US.U': input.U};
  Channel.find(query, function (err, channels) {
    if (err) return done(err);

    if (!channels) {
      done(null, null, {
        message: 'Channel is not found'
      });
    } else {
      done(null, channels);
    }
  });
};

/**
 * 특정 Channel 정보를 조회한다.
 * @name getChannel
 * @function
 * @param {object} input - JSON 형태의 input data ( A, U )
 * @param {callback} done - Channel 정보 조회 후 수행할 callback function
 */
exports.getChannel = function (input, done) { // A, C
  var query = {A: input.A, C: input.C};
  Channel.findOne(query).lean().exec(function (err, channel) {
    if (err) return done(err);

    if (!channel) {
      done('WARN-NOTEXIST', {
        message: 'Channel is not found'
      });
    } else {

      var US = [];
      for (var inx = 0; inx < channel.US.length; inx++) {
        US.push(channel.US[inx].U);
      }

      User.find().where('U').in(US).select('U DT').lean().exec(function (err, users) {
        if (err) {
          done(null, channel);
        } else {
          var userInfos = [];
          var nms = [];
          for (var inx = 0; inx < users.length; inx++) {
            users[inx]._id = undefined;
            userInfos.push(users[inx]);
          }
          channel.UDTS = userInfos;
          return done(null, channel);
        }
      });
    }
  });
};

exports.addChannelUser = function (input, done) { // A, C, U, DT

  var _user = [{U: input.U}];

  var query = {A: input.A, C: input.C};

  var US = [];
  if (typeof input.U == 'string') {
    US = [{'U':input.U}];
  } else {
    if( input.U.length > 0 ){
      for( var key in input.U ){
        US.push( {'U':input.U[key]} );
      }
    }
  }

  var update = {'$push': {US:US}};

  if (input.DT) {
    update['$set'] = {DT: input.DT};
  }

  Channel.update(query, update, {"multi": true}, function (err, data) {
    if (err) return done(err);
    done(null, data);
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
    C: input.C
  };

  var US = [];
  if (typeof input.U == 'string') {
    US = [{'U':input.U}];
  } else {
    if( input.U.length > 0 ){
      for( var key in input.U ){
        US.push( {'U':input.U[key]} );
      }
    }
  }

  var update = {
    '$pull': {'US': {$in:US} }
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
          if (err) {
            done(err)
          } else {
            done(null);
          }
        });

      } else {
        if (done) done(null, data);
      }
    }
  });
};

/**
 * Message를 DB에 저장한다.
 * @name storeMessages
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C, NM, DT, US, TS )
 * @param {callback} done - Message 저장 후 수행할 callback function
 */
exports.storeMessage = function (input, done) { // A, C, NM, DT, US, TS

  if (input.DT && typeof input.DT == 'object') {
    input.DT = JSON.stringify(input.DT);
  }

  // 읽지 않은 사용자
  // Message 객체를 만든다
  var msg = new Message({
    A: input.A,
    C: input.C,
    NM: input.NM,
    US: input.US,
    DT: input.DT,
    TS: input.TS, // created
    NU: input.NU
  });

  msg.save(function (err, _message) {
    if (err) return done(err);
    done(null, _message);
  });
};

/**
 * unread Message를 DB에서 조회한다.
 * @name unReadMessages
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C, U, D )
 * @param {callback} done - Message 저장 후 수행할 callback function
 */
exports.getMessages = function (input, done) { // A, C, U, D


  var queryCond = { A: input.A, US: input.U };
  // if( input.NU ) queryCond['NU'] = NU: input.U;
  if (input.C) queryCond['C'] = input.C;
  if (input.TS) {
    queryCond['TS'] = {$gt: input.TS};
  }
  Message.find(queryCond, {'_id': 0, 'NM': 1, 'TS': 1, 'DT': 1}).sort({TS: 1}).exec(function (err, messages) {
    if (err) {
      done(err);
    } else {
      done(null, messages);
    }
  });
};

exports.receiveMessages = function (input, done) { // A, C, U, D

  var queryCond = { A: input.A, US:input.U, NU:input.U };
  if (input.C) queryCond['C'] = input.C;
  if (input.TS) {
    queryCond['TS'] = {$lte: input.TS};
  }

  Message.update(queryCond, {$pull:{'NU':input.U}}, {multi:true}, function (err, _message) {
    if (err) {
      done(err);
    } else {
      done(null,_message);
    }
  });

};


/**
 * 하나 또는 다수의 User의 group id를 추가한다.
 * @name updateUserToken
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 추기 후 수행할 callback function
 */
exports.addGroupId = function (input, done) { // A, U, GR
  var query = {A: input.A};

  if (typeof input.U == 'string') {
    query['U'] = input.U;
  } else {
    // U 는 한명이거나 여러명일 수 있다. 여려명일 경우 or 조건으로 쿼리에 추가
    if (input.U.length == 1) {
      query['U'] = input.U[0];
    } else if (input.U.length > 1) {
      query['$or'] = [];
      for (var i in input.U) {
        query['$or'].push({U: input.U[i]});
      }
    }
  }

  var data = {'$addToSet': {'GR': input.GR}};

  User.update(query, data, {upsert: true, multi: true}, function (err) {
    if (err) {
      return done(err);
    }
    done(null, input.GR);
  });
};

/**
 * User 정보에서 group Id 를 제거한다.
 * @name updateUserToken
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 제거 후 수행할 callback function
 */
exports.removeGroupId = function (input, done) { // A, U, GR
  var query = {A: input.A, U: input.U};

  var data = {'$pull': {'GR': input.GR}};

  User.update(query, data, {multi: true}, function (err) {
    if (err) {
      return done(err);
    }
    done(null, input.GR);
  });
};

/**
 * Group내 포함된 User 목록을 조회한다.
 * @name listGroup
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 조회 후 수행할 callback function
 */
exports.listGroup = function (input, done) { // A, GR
  var query = {A: input.A, GR: input.GR};

  User.find(query, {U: 1, DT: 1, _id: 0}, function (err, users) {
    if (err) {
      return done(err);
    }
    return done(null, users);
  });
};

/**
 * User의 디바이스를 추가하거나 수정한다.
 * @name addDevice
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - device 등록 후 수행할 callback function
 */
exports.addDevice = function (input, done) { // A, U, D, N

  var query = {A: input.A, U: input.U};
  var data = {};
  data['DS.' + input.D + '.N'] = input.N;

  User.update(query, {'$set': data}, {upsert: true}, function (err) {
    if (err) return done(err);
    if (done) done(null);
  });
};

