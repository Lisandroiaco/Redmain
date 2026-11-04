/* Red Main — Nivel 1: "El Castillo del Terror" (la Dama Blanca).
   Mapa por salas, tiles y muebles dibujados por código, colisiones por tile. */
(function (RM) {
  'use strict';
  var T = 16, MW = 50, MH = 42;
  var WALL = 0, STONE = 1, WOOD = 2, CARPET = 3, GRASS = 4, CRYPT = 5, OUT = 6;

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  /* ---------- Definición del mapa ---------- */

  var ROOMS = [
    { id: 'library', name: 'Biblioteca', x: 1, y: 1, w: 14, h: 10, floor: WOOD },
    { id: 'throne', name: 'Salón del Trono', x: 17, y: 1, w: 16, h: 12, floor: STONE },
    { id: 'chapel', name: 'Capilla', x: 35, y: 1, w: 14, h: 10, floor: STONE },
    { id: 'kitchen', name: 'Cocina', x: 1, y: 13, w: 14, h: 11, floor: STONE },
    { id: 'yard', name: 'Patio Interior', x: 17, y: 15, w: 16, h: 10, floor: GRASS, outdoor: true },
    { id: 'bedroom', name: 'Alcoba de la Dama', x: 35, y: 13, w: 14, h: 11, floor: WOOD },
    { id: 'forge', name: 'Herrería', x: 1, y: 26, w: 14, h: 11, floor: STONE },
    { id: 'entrance', name: 'Vestíbulo', x: 17, y: 27, w: 16, h: 10, floor: STONE },
    { id: 'crypt', name: 'Cripta', x: 35, y: 26, w: 14, h: 11, floor: CRYPT },
    { id: 'outside', name: 'Afuera', x: 17, y: 38, w: 16, h: 3, floor: OUT, outdoor: true }
  ];

  // Pasajes de 2 tiles entre salas [x, y, w, h].
  var DOORS = [
    [15, 5, 2, 2], [33, 5, 2, 2], [24, 13, 2, 2], [7, 11, 2, 2], [15, 18, 2, 2],
    [33, 18, 2, 2], [41, 11, 2, 2], [24, 25, 2, 2], [7, 24, 2, 2], [15, 31, 2, 2], [41, 24, 2, 2]
  ];

  // Muebles: [tipo, x, y]. La huella sólida y el dibujo dependen del tipo.
  var PROPS = [
    // Biblioteca
    ['shelf', 1, 1], ['shelf', 2, 1], ['shelf', 3, 1], ['shelf', 4, 1], ['shelf', 5, 1], ['shelf', 6, 1],
    ['shelf', 9, 1], ['shelf', 10, 1], ['shelf', 11, 1], ['shelf', 12, 1], ['shelf', 13, 1], ['shelf', 14, 1],
    ['shelf', 2, 4], ['shelf', 3, 4], ['shelf', 4, 4], ['shelf', 11, 4], ['shelf', 12, 4], ['shelf', 13, 4],
    ['table', 3, 7], ['chair', 3, 8], ['table', 10, 7], ['chair', 11, 8], ['candle', 7, 3], ['candle', 8, 9],
    // Salón del trono
    ['pillar', 19, 3], ['pillar', 30, 3], ['pillar', 19, 7], ['pillar', 30, 7], ['pillar', 19, 11], ['pillar', 30, 11],
    ['throne', 24, 2], ['candle', 22, 2], ['candle', 27, 2], ['armor', 18, 1], ['armor', 32, 12],
    // Capilla
    ['altar', 41, 2], ['statue', 37, 1], ['statue', 46, 1], ['candle', 39, 2], ['candle', 44, 2],
    ['pew', 37, 5], ['pew', 43, 5], ['pew', 37, 7], ['pew', 43, 7],
    // Cocina
    ['bigtable', 6, 17], ['barrel', 1, 22], ['barrel', 2, 22], ['barrel', 13, 13], ['crate', 12, 22], ['crate', 13, 22],
    ['barrel', 1, 14], ['crate', 10, 13],
    // Patio
    ['well', 24, 19], ['tree', 19, 16], ['tree', 30, 22], ['tree', 31, 16], ['grave', 20, 22], ['grave', 22, 23], ['grave', 28, 23],
    // Alcoba
    ['bed', 45, 14], ['wardrobe', 37, 13], ['mirror', 43, 13], ['rocker', 39, 20], ['candle', 47, 22], ['candle', 36, 22],
    // Cripta
    ['coffin', 37, 28], ['coffin', 40, 28], ['coffin', 44, 28], ['coffin', 47, 28], ['coffin', 37, 33], ['coffin', 47, 33],
    ['cage', 36, 36], ['candle', 42, 33],
    // Herrería
    ['anvil', 7, 31], ['barrel', 13, 26], ['barrel', 1, 36], ['crate', 12, 36], ['crate', 13, 36], ['rack', 11, 26],
    // Vestíbulo
    ['pillar', 19, 29], ['pillar', 30, 29], ['pillar', 19, 34], ['pillar', 30, 34], ['armor', 21, 27], ['armor', 28, 27]
  ];

  // Decoración plana: [tipo, x, y, w?, h?] (no colisiona).
  var DECALS = [
    ['rug', 5, 6, 4, 3], ['web', 1, 10], ['web', 14, 10], ['carpet', 24, 1, 2, 12], ['blood', 23, 9], ['bones', 31, 10],
    ['blood', 42, 4], ['blood', 8, 20], ['bones', 3, 19], ['puddle', 21, 18], ['puddle', 27, 21], ['puddle', 18, 24],
    ['rug', 40, 16, 5, 4], ['blood', 43, 20], ['bones', 39, 31], ['bones', 45, 35], ['web', 35, 36], ['web', 48, 26],
    ['blood', 41, 30], ['coalpile', 3, 33], ['carpet', 24, 27, 2, 10], ['blood', 26, 31], ['web', 1, 26]
  ];

  // Adornos de pared (sobre la cara visible del muro): [tipo, x, y].
  var WALLDECO = [
    ['torch', 5, 0], ['torch', 10, 0], ['torch', 18, 0], ['torch', 31, 0], ['banner', 21, 0], ['banner', 28, 0],
    ['window', 38, 0], ['window', 45, 0], ['torch', 36, 0], ['torch', 47, 0],
    ['fireplace', 3, 12], ['torch', 11, 12], ['torch', 19, 14], ['torch', 30, 14],
    ['torch', 37, 12], ['torch', 46, 12], ['furnace', 2, 25], ['torch', 10, 25],
    ['torch', 19, 26], ['torch', 30, 26], ['banner', 22, 26], ['banner', 27, 26]
  ];

  var ITEMS = [
    { id: 'nails', name: 'Clavos', x: 12, y: 9, room: 'library' },
    { id: 'ingot', name: 'Lingote de hierro', x: 31, y: 1, room: 'throne' },
    { id: 'ingot2', name: 'Lingote de hierro', x: 43, y: 3, room: 'chapel', icon: 'ingot' },
    { id: 'coal', name: 'Carbón', x: 4, y: 14, room: 'kitchen' },
    { id: 'hammer', name: 'Martillo de herrero', x: 46, y: 35, room: 'crypt' }
  ];

  var NOTES = [
    { x: 2, y: 9, title: 'Diario del mayordomo', text: 'La señora se casó vestida de blanco y nunca volvió a sacarse el vestido. Dicen que todavía camina por los pasillos buscando al novio que la abandonó en el altar.' },
    { x: 36, y: 9, title: 'Plegaria rota', text: 'El portón solo se abre con una herradura forjada en el castillo. Hierro, carbón, clavos y el martillo del herrero. Que Dios ayude al que lo intente de noche.' },
    { x: 31, y: 15, title: 'Garabato en la pared', text: 'NO MIRES EL ESPEJO. NO MIRES EL ESPEJO. NO MIRES EL ESPEJO.' },
    { x: 44, y: 21, title: 'Carta de la Dama Blanca', text: 'Te esperé toda la noche. Te voy a seguir esperando. Y si no venís vos, va a venir otro… y ese no se va a ir nunca.' }
  ];

  /* ---------- Dibujo de tiles ---------- */

  function floorTile(g, type, x, y) {
    var px = x * T, py = y * T, h = hash(x, y), i;
    var r = function (a, b, w, hh, c) { g.fillStyle = c; g.fillRect(px + a, py + b, w, hh); };
    if (type === STONE || type === CRYPT) {
      var base = type === CRYPT ? ['#22202a', '#1c1a23', '#26232e'] : ['#3b3846', '#35323f', '#403c4b'];
      r(0, 0, T, T, base[(h * 3) | 0]);
      r(0, 0, T, 1, 'rgba(0,0,0,0.35)'); r(0, 0, 1, T, 'rgba(0,0,0,0.35)');
      r(8, 0, 1, 8, 'rgba(0,0,0,0.25)'); r(0, 8, T, 1, 'rgba(0,0,0,0.25)');
      if (h > 0.7) { r(3 + (h * 8 | 0), 4, 3, 1, 'rgba(0,0,0,0.3)'); r(5 + (h * 6 | 0), 5, 1, 3, 'rgba(0,0,0,0.3)'); }
      if (h < 0.12) r(10, 11, 2, 2, 'rgba(255,255,255,0.05)');
    } else if (type === WOOD) {
      r(0, 0, T, T, '#4a3020');
      for (i = 0; i < 4; i++) {
        r(0, i * 4, T, 1, '#2e1d12');
        r(((h * 13 + i * 5) | 0) % T, i * 4 + 1, 1, 3, '#2e1d12');
        if ((h * 10 + i) % 3 < 1) r(2, i * 4 + 2, 5, 1, '#5a3a26');
      }
    } else if (type === CARPET) {
      r(0, 0, T, T, '#5e0c12');
      r(0, 0, T, 1, '#3e060a');
      if (h > 0.5) r(6, 6, 4, 4, '#741018');
    } else if (type === GRASS || type === OUT) {
      r(0, 0, T, T, type === OUT ? '#17241a' : '#1e2c1c');
      for (i = 0; i < 7; i++) {
        var gx = (hash(x * 7 + i, y * 3) * 15) | 0, gy = (hash(x, y * 5 + i) * 15) | 0;
        r(gx, gy, 1, 2, i % 2 ? '#2b3d26' : '#142012');
      }
    }
  }

  function wallTile(g, map, x, y) {
    var px = x * T, py = y * T;
    var below = y + 1 < MH ? map.tiles[(y + 1) * MW + x] : WALL;
    g.fillStyle = '#16121c'; g.fillRect(px, py, T, T);
    if (below !== WALL) {
      // Cara frontal de ladrillos.
      g.fillStyle = '#4a4252'; g.fillRect(px, py + 2, T, T - 2);
      g.fillStyle = '#2c2634';
      for (var row = 0; row < 3; row++) {
        var yy = py + 2 + row * 5;
        g.fillRect(px, yy + 4, T, 1);
        var off = (row + x) % 2 ? 0 : 8;
        g.fillRect(px + off, yy, 1, 4);
        g.fillRect(px + ((off + 8) % 16), yy, 1, 4);
      }
      if (hash(x, y) > 0.75) { g.fillStyle = '#3a6a3a'; g.fillRect(px + 3, py + 10, 3, 2); }
      g.fillStyle = '#5c5466'; g.fillRect(px, py + 2, T, 1);
    } else {
      // Borde iluminado donde el muro toca el piso por los costados.
      var left = x > 0 && map.tiles[y * MW + x - 1] !== WALL, right = x < MW - 1 && map.tiles[y * MW + x + 1] !== WALL;
      g.fillStyle = '#2a2432';
      if (left) g.fillRect(px, py, 2, T);
      if (right) g.fillRect(px + T - 2, py, 2, T);
    }
  }

  /* ---------- Muebles (sprites) ---------- */

  // fp = huella en tiles; h = alto del dibujo en px; draw(r, w, h)
  var PROP = {
    shelf: { fp: [1, 1], h: 28, draw: function (r) {
      r(0, 0, 16, 28, '#3a2416'); r(1, 1, 14, 26, '#2a180e');
      var cols = ['#7a1a1a', '#1a4a6a', '#5a5a1a', '#4a1a5a', '#1a5a3a', '#8a6a3a'];
      for (var s = 0; s < 4; s++) { r(1, 6 + s * 6, 14, 1, '#4a3020'); for (var b = 0; b < 6; b++) r(2 + b * 2, 2 + s * 6, 2, 4, cols[(b + s * 2) % 6]); }
    } },
    pillar: { fp: [1, 1], h: 36, draw: function (r) {
      r(1, 0, 14, 4, '#5a5466'); r(3, 4, 10, 28, '#4a4454'); r(3, 4, 2, 28, '#5e5868'); r(11, 4, 2, 28, '#363040'); r(1, 32, 14, 4, '#5a5466');
    } },
    table: { fp: [2, 1], h: 20, draw: function (r) {
      r(0, 2, 32, 10, '#5a3a22'); r(0, 2, 32, 2, '#7a5232'); r(2, 12, 3, 8, '#3a2414'); r(27, 12, 3, 8, '#3a2414');
      r(6, 4, 5, 4, '#d8ccaa'); r(20, 3, 3, 5, '#b0b0b0');
    } },
    bigtable: { fp: [3, 1], h: 20, draw: function (r) {
      r(0, 2, 48, 10, '#5a3a22'); r(0, 2, 48, 2, '#7a5232'); r(2, 12, 3, 8, '#3a2414'); r(43, 12, 3, 8, '#3a2414');
      r(8, 4, 8, 5, '#8a2020'); r(10, 3, 4, 2, '#a83030'); r(26, 4, 6, 4, '#777'); r(36, 5, 5, 3, '#c9a86a');
    } },
    chair: { fp: [1, 1], h: 18, solid: false, draw: function (r) {
      r(3, 0, 10, 8, '#4a2e1a'); r(3, 8, 10, 4, '#5a3a22'); r(3, 12, 2, 6, '#3a2414'); r(11, 12, 2, 6, '#3a2414');
    } },
    throne: { fp: [2, 1], h: 34, draw: function (r) {
      r(4, 0, 24, 22, '#6e5a12'); r(7, 3, 18, 18, '#7a0f16'); r(2, 18, 28, 8, '#6e5a12'); r(4, 26, 4, 8, '#4a3c0c'); r(24, 26, 4, 8, '#4a3c0c');
      r(14, 0, 4, 3, '#e0c040'); r(5, 0, 3, 3, '#e0c040'); r(24, 0, 3, 3, '#e0c040');
    } },
    candle: { fp: [1, 1], h: 26, light: 44, flame: [8, 3], draw: function (r) {
      r(7, 6, 2, 16, '#8a7a3a'); r(3, 22, 10, 4, '#6a5a2a'); r(3, 6, 10, 2, '#8a7a3a'); r(3, 3, 2, 3, '#e8e0c8'); r(7, 3, 2, 3, '#e8e0c8'); r(11, 3, 2, 3, '#e8e0c8');
    } },
    statue: { fp: [1, 1], h: 32, draw: function (r) {
      r(2, 26, 12, 6, '#55505e'); r(5, 6, 6, 20, '#8a8494'); r(6, 1, 4, 5, '#9a94a4'); r(3, 9, 2, 10, '#7a7484'); r(11, 9, 2, 10, '#7a7484'); r(6, 3, 1, 1, '#300'); r(9, 3, 1, 1, '#300');
    } },
    armor: { fp: [1, 1], h: 30, draw: function (r) {
      r(3, 26, 10, 4, '#3a3440'); r(5, 1, 6, 6, '#9aa0aa'); r(6, 3, 4, 1, '#111'); r(4, 7, 8, 10, '#8a909a'); r(2, 8, 2, 9, '#7a808a'); r(12, 8, 2, 9, '#7a808a');
      r(5, 17, 2, 9, '#7a808a'); r(9, 17, 2, 9, '#7a808a'); r(14, 2, 1, 22, '#aaa');
    } },
    pew: { fp: [3, 1], h: 16, draw: function (r) {
      r(0, 0, 48, 6, '#4a2e1a'); r(0, 6, 48, 5, '#5a3a22'); r(2, 11, 3, 5, '#3a2414'); r(43, 11, 3, 5, '#3a2414'); r(22, 11, 3, 5, '#3a2414');
    } },
    altar: { fp: [2, 1], h: 22, draw: function (r) {
      r(0, 8, 32, 14, '#6a6474'); r(0, 8, 32, 2, '#8a8494'); r(2, 2, 28, 7, '#e6e0d0'); r(14, 0, 4, 9, '#d4b040'); r(12, 2, 8, 2, '#d4b040');
    } },
    barrel: { fp: [1, 1], h: 18, draw: function (r) {
      r(2, 1, 12, 17, '#5a3a22'); r(1, 4, 14, 11, '#6a4428'); r(1, 4, 14, 1, '#3a3a3a'); r(1, 13, 14, 1, '#3a3a3a'); r(3, 0, 10, 2, '#3a2414');
    } },
    crate: { fp: [1, 1], h: 18, draw: function (r) {
      r(1, 2, 14, 16, '#7a5a32'); r(1, 2, 14, 2, '#9a7a4a'); r(1, 2, 2, 16, '#5a3e20'); r(13, 2, 2, 16, '#5a3e20'); r(3, 9, 10, 2, '#5a3e20');
    } },
    well: { fp: [2, 2], h: 40, draw: function (r) {
      r(2, 18, 28, 22, '#55505e'); r(4, 20, 24, 8, '#0a0a12'); r(2, 18, 28, 2, '#6a6474'); r(2, 36, 28, 4, '#45404e');
      r(3, 2, 2, 18, '#4a2e1a'); r(27, 2, 2, 18, '#4a2e1a'); r(1, 0, 30, 4, '#5a3a22'); r(15, 4, 1, 14, '#888'); r(13, 14, 5, 4, '#5a3a22');
    } },
    tree: { fp: [1, 1], h: 64, wide: 48, draw: function (r) {
      r(21, 30, 6, 34, '#2a1c14'); r(19, 58, 10, 6, '#2a1c14');
      var br = [[14, 20, 8, 3], [26, 16, 10, 3], [10, 12, 6, 2], [30, 8, 8, 2], [18, 6, 4, 14], [24, 2, 3, 14], [8, 22, 8, 2], [32, 24, 8, 2]];
      br.forEach(function (b) { r(b[0], b[1], b[2], b[3], '#2a1c14'); });
      r(16, 18, 16, 14, '#2a1c14');
    } },
    bed: { fp: [2, 2], h: 34, draw: function (r) {
      r(0, 0, 32, 8, '#3a2416'); r(0, 8, 32, 22, '#5a3a22'); r(2, 8, 28, 22, '#d8d4dc'); r(4, 10, 10, 6, '#f2f0f4'); r(18, 10, 10, 6, '#f2f0f4');
      r(2, 18, 28, 12, '#8a1c2a'); r(2, 18, 28, 2, '#a8283a'); r(0, 30, 3, 4, '#3a2416'); r(29, 30, 3, 4, '#3a2416');
    } },
    wardrobe: { fp: [2, 1], h: 32, draw: function (r) {
      r(0, 0, 32, 32, '#3a2416'); r(2, 2, 13, 28, '#4a2e1a'); r(17, 2, 13, 28, '#4a2e1a'); r(14, 14, 1, 4, '#c9a86a'); r(17, 14, 1, 4, '#c9a86a'); r(0, 0, 32, 2, '#5a3a22');
    } },
    mirror: { fp: [1, 1], h: 30, draw: function (r) {
      r(1, 0, 14, 26, '#8a6a1a'); r(3, 2, 10, 22, '#8aa0b0'); r(4, 3, 3, 20, '#b0c8d6'); r(5, 26, 6, 4, '#6a4a10');
    } },
    rocker: { fp: [1, 1], h: 20, draw: function (r) {
      r(3, 0, 10, 10, '#4a2e1a'); r(3, 10, 10, 4, '#5a3a22'); r(1, 18, 14, 2, '#3a2414'); r(3, 14, 2, 4, '#3a2414'); r(11, 14, 2, 4, '#3a2414');
    } },
    coffin: { fp: [1, 2], h: 34, draw: function (r) {
      r(2, 2, 12, 32, '#3a2416'); r(1, 6, 14, 10, '#3a2416'); r(3, 3, 10, 30, '#4a2e1a'); r(7, 8, 2, 12, '#9a8a6a'); r(5, 11, 6, 2, '#9a8a6a');
    } },
    cage: { fp: [1, 1], h: 28, draw: function (r) {
      r(1, 0, 14, 2, '#555'); r(1, 26, 14, 2, '#555');
      for (var i = 0; i < 5; i++) r(1 + i * 3, 2, 1, 24, '#666');
      r(5, 18, 6, 6, '#d8d0c0'); r(6, 19, 1, 1, '#111'); r(9, 19, 1, 1, '#111');
    } },
    anvil: { fp: [2, 1], h: 20, glow: true, draw: function (r) {
      r(4, 2, 24, 6, '#3a3e46'); r(0, 2, 6, 4, '#3a3e46'); r(4, 2, 24, 1, '#6a707a'); r(10, 8, 12, 6, '#2a2e34'); r(6, 14, 20, 6, '#3a3e46');
    } },
    grave: { fp: [1, 1], h: 20, draw: function (r) {
      r(3, 4, 10, 16, '#5a5664'); r(4, 2, 8, 3, '#5a5664'); r(3, 4, 10, 1, '#6e6a78'); r(7, 7, 2, 7, '#3a3644'); r(5, 9, 6, 2, '#3a3644');
    } },
    rack: { fp: [1, 1], h: 26, draw: function (r) {
      r(1, 2, 14, 2, '#4a2e1a'); r(1, 2, 2, 24, '#4a2e1a'); r(13, 2, 2, 24, '#4a2e1a'); r(5, 4, 1, 18, '#aaa'); r(9, 4, 1, 18, '#aaa'); r(4, 4, 3, 3, '#888'); r(8, 4, 3, 2, '#888');
    } }
  };

  function buildPropSprite(def) {
    var w = (def.wide || def.fp[0] * T), h = def.h;
    var c = RM.canvas(w, h), g = c.getContext('2d');
    def.draw(function (x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, w, h);
    RM.Sprites.outline(c);
    return c;
  }

  /* ---------- Construcción ---------- */

  function build() {
    var map = {
      T: T, W: MW, H: MH,
      tiles: new Uint8Array(MW * MH),
      solid: new Uint8Array(MW * MH),
      room: new Int8Array(MW * MH).fill(-1),
      rooms: ROOMS, props: [], lights: [], flames: [], interact: [], items: [], notes: []
    };
    var carve = function (x, y, w, h, type, roomIdx) {
      for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) {
        map.tiles[j * MW + i] = type;
        if (roomIdx != null) map.room[j * MW + i] = roomIdx;
      }
    };
    ROOMS.forEach(function (rm, i) { carve(rm.x, rm.y, rm.w, rm.h, rm.floor, i); });
    DOORS.forEach(function (d) { carve(d[0], d[1], d[2], d[3], STONE); });
    for (var k = 0; k < MW * MH; k++) map.solid[k] = map.tiles[k] === WALL ? 1 : 0;

    // Portón de salida (bloquea hasta abrirse con la herradura).
    map.gate = { x: 24, y: 37, w: 2, open: 0, opening: false };
    carve(24, 37, 2, 1, STONE);
    map.solid[37 * MW + 24] = map.solid[37 * MW + 25] = 2;
    map.exitY = 38.6 * T;

    PROPS.forEach(function (p) {
      var def = PROP[p[0]];
      var solid = def.solid !== false;
      for (var j = 0; j < def.fp[1]; j++) for (var i = 0; i < def.fp[0]; i++) if (solid) map.solid[(p[2] + j) * MW + p[1] + i] = 1;
      var w = def.wide || def.fp[0] * T;
      var prop = {
        type: p[0], sprite: null,
        x: p[1] * T + def.fp[0] * T / 2 - w / 2, baseY: (p[2] + def.fp[1]) * T,
        cx: (p[1] + def.fp[0] / 2) * T, cy: (p[2] + def.fp[1] / 2) * T
      };
      map.props.push(prop);
      if (def.light) {
        map.lights.push({ x: prop.cx, y: prop.baseY - def.h + 4, r: def.light, color: 'warm', flick: Math.random() * 6 });
        map.flames.push({ x: p[1] * T + def.flame[0], y: prop.baseY - def.h + def.flame[1], small: true, triple: true });
      }
      if (p[0] === 'anvil') map.interact.push({ kind: 'anvil', x: prop.cx, y: prop.cy, r: 30 });
      if (p[0] === 'mirror') map.interact.push({ kind: 'mirror', x: prop.cx, y: prop.cy + 8, r: 24 });
      if (p[0] === 'well') map.interact.push({ kind: 'well', x: prop.cx, y: prop.cy + 6, r: 30 });
    });
    map.interact.push({ kind: 'gate', x: 25 * T, y: 36.6 * T, r: 30 });

    WALLDECO.forEach(function (d) {
      var x = d[1] * T, y = d[2] * T;
      if (d[0] === 'torch') {
        map.lights.push({ x: x + 8, y: y + 8, r: 64, color: 'warm', flick: Math.random() * 6 });
        map.flames.push({ x: x + 8, y: y + 5 });
      } else if (d[0] === 'fireplace' || d[0] === 'furnace') {
        map.lights.push({ x: x + 16, y: y + 14, r: 96, color: 'fire', flick: Math.random() * 6 });
        map.flames.push({ x: x + 16, y: y + 12, big: true });
      } else if (d[0] === 'window') {
        map.lights.push({ x: x + 8, y: y + 18, r: 44, color: 'moon', flick: 0 });
      }
    });

    ITEMS.forEach(function (it) {
      map.items.push({ id: it.id, name: it.name, icon: it.icon || it.id, x: it.x * T + 8, y: it.y * T + 10, taken: false, room: it.room });
    });
    NOTES.forEach(function (n, i) {
      map.notes.push({ id: i, title: n.title, text: n.text, x: n.x * T + 8, y: n.y * T + 10, read: false });
    });
    map.start = { x: 25 * T, y: 34.5 * T };
    map.outdoorRects = ROOMS.filter(function (r) { return r.outdoor; }).map(function (r) { return { x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T }; });
    return map;
  }

  // Capa estática: pisos, muros, alfombras, sangre, adornos de pared.
  function renderStatic(map) {
    var c = RM.canvas(MW * T, MH * T), g = c.getContext('2d');
    for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
      var t = map.tiles[y * MW + x];
      if (t === WALL) wallTile(g, map, x, y); else floorTile(g, t, x, y);
      // Sombra que proyecta el muro sobre el piso.
      if (t !== WALL && y > 0 && map.tiles[(y - 1) * MW + x] === WALL) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x * T, y * T, T, 4); }
    }
    DECALS.forEach(function (d) {
      var x = d[1] * T, y = d[2] * T, i;
      if (d[0] === 'rug' || d[0] === 'carpet') {
        var w = d[3] * T, h = d[4] * T;
        g.fillStyle = d[0] === 'rug' ? '#4a1018' : '#5e0c12'; g.fillRect(x, y, w, h);
        g.strokeStyle = '#a07a2a'; g.lineWidth = 1; g.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
        if (d[0] === 'rug') { g.fillStyle = '#6a1a24'; g.fillRect(x + w / 2 - 6, y + h / 2 - 6, 12, 12); }
      } else if (d[0] === 'blood') {
        g.fillStyle = '#5a0606';
        for (i = 0; i < 7; i++) { g.beginPath(); g.arc(x + 8 + (hash(x, i) - 0.5) * 14, y + 8 + (hash(i, y) - 0.5) * 12, 1 + hash(x + i, y) * 4, 0, 6.283); g.fill(); }
      } else if (d[0] === 'bones') {
        g.fillStyle = '#cfc6b0'; g.fillRect(x + 2, y + 9, 10, 2); g.fillRect(x + 6, y + 4, 2, 9); g.fillRect(x + 10, y + 3, 5, 4); g.fillStyle = '#222'; g.fillRect(x + 11, y + 4, 1, 1); g.fillRect(x + 13, y + 4, 1, 1);
      } else if (d[0] === 'web') {
        g.strokeStyle = 'rgba(220,220,230,0.35)'; g.lineWidth = 0.6;
        for (i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(i * 0.4) * 16, y + Math.sin(i * 0.4) * 16); g.stroke(); }
        for (i = 1; i < 4; i++) { g.beginPath(); g.arc(x, y, i * 4, 0, Math.PI / 2); g.stroke(); }
      } else if (d[0] === 'puddle') {
        g.fillStyle = 'rgba(60,70,110,0.55)'; g.beginPath(); g.ellipse(x + 8, y + 8, 10, 5, 0, 0, 6.283); g.fill();
      } else if (d[0] === 'coalpile') {
        g.fillStyle = '#141418'; g.beginPath(); g.ellipse(x + 8, y + 10, 12, 6, 0, 0, 6.283); g.fill(); g.fillStyle = '#3a3a44'; g.fillRect(x + 4, y + 8, 2, 1);
      }
    });
    WALLDECO.forEach(function (d) {
      var x = d[1] * T, y = d[2] * T;
      if (d[0] === 'torch') { g.fillStyle = '#3a2414'; g.fillRect(x + 7, y + 7, 2, 7); g.fillStyle = '#6a6a6a'; g.fillRect(x + 5, y + 6, 6, 2); }
      else if (d[0] === 'banner') { g.fillStyle = '#6e0a10'; g.fillRect(x + 3, y + 2, 10, 14); g.fillStyle = '#d4b040'; g.fillRect(x + 6, y + 6, 4, 4); g.fillRect(x + 3, y + 2, 10, 1); }
      else if (d[0] === 'window') { g.fillStyle = '#1a2440'; g.fillRect(x + 3, y + 3, 10, 12); g.fillStyle = '#5a6a90'; g.fillRect(x + 7, y + 3, 1, 12); g.fillRect(x + 3, y + 8, 10, 1); }
      else if (d[0] === 'fireplace' || d[0] === 'furnace') {
        g.fillStyle = '#2a2430'; g.fillRect(x, y + 2, 32, 14); g.fillStyle = '#0a0606'; g.fillRect(x + 5, y + 6, 22, 10);
        g.fillStyle = d[0] === 'furnace' ? '#5a3a2a' : '#4a3a3a'; g.fillRect(x, y + 2, 32, 3);
      }
    });
    return c;
  }

  RM.Castle = {
    T: T, W: MW, H: MH, PROP: PROP, ITEMS: ITEMS,
    build: build,
    renderStatic: renderStatic,
    buildPropSprite: buildPropSprite,
    roomAt: function (map, px, py) {
      var x = (px / T) | 0, y = (py / T) | 0;
      if (x < 0 || y < 0 || x >= MW || y >= MH) return null;
      var i = map.room[y * MW + x];
      return i >= 0 ? ROOMS[i] : null;
    }
  };
})(window.RM);
