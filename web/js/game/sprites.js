/* Red Main — pixel art del protagonista (generado por código) y de los objetos.
   Hoja del personaje: 3 modos (caminar, correr, agachado) × 4 direcciones × 4 cuadros,
   cada cuadro de 24×32 píxeles. Vista 2D desde arriba con 4 direcciones. */
(function (RM) {
  'use strict';
  var FW = 24, FH = 32;
  var DIRS = ['down', 'left', 'right', 'up'];
  var MODES = ['walk', 'run', 'crouch'];

  var C = {
    skin: '#e2b48c', skinD: '#bf8c66', hair: '#4e321e', beard: '#5e3c22', beardD: '#43291a',
    shirt: '#4f6b3a', shirtD: '#3a5129', shirtL: '#67874d', pants: '#34466a', pantsD: '#26334f',
    shoe: '#241a14', glass: '#121212', lens: '#a9c2d4', belt: '#2b1f16', outline: '#140d0b'
  };

  // Dibuja un cuadro del protagonista. phase ∈ {-1,0,1}: pierna adelantada.
  function drawMan(g, dir, mode, phase) {
    var r = function (x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); };
    var crouch = mode === 'crouch', run = mode === 'run';
    var stride = crouch ? 1 : run ? 2 : 1;
    var bob = phase !== 0 && !crouch ? (run ? 2 : 1) : 0;
    var legLen = crouch ? 2 : 5, torsoH = crouch ? 8 : 10;
    var shoeY = 29;
    var legTop = shoeY - legLen;
    var torsoTop = legTop + 1 - torsoH - bob;
    var headTop = torsoTop - 11;
    var arm = run ? phase * 3 : phase * (crouch ? 0 : 1);
    var lean = run && dir === 'left' ? -1 : 0;

    if (dir === 'down' || dir === 'up') {
      var lL = phase * stride, lR = -phase * stride;
      var back = dir === 'up';
      // Piernas: la que avanza "baja" un píxel, la otra se levanta.
      if (crouch) {
        r(5, legTop - 2, 6, 4, C.pants); r(13, legTop - 2, 6, 4, C.pants);
        r(4, shoeY + Math.min(0, lL), 6, 2, C.shoe); r(14, shoeY + Math.min(0, lR), 6, 2, C.shoe);
      } else {
        r(8, legTop, 4, legLen + Math.max(0, lL) - Math.max(0, -lL), back ? C.pantsD : C.pants);
        r(12, legTop, 4, legLen + Math.max(0, lR) - Math.max(0, -lR), back ? C.pantsD : C.pants);
        r(7, shoeY + lL - Math.max(0, -lL) * 0, 5, 2, C.shoe);
        r(12, shoeY + lR, 5, 2, C.shoe);
      }
      // Torso con panza.
      r(5, torsoTop, 14, torsoH, C.shirt);
      r(4, torsoTop + 3, 16, torsoH - 4, C.shirt);
      r(4, torsoTop + 3, 2, torsoH - 4, C.shirtD); r(18, torsoTop + 3, 2, torsoH - 4, C.shirtD);
      if (!back) { r(8, torsoTop + 1, 8, 1, C.shirtL); r(10, torsoTop, 4, 1, C.skinD); }
      r(5, torsoTop + torsoH - 1, 14, 1, C.belt);
      // Brazos (balanceo opuesto a las piernas).
      var aL = back ? -arm : arm, aR = -aL;
      r(2, torsoTop + 1, 3, 4, C.shirtD); r(19, torsoTop + 1, 3, 4, C.shirtD);
      r(2, torsoTop + 5 + aL, 3, crouch ? 3 : 4, C.skin); r(19, torsoTop + 5 + aR, 3, crouch ? 3 : 4, C.skin);
      r(2, torsoTop + (crouch ? 8 : 9) + aL, 3, 2, C.skinD); r(19, torsoTop + (crouch ? 8 : 9) + aR, 3, 2, C.skinD);
      // Cabeza.
      if (back) {
        r(8, headTop + 2, 8, 9, C.hair);
        r(7, headTop + 3, 1, 5, C.hair); r(16, headTop + 3, 1, 5, C.hair);
        r(7, headTop + 8, 1, 4, C.beard); r(16, headTop + 8, 1, 4, C.beard);
        r(9, headTop + 11, 6, 1, C.skinD);
        r(7, headTop + 5, 1, 2, C.skinD); r(16, headTop + 5, 1, 2, C.skinD);
      } else {
        r(8, headTop + 2, 8, 9, C.skin);
        r(7, headTop + 5, 1, 2, C.skinD); r(16, headTop + 5, 1, 2, C.skinD);
        r(8, headTop + 1, 8, 2, C.hair); r(7, headTop + 2, 1, 3, C.hair); r(16, headTop + 2, 1, 3, C.hair);
        r(9, headTop, 6, 1, C.hair);
        // Lentes.
        r(8, headTop + 5, 3, 2, C.glass); r(13, headTop + 5, 3, 2, C.glass); r(11, headTop + 5, 2, 1, C.glass);
        r(9, headTop + 5, 1, 1, C.lens); r(14, headTop + 5, 1, 1, C.lens);
        // Barba tupida.
        r(7, headTop + 7, 10, 4, C.beard); r(8, headTop + 11, 8, 2, C.beard); r(9, headTop + 13, 6, 1, C.beardD);
        r(9, headTop + 8, 6, 1, C.beardD); r(10, headTop + 9, 4, 1, '#7a3a2a');
        r(11, headTop + 7, 2, 1, C.skinD);
      }
    } else {
      // Perfil (izquierda); la derecha se obtiene espejando.
      var s = phase * stride * (run ? 1.5 : 1.5) | 0;
      if (crouch) {
        r(6, legTop - 2, 9, 3, C.pants); r(12, legTop - 1, 4, 3, C.pantsD);
        r(5, shoeY, 6, 2, C.shoe); r(12, shoeY, 5, 2, C.shoe);
      } else {
        r(10 - s, legTop, 4, legLen, C.pantsD);
        r(10 + s, legTop, 4, legLen, C.pants);
        r(9 - s, shoeY, 5, 2, C.shoe);
        r(9 + s, shoeY, 5, 2, C.shoe);
      }
      var x0 = 7 + lean;
      r(x0, torsoTop, 10, torsoH, C.shirt);
      r(x0 - 2, torsoTop + 3, 3, torsoH - 4, C.shirt);
      r(x0 + 8, torsoTop, 2, torsoH, C.shirtD);
      r(x0, torsoTop + torsoH - 1, 10, 1, C.belt);
      // Brazo cercano.
      r(x0 + 3 - arm, torsoTop + 1, 4, 4, C.shirtD);
      r(x0 + 3 - arm * 2, torsoTop + 5, 3, crouch ? 3 : 4, C.skin);
      r(x0 + 3 - arm * 2, torsoTop + (crouch ? 8 : 9), 3, 2, C.skinD);
      // Cabeza de perfil.
      var hx = 7 + lean;
      r(hx, headTop + 2, 8, 9, C.skin);
      r(hx - 1, headTop + 6, 1, 2, C.skinD);
      r(hx + 1, headTop + 1, 7, 2, C.hair); r(hx + 5, headTop + 2, 3, 3, C.hair); r(hx + 2, headTop, 5, 1, C.hair);
      r(hx + 5, headTop + 5, 1, 2, C.skinD);
      r(hx, headTop + 5, 3, 2, C.glass); r(hx + 1, headTop + 5, 1, 1, C.lens); r(hx + 3, headTop + 5, 2, 1, C.glass);
      r(hx - 1, headTop + 8, 6, 4, C.beard); r(hx, headTop + 12, 5, 2, C.beard); r(hx + 5, headTop + 7, 2, 4, C.beard);
      r(hx - 1, headTop + 8, 3, 1, C.beardD);
    }
  }

  // Contorno oscuro de 1 píxel alrededor de lo dibujado (look pixel art).
  function outline(c) {
    var g = c.getContext('2d');
    var img = g.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width, h = c.height;
    var src = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var k = y * w + x;
      if (src[k]) continue;
      if ((x > 0 && src[k - 1]) || (x < w - 1 && src[k + 1]) || (y > 0 && src[k - w]) || (y < h - 1 && src[k + w])) {
        d[k * 4] = 20; d[k * 4 + 1] = 13; d[k * 4 + 2] = 11; d[k * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  var PHASES = [0, 1, 0, -1];

  // Genera la hoja completa: filas = modo*4 + dirección, columnas = cuadro.
  function buildHero() {
    var c = RM.canvas(FW * 4, FH * 12), g = c.getContext('2d');
    for (var m = 0; m < MODES.length; m++) {
      for (var d = 0; d < DIRS.length; d++) {
        for (var f = 0; f < 4; f++) {
          g.save();
          var x = f * FW, y = (m * 4 + d) * FH;
          g.beginPath(); g.rect(x, y, FW, FH); g.clip();
          if (DIRS[d] === 'right') { g.translate(x + FW, y); g.scale(-1, 1); drawMan(g, 'left', MODES[m], PHASES[f]); }
          else { g.translate(x, y); drawMan(g, DIRS[d], MODES[m], PHASES[f]); }
          g.restore();
        }
      }
    }
    outline(c);
    return { canvas: c, fw: FW, fh: FH, dirs: DIRS, modes: MODES };
  }

  /* ---------- Objetos (íconos de 16×16) ---------- */

  function icon(draw) {
    var c = RM.canvas(16, 16), g = c.getContext('2d');
    draw(function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); });
    outline(c);
    return c;
  }

  var ICONS = {
    hammer: function (r) {
      r(7, 6, 2, 9, '#7a4a26'); r(7, 6, 1, 9, '#9a6436');
      r(3, 2, 10, 4, '#8a8f99'); r(3, 2, 10, 1, '#c2c7cf'); r(11, 3, 3, 2, '#6a6f78');
    },
    ingot: function (r) {
      r(2, 7, 12, 5, '#7c838e'); r(3, 6, 10, 2, '#a9b0ba'); r(4, 5, 8, 1, '#cfd5dd'); r(2, 11, 12, 1, '#535963');
      r(5, 8, 4, 1, '#dfe4ea');
    },
    nails: function (r) {
      for (var i = 0; i < 3; i++) { var x = 3 + i * 4; r(x, 3 + i, 3, 1, '#c9ced6'); r(x + 1, 4 + i, 1, 8, '#9aa0a9'); r(x + 1, 12 + i, 1, 1, '#6a6f78'); }
    },
    coal: function (r) {
      r(3, 7, 10, 6, '#1e1e22'); r(4, 5, 7, 3, '#2a2a30'); r(5, 6, 2, 1, '#55555f'); r(9, 9, 2, 1, '#55555f'); r(6, 11, 3, 1, '#ff5a1f');
    },
    horseshoe: function (r) {
      r(3, 3, 3, 10, '#b8bec7'); r(10, 3, 3, 10, '#b8bec7'); r(5, 11, 6, 3, '#b8bec7');
      r(3, 3, 1, 10, '#e8ecf0'); r(4, 13, 7, 1, '#7a808a'); r(4, 5, 1, 1, '#333'); r(4, 8, 1, 1, '#333'); r(11, 5, 1, 1, '#333'); r(11, 8, 1, 1, '#333');
    },
    note: function (r) {
      r(3, 2, 10, 12, '#d8ccaa'); r(3, 2, 10, 1, '#efe4c4'); r(12, 2, 1, 12, '#b0a37e');
      for (var i = 0; i < 4; i++) r(5, 5 + i * 2, 6, 1, '#6a5a3a');
      r(9, 11, 3, 2, '#8a0b0b');
    }
  };

  RM.Sprites = {
    buildHero: buildHero,
    buildIcons: function () {
      var out = {};
      Object.keys(ICONS).forEach(function (k) { out[k] = icon(ICONS[k]); });
      return out;
    },
    outline: outline
  };
})(window.RM);
