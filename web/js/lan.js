/* Red Main — partida en red local (Wi-Fi / hotspot), sin internet ni servidor externo.
   El celu anfitrión levanta un servidor dentro de la app (LanServer.java, o
   tools/lan-server.cjs en una PC) que reenvía los mensajes entre jugadores.
   La lógica de la sala la lleva el anfitrión, igual que en el modo online. */
(function (RM) {
  'use strict';
  var N = RM.Online;
  var PORT = 47800, MAX = 4;
  var L = { ws: null, cid: null, hostCid: null, isHost: false, myId: null, cidToId: {}, game: [], leaveFns: [], leaving: false };
  var pendingFind = null;

  function clean(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max); }
  function uid() { return 'p' + Math.random().toString(36).slice(2, 10); }
  function send(o) { if (L.ws && L.ws.readyState === 1) L.ws.send(JSON.stringify(o)); }

  L.native = function () { return !!(RM.native && RM.native.lanHost); };

  function connect(url) {
    return new Promise(function (res, rej) {
      var ws;
      try { ws = new WebSocket(url); } catch (e) { rej(e); return; }
      var timer = setTimeout(function () { try { ws.close(); } catch (e) { /* nada */ } rej(new Error('No responde ' + url.replace('ws://', ''))); }, 5000);
      ws.onmessage = function (e) {
        var d; try { d = JSON.parse(e.data); } catch (err) { return; }
        if (d.t === '_hello' && L.cid == null) { L.cid = d.cid; clearTimeout(timer); res(); return; }
        handle(d);
      };
      ws.onerror = function () { clearTimeout(timer); rej(new Error('No se pudo conectar a ' + url.replace('ws://', ''))); };
      ws.onclose = function () {
        if (L.ws !== ws) return;
        var was = !!N.lobby && N.backend === 'lan';
        L.ws = null;
        if (!L.leaving && was) N._emit('closed', L.isHost ? 'Se cerró el servidor local.' : 'El anfitrión cerró la sala.');
      };
      L.ws = ws; L.cid = null;
    });
  }

  function pushState() {
    var lob = N.lobby;
    if (!lob || !L.isHost) return;
    send({ t: 'state', room: lob.room, players: lob.players, started: lob.started, hostCid: L.cid });
    N._emit('lobby', lob);
  }

  function handle(d) {
    var lob = N.lobby;
    if (d.t === 'p' || d.t === 'req' || d.t === 'w') { L.game.forEach(function (f) { f(d); }); return; }
    if (d.t === '_left') {
      if (L.isHost && lob) {
        var id = L.cidToId[d.cid];
        if (!id) return;
        delete L.cidToId[d.cid];
        var pl = lob.players.filter(function (p) { return p.id === id; })[0];
        lob.players = lob.players.filter(function (p) { return p.id !== id; });
        if (pl) send({ t: 'chatb', m: N._addChat('', pl.name + ' se fue.', true) });
        pushState();
        L.leaveFns.forEach(function (f) { f(id); });
      } else if (!L.isHost && d.cid === L.hostCid) {
        L.leave(); N._emit('closed', 'El anfitrión cerró la sala.');
      }
      return;
    }
    if (L.isHost) {
      if (!lob) return;
      if (d.t === 'join') {
        if (lob.started || lob.players.length >= MAX) { send({ t: 'denied', to: d.id, reason: lob.started ? 'La partida ya empezó.' : 'La sala está llena.' }); return; }
        var name = clean(d.name, 14) || 'Anónimo';
        L.cidToId[d.cid] = d.id;
        lob.players.push({ id: d.id, name: name, ready: false, ping: null });
        send({ t: 'welcome', to: d.id, room: lob.room, chat: N.chat.slice(-20) });
        send({ t: 'chatb', m: N._addChat('', name + ' entró a la sala.', true) });
        pushState();
        RM.audio.hover();
      } else if (d.t === 'chat') {
        var p = lob.players.filter(function (x) { return x.id === d.id; })[0];
        var text = clean(d.text, 120);
        if (p && text) send({ t: 'chatb', m: N._addChat(p.name, text) });
      } else if (d.t === 'ready') {
        lob.players.forEach(function (x) { if (x.id === d.id) x.ready = !!d.v; });
        pushState();
      }
    } else {
      if (d.t === 'welcome' && d.to === L.myId && L.onWelcome) L.onWelcome(d);
      else if (d.t === 'denied' && d.to === L.myId && L.onDenied) L.onDenied(d.reason);
      else if (d.t === 'state' && lob) {
        lob.room = d.room; lob.players = d.players; lob.started = d.started; L.hostCid = d.hostCid;
        N._emit('lobby', lob);
      } else if (d.t === 'chatb' && d.m) N._addChat(clean(d.m.from, 14), clean(d.m.text, 120), d.m.sys);
      else if (d.t === 'start' && lob) { lob.started = true; N._emit('start', lob); }
    }
  }

  // Crea la sala en este dispositivo.
  L.host = function (name, pcAddr) {
    var url, ips = [];
    if (L.native()) {
      var res;
      try { res = JSON.parse(RM.native.lanHost(name)); } catch (e) { return Promise.reject(e); }
      if (!res.ok) return Promise.reject(new Error(res.error || 'No se pudo abrir el servidor'));
      ips = res.ips || [];
      url = 'ws://127.0.0.1:' + res.port;
    } else {
      url = 'ws://' + (pcAddr || '127.0.0.1') + ':' + PORT;
    }
    L.leaving = false;
    return connect(url).then(function () {
      L.isHost = true; L.myId = 'host'; L.cidToId = {};
      N.backend = 'lan';
      N.chat = [];
      N.lobby = { isHost: true, me: 'host', started: false, room: { id: 'lan', name: 'Sala de ' + name, hostName: name, ips: ips }, players: [{ id: 'host', name: name, ready: true, host: true, ping: 0 }] };
      N._addChat('', ips.length ? 'Sala creada. Tus amigos se conectan a: ' + ips.join(' o ') : 'Sala creada en el servidor de PC.', true);
      pushState();
      return N.lobby;
    }, function (e) {
      if (L.native()) RM.native.lanStop();
      throw L.native() ? e : new Error('No hay servidor en esta PC. Abrí una terminal y corré: node tools/lan-server.cjs');
    });
  };

  L.join = function (addr, name) {
    addr = clean(addr, 64);
    if (!addr) return Promise.reject(new Error('Escribí la IP del anfitrión.'));
    var url = 'ws://' + (addr.indexOf(':') > 0 ? addr : addr + ':' + PORT);
    L.leaving = false;
    return connect(url).then(function () {
      return new Promise(function (res, rej) {
        L.isHost = false; L.myId = uid();
        var timer = setTimeout(function () { rej(new Error('El anfitrión no respondió.')); L.leave(); }, 6000);
        L.onWelcome = function (d) {
          clearTimeout(timer); L.onWelcome = null;
          N.backend = 'lan';
          N.chat = [];
          (d.chat || []).forEach(function (m) { N._addChat(m.from, m.text, m.sys); });
          N.lobby = { isHost: false, me: L.myId, started: false, room: d.room, players: [] };
          res(N.lobby);
        };
        L.onDenied = function (why) { clearTimeout(timer); rej(new Error(why)); L.leave(); };
        send({ t: 'join', id: L.myId, name: name, cid: L.cid });
      });
    });
  };

  // Busca salas en la red (en la app, por broadcast UDP).
  L.find = function () {
    if (L.native()) {
      return new Promise(function (res) {
        pendingFind = res;
        setTimeout(function () { if (pendingFind === res) { pendingFind = null; res([]); } }, 4000);
        RM.native.lanDiscover();
      });
    }
    // En el navegador: probar si hay un servidor de PC en esta misma máquina.
    return new Promise(function (res) {
      var ws, done = false;
      var fin = function (v) { if (done) return; done = true; try { ws.close(); } catch (e) { /* nada */ } res(v); };
      try { ws = new WebSocket('ws://127.0.0.1:' + PORT); } catch (e) { res([]); return; }
      ws.onopen = function () { fin([{ ip: '127.0.0.1', name: 'Servidor de esta PC', players: '?' }]); };
      ws.onerror = function () { fin([]); };
      setTimeout(function () { fin([]); }, 1500);
    });
  };
  L._found = function (list) { if (pendingFind) { var f = pendingFind; pendingFind = null; f(list || []); } };

  L.sendChat = function (text) {
    text = clean(text, 120);
    if (!text || !N.lobby) return;
    if (L.isHost) send({ t: 'chatb', m: N._addChat(N.lobby.players[0].name, text) });
    else send({ t: 'chat', id: L.myId, text: text });
  };
  L.setReady = function (v) { if (!L.isHost) send({ t: 'ready', id: L.myId, v: v }); };
  L.canStart = function () { var lob = N.lobby; return lob && L.isHost && lob.players.every(function (p) { return p.ready; }); };
  L.start = function () {
    if (!L.canStart()) return false;
    N.lobby.started = true;
    pushState();
    send({ t: 'start' });
    N._emit('start', N.lobby);
    return true;
  };
  L.endMatch = function () {
    var lob = N.lobby;
    if (!lob) return;
    lob.started = false;
    if (L.isHost) { lob.players.forEach(function (p) { if (!p.host) p.ready = false; }); pushState(); }
  };
  L.leave = function () {
    L.leaving = true;
    var ws = L.ws; L.ws = null;
    if (ws) try { ws.close(); } catch (e) { /* nada */ }
    if (L.isHost && L.native()) RM.native.lanStop();
    L.isHost = false; L.game = []; L.leaveFns = [];
    if (N.backend === 'lan') { N.lobby = null; N.chat = []; }
  };

  // Canal para el nivel cooperativo.
  L.gameNet = function () {
    L.game = []; L.leaveFns = [];
    return {
      isHost: L.isHost, myId: L.myId,
      players: N.lobby.players.map(function (p) { return { id: p.id, name: p.name }; }),
      send: send,
      on: function (f) { L.game.push(f); },
      onLeave: function (f) { L.leaveFns.push(f); }
    };
  };

  RM.LAN = L;
})(window.RM);
