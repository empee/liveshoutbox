#!/usr/bin/node
var mongo = require('mongoskin');
var db = mongo.db('mongodb://localhost:27017/livesms', { native_parser: true });
var fs = require('fs');
var spawn = require('child_process').spawn;
db.bind('users');
db.bind('messages');
db.bind('blocked');

var message = process.env.DECODED_0_TEXT ? process.env.DECODED_0_TEXT :
  process.env.SMS_1_TEXT ? process.env.SMS_1_TEXT : '';
var number = process.env.SMS_1_NUMBER ? process.env.SMS_1_NUMBER : '';

function log(msg) {
  fs.appendFileSync('/var/log/livesms.log', new Date().toISOString() + ' - ' + number + ' - ' + msg + '\n');
}

db.users.findOne({ number: number }, function (err, user) {
  if (err) return db.close();
  if (!user || message[0] === '!') handleCommand(user);
  else if (message.match(/^[a-z0-9åäöÅÄÖ_-]{3,15}:/i)) handlePrivate(user);
  else handleMessage(user);
});

function handleMessage(user) {
  var d = new Date();
  d.setSeconds(-180);
  db.messages.find({ user: user._id }).sort({ time: -1 }).limit(1).toArray(function (err, messages) {
    if (err) return db.close();
    if (!messages[0]) addMessage(user);
    else db.messages.count({ time: { $gt: messages[0].time } }, function (err, count) {
      if (count < 20 && messages[0].time >= d)
        return sendMessage(number, 'Voit lisätä uuden shoutbox viestin vain 3 minuutin tai 20 muiden lisäämän viestin jälkeen.');
      addMessage(user);
    });
  });
}

function addMessage(user) {
  if (message.replace(/[^0-9]/g, '').length >= 7) return db.close();
  db.messages.insert({ user: user, time: new Date(), message: message }, function (err) {
    if (err) return db.close();
    if (!user.disableNotification) sendMessage(number, 'Viestisi on lisätty jonoon. Voit poistaa tämän viestin käytöstä lähettämällä viestin "!hiljaa"');
    else db.close();
  });
}

function handlePrivate(user) {
  var parts = message.split(':');
  getUser(parts.shift(), false, function (usr) {
    sendPrivate(user, usr, parts.join(':').trim());
  });
}

function handleCommand(user) {
  var parts = message.split(' ');
  var cmd = parts.shift().toLowerCase();
  if (cmd !== '!rekisteröidy' && !user) cmd = '';

  switch (cmd) {
    case '!rekisteröidy':
      var name = parts.shift();
      if (!name.match(/^[a-z0-9åäöÅÄÖ_-]{3,15}$/i)) {
        return sendMessage(number, 'Nimimerkki "' + name + '" ei kelpaa.');
      }
      var color = '' + parts.shift();

      switch (color.toLowerCase()) {
        case 'sininen': color = 'blue'; break;
        case 'pinkki': color = 'pink'; break;
        case 'vihreä': color = 'green'; break;
        case 'oranssi': color = 'orange'; break;
        case 'keltainen': color = 'yellow'; break;
        case 'superkeltainen': color = 'superyellow'; break;
        default: color = 'white'; break;
      }

      db.users.findOne({ nameLC: name.toLowerCase() }, function (err, usr) {
        if (err) return db.close();
        if (usr) return sendMessage(number, 'Nimimerkki "' + name + '" on jo käytössä.');

        db.users.insert({ number: number, nameLC: name.toLowerCase(), name: name, color: color, allowPrivate: true, regTime: new Date() }, function (err) {
          if (err) return db.close();
          sendMessage(number, 'Nimimerkki rekisteröity! Voit nyt lähettää shoutbox viestin lähettämällä viestin tähän numeroon. Voit lähettää yksityisviestin kirjoittamalla "nimimerkki: viestisi". Voit estää yksityisviestejen lähettämisen lähettämällä viestin "!estäpriva". Voit estää yksittäisen nimimerkin lähettämällä viestin "!estä nimimerkki". Voit vaihtaa väriä lähettämällä viestin "!väri uusiväri".');
        });
      });
    break;
    case '!estäpriva':
      db.users.update({ _id: user._id }, { $set: { allowPrivate: false } }, function (err) {
        if (err) return db.close();
        sendMessage(user.number, 'Yksityisviestit on nyt estetty. Voit sallia yksityisviestit uudelleen lähettämällä viestin "!sallipriva".');
      });
    break;
    case '!estä':
      getUser(parts.shift(), true, function (usr) {
        db.blocked.insert({ user: user._id, blocked: usr._id }, function (err) {
          if (err) return db.close();
          sendMessage(user.number, 'Nimimerkin "' + usr.name + '" yksityisviestit on nyt estetty. Voit sallia yksityisviestit uudelleen lähettämällä viestin "!salli ' + usr.name + '".');
        });
      });
    break;
    case '!sallipriva':
      db.users.update({ _id: user._id }, { $set: { allowPrivate: true } }, function (err) {
        if (err) return db.close();
        sendMessage(user.number, 'Yksityisviestit on nyt sallittu.');
      });
    break;
    case '!salli':
      getUser(parts.shift(), true, function (usr) {
        db.blocked.findOne({ user: user._id, blocked: usr._id }, function (err, block) {
          if (err || !block) return db.close();
          db.blocked.remove({ _id: block._id }, function (err) {
            if (err) return db.close();
            sendMessage(user.number, 'Nimimerkin "' + usr.name + '" yksityisviestit on nyt sallittu.');
          });
        });
      });
    break;
    case '!hiljaa':
      db.users.update({ _id: user._id }, { $set: { disableNotification: true } }, function (err) {
        if (err) return db.close();
        sendMessage(user.number, 'Shoutbox viestin lisäys ilmoitukset hiljennetty.');
      });
    break;
    case '!väri':
      var color = '' + parts.shift();

      switch (color.toLowerCase()) {
        case 'sininen': color = 'blue'; break;
        case 'pinkki': color = 'pink'; break;
        case 'vihreä': color = 'green'; break;
        case 'oranssi': color = 'orange'; break;
        case 'keltainen': color = 'yellow'; break;
        case 'superkeltainen': color = 'superyellow'; break;
        default: color = 'white'; break;
      }

      db.users.update({ _id: user._id }, { $set: { color: color } }, function (err) {
        if (err) return db.close();
        sendMessage(user.number, 'Väri vaihdettu.');
      });
    break;
    default:
      sendMessage(number, 'Sinun tulee rekisteröidä itsellesi nimimerkki / väri. Rekisteröinti onnistuu lähettämällä viesti "!rekisteröidy nimimerkki väri", ilman lainausmerkkejä. Värit ovat sininen, pinkki, vihreä, oranssi ja keltainen.');
  }
}

function getUser(name, restrictNames, callback) {
  db.users.findOne({ nameLC: name.toLowerCase() }, function (err, user) {
    if (err) return db.close();
    if (!user) return sendMessage(number, 'Nimimerkillä "' + name + '" ei löytynyt ketään.');
    callback(user);
  });
}

function sendPrivate(from, to, message) {
  if (!from.allowPrivate || !to.allowPrivate) return db.close();
  db.blocked.findOne({ $or: [{ user: to._id, blocked: from._id }, { user: from._id, blocked: to._id }] }, function (err, block) {
    if (err || block) return db.close();
    sendMessage(to.number, from.name + ': ' + message);
  });
}

function sendMessage(num, msg) {
  var params = ['TEXT', num, '-len', msg.length, '-unicode', '-text', msg];
  spawn('gammu-smsd-inject', params, { detached: true, stdio: 'ignore' });
  db.close();
}
