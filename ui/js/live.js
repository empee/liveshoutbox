(function () {
  var lastId;;
  var content = document.getElementById('content');
  var subTitle = document.getElementById('sub-title');
  var que = document.getElementById('que');
  var queue = [];

  function fetch(renderAll) {
    var req = new XMLHttpRequest();
    req.open('GET', '/messages' + (lastId !== undefined ? '?id=' + lastId : ''));
    req.addEventListener('load', function () {
      if (req.status !== 200) return;
      try {
        var messages = JSON.parse(req.responseText), len = messages.length;
        if (len === 0) return;
        lastId = messages[messages.length - 1].id;
        queue = queue.concat(messages);
        if (renderAll) {
          var msg;
          while (msg = queue.shift()) {
            renderMessage(msg);
            clean();
          }
        }
      } catch (e) {}
    });
    req.send();
  }

  function renderQueue(renderAll) {
    var msg = queue.shift();
    if (!msg) {
      fetch(renderAll);
      setTimeout(renderQueue, 1000);
    } else {
      renderMessage(msg);
      clean();
      if (queue.length <= 1) {
        fetch(renderAll);
        setTimeout(renderQueue, 3000);
      } else if (queue.length > 20) {
        setTimeout(renderQueue, 3000);
      } else if (queue.length > 10) {
        setTimeout(renderQueue, 4000);
      } else setTimeout(renderQueue, 5000);
      if (queue.length > 0) {
        subTitle.style.lineHeight = '30px';
        que.innerText = 'Jonossa ' + queue.length + ' viestiä';
      } else {
        subTitle.style.lineHeight = '';
        que.innerText = '';
      }
    }
  }

  renderQueue(true);

  function renderMessage(message) {
    var msg = document.createElement('div');
    msg.classList.add('message');
    var name = document.createElement('span');
    name.classList.add(message.color);
    name.innerText = message.name;
    msg.appendChild(name);
    var txt = document.createTextNode(message.message);
    msg.appendChild(txt);
    content.appendChild(msg);
    content.scrollTop = content.scrollHeight;
  }

  function clean() {
    var elements = [].slice.call(content.querySelectorAll('.message')), len = elements.length;
    for (var i = 0; i < len; i++) {
      var r = elements[i].getBoundingClientRect();
      if (r.top + r.height < -50) {
        content.removeChild(elements[i]);
        content.scrollTop = content.scrollHeight;
      } else break;
    }
  }
})();
