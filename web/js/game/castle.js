/* Red Main — Nivel 1: "El Castillo del Terror" (la Dama Blanca).
   Castillo enorme generado con semilla fija (todos los jugadores ven el mismo
   mapa): 15×14 celdas de salas, muros dobles, pasajes de 2 tiles, patios a la
   intemperie, cripta cerrada con llave y portón de salida con herradura. */
(function (RM) {
  'use strict';
  var A = RM.Art2, TL = A.TILE, T = A.T;
  var COLS = 15, ROWS = 14, PX = 17, PY = 15;           // paso de celda (sala + muro doble)
  var MW = COLS * PX + 2, MH = ROWS * PY + 2;           // 257 × 212 tiles
  var SEED = 1666;
  var CHK = 16;                                         // tamaño de los bloques para dibujar rápido

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------- Temas de sala ---------- */
  // top: muebles contra el muro de arriba; side: contra los costados; bottom: contra el de abajo;
  // center: islas en el medio; decals: manchas en el piso; deco: adornos en la pared de arriba.
  var THEMES = {
    library: { name: 'Biblioteca', floor: TL.WOOD, top: ['shelf'], side: ['shelf', 'shelf', 'bookpile'], bottom: ['shelf', 'bookpile'], center: [['table', 'chair'], ['globe'], ['candle'], ['bookpile'], ['desk']], decals: ['web', 'papers', 'rug'], deco: ['painting'] },
    study: { name: 'Estudio', floor: TL.CARPET, top: ['shelf', 'clock', 'shelf'], side: ['shelf', 'vase'], bottom: ['sofa'], center: [['desk'], ['globe'], ['telescope'], ['candle']], decals: ['papers', 'rug'], deco: ['painting'] },
    chapel: { name: 'Capilla', floor: TL.STONE, top: ['statue', 'candle', 'altar', 'candle', 'statue'], side: ['candle', 'statue'], bottom: [], center: [['pew'], ['pew']], decals: ['blood', 'web'], deco: ['window', 'banner'], pews: true },
    bedroom: { name: 'Alcoba', floor: TL.WOOD, top: ['bed', 'wardrobe', 'vase'], side: ['wardrobe', 'chest', 'plant'], bottom: ['chest'], center: [['rocker'], ['candle'], ['chest']], decals: ['rug', 'blood'], deco: ['painting'] },
    kitchen: { name: 'Cocina', floor: TL.CHECK, top: ['barrel', 'crate', 'barrel'], side: ['barrel', 'crate'], bottom: ['crate', 'barrel'], center: [['bigtable'], ['cauldron'], ['barrel']], decals: ['blood', 'bones', 'puddle'], deco: ['fireplace'] },
    dining: { name: 'Comedor', floor: TL.WOOD, top: ['armor', 'clock', 'armor'], side: ['candle', 'vase'], bottom: ['chest'], center: [['bigtable', 'chair'], ['bigtable', 'chair'], ['candle']], decals: ['rug', 'blood'], deco: ['fireplace', 'painting'] },
    cellar: { name: 'Bodega', floor: TL.CRYPT, top: ['winerack'], side: ['barrel', 'barrel', 'crate'], bottom: ['barrel'], center: [['barrel'], ['crate']], decals: ['puddle', 'web'], deco: [], dark: true },
    dungeon: { name: 'Mazmorra', floor: TL.CRYPT, top: ['cell'], side: ['cage', 'skeleton'], bottom: ['cell'], center: [['cage'], ['skeleton']], decals: ['bones', 'chain', 'blood'], deco: [], dark: true },
    armory: { name: 'Armería', floor: TL.STONE, top: ['rack'], side: ['armor', 'rack'], bottom: ['target'], center: [['target'], ['crate']], decals: ['blood'], deco: ['shield', 'banner'] },
    gallery: { name: 'Galería', floor: TL.CARPET, top: ['armor', 'statue', 'vase'], side: ['statue', 'armor', 'vase'], bottom: ['armor'], center: [['statue']], decals: ['web'], deco: ['painting'] },
    servants: { name: 'Cuarto de Sirvientes', floor: TL.WOOD, top: ['cot'], side: ['cot', 'chest'], bottom: [], center: [['table'], ['candle']], decals: ['bones', 'blood'], deco: [] },
    storage: { name: 'Depósito', floor: TL.DIRT, top: ['crate', 'barrel', 'crate'], side: ['crate', 'barrel'], bottom: ['crate', 'hay'], center: [['crate'], ['barrel'], ['chest']], decals: ['web', 'coalpile'], deco: [] },
    music: { name: 'Sala de Música', floor: TL.CARPET, top: ['piano', 'vase', 'clock'], side: ['sofa', 'candle'], bottom: ['sofa'], center: [['chair'], ['candle']], decals: ['rug', 'papers'], deco: ['painting'] },
    bath: { name: 'Baños', floor: TL.CHECK, top: ['bathtub', 'vase', 'mirror2'], side: ['vase'], bottom: ['bathtub'], center: [], decals: ['puddle', 'blood'], deco: [] },
    hall: { name: 'Salón de Columnas', floor: TL.STONE, top: ['statue', 'armor'], side: ['armor'], bottom: [], center: [], decals: ['blood', 'web'], deco: ['banner'], pillars: true },
    tower: { name: 'Observatorio', floor: TL.WOOD, top: ['shelf', 'clock', 'shelf'], side: ['shelf'], bottom: ['shelf'], center: [['telescope'], ['globe'], ['desk']], decals: ['papers'], deco: ['window'] },
    stables: { name: 'Establos', floor: TL.DIRT, top: ['horse', 'hay', 'horse'], side: ['hay'], bottom: ['trough', 'hay'], center: [['hay'], ['trough']], decals: ['coalpile'], deco: [] },
    forge: { name: 'Herrería', floor: TL.STONE, top: ['rack', 'rack', 'barrel'], side: ['barrel', 'crate'], bottom: ['crate'], center: [], decals: ['coalpile'], deco: ['furnace'] },
    crypt: { name: 'Cripta', floor: TL.CRYPT, top: ['coffin'], side: ['candle'], bottom: ['coffin'], center: [['coffin'], ['coffin']], decals: ['bones', 'web', 'blood'], deco: [], dark: true },
    throne: { name: 'Salón del Trono', floor: TL.STONE, top: ['statue', 'candle', 'throne', 'candle', 'statue'], side: ['armor'], bottom: [], center: [], decals: ['blood', 'bones'], deco: ['banner', 'window'], pillars: true, carpet: true },
    entrance: { name: 'Gran Vestíbulo', floor: TL.STONE, top: ['armor', 'statue', 'clock', 'statue', 'armor'], side: ['armor', 'vase'], bottom: [], center: [], decals: ['blood'], deco: ['banner'], pillars: true, carpet: true },
    yard: { name: 'Cementerio', floor: TL.GRASS, outdoor: true, top: ['tree', 'grave', 'grave'], side: ['grave', 'tree', 'bush'], bottom: ['grave', 'bush'], center: [['grave'], ['grave'], ['tree'], ['grave'], ['well']], decals: ['puddle'], deco: [] },
    garden: { name: 'Jardín Muerto', floor: TL.GRASS, outdoor: true, top: ['bush', 'tree', 'bush'], side: ['bush', 'tree'], bottom: ['bush'], center: [['fountain'], ['tree'], ['statue'], ['bush']], decals: ['puddle'], deco: [] },
    outside: { name: 'Afuera', floor: TL.OUT, outdoor: true, top: [], side: ['tree', 'bush'], bottom: ['tree', 'tree', 'bush'], center: [['tree'], ['grave']], decals: ['puddle'], deco: [] }
  };
  var COMMON = ['library', 'bedroom', 'kitchen', 'dining', 'cellar', 'dungeon', 'armory', 'gallery', 'servants', 'storage', 'study', 'music', 'bath', 'hall', 'chapel', 'stables'];
  var WEIGHT = { library: 3, bedroom: 4, kitchen: 2, dining: 2, cellar: 2, dungeon: 3, armory: 2, gallery: 3, servants: 3, storage: 4, study: 2, music: 1, bath: 1, hall: 2, chapel: 1, stables: 1 };

  function wingOf(cx, cy) {
    var dx = cx / MW - 0.5, dy = cy / MH - 0.5;
    if (Math.abs(dx) < 0.17 && Math.abs(dy) < 0.17) return 'Central';
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'Oeste' : 'Este') : (dy < 0 ? 'Norte' : 'Sur');
  }
  var ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X', ' XI', ' XII'];

  /* ---------- Construcción ---------- */

  function build() {
    var R = rng(SEED);
    var ri = function (a, b) { return a + ((R() * (b - a + 1)) | 0); };
    var pick = function (arr) { return arr[(R() * arr.length) | 0]; };
    var map = {
      T: T, W: MW, H: MH, CHK: CHK,
      tiles: new Uint8Array(MW * MH), solid: new Uint8Array(MW * MH), room: new Int16Array(MW * MH).fill(-1), out: new Uint8Array(MW * MH),
      rooms: [], props: [], lights: [], flames: [], interact: [], items: [], notes: [], decals: [], walldeco: []
    };
    var rooms = map.rooms;
    var cellRoom = new Int16Array(COLS * ROWS).fill(-1);

    function addRoom(c, r, cw, ch, theme) {
      for (var j = r; j < r + ch; j++) for (var i = c; i < c + cw; i++) if (cellRoom[j * COLS + i] >= 0) return -1;
      var idx = rooms.length;
      var rm = { idx: idx, c: c, r: r, cw: cw, ch: ch, theme: theme, x: c * PX + 2, y: r * PY + 2, w: cw * PX - 2, h: ch * PY - 2, doors: [] };
      for (j = r; j < r + ch; j++) for (i = c; i < c + cw; i++) cellRoom[j * COLS + i] = idx;
      rooms.push(rm);
      return idx;
    }

    // Salas fijas.
    addRoom(5, 13, 5, 1, 'outside');
    var ENT = addRoom(6, 12, 3, 1, 'entrance');
    addRoom(6, 5, 3, 2, 'throne');
    addRoom(2, 2, 2, 2, 'yard'); addRoom(11, 9, 2, 2, 'yard');
    addRoom(2, 8, 2, 2, 'garden'); addRoom(11, 3, 2, 2, 'garden');
    addRoom(0, 0, 1, 1, 'tower'); addRoom(14, 0, 1, 1, 'tower'); addRoom(0, 13, 1, 1, 'tower'); addRoom(14, 13, 1, 1, 'tower');
    addRoom(12, 12, 2, 1, 'crypt');
    addRoom(1, 11, 1, 1, 'forge');
    addRoom(10, 12, 1, 2, 'stables'); addRoom(2, 13, 2, 1, 'stables');
    addRoom(6, 1, 3, 1, 'chapel');
    addRoom(6, 9, 3, 1, 'hall');

    // El resto: salas sueltas o fusionadas al azar.
    var bag = [];
    COMMON.forEach(function (t) { for (var w = 0; w < WEIGHT[t]; w++) bag.push(t); });
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (cellRoom[r * COLS + c] >= 0) continue;
      var roll = R(), theme = pick(bag);
      if (roll < 0.2 && addRoom(c, r, 2, 1, theme) >= 0) continue;
      if (roll < 0.36 && addRoom(c, r, 1, 2, theme) >= 0) continue;
      if (roll < 0.42 && addRoom(c, r, 2, 2, theme) >= 0) continue;
      addRoom(c, r, 1, 1, theme);
    }

    // Tallar pisos.
    rooms.forEach(function (rm) {
      var th = THEMES[rm.theme];
      rm.outdoor = !!th.outdoor;
      for (var j = rm.y; j < rm.y + rm.h; j++) for (var i = rm.x; i < rm.x + rm.w; i++) {
        map.tiles[j * MW + i] = th.floor; map.room[j * MW + i] = rm.idx; map.out[j * MW + i] = rm.outdoor ? 1 : 0;
      }
      if (th.carpet) {
        var cx = rm.x + (rm.w >> 1) - 1;
        for (j = rm.y; j < rm.y + rm.h; j++) for (i = cx; i < cx + 2; i++) map.tiles[j * MW + i] = TL.CARPET;
      }
    });

    // Vecinos (un candidato de pasaje por cada par de celdas contiguas de salas distintas).
    var pairs = {};
    function cand(a, b, door) {
      if (a === b) return;
      var key = Math.min(a, b) + ':' + Math.max(a, b);
      (pairs[key] = pairs[key] || { a: Math.min(a, b), b: Math.max(a, b), opts: [] }).opts.push(door);
    }
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      var a = cellRoom[r * COLS + c];
      if (c + 1 < COLS) cand(a, cellRoom[r * COLS + c + 1], { x: (c + 1) * PX, y: r * PY + 2 + ri(2, 9), w: 2, h: 2, v: true });
      if (r + 1 < ROWS) cand(a, cellRoom[(r + 1) * COLS + c], { x: c * PX + 2 + ri(2, 11), y: (r + 1) * PY, w: 2, h: 2, v: false });
    }
    var edges = Object.keys(pairs).map(function (k) { return pairs[k]; });
    var special = function (i) { var t = rooms[i].theme; return t === 'outside' || t === 'crypt'; };
    // Árbol al azar (Kruskal) + algunos atajos.
    var parent = rooms.map(function (_, i) { return i; });
    var find = function (i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (var e = edges.length - 1; e > 0; e--) { var s = (R() * (e + 1)) | 0, tmp = edges[e]; edges[e] = edges[s]; edges[s] = tmp; }
    var doors = [];
    var openDoor = function (ed, d) {
      doors.push(d);
      rooms[ed.a].doors.push(d); rooms[ed.b].doors.push(d);
    };
    edges.forEach(function (ed) {
      if (special(ed.a) || special(ed.b)) return;
      var fa = find(ed.a), fb = find(ed.b);
      if (fa !== fb) { parent[fa] = fb; openDoor(ed, pick(ed.opts)); }
      else if (R() < 0.3) openDoor(ed, pick(ed.opts));
    });
    // Cripta: una sola entrada, cerrada con llave.
    var cryptIdx = rooms.filter(function (rm) { return rm.theme === 'crypt'; })[0].idx;
    var cryptEdge = edges.filter(function (ed) { return (ed.a === cryptIdx || ed.b === cryptIdx) && !special(ed.a === cryptIdx ? ed.b : ed.a); })[0];
    var cd = pick(cryptEdge.opts);
    map.cryptDoor = { x: cd.x, y: cd.y, w: 2, h: 2, v: cd.v, open: false };
    rooms[cryptIdx].doors.push(cd); rooms[cryptEdge.a === cryptIdx ? cryptEdge.b : cryptEdge.a].doors.push(cd);
    // Portón: centro del muro de abajo del vestíbulo.
    var ent = rooms[ENT];
    var gate = { x: ent.x + (ent.w >> 1) - 1, y: ent.y + ent.h, w: 2, h: 2, v: false };
    map.gate = { x: gate.x, y: gate.y, open: 0, opening: false };
    ent.doors.push(gate); rooms[cellRoom[13 * COLS + 7]].doors.push(gate);

    var carveDoor = function (d) {
      for (var j = d.y; j < d.y + d.h; j++) for (var i = d.x; i < d.x + d.w; i++) map.tiles[j * MW + i] = TL.STONE;
    };
    doors.forEach(carveDoor); carveDoor(cd); carveDoor(gate);
    map.doors = doors;
    for (var k = 0; k < MW * MH; k++) map.solid[k] = map.tiles[k] === TL.WALL ? 1 : 0;
    map.setDoorSolid = function () {
      for (var j = 0; j < 2; j++) for (var i = 0; i < 2; i++) {
        map.solid[(cd.y + j) * MW + cd.x + i] = map.cryptDoor.open ? 0 : 3;
        map.solid[(gate.y + j) * MW + gate.x + i] = map.gate.open >= 1 ? 0 : 2;
      }
    };
    map.setDoorSolid();
    map.exitY = (gate.y + 2.6) * T;

    // Celdas que no se pueden tapar: los pasajes y un margen delante.
    var keep = new Uint8Array(MW * MH);
    doors.concat([cd, gate]).forEach(function (d) {
      for (var j = d.y - 2; j < d.y + d.h + 2; j++) for (var i = d.x - 2; i < d.x + d.w + 2; i++) if (i >= 0 && j >= 0 && i < MW && j < MH) keep[j * MW + i] = 1;
    });

    /* ----- Muebles ----- */
    var P = A.PROP;
    function fits(rm, type, x, y, ring) {
      var d = P[type]; if (!d) return false;
      var fw = d.fp[0], fh = d.fp[1];
      if (x < rm.x || y < rm.y || x + fw > rm.x + rm.w || y + fh > rm.y + rm.h) return false;
      for (var j = y - ring; j < y + fh + ring; j++) for (var i = x - ring; i < x + fw + ring; i++) {
        if (i < rm.x || j < rm.y || i >= rm.x + rm.w || j >= rm.y + rm.h) { if (ring) continue; return false; }
        var n = j * MW + i;
        if (map.solid[n] || keep[n] || map.taken && map.taken[n]) return false;
      }
      return true;
    }
    map.taken = new Uint8Array(MW * MH);    // ocupado por objetos o notas
    function put(rm, type, x, y) {
      var d = P[type], solid = d.solid !== false;
      for (var j = 0; j < d.fp[1]; j++) for (var i = 0; i < d.fp[0]; i++) { if (solid) map.solid[(y + j) * MW + x + i] = 1; else map.taken[(y + j) * MW + x + i] = 1; }
      var w = d.wide || d.fp[0] * T;
      var prop = { type: type, x: x * T + d.fp[0] * T / 2 - w / 2, baseY: (y + d.fp[1]) * T, w: w, h: d.h, cx: (x + d.fp[0] / 2) * T, cy: (y + d.fp[1] / 2) * T, tx: x, ty: y, solid: solid, room: rm.idx };
      map.props.push(prop);
      (rm.props = rm.props || []).push(prop);
      return prop;
    }
    function unput(rm, prop) {
      var d = P[prop.type];
      for (var j = 0; j < d.fp[1]; j++) for (var i = 0; i < d.fp[0]; i++) { var n = (prop.ty + j) * MW + prop.tx + i; if (prop.solid) map.solid[n] = 0; else map.taken[n] = 0; }
      map.props.splice(map.props.indexOf(prop), 1);
      rm.props.splice(rm.props.indexOf(prop), 1);
    }
    // ¿Todo el piso libre de la sala sigue conectado?
    var stamp = new Int32Array(MW * MH), stampN = 0;
    function connected(rm) {
      var q = [], free = 0, start = -1, sid = ++stampN;
      for (var j = rm.y; j < rm.y + rm.h; j++) for (var i = rm.x; i < rm.x + rm.w; i++) {
        var n = j * MW + i;
        if (!map.solid[n]) { free++; if (start < 0) start = n; }
      }
      if (start < 0) return false;
      q.push(start); stamp[start] = sid; var got = 0;
      while (q.length) {
        var cur = q.pop(); got++;
        var cx = cur % MW, cy = (cur / MW) | 0;
        for (var d = 0; d < 4; d++) {
          var nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
          if (nx < rm.x || ny < rm.y || nx >= rm.x + rm.w || ny >= rm.y + rm.h) continue;
          var nn = ny * MW + nx;
          if (stamp[nn] !== sid && !map.solid[nn]) { stamp[nn] = sid; q.push(nn); }
        }
      }
      return got === free;
    }
    function tryPut(rm, type, x, y, ring) {
      if (!fits(rm, type, x, y, ring || 0)) return null;
      var pr = put(rm, type, x, y);
      if (pr.solid && !connected(rm)) { unput(rm, pr); return null; }
      return pr;
    }

    rooms.forEach(function (rm) {
      var th = THEMES[rm.theme], x, y, i, list;
      rm.props = [];
      // Contra el muro de arriba.
      if (th.top.length) {
        x = rm.x + ri(0, 1); i = 0;
        while (x < rm.x + rm.w) {
          var tp = th.top[i % th.top.length];
          if (th.top.length >= 5 && rm.theme !== 'library') { // composición centrada (altar, trono…)
            var total = th.top.reduce(function (s, t) { return s + P[t].fp[0] + 1; }, -1);
            x = rm.x + ((rm.w - total) >> 1);
            th.top.forEach(function (t) { tryPut(rm, t, x, rm.y); x += P[t].fp[0] + 1; });
            break;
          }
          if (tryPut(rm, tp, x, rm.y)) x += P[tp].fp[0] + (R() < 0.3 ? 1 : 0); else x++;
          i++;
          if (R() < 0.12) x += 2;
        }
      }
      // Costados.
      if (th.side.length) {
        [rm.x, rm.x + rm.w - 1].forEach(function (sx) {
          for (var yy = rm.y + 2; yy < rm.y + rm.h - 1; yy += 1 + ri(0, 2)) {
            var t = pick(th.side);
            var px = sx === rm.x ? sx : sx - P[t].fp[0] + 1;
            if (P[t].fp[0] <= 1 || R() < 0.4) if (tryPut(rm, t, px, yy)) yy += P[t].fp[1] - 1;
          }
        });
      }
      // Abajo.
      if (th.bottom.length) {
        for (x = rm.x + 1; x < rm.x + rm.w - 1; x += 2 + ri(0, 3)) {
          var tb = pick(th.bottom);
          if (tryPut(rm, tb, x, rm.y + rm.h - P[tb].fp[1])) x += P[tb].fp[0];
        }
      }
      // Columnas.
      if (th.pillars) {
        var cols = Math.max(2, Math.round(rm.w / 7));
        for (i = 0; i < cols; i++) {
          x = rm.x + 3 + Math.round(i * (rm.w - 7) / (cols - 1));
          for (y = rm.y + 4; y < rm.y + rm.h - 2; y += 5) if (map.tiles[y * MW + x] !== TL.CARPET) tryPut(rm, 'pillar', x, y, 1);
        }
      }
      // Bancos de capilla en filas.
      if (th.pews) {
        for (y = rm.y + 4; y < rm.y + rm.h - 2; y += 2) {
          tryPut(rm, 'pew', rm.x + 2, y); tryPut(rm, 'pew', rm.x + rm.w - 5, y);
          if (rm.w > 20) tryPut(rm, 'pew', rm.x + ((rm.w - 3) >> 1) - 4, y), tryPut(rm, 'pew', rm.x + ((rm.w - 3) >> 1) + 4, y);
        }
      }
      // Islas en el centro.
      if (th.center.length) {
        var n = Math.round(rm.w * rm.h / 55) + ri(0, 2);
        for (i = 0; i < n * 3 && n > 0; i++) {
          list = pick(th.center);
          var main = list[0], dm = P[main];
          x = ri(rm.x + 2, rm.x + rm.w - 2 - dm.fp[0]); y = ri(rm.y + 3, rm.y + rm.h - 2 - dm.fp[1]);
          var pr = tryPut(rm, main, x, y, 1);
          if (pr) {
            n--;
            if (list[1] === 'chair') { for (var q = 0; q < dm.fp[0]; q += 2) tryPut(rm, 'chair', x + q, y - 1); }
          }
        }
      }
      // Velas de pie sueltas en salas interiores grandes.
      if (!rm.outdoor && !th.dark && rm.w * rm.h > 300) tryPut(rm, 'candle', ri(rm.x + 3, rm.x + rm.w - 4), ri(rm.y + 3, rm.y + rm.h - 3), 1);
      // Manchas.
      var nd = Math.round(rm.w * rm.h / 70) + ri(0, 2);
      for (i = 0; i < nd; i++) {
        var dt = pick(th.decals.concat(['crack', 'crack']));
        map.decals.push({ type: dt, x: (rm.x + R() * (rm.w - 2)) * T, y: (rm.y + 1 + R() * (rm.h - 3)) * T, room: rm.idx });
      }
      if (!rm.outdoor && R() < 0.6) map.decals.push({ type: 'web', x: rm.x * T, y: rm.y * T, room: rm.idx });
      // Adornos de la pared de arriba y antorchas.
      if (!rm.outdoor) {
        var wy = rm.y - 1;
        for (x = rm.x + 1; x < rm.x + rm.w - 2; x += 3 + ri(0, 2)) {
          if (keep[wy * MW + x] || keep[wy * MW + x + 1] || map.tiles[wy * MW + x] !== TL.WALL || map.tiles[wy * MW + x + 1] !== TL.WALL) continue;
          var torch = !th.dark && ((x - rm.x) % 6 < 3) && R() < 0.75;
          var dtype = torch ? 'torch' : (th.deco.length && R() < 0.6 ? pick(th.deco) : null);
          if (dtype === 'window' && rm.r !== 0 && rm.theme !== 'chapel' && rm.theme !== 'throne') dtype = 'painting';
          if (dtype) {
            if ((dtype === 'fireplace' || dtype === 'furnace') && (rm.hasFire || keep[wy * MW + x + 2] || map.tiles[wy * MW + x + 2] !== TL.WALL || map.solid[(wy + 1) * MW + x] || map.solid[(wy + 1) * MW + x + 1])) dtype = 'torch';
            if (dtype === 'fireplace' || dtype === 'furnace') rm.hasFire = true;
            map.walldeco.push({ type: dtype, x: x * T, y: wy * T });
            x += dtype === 'fireplace' || dtype === 'furnace' ? 2 : 0;
          }
        }
      }
    });

    // Yunque de la herrería (en el medio) y el espejo maldito de una alcoba.
    var forge = rooms.filter(function (rm) { return rm.theme === 'forge'; })[0];
    var anvil = tryPut(forge, 'anvil', forge.x + (forge.w >> 1) - 1, forge.y + (forge.h >> 1), 1) || tryPut(forge, 'anvil', forge.x + 3, forge.y + 4, 1);
    map.interact.push({ kind: 'anvil', x: anvil.cx, y: anvil.cy + 16, r: 52 });
    map.forge = forge;
    var bedrooms = rooms.filter(function (rm) { return rm.theme === 'bedroom'; });
    var mirrorRoom = bedrooms[(bedrooms.length / 2) | 0];
    for (var tries = 0; tries < 40; tries++) {
      var mp = tryPut(mirrorRoom, 'mirror', ri(mirrorRoom.x + 1, mirrorRoom.x + mirrorRoom.w - 2), mirrorRoom.y);
      if (mp) { map.interact.push({ kind: 'mirror', x: mp.cx, y: mp.cy + 20, r: 44 }); break; }
    }
    map.props.forEach(function (pr) {
      var def = P[pr.type];
      if (pr.type === 'well') map.interact.push({ kind: 'well', x: pr.cx, y: pr.baseY + 8, r: 56 });
      if (pr.type === 'horse') map.interact.push({ kind: 'horse', x: pr.cx, y: pr.cy + 18, r: 46 });
      if (pr.type === 'piano') map.interact.push({ kind: 'piano', x: pr.cx, y: pr.cy + 18, r: 46 });
      if (pr.type === 'clock') map.interact.push({ kind: 'clock', x: pr.cx, y: pr.cy + 18, r: 40 });
      if (def.light) {
        map.lights.push({ x: pr.cx, y: pr.baseY - def.h + 8, r: def.light, color: 'warm', flick: R() * 6 });
        def.flameAt.forEach(function (f) { map.flames.push({ x: pr.x + f[0], y: pr.baseY - def.h + f[1], s: 2.6 }); });
      }
    });
    map.interact.push({ kind: 'gate', x: (gate.x + 1) * T, y: (gate.y - 0.3) * T, r: 60 });
    var cdx = cd.v ? (rooms[cryptIdx].x < cd.x ? cd.x + 2.6 : cd.x - 0.6) : cd.x + 1;
    var cdy = cd.v ? cd.y + 1.4 : (rooms[cryptIdx].y < cd.y ? cd.y + 2.8 : cd.y - 0.2);
    map.interact.push({ kind: 'cryptdoor', x: cdx * T, y: cdy * T, r: 60 });

    map.walldeco.forEach(function (d) {
      var x = d.x, y = d.y;
      if (d.type === 'torch') {
        map.lights.push({ x: x + 16, y: y + 22, r: 150, color: 'warm', flick: R() * 6 });
        map.flames.push({ x: x + 16, y: y + 12, s: 4 });
      } else if (d.type === 'fireplace' || d.type === 'furnace') {
        map.lights.push({ x: x + 48, y: y + 30, r: 230, color: 'fire', flick: R() * 6 });
        for (var f = 0; f < 5; f++) map.flames.push({ x: x + 30 + f * 9, y: y + 28, s: 5 });
      } else if (d.type === 'window') {
        map.lights.push({ x: x + 16, y: y + 44, r: 110, color: 'moon', flick: 0 });
      }
    });

    /* ----- Objetos y notas ----- */
    function freeSpot(rm, avoid) {
      for (var t = 0; t < 200; t++) {
        var x = ri(rm.x + 1, rm.x + rm.w - 2), y = ri(rm.y + 1, rm.y + rm.h - 2), n = y * MW + x;
        if (map.solid[n] || map.taken[n] || keep[n]) continue;
        if (avoid && map.solid[(y - 1) * MW + x] && map.solid[(y + 1) * MW + x]) continue;
        map.taken[n] = 1;
        return { x: x * T + 16, y: y * T + 20 };
      }
      return null;
    }
    var start = { x: (ent.x + (ent.w >> 1)) * T, y: (ent.y + ent.h - 2.5) * T };
    var startRoom = ENT;
    function roomsOf(theme) { return rooms.filter(function (rm) { return rm.theme === theme; }); }
    function dist(rm) { return Math.hypot(rm.x + rm.w / 2 - start.x / T, rm.y + rm.h / 2 - start.y / T); }
    function farPick(list) {
      var s = list.slice().sort(function (a, b) { return dist(b) - dist(a); });
      return s[ri(0, Math.max(0, Math.min(2, s.length - 1)))];
    }
    function midPick(list) {
      var s = list.slice().sort(function (a, b) { return dist(a) - dist(b); });
      return s[Math.min(s.length - 1, ri((s.length / 3) | 0, (s.length * 2 / 3) | 0))];
    }
    var placeIn = {
      key: farPick(roomsOf('library')),
      ingot: midPick(roomsOf('armory')),
      ingot2: farPick(roomsOf('tower')),
      coal: farPick(roomsOf('dungeon').concat(roomsOf('cellar'))),
      nails: farPick(roomsOf('stables').concat(roomsOf('storage'))),
      hammer: rooms[cryptIdx]
    };
    var NAMES = { key: 'Llave de la cripta', ingot: 'Lingote de hierro', ingot2: 'Lingote de hierro', coal: 'Carbón', nails: 'Clavos de herradura', hammer: 'Martillo de herrero' };
    Object.keys(placeIn).forEach(function (id) {
      var rm = placeIn[id], sp = freeSpot(rm, true);
      map.items.push({ id: id, name: NAMES[id], icon: id === 'ingot2' ? 'ingot' : id, x: sp.x, y: sp.y, taken: false, room: rm.idx, kind: 'quest' });
    });
    // Consumibles: vendas y agua bendita por todo el castillo.
    var nb = 0, nh = 0, order = rooms.slice().sort(function () { return R() - 0.5; });
    order.forEach(function (rm, i) {
      if (rm.theme === 'outside') return;
      var big = rm.w * rm.h > 300 ? 1 : 0;
      if (i % 2 === 0 || big) { var s1 = freeSpot(rm); if (s1) map.items.push({ id: 'b' + (nb++), name: 'Venda', icon: 'bandage', x: s1.x, y: s1.y, taken: false, room: rm.idx, kind: 'bandage' }); }
      if (i % 3 === 0) { var s2 = freeSpot(rm); if (s2) map.items.push({ id: 'h' + (nh++), name: 'Agua bendita', icon: 'holy', x: s2.x, y: s2.y, taken: false, room: rm.idx, kind: 'holy' }); }
    });
    // Siempre hay una venda y un agua bendita cerca del arranque.
    var s0 = freeSpot(ent); map.items.push({ id: 'b' + (nb++), name: 'Venda', icon: 'bandage', x: s0.x, y: s0.y, taken: false, room: ENT, kind: 'bandage' });
    s0 = freeSpot(ent); map.items.push({ id: 'h' + (nh++), name: 'Agua bendita', icon: 'holy', x: s0.x, y: s0.y, taken: false, room: ENT, kind: 'holy' });

    // Nombres de las salas (tema + ala + número si se repite).
    var counts = {};
    rooms.forEach(function (rm) {
      var th = THEMES[rm.theme], base = th.name;
      if (['throne', 'entrance', 'outside', 'crypt', 'forge'].indexOf(rm.theme) < 0) base += ' del Ala ' + wingOf(rm.x + rm.w / 2, rm.y + rm.h / 2);
      counts[base] = (counts[base] || 0) + 1;
      rm.name = base + ROMAN[counts[base]];
      rm.id = rm.theme; rm.dark = !!th.dark;
    });
    var rn = function (id) { return rooms[map.items.filter(function (it) { return it.id === id; })[0].room].name; };

    var NOTES = [
      ['Diario del mayordomo', 'La señora se casó vestida de blanco y nunca volvió a sacarse el vestido. Camina por los pasillos con su garfio buscando al novio que la abandonó en el altar.'],
      ['Plegaria rota', 'El portón del Gran Vestíbulo solo se abre con una herradura forjada en la Herrería: dos lingotes de hierro, carbón, clavos y el martillo del herrero.'],
      ['Advertencia', 'Si escuchás el garfio arrastrándose, quedate quieto un segundo. Ella aparece en el humo y te señala un camino. ANDÁ POR DONDE SEÑALA. Si no, se multiplica.'],
      ['Página arrancada', 'Cuando te persigue no te detengas. Salta sobre su presa con el garfio por delante. El agua bendita la espanta, pero hay que tirársela de cerca.'],
      ['Nota del médico', 'El garfio va siempre al ojo. Quien sangra tiene poco tiempo: una venda bien apretada o la mano de un compañero lo salvan.'],
      ['Garabato en la pared', 'NO MIRES EL ESPEJO. NO MIRES EL ESPEJO. NO MIRES EL ESPEJO.'],
      ['Carta de la Dama Blanca', 'Te esperé toda la noche. Te voy a seguir esperando. Y si no venís vos, va a venir otro… y ese no se va a ir nunca.'],
      ['Inventario del bibliotecario', 'Escondí la llave de la cripta entre los libros prohibidos, en la ' + rn('key') + '.'],
      ['Orden del herrero', 'Mandé los clavos de herradura a la ' + rn('nails') + '. El martillo se lo llevaron a la Cripta; la puerta solo abre con la llave.'],
      ['Registro de la armería', 'Un lingote quedó en la ' + rn('ingot') + '. El otro lo subió el astrónomo al ' + rn('ingot2') + '.'],
      ['Rayado en una celda', 'Sacamos carbón para la fragua. Quedó una bolsa en la ' + rn('coal') + '. Escuché pasos de seda toda la noche.'],
      ['Plano a medio quemar', 'La Herrería está en el Ala Oeste, cerca de los establos. El vestíbulo, al sur. Si te perdés, mirá el MAPA.'],
      ['Confesión', 'La vi forcejear con el cocinero. Él gritó, empujó con todas sus fuerzas y ella se deshizo en humo. Otros no tuvieron tanta suerte… les sacó un ojo.'],
      ['Diario de una sirvienta', 'Cuando señala, el brazo le tiembla. Como si quisiera que alguien llegue a algún lado. Nadie sabe adónde.']
    ];
    var noteRooms = rooms.filter(function (rm) { return rm.theme !== 'crypt'; }).sort(function () { return R() - 0.5; });
    // Las tres primeras notas van cerca del arranque.
    var near = noteRooms.slice().sort(function (a, b) { return dist(a) - dist(b); });
    NOTES.forEach(function (n, i) {
      var rm = i < 3 ? near[i] : noteRooms[(i * 7) % noteRooms.length];
      var sp = freeSpot(rm);
      if (sp) map.notes.push({ id: i, title: n[0], text: n[1], x: sp.x, y: sp.y, read: false, room: rm.idx });
    });

    map.start = start;
    map.startRoom = startRoom;
    map.spawns = [[0, 0], [-1.5, 0], [1.5, 0], [0, -1.6]].map(function (o) { return { x: start.x + o[0] * T, y: start.y + o[1] * T }; });
    map.outdoorRects = rooms.filter(function (r) { return r.outdoor; }).map(function (r) { return { x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T }; });

    // Índice por bloques para dibujar solo lo visible.
    var cw = Math.ceil(MW / CHK), chh = Math.ceil(MH / CHK);
    map.cw = cw; map.chh = chh;
    map.chunks = [];
    for (k = 0; k < cw * chh; k++) map.chunks.push({ props: [], lights: [], flames: [], decals: [], deco: [] });
    var addC = function (list, o, x, y) {
      var c = clampI((x / T / CHK) | 0, 0, cw - 1), r = clampI((y / T / CHK) | 0, 0, chh - 1);
      map.chunks[r * cw + c][list].push(o);
    };
    map.props.forEach(function (o) { addC('props', o, o.cx, o.baseY - 1); });
    map.lights.forEach(function (o) { addC('lights', o, o.x, o.y); });
    map.flames.forEach(function (o) { addC('flames', o, o.x, o.y); });
    map.decals.forEach(function (o) { addC('decals', o, o.x, o.y); });
    map.walldeco.forEach(function (o) { addC('deco', o, o.x, o.y); });
    map.inView = function (x0, y0, x1, y1, list, fn) {
      var c0 = clampI(((x0 / T / CHK) | 0) - 1, 0, cw - 1), c1 = clampI(((x1 / T / CHK) | 0) + 1, 0, cw - 1);
      var r0 = clampI(((y0 / T / CHK) | 0) - 1, 0, chh - 1), r1 = clampI(((y1 / T / CHK) | 0) + 1, 0, chh - 1);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var a = map.chunks[r * cw + c][list]; for (var i = 0; i < a.length; i++) fn(a[i]); }
    };
    delete map.taken;
    return map;
  }
  function clampI(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Distancias por BFS desde un tile (para la IA y para verificar el mapa).
  function bfs(map, fx, fy, maxD, ignoreDoors) {
    var W = map.W, H = map.H, dist = new Int16Array(W * H).fill(-1), q = new Int32Array(W * H), qh = 0, qt = 0;
    var s = fy * W + fx;
    dist[s] = 0; q[qt++] = s;
    while (qh < qt) {
      var c = q[qh++], d = dist[c];
      if (maxD && d >= maxD) continue;
      var cx = c % W, cy = (c / W) | 0;
      for (var k = 0; k < 4; k++) {
        var nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var n = ny * W + nx, sv = map.solid[n];
        if (dist[n] >= 0 || (sv !== 0 && !(ignoreDoors && sv >= 2))) continue;
        dist[n] = d + 1; q[qt++] = n;
      }
    }
    return dist;
  }

  function reachable(map, from, to, ignoreDoors) {
    var d = bfs(map, (from.x / T) | 0, (from.y / T) | 0, 0, ignoreDoors);
    return d[((to.y / T) | 0) * map.W + ((to.x / T) | 0)] >= 0;
  }

  RM.Castle = {
    T: T, W: MW, H: MH, THEMES: THEMES,
    build: build,
    bfs: bfs,
    reachable: reachable,
    roomAt: function (map, px, py) {
      var x = (px / T) | 0, y = (py / T) | 0;
      if (x < 0 || y < 0 || x >= map.W || y >= map.H) return null;
      var i = map.room[y * map.W + x];
      return i >= 0 ? map.rooms[i] : null;
    }
  };
})(window.RM);
