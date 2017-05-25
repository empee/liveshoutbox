var express = require('express');
var app = express();
var mongo = require('mongoskin');
var db = mongo.db('mongodb://localhost:27017/livesms', { native_parser: true });
db.bind('messages');

app.use(express.static('ui'));

app.get('/messages', function (req, res) {
  res.header('content-type', 'application/json');
  if (!req.query.id) {
    db.messages.find({}).sort({ time: -1 }).limit(30).toArray(function (err, messages) {
      if (err) return res.end(JSON.stringify([]));
      res.end(JSON.stringify(messages.reverse().map(function (message) {
        return { id: message._id, time: message.time, name: message.user.name, color: message.user.color, message: message.message };
      })));
    });
  } else {
    db.messages.find({ _id: { $gt: mongo.helper.toObjectID(req.query.id) } }).sort({ time: 1 }).toArray(function (err, messages) {
      if (err) return res.end(JSON.stringify([]));
      res.end(JSON.stringify(messages.map(function (message) {
        return { id: message._id, time: message.time, name: message.user.name, color: message.user.color, message: message.message };
      })));
    });
  }
});

app.listen(8080, 'localhost');
