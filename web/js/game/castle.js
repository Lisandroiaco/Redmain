/* Red Main — Nivel 1: "El Castillo del Terror" (la Dama Blanca).
   Mapa grande por salas (80×66 tiles), colisiones por tile, puerta de la cripta
   con llave y portón de salida que se abre con la herradura. */
(function (RM) {
  'use strict';
  var A = RM.Art2, TL = A.TILE, T = A.T;
  var MW = 80, MH = 66;

  var ROOMS = [
    { id: 'library', name: 'Biblioteca', x: 2, y: 2, w: 16, h: 12, floor: TL.WOOD },
    { id: 'gallery', name: 'Galería de Retratos', x: 20, y: 2, w: 26, h: 5, floor: TL.CARPET },
    { id: 'chapel', name: 'Capilla', x: 48, y: 2, w: 16, h: 12, floor: TL.STONE },
    { id: 'tower', name: 'Observatorio', x: 66, y: 2, w: 12, h: 12, floor: TL.WOOD },
    { id: 'throne', name: 'Salón del Trono', x: 20, y: 9, w: 26, h: 14, floor: TL.STONE },
    { id: 'kitchen', name: 'Cocina', x: 2, y: 16, w: 16, h: 12, floor: TL.CHECK },
    { id: 'dining', name: 'Gran Comedor', x: 48, y: 16, w: 16, h: 12, floor: TL.WOOD },
    { id: 'cellar', name: 'Bodega de Vinos', x: 66, y: 16, w: 12, h: 12, floor: TL.CRYPT },
    { id: 'yard', name: 'Patio Interior', x: 20, y: 25, w: 26, h: 16, floor: TL.GRASS, outdoor: true },
    { id: 'servants', name: 'Cuartel de Sirvientes', x: 2, y: 30, w: 16, h: 12, floor: TL.WOOD },
    { id: 'bedroom', name: 'Alcoba de la Dama', x: 48, y: 30, w: 16, h: 12, floor: TL.WOOD },
    { id: 'dungeon', name: 'Mazmorras', x: 66, y: 30, w: 12, h: 12, floor: TL.CRYPT },
    { id: 'forge', name: 'Herrería', x: 2, y: 44, w: 16, h: 12, floor: TL.STONE },
    { id: 'armory', name: 'Armería', x: 20, y: 43, w: 12, h: 10, floor: TL.STONE },
    { id: 'entrance', name: 'Vestíbulo', x: 34, y: 43, w: 12, h: 14, floor: TL.STONE },
    { id: 'crypt', name: 'Cripta', x: 48, y: 44, w: 16, h: 12, floor: TL.CRYPT },
    { id: 'stables', name: 'Establos', x: 66, y: 44, w: 12, h: 12, floor: TL.DIRT },
    { id: 'outside', name: 'Afuera', x: 30, y: 59, w: 20, h: 5, floor: TL.OUT, outdoor: true }
  ];

  // Pasajes de 2 tiles: [x, y, w, h]
  var DOORS = [
    [18, 4, 2, 2], [46, 4, 2, 2], [64, 7, 2, 2], [32, 7, 2, 2], [9, 14, 2, 2], [32, 23, 2, 2],
    [18, 25, 2, 2], [55, 14, 2, 2], [64, 21, 2, 2], [46, 18, 2, 2], [46, 34, 2, 2], [9, 28, 2, 2],
    [18, 36, 2, 2], [64, 35, 2, 2], [71, 28, 2, 2], [9, 42, 2, 2], [18, 48, 2, 2], [32, 47, 2, 2],
    [39, 41, 2, 2], [71, 42, 2, 2]
  ];
  var CRYPT_DOOR = [46, 50, 2, 2];
  var GATE = [39, 57, 2, 2];

  var PROPS = [
    // Biblioteca
    ['shelf', 2, 2], ['shelf', 3, 2], ['shelf', 4, 2], ['shelf', 5, 2], ['shelf', 6, 2], ['shelf', 7, 2], ['shelf', 8, 2],
    ['shelf', 11, 2], ['shelf', 12, 2], ['shelf', 13, 2], ['shelf', 14, 2], ['shelf', 15, 2], ['shelf', 16, 2],
    ['shelf', 3, 6], ['shelf', 4, 6], ['shelf', 5, 6], ['shelf', 6, 6], ['shelf', 12, 6], ['shelf', 13, 6], ['shelf', 14, 6], ['shelf', 15, 6],
    ['shelf', 3, 10], ['shelf', 4, 10], ['shelf', 5, 10], ['shelf', 13, 10], ['shelf', 14, 10], ['shelf', 15, 10],
    ['table', 8, 8], ['chair', 8, 9], ['globe', 16, 8], ['candle', 10, 4], ['candle', 2, 12],
    // Galería
    ['armor', 22, 2], ['armor', 26, 2], ['armor', 30, 2], ['armor', 36, 2], ['armor', 40, 2], ['armor', 44, 2],
    // Trono
    ['throne', 32, 10], ['candle', 29, 10], ['candle', 36, 10],
    ['pillar', 23, 11], ['pillar', 42, 11], ['pillar', 23, 15], ['pillar', 42, 15], ['pillar', 23, 19], ['pillar', 42, 19],
    ['armor', 21, 21], ['armor', 44, 22], ['statue', 20, 9], ['statue', 45, 9],
    // Capilla
    ['altar', 55, 3], ['statue', 49, 2], ['statue', 62, 2], ['candle', 53, 3], ['candle', 58, 3],
    ['pew', 50, 7], ['pew', 58, 7], ['pew', 50, 10], ['pew', 58, 10],
    // Observatorio
    ['telescope', 72, 5], ['globe', 75, 9], ['shelf', 67, 2], ['shelf', 68, 2], ['shelf', 69, 2], ['shelf', 74, 2], ['shelf', 75, 2], ['shelf', 76, 2],
    ['table', 68, 11], ['candle', 77, 6],
    // Cocina
    ['bigtable', 5, 21], ['barrel', 2, 27], ['barrel', 3, 27], ['crate', 15, 17], ['crate', 16, 17], ['barrel', 16, 21], ['barrel', 17, 21],
    ['barrel', 2, 18], ['crate', 13, 27],
    // Comedor
    ['bigtable', 50, 21], ['bigtable', 58, 21], ['chair', 50, 20], ['chair', 52, 20], ['chair', 58, 20], ['chair', 60, 20],
    ['candle', 48, 27], ['candle', 63, 27], ['armor', 63, 16],
    // Bodega
    ['winerack', 67, 16], ['winerack', 70, 16], ['winerack', 74, 16], ['barrel', 67, 26], ['barrel', 68, 26], ['barrel', 77, 19], ['barrel', 77, 20],
    ['barrel', 77, 25], ['crate', 76, 26], ['barrel', 69, 21],
    // Patio
    ['well', 25, 30], ['fountain', 36, 29], ['tree', 22, 27], ['tree', 43, 27], ['tree', 22, 39], ['tree', 44, 39], ['tree', 29, 37],
    ['grave', 34, 37], ['grave', 36, 38], ['grave', 38, 37], ['grave', 41, 31],
    // Cuartel de sirvientes
    ['cot', 3, 30], ['cot', 5, 30], ['cot', 7, 30], ['cot', 12, 30], ['cot', 14, 30], ['cot', 16, 30], ['cot', 3, 38], ['cot', 5, 38],
    ['table', 13, 39], ['barrel', 17, 40], ['candle', 7, 40],
    // Alcoba
    ['bed', 59, 31], ['wardrobe', 49, 30], ['mirror', 53, 30], ['rocker', 51, 38], ['candle', 62, 40], ['candle', 48, 40],
    // Mazmorras
    ['cell', 67, 33], ['cell', 68, 33], ['cell', 69, 33], ['cell', 70, 33], ['cell', 73, 33], ['cell', 74, 33], ['cell', 75, 33], ['cell', 76, 33], ['cell', 77, 33],
    ['cage', 68, 31], ['cage', 75, 31], ['candle', 67, 41],
    // Herrería
    ['anvil', 8, 50], ['barrel', 17, 45], ['barrel', 17, 55], ['crate', 2, 55], ['crate', 3, 55], ['rack', 12, 44], ['rack', 13, 44],
    // Armería
    ['rack', 21, 43], ['rack', 23, 43], ['rack', 25, 43], ['rack', 27, 43], ['rack', 29, 43], ['target', 22, 51], ['target', 29, 51], ['armor', 31, 44],
    // Vestíbulo
    ['pillar', 36, 46], ['pillar', 43, 46], ['pillar', 36, 53], ['pillar', 43, 53], ['armor', 35, 43], ['armor', 44, 43],
    // Cripta
    ['coffin', 50, 46], ['coffin', 53, 46], ['coffin', 56, 46], ['coffin', 59, 46], ['coffin', 62, 46], ['coffin', 50, 52], ['coffin', 62, 52],
    ['cage', 49, 55], ['candle', 56, 53],
    // Establos
    ['horse', 67, 46], ['horse', 67, 50], ['horse', 74, 47], ['hay', 77, 54], ['hay', 67, 54], ['hay', 68, 54], ['trough', 74, 51], ['hay', 77, 50]
  ];

  // Adornos de pared en la cara del muro: [tipo, x, y]
  var WALLDECO = [
    ['window', 51, 1], ['window', 60, 1], ['window', 69, 1], ['window', 74, 1],
    ['painting', 21, 1], ['painting', 24, 1], ['painting', 28, 1], ['painting', 34, 1], ['painting', 38, 1], ['painting', 42, 1],
    ['banner', 26, 8], ['banner', 39, 8], ['shield', 22, 42], ['shield', 26, 42], ['shield', 30, 42],
    ['fireplace', 3, 15], ['fireplace', 50, 15], ['furnace', 3, 43]
  ];

  // Antorchas automáticas en la pared de arriba de cada sala (menos en las más oscuras).
  function autoTorches(map) {
    var out = [];
    ROOMS.forEach(function (rm) {
      if (rm.outdoor || rm.id === 'crypt' || rm.id === 'dungeon' || rm.id === 'gallery') return;
      for (var x = rm.x + 2; x < rm.x + rm.w - 1; x += 6) {
        var y = rm.y - 1;
        if (map.tiles[y * MW + x] === TL.WALL && !WALLDECO.some(function (d) { return d[2] === y && Math.abs(d[1] - x) < 2; })) out.push(['torch', x, y]);
      }
    });
    return out;
  }

  var DECALS = [
    ['blood', 33, 15], ['bones', 44, 13], ['blood', 56, 5], ['blood', 8, 24], ['bones', 3, 23], ['puddle', 30, 31], ['puddle', 40, 34], ['puddle', 24, 37],
    ['blood', 57, 36], ['rug', 54, 34], ['bones', 70, 31], ['chain', 67, 31], ['chain', 76, 31], ['bones', 54, 50], ['blood', 57, 49], ['web', 48, 44],
    ['web', 63, 44], ['coalpile', 5, 53], ['blood', 40, 49], ['web', 2, 2], ['web', 66, 16], ['bones', 76, 22], ['blood', 72, 36], ['web', 20, 43]
  ];

  var ITEMS = [
    { id: 'key', name: 'Llave de la cripta', x: 16, y: 12, room: 'library' },
    { id: 'ingot', name: 'Lingote de hierro', x: 26, y: 50, room: 'armory' },
    { id: 'ingot2', name: 'Lingote de hierro', x: 76, y: 12, room: 'tower', icon: 'ingot' },
    { id: 'coal', name: 'Carbón', x: 76, y: 40, room: 'dungeon' },
    { id: 'nails', name: 'Clavos de herradura', x: 76, y: 45, room: 'stables' },
    { id: 'hammer', name: 'Martillo de herrero', x: 60, y: 54, room: 'crypt' }
  ];

  var NOTES = [
    { x: 4, y: 12, title: 'Diario del mayordomo', text: 'La señora se casó vestida de blanco y nunca volvió a sacarse el vestido. Dicen que todavía camina por los pasillos buscando al novio que la abandonó en el altar.' },
    { x: 49, y: 12, title: 'Plegaria rota', text: 'El portón solo se abre con una herradura forjada en el castillo: dos lingotes de hierro, carbón, clavos y el martillo del herrero. Que Dios ayude al que lo intente de noche.' },
    { x: 44, y: 10, title: 'Edicto del señor', text: 'Quien forje la herradura será libre. Quien no, servirá a la Dama para siempre.' },
    { x: 24, y: 39, title: 'Garabato en la pared', text: 'NO MIRES EL ESPEJO. NO MIRES EL ESPEJO. NO MIRES EL ESPEJO.' },
    { x: 60, y: 39, title: 'Carta de la Dama Blanca', text: 'Te esperé toda la noche. Te voy a seguir esperando. Y si no venís vos, va a venir otro… y ese no se va a ir nunca.' },
    { x: 69, y: 41, title: 'Rayado en la celda', text: 'Escuché pasos de seda en la cripta. El martillo quedó allá abajo. La llave la escondió el bibliotecario entre los libros prohibidos.' }
  ];

  /* ---------- Construcción ---------- */

  function build() {
    var map = {
      T: T, W: MW, H: MH,
      tiles: new Uint8Array(MW * MH), solid: new Uint8Array(MW * MH), room: new Int8Array(MW * MH).fill(-1),
      rooms: ROOMS, props: [], lights: [], flames: [], interact: [], items: [], notes: [], decals: [], walldeco: []
    };
    var carve = function (x, y, w, h, type, idx) {
      for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) { map.tiles[j * MW + i] = type; if (idx != null) map.room[j * MW + i] = idx; }
    };
    ROOMS.forEach(function (rm, i) { carve(rm.x, rm.y, rm.w, rm.h, rm.floor, i); });
    carve(32, 9, 2, 14, TL.CARPET); carve(39, 43, 2, 14, TL.CARPET);
    DOORS.forEach(function (d) { carve(d[0], d[1], d[2], d[3], TL.STONE); });
    carve(CRYPT_DOOR[0], CRYPT_DOOR[1], 2, 2, TL.STONE);
    carve(GATE[0], GATE[1], 2, 2, TL.STONE);
    for (var k = 0; k < MW * MH; k++) map.solid[k] = map.tiles[k] === TL.WALL ? 1 : 0;

    // Puerta de la cripta (3 = cerrada con llave) y portón (2 = cerrado).
    map.cryptDoor = { x: CRYPT_DOOR[0], y: CRYPT_DOOR[1], open: false };
    map.gate = { x: GATE[0], y: GATE[1], open: 0, opening: false };
    map.setDoorSolid = function () {
      for (var j = 0; j < 2; j++) for (var i = 0; i < 2; i++) {
        map.solid[(CRYPT_DOOR[1] + j) * MW + CRYPT_DOOR[0] + i] = map.cryptDoor.open ? 0 : 3;
        map.solid[(GATE[1] + j) * MW + GATE[0] + i] = map.gate.open >= 1 ? 0 : 2;
      }
    };
    map.setDoorSolid();
    map.exitY = (GATE[1] + 2.4) * T;

    // Celdas que no se pueden tapar con muebles: pasajes y su entrada.
    var keep = {};
    DOORS.concat([CRYPT_DOOR, GATE]).forEach(function (d) {
      for (var j = d[1] - 1; j <= d[1] + d[3]; j++) for (var i = d[0] - 1; i <= d[0] + d[2]; i++) keep[j * MW + i] = true;
    });

    PROPS.forEach(function (p) {
      var def = A.PROP[p[0]], solid = def.solid !== false, blocked = false;
      for (var j = 0; j < def.fp[1]; j++) for (var i = 0; i < def.fp[0]; i++) if (solid && keep[(p[2] + j) * MW + p[1] + i]) blocked = true;
      if (blocked) { if (window.console) console.warn('Mueble sobre un pasaje, se omite:', p); return; }
      for (j = 0; j < def.fp[1]; j++) for (i = 0; i < def.fp[0]; i++) if (solid) map.solid[(p[2] + j) * MW + p[1] + i] = 1;
      var w = def.wide || def.fp[0] * T;
      var prop = { type: p[0], x: p[1] * T + def.fp[0] * T / 2 - w / 2, baseY: (p[2] + def.fp[1]) * T, w: w, h: def.h, cx: (p[1] + def.fp[0] / 2) * T, cy: (p[2] + def.fp[1] / 2) * T };
      map.props.push(prop);
      if (def.light) {
        map.lights.push({ x: prop.cx, y: prop.baseY - def.h + 8, r: def.light, color: 'warm', flick: Math.random() * 6 });
        def.flameAt.forEach(function (f) { map.flames.push({ x: prop.x + f[0], y: prop.baseY - def.h + f[1], s: 2.6 }); });
      }
      if (p[0] === 'anvil') map.interact.push({ kind: 'anvil', x: prop.cx, y: prop.cy + 16, r: 52 });
      if (p[0] === 'mirror') map.interact.push({ kind: 'mirror', x: prop.cx, y: prop.cy + 20, r: 44 });
      if (p[0] === 'well') map.interact.push({ kind: 'well', x: prop.cx, y: prop.cy + 26, r: 56 });
      if (p[0] === 'horse') map.interact.push({ kind: 'horse', x: prop.cx, y: prop.cy + 18, r: 46 });
    });
    map.interact.push({ kind: 'gate', x: (GATE[0] + 1) * T, y: (GATE[1] - 0.3) * T, r: 56 });
    map.interact.push({ kind: 'cryptdoor', x: (CRYPT_DOOR[0] - 0.3) * T, y: (CRYPT_DOOR[1] + 1.3) * T, r: 56 });

    WALLDECO.concat(autoTorches(map)).forEach(function (d) {
      var x = d[1] * T, y = d[2] * T;
      map.walldeco.push({ type: d[0], x: x, y: y });
      if (d[0] === 'torch') {
        map.lights.push({ x: x + 16, y: y + 22, r: 140, color: 'warm', flick: Math.random() * 6 });
        map.flames.push({ x: x + 16, y: y + 12, s: 4 });
      } else if (d[0] === 'fireplace' || d[0] === 'furnace') {
        map.lights.push({ x: x + 32, y: y + 30, r: 210, color: 'fire', flick: Math.random() * 6 });
        for (var f = 0; f < 4; f++) map.flames.push({ x: x + 20 + f * 8, y: y + 28, s: 5 });
      } else if (d[0] === 'window') {
        map.lights.push({ x: x + 16, y: y + 44, r: 100, color: 'moon', flick: 0 });
      }
    });
    DECALS.forEach(function (d) { map.decals.push({ type: d[0], x: d[1] * T, y: d[2] * T }); });

    ITEMS.forEach(function (it) {
      map.items.push({ id: it.id, name: it.name, icon: it.icon || it.id, x: it.x * T + 16, y: it.y * T + 20, taken: false, room: it.room });
    });
    NOTES.forEach(function (n, i) { map.notes.push({ id: i, title: n.title, text: n.text, x: n.x * T + 16, y: n.y * T + 20, read: false }); });
    map.start = { x: 40 * T, y: 54.5 * T };
    map.spawns = [[40, 54.5], [38, 54.5], [42, 54.5], [40, 52.5]].map(function (s) { return { x: s[0] * T, y: s[1] * T }; });
    map.outdoorRects = ROOMS.filter(function (r) { return r.outdoor; }).map(function (r) { return { x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T }; });
    return map;
  }

  // ¿Se puede llegar caminando de un punto a otro? (para verificar el mapa)
  function reachable(map, from, to, ignoreDoors) {
    var W = map.W, seen = new Uint8Array(W * map.H), q = [((from.y / T) | 0) * W + ((from.x / T) | 0)];
    var goal = ((to.y / T) | 0) * W + ((to.x / T) | 0);
    seen[q[0]] = 1;
    while (q.length) {
      var c = q.shift();
      if (c === goal) return true;
      var cx = c % W, cy = (c / W) | 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = cx + d[0], ny = cy + d[1], n = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= map.H || seen[n]) return;
        var s = map.solid[n];
        if (n === goal || s === 0 || (ignoreDoors && s >= 2)) { seen[n] = 1; q.push(n); }
      });
    }
    return false;
  }

  RM.Castle = {
    T: T, W: MW, H: MH, ROOMS: ROOMS,
    build: build,
    reachable: reachable,
    roomAt: function (map, px, py) {
      var x = (px / T) | 0, y = (py / T) | 0;
      if (x < 0 || y < 0 || x >= MW || y >= MH) return null;
      var i = map.room[y * MW + x];
      return i >= 0 ? ROOMS[i] : null;
    }
  };
})(window.RM);
