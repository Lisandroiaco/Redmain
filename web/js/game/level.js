/* Red Main — motor del nivel jugable (2D desde arriba, arte vectorial).
   Solo o cooperativo: el anfitrión es la autoridad del mundo (objetos, forja,
   llave, portón) y reparte el estado; cada jugador envía su posición. */
(function (RM) {
  'use strict';
  var clamp = RM.clamp, rand = RM.rand, A = RM.Art2, TL = A.TILE;
  var T = 32;
  var SPEED = { walk: 104, run: 184, crouch: 52 };
  var RECIPE = ['ingot', 'ingot2', 'coal', 'nails', 'hammer'];
  var MODE_CODE = { walk: 0, run: 1, crouch: 2 }, CODE_MODE = ['walk', 'run', 'crouch'];

  // opts: { onExit(won), net: null | { isHost, myId, players:[{id,name}], send(msg), on(fn), onLeave(fn) } }
  function Level(opts) {
    this.onExit = opts.onExit;
    this.net = opts.net || null;
    this.ready = false;
  }

  /* ---------- Carga ---------- */

  Level.prototype.tasks = function () {
    var self = this;
    return [
      function () { self.map = RM.Castle.build(); },
      function () { self.ghost = makeGhost(); },
      function () { self.reset(); },
      function () { self.ready = true; }
    ];
  };

  // Texturas a la resolución actual (se rehacen si cambia la escala).
  Level.prototype.buildTextures = function (k) {
    var tx = { k: k, floor: {}, wallFace: [], props: {}, decal: {}, deco: {}, icon: {} };
    [TL.STONE, TL.WOOD, TL.CARPET, TL.GRASS, TL.CRYPT, TL.OUT, TL.DIRT, TL.CHECK].forEach(function (t) {
      tx.floor[t] = [0, 1, 2].map(function (v) { return A.floor(t, v, k); });
    });
    tx.wallFace = [0, 1, 2].map(function (v) { return A.wallFace(v, k); });
    tx.wallTop = A.wallTop(k);
    Object.keys(A.PROP).forEach(function (p) { if (A.PROP[p].draw) tx.props[p] = A.prop(p, k); });
    var D = DECAL_ART;
    Object.keys(D).forEach(function (d) { tx.decal[d] = render(D[d][0], D[d][1], k, D[d][2]); });
    Object.keys(DECO_ART).forEach(function (d) { tx.deco[d] = render(DECO_ART[d][0], DECO_ART[d][1], k, DECO_ART[d][2]); });
    tx.light = makeLightTex();
    tx.warm = tint(tx.light, '#ff7a20');
    this.tex = tx;
  };

  function render(w, h, k, painter) {
    var c = RM.canvas(Math.ceil(w * k), Math.ceil(h * k)), g = c.getContext('2d');
    g.scale(k, k); g.lineJoin = 'round'; painter(g);
    c.ww = w; c.wh = h;
    return c;
  }

  var DECAL_ART = {
    blood: [32, 32, function (g) {
      g.fillStyle = 'rgba(100,4,8,0.85)';
      g.beginPath(); g.ellipse(16, 16, 11, 7, 0.4, 0, 6.283); g.fill();
      [[4, 6, 3], [27, 9, 2.4], [24, 27, 3.2], [6, 25, 2]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, 6.283); g.fill(); });
    }],
    bones: [32, 32, function (g) {
      g.strokeStyle = '#d8d0bc'; g.lineCap = 'round'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(5, 22); g.lineTo(20, 18); g.moveTo(10, 10); g.lineTo(14, 26); g.stroke();
      A.ell(g, 24, 10, 6, 5.5, '#e4dcc8', 1.2); g.fillStyle = '#222'; g.beginPath(); g.arc(22, 10, 1.4, 0, 6.283); g.arc(26, 10, 1.4, 0, 6.283); g.fill();
    }],
    puddle: [48, 24, function (g) {
      g.fillStyle = 'rgba(70,90,140,0.5)'; g.beginPath(); g.ellipse(24, 12, 22, 9, 0, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(200,210,255,0.18)'; g.beginPath(); g.ellipse(18, 9, 8, 2, 0, 0, 6.283); g.fill();
    }],
    web: [40, 40, function (g) {
      g.strokeStyle = 'rgba(220,220,230,0.4)'; g.lineWidth = 0.7;
      for (var i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i * 0.3) * 40, Math.sin(i * 0.3) * 40); g.stroke(); }
      for (var j = 1; j < 5; j++) { g.beginPath(); g.arc(0, 0, j * 8, 0, Math.PI / 2); g.stroke(); }
    }],
    chain: [32, 32, function (g) {
      g.strokeStyle = '#6a6e78'; g.lineWidth = 2;
      for (var i = 0; i < 4; i++) { g.beginPath(); g.ellipse(16, 4 + i * 7, 3, 4.5, 0, 0, 6.283); g.stroke(); }
    }],
    rug: [96, 64, function (g) {
      A.box(g, 2, 2, 92, 60, 6, '#4a1018'); g.strokeStyle = '#b08a3a'; g.lineWidth = 1.5; A.rrPath(g, 8, 8, 80, 48, 4); g.stroke();
      g.fillStyle = '#6a1a24'; g.beginPath(); g.ellipse(48, 32, 18, 12, 0, 0, 6.283); g.fill();
    }],
    coalpile: [48, 28, function (g) {
      g.fillStyle = '#141418'; g.beginPath(); g.ellipse(24, 16, 22, 10, 0, 0, 6.283); g.fill();
      g.fillStyle = '#3a3a44'; [[14, 12], [28, 10], [34, 16]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 2, 0, 6.283); g.fill(); });
    }]
  };

  var DECO_ART = {
    torch: [32, 32, function (g) { A.box(g, 13, 12, 6, 16, 2, '#4a2e1a'); A.box(g, 10, 10, 12, 5, 2, '#7a7a80'); }],
    window: [32, 32, function (g) {
      A.box(g, 6, 4, 20, 26, 9, '#1a2440'); g.fillStyle = 'rgba(160,180,240,0.35)'; g.fillRect(8, 8, 7, 20);
      g.strokeStyle = '#6a7aa0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, 5); g.lineTo(16, 30); g.moveTo(7, 17); g.lineTo(25, 17); g.stroke();
    }],
    painting: [32, 32, function (g) {
      A.box(g, 4, 5, 24, 24, 2, '#b08a2a'); A.box(g, 7, 8, 18, 18, 1, '#2a1a24', 1);
      A.ell(g, 16, 15, 5, 6, '#d8c8b8', 1); g.fillStyle = '#1a1010'; g.fillRect(12, 9, 8, 4); g.fillStyle = '#000'; g.fillRect(13.5, 14, 1.5, 1.5); g.fillRect(17, 14, 1.5, 1.5);
      g.fillStyle = '#4a1a2a'; g.fillRect(9, 21, 14, 5);
    }],
    banner: [32, 32, function (g) {
      g.beginPath(); g.moveTo(7, 2); g.lineTo(25, 2); g.lineTo(25, 30); g.lineTo(16, 25); g.lineTo(7, 30); g.closePath();
      g.fillStyle = '#7a0a12'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(20,10,10,0.9)'; g.stroke();
      g.fillStyle = '#d8b040'; g.beginPath(); g.arc(16, 12, 4, 0, 6.283); g.fill();
    }],
    shield: [32, 32, function (g) {
      g.beginPath(); g.moveTo(7, 5); g.lineTo(25, 5); g.lineTo(25, 16); g.quadraticCurveTo(16, 30, 7, 16); g.closePath();
      g.fillStyle = '#2a4a7a'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(20,10,10,0.9)'; g.stroke();
      g.fillStyle = '#d8b040'; g.fillRect(15, 8, 2, 14); g.fillRect(11, 12, 10, 2);
    }],
    fireplace: [64, 32, function (g) {
      A.box(g, 0, 2, 64, 30, 3, '#3a3440'); A.box(g, 8, 10, 48, 22, 10, '#0a0606', 1); A.box(g, -2, 0, 68, 6, 2, '#5a5466');
      g.strokeStyle = '#3a2414'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(18, 30); g.lineTo(46, 26); g.moveTo(18, 26); g.lineTo(46, 30); g.stroke();
    }],
    furnace: [64, 32, function (g) {
      A.box(g, 0, 2, 64, 30, 4, '#5a3a2a'); A.box(g, 12, 10, 40, 20, 8, '#0a0404', 1);
      g.fillStyle = 'rgba(255,80,20,0.45)'; g.fillRect(14, 22, 36, 6);
    }]
  };

  function makeLightTex() {
    var c = RM.canvas(128, 128), g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return c;
  }
  function tint(src, color) {
    var c = RM.canvas(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // La Dama Blanca (dibujo suave, en unidades del mundo: 40×80).
  function makeGhost() {
    return function (g) {
      var gr = g.createLinearGradient(0, 10, 0, 80);
      gr.addColorStop(0, 'rgba(245,245,255,0.95)'); gr.addColorStop(1, 'rgba(200,200,230,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(10, 22); g.quadraticCurveTo(0, 60, 2, 80); g.lineTo(38, 80); g.quadraticCurveTo(40, 60, 30, 22); g.closePath(); g.fill();
      g.fillStyle = '#f4f2f6'; g.beginPath(); g.ellipse(20, 14, 8, 10, 0, 0, 6.283); g.fill();
      g.fillStyle = '#0a0a0e'; g.beginPath(); g.moveTo(10, 14); g.quadraticCurveTo(10, 0, 20, 2); g.quadraticCurveTo(30, 0, 30, 14);
      g.lineTo(32, 40); g.lineTo(27, 36); g.lineTo(26, 16); g.quadraticCurveTo(20, 8, 14, 16); g.lineTo(13, 36); g.lineTo(8, 40); g.closePath(); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(16.5, 15, 2, 2.8, 0, 0, 6.283); g.ellipse(23.5, 15, 2, 2.8, 0, 0, 6.283); g.fill();
    };
  }

  Level.prototype.reset = function () {
    var m = this.map;
    m.items.forEach(function (it) { it.taken = false; });
    m.notes.forEach(function (n) { n.read = false; });
    m.gate.open = 0; m.gate.opening = false; m.cryptDoor.open = false; m.setDoorSolid();
    var idx = 0, sp = m.spawns[0];
    if (this.net) {
      var me = this.net.myId;
      this.net.players.forEach(function (p, i) { if (p.id === me) idx = i; });
      sp = m.spawns[idx % m.spawns.length];
    }
    this.myIdx = idx;
    this.p = { x: sp.x, y: sp.y, dir: 3, phase: 0, amp: 0, run: false, crouch: false, runK: 0, crouchK: 0, stamina: 1, tired: false, stepAcc: 0, mode: 'walk', escaped: false };
    this.inv = {};
    this.crafted = false; this.used = false;
    this.escaped = {};
    this.time = 0; this.t = 0;
    this.msg = null; this.note = null; this.paused = false; this.won = false; this.winT = 0;
    this.room = null; this.roomToast = null; this.flash = 0; this.nextFlash = rand(6, 12);
    this.scare = null; this.scares = {}; this.flicker = 0; this.near = null;
    this.input = { keys: {}, joy: null, buttons: {} };
    this.others = this.others || {};
    this.sendT = 0; this.worldT = 0;
    this.rain = [];
    for (var i = 0; i < 220; i++) this.rain.push(this.newDrop(true));
    this.say(this.net ? 'Cooperativo: juntá los materiales con tu equipo, forjen la herradura y salgan todos.' : 'Encontrá los materiales para forjar una herradura y abrí el portón.', 5);
    if (this.net && !this.netBound) this.bindNet();
  };

  Level.prototype.newDrop = function (anywhere) {
    var rects = this.map.outdoorRects, r = rects[(Math.random() * rects.length) | 0];
    return { x: r.x + Math.random() * r.w, y: anywhere ? r.y + Math.random() * r.h : r.y - 20, r: r, vy: rand(440, 600) };
  };

  Level.prototype.say = function (text, dur) { this.msg = { text: text, t: dur || 3 }; };

  /* ---------- Red (cooperativo) ---------- */

  Level.prototype.bindNet = function () {
    var self = this, net = this.net;
    this.netBound = true;
    net.players.forEach(function (p, i) {
      if (p.id !== net.myId) self.others[p.id] = { id: p.id, name: p.name, idx: i, x: self.map.spawns[i % 4].x, y: self.map.spawns[i % 4].y, tx: 0, ty: 0, dir: 3, phase: 0, amp: 0, mode: 0, fresh: false };
    });
    net.on(function (msg) {
      if (!msg || !self.ready) return;
      if (msg.t === 'p') {
        var o = self.others[msg.id];
        if (!o) return;
        o.tx = msg.x; o.ty = msg.y; o.dir = msg.d; o.mode = msg.m; o.moving = msg.mv; o.escaped = msg.e;
        if (!o.fresh) { o.x = msg.x; o.y = msg.y; o.fresh = true; }
      } else if (msg.t === 'req' && net.isHost) {
        self.hostApply(msg.a, msg.id, msg.arg);
      } else if (msg.t === 'w' && !net.isHost) {
        self.applyWorld(msg);
      }
    });
    if (net.onLeave) net.onLeave(function (id) {
      var o = self.others[id];
      if (!o) return;
      delete self.others[id];
      self.say(o.name + ' se desconectó.', 3);
      if (net.isHost) self.checkWin();
    });
  };

  Level.prototype.snapshot = function () {
    var m = this.map;
    return {
      t: 'w',
      taken: m.items.filter(function (it) { return it.taken; }).map(function (it) { return it.id; }),
      inv: Object.keys(this.inv), crafted: this.crafted, crypt: m.cryptDoor.open, gate: m.gate.opening,
      escaped: Object.keys(this.escaped), won: this.won, time: this.time
    };
  };

  Level.prototype.broadcastWorld = function (ev) {
    if (!this.net || !this.net.isHost) return;
    var s = this.snapshot(); s.ev = ev || null;
    this.net.send(s);
  };

  Level.prototype.applyWorld = function (s) {
    var m = this.map, self = this;
    m.items.forEach(function (it) { it.taken = s.taken.indexOf(it.id) >= 0; });
    this.inv = {}; s.inv.forEach(function (id) { self.inv[id] = true; });
    this.crafted = s.crafted;
    if (s.crypt && !m.cryptDoor.open) { m.cryptDoor.open = true; m.setDoorSolid(); }
    if (s.gate && !m.gate.opening) { m.gate.opening = true; this.used = true; RM.audio.gate(); }
    this.escaped = {}; s.escaped.forEach(function (id) { self.escaped[id] = true; });
    if (s.won && !this.won) this.win();
    if (s.ev) this.showEvent(s.ev);
  };

  Level.prototype.showEvent = function (ev) {
    var who = ev.by === (this.net ? this.net.myId : 'solo') ? 'Conseguiste' : (this.nameOf(ev.by) + ' consiguió');
    if (ev.type === 'take') {
      RM.audio.pickup(); RM.vibrate([20]);
      this.say(who + ': ' + ev.name + (ev.recipe ? ' (' + this.count() + '/5)' : ''), 2.8);
      if (this.count() === 2 && !this.scares.first) this.triggerScare();
      if (this.count() === 5 && !this.crafted) { var self = this; setTimeout(function () { self.say('Tienen todo. Vayan a la Herrería a forjar la herradura.', 4); }, 2000); }
    } else if (ev.type === 'craft') {
      RM.audio.clang(); RM.vibrate([40, 120, 40, 120, 80]);
      this.say((ev.by === this.myId() ? 'Forjaste' : this.nameOf(ev.by) + ' forjó') + ' la HERRADURA. Llévenla al portón del vestíbulo.', 4);
    } else if (ev.type === 'unlock') {
      RM.audio.creak(); this.say('La puerta de la cripta se abrió…', 3);
    } else if (ev.type === 'gate') {
      RM.vibrate([200]); this.say('El portón cruje y se abre…', 3);
    } else if (ev.type === 'escape' && ev.by !== this.myId()) {
      this.say(this.nameOf(ev.by) + ' salió del castillo.', 3);
    }
  };

  Level.prototype.myId = function () { return this.net ? this.net.myId : 'solo'; };
  Level.prototype.nameOf = function (id) {
    if (id === this.myId()) return 'Vos';
    var o = this.others[id];
    return o ? o.name : 'Alguien';
  };

  // Todas las acciones que cambian el mundo pasan por acá.
  Level.prototype.request = function (a, arg) {
    if (!this.net || this.net.isHost) this.hostApply(a, this.myId(), arg);
    else this.net.send({ t: 'req', id: this.net.myId, a: a, arg: arg });
  };

  Level.prototype.hostApply = function (a, by, arg) {
    var m = this.map, ev = null, self = this;
    if (a === 'take') {
      var it = m.items.filter(function (x) { return x.id === arg; })[0];
      if (!it || it.taken) return;
      it.taken = true; this.inv[it.id] = true;
      ev = { type: 'take', by: by, name: it.name, recipe: RECIPE.indexOf(it.id) >= 0 };
    } else if (a === 'craft') {
      if (this.crafted || RECIPE.some(function (id) { return !self.inv[id]; })) return;
      this.crafted = true; ev = { type: 'craft', by: by };
    } else if (a === 'unlock') {
      if (m.cryptDoor.open || !this.inv.key) return;
      m.cryptDoor.open = true; m.setDoorSolid(); ev = { type: 'unlock', by: by };
    } else if (a === 'gate') {
      if (!this.crafted || m.gate.opening) return;
      m.gate.opening = true; this.used = true; RM.audio.gate(); ev = { type: 'gate', by: by };
    } else if (a === 'escape') {
      if (this.escaped[by]) return;
      this.escaped[by] = true; ev = { type: 'escape', by: by };
      this.checkWin(true);
    }
    if (ev) { this.showEvent(ev); this.broadcastWorld(ev); }
  };

  Level.prototype.checkWin = function (silent) {
    var ids = [this.myId()].concat(Object.keys(this.others)), self = this;
    if (ids.every(function (id) { return self.escaped[id]; }) && !this.won) {
      this.win();
      if (!silent) this.broadcastWorld(null);
    }
  };

  Level.prototype.win = function () {
    this.won = true; this.winT = 0;
    RM.audio.select(); RM.vibrate([60, 60, 60]);
    if (!this.net) RM.Screens.saveRecord(1, this.time);
  };

  /* ---------- Colisiones ---------- */

  Level.prototype.solidAt = function (px, py) {
    var m = this.map, x = (px / T) | 0, y = (py / T) | 0;
    if (x < 0 || y < 0 || x >= m.W || y >= m.H) return true;
    return m.solid[y * m.W + x] !== 0;
  };
  Level.prototype.blocked = function (x, y) {
    var hw = 10, top = y - 9;
    return this.solidAt(x - hw, top) || this.solidAt(x + hw, top) || this.solidAt(x - hw, y) || this.solidAt(x + hw, y);
  };
  Level.prototype.move = function (dx, dy) {
    var p = this.p;
    if (dx && !this.blocked(p.x + dx, p.y)) p.x += dx;
    if (dy && !this.blocked(p.x, p.y + dy)) p.y += dy;
  };

  /* ---------- Bucle ---------- */

  Level.prototype.update = function (dt) {
    if (!this.ready) return;
    this.t += dt;
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    if (this.roomToast) { this.roomToast.t -= dt; if (this.roomToast.t <= 0) this.roomToast = null; }
    this.updateRain(dt);
    this.updateOthers(dt);
    this.flash *= Math.exp(-dt * 6);
    var g = this.map.gate;
    if (g.opening && g.open < 1) { g.open = Math.min(1, g.open + dt * 0.5); if (g.open >= 1) this.map.setDoorSolid(); }
    this.netTick(dt);
    if (this.won) { this.winT += dt; return; }
    if (!this.net && (this.paused || this.note)) return;
    this.time += dt;
    var p = this.p;
    if (!p.escaped && !this.paused && !this.note) this.updatePlayer(dt);
    else { p.amp = Math.max(0, p.amp - dt * 6); }
    this.updateRoom();
    this.findNear();
    if (this.flicker > 0) this.flicker -= dt;
    if (this.scare) { this.scare.t += dt; if (this.scare.t > this.scare.dur) this.scare = null; }
    if (g.open >= 1 && !p.escaped && p.y > this.map.exitY) { p.escaped = true; this.request('escape'); }

    this.nextFlash -= dt;
    if (this.nextFlash <= 0 && RM.settings.thunder) {
      this.nextFlash = rand(8, 16);
      var self = this, outside = this.room && this.room.outdoor;
      this.flash = 1;
      setTimeout(function () { self.flash = Math.max(self.flash, 0.7); }, 120);
      setTimeout(function () { RM.audio.thunder(outside ? 0.25 : 0.65); }, outside ? 200 : 900);
    }
  };

  Level.prototype.updatePlayer = function (dt) {
    var p = this.p, inp = this.input, k = inp.keys;
    var ix = 0, iy = 0;
    if (k.ArrowLeft || k.a) ix -= 1;
    if (k.ArrowRight || k.d) ix += 1;
    if (k.ArrowUp || k.w) iy -= 1;
    if (k.ArrowDown || k.s) iy += 1;
    if (inp.joy && inp.joy.mag > 0.15) { ix = inp.joy.dx; iy = inp.joy.dy; }
    var mag = Math.min(1, Math.hypot(ix, iy));
    var moving = mag > 0.1;
    var wantsRun = (p.run || k.Shift) && !p.crouch && !p.tired;
    var mode = p.crouch ? 'crouch' : (wantsRun && moving ? 'run' : 'walk');
    if (mode === 'run') { p.stamina -= dt * 0.2; if (p.stamina <= 0) { p.tired = true; p.stamina = 0; this.say('Estás agotado…', 1.6); } }
    else p.stamina = Math.min(1, p.stamina + dt * (moving ? 0.12 : 0.22));
    if (p.tired && p.stamina > 0.35) p.tired = false;
    p.mode = mode;
    p.runK += ((mode === 'run' ? 1 : 0) - p.runK) * Math.min(1, dt * 8);
    p.crouchK += ((p.crouch ? 1 : 0) - p.crouchK) * Math.min(1, dt * 10);
    p.amp += ((moving ? 1 : 0) - p.amp) * Math.min(1, dt * 10);
    if (moving) {
      var n = Math.hypot(ix, iy) || 1;
      var sp = SPEED[mode] * (inp.joy ? Math.max(0.55, mag) : 1);
      this.move(ix / n * sp * dt, iy / n * sp * dt);
      if (Math.abs(ix) > Math.abs(iy)) p.dir = ix < 0 ? 1 : 2; else p.dir = iy < 0 ? 3 : 0;
      p.phase += dt * (mode === 'run' ? 13 : mode === 'crouch' ? 6 : 9);
      p.stepAcc += sp * dt;
      if (p.stepAcc > (mode === 'run' ? 44 : 34)) { p.stepAcc = 0; RM.audio.step(this.floorAt(p.x, p.y), mode); }
    }
  };

  Level.prototype.updateOthers = function (dt) {
    var self = this;
    Object.keys(this.others).forEach(function (id) {
      var o = self.others[id];
      var dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy);
      if (d > 200) { o.x = o.tx; o.y = o.ty; }
      else { o.x += dx * Math.min(1, dt * 12); o.y += dy * Math.min(1, dt * 12); }
      o.amp += ((o.moving ? 1 : 0) - o.amp) * Math.min(1, dt * 10);
      o.phase += dt * (o.mode === 1 ? 13 : o.mode === 2 ? 6 : 9) * o.amp;
    });
  };

  Level.prototype.netTick = function (dt) {
    if (!this.net) return;
    var p = this.p;
    this.sendT += dt;
    if (this.sendT > 1 / 12) {
      this.sendT = 0;
      this.net.send({ t: 'p', id: this.net.myId, x: Math.round(p.x), y: Math.round(p.y), d: p.dir, m: MODE_CODE[p.mode] || 0, mv: p.amp > 0.4, e: p.escaped });
    }
    if (this.net.isHost) {
      this.worldT += dt;
      if (this.worldT > 2) { this.worldT = 0; this.broadcastWorld(null); }
    }
  };

  Level.prototype.floorAt = function (x, y) {
    var t = this.map.tiles[((y / T) | 0) * this.map.W + ((x / T) | 0)];
    return t === TL.WOOD ? 'wood' : (t === TL.GRASS || t === TL.OUT || t === TL.DIRT) ? 'grass' : 'stone';
  };

  Level.prototype.updateRoom = function () {
    var rm = RM.Castle.roomAt(this.map, this.p.x, this.p.y - 8);
    if (rm && rm !== this.room) {
      this.room = rm;
      this.roomToast = { text: rm.name, t: 2.4 };
      RM.audio.setMuffle(rm.outdoor ? 0 : 1);
      if (rm.id === 'crypt' && !this.scares.crypt) { this.scares.crypt = true; RM.audio.creak(); }
    }
  };

  Level.prototype.findNear = function () {
    var p = this.p, best = null, bd = 1e9, m = this.map;
    if (p.escaped) { this.near = null; return; }
    var consider = function (o, kind, r) {
      var d = Math.hypot(o.x - p.x, o.y - (p.y - 8));
      if (d < r && d < bd) { bd = d; best = { kind: kind, o: o }; }
    };
    m.items.forEach(function (it) { if (!it.taken) consider(it, 'item', 44); });
    m.notes.forEach(function (n) { consider(n, 'note', 40); });
    m.interact.forEach(function (o) {
      if (o.kind === 'gate' && m.gate.opening) return;
      if (o.kind === 'cryptdoor' && m.cryptDoor.open) return;
      consider(o, o.kind, o.r);
    });
    this.near = best;
  };

  Level.prototype.actionLabel = function () {
    var n = this.near;
    if (!n) return null;
    return { item: 'AGARRAR', note: 'LEER', anvil: 'FORJAR', gate: 'ABRIR', cryptdoor: 'ABRIR', mirror: 'MIRAR', well: 'MIRAR', horse: 'MIRAR' }[n.kind];
  };

  Level.prototype.count = function () {
    var self = this;
    return RECIPE.filter(function (id) { return self.inv[id]; }).length;
  };

  Level.prototype.act = function () {
    if (this.won) return;
    if (this.note) { this.note = null; RM.audio.page(); return; }
    if (this.paused) return;
    var n = this.near, self = this;
    if (!n) return;
    if (n.kind === 'item') this.request('take', n.o.id);
    else if (n.kind === 'note') { this.note = n.o; n.o.read = true; RM.audio.page(); }
    else if (n.kind === 'anvil') {
      if (this.crafted) { this.say('El yunque todavía está tibio.', 2); return; }
      var missing = RECIPE.filter(function (id) { return !self.inv[id]; }).map(function (id) { return self.map.items.filter(function (it) { return it.id === id; })[0].name; });
      if (missing.length) { this.say('Para forjar falta: ' + missing.join(', ') + '.', 3.5); RM.audio.back(); return; }
      this.request('craft');
    } else if (n.kind === 'gate') {
      if (!this.crafted) { this.say('Una cerradura con forma de herradura… No abre sin ella.', 3); RM.audio.back(); return; }
      this.request('gate');
    } else if (n.kind === 'cryptdoor') {
      if (!this.inv.key) { this.say('Puerta de hierro cerrada. Hace falta la llave de la cripta.', 3); RM.audio.back(); return; }
      this.request('unlock');
    } else if (n.kind === 'mirror') {
      if (!this.scares.mirror) { this.scares.mirror = true; this.scare = { kind: 'mirror', t: 0, dur: 1.1 }; RM.audio.scream(); RM.vibrate([80, 40, 160]); }
      else this.say('Tu reflejo… y nada más. Por ahora.', 2.5);
    } else if (n.kind === 'well') { RM.audio.whisper(); this.say('Desde el fondo del pozo alguien susurra tu nombre.', 3); }
    else if (n.kind === 'horse') { this.say('El caballo te mira con ojos rojos. No relincha. No respira.', 3); }
  };

  Level.prototype.triggerScare = function () {
    this.scares.first = true;
    var p = this.p, dirs = [[0, 1], [-1, 0], [1, 0], [0, -1]], d = dirs[p.dir];
    var gx = p.x + d[0] * 150, gy = p.y + d[1] * 150;
    for (var i = 0; i < 8 && this.blocked(gx, gy); i++) { gx -= d[0] * 18; gy -= d[1] * 18; }
    this.scare = { kind: 'ghost', x: gx, y: gy, t: 0, dur: 1.6 };
    this.flicker = 1.6;
    RM.audio.whisper();
    var self = this;
    setTimeout(function () { self.say('¿Qué fue eso…?', 2.5); }, 1600);
  };

  Level.prototype.updateRain = function (dt) {
    for (var i = 0; i < this.rain.length; i++) {
      var d = this.rain[i];
      d.y += d.vy * dt; d.x -= d.vy * 0.15 * dt;
      if (d.y > d.r.y + d.r.h || d.x < d.r.x) this.rain[i] = this.newDrop(false);
    }
  };

  /* ---------- Dibujo ---------- */

  Level.prototype.layout = function (W, H, dpr) {
    this.W = W; this.H = H;
    this.S = H / (11.5 * T);
    var k = this.S * dpr;
    if (!this.tex || Math.abs(this.tex.k - k) > 0.01) this.buildTextures(k);
    var u = Math.min(W, H);
    this.iconPx = Math.max(26, u * 0.085);
    this.icons = {};
    var self = this;
    A.icons.forEach(function (n) { self.icons[n] = A.icon(n, self.iconPx / 32 * dpr); });
    this.worldIcons = {};
    A.icons.forEach(function (n) { self.worldIcons[n] = A.icon(n, k); });
    this.ui = {
      joy: { x: u * 0.2, y: H - u * 0.24, r: u * 0.13 },
      act: { x: W - u * 0.16, y: H - u * 0.2, r: u * 0.1 },
      run: { x: W - u * 0.38, y: H - u * 0.12, r: u * 0.075 },
      crouch: { x: W - u * 0.36, y: H - u * 0.34, r: u * 0.07 },
      pause: { x: W - u * 0.07, y: u * 0.07, r: u * 0.05 }
    };
  };

  Level.prototype.draw = function (ctx, W, H, dpr) {
    if (!this.ready) return;
    if (this.W !== W || this.H !== H || !this.tex) this.layout(W, H, dpr);
    var S = this.S, m = this.map, p = this.p;
    var vw = W / S, vh = H / S;
    var cx = clamp(p.x - vw / 2, 0, Math.max(0, m.W * T - vw));
    var cy = clamp(p.y - 24 - vh / 2, 0, Math.max(0, m.H * T - vh));
    this.cam = { x: cx, y: cy };
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.scale(S, S);
    ctx.translate(-cx, -cy);
    this.drawTiles(ctx, cx, cy, vw, vh);
    this.drawDecals(ctx, cx, cy, vw, vh);
    this.drawDoors(ctx);
    this.drawPickups(ctx, cx, cy, vw, vh);
    this.drawSorted(ctx, cx, cy, vw, vh);
    this.drawFlames(ctx, cx, cy, vw, vh);
    this.drawRain(ctx);
    if (this.near) this.drawPrompt(ctx);
    ctx.restore();
    this.drawLighting(ctx, W, H, cx, cy, S);
    this.drawNames(ctx, cx, cy, S);
    if (this.scare && this.scare.kind === 'mirror') this.drawMirrorScare(ctx, W, H);
    this.drawHUD(ctx, W, H);
    if (this.note) this.drawNote(ctx, W, H);
    if (this.paused) this.drawPause(ctx, W, H);
    if (this.won) this.drawWin(ctx, W, H);
  };

  Level.prototype.drawTiles = function (ctx, cx, cy, vw, vh) {
    var m = this.map, tx = this.tex;
    var x0 = Math.max(0, (cx / T) | 0), y0 = Math.max(0, (cy / T) | 0);
    var x1 = Math.min(m.W - 1, ((cx + vw) / T) | 0), y1 = Math.min(m.H - 1, ((cy + vh) / T) | 0);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var t = m.tiles[y * m.W + x], img;
        var v = ((x * 7 + y * 13) ^ (x * y)) % 3;
        if (t === TL.WALL) {
          var below = y + 1 < m.H ? m.tiles[(y + 1) * m.W + x] : TL.WALL;
          img = below !== TL.WALL ? tx.wallFace[v] : tx.wallTop;
        } else img = tx.floor[t][v];
        ctx.drawImage(img, x * T, y * T, T + 0.5, T + 0.5);
        if (t !== TL.WALL && y > 0 && m.tiles[(y - 1) * m.W + x] === TL.WALL) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x * T, y * T, T, 7);
        }
      }
    }
    var self = this;
    m.walldeco.forEach(function (d) {
      if (d.x > cx + vw || d.x + 64 < cx || d.y > cy + vh || d.y + 32 < cy) return;
      var img = self.tex.deco[d.type];
      if (img) ctx.drawImage(img, d.x, d.y, img.ww, img.wh);
    });
  };

  Level.prototype.drawDecals = function (ctx, cx, cy, vw, vh) {
    var tx = this.tex;
    this.map.decals.forEach(function (d) {
      var img = tx.decal[d.type];
      if (!img || d.x > cx + vw || d.x + img.ww < cx || d.y > cy + vh || d.y + img.wh < cy) return;
      ctx.drawImage(img, d.x, d.y, img.ww, img.wh);
    });
  };

  Level.prototype.drawDoors = function (ctx) {
    var g = this.map.gate, x = g.x * T, y = g.y * T, i;
    ctx.fillStyle = '#060608'; ctx.fillRect(x, y, 64, 64);
    var lift = g.open * 58;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, 64, 64); ctx.clip();
    ctx.strokeStyle = 'rgba(20,14,12,0.9)'; ctx.lineWidth = 5;
    for (i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(x + 5 + i * 9, y - lift); ctx.lineTo(x + 5 + i * 9, y + 64 - lift); ctx.stroke(); }
    ctx.strokeStyle = '#5a5e68'; ctx.lineWidth = 3;
    for (i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(x + 5 + i * 9, y - lift); ctx.lineTo(x + 5 + i * 9, y + 64 - lift); ctx.stroke(); }
    ctx.fillStyle = '#4a4e58'; ctx.fillRect(x, y + 20 - lift, 64, 5); ctx.fillRect(x, y + 44 - lift, 64, 5);
    if (g.open < 0.1) { A.ell(ctx, x + 32, y + 30, 7, 8, '#c8ced6'); ctx.fillStyle = '#000'; ctx.fillRect(x + 30, y + 26, 4, 8); }
    ctx.restore();
    var d = this.map.cryptDoor;
    if (!d.open) {
      var dx = d.x * T, dy = d.y * T;
      A.box(ctx, dx + 2, dy, 60, 64, 4, A.vlin(ctx, dy, dy + 64, '#4a4e58', '#2a2e36'));
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (i = 0; i < 4; i++) ctx.fillRect(dx + 8, dy + 8 + i * 14, 48, 3);
      A.ell(ctx, dx + 32, dy + 34, 6, 6, '#d8b040'); ctx.fillStyle = '#1a1008'; ctx.fillRect(dx + 31, dy + 32, 2, 6);
    }
  };

  Level.prototype.drawPickups = function (ctx, cx, cy, vw, vh) {
    var t = this.t, icons = this.worldIcons;
    this.map.items.forEach(function (it) {
      if (it.taken || it.x < cx - 40 || it.x > cx + vw + 40 || it.y < cy - 40 || it.y > cy + vh + 40) return;
      var bob = Math.sin(t * 3 + it.x) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 12, 10, 4, 0, 0, 6.283); ctx.fill();
      ctx.drawImage(icons[it.icon], it.x - 16, it.y - 22 + bob, 32, 32);
      var s = Math.max(0, Math.sin(t * 4 + it.y));
      if (s > 0.6) { ctx.fillStyle = 'rgba(255,255,255,' + (s - 0.6) * 2 + ')'; ctx.beginPath(); ctx.arc(it.x + 9, it.y - 18 + bob, 2, 0, 6.283); ctx.fill(); }
    });
    this.map.notes.forEach(function (n) {
      if (n.x < cx - 40 || n.x > cx + vw + 40 || n.y < cy - 40 || n.y > cy + vh + 40) return;
      ctx.drawImage(icons.note, n.x - 14, n.y - 18, 28, 28);
    });
  };

  Level.prototype.heroState = function (o, self) {
    if (self) return { dir: o.dir, phase: o.phase, amp: o.amp, run: o.runK, crouch: o.crouchK };
    return { dir: o.dir, phase: o.phase, amp: o.amp, run: o.mode === 1 ? 1 : 0, crouch: o.mode === 2 ? 1 : 0 };
  };

  Level.prototype.drawSorted = function (ctx, cx, cy, vw, vh) {
    var list = [], self = this, p = this.p, tx = this.tex;
    this.map.props.forEach(function (pr) {
      var img = tx.props[pr.type];
      if (!img || pr.x + pr.w < cx || pr.x > cx + vw || pr.baseY < cy || pr.baseY - pr.h > cy + vh) return;
      list.push({ y: pr.baseY, draw: function () { ctx.drawImage(img, pr.x, pr.baseY - pr.h, img.ww, img.wh); } });
    });
    var addHero = function (o, isMe, idx) {
      if (o.escaped) return;
      list.push({ y: o.y, draw: function () {
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 17, 6, 0, 0, 6.283); ctx.fill();
        ctx.save(); ctx.translate(o.x, o.y);
        RM.Hero.draw(ctx, self.heroState(o, isMe), RM.Hero.palette(idx));
        ctx.restore();
      } });
    };
    addHero(p, true, this.myIdx);
    Object.keys(this.others).forEach(function (id) { var o = self.others[id]; addHero(o, false, o.idx); });
    if (this.scare && this.scare.kind === 'ghost') {
      var s = this.scare;
      list.push({ y: s.y, draw: function () {
        var a = Math.sin(Math.min(1, s.t / s.dur) * Math.PI);
        ctx.save(); ctx.globalAlpha = a * (0.7 + 0.3 * Math.random()); ctx.translate(s.x - 20, s.y - 80); self.ghost(ctx); ctx.restore();
      } });
    }
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.draw(); });
  };

  Level.prototype.drawFlames = function (ctx, cx, cy, vw, vh) {
    var t = this.t;
    this.map.flames.forEach(function (f, i) {
      if (f.x < cx - 30 || f.x > cx + vw + 30 || f.y < cy - 30 || f.y > cy + vh + 30) return;
      var k = 1 + Math.sin(t * 13 + i * 2.1) * 0.15 + Math.sin(t * 7.7 + i) * 0.1;
      A.flame(ctx, f.x, f.y, f.s * k);
    });
  };

  Level.prototype.drawRain = function (ctx) {
    ctx.strokeStyle = 'rgba(190,200,240,0.4)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath();
    this.rain.forEach(function (d) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 3, d.y - 14); });
    ctx.stroke();
  };

  Level.prototype.drawPrompt = function (ctx) {
    var o = this.near.o, y = o.y - 44 + Math.sin(this.t * 5) * 3;
    ctx.fillStyle = '#ff3a1a';
    A.rrPath(ctx, o.x - 3, y, 6, 12, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(o.x, y + 17, 3, 0, 6.283); ctx.fill();
  };

  Level.prototype.drawNames = function (ctx, cx, cy, S) {
    var self = this;
    if (!this.net) return;
    ctx.save();
    ctx.font = '700 ' + Math.max(10, S * 13) + 'px "Cinzel", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    Object.keys(this.others).forEach(function (id) {
      var o = self.others[id];
      if (o.escaped) return;
      var x = (o.x - cx) * S, y = (o.y - 82 - cy) * S;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(o.name, x + 1, y + 1);
      ctx.fillStyle = RM.Hero.SHIRTS[o.idx % 4][0]; ctx.fillText(o.name, x, y);
    });
    ctx.restore();
  };

  Level.prototype.drawLighting = function (ctx, W, H, cx, cy, S) {
    var k = 4, lw = Math.ceil(W / k), lh = Math.ceil(H / k);
    if (!this.lc || this.lc.width !== lw || this.lc.height !== lh) this.lc = RM.canvas(lw, lh);
    var g = this.lc.getContext('2d'), t = this.t, tex = this.tex.light, self = this;
    var inCrypt = this.room && (this.room.id === 'crypt' || this.room.id === 'dungeon' || this.room.id === 'cellar');
    var dark = (inCrypt ? 0.975 : 0.93) - this.flash * 0.45;
    if (this.flicker > 0 && Math.random() < 0.5) dark = 0.99;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, lw, lh);
    g.fillStyle = 'rgba(3,2,8,' + dark + ')'; g.fillRect(0, 0, lw, lh);
    g.globalCompositeOperation = 'destination-out';
    var sc = S / k;
    var light = function (x, y, r, a) {
      var sx = (x - cx) * sc, sy = (y - cy) * sc, sr = r * sc;
      if (sx + sr < 0 || sy + sr < 0 || sx - sr > lw || sy - sr > lh) return;
      g.globalAlpha = a; g.drawImage(tex, sx - sr, sy - sr, sr * 2, sr * 2);
    };
    this.map.outdoorRects.forEach(function (r) {
      g.globalAlpha = 0.45 + self.flash * 0.5; g.fillStyle = '#fff';
      g.fillRect((r.x - cx) * sc, (r.y - cy) * sc, r.w * sc, r.h * sc);
    });
    var lantern = function (o, crouchK) {
      if (o.escaped) return;
      var fl = 1 + Math.sin(t * 9 + o.x) * 0.03 + Math.sin(t * 23) * 0.02;
      light(o.x, o.y - 28, 180 * fl * (1 - (crouchK || 0) * 0.15), 1);
      light(o.x, o.y - 28, 70, 1);
    };
    if (!(this.flicker > 0 && Math.random() < 0.6)) lantern(this.p, this.p.crouchK);
    Object.keys(this.others).forEach(function (id) { lantern(self.others[id], self.others[id].mode === 2 ? 1 : 0); });
    this.map.lights.forEach(function (L) {
      var f = L.flick ? 1 + Math.sin(t * 8 + L.flick) * 0.06 + Math.sin(t * 19 + L.flick * 2) * 0.04 : 1;
      light(L.x, L.y, L.r * f, L.color === 'moon' ? 0.6 : 0.9);
    });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.drawImage(this.lc, 0, 0, lw * k, lh * k);
    ctx.globalCompositeOperation = 'lighter';
    this.map.lights.forEach(function (L) {
      if (L.color === 'moon') return;
      var sx = (L.x - cx) * S, sy = (L.y - cy) * S, sr = L.r * S * 0.6;
      if (sx + sr < 0 || sy + sr < 0 || sx - sr > W || sy - sr > H) return;
      ctx.globalAlpha = 0.13 + Math.sin(t * 10 + L.flick) * 0.03;
      ctx.drawImage(self.tex.warm, sx - sr, sy - sr, sr * 2, sr * 2);
    });
    if (this.flash > 0.02) { ctx.globalAlpha = this.flash * 0.15; ctx.fillStyle = '#c8c0ff'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  };

  Level.prototype.drawMirrorScare = function (ctx, W, H) {
    var s = this.scare, a = s.t < 0.15 ? 1 : 1 - (s.t - 0.15) / (s.dur - 0.15);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    var sz = H * 0.95 / 80;
    ctx.translate(W / 2 - 20 * sz + (Math.random() - 0.5) * 12, H * 0.03);
    ctx.scale(sz, sz);
    this.ghost(ctx);
    ctx.restore();
  };

  /* ---------- HUD y controles ---------- */

  function roundRect(g, x, y, w, h, r) { A.rrPath(g, x, y, w, h, r); }

  function wrapText(ctx, text, x, y, maxW, lh) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    lines.push(line);
    var y0 = y - (lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { ctx.fillText(l, x, y0 + i * lh); });
  }

  Level.prototype.drawHUD = function (ctx, W, H) {
    var u = Math.min(W, H), self = this;
    var fs = Math.max(11, u * 0.036), slot = this.iconPx;
    var x0 = u * 0.03, y0 = u * 0.03;
    ctx.save();
    ctx.fillStyle = 'rgba(8,2,6,0.6)';
    roundRect(ctx, x0, y0, slot * 7 + 34, slot + fs * 1.9, 6); ctx.fill();
    ctx.font = '700 ' + fs * 0.8 + 'px "Cinzel", serif';
    ctx.fillStyle = '#ff5a2a'; ctx.textBaseline = 'top';
    var obj = this.used ? 'Escapen por el portón' : this.crafted ? 'Abrí el portón del vestíbulo' : this.count() === 5 ? 'Forjá la herradura en la Herrería' : 'Materiales para la herradura ' + this.count() + '/5';
    ctx.fillText(obj, x0 + 8, y0 + 6);
    var drawSlot = function (sx, sy, name, have, border) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, sx, sy, slot, slot, 4); ctx.fill();
      ctx.strokeStyle = have ? border : '#3a2a2a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = have ? 1 : 0.2;
      ctx.drawImage(self.icons[name], sx + 2, sy + 2, slot - 4, slot - 4);
      ctx.globalAlpha = 1;
    };
    var sy = y0 + fs * 1.4;
    RECIPE.forEach(function (id, i) { drawSlot(x0 + 8 + i * (slot + 3), sy, id === 'ingot2' ? 'ingot' : id, self.inv[id], '#c4180f'); });
    var hx = x0 + 8 + 5 * (slot + 3) + 10;
    ctx.fillStyle = '#c4180f'; ctx.fillRect(hx - 9, sy + slot / 2 - 1, 6, 2);
    drawSlot(hx, sy, 'horseshoe', this.crafted, '#ffcc00');
    drawSlot(hx + slot + 6, sy, 'key', this.inv.key, '#d8b040');
    var by = y0 + slot + fs * 1.9 + 6, bw = slot * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0, by, bw, 5);
    ctx.fillStyle = this.p.tired ? '#ff3a1a' : '#e8d070'; ctx.fillRect(x0, by, bw * this.p.stamina, 5);
    // Compañeros conectados.
    if (this.net) {
      ctx.font = '700 ' + fs * 0.75 + 'px "Cinzel", serif';
      var yy = by + 12;
      Object.keys(this.others).forEach(function (id) {
        var o = self.others[id];
        ctx.fillStyle = RM.Hero.SHIRTS[o.idx % 4][0];
        ctx.beginPath(); ctx.arc(x0 + 5, yy + fs * 0.4, 4, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#d8ccd8';
        ctx.fillText(o.name + (self.escaped[id] ? ' · afuera' : ''), x0 + 14, yy);
        yy += fs * 1.1;
      });
    }
    ctx.font = '700 ' + fs + 'px "Cinzel", serif';
    ctx.textAlign = 'right'; ctx.fillStyle = '#d8ccd8';
    var s = this.time | 0;
    ctx.fillText((s / 60 | 0) + ':' + ('0' + s % 60).slice(-2), this.ui.pause.x - this.ui.pause.r - 10, u * 0.045);
    if (this.roomToast) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.roomToast.t);
      ctx.font = (fs * 1.7) + 'px "Metal Mania", serif';
      ctx.fillStyle = '#c4180f'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
      ctx.fillText(this.roomToast.text, W / 2, H * 0.14);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    var text = this.msg ? this.msg.text : (this.p.escaped && !this.won ? 'Saliste. Esperando a tus compañeros…' : null);
    if (text) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + fs + 'px "Cinzel", serif';
      var tw = Math.min(W * 0.6, ctx.measureText(text).width + 30);
      ctx.globalAlpha = this.msg ? Math.min(1, this.msg.t * 2) : 1;
      ctx.fillStyle = 'rgba(10,2,6,0.8)';
      roundRect(ctx, W / 2 - tw / 2, H * 0.7 - fs * 1.1, tw, fs * 2.2, 6); ctx.fill();
      ctx.fillStyle = '#eee';
      wrapText(ctx, text, W / 2, H * 0.7, tw - 20, fs * 1.1);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    this.drawControls(ctx, W, H);
  };

  Level.prototype.drawControls = function (ctx, W, H) {
    var ui = this.ui, inp = this.input, p = this.p;
    ctx.save();
    var j = inp.joy, jb = j ? { x: j.ox, y: j.oy } : ui.joy;
    ctx.globalAlpha = j ? 0.55 : 0.28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.strokeStyle = '#c4180f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(jb.x, jb.y, ui.joy.r, 0, 6.283); ctx.fill(); ctx.stroke();
    var kx = jb.x + (j ? j.dx * j.mag * ui.joy.r : 0), ky = jb.y + (j ? j.dy * j.mag * ui.joy.r : 0);
    ctx.globalAlpha = j ? 0.9 : 0.4;
    ctx.fillStyle = '#8a0d0d'; ctx.beginPath(); ctx.arc(kx, ky, ui.joy.r * 0.42, 0, 6.283); ctx.fill();
    var btn = function (b, label, on, glow) {
      ctx.globalAlpha = on ? 0.95 : 0.6;
      var gr = ctx.createRadialGradient(b.x, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
      gr.addColorStop(0, on ? '#ff7a2a' : '#5a0a0a'); gr.addColorStop(1, on ? '#a01000' : '#200204');
      ctx.fillStyle = gr;
      if (glow) { ctx.shadowColor = '#ff3a00'; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = on ? '#ffb070' : '#7a1a1a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffe8d8';
      ctx.font = '700 ' + Math.max(9, b.r * 0.32) + 'px "Cinzel", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, b.x, b.y);
    };
    var lab = this.actionLabel();
    btn(ui.act, lab || 'ACCIÓN', !!lab || inp.buttons.act, !!lab && Math.sin(this.t * 6) > 0);
    btn(ui.run, p.tired ? 'CANSADO' : 'CORRER', p.run && !p.crouch);
    btn(ui.crouch, 'AGACHAR', p.crouch);
    var pz = ui.pause;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(pz.x, pz.y, pz.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#d8ccd8'; ctx.fillRect(pz.x - pz.r * 0.35, pz.y - pz.r * 0.4, pz.r * 0.25, pz.r * 0.8); ctx.fillRect(pz.x + pz.r * 0.1, pz.y - pz.r * 0.4, pz.r * 0.25, pz.r * 0.8);
    ctx.restore();
  };

  Level.prototype.drawNote = function (ctx, W, H) {
    var n = this.note, u = Math.min(W, H);
    var bw = Math.min(W * 0.7, u * 1.3), bh = u * 0.7, bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    var gr = ctx.createLinearGradient(0, by, 0, by + bh);
    gr.addColorStop(0, '#d8ccaa'); gr.addColorStop(1, '#b8a880');
    ctx.fillStyle = gr; roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
    ctx.fillStyle = 'rgba(90,6,6,0.5)'; ctx.beginPath(); ctx.arc(bx + bw * 0.88, by + bh * 0.8, u * 0.04, 0, 6.283); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5a0606'; ctx.font = (u * 0.06) + 'px "Metal Mania", serif';
    ctx.fillText(n.title, W / 2, by + u * 0.08);
    ctx.fillStyle = '#2a1e10'; ctx.font = '700 ' + (u * 0.038) + 'px "Cinzel", serif';
    wrapText(ctx, n.text, W / 2, by + bh * 0.52, bw - u * 0.12, u * 0.052);
    ctx.font = '400 ' + (u * 0.03) + 'px "Cinzel", serif'; ctx.fillStyle = '#5a4a30';
    ctx.fillText('Tocá para cerrar', W / 2, by + bh - u * 0.04);
    ctx.restore();
  };

  Level.prototype.menuButtons = function (W, H, labels) {
    var u = Math.min(W, H), bw = u * 0.6, bh = u * 0.11;
    return labels.map(function (l, i) { return { id: l[0], label: l[1], x: W / 2 - bw / 2, y: H * 0.42 + i * (bh + u * 0.03), w: bw, h: bh }; });
  };

  Level.prototype.drawButtons = function (ctx, list) {
    list.forEach(function (b) {
      var gr = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      gr.addColorStop(0, '#c2240f'); gr.addColorStop(1, '#640400');
      ctx.fillStyle = gr; roundRect(ctx, b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe8d0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = (b.h * 0.5) + 'px "Metal Mania", serif';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    });
  };

  Level.prototype.drawPause = function (ctx, W, H) {
    var u = Math.min(W, H);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c4180f'; ctx.font = (u * 0.12) + 'px "Metal Mania", serif';
    ctx.shadowColor = '#f00'; ctx.shadowBlur = 16;
    ctx.fillText('PAUSA', W / 2, H * 0.25);
    ctx.shadowBlur = 0;
    if (this.net) { ctx.font = '400 ' + (u * 0.032) + 'px "Cinzel", serif'; ctx.fillStyle = '#b9a9b9'; ctx.fillText('En cooperativo el juego sigue corriendo', W / 2, H * 0.34); }
    var items = this.net ? [['resume', 'Reanudar'], ['quit', 'Salir de la partida']] : [['resume', 'Reanudar'], ['restart', 'Reiniciar nivel'], ['quit', 'Salir del nivel']];
    this.pauseBtns = this.menuButtons(W, H, items);
    this.drawButtons(ctx, this.pauseBtns);
    ctx.restore();
  };

  Level.prototype.drawWin = function (ctx, W, H) {
    var u = Math.min(W, H), a = Math.min(1, this.winT / 1.2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffcc00'; ctx.font = (u * 0.13) + 'px "Metal Mania", serif';
    ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 20;
    ctx.fillText(this.net ? '¡ESCAPARON!' : '¡ESCAPASTE!', W / 2, H * 0.2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d8ccd8'; ctx.font = '700 ' + (u * 0.042) + 'px "Cinzel", serif';
    var s = this.time | 0, read = this.map.notes.filter(function (n) { return n.read; }).length;
    ctx.fillText('El Castillo del Terror · tiempo ' + (s / 60 | 0) + ':' + ('0' + s % 60).slice(-2), W / 2, H * 0.32);
    ctx.font = '400 ' + (u * 0.034) + 'px "Cinzel", serif';
    ctx.fillText('Notas leídas: ' + read + '/' + this.map.notes.length + ' · La Dama Blanca los vio irse…', W / 2, H * 0.39);
    if (this.winT > 1) {
      this.winBtns = this.menuButtons(W, H, this.net ? [['quit', 'Volver a la sala']] : [['quit', 'Continuar'], ['restart', 'Jugar de nuevo']]);
      this.winBtns.forEach(function (b) { b.y += H * 0.08; });
      this.drawButtons(ctx, this.winBtns);
    } else this.winBtns = null;
    ctx.restore();
  };

  /* ---------- Entrada ---------- */

  function inCircle(b, x, y, extra) { return Math.hypot(x - b.x, y - b.y) <= b.r * (extra || 1.25); }
  function inRect(b, x, y) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }

  Level.prototype.pointer = function (type, e) {
    if (!this.ready || !this.ui) return;
    var x = e.clientX, y = e.clientY, ui = this.ui, inp = this.input, id = e.pointerId;
    if (type === 'down') {
      if (this.won) { var wb = (this.winBtns || []).filter(function (b) { return inRect(b, x, y); })[0]; if (wb) this.choose(wb.id); return; }
      if (this.paused) { var pb = (this.pauseBtns || []).filter(function (b) { return inRect(b, x, y); })[0]; if (pb) this.choose(pb.id); return; }
      if (this.note) { this.note = null; RM.audio.page(); return; }
      if (inCircle(ui.pause, x, y, 1.4)) { this.setPaused(true); return; }
      if (inCircle(ui.act, x, y)) { inp.buttons.act = id; this.act(); return; }
      if (inCircle(ui.run, x, y)) { this.p.run = !this.p.run; if (this.p.run) this.p.crouch = false; RM.audio.hover(); RM.vibrate([10]); return; }
      if (inCircle(ui.crouch, x, y)) { this.p.crouch = !this.p.crouch; if (this.p.crouch) this.p.run = false; RM.audio.hover(); RM.vibrate([10]); return; }
      if (x < this.W * 0.55 && !inp.joy) inp.joy = { id: id, ox: x, oy: y, dx: 0, dy: 0, mag: 0 };
    } else if (type === 'move') {
      var j = inp.joy;
      if (j && j.id === id) {
        var dx = x - j.ox, dy = y - j.oy, d = Math.hypot(dx, dy), R = ui.joy.r;
        if (d > R * 1.4) { j.ox = x - dx / d * R * 1.4; j.oy = y - dy / d * R * 1.4; dx = x - j.ox; dy = y - j.oy; d = Math.hypot(dx, dy); }
        j.mag = Math.min(1, d / R); j.dx = d ? dx / d : 0; j.dy = d ? dy / d : 0;
      }
    } else {
      if (inp.joy && inp.joy.id === id) inp.joy = null;
      if (inp.buttons.act === id) inp.buttons.act = null;
    }
  };

  Level.prototype.key = function (down, e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.input.keys[k] = down;
    if (!down) return;
    if (k === 'Escape' || k === 'p') { this.setPaused(!this.paused); return; }
    if (this.won && (k === 'Enter' || k === ' ')) { this.choose('quit'); return; }
    if (k === 'e' || k === ' ' || k === 'Enter') this.act();
    if (k === 'c' || k === 'Control') { this.p.crouch = !this.p.crouch; if (this.p.crouch) this.p.run = false; }
    if (k === 'r') { this.p.run = !this.p.run; if (this.p.run) this.p.crouch = false; }
  };

  Level.prototype.setPaused = function (v) {
    if (this.won) return;
    this.paused = v;
    this.input.joy = null;
    RM.audio[v ? 'back' : 'hover']();
  };

  Level.prototype.choose = function (id) {
    RM.audio.select();
    if (id === 'resume') this.setPaused(false);
    else if (id === 'restart') { this.reset(); RM.audio.setMuffle(1); }
    else if (id === 'quit') { RM.audio.setMuffle(0); this.onExit(this.won); }
  };

  Level.prototype.back = function () {
    if (this.note) { this.note = null; return; }
    if (this.won) { this.choose('quit'); return; }
    this.setPaused(!this.paused);
  };

  // Imagen del mapa completo (para documentación).
  Level.prototype.overview = function (scale) {
    var m = this.map, c = RM.canvas(m.W * T * scale, m.H * T * scale), g = c.getContext('2d');
    var saved = this.tex;
    this.buildTextures(scale);
    g.scale(scale, scale);
    var cam = { x: 0, y: 0 };
    this.drawTiles(g, 0, 0, m.W * T, m.H * T);
    this.drawDecals(g, 0, 0, m.W * T, m.H * T);
    this.drawDoors(g);
    this.worldIcons = {}; var self = this; A.icons.forEach(function (n) { self.worldIcons[n] = A.icon(n, scale); });
    this.drawPickups(g, 0, 0, m.W * T, m.H * T);
    this.drawSorted(g, 0, 0, m.W * T, m.H * T);
    this.drawFlames(g, 0, 0, m.W * T, m.H * T);
    this.tex = saved; this.W = 0; void cam;
    return c;
  };

  RM.Level = Level;
})(window.RM);
