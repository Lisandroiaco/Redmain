/* Red Main — motor del nivel jugable (2D desde arriba, arte vectorial).
   Solo o cooperativo (hasta 4): el anfitrión es la autoridad del mundo
   (objetos, forja, llave, portón) y maneja a la Dama Blanca; cada jugador
   manda su posición y su salud. */
(function (RM) {
  'use strict';
  var clamp = RM.clamp, rand = RM.rand, A = RM.Art2, TL = A.TILE;
  var T = 32;
  var SPEED = { walk: 104, run: 184, crouch: 52 };
  var RECIPE = ['ingot', 'ingot2', 'coal', 'nails', 'hammer'];
  var MODE_CODE = { walk: 0, run: 1, crouch: 2 };
  var DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];          // 0 abajo, 1 izq, 2 der, 3 arriba
  var DIR_NAME = ['ABAJO', 'la IZQUIERDA', 'la DERECHA', 'ARRIBA'];
  var WW = { warn: 1.9, point: 4.8, clones: 1.8, speed: 170, chaseMax: 15, windup: 0.5, leap: 0.42, recover: 0.85, attackMax: 8, struggleOdds: 0.22 };
  var BLEED = 50;

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
      function () { self.buildMinimap(); },
      function () { var n = self.map.W * self.map.H; self.bfsD = new Int16Array(n).fill(-1); self.bfsQ = new Int32Array(n); self.bfsN = 0; },
      function () { self.reset(); },
      function () { self.ready = true; }
    ];
  };

  Level.prototype.buildTextures = function (k) {
    var tx = { k: k, floor: {}, wallFace: [], props: {}, decal: {}, deco: {} };
    [TL.STONE, TL.WOOD, TL.CARPET, TL.GRASS, TL.CRYPT, TL.OUT, TL.DIRT, TL.CHECK].forEach(function (t) {
      tx.floor[t] = [0, 1, 2].map(function (v) { return A.floor(t, v, k); });
    });
    tx.wallFace = [0, 1, 2].map(function (v) { return A.wallFace(v, k); });
    tx.wallTop = A.wallTop(k);
    Object.keys(A.PROP).forEach(function (p) { if (A.PROP[p].draw) tx.props[p] = A.prop(p, k); });
    Object.keys(DECAL_ART).forEach(function (d) { tx.decal[d] = render(DECAL_ART[d][0], DECAL_ART[d][1], k, DECAL_ART[d][2]); });
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
      g.strokeStyle = 'rgba(200,160,70,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(48, 14); g.lineTo(70, 32); g.lineTo(48, 50); g.lineTo(26, 32); g.closePath(); g.stroke();
      g.strokeStyle = '#b08a3a'; for (var f = 6; f < 92; f += 4) { g.beginPath(); g.moveTo(f, 0); g.lineTo(f, 3); g.moveTo(f, 61); g.lineTo(f, 64); g.stroke(); }
    }],
    coalpile: [48, 28, function (g) {
      g.fillStyle = '#141418'; g.beginPath(); g.ellipse(24, 16, 22, 10, 0, 0, 6.283); g.fill();
      g.fillStyle = '#3a3a44'; [[14, 12], [28, 10], [34, 16]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 2, 0, 6.283); g.fill(); });
    }],
    papers: [40, 32, function (g) {
      [[6, 8, 0.3], [18, 14, -0.4], [22, 4, 0.1]].forEach(function (p) {
        g.save(); g.translate(p[0] + 7, p[1] + 9); g.rotate(p[2]);
        A.box(g, -7, -9, 14, 18, 1, '#d8ccaa', 0.8);
        g.fillStyle = 'rgba(60,40,20,0.5)'; for (var i = 0; i < 4; i++) g.fillRect(-5, -6 + i * 3.5, 10, 0.8);
        g.restore();
      });
    }],
    crack: [40, 40, function (g) {
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(4, 6); g.lineTo(12, 14); g.lineTo(11, 22); g.lineTo(20, 28); g.lineTo(34, 30); g.moveTo(12, 14); g.lineTo(22, 12); g.moveTo(20, 28); g.lineTo(18, 36); g.stroke();
    }],
    trail: [16, 16, function (g) {
      g.fillStyle = 'rgba(130,4,8,0.9)'; g.beginPath(); g.arc(8, 8, 3.4, 0, 6.283); g.fill();
      g.beginPath(); g.arc(12, 11, 1.4, 0, 6.283); g.arc(4, 12, 1, 0, 6.283); g.fill();
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
    fireplace: [96, 32, function (g) {
      A.box(g, 0, 2, 96, 30, 3, '#3a3440'); A.box(g, 12, 10, 72, 22, 12, '#0a0606', 1); A.box(g, -2, 0, 100, 6, 2, '#5a5466');
      g.strokeStyle = '#3a2414'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(26, 30); g.lineTo(70, 26); g.moveTo(26, 26); g.lineTo(70, 30); g.stroke();
    }],
    furnace: [96, 32, function (g) {
      A.box(g, 0, 2, 96, 30, 4, '#5a3a2a'); A.box(g, 16, 10, 64, 20, 8, '#0a0404', 1);
      g.fillStyle = 'rgba(255,80,20,0.45)'; g.fillRect(18, 22, 60, 6);
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

  // Minimapa: 2 px por tile + niebla por sala sin explorar.
  Level.prototype.buildMinimap = function () {
    var m = this.map, k = 2, c = RM.canvas(m.W * k, m.H * k), g = c.getContext('2d');
    var COL = {}; COL[TL.WALL] = '#0c0a10'; COL[TL.STONE] = '#4a4652'; COL[TL.WOOD] = '#5a3e2a'; COL[TL.CARPET] = '#5a1820';
    COL[TL.GRASS] = '#25381f'; COL[TL.CRYPT] = '#2a2634'; COL[TL.OUT] = '#1e2c1e'; COL[TL.DIRT] = '#4a3c28'; COL[TL.CHECK] = '#46424c';
    for (var y = 0; y < m.H; y++) for (var x = 0; x < m.W; x++) {
      var i = y * m.W + x;
      g.fillStyle = m.solid[i] === 1 && m.tiles[i] !== TL.WALL ? '#2a2026' : COL[m.tiles[i]];
      g.fillRect(x * k, y * k, k, k);
    }
    this.mini = c;
    this.fog = RM.canvas(m.W * k, m.H * k);
    var fg = this.fog.getContext('2d'); fg.fillStyle = '#050307'; fg.fillRect(0, 0, this.fog.width, this.fog.height);
  };

  Level.prototype.explore = function (idx) {
    if (idx == null || idx < 0 || this.explored[idx]) return;
    this.explored[idx] = 1;
    var rm = this.map.rooms[idx], g = this.fog.getContext('2d');
    g.clearRect((rm.x - 2) * 2, (rm.y - 2) * 2, (rm.w + 4) * 2, (rm.h + 4) * 2);
  };

  Level.prototype.reset = function () {
    var m = this.map;
    m.items.forEach(function (it) { it.taken = false; });
    m.notes.forEach(function (n) { n.read = false; });
    m.gate.open = 0; m.gate.opening = false; m.cryptDoor.open = false; m.setDoorSolid();
    var idx = 0;
    if (this.net) {
      var me = this.net.myId;
      this.net.players.forEach(function (p, i) { if (p.id === me) idx = i; });
    }
    this.myIdx = idx;
    var sp = m.spawns[idx % m.spawns.length];
    this.p = this.newPlayer(sp);
    this.inv = {};
    this.bag = { bandage: 0, holy: 0 };
    this.crafted = false; this.used = false;
    this.escaped = {};
    this.time = 0; this.t = 0;
    this.msg = null; this.note = null; this.paused = false; this.won = false; this.winT = 0;
    this.room = null; this.roomToast = null; this.flash = 0; this.nextFlash = rand(6, 12);
    this.scare = null; this.scares = {}; this.flicker = 0; this.near = null;
    this.input = { keys: {}, joy: null, buttons: {} };
    this.others = this.others || {};
    this.sendT = 0; this.worldT = 0; this.checkT = 0;
    this.rain = [];
    this.smoke = [];
    this.trail = [];
    this.flyers = [];
    this.cine = null; this.qte = null; this.dead = null; this.over = null; this.showMap = false;
    this.hints = {};
    this.explored = new Uint8Array(m.rooms.length);
    if (this.fog) { var fg = this.fog.getContext('2d'); fg.globalCompositeOperation = 'source-over'; fg.fillStyle = '#050307'; fg.fillRect(0, 0, this.fog.width, this.fog.height); }
    this.ww = { s: 'idle', t: 0, next: this.net ? 40 : 45, x: 0, y: 0, face: 0, point: 0, tg: null, lean: 1, k: 0, clones: [], vis: 0 };
    this.wwShown = { s: 'idle', x: 0, y: 0, tx: 0, ty: 0 };
    this.say(this.net ? 'Cooperativo: junten los materiales, forjen la herradura y salgan todos. Cuidado con la Dama Blanca.' : 'Encontrá los materiales para forjar una herradura y abrí el portón. El castillo es enorme: usá el MAPA.', 6);
    if (this.net && !this.netBound) this.bindNet();
  };

  Level.prototype.newPlayer = function (sp) {
    return { x: sp.x, y: sp.y, dir: 3, phase: 0, amp: 0, run: false, crouch: false, runK: 0, crouchK: 0, stamina: 1, tired: false, stepAcc: 0, mode: 'walk', escaped: false,
      h: 0, bleedT: 0, eye: 0, wrap: 0, pickT: 0, healT: 0, reviveT: 0, beatT: 0, dropT: 0, downK: 0 };
  };

  Level.prototype.say = function (text, dur) { this.msg = { text: text, t: dur || 3 }; };
  Level.prototype.hint = function (key, text, dur) { if (this.hints[key]) return; this.hints[key] = true; this.say(text, dur || 4); };

  /* ---------- Red (cooperativo) ---------- */

  Level.prototype.bindNet = function () {
    var self = this, net = this.net;
    this.netBound = true;
    net.players.forEach(function (p, i) {
      if (p.id !== net.myId) {
        var sp = self.map.spawns[i % 4];
        self.others[p.id] = { id: p.id, name: p.name, idx: i, x: sp.x, y: sp.y, tx: sp.x, ty: sp.y, dir: 3, phase: 0, amp: 0, mode: 0, fresh: false, h: 0, eye: 0, wrap: 0, an: 0, downK: 0 };
      }
    });
    net.on(function (msg) {
      if (!msg || !self.ready) return;
      if (msg.t === 'p') {
        var o = self.others[msg.id];
        if (!o) return;
        o.tx = msg.x; o.ty = msg.y; o.dir = msg.d; o.mode = msg.m; o.moving = msg.mv; o.escaped = msg.e;
        o.h = msg.h || 0; o.eye = msg.ey || 0; o.wrap = msg.wr || 0; o.an = msg.an || 0;
        if (!o.fresh) { o.x = msg.x; o.y = msg.y; o.fresh = true; }
      } else if (msg.t === 'req' && net.isHost) {
        self.hostApply(msg.a, msg.id, msg.arg);
      } else if (msg.t === 'w' && !net.isHost) {
        self.applyWorld(msg);
      } else if (msg.t === 'ww' && !net.isHost) {
        self.wwApply(msg);
      } else if (msg.t === 'ev' && !net.isHost) {
        self.onEvent(msg);
      }
    });
    if (net.onLeave) net.onLeave(function (id) {
      var o = self.others[id];
      if (!o) return;
      delete self.others[id];
      self.say(o.name + ' se desconectó.', 3);
      if (net.isHost) { if (self.ww.tg === id) self.wwVanish(); self.checkWin(); }
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
    var mine = ev.by === this.myId();
    var who = mine ? 'Conseguiste' : (this.nameOf(ev.by) + ' consiguió');
    if (ev.type === 'take') {
      var it = this.map.items.filter(function (x) { return x.id === ev.id; })[0];
      if (it && it.kind !== 'quest') {
        if (!mine) return;
        this.bag[it.kind]++;
        RM.audio.pickup(); RM.vibrate([15]);
        this.flyIcon(it);
        this.say(it.name + ' (' + this.bag[it.kind] + ')' + (it.kind === 'holy' ? ' · tirásela a la Dama cuando te persiga' : ' · sirve para frenar el sangrado'), 2.6);
        return;
      }
      RM.audio.pickup(); RM.vibrate([20]);
      if (it) this.flyIcon(it);
      this.say(who + ': ' + ev.name + (ev.recipe ? ' (' + this.count() + '/5)' : ''), 2.8);
      if (this.count() === 5 && !this.crafted) { var self = this; setTimeout(function () { self.say('Tienen todo. Vayan a la Herrería a forjar la herradura.', 4); }, 2000); }
    } else if (ev.type === 'craft') {
      RM.audio.clang(); RM.vibrate([40, 120, 40, 120, 80]);
      this.say((mine ? 'Forjaste' : this.nameOf(ev.by) + ' forjó') + ' la HERRADURA. Llévenla al portón del Gran Vestíbulo.', 4);
    } else if (ev.type === 'unlock') {
      RM.audio.creak(); this.say('La puerta de la cripta se abrió…', 3);
    } else if (ev.type === 'gate') {
      RM.vibrate([200]); this.say('El portón cruje y se abre…', 3);
    } else if (ev.type === 'escape' && !mine) {
      this.say(this.nameOf(ev.by) + ' salió del castillo.', 3);
    }
  };

  Level.prototype.flyIcon = function (it) {
    if (!this.cam) return;
    this.flyers.push({ icon: it.icon, sx: (it.x - this.cam.x) * this.S, sy: (it.y - 10 - this.cam.y) * this.S, t: 0, kind: it.kind, id: it.id });
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
  // Eventos que manda el anfitrión (a todos; cada uno mira si es para él).
  Level.prototype.emit = function (ev) {
    ev.t = 'ev';
    if (this.net && this.net.isHost) this.net.send(ev);
    this.onEvent(ev);
  };

  Level.prototype.hostApply = function (a, by, arg) {
    var m = this.map, ev = null, self = this;
    if (a === 'take') {
      var it = m.items.filter(function (x) { return x.id === arg; })[0];
      if (!it || it.taken) return;
      it.taken = true;
      if (it.kind === 'quest') this.inv[it.id] = true;
      ev = { type: 'take', by: by, id: it.id, name: it.name, recipe: RECIPE.indexOf(it.id) >= 0 };
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
      if (this.ww.tg === by) this.wwVanish();
      this.checkWin(true);
    } else if (a === 'banish') {
      var w = this.ww, pos = this.actorPos(by);
      if (!pos || ['point', 'chase', 'windup', 'leap', 'recover'].indexOf(w.s) < 0) return;
      if (Math.hypot(w.x - pos.x, w.y - pos.y) > 175) return;
      this.emit({ k: 'banish', by: by, x: w.x, y: w.y });
      this.wwVanish(rand(70, 110));
    } else if (a === 'attackDone') {
      if (this.ww.s === 'attack' && this.ww.tg === by) this.wwVanish(arg && arg.won ? rand(70, 100) : rand(55, 90));
    } else if (a === 'heal') {
      this.emit({ k: 'healed', to: arg, by: by });
    } else if (a === 'dead') {
      if (this.ww.tg === by) this.wwVanish();
      this.checkWin();
    }
    if (ev) { this.showEvent(ev); this.broadcastWorld(ev); }
  };

  // Jugadores que conoce el anfitrión (para la IA).
  Level.prototype.actors = function () {
    var p = this.p, list = [{ id: this.myId(), x: p.x, y: p.y, h: p.h, esc: p.escaped, busy: !!(this.cine || this.qte) }];
    var self = this;
    Object.keys(this.others).forEach(function (id) { var o = self.others[id]; list.push({ id: id, x: o.x, y: o.y, h: o.h, esc: o.escaped || self.escaped[id], busy: o.an === 3 || o.an === 4 }); });
    return list;
  };
  Level.prototype.actorPos = function (id) { return this.actors().filter(function (a) { return a.id === id; })[0] || null; };

  Level.prototype.checkWin = function (silent) {
    var self = this, acts = this.actors();
    var done = acts.every(function (a) { return self.escaped[a.id] || a.h === 2; });
    var any = acts.some(function (a) { return self.escaped[a.id]; });
    if (done && any && !this.won) { this.win(); if (!silent) this.broadcastWorld(null); }
    else if (done && !any && this.net && !this.over) this.emit({ k: 'gameover' });
  };

  Level.prototype.win = function () {
    this.won = true; this.winT = 0;
    RM.audio.select(); RM.vibrate([60, 60, 60]);
    if (!this.net) RM.Screens.saveRecord(1, this.time);
  };

  /* ---------- La Dama Blanca (la maneja el anfitrión) ---------- */

  Level.prototype.free = function (x, y) { return !this.blocked(x, y); };
  Level.prototype.clearLine = function (x0, y0, x1, y1) {
    var n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12);
    for (var i = 1; i <= n; i++) if (!this.free(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  };

  Level.prototype.wwSet = function (s) {
    var w = this.ww;
    w.s = s; w.t = 0;
    this.wwSend(true);
    this.wwEnter(s, w);
  };
  Level.prototype.wwSend = function (force) {
    if (!this.net || !this.net.isHost) return;
    var w = this.ww;
    this.net.send({ t: 'ww', s: w.s, x: Math.round(w.x), y: Math.round(w.y), f: w.face, pd: w.point, tg: w.tg, ln: w.lean, k: Math.round(w.k * 100) / 100, h: Math.round(w.hgt || 0), cl: w.clones.map(function (c) { return [Math.round(c.x), Math.round(c.y)]; }), fz: !!force });
  };
  // Cliente: recibe el estado de la Dama.
  Level.prototype.wwApply = function (msg) {
    var w = this.ww, prev = w.s;
    var firstSeen = prev === 'idle' || prev === 'warn';
    w.tx = msg.x; w.ty = msg.y; w.face = msg.f; w.point = msg.pd; w.tg = msg.tg; w.lean = msg.ln; w.k = msg.k; w.hgt = msg.h;
    w.clones = msg.cl.map(function (c, i) { var o = w.clones[i]; return { x: o && !firstSeen ? o.x : c[0], y: o && !firstSeen ? o.y : c[1], tx: c[0], ty: c[1] }; });
    if (msg.s !== prev) {
      if (prev === 'idle' || prev === 'warn' || msg.s === 'point' || msg.s === 'leap') { w.x = msg.x; w.y = msg.y; }
      w.s = msg.s; w.t = 0;
      this.wwEnter(msg.s, w);
    }
  };
  // Efectos de cada estado (en todos los dispositivos).
  Level.prototype.wwEnter = function (s, w) {
    var me = w.tg === this.myId(), d = this.distMe(w.x, w.y);
    var vol = me ? 1 : clamp(1 - d / 900, 0.12, 1);
    if (s === 'warn') {
      var tp = this.actorPos(w.tg), dt = tp ? this.distMe(tp.x, tp.y) : 0;
      RM.audio.hook(me ? 1 : clamp(1 - dt / 900, 0.15, 0.8), 0);
      if (me) { RM.vibrate([30, 60, 30]); this.hint('warn', 'Se escucha un garfio arrastrándose… no te muevas.', 2.5); this.flicker = 1.2; }
    } else if (s === 'point') {
      RM.Dama.smoke.puff(this.smoke, w.x, w.y, 26, 1.2);
      RM.audio.smoke(vol); RM.audio.whisper();
      if (me) { RM.vibrate([60, 40, 60]); this.say('¡Te señala hacia ' + DIR_NAME[w.point] + '! Andá para ese lado.', 3); }
    } else if (s === 'chase') {
      RM.audio.shriek(vol);
      if (me) { this.say(this.bag.holy ? '¡Te persigue! Corré o tirale AGUA BENDITA.' : '¡Te persigue! ¡CORRÉ!', 2.6); RM.vibrate([100]); }
    } else if (s === 'clones') {
      RM.audio.clones();
      w.clones.forEach(function (c) { RM.Dama.smoke.puff(this.smoke, c.x, c.y, 6, 0.6); }, this);
      RM.Dama.smoke.puff(this.smoke, w.x, w.y, 6, 0.6);
      if (me) { this.say('No le hiciste caso… se está multiplicando.', 2); RM.vibrate([200, 50, 200]); }
    } else if (s === 'leap') {
      RM.audio.shriek(vol * 0.8);
    } else if (s === 'vanish') {
      RM.Dama.smoke.puff(this.smoke, w.x, w.y, 30, 1.3);
      RM.audio.smoke(vol);
    }
  };
  Level.prototype.distMe = function (x, y) { var c = this.camTarget(); return Math.hypot(x - c.x, y - c.y); };

  Level.prototype.wwVanish = function (next) {
    var w = this.ww;
    if (w.s === 'idle') return;
    this.wwSet('vanish');
    w.clones = [];
    w.next = next || rand(55, 95) * (this.net ? 0.8 : 1);
  };

  // Campo de distancias hacia el objetivo (BFS en una ventana alrededor).
  Level.prototype.flow = function (tx, ty, maxD) {
    var m = this.map, W = m.W, D = this.bfsD, Q = this.bfsQ, i;
    for (i = 0; i < this.bfsN; i++) D[Q[i]] = -1;
    var s = ty * W + tx, qh = 0, qt = 0;
    if (s < 0 || s >= D.length) { this.bfsN = 0; return; }
    D[s] = 0; Q[qt++] = s;
    while (qh < qt) {
      var c = Q[qh++], d = D[c];
      if (d >= maxD) continue;
      var cx = c % W, cy = (c / W) | 0;
      for (var k = 0; k < 4; k++) {
        var nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.H) continue;
        var n = ny * W + nx;
        if (D[n] >= 0 || m.solid[n] !== 0) continue;
        D[n] = d + 1; Q[qt++] = n;
      }
    }
    this.bfsN = qt;
  };

  Level.prototype.wwUpdate = function (dt) {
    var w = this.ww, self = this;
    w.t += dt;
    var acts = this.actors();
    var tgt = w.tg ? acts.filter(function (a) { return a.id === w.tg; })[0] : null;
    var valid = function (a) { return a && a.h === 0 && !a.esc && !a.busy; };
    if (w.s !== 'idle' && w.s !== 'vanish' && w.s !== 'attack' && !valid(tgt)) { this.wwVanish(rand(30, 50)); return; }
    if (w.s === 'idle') {
      if (this.won || this.over) return;
      var cands = acts.filter(valid);
      if (!cands.length) return;
      w.next -= dt * (this.used ? 1.4 : 1);
      if (w.next > 0) return;
      var pickT = cands.filter(function (a) { return a.id !== w.last; });
      tgt = (pickT.length ? pickT : cands)[(Math.random() * (pickT.length || cands.length)) | 0];
      w.tg = tgt.id; w.last = tgt.id; w.clones = [];
      w.x = tgt.x; w.y = tgt.y;
      this.wwSet('warn');
    } else if (w.s === 'warn') {
      if (w.t < WW.warn) return;
      // Aparece exactamente arriba, abajo, a la izquierda o a la derecha del jugador.
      var order = [0, 1, 2, 3].sort(function () { return Math.random() - 0.5; }), spot = null;
      for (var dist = 3.4; dist >= 1.8 && !spot; dist -= 0.4) {
        for (var i = 0; i < 4 && !spot; i++) {
          var d = DIRS[order[i]], sx = tgt.x + d[0] * dist * T, sy = tgt.y + d[1] * dist * T;
          if (this.free(sx, sy) && this.clearLine(tgt.x, tgt.y - 4, sx, sy - 4)) spot = { x: sx, y: sy, side: order[i] };
        }
      }
      if (!spot) { w.next = rand(8, 15); w.s = 'idle'; this.wwSend(true); return; }
      // Elige un camino abierto para señalar (no hacia ella misma).
      var opts = [0, 1, 2, 3].filter(function (k) {
        if (k === spot.side) return false;
        var dd = DIRS[k];
        return self.free(tgt.x + dd[0] * 40, tgt.y + dd[1] * 40) && self.free(tgt.x + dd[0] * 80, tgt.y + dd[1] * 80) && self.free(tgt.x + dd[0] * 110, tgt.y + dd[1] * 110);
      });
      if (!opts.length) opts = [0, 1, 2, 3].filter(function (k) { return k !== spot.side && self.free(tgt.x + DIRS[k][0] * 40, tgt.y + DIRS[k][1] * 40); });
      if (!opts.length) { w.next = rand(8, 15); w.s = 'idle'; this.wwSend(true); return; }
      w.x = spot.x; w.y = spot.y;
      w.point = opts[(Math.random() * opts.length) | 0];
      w.face = spot.side === 0 ? 3 : 0;
      w.ox = tgt.x; w.oy = tgt.y; w.k = 0;
      this.wwSet('point');
    } else if (w.s === 'point') {
      w.k = Math.min(1, w.t / 0.5);
      var dv = DIRS[w.point], mx = tgt.x - w.ox, my = tgt.y - w.oy;
      var prog = mx * dv[0] + my * dv[1], wrong = Math.hypot(mx, my) - Math.max(0, prog);
      if (prog >= 78) { w.chaseT = 0; this.wwSet('chase'); }
      else if (wrong > 64 || prog < -48 || w.t > WW.point) {
        w.clones = DIRS.map(function (dd) { return { x: tgt.x + dd[0] * 2.4 * T, y: tgt.y + dd[1] * 2.4 * T }; });
        w.x = tgt.x - 1.6 * T; w.y = tgt.y - 1.6 * T;
        this.wwSet('clones');
      }
    } else if (w.s === 'clones') {
      var k2 = Math.min(1, w.t / WW.clones);
      w.clones.forEach(function (c, i) {
        var dd = DIRS[i], r = (2.4 - 1.9 * k2 * k2) * T;
        c.x = tgt.x + dd[0] * r; c.y = tgt.y + dd[1] * r;
      });
      w.x += (tgt.x - w.x) * dt * 2; w.y += (tgt.y - 24 - w.y) * dt * 2;
      if (w.t >= WW.clones) { this.emit({ k: 'kill', to: w.tg }); this.wwVanish(rand(60, 90)); }
    } else if (w.s === 'chase' || w.s === 'recover') {
      w.chaseT += dt;
      if (w.s === 'recover' && w.t > WW.recover) { w.s = 'chase'; w.t = 0; this.wwSend(true); }
      var dx = tgt.x - w.x, dy = tgt.y - w.y, dd2 = Math.hypot(dx, dy);
      if (w.chaseT > WW.chaseMax || dd2 > 15 * T) { this.wwVanish(); if (tgt.id === this.myId()) this.say('Se esfumó… por ahora.', 2.5); else this.emit({ k: 'lost', to: tgt.id }); return; }
      if (w.s === 'chase') {
        if (dd2 < 118 && w.t > 0.6) {
          w.lx0 = w.x; w.ly0 = w.y; w.lx = tgt.x; w.ly = tgt.y;
          this.wwSet('windup'); return;
        }
        this.wwSteer(tgt, WW.speed * (w.chaseT < 1 ? 0.6 : 1), dt);
      }
    } else if (w.s === 'windup') {
      w.k = Math.min(1, w.t / 0.2);
      // Apunta adonde vas a estar.
      w.lx = tgt.x + (tgt.x - w.lx) * 0.6; w.ly = tgt.y + (tgt.y - w.ly) * 0.6;
      w.lean = tgt.x < w.x ? -1 : 1;
      if (w.t >= WW.windup) {
        var ex = w.lx, ey = w.ly, lx = ex - w.x, ly = ey - w.y, ll = Math.hypot(lx, ly) || 1;
        if (ll > 160) { ex = w.x + lx / ll * 160; ey = w.y + ly / ll * 160; }
        w.lx0 = w.x; w.ly0 = w.y; w.lx = ex; w.ly = ey;
        this.wwSet('leap');
      }
    } else if (w.s === 'leap') {
      var kk = Math.min(1, w.t / WW.leap);
      w.x = w.lx0 + (w.lx - w.lx0) * kk; w.y = w.ly0 + (w.ly - w.ly0) * kk;
      w.hgt = Math.sin(kk * Math.PI) * 38; w.k = kk;
      if (kk >= 1) {
        w.hgt = 0;
        if (Math.hypot(tgt.x - w.x, tgt.y - w.y) < 38) {
          var mode = Math.random() < WW.struggleOdds ? 'struggle' : 'stab';
          w.x = tgt.x; w.y = tgt.y + 2;
          this.wwSet('attack');
          this.emit({ k: 'hit', to: w.tg, m: mode });
        } else this.wwSet('recover');
      }
    } else if (w.s === 'attack') {
      if (w.t > WW.attackMax) this.wwVanish();
    } else if (w.s === 'vanish') {
      if (w.t > 1.2) { w.s = 'idle'; w.tg = null; this.wwSend(true); }
    }
    if (w.s !== 'idle') {
      this.wwSendT = (this.wwSendT || 0) + dt;
      if (this.wwSendT > 1 / 15) { this.wwSendT = 0; this.wwSend(false); }
    }
  };

  Level.prototype.wwSteer = function (tgt, speed, dt) {
    var w = this.ww, m = this.map;
    this.flowT = (this.flowT || 0) - dt;
    var ttx = (tgt.x / T) | 0, tty = ((tgt.y - 6) / T) | 0;
    if (this.flowT <= 0 || this.flowTile !== tty * m.W + ttx) { this.flow(ttx, tty, 30); this.flowT = 0.3; this.flowTile = tty * m.W + ttx; }
    var D = this.bfsD, cx = (w.x / T) | 0, cy = ((w.y - 6) / T) | 0, c = cy * m.W + cx;
    var gx = tgt.x, gy = tgt.y;
    if (D[c] > 2) {
      var best = D[c], bx = 0, by = 0;
      for (var k = 0; k < 8; k++) {
        var ox = [1, -1, 0, 0, 1, 1, -1, -1][k], oy = [0, 0, 1, -1, 1, -1, 1, -1][k];
        var n = (cy + oy) * m.W + cx + ox;
        if (D[n] < 0 || D[n] >= best) continue;
        if (k >= 4 && (D[cy * m.W + cx + ox] < 0 || D[(cy + oy) * m.W + cx] < 0)) continue;
        best = D[n]; bx = ox; by = oy;
      }
      gx = (cx + bx + 0.5) * T; gy = (cy + by + 0.5) * T + 6;
    } else if (D[c] < 0 && !this.clearLine(w.x, w.y, tgt.x, tgt.y)) { this.wwVanish(); return; }
    var dx = gx - w.x, dy = gy - w.y, d = Math.hypot(dx, dy) || 1;
    var st = Math.min(d, speed * dt);
    w.x += dx / d * st; w.y += dy / d * st;
    w.vx = dx / d; w.vy = dy / d;
    if (Math.abs(dx) > 4) w.lean = dx < 0 ? -1 : 1;
    w.face = dy < -Math.abs(dx) ? 3 : 0;
  };

  // Eventos dirigidos (golpe, muerte, curación, susto…).
  Level.prototype.onEvent = function (ev) {
    var me = this.myId(), p = this.p;
    if (ev.k === 'hit' && ev.to === me) {
      if (p.h !== 0) { this.request('attackDone', { won: false }); return; }
      p.run = false; this.input.joy = null; this.showMap = false; this.note = null;
      RM.audio.stab(); RM.vibrate([80, 30, 200]);
      if (ev.m === 'struggle') this.qte = { t: 0, push: 0.5, taps: 0, dur: 3.8 };
      else this.cine = { kind: 'stab', t: 0, dur: 2.3 };
    } else if (ev.k === 'kill' && ev.to === me) {
      this.cine = { kind: 'clones', t: 0, dur: 1.4 };
      RM.audio.scream(); RM.vibrate([300, 80, 300]);
    } else if (ev.k === 'healed' && ev.to === me) {
      if (p.h === 1) { p.h = 0; p.wrap = 1; RM.audio.heal(); this.say((ev.by === me ? 'Te vendaste' : this.nameOf(ev.by) + ' te vendó') + '. Dejaste de sangrar.', 3); }
    } else if (ev.k === 'healed' && ev.by === me) {
      this.say('Vendaste a ' + this.nameOf(ev.to) + '.', 2.5); RM.audio.heal();
    } else if (ev.k === 'banish') {
      RM.audio.splash(); RM.audio.shriek(0.7);
      RM.Dama.smoke.puff(this.smoke, ev.x, ev.y, 34, 1.5);
      this.say(ev.by === me ? '¡El agua bendita la espantó!' : this.nameOf(ev.by) + ' la espantó con agua bendita.', 2.6);
    } else if (ev.k === 'lost' && ev.to === me) {
      this.say('Se esfumó… por ahora.', 2.5);
    } else if (ev.k === 'gameover') {
      this.over = { t: 0 }; RM.audio.scream();
    }
  };

  /* ---------- Salud del jugador ---------- */

  Level.prototype.startBleeding = function (lost) {
    var p = this.p;
    p.h = 1; p.bleedT = BLEED; p.wrap = 0;
    if (lost) p.eye = 1;
    this.say(this.bag.bandage ? '¡Te estás desangrando! Usá una VENDA.' : (this.net ? '¡Te estás desangrando! Buscá una venda o pedile a un compañero que te cure.' : '¡Te estás desangrando! Buscá una venda rápido.'), 4);
  };
  Level.prototype.die = function (why) {
    var p = this.p;
    if (p.h === 2) return;
    p.h = 2; p.run = false; this.input.joy = null;
    this.dead = { t: 0, why: why };
    RM.vibrate([400]);
    if (this.net) this.request('dead');
  };
  Level.prototype.respawn = function () {
    var p = this.p, sp = this.map.spawns[0];
    var keep = { eye: 0 };
    this.p = this.newPlayer(sp); this.p.eye = keep.eye;
    this.dead = null; this.cine = null; this.qte = null;
    this.ww.s = 'idle'; this.ww.next = 50; this.ww.clones = []; this.ww.tg = null;
    this.say('Volviste a la entrada. Conservás todo lo que juntaste.', 3.5);
    void p;
  };
  Level.prototype.useBandage = function () {
    var p = this.p;
    if (p.h !== 1 || !this.bag.bandage || p.healT > 0) return;
    p.healT = 2;
    RM.audio.page();
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
    RM.Dama.smoke.update(this.smoke, dt);
    this.updateTrail(dt);
    this.flash *= Math.exp(-dt * 6);
    var g = this.map.gate;
    if (g.opening && g.open < 1) { g.open = Math.min(1, g.open + dt * 0.5); if (g.open >= 1) this.map.setDoorSolid(); }
    this.netTick(dt);
    if (!this.net || this.net.isHost) this.wwUpdate(dt); else this.wwClient(dt);
    this.wwShow(dt);
    this.flyers.forEach(function (f) { f.t += dt; });
    this.flyers = this.flyers.filter(function (f) { return f.t < 0.8; });
    if (this.over) { this.over.t += dt; return; }
    if (this.won) { this.winT += dt; return; }
    if (this.cine) this.updateCine(dt);
    if (this.qte) this.updateQte(dt);
    if (this.dead) { this.dead.t += dt; this.p.downK = Math.min(1, this.p.downK + dt * 3); }
    if (!this.net && (this.paused || this.note || this.showMap || this.cine || this.qte || (this.dead && !this.net))) { this.p.amp = 0; return; }
    this.time += dt;
    var p = this.p;
    this.updateHealth(dt);
    var frozen = p.escaped || this.paused || this.note || this.showMap || this.cine || this.qte || p.h === 2 || p.healT > 0;
    if (!frozen) this.updatePlayer(dt);
    else { p.amp = Math.max(0, p.amp - dt * 6); }
    if (p.pickT > 0) p.pickT -= dt;
    this.updateRoom();
    this.findNear();
    this.updateRevive(dt);
    if (this.flicker > 0) this.flicker -= dt;
    if (this.scare) { this.scare.t += dt; if (this.scare.t > this.scare.dur) this.scare = null; }
    if (g.open >= 1 && !p.escaped && p.h !== 2 && p.y > this.map.exitY) { p.escaped = true; this.request('escape'); }
    if (this.net && this.net.isHost) { this.checkT += dt; if (this.checkT > 1) { this.checkT = 0; this.checkWin(); } }

    this.nextFlash -= dt;
    if (this.nextFlash <= 0 && RM.settings.thunder) {
      this.nextFlash = rand(8, 16);
      var self = this, outside = this.room && this.room.outdoor;
      this.flash = 1;
      setTimeout(function () { self.flash = Math.max(self.flash, 0.7); }, 120);
      setTimeout(function () { RM.audio.thunder(outside ? 0.25 : 0.65); }, outside ? 200 : 900);
    }
  };

  Level.prototype.updateHealth = function (dt) {
    var p = this.p;
    if (p.healT > 0) {
      p.healT -= dt;
      if (p.healT <= 0 && p.h === 1 && this.bag.bandage) { this.bag.bandage--; this.request('heal', this.myId()); }
    }
    if (p.h === 1) {
      p.bleedT -= dt;
      p.beatT -= dt;
      if (p.beatT <= 0) { RM.audio.heartbeat(); p.beatT = 0.45 + p.bleedT / BLEED * 0.7; }
      p.dropT -= dt;
      if (p.dropT <= 0) { p.dropT = 0.35; this.trail.push({ x: p.x + rand(-6, 6), y: p.y - rand(0, 4), t: 0 }); if (this.trail.length > 90) this.trail.shift(); }
      if (p.bleedT <= 0) { this.die('bleed'); this.say('Te desangraste…', 3); }
    }
    if (p.h !== 2) p.downK = Math.max(0, p.downK - dt * 3);
  };

  Level.prototype.updateTrail = function (dt) {
    for (var i = 0; i < this.trail.length; i++) this.trail[i].t += dt;
    while (this.trail.length && this.trail[0].t > 40) this.trail.shift();
  };

  Level.prototype.updateCine = function (dt) {
    var c = this.cine;
    c.t += dt;
    if (c.t < c.dur) return;
    this.cine = null;
    if (c.kind === 'stab') { this.startBleeding(false); this.request('attackDone', { won: false }); }
    else if (c.kind === 'tear') { this.startBleeding(true); this.request('attackDone', { won: false }); this.say('Te sacó un ojo. ¡Vendate ya!', 4); }
    else if (c.kind === 'clones') this.die('clones');
  };

  Level.prototype.updateQte = function (dt) {
    var q = this.qte;
    q.t += dt;
    q.push -= dt * (0.25 + q.t * 0.06);
    if (q.push >= 1) {
      this.qte = null;
      this.say('¡Te zafaste! Se deshizo en humo.', 3); RM.audio.heal(); RM.vibrate([40]);
      this.request('attackDone', { won: true });
    } else if (q.push <= 0 || q.t > q.dur) {
      this.qte = null;
      this.cine = { kind: 'tear', t: 0.5, dur: 2.7 };
      RM.audio.stab(); RM.audio.scream(); RM.vibrate([300]);
    }
  };
  Level.prototype.qteTap = function () {
    var q = this.qte;
    if (!q) return;
    q.taps++; q.push = Math.min(1.05, q.push + 0.09);
    RM.vibrate([8]);
    if (q.taps % 3 === 0) RM.audio.hover();
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
    var wantsRun = (p.run || k.Shift) && !p.crouch && !p.tired && p.h === 0;
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
      var sp = SPEED[mode] * (inp.joy ? Math.max(0.55, mag) : 1) * (p.h === 1 ? 0.72 : 1);
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
      o.downK += ((o.h === 2 ? 1 : 0) - o.downK) * Math.min(1, dt * 4);
      if (o.h === 1) { o.dropT = (o.dropT || 0) - dt; if (o.dropT <= 0) { o.dropT = 0.35; self.trail.push({ x: o.x + rand(-6, 6), y: o.y, t: 0 }); } }
      self.explore(self.map.room[((o.y - 8) / T | 0) * self.map.W + (o.x / T | 0)]);
    });
  };

  // Cliente: suaviza la posición de la Dama que manda el anfitrión.
  Level.prototype.wwClient = function (dt) {
    var w = this.ww;
    w.t += dt;
    if (w.s === 'idle') return;
    if (w.tx != null) { w.x += (w.tx - w.x) * Math.min(1, dt * 14); w.y += (w.ty - w.y) * Math.min(1, dt * 14); }
    w.clones.forEach(function (c) { c.x += (c.tx - c.x) * Math.min(1, dt * 14); c.y += (c.ty - c.y) * Math.min(1, dt * 14); });
  };
  // Opacidad de la Dama (aparece y se esfuma en el humo).
  Level.prototype.wwShow = function (dt) {
    var w = this.ww, want = (w.s === 'idle' || w.s === 'warn' || w.s === 'vanish' || w.s === 'attack') ? 0 : 1;
    w.vis += (want - w.vis) * Math.min(1, dt * (want ? 6 : 5));
  };

  Level.prototype.netTick = function (dt) {
    if (!this.net) return;
    var p = this.p;
    this.sendT += dt;
    if (this.sendT > 1 / 12) {
      this.sendT = 0;
      var an = this.qte ? 3 : this.cine ? 4 : p.healT > 0 ? 2 : p.reviveT > 0 ? 2 : p.pickT > 0 ? 1 : 0;
      this.net.send({ t: 'p', id: this.net.myId, x: Math.round(p.x), y: Math.round(p.y), d: p.dir, m: MODE_CODE[p.mode] || 0, mv: p.amp > 0.4, e: p.escaped, h: p.h, ey: p.eye, wr: p.wrap, an: an });
    }
    if (this.net.isHost) {
      this.worldT += dt;
      if (this.worldT > 2) { this.worldT = 0; this.broadcastWorld(null); if (this.ww.s !== 'idle') this.wwSend(true); }
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
      this.explore(rm.idx);
      this.roomToast = { text: rm.name, t: 2.4 };
      RM.audio.setMuffle(rm.outdoor ? 0 : 1);
      if (rm.id === 'crypt' && !this.scares.crypt) { this.scares.crypt = true; RM.audio.creak(); }
      if (rm.id === 'forge') this.hint('forge', 'La Herrería. Acá está el yunque para forjar la herradura.', 3.5);
    }
  };

  Level.prototype.findNear = function () {
    var p = this.p, best = null, bd = 1e9, m = this.map, self = this;
    if (p.escaped || p.h === 2) { this.near = null; return; }
    var consider = function (o, kind, r) {
      var d = Math.hypot(o.x - p.x, o.y - (p.y - 8));
      if (d < r && d < bd) { bd = d; best = { kind: kind, o: o }; }
    };
    // Agua bendita contra la Dama tiene prioridad.
    var w = this.ww;
    if (this.bag.holy && ['point', 'chase', 'windup', 'leap', 'recover'].indexOf(w.s) >= 0 && w.vis > 0.5 && Math.hypot(w.x - p.x, w.y - p.y) < 165) {
      this.near = { kind: 'holy', o: { x: w.x, y: w.y - 40 } }; return;
    }
    m.items.forEach(function (it) { if (!it.taken && Math.abs(it.x - p.x) < 60 && Math.abs(it.y - p.y) < 70) consider(it, 'item', 44); });
    m.notes.forEach(function (n) { if (Math.abs(n.x - p.x) < 60 && Math.abs(n.y - p.y) < 70) consider(n, 'note', 40); });
    m.interact.forEach(function (o) {
      if (Math.abs(o.x - p.x) > 90 || Math.abs(o.y - p.y) > 90) return;
      if (o.kind === 'gate' && m.gate.opening) return;
      if (o.kind === 'cryptdoor' && m.cryptDoor.open) return;
      consider(o, o.kind, o.r);
    });
    Object.keys(this.others).forEach(function (id) {
      var o = self.others[id];
      if (o.h === 1 && !o.escaped) consider({ x: o.x, y: o.y - 20, id: id }, 'revive', 60);
    });
    this.near = best;
  };

  Level.prototype.updateRevive = function (dt) {
    var p = this.p, n = this.near, k = this.input.keys;
    var holding = this.input.buttons.act || k.e || k[' '] || k.Enter;
    if (n && n.kind === 'revive' && holding && p.h !== 2) {
      p.reviveT += dt;
      if (p.reviveT >= 1.8) { p.reviveT = 0; this.request('heal', n.o.id); }
    } else p.reviveT = 0;
  };

  Level.prototype.actionLabel = function () {
    var n = this.near;
    if (!n) return null;
    return { item: 'AGARRAR', note: 'LEER', anvil: 'FORJAR', gate: 'ABRIR', cryptdoor: 'ABRIR', mirror: 'MIRAR', well: 'MIRAR', horse: 'MIRAR', piano: 'TOCAR', clock: 'MIRAR', revive: 'CURAR', holy: 'AGUA' }[n.kind];
  };

  Level.prototype.count = function () {
    var self = this;
    return RECIPE.filter(function (id) { return self.inv[id]; }).length;
  };

  Level.prototype.act = function () {
    if (this.won || this.over) return;
    if (this.qte) { this.qteTap(); return; }
    if (this.cine || this.dead) return;
    if (this.note) { this.note = null; RM.audio.page(); return; }
    if (this.showMap) { this.showMap = false; return; }
    if (this.paused || this.p.healT > 0) return;
    var n = this.near, self = this;
    if (!n) return;
    if (n.kind === 'item') { this.p.pickT = 0.45; this.request('take', n.o.id); }
    else if (n.kind === 'holy') {
      this.bag.holy--; this.p.pickT = 0.3;
      RM.audio.splash();
      this.request('banish');
    } else if (n.kind === 'note') { this.note = n.o; n.o.read = true; RM.audio.page(); }
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
    else if (n.kind === 'piano') { RM.audio.pickup(); RM.audio.whisper(); this.say('Una tecla suena sola después de la tuya.', 3); }
    else if (n.kind === 'clock') { RM.audio.clang(); this.say('Las agujas marcan las 3:33. No se mueven.', 3); }
  };

  Level.prototype.updateRain = function (dt) {
    if (!this.cam) return;
    var c = this.cam, vw = this.W / this.S, vh = this.H / this.S;
    while (this.rain.length < 260) this.rain.push({ x: c.x + Math.random() * vw, y: c.y + Math.random() * vh, vy: rand(440, 600) });
    for (var i = 0; i < this.rain.length; i++) {
      var d = this.rain[i];
      d.y += d.vy * dt; d.x -= d.vy * 0.15 * dt;
      if (d.y > c.y + vh + 20 || d.x < c.x - 20 || d.x > c.x + vw + 40 || d.y < c.y - 40) { d.x = c.x + Math.random() * (vw + 40); d.y = c.y - Math.random() * 30; }
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
      band: { x: W - u * 0.14, y: H - u * 0.43, r: u * 0.07 },
      pause: { x: W - u * 0.07, y: u * 0.07, r: u * 0.05 },
      map: { x: W - u * 0.2, y: u * 0.07, r: u * 0.05 }
    };
  };

  // Hacia dónde mira la cámara (si estás muerto en cooperativo, seguís a un compañero).
  Level.prototype.camTarget = function () {
    var p = this.p;
    if (this.net && (p.h === 2 || p.escaped)) {
      var self = this, alive = Object.keys(this.others).map(function (id) { return self.others[id]; }).filter(function (o) { return o.h !== 2 && !o.escaped; });
      if (alive.length) return alive[0];
    }
    return p;
  };

  Level.prototype.draw = function (ctx, W, H, dpr) {
    if (!this.ready) return;
    if (this.W !== W || this.H !== H || !this.tex) this.layout(W, H, dpr);
    var S = this.S, m = this.map, p = this.camTarget();
    var vw = W / S, vh = H / S;
    var cx = clamp(p.x - vw / 2, 0, Math.max(0, m.W * T - vw));
    var cy = clamp(p.y - 24 - vh / 2, 0, Math.max(0, m.H * T - vh));
    var shake = this.ww.s === 'leap' && this.ww.tg === this.myId() ? 3 : 0;
    cx += (Math.random() - 0.5) * shake; cy += (Math.random() - 0.5) * shake;
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
    RM.Dama.smoke.draw(ctx, this.smoke);
    this.drawRain(ctx);
    if (this.near && !this.cine && !this.qte) this.drawPrompt(ctx);
    ctx.restore();
    this.drawLighting(ctx, W, H, cx, cy, S);
    this.drawNames(ctx, cx, cy, S);
    if (this.scare && this.scare.kind === 'mirror') this.drawMirrorScare(ctx, W, H);
    if (this.cine || this.qte) { this.drawCine(ctx, W, H); return; }
    this.drawBleed(ctx, W, H);
    this.drawHUD(ctx, W, H);
    this.drawFlyers(ctx);
    if (this.showMap) this.drawMap(ctx, W, H);
    if (this.note) this.drawNote(ctx, W, H);
    if (this.paused) this.drawPause(ctx, W, H);
    if (this.dead) this.drawDead(ctx, W, H);
    if (this.over) this.drawOver(ctx, W, H);
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
    var deco = this.tex.deco;
    m.inView(cx, cy, cx + vw, cy + vh, 'deco', function (d) {
      if (d.x > cx + vw || d.x + 96 < cx || d.y > cy + vh || d.y + 32 < cy) return;
      var img = deco[d.type];
      if (img) ctx.drawImage(img, d.x, d.y, img.ww, img.wh);
    });
  };

  Level.prototype.drawDecals = function (ctx, cx, cy, vw, vh) {
    var tx = this.tex;
    this.map.inView(cx, cy, cx + vw, cy + vh, 'decals', function (d) {
      var img = tx.decal[d.type];
      if (!img || d.x > cx + vw || d.x + img.ww < cx || d.y > cy + vh || d.y + img.wh < cy) return;
      ctx.drawImage(img, d.x, d.y, img.ww, img.wh);
    });
    var tr = tx.decal.trail;
    this.trail.forEach(function (d) {
      if (d.x < cx - 16 || d.x > cx + vw || d.y < cy - 16 || d.y > cy + vh) return;
      ctx.globalAlpha = clamp(1 - d.t / 40, 0, 1);
      ctx.drawImage(tr, d.x - 8, d.y - 8, 16, 16);
    });
    ctx.globalAlpha = 1;
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
    if (g.open < 0.1) {
      ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1414'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x + 32, y + 30, 8, Math.PI * 0.05, Math.PI * 0.95, true); ctx.stroke();
      ctx.strokeStyle = '#8a8e98'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
    var d = this.map.cryptDoor;
    if (!d.open) {
      var dx = d.x * T, dy = d.y * T;
      A.box(ctx, dx + 2, dy, 60, 64, 4, A.vlin(ctx, dy, dy + 64, '#4a4e58', '#2a2e36'));
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (i = 0; i < 4; i++) ctx.fillRect(dx + 8, dy + 8 + i * 14, 48, 3);
      ctx.fillStyle = '#6a6e78'; [[10, 10], [54, 10], [10, 54], [54, 54]].forEach(function (q) { ctx.beginPath(); ctx.arc(dx + q[0], dy + q[1], 2.4, 0, 6.283); ctx.fill(); });
      A.ell(ctx, dx + 32, dy + 34, 6, 6, '#d8b040'); ctx.fillStyle = '#1a1008'; ctx.fillRect(dx + 31, dy + 32, 2, 6);
    }
  };

  Level.prototype.drawPickups = function (ctx, cx, cy, vw, vh) {
    var t = this.t, icons = this.worldIcons;
    this.map.items.forEach(function (it) {
      if (it.taken || it.x < cx - 40 || it.x > cx + vw + 40 || it.y < cy - 40 || it.y > cy + vh + 40) return;
      var bob = Math.sin(t * 3 + it.x) * 3, q = it.kind === 'quest';
      if (q) {
        var gl = ctx.createRadialGradient(it.x, it.y - 6, 2, it.x, it.y - 6, 26);
        gl.addColorStop(0, 'rgba(255,200,90,' + (0.25 + Math.sin(t * 4 + it.x) * 0.1) + ')'); gl.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = gl; ctx.fillRect(it.x - 26, it.y - 32, 52, 52);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 12, 10, 4, 0, 0, 6.283); ctx.fill();
      var sz = q ? 32 : 24;
      ctx.drawImage(icons[it.icon], it.x - sz / 2, it.y - 22 + bob + (32 - sz) / 2, sz, sz);
      var s = Math.max(0, Math.sin(t * 4 + it.y));
      if (s > 0.6) { ctx.fillStyle = 'rgba(255,255,255,' + (s - 0.6) * 2 + ')'; ctx.beginPath(); ctx.arc(it.x + 9, it.y - 18 + bob, 2, 0, 6.283); ctx.fill(); }
    });
    this.map.notes.forEach(function (n) {
      if (n.x < cx - 40 || n.x > cx + vw + 40 || n.y < cy - 40 || n.y > cy + vh + 40) return;
      ctx.drawImage(icons.note, n.x - 14, n.y - 18, 28, 28);
    });
  };

  Level.prototype.heroState = function (o, isMe) {
    if (isMe) {
      return { dir: o.dir, phase: o.phase, amp: o.amp, run: o.runK, crouch: o.crouchK, pick: o.pickT > 0 ? Math.sin(Math.min(1, (0.45 - o.pickT) / 0.45) * Math.PI) : 0,
        heal: o.healT > 0 || o.reviveT > 0, struggle: !!this.qte, down: o.downK, bleed: o.h === 1, dead: o.h === 2, eyeLost: o.eye, wrap: o.wrap, t: this.t };
    }
    return { dir: o.dir, phase: o.phase, amp: o.amp, run: o.mode === 1 ? 1 : 0, crouch: o.mode === 2 ? 1 : 0, pick: o.an === 1 ? 0.8 : 0, heal: o.an === 2, struggle: o.an === 3,
      down: o.downK, bleed: o.h === 1, dead: o.h === 2, eyeLost: o.eye, wrap: o.wrap, t: this.t };
  };

  Level.prototype.drawSorted = function (ctx, cx, cy, vw, vh) {
    var list = [], self = this, p = this.p, tx = this.tex;
    this.map.inView(cx, cy, cx + vw, cy + vh + 140, 'props', function (pr) {
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
        if (isMe && o.reviveT > 0) self.ring(ctx, o.x, o.y - 90, o.reviveT / 1.8);
      } });
    };
    addHero(p, true, this.myIdx);
    Object.keys(this.others).forEach(function (id) { var o = self.others[id]; addHero(o, false, o.idx); });
    // La Dama Blanca y sus clones.
    var w = this.ww;
    if (w.vis > 0.02) {
      var mode = w.s === 'point' ? 'point' : w.s === 'chase' || w.s === 'recover' ? 'run' : w.s === 'windup' ? 'windup' : w.s === 'leap' ? 'leap' : w.s === 'clones' ? 'clone' : 'idle';
      list.push({ y: w.y + 1, draw: function () {
        var h = w.hgt || 0;
        ctx.fillStyle = 'rgba(0,0,0,' + 0.4 * w.vis + ')'; ctx.beginPath(); ctx.ellipse(w.x, w.y, 18 - h * 0.15, 6, 0, 0, 6.283); ctx.fill();
        ctx.save(); ctx.globalAlpha = w.vis * (0.86 + Math.sin(self.t * 9) * 0.06); ctx.translate(w.x, w.y - h);
        RM.Dama.draw(ctx, { t: self.t, mode: mode, point: w.point, face: w.face, lean: w.lean, k: w.s === 'point' ? Math.min(1, w.t / 0.5) : 1 });
        ctx.restore();
      } });
      w.clones.forEach(function (c, i) {
        list.push({ y: c.y, draw: function () {
          ctx.save(); ctx.globalAlpha = w.vis * 0.75; ctx.translate(c.x, c.y);
          if (i === 1) ctx.scale(-1, 1);
          RM.Dama.draw(ctx, { t: self.t + i * 1.7, mode: 'clone', face: i === 3 ? 0 : i === 0 ? 3 : 0 });
          ctx.restore();
        } });
      });
    }
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.draw(); });
  };

  Level.prototype.ring = function (ctx, x, y, k) {
    ctx.save();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = '#f4f0e6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke();
    ctx.restore();
  };

  Level.prototype.drawFlames = function (ctx, cx, cy, vw, vh) {
    var t = this.t;
    this.map.inView(cx, cy, cx + vw, cy + vh, 'flames', function (f) {
      if (f.x < cx - 30 || f.x > cx + vw + 30 || f.y < cy - 30 || f.y > cy + vh + 30) return;
      var k = 1 + Math.sin(t * 13 + f.x) * 0.15 + Math.sin(t * 7.7 + f.y) * 0.1;
      A.flame(ctx, f.x, f.y, f.s * k);
    });
  };

  Level.prototype.drawRain = function (ctx) {
    var m = this.map;
    ctx.strokeStyle = 'rgba(190,200,240,0.4)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath();
    this.rain.forEach(function (d) {
      var tx = (d.x / T) | 0, ty = (d.y / T) | 0;
      if (tx < 0 || ty < 0 || tx >= m.W || ty >= m.H || !m.out[ty * m.W + tx]) return;
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 3, d.y - 14);
    });
    ctx.stroke();
  };

  Level.prototype.drawPrompt = function (ctx) {
    var o = this.near.o, y = o.y - 44 + Math.sin(this.t * 5) * 3;
    ctx.fillStyle = this.near.kind === 'holy' ? '#7ac0ff' : this.near.kind === 'revive' ? '#f4f0e6' : '#ff3a1a';
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
      var x = (o.x - cx) * S, y = (o.y - 84 - cy) * S;
      var label = o.name + (o.h === 1 ? ' · ¡SANGRA!' : o.h === 2 ? ' · muerto' : '');
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(label, x + 1, y + 1);
      ctx.fillStyle = o.h === 1 ? (Math.sin(self.t * 8) > 0 ? '#ff4040' : '#ffd0d0') : RM.Hero.SHIRTS[o.idx % 4][2];
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  };

  Level.prototype.drawLighting = function (ctx, W, H, cx, cy, S) {
    var k = 4, lw = Math.ceil(W / k), lh = Math.ceil(H / k);
    if (!this.lc || this.lc.width !== lw || this.lc.height !== lh) this.lc = RM.canvas(lw, lh);
    var g = this.lc.getContext('2d'), t = this.t, tex = this.tex.light, self = this, m = this.map;
    var vw = W / S, vh = H / S;
    var dark = ((this.room && this.room.dark) ? 0.975 : 0.93) - this.flash * 0.45;
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
    m.outdoorRects.forEach(function (r) {
      if (r.x > cx + vw || r.x + r.w < cx || r.y > cy + vh || r.y + r.h < cy) return;
      g.globalAlpha = 0.45 + self.flash * 0.5; g.fillStyle = '#fff';
      g.fillRect((r.x - cx) * sc, (r.y - cy) * sc, r.w * sc, r.h * sc);
    });
    var lantern = function (o, crouchK, eye) {
      if (o.escaped) return;
      var fl = 1 + Math.sin(t * 9 + o.x) * 0.03 + Math.sin(t * 23) * 0.02;
      var rr = 180 * fl * (1 - (crouchK || 0) * 0.15) * (eye ? 0.78 : 1) * (o.h === 2 ? 0.5 : 1);
      light(o.x, o.y - 28, rr, 1);
      light(o.x, o.y - 28, 70, 1);
    };
    if (!(this.flicker > 0 && Math.random() < 0.6)) lantern(this.p, this.p.crouchK, this.p.eye);
    Object.keys(this.others).forEach(function (id) { lantern(self.others[id], self.others[id].mode === 2 ? 1 : 0, 0); });
    // La Dama brilla un poco en la oscuridad.
    if (this.ww.vis > 0.1) light(this.ww.x, this.ww.y - 50, 70, 0.35 * this.ww.vis);
    m.inView(cx, cy, cx + vw, cy + vh, 'lights', function (L) {
      var f = L.flick ? 1 + Math.sin(t * 8 + L.flick) * 0.06 + Math.sin(t * 19 + L.flick * 2) * 0.04 : 1;
      light(L.x, L.y, L.r * f, L.color === 'moon' ? 0.6 : 0.9);
    });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.drawImage(this.lc, 0, 0, lw * k, lh * k);
    ctx.globalCompositeOperation = 'lighter';
    m.inView(cx, cy, cx + vw, cy + vh, 'lights', function (L) {
      if (L.color === 'moon') return;
      var sx = (L.x - cx) * S, sy = (L.y - cy) * S, sr = L.r * S * 0.6;
      if (sx + sr < 0 || sy + sr < 0 || sx - sr > W || sy - sr > H) return;
      ctx.globalAlpha = 0.13 + Math.sin(t * 10 + L.flick) * 0.03;
      ctx.drawImage(self.tex.warm, sx - sr, sy - sr, sr * 2, sr * 2);
    });
    if (this.flash > 0.02) { ctx.globalAlpha = this.flash * 0.15; ctx.fillStyle = '#c8c0ff'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    // Sin un ojo: la mitad izquierda queda en penumbra.
    if (this.p.eye) {
      var gr = ctx.createLinearGradient(0, 0, W * 0.55, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.92)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W * 0.55, H);
    }
  };

  Level.prototype.drawMirrorScare = function (ctx, W, H) {
    var s = this.scare, a = s.t < 0.15 ? 1 : 1 - (s.t - 0.15) / (s.dur - 0.15);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    var sz = H * 0.95 / 105;
    ctx.translate(W / 2 + (Math.random() - 0.5) * 12, H * 0.98);
    ctx.scale(sz, sz);
    RM.Dama.draw(ctx, { t: this.t, mode: 'windup', lean: 1 });
    ctx.restore();
  };

  // Escenas del garfio y forcejeo (pantalla completa).
  Level.prototype.drawCine = function (ctx, W, H) {
    var u = Math.min(W, H), pal = RM.Hero.palette(this.myIdx);
    if (this.qte) {
      var q = this.qte;
      RM.Dama.closeup(ctx, W, H, { kind: 'struggle', t: this.t, push: clamp(q.push, 0, 1), pal: pal, shake: 1 });
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = (u * 0.11) + 'px "Metal Mania", serif';
      ctx.fillStyle = Math.sin(this.t * 14) > 0 ? '#ff2a1a' : '#ffd0a0'; ctx.shadowColor = '#000'; ctx.shadowBlur = 12;
      ctx.fillText('¡FORCEJEÁ!', W / 2, H * 0.13);
      ctx.shadowBlur = 0;
      ctx.font = '700 ' + (u * 0.04) + 'px "Cinzel", serif'; ctx.fillStyle = '#fff';
      ctx.fillText('Tocá la pantalla muy rápido', W / 2, H * 0.23);
      var bw = W * 0.5, bx = W / 2 - bw / 2, by = H * 0.88;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 3, by - 3, bw + 6, u * 0.05 + 6);
      ctx.fillStyle = '#5a0606'; ctx.fillRect(bx, by, bw, u * 0.05);
      var gr = ctx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#ff3a1a'); gr.addColorStop(1, '#ffd040');
      ctx.fillStyle = gr; ctx.fillRect(bx, by, bw * clamp(q.push, 0, 1), u * 0.05);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(bx + bw - 3, by - 4, 3, u * 0.05 + 8);
      ctx.restore();
      return;
    }
    var c = this.cine;
    if (c.kind === 'clones') {
      var a = Math.min(1, c.t / 0.3);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,' + a * 0.85 + ')'; ctx.fillRect(0, 0, W, H);
      var sz = H * 0.9 / 105;
      [-1, 0, 1].forEach(function (k, i) {
        ctx.save(); ctx.globalAlpha = a * (i === 1 ? 1 : 0.6);
        ctx.translate(W / 2 + k * W * 0.26 + (Math.random() - 0.5) * 10, H * 1.02 + Math.abs(k) * H * 0.05);
        ctx.scale(sz * (i === 1 ? 1.15 : 0.9) * (k < 0 ? -1 : 1), sz * (i === 1 ? 1.15 : 0.9));
        RM.Dama.draw(ctx, { t: c.t * 3 + i, mode: 'clone' });
        ctx.restore();
      });
      if (c.t > 1) { ctx.fillStyle = 'rgba(150,0,0,' + (c.t - 1) * 2 + ')'; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
      return;
    }
    RM.Dama.closeup(ctx, W, H, { kind: c.kind, t: c.t, pal: pal, shake: c.t > 0.55 && c.t < 1.1 ? 2 : 0.3 });
    if (c.t > c.dur - 0.5) { ctx.fillStyle = 'rgba(60,0,0,' + (c.t - c.dur + 0.5) * 2 + ')'; ctx.fillRect(0, 0, W, H); }
  };

  // Viñeta roja y barra de tiempo mientras te desangrás.
  Level.prototype.drawBleed = function (ctx, W, H) {
    var p = this.p, u = Math.min(W, H);
    if (p.h !== 1) return;
    var beat = Math.pow(Math.max(0, Math.sin(this.t * (5 + (1 - p.bleedT / BLEED) * 5))), 4);
    var gr = ctx.createRadialGradient(W / 2, H / 2, u * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, 'rgba(140,0,0,' + (0.45 + beat * 0.25 + (1 - p.bleedT / BLEED) * 0.25) + ')');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.save();
    var bw = W * 0.34, bx = W / 2 - bw / 2, by = H * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 2, by - 2, bw + 4, u * 0.026 + 4);
    ctx.fillStyle = '#c4100c'; ctx.fillRect(bx, by, bw * clamp(p.bleedT / BLEED, 0, 1), u * 0.026);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffd0c8';
    ctx.font = '700 ' + (u * 0.032) + 'px "Cinzel", serif';
    var s = Math.max(0, Math.ceil(p.bleedT));
    ctx.fillText('DESANGRÁNDOTE · ' + s + ' s' + (p.healT > 0 ? ' · vendándote…' : ''), W / 2, by + u * 0.036);
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
    var obj = this.used ? 'Escapen por el portón' : this.crafted ? 'Abrí el portón del Gran Vestíbulo' : this.count() === 5 ? 'Forjá la herradura en la Herrería' : 'Materiales para la herradura ' + this.count() + '/5';
    ctx.fillText(obj, x0 + 8, y0 + 6);
    var drawSlot = function (sx, sy, name, have, border) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, sx, sy, slot, slot, 4); ctx.fill();
      ctx.strokeStyle = have ? border : '#3a2a2a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = have ? 1 : 0.2;
      ctx.drawImage(self.icons[name], sx + 2, sy + 2, slot - 4, slot - 4);
      ctx.globalAlpha = 1;
    };
    var sy = y0 + fs * 1.4;
    this.slotPos = {};
    RECIPE.forEach(function (id, i) { self.slotPos[id] = { x: x0 + 8 + i * (slot + 3) + slot / 2, y: sy + slot / 2 }; drawSlot(x0 + 8 + i * (slot + 3), sy, id === 'ingot2' ? 'ingot' : id, self.inv[id], '#c4180f'); });
    var hx = x0 + 8 + 5 * (slot + 3) + 10;
    ctx.fillStyle = '#c4180f'; ctx.fillRect(hx - 9, sy + slot / 2 - 1, 6, 2);
    drawSlot(hx, sy, 'horseshoe', this.crafted, '#ffcc00');
    drawSlot(hx + slot + 6, sy, 'key', this.inv.key, '#d8b040');
    this.slotPos.key = { x: hx + slot + 6 + slot / 2, y: sy + slot / 2 };
    var by = y0 + slot + fs * 1.9 + 6, bw = slot * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0, by, bw, 5);
    ctx.fillStyle = this.p.tired ? '#ff3a1a' : '#e8d070'; ctx.fillRect(x0, by, bw * this.p.stamina, 5);
    // Consumibles.
    var cy2 = by + 10, cs = slot * 0.8;
    [['bandage', this.bag.bandage], ['holy', this.bag.holy]].forEach(function (c, i) {
      var bx = x0 + i * (cs + fs * 2.6);
      self.slotPos[c[0]] = { x: bx + cs / 2, y: cy2 + cs / 2 };
      ctx.globalAlpha = c[1] ? 1 : 0.35;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, bx, cy2, cs + fs * 2.2, cs, cs / 2); ctx.fill();
      ctx.drawImage(self.icons[c[0]], bx + 1, cy2 + 1, cs - 2, cs - 2);
      ctx.fillStyle = '#eee'; ctx.font = '700 ' + fs * 0.85 + 'px "Cinzel", serif'; ctx.textBaseline = 'middle';
      ctx.fillText('×' + c[1], bx + cs + 2, cy2 + cs / 2 + 1);
      ctx.globalAlpha = 1;
    });
    ctx.textBaseline = 'top';
    // Compañeros conectados.
    if (this.net) {
      ctx.font = '700 ' + fs * 0.75 + 'px "Cinzel", serif';
      var yy = cy2 + cs + 8;
      Object.keys(this.others).forEach(function (id) {
        var o = self.others[id];
        ctx.fillStyle = RM.Hero.SHIRTS[o.idx % 4][0];
        ctx.beginPath(); ctx.arc(x0 + 5, yy + fs * 0.4, 4, 0, 6.283); ctx.fill();
        ctx.fillStyle = o.h === 1 ? '#ff6a5a' : o.h === 2 ? '#7a6a7a' : '#d8ccd8';
        ctx.fillText(o.name + (self.escaped[id] ? ' · afuera' : o.h === 1 ? ' · sangrando' : o.h === 2 ? ' · muerto' : ''), x0 + 14, yy);
        yy += fs * 1.1;
      });
    }
    ctx.font = '700 ' + fs + 'px "Cinzel", serif';
    ctx.textAlign = 'right'; ctx.fillStyle = '#d8ccd8';
    var s = this.time | 0;
    ctx.fillText((s / 60 | 0) + ':' + ('0' + s % 60).slice(-2), this.ui.map.x - this.ui.map.r - 10, u * 0.045);
    if (this.roomToast) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.roomToast.t);
      ctx.font = (fs * 1.6) + 'px "Metal Mania", serif';
      ctx.fillStyle = '#c4180f'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
      ctx.fillText(this.roomToast.text, W / 2, H * (this.p.h === 1 ? 0.2 : 0.14));
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    var text = this.msg ? this.msg.text : (this.p.escaped && !this.won ? 'Saliste. Esperando a tus compañeros…' : this.p.h === 2 && this.net ? 'Estás muerto. Mirás a tus compañeros…' : null);
    if (text) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + fs + 'px "Cinzel", serif';
      var tw = Math.min(W * 0.6, ctx.measureText(text).width + 30);
      var lines = Math.ceil((ctx.measureText(text).width + 30) / tw);
      ctx.globalAlpha = this.msg ? Math.min(1, this.msg.t * 2) : 1;
      ctx.fillStyle = 'rgba(10,2,6,0.8)';
      roundRect(ctx, W / 2 - tw / 2, H * 0.7 - fs * (0.6 + lines * 0.55), tw, fs * (1.2 + lines * 1.1), 6); ctx.fill();
      ctx.fillStyle = '#eee';
      wrapText(ctx, text, W / 2, H * 0.7, tw - 20, fs * 1.1);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    this.drawControls(ctx, W, H);
  };

  Level.prototype.drawFlyers = function (ctx) {
    var self = this;
    this.flyers.forEach(function (f) {
      var dst = self.slotPos && self.slotPos[f.kind === 'quest' ? f.id : f.kind];
      if (!dst) return;
      var k = RM.easeOutCubic(Math.min(1, f.t / 0.8)), x = f.sx + (dst.x - f.sx) * k, y = f.sy + (dst.y - f.sy) * k - Math.sin(k * Math.PI) * 60;
      var sz = self.iconPx * (1.4 - k * 0.5);
      ctx.globalAlpha = 1 - Math.max(0, k - 0.85) * 6;
      ctx.drawImage(self.icons[f.icon], x - sz / 2, y - sz / 2, sz, sz);
      ctx.globalAlpha = 1;
    });
  };

  Level.prototype.drawControls = function (ctx, W, H) {
    var ui = this.ui, inp = this.input, p = this.p;
    if (p.h === 2 || p.escaped) {
      this.drawRoundBtn(ctx, ui.pause, null);
      return;
    }
    ctx.save();
    var j = inp.joy, jb = j ? { x: j.ox, y: j.oy } : ui.joy;
    ctx.globalAlpha = j ? 0.55 : 0.28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.strokeStyle = '#c4180f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(jb.x, jb.y, ui.joy.r, 0, 6.283); ctx.fill(); ctx.stroke();
    var kx = jb.x + (j ? j.dx * j.mag * ui.joy.r : 0), ky = jb.y + (j ? j.dy * j.mag * ui.joy.r : 0);
    ctx.globalAlpha = j ? 0.9 : 0.4;
    ctx.fillStyle = '#8a0d0d'; ctx.beginPath(); ctx.arc(kx, ky, ui.joy.r * 0.42, 0, 6.283); ctx.fill();
    var btn = function (b, label, on, glow, blue) {
      ctx.globalAlpha = on ? 0.95 : 0.6;
      var gr = ctx.createRadialGradient(b.x, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
      if (blue) { gr.addColorStop(0, '#9ad0ff'); gr.addColorStop(1, '#1a4a9a'); }
      else { gr.addColorStop(0, on ? '#ff7a2a' : '#5a0a0a'); gr.addColorStop(1, on ? '#a01000' : '#200204'); }
      ctx.fillStyle = gr;
      if (glow) { ctx.shadowColor = blue ? '#60a0ff' : '#ff3a00'; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = on ? '#ffb070' : '#7a1a1a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffe8d8';
      ctx.font = '700 ' + Math.max(9, b.r * 0.32) + 'px "Cinzel", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, b.x, b.y);
    };
    var lab = this.actionLabel();
    var holy = this.near && this.near.kind === 'holy';
    btn(ui.act, lab || 'ACCIÓN', !!lab || inp.buttons.act, !!lab && Math.sin(this.t * 6) > 0, holy);
    btn(ui.run, p.tired ? 'CANSADO' : p.h === 1 ? 'HERIDO' : 'CORRER', p.run && !p.crouch && p.h === 0);
    btn(ui.crouch, 'AGACHAR', p.crouch);
    if (p.h === 1 && this.bag.bandage) btn(ui.band, 'VENDA', true, Math.sin(this.t * 6) > 0);
    ctx.restore();
    this.drawRoundBtn(ctx, ui.map, 'map');
    this.drawRoundBtn(ctx, ui.pause, null);
  };

  Level.prototype.drawRoundBtn = function (ctx, b, kind) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#d8ccd8'; ctx.strokeStyle = '#d8ccd8';
    if (kind === 'map') {
      var r = b.r * 0.5;
      ctx.lineWidth = Math.max(1.5, b.r * 0.08); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(b.x - r, b.y - r * 0.7); ctx.lineTo(b.x - r * 0.33, b.y - r); ctx.lineTo(b.x + r * 0.33, b.y - r * 0.7); ctx.lineTo(b.x + r, b.y - r);
      ctx.lineTo(b.x + r, b.y + r * 0.7); ctx.lineTo(b.x + r * 0.33, b.y + r); ctx.lineTo(b.x - r * 0.33, b.y + r * 0.7); ctx.lineTo(b.x - r, b.y + r); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x - r * 0.33, b.y - r); ctx.lineTo(b.x - r * 0.33, b.y + r * 0.7); ctx.moveTo(b.x + r * 0.33, b.y - r * 0.7); ctx.lineTo(b.x + r * 0.33, b.y + r); ctx.stroke();
    } else {
      ctx.fillRect(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.25, b.r * 0.8); ctx.fillRect(b.x + b.r * 0.1, b.y - b.r * 0.4, b.r * 0.25, b.r * 0.8);
    }
    ctx.restore();
  };

  // Mapa del castillo (solo lo explorado).
  Level.prototype.drawMap = function (ctx, W, H) {
    var m = this.map, u = Math.min(W, H), self = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);
    var mw = this.mini.width, mh = this.mini.height;
    var sc = Math.min((W * 0.9) / mw, (H * 0.8) / mh);
    var ox = (W - mw * sc) / 2, oy = H * 0.12;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#050307'; ctx.fillRect(ox - 4, oy - 4, mw * sc + 8, mh * sc + 8);
    ctx.drawImage(this.mini, ox, oy, mw * sc, mh * sc);
    ctx.drawImage(this.fog, ox, oy, mw * sc, mh * sc);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = '#5a1010'; ctx.lineWidth = 2; ctx.strokeRect(ox - 4, oy - 4, mw * sc + 8, mh * sc + 8);
    var tp = function (x, y) { return { x: ox + x / T * 2 * sc, y: oy + y / T * 2 * sc }; };
    var mark = function (x, y, icon, size) {
      var q = tp(x, y);
      ctx.drawImage(self.icons[icon], q.x - size / 2, q.y - size / 2, size, size);
    };
    var isk = u * 0.05;
    m.items.forEach(function (it) {
      if (it.taken || !self.explored[it.room]) return;
      if (it.kind === 'quest') mark(it.x, it.y, it.icon, isk);
      else { var q = tp(it.x, it.y); ctx.fillStyle = it.kind === 'holy' ? '#7ac0ff' : '#f4f0e6'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, sc * 1.4), 0, 6.283); ctx.fill(); }
    });
    m.notes.forEach(function (n) { if (!n.read && self.explored[n.room]) { var q = tp(n.x, n.y); ctx.fillStyle = '#d8c8a0'; ctx.fillRect(q.x - 2, q.y - 2.5, 4, 5); } });
    if (this.explored[m.forge.idx]) { var a = m.interact.filter(function (o) { return o.kind === 'anvil'; })[0]; mark(a.x, a.y, 'horseshoe', isk * 1.1); }
    // Jugadores.
    var me = tp(this.p.x, this.p.y);
    Object.keys(this.others).forEach(function (id) {
      var o = self.others[id], q = tp(o.x, o.y);
      ctx.fillStyle = RM.Hero.SHIRTS[o.idx % 4][2]; ctx.beginPath(); ctx.arc(q.x, q.y, u * 0.012, 0, 6.283); ctx.fill();
    });
    var pulse = 1 + Math.sin(this.t * 6) * 0.3;
    ctx.fillStyle = '#ff3a1a'; ctx.beginPath(); ctx.arc(me.x, me.y, u * 0.014 * pulse, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = (u * 0.06) + 'px "Metal Mania", serif'; ctx.fillStyle = '#c4180f';
    ctx.fillText('El Castillo del Terror', W / 2, H * 0.06);
    ctx.font = '400 ' + (u * 0.028) + 'px "Cinzel", serif'; ctx.fillStyle = '#b9a9b9';
    var exp = 0; for (var i = 0; i < this.explored.length; i++) exp += this.explored[i];
    ctx.fillText((this.room ? this.room.name + ' · ' : '') + 'Explorado ' + Math.round(exp / m.rooms.length * 100) + '% · tocá para cerrar', W / 2, H * 0.965);
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
    ctx.fillStyle = '#2a1e10'; ctx.font = '700 ' + (u * 0.036) + 'px "Cinzel", serif';
    wrapText(ctx, n.text, W / 2, by + bh * 0.52, bw - u * 0.12, u * 0.05);
    ctx.font = '400 ' + (u * 0.03) + 'px "Cinzel", serif'; ctx.fillStyle = '#5a4a30';
    ctx.fillText('Tocá para cerrar', W / 2, by + bh - u * 0.04);
    ctx.restore();
  };

  Level.prototype.menuButtons = function (W, H, labels) {
    var u = Math.min(W, H), bw = u * 0.7, bh = u * 0.11;
    return labels.map(function (l, i) { return { id: l[0], label: l[1], x: W / 2 - bw / 2, y: H * 0.42 + i * (bh + u * 0.03), w: bw, h: bh }; });
  };

  Level.prototype.drawButtons = function (ctx, list) {
    list.forEach(function (b) {
      var gr = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      gr.addColorStop(0, '#c2240f'); gr.addColorStop(1, '#640400');
      ctx.fillStyle = gr; roundRect(ctx, b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe8d0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = (b.h * 0.46) + 'px "Metal Mania", serif';
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

  Level.prototype.drawDead = function (ctx, W, H) {
    if (this.net) return;
    var u = Math.min(W, H), a = Math.min(1, this.dead.t / 1.2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(30,0,0,0.88)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c4180f'; ctx.font = (u * 0.12) + 'px "Metal Mania", serif';
    ctx.shadowColor = '#f00'; ctx.shadowBlur = 20;
    ctx.fillText('ESTÁS MUERTO', W / 2, H * 0.2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d8ccd8'; ctx.font = '700 ' + (u * 0.038) + 'px "Cinzel", serif';
    ctx.fillText(this.dead.why === 'bleed' ? 'Te desangraste en el castillo.' : 'Las Damas Blancas te rodearon.', W / 2, H * 0.31);
    if (this.dead.t > 1) {
      this.deadBtns = this.menuButtons(W, H, [['respawn', 'Reintentar desde la entrada'], ['restart', 'Reiniciar nivel'], ['quit', 'Salir del nivel']]);
      this.drawButtons(ctx, this.deadBtns);
    } else this.deadBtns = null;
    ctx.restore();
  };

  Level.prototype.drawOver = function (ctx, W, H) {
    var u = Math.min(W, H), a = Math.min(1, this.over.t / 1.2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(30,0,0,0.9)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c4180f'; ctx.font = (u * 0.11) + 'px "Metal Mania", serif';
    ctx.fillText('LOS ATRAPÓ A TODOS', W / 2, H * 0.22);
    ctx.fillStyle = '#d8ccd8'; ctx.font = '700 ' + (u * 0.036) + 'px "Cinzel", serif';
    ctx.fillText('La Dama Blanca tiene nuevos invitados para siempre.', W / 2, H * 0.33);
    if (this.over.t > 1) { this.overBtns = this.menuButtons(W, H, [['quit', 'Volver a la sala']]); this.drawButtons(ctx, this.overBtns); }
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
  function hit(list, x, y) { return (list || []).filter(function (b) { return inRect(b, x, y); })[0]; }

  Level.prototype.pointer = function (type, e) {
    if (!this.ready || !this.ui) return;
    var x = e.clientX, y = e.clientY, ui = this.ui, inp = this.input, id = e.pointerId, b;
    if (type === 'down') {
      if (this.qte) { this.qteTap(); return; }
      if (this.cine) return;
      if (this.won) { b = hit(this.winBtns, x, y); if (b) this.choose(b.id); return; }
      if (this.over) { b = hit(this.overBtns, x, y); if (b) this.choose(b.id); return; }
      if (this.paused) { b = hit(this.pauseBtns, x, y); if (b) this.choose(b.id); return; }
      if (this.dead && !this.net) { b = hit(this.deadBtns, x, y); if (b) this.choose(b.id); return; }
      if (this.note) { this.note = null; RM.audio.page(); return; }
      if (this.showMap) { this.showMap = false; RM.audio.page(); return; }
      if (inCircle(ui.pause, x, y, 1.4)) { this.setPaused(true); return; }
      if (inCircle(ui.map, x, y, 1.4)) { this.showMap = true; this.input.joy = null; RM.audio.page(); return; }
      if (this.p.h === 2 || this.p.escaped) return;
      if (this.p.h === 1 && this.bag.bandage && inCircle(ui.band, x, y)) { this.useBandage(); return; }
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
    if (this.qte) { if (k === ' ' || k === 'e' || k === 'Enter') this.qteTap(); return; }
    if (this.cine) return;
    if (k === 'Escape' || k === 'p') { this.setPaused(!this.paused); return; }
    if ((this.won || this.over) && (k === 'Enter' || k === ' ')) { this.choose('quit'); return; }
    if (this.dead && !this.net) { if (k === 'Enter' || k === ' ') this.choose('respawn'); return; }
    if (k === 'm') { this.showMap = !this.showMap; return; }
    if (k === 'v') { this.useBandage(); return; }
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
    else if (id === 'respawn') this.respawn();
    else if (id === 'quit') { RM.audio.setMuffle(0); this.onExit(this.won); }
  };

  Level.prototype.back = function () {
    if (this.cine || this.qte) return;
    if (this.note) { this.note = null; return; }
    if (this.showMap) { this.showMap = false; return; }
    if (this.won || this.over) { this.choose('quit'); return; }
    this.setPaused(!this.paused);
  };

  // Imagen de una zona del mapa (para documentación). Sin argumentos = todo.
  Level.prototype.overview = function (scale, rx, ry, rw, rh) {
    var m = this.map;
    rx = rx || 0; ry = ry || 0; rw = rw || m.W * T; rh = rh || m.H * T;
    var c = RM.canvas(rw * scale, rh * scale), g = c.getContext('2d');
    var saved = this.tex, savedIcons = this.worldIcons;
    this.buildTextures(scale);
    g.scale(scale, scale); g.translate(-rx, -ry);
    this.drawTiles(g, rx, ry, rw, rh);
    this.drawDecals(g, rx, ry, rw, rh);
    this.drawDoors(g);
    this.worldIcons = {}; var self = this; A.icons.forEach(function (n) { self.worldIcons[n] = A.icon(n, scale); });
    this.drawPickups(g, rx, ry, rw, rh);
    this.drawSorted(g, rx, ry, rw, rh);
    this.drawFlames(g, rx, ry, rw, rh);
    this.tex = saved; this.worldIcons = savedIcons; this.W = 0;
    return c;
  };

  RM.Level = Level;
})(window.RM);
