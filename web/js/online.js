/* Red Main — mini online P2P con PeerJS.
   Cada sala es un peer con id fijo "redmain-v1-sala-N" (N = 1..MAX_ROOMS): el
   buscador prueba esos ids para listar las salas activas sin servidor propio.
   El anfitrión mantiene el estado y lo reenvía a todos (chat, listos, inicio). */
(function (RM) {
  'use strict';
  var PREFIX = 'redmain-v1-sala-';
  var MAX_ROOMS = 8, MAX_PLAYERS = 4;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return RM.Screens.esc(s); };

  var N = {
    peer: null, hostPeer: null, conn: null, conns: {},
    status: 'off', rooms: [], lobby: null, chat: [], handlers: {},
    leaving: false
  };

  function emit(ev, data) { (N.handlers[ev] || []).forEach(function (f) { f(data); }); }
  N.on = function (ev, f) { (N.handlers[ev] = N.handlers[ev] || []).push(f); };

  function peerOptions() {
    // Servidor propio opcional: ?peer=host:puerto o localStorage "redmain.peer".
    var opt = null;
    var q = /[?&]peer=([^&]+)/.exec(location.search);
    try { opt = q ? { url: decodeURIComponent(q[1]) } : JSON.parse(localStorage.getItem('redmain.peer') || 'null'); } catch (e) { opt = null; }
    if (opt && opt.url) {
      var m = /^(https?:\/\/)?([^:/]+)(?::(\d+))?(\/.*)?$/.exec(opt.url);
      if (m) return { host: m[2], port: +(m[3] || (m[1] === 'https://' ? 443 : 80)), path: m[4] || '/', secure: m[1] === 'https://', debug: 0 };
    }
    return { debug: 0 };
  }

  function clean(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max); }

  N.name = function () {
    var n = localStorage.getItem('redmain.netname');
    if (!n) { n = 'Jugador' + (1000 + Math.floor(Math.random() * 9000)); try { localStorage.setItem('redmain.netname', n); } catch (e) { /* sin almacenamiento */ } }
    return n;
  };
  N.setName = function (n) { n = clean(n, 14) || N.name(); try { localStorage.setItem('redmain.netname', n); } catch (e) { /* sin almacenamiento */ } return n; };

  function setStatus(s, msg) { N.status = s; N.statusMsg = msg || ''; emit('status', s); }

  function loadLib() {
    if (window.Peer) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'lib/peerjs.min.js';
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('No se pudo cargar PeerJS')); };
      document.head.appendChild(s);
    });
  }

  // Conecta al intermediario de PeerJS (solo para presentarse; los datos van P2P).
  N.connect = function () {
    if (N.peer && !N.peer.destroyed && !N.peer.disconnected && N.status === 'on') return Promise.resolve();
    setStatus('connecting');
    return loadLib().then(function () {
      return new Promise(function (res, rej) {
        if (N.peer) { try { N.peer.destroy(); } catch (e) { /* ya cerrado */ } }
        var p = new window.Peer(undefined, peerOptions());
        N.peer = p;
        var timer = setTimeout(function () { rej(new Error('timeout')); }, 9000);
        p.on('open', function () { clearTimeout(timer); setStatus('on'); res(); });
        p.on('error', function (err) {
          if (err.type === 'peer-unavailable') { probeFailed(err); return; }
          clearTimeout(timer);
          if (N.status === 'connecting') rej(err);
          setStatus('error', err.type);
        });
        p.on('disconnected', function () { if (N.status === 'on') setStatus('error', 'disconnected'); });
      });
    }).catch(function (e) { setStatus('error', e && (e.type || e.message)); throw e; });
  };

  /* ---------- Buscador de salas ---------- */

  var probes = {};
  function probeFailed(err) {
    var m = /(redmain-v1-sala-\d+)/.exec(err.message || '');
    if (m && probes[m[1]]) probes[m[1]](null);
  }

  N.scan = function () {
    if (!N.peer || N.status !== 'on') return Promise.resolve([]);
    emit('scanning');
    var jobs = [];
    for (var i = 1; i <= MAX_ROOMS; i++) jobs.push(probe(PREFIX + i, i));
    return Promise.all(jobs).then(function (list) {
      N.rooms = list.filter(Boolean);
      emit('rooms', N.rooms);
      return N.rooms;
    });
  };

  function probe(id, n) {
    return new Promise(function (res) {
      var done = false, t0 = performance.now(), conn;
      var finish = function (v) {
        if (done) return; done = true; delete probes[id];
        try { if (conn) conn.close(); } catch (e) { /* ya cerrado */ }
        res(v);
      };
      probes[id] = finish;
      if (N.hostPeer && N.hostPeer.id === id) { finish(null); return; }
      setTimeout(function () { finish(null); }, 5000);
      try { conn = N.peer.connect(id, { reliable: true, metadata: { kind: 'probe' } }); } catch (e) { finish(null); return; }
      conn.on('open', function () { t0 = performance.now(); conn.send({ t: 'probe' }); });
      conn.on('data', function (d) {
        if (d && d.t === 'info') finish({ id: id, n: n, name: clean(d.name, 24), host: clean(d.host, 14), players: d.players | 0, max: d.max | 0, started: !!d.started, ping: Math.round(performance.now() - t0) });
      });
      conn.on('error', function () { finish(null); });
    });
  }

  /* ---------- Anfitrión ---------- */

  function hostSummary() {
    var L = N.lobby;
    return { t: 'info', name: L.room.name, host: L.room.hostName, players: L.players.length, max: MAX_PLAYERS, started: L.started };
  }

  function broadcast(msg) {
    Object.keys(N.conns).forEach(function (k) { try { N.conns[k].send(msg); } catch (e) { /* conexión caída */ } });
  }

  function pushState() {
    var L = N.lobby;
    var st = { t: 'state', room: L.room, players: L.players, started: L.started };
    broadcast(st);
    emit('lobby', L);
  }

  function addChat(from, text, sys) {
    var m = { from: from, text: text, sys: !!sys };
    N.chat.push(m); if (N.chat.length > 60) N.chat.shift();
    emit('chat', m);
    return m;
  }

  N.host = function (myName) {
    var free = [];
    var taken = {};
    N.rooms.forEach(function (r) { taken[r.n] = true; });
    for (var i = 1; i <= MAX_ROOMS; i++) if (!taken[i]) free.push(i);
    if (!free.length) return Promise.reject(new Error('full'));
    return new Promise(function (res, rej) {
      var tryNext = function () {
        if (!free.length) { rej(new Error('full')); return; }
        var n = free.shift();
        var hp = new window.Peer(PREFIX + n, peerOptions());
        hp.on('open', function () {
          N.hostPeer = hp; N.backend = 'peer';
          N.chat = [];
          N.lobby = {
            isHost: true, me: 'host', started: false,
            room: { id: PREFIX + n, n: n, name: 'Sala de ' + myName, hostName: myName },
            players: [{ id: 'host', name: myName, ready: true, ping: 0, host: true }]
          };
          hp.on('connection', onHostConnection);
          N.pingTimer = setInterval(function () { broadcast({ t: 'ping', at: performance.now() }); }, 2000);
          addChat('', 'Creaste la sala. Esperando jugadores…', true);
          pushState();
          res(N.lobby);
        });
        hp.on('error', function (err) {
          if (err.type === 'unavailable-id') { hp.destroy(); tryNext(); }
          else if (!N.hostPeer) { hp.destroy(); rej(err); }
        });
      };
      tryNext();
    });
  };

  function onHostConnection(conn) {
    var kind = conn.metadata && conn.metadata.kind;
    conn.on('data', function (d) {
      if (!d || !N.lobby) return;
      var L = N.lobby, pl;
      if (d.t === 'probe') { conn.send(hostSummary()); return; }
      if (d.t === 'join' && kind === 'join') {
        if (L.started || L.players.length >= MAX_PLAYERS) {
          conn.send({ t: 'denied', reason: L.started ? 'La partida ya empezó.' : 'La sala está llena.' });
          setTimeout(function () { conn.close(); }, 400);
          return;
        }
        var name = clean(d.name, 14) || 'Anónimo';
        N.conns[conn.peer] = conn;
        L.players.push({ id: conn.peer, name: name, ready: false, ping: null });
        conn.send({ t: 'welcome', id: conn.peer, chat: N.chat.slice(-20) });
        var m = addChat('', name + ' entró a la sala.', true);
        broadcast({ t: 'chat', m: m });
        pushState();
        RM.audio.hover();
        return;
      }
      pl = L.players.filter(function (p) { return p.id === conn.peer; })[0];
      if (!pl) return;
      if (d.t === 'p' || d.t === 'req') {
        N.gameFns.forEach(function (f) { f(d); });
        if (d.t === 'p') Object.keys(N.conns).forEach(function (k) { if (k !== conn.peer) try { N.conns[k].send(d); } catch (e) { /* caída */ } });
        return;
      }
      if (d.t === 'chat') {
        var text = clean(d.text, 120);
        if (!text) return;
        broadcast({ t: 'chat', m: addChat(pl.name, text) });
      } else if (d.t === 'ready') {
        pl.ready = !!d.v; pushState();
      } else if (d.t === 'pong') {
        pl.ping = Math.round(performance.now() - d.at); emit('lobby', L);
      }
    });
    conn.on('close', function () {
      if (!N.lobby || !N.conns[conn.peer]) return;
      delete N.conns[conn.peer];
      var L = N.lobby;
      var pl = L.players.filter(function (p) { return p.id === conn.peer; })[0];
      L.players = L.players.filter(function (p) { return p.id !== conn.peer; });
      if (pl) broadcast({ t: 'chat', m: addChat('', pl.name + ' se fue.', true) });
      pushState();
      N.leaveFns.forEach(function (f) { f(conn.peer); });
    });
  }

  /* ---------- Invitado ---------- */

  N.join = function (room, myName) {
    return new Promise(function (res, rej) {
      N.backend = 'peer';
      var conn = N.peer.connect(room.id, { reliable: true, metadata: { kind: 'join' } });
      var timer = setTimeout(function () { rej(new Error('No respondió la sala.')); try { conn.close(); } catch (e) { /* nada */ } }, 8000);
      N.conn = conn;
      N.chat = [];
      conn.on('open', function () { conn.send({ t: 'join', name: myName }); });
      conn.on('data', function (d) {
        if (!d) return;
        if (d.t === 'p' || d.t === 'w' || d.t === 'ww' || d.t === 'ev') { N.gameFns.forEach(function (f) { f(d); }); return; }
        if (d.t === 'denied') { clearTimeout(timer); rej(new Error(d.reason)); return; }
        if (d.t === 'welcome') {
          clearTimeout(timer);
          N.lobby = { isHost: false, me: d.id, started: false, room: { id: room.id, name: room.name, hostName: room.host }, players: [] };
          (d.chat || []).forEach(function (m) { addChat(m.from, m.text, m.sys); });
          res(N.lobby);
        } else if (d.t === 'state' && N.lobby) {
          N.lobby.room = d.room; N.lobby.players = d.players; N.lobby.started = d.started;
          emit('lobby', N.lobby);
        } else if (d.t === 'chat' && d.m) {
          addChat(clean(d.m.from, 14), clean(d.m.text, 120), d.m.sys);
        } else if (d.t === 'ping') {
          conn.send({ t: 'pong', at: d.at });
        } else if (d.t === 'start') {
          if (N.lobby) N.lobby.started = true;
          emit('start', N.lobby);
        }
      });
      conn.on('close', function () {
        if (!N.leaving && N.lobby) emit('closed', 'El anfitrión cerró la sala.');
      });
    });
  };

  /* ---------- Acciones en la sala ---------- */

  N.sendChat = function (text) {
    if (N.backend === 'lan') return RM.LAN.sendChat(text);
    text = clean(text, 120);
    if (!text || !N.lobby) return;
    if (N.lobby.isHost) broadcast({ t: 'chat', m: addChat(N.lobby.players[0].name, text) });
    else if (N.conn) N.conn.send({ t: 'chat', text: text });
  };

  N.setReady = function (v) {
    if (N.backend === 'lan') return RM.LAN.setReady(v);
    if (!N.lobby || N.lobby.isHost) return;
    N.conn.send({ t: 'ready', v: v });
  };

  N.canStart = function () {
    if (N.backend === 'lan') return RM.LAN.canStart();
    var L = N.lobby;
    return L && L.isHost && L.players.every(function (p) { return p.ready; });
  };

  N.start = function () {
    if (N.backend === 'lan') return RM.LAN.start();
    if (!N.canStart()) return false;
    N.lobby.started = true;
    pushState();
    broadcast({ t: 'start' });
    emit('start', N.lobby);
    return true;
  };

  // Al volver de la partida, la sala se reabre para que puedan entrar otros.
  N.endMatch = function () {
    if (N.backend === 'lan') return RM.LAN.endMatch();
    var L = N.lobby;
    if (!L) return;
    L.started = false;
    if (L.isHost) { L.players.forEach(function (p) { if (!p.host) p.ready = false; }); pushState(); }
  };

  N.leave = function () {
    if (N.backend === 'lan') { RM.LAN.leave(); N.backend = 'peer'; return; }
    N.leaving = true;
    if (N.pingTimer) { clearInterval(N.pingTimer); N.pingTimer = null; }
    if (N.hostPeer) { try { N.hostPeer.destroy(); } catch (e) { /* nada */ } N.hostPeer = null; }
    if (N.conn) { try { N.conn.close(); } catch (e) { /* nada */ } N.conn = null; }
    N.conns = {};
    N.lobby = null;
    N.chat = [];
    setTimeout(function () { N.leaving = false; }, 300);
  };

  N.MAX_PLAYERS = MAX_PLAYERS;
  N._emit = emit;
  N._addChat = addChat;
  N.backend = 'peer';
  N.gameFns = []; N.leaveFns = [];

  // Canal para el nivel cooperativo (por internet). En red local lo da RM.LAN.
  N.gameNet = function () {
    if (N.backend === 'lan') return RM.LAN.gameNet();
    var L = N.lobby;
    N.gameFns = []; N.leaveFns = [];
    return {
      isHost: L.isHost, myId: L.me,
      players: L.players.map(function (p) { return { id: p.id, name: p.name }; }),
      send: function (m) { if (L.isHost) broadcast(m); else if (N.conn) N.conn.send(m); },
      on: function (f) { N.gameFns.push(f); },
      onLeave: function (f) { N.leaveFns.push(f); }
    };
  };

  /* ---------- Interfaz ---------- */

  var UI = {};
  var autoTimer = null;

  UI.tab = 'lan';

  UI.statusText = function () {
    if (UI.tab === 'lan') return '<i class="dot on"></i>Red local' + (N.backend === 'lan' && N.lobby && N.lobby.isHost ? ' · hosteando' : '');
    if (N.status === 'on') return '<i class="dot on"></i>Conectado';
    if (N.status === 'connecting') return '<i class="dot wait"></i>Conectando…';
    return '<i class="dot off"></i>Sin conexión';
  };

  UI.renderStatus = function () { $('netStatus').innerHTML = UI.statusText(); };

  UI.renderRooms = function (scanning) {
    var list = $('srvList');
    if (N.status !== 'on') {
      list.innerHTML = '<div class="srv-empty"><b>No se pudo conectar al servidor de salas.</b><br>Revisá tu conexión a internet.<br><button class="btn sm" id="netRetry">Reintentar</button></div>';
      return;
    }
    if (scanning && !N.rooms.length) {
      list.innerHTML = '<div class="srv-empty"><span class="spin"></span> Buscando salas activas…</div>';
      return;
    }
    if (!N.rooms.length) {
      list.innerHTML = '<div class="srv-empty">No hay salas activas ahora.<br>¡Creá una y que se sumen tus amigos!</div>';
      return;
    }
    list.innerHTML = N.rooms.map(function (r) {
      var full = r.players >= r.max || r.started;
      var bars = r.ping < 80 ? 3 : r.ping < 180 ? 2 : 1;
      var sig = '<span class="sig s' + bars + '"><i></i><i></i><i></i></span>';
      return '<div class="srv">' +
        '<span class="srv-name">' + esc(r.name) + (r.started ? ' <span class="badge">En juego</span>' : '') + '</span>' +
        '<span>' + esc(r.host) + '</span>' +
        '<span>' + r.players + '/' + r.max + '</span>' +
        '<span>' + sig + r.ping + ' ms</span>' +
        '<span><button class="btn sm' + (full ? ' ghost' : '') + '" data-join="' + r.n + '"' + (full ? ' disabled' : '') + '>' + (full ? 'Llena' : 'Entrar') + '</button></span></div>';
    }).join('');
  };

  UI.renderLobby = function () {
    var L = N.lobby;
    if (!L) return;
    $('lobbyName').textContent = L.room.name;
    var where = L.isHost && L.room.ips && L.room.ips.length ? ' · Conectarse a: ' + L.room.ips.join(' / ') : '';
    $('lobbySub').textContent = (L.isHost ? 'Sos el anfitrión' : 'Anfitrión: ' + L.room.hostName) + ' · ' + L.players.length + '/' + MAX_PLAYERS + ' jugadores' + where;
    var rows = [];
    for (var i = 0; i < MAX_PLAYERS; i++) {
      var p = L.players[i];
      if (!p) { rows.push('<li class="pl empty">Esperando jugador…</li>'); continue; }
      var me = p.id === L.me;
      rows.push('<li class="pl' + (me ? ' me' : '') + '"><span class="av">' + esc(p.name.charAt(0).toUpperCase()) + '</span>' +
        '<span class="pl-name">' + esc(p.name) + (p.host ? ' <span class="badge">Anfitrión</span>' : '') + (me ? ' <span class="badge red">Vos</span>' : '') + '</span>' +
        '<span class="pl-ping">' + (p.host ? '' : (p.ping == null ? '…' : p.ping + ' ms')) + '</span>' +
        '<span class="pl-ready ' + (p.ready ? 'ok' : '') + '">' + (p.ready ? 'LISTO' : 'ESPERANDO') + '</span></li>');
    }
    $('lobbyPlayers').innerHTML = rows.join('');
    var meP = L.players.filter(function (p) { return p.id === L.me; })[0];
    $('lobbyReady').hidden = L.isHost;
    if (meP) $('lobbyReady').textContent = meP.ready ? 'Ya no estoy listo' : 'Estoy listo';
    $('lobbyStart').hidden = !L.isHost;
    $('lobbyStart').disabled = !N.canStart();
    $('lobbyStart').textContent = N.canStart() ? 'Iniciar partida' : 'Esperando que estén listos';
  };

  UI.appendChat = function (m) {
    var log = $('chatLog');
    var div = document.createElement('div');
    div.className = 'msg' + (m.sys ? ' sys' : '');
    div.innerHTML = m.sys ? esc(m.text) : '<b>' + esc(m.from) + ':</b> ' + esc(m.text);
    log.appendChild(div);
    while (log.children.length > 60) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  };

  UI.showLobby = function (on) {
    $('netTop').hidden = on;
    $('lanBrowser').hidden = on || UI.tab !== 'lan';
    $('netBrowser').hidden = on || UI.tab !== 'net';
    $('netLobby').hidden = !on;
    UI.renderStatus();
    if (on) { $('chatLog').innerHTML = ''; N.chat.forEach(UI.appendChat); UI.renderLobby(); }
  };

  UI.toast = function (text) {
    var t = $('netToast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(UI.toastTimer);
    UI.toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  };

  UI.refresh = function () {
    UI.renderRooms(true);
    return N.scan().then(function () { UI.renderRooms(false); });
  };

  /* --- Red local --- */
  UI.lanRooms = [];
  UI.renderLan = function (searching) {
    var list = $('lanList');
    if (searching && !UI.lanRooms.length) { list.innerHTML = '<div class="srv-empty"><span class="spin"></span> Buscando partidas en tu red…</div>'; return; }
    if (!UI.lanRooms.length) {
      list.innerHTML = '<div class="srv-empty">No se encontraron partidas en esta red.<br>Tocá <b>Hostear partida</b> en un celu y <b>Buscar</b> en el otro, o conectate por IP.</div>';
      return;
    }
    list.innerHTML = UI.lanRooms.map(function (r) {
      return '<div class="srv"><span class="srv-name">' + esc(r.name) + '</span><span>' + esc(r.ip) + '</span><span>' + esc(String(r.players)) + '/' + MAX_PLAYERS + '</span><span></span>' +
        '<span><button class="btn sm" data-lan-ip="' + esc(r.ip) + '">Entrar</button></span></div>';
    }).join('');
  };
  UI.findLan = function () {
    UI.renderLan(true);
    return RM.LAN.find().then(function (list) { UI.lanRooms = list; UI.renderLan(false); });
  };
  UI.joinLan = function (ip, btn) {
    RM.audio.select();
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }
    RM.LAN.join(ip, N.setName($('netName').value)).then(function () { UI.showLobby(true); }, function (err) {
      UI.toast(err.message || 'No se pudo conectar.'); UI.renderLan(false);
      if (btn) { btn.disabled = false; btn.textContent = 'Conectar'; }
    });
  };

  UI.showTab = function (tab) {
    UI.tab = tab;
    document.querySelectorAll('#netTabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
    UI.showLobby(false);
    if (tab === 'lan') UI.findLan();
    else if (N.status === 'on') UI.refresh();
    else { UI.renderRooms(true); N.connect().then(UI.refresh, function () { UI.renderRooms(false); }); }
  };

  UI.open = function () {
    $('netName').value = N.name();
    if (N.lobby) { UI.showLobby(true); }
    else UI.showTab(UI.tab);
    clearInterval(autoTimer);
    autoTimer = setInterval(function () { if (!N.lobby && UI.tab === 'net' && N.status === 'on') N.scan().then(function () { UI.renderRooms(false); }); }, 9000);
  };
  UI.close = function () { clearInterval(autoTimer); };

  UI.bind = function (onStart) {
    N.on('status', UI.renderStatus);
    N.on('lobby', UI.renderLobby);
    N.on('chat', function (m) { if (!$('netLobby').hidden) UI.appendChat(m); });
    N.on('start', function (L) { onStart(L); });
    N.on('closed', function (why) { N.leave(); UI.showLobby(false); UI.toast(why); UI.showTab(UI.tab); });
    $('netTabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      RM.audio.hover(); UI.showTab(b.getAttribute('data-tab'));
    });
    $('lanFind').addEventListener('click', function () { RM.audio.hover(); UI.findLan(); });
    $('lanHost').addEventListener('click', function () {
      RM.audio.select();
      var b = $('lanHost'); b.disabled = true;
      RM.LAN.host(N.setName($('netName').value), $('lanIp').value.trim() || null).then(function () { b.disabled = false; UI.showLobby(true); }, function (err) {
        b.disabled = false; UI.toast(err.message || 'No se pudo hostear.');
      });
    });
    $('lanJoinIp').addEventListener('click', function () { UI.joinLan($('lanIp').value.trim(), $('lanJoinIp')); });
    $('lanList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-lan-ip]'); if (b) UI.joinLan(b.getAttribute('data-lan-ip'), b);
    });
    $('netName').addEventListener('change', function (e) { e.target.value = N.setName(e.target.value); });
    $('netRefresh').addEventListener('click', function () { RM.audio.hover(); UI.refresh(); });
    $('srvList').addEventListener('click', function (e) {
      if (e.target.id === 'netRetry') {
        RM.audio.hover();
        UI.renderRooms(true);
        N.connect().then(UI.refresh, function () { UI.renderRooms(false); });
        return;
      }
      var b = e.target.closest('[data-join]');
      if (!b) return;
      var room = N.rooms.filter(function (r) { return r.n === +b.getAttribute('data-join'); })[0];
      if (!room) return;
      RM.audio.select();
      b.disabled = true; b.textContent = 'Entrando…';
      N.join(room, N.setName($('netName').value)).then(function () { UI.showLobby(true); }, function (err) {
        UI.toast(err.message || 'No se pudo entrar.'); UI.refresh();
      });
    });
    $('netCreate').addEventListener('click', function () {
      if (N.status !== 'on') { UI.toast('Primero necesitás conexión.'); return; }
      RM.audio.select();
      var b = $('netCreate'); b.disabled = true;
      N.host(N.setName($('netName').value)).then(function () { b.disabled = false; UI.showLobby(true); }, function (err) {
        b.disabled = false; UI.toast(err.message === 'full' ? 'Todas las salas están ocupadas.' : 'No se pudo crear la sala.');
      });
    });
    $('lobbyLeave').addEventListener('click', function () { RM.audio.back(); N.leave(); UI.showTab(UI.tab); });
    $('lobbyReady').addEventListener('click', function () {
      var L = N.lobby; if (!L) return;
      var meP = L.players.filter(function (p) { return p.id === L.me; })[0];
      RM.audio.hover(); RM.vibrate([15]);
      N.setReady(!(meP && meP.ready));
    });
    $('lobbyStart').addEventListener('click', function () { if (N.start()) RM.audio.select(); });
    $('chatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = $('chatInput');
      N.sendChat(inp.value); inp.value = '';
    });
  };

  N.UI = UI;
  RM.Online = N;
})(window.RM);
