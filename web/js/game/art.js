/* Red Main — arte vectorial del castillo: pisos, muros, muebles y objetos.
   Todo se dibuja con curvas y degradés (sin píxeles) y se pre-renderiza a la
   resolución de la pantalla. Unidad del mundo: 1 tile = 32. */
(function (RM) {
  'use strict';
  var T = 32;
  var OUT = 'rgba(22,14,12,0.9)';
  var TILE = { WALL: 0, STONE: 1, WOOD: 2, CARPET: 3, GRASS: 4, CRYPT: 5, OUT: 6, DIRT: 7, CHECK: 8 };

  function seeded(seed) {
    var s = (seed * 9301 + 49297) % 233280 || 1;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  /* ---------- Ayudas de dibujo ---------- */

  function rrPath(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function box(g, x, y, w, h, r, fill, lw) {
    rrPath(g, x, y, w, h, r); g.fillStyle = fill; g.fill();
    if (lw !== 0) { g.lineWidth = lw || 1.5; g.strokeStyle = OUT; g.stroke(); }
  }
  function ell(g, x, y, rx, ry, fill, lw) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fillStyle = fill; g.fill();
    if (lw !== 0) { g.lineWidth = lw || 1.5; g.strokeStyle = OUT; g.stroke(); }
  }
  function lin(g, x1, y1, x2, c1, c2) { var gr = g.createLinearGradient(x1, y1, x2, y1); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr; }
  function vlin(g, y1, y2, c1, c2) { var gr = g.createLinearGradient(0, y1, 0, y2); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr; }
  function flame(g, x, y, s) {
    var gr = g.createRadialGradient(x, y - s, 0, x, y - s, s * 1.4);
    gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.4, '#ffb23a'); gr.addColorStop(1, 'rgba(255,80,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - s * 0.6, y); g.quadraticCurveTo(x - s * 0.7, y - s, x, y - s * 2.2); g.quadraticCurveTo(x + s * 0.7, y - s, x + s * 0.6, y); g.closePath(); g.fill();
  }

  /* ---------- Pisos y muros ---------- */

  function floor(g, type, v) {
    var r = seeded(type * 31 + v * 7 + 3), i;
    if (type === TILE.STONE || type === TILE.CRYPT) {
      var cols = type === TILE.CRYPT ? ['#26232e', '#211e29', '#2b2734'] : ['#46424f', '#403c49', '#4b4655'];
      g.fillStyle = '#2a2731'; g.fillRect(0, 0, T, T);
      [[0, 0, 16, 16], [16, 0, 16, 16], [0, 16, 16, 16], [16, 16, 16, 16]].forEach(function (q, k) {
        rrPath(g, q[0] + 0.8, q[1] + 0.8, q[2] - 1.6, q[3] - 1.6, 2.5);
        g.fillStyle = vlin(g, q[1], q[1] + 16, cols[(k + v) % 3], cols[(k + v + 1) % 3]); g.fill();
      });
      if (r() > 0.45) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.7; g.beginPath(); var cx = 4 + r() * 22, cy = 4 + r() * 22; g.moveTo(cx, cy); g.lineTo(cx + 4, cy + 3); g.lineTo(cx + 5, cy + 7); g.stroke(); }
      if (type === TILE.STONE && r() > 0.7) { g.fillStyle = 'rgba(70,110,60,0.35)'; g.beginPath(); g.ellipse(r() * 30, r() * 30, 3, 2, 0, 0, 6.283); g.fill(); }
    } else if (type === TILE.WOOD) {
      for (i = 0; i < 4; i++) {
        var y = i * 8;
        g.fillStyle = vlin(g, y, y + 8, ['#5a3a24', '#54361f', '#5e3e28', '#50331e'][(i + v) % 4], '#43291a'); g.fillRect(0, y, T, 8);
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y + 7.3, T, 0.8);
        g.fillRect(((i * 13 + v * 7) % 28) + 2, y, 0.8, 8);
        g.strokeStyle = 'rgba(30,18,10,0.35)'; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(0, y + 3 + r() * 2); g.bezierCurveTo(10, y + 2, 20, y + 5, 32, y + 3 + r() * 2); g.stroke();
      }
    } else if (type === TILE.CARPET) {
      g.fillStyle = vlin(g, 0, T, '#6e0f18', '#5a0a12'); g.fillRect(0, 0, T, T);
      g.strokeStyle = 'rgba(200,150,60,0.22)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(16, 6); g.lineTo(26, 16); g.lineTo(16, 26); g.lineTo(6, 16); g.closePath(); g.stroke();
    } else if (type === TILE.GRASS || type === TILE.OUT) {
      g.fillStyle = type === TILE.OUT ? '#1b2a1e' : '#22331f'; g.fillRect(0, 0, T, T);
      g.lineCap = 'round';
      for (i = 0; i < 16; i++) {
        var x = r() * T, yy = r() * T;
        g.strokeStyle = r() > 0.5 ? '#2f4a2a' : '#17251a'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + 1, yy - 2, x + (r() - 0.5) * 3, yy - 4); g.stroke();
      }
    } else if (type === TILE.DIRT) {
      g.fillStyle = '#4a3a26'; g.fillRect(0, 0, T, T);
      g.strokeStyle = '#a8883a'; g.lineWidth = 0.8;
      for (i = 0; i < 9; i++) { var hx = r() * T, hy = r() * T, a = r() * 3; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(a) * 6, hy + Math.sin(a) * 6); g.stroke(); }
    } else if (type === TILE.CHECK) {
      g.fillStyle = '#3a3640'; g.fillRect(0, 0, T, T);
      g.fillStyle = '#5a5462'; g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 15.5, T, 1); g.fillRect(15.5, 0, 1, T);
    }
  }

  function wallFace(g, v) {
    g.fillStyle = '#1a1520'; g.fillRect(0, 0, T, T);
    var rows = 4, bh = (T - 4) / rows;
    for (var row = 0; row < rows; row++) {
      var y = 4 + row * bh, off = (row + v) % 2 ? 0 : -8;
      for (var x = off; x < T; x += 16) {
        rrPath(g, x + 0.6, y + 0.6, 15, bh - 1.2, 1.8);
        g.fillStyle = vlin(g, y, y + bh, ['#5a5262', '#544c5c', '#5e5666'][(row + x / 16 + v + 3) % 3 | 0], '#3e3846'); g.fill();
      }
    }
    g.fillStyle = vlin(g, 0, 5, '#6a6274', '#2a2430'); g.fillRect(0, 0, T, 4);
    if (v === 2) { g.fillStyle = 'rgba(60,110,55,0.5)'; g.beginPath(); g.ellipse(9, 24, 4, 2.5, 0, 0, 6.283); g.fill(); }
  }

  function wallTop(g) {
    g.fillStyle = vlin(g, 0, T, '#1c1722', '#16121b'); g.fillRect(0, 0, T, T);
    g.fillStyle = 'rgba(255,255,255,0.02)'; g.fillRect(4, 4, 24, 24);
  }

  /* ---------- Muebles (unidades del mundo; base abajo al centro de la huella) ---------- */

  var PROP = {
    shelf: { fp: [1, 1], h: 58, draw: function (g) {
      box(g, 1, 0, 30, 58, 2, lin(g, 1, 0, 31, '#4a2e1a', '#2e1c10'));
      var r = seeded(5);
      for (var s = 0; s < 4; s++) {
        var y = 5 + s * 13;
        g.fillStyle = '#1c110a'; g.fillRect(4, y, 24, 10);
        var x = 5;
        while (x < 26) {
          var w = 2.5 + r() * 2.5, h = 7 + r() * 3;
          g.fillStyle = ['#7a1a1a', '#1a4a6a', '#6a5a1a', '#4a1a5a', '#1a5a3a', '#8a6a3a'][(r() * 6) | 0];
          rrPath(g, x, y + 10 - h, w, h, 0.8); g.fill();
          x += w + 0.5;
        }
        g.fillStyle = '#5a3a22'; g.fillRect(3, y + 10, 26, 2);
      }
    } },
    pillar: { fp: [1, 1], h: 72, draw: function (g) {
      box(g, 2, 0, 28, 8, 2, '#6a6476');
      box(g, 6, 7, 20, 56, 1, lin(g, 6, 0, 26, '#6e687a', '#3a3446'));
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
      [11, 16, 21].forEach(function (x) { g.beginPath(); g.moveTo(x, 9); g.lineTo(x, 62); g.stroke(); });
      box(g, 2, 62, 28, 10, 2, '#5a5466');
    } },
    table: { fp: [2, 1], h: 38, draw: function (g) {
      box(g, 4, 18, 5, 20, 1, '#3a2414'); box(g, 55, 18, 5, 20, 1, '#3a2414');
      box(g, 0, 4, 64, 18, 4, vlin(g, 4, 22, '#7a5232', '#4e321e'));
      box(g, 12, 6, 12, 9, 1, '#ddd0ac', 1); box(g, 40, 3, 5, 9, 1, '#e8e0c8', 1); flame(g, 42.5, 4, 2.5);
    } },
    bigtable: { fp: [4, 1], h: 38, draw: function (g) {
      [6, 60, 114].forEach(function (x) { box(g, x, 18, 6, 20, 1, '#3a2414'); });
      box(g, 0, 4, 128, 18, 4, vlin(g, 4, 22, '#7a5232', '#4e321e'));
      ell(g, 22, 12, 9, 5, '#a8a8b0'); ell(g, 22, 11, 6, 3, '#8a2020', 1);
      ell(g, 60, 12, 10, 5, '#c9a86a'); box(g, 92, 6, 4, 10, 1, '#c8c0a8'); box(g, 104, 7, 10, 6, 2, '#6a1010');
    } },
    chair: { fp: [1, 1], h: 34, solid: false, draw: function (g) {
      box(g, 7, 0, 18, 16, 3, '#5a3a22'); box(g, 6, 14, 20, 8, 2, '#6a4428'); box(g, 7, 22, 3, 12, 1, '#3a2414'); box(g, 22, 22, 3, 12, 1, '#3a2414');
    } },
    throne: { fp: [2, 1], h: 70, draw: function (g) {
      box(g, 8, 0, 48, 46, 8, vlin(g, 0, 46, '#a88a22', '#6e5a12'));
      box(g, 14, 6, 36, 38, 6, vlin(g, 6, 44, '#9a1820', '#5a0a10'));
      box(g, 2, 38, 60, 16, 4, '#7e6818'); box(g, 6, 54, 8, 16, 2, '#5a480e'); box(g, 50, 54, 8, 16, 2, '#5a480e');
      ell(g, 32, 4, 5, 5, '#ffd84a'); ell(g, 12, 6, 4, 4, '#ffd84a'); ell(g, 52, 6, 4, 4, '#ffd84a');
    } },
    candle: { fp: [1, 1], h: 52, light: 90, flameAt: [[9, 7], [16, 4], [23, 7]], draw: function (g) {
      box(g, 14.5, 14, 3, 30, 1, '#a89040'); box(g, 6, 44, 20, 8, 3, '#7a6a2a');
      g.strokeStyle = OUT; g.lineWidth = 3.2; g.beginPath(); g.moveTo(9, 15); g.quadraticCurveTo(16, 22, 23, 15); g.stroke();
      g.strokeStyle = '#a89040'; g.lineWidth = 2; g.stroke();
      [9, 16, 23].forEach(function (x, i) { box(g, x - 2, (i === 1 ? 4 : 7), 4, 9, 1, '#efe6cc', 1); });
    } },
    statue: { fp: [1, 1], h: 64, draw: function (g) {
      box(g, 3, 52, 26, 12, 2, '#55505e');
      g.beginPath(); g.moveTo(9, 52); g.quadraticCurveTo(6, 30, 11, 16); g.lineTo(21, 16); g.quadraticCurveTo(26, 30, 23, 52); g.closePath();
      g.fillStyle = lin(g, 6, 0, 26, '#a49eae', '#6a6474'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      ell(g, 16, 10, 6, 7, '#a49eae'); g.fillStyle = '#3a0000'; g.fillRect(13, 9, 2, 1.5); g.fillRect(17, 9, 2, 1.5);
      g.fillStyle = 'rgba(120,0,0,0.6)'; g.fillRect(13.5, 10.5, 1, 5); g.fillRect(17.5, 10.5, 1, 4);
    } },
    armor: { fp: [1, 1], h: 62, draw: function (g) {
      box(g, 5, 54, 22, 8, 2, '#3a3440');
      box(g, 9, 34, 5, 21, 2, '#8a909a'); box(g, 18, 34, 5, 21, 2, '#8a909a');
      box(g, 7, 14, 18, 22, 5, lin(g, 7, 0, 25, '#c2c8d2', '#6a707a'));
      box(g, 2, 16, 6, 18, 3, '#9aa0aa'); box(g, 24, 16, 6, 18, 3, '#9aa0aa');
      ell(g, 16, 8, 7, 8, '#b0b6c0'); g.fillStyle = '#0a0a0a'; g.fillRect(11, 7, 10, 2);
      g.strokeStyle = '#c8c8c8'; g.lineWidth = 2; g.beginPath(); g.moveTo(29, 2); g.lineTo(29, 50); g.stroke();
    } },
    pew: { fp: [3, 1], h: 30, draw: function (g) {
      box(g, 0, 0, 96, 12, 3, vlin(g, 0, 12, '#6a4428', '#4a2e1a'));
      box(g, 0, 11, 96, 9, 2, '#5a3a22');
      [4, 46, 88].forEach(function (x) { box(g, x, 20, 4, 10, 1, '#3a2414'); });
    } },
    altar: { fp: [2, 1], h: 46, draw: function (g) {
      box(g, 0, 16, 64, 30, 3, vlin(g, 16, 46, '#8a8494', '#55505e'));
      box(g, 3, 8, 58, 12, 2, '#efe8d8');
      box(g, 30, 0, 4, 20, 1, '#e0b840'); box(g, 25, 4, 14, 4, 1, '#e0b840');
      g.fillStyle = 'rgba(110,0,0,0.7)'; g.beginPath(); g.moveTo(10, 20); g.quadraticCurveTo(14, 32, 12, 40); g.lineTo(16, 20); g.fill();
    } },
    barrel: { fp: [1, 1], h: 36, draw: function (g) {
      g.beginPath(); g.moveTo(5, 2); g.quadraticCurveTo(0, 18, 5, 34); g.lineTo(27, 34); g.quadraticCurveTo(32, 18, 27, 2); g.closePath();
      g.fillStyle = lin(g, 2, 0, 30, '#7a5030', '#4a2e1a'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = '#3a3a3e'; g.lineWidth = 2;
      [8, 26].forEach(function (y) { g.beginPath(); g.moveTo(2.5, y); g.lineTo(29.5, y); g.stroke(); });
      ell(g, 16, 3, 11, 3, '#5a3a22', 1.2);
    } },
    crate: { fp: [1, 1], h: 34, draw: function (g) {
      box(g, 2, 4, 28, 30, 2, vlin(g, 4, 34, '#9a7a4a', '#6a4e2a'));
      g.strokeStyle = '#4a3418'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, 6); g.lineTo(28, 32); g.moveTo(28, 6); g.lineTo(4, 32); g.stroke();
      g.strokeRect(4, 6, 24, 26);
    } },
    well: { fp: [2, 2], h: 80, draw: function (g) {
      box(g, 6, 2, 4, 44, 1, '#4a2e1a'); box(g, 54, 2, 4, 44, 1, '#4a2e1a');
      g.beginPath(); g.moveTo(0, 8); g.lineTo(32, -4); g.lineTo(64, 8); g.closePath(); g.fillStyle = '#5a3a22'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = '#999'; g.lineWidth = 1; g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 34); g.stroke(); box(g, 27, 30, 10, 9, 2, '#6a4428');
      ell(g, 32, 56, 31, 14, '#6a6474'); ell(g, 32, 54, 25, 9, '#08080e', 1);
      box(g, 1, 56, 62, 22, 6, vlin(g, 56, 78, '#6a6474', '#45404e'));
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; for (var i = 1; i < 5; i++) { g.beginPath(); g.moveTo(i * 13, 58); g.lineTo(i * 13, 76); g.stroke(); }
    } },
    fountain: { fp: [2, 2], h: 64, draw: function (g) {
      ell(g, 32, 48, 31, 15, '#6a6474'); ell(g, 32, 47, 26, 11, '#2a3a5a', 1);
      g.fillStyle = 'rgba(160,190,230,0.3)'; g.beginPath(); g.ellipse(28, 45, 12, 4, 0, 0, 6.283); g.fill();
      box(g, 28, 16, 8, 30, 2, '#8a8494'); ell(g, 32, 16, 12, 5, '#8a8494');
      ell(g, 32, 8, 5, 6, '#a49eae');
    } },
    tree: { fp: [1, 1], h: 120, wide: 96, draw: function (g) {
      g.strokeStyle = '#241812'; g.lineCap = 'round';
      var br = function (x, y, len, ang, w, d) {
        var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (d % 2 ? 4 : -4), (y + y2) / 2, x2, y2); g.stroke();
        if (d <= 0) return;
        br(x2, y2, len * 0.72, ang - 0.45, w * 0.62, d - 1);
        br(x2, y2, len * 0.72, ang + 0.4, w * 0.62, d - 1);
      };
      br(48, 120, 42, -Math.PI / 2, 11, 5);
      g.fillStyle = '#241812'; g.beginPath(); g.ellipse(48, 118, 12, 4, 0, 0, 6.283); g.fill();
    } },
    bed: { fp: [2, 2], h: 70, draw: function (g) {
      box(g, 0, 0, 64, 18, 4, vlin(g, 0, 18, '#5a3a22', '#3a2416'));
      box(g, 2, 14, 60, 50, 3, '#5a3a22');
      box(g, 5, 16, 54, 46, 3, '#dcd8e2', 1);
      box(g, 9, 19, 20, 11, 5, '#f4f2f6', 1); box(g, 35, 19, 20, 11, 5, '#f4f2f6', 1);
      box(g, 5, 34, 54, 28, 3, vlin(g, 34, 62, '#a82838', '#6a1424'), 1);
      box(g, 2, 62, 6, 8, 1, '#3a2416'); box(g, 56, 62, 6, 8, 1, '#3a2416');
    } },
    cot: { fp: [1, 2], h: 66, draw: function (g) {
      box(g, 2, 0, 28, 64, 3, '#4a2e1a'); box(g, 4, 2, 24, 60, 3, '#b8b0a0', 1); box(g, 6, 4, 20, 10, 4, '#e0dcd0', 1);
      box(g, 4, 26, 24, 36, 3, '#5a5a3a', 1);
    } },
    wardrobe: { fp: [2, 1], h: 66, draw: function (g) {
      box(g, 0, 0, 64, 66, 3, lin(g, 0, 0, 64, '#5a3a22', '#3a2416'));
      box(g, 4, 6, 26, 56, 2, '#4a2e1a'); box(g, 34, 6, 26, 56, 2, '#4a2e1a');
      ell(g, 28, 34, 1.8, 1.8, '#d8b060', 1); ell(g, 36, 34, 1.8, 1.8, '#d8b060', 1);
    } },
    mirror: { fp: [1, 1], h: 60, draw: function (g) {
      box(g, 2, 0, 28, 52, 12, vlin(g, 0, 52, '#c8a032', '#7a5a12'));
      box(g, 6, 4, 20, 44, 9, vlin(g, 4, 48, '#a8c0d0', '#5a7080'), 1);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(10, 10); g.lineTo(14, 10); g.lineTo(10, 30); g.closePath(); g.fill();
      box(g, 10, 52, 12, 8, 2, '#6a4a10');
    } },
    rocker: { fp: [1, 1], h: 40, draw: function (g) {
      box(g, 6, 0, 20, 20, 4, '#5a3a22'); box(g, 5, 18, 22, 8, 2, '#6a4428');
      g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath(); g.arc(16, 18, 18, 0.5, Math.PI - 0.5); g.stroke();
      g.strokeStyle = '#3a2414'; g.lineWidth = 2.5; g.stroke();
    } },
    coffin: { fp: [1, 2], h: 68, draw: function (g) {
      g.beginPath(); g.moveTo(10, 2); g.lineTo(22, 2); g.lineTo(30, 18); g.lineTo(24, 66); g.lineTo(8, 66); g.lineTo(2, 18); g.closePath();
      g.fillStyle = lin(g, 2, 0, 30, '#5a3a22', '#2e1c10'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#b8a878'; g.fillRect(14.5, 14, 3, 26); g.fillRect(9, 20, 14, 3);
    } },
    cage: { fp: [1, 1], h: 56, draw: function (g) {
      ell(g, 16, 52, 14, 4, '#3a3a40');
      ell(g, 16, 14, 8, 6, '#d8d0c0'); g.fillStyle = '#111'; g.beginPath(); g.arc(13, 13, 1.8, 0, 6.283); g.arc(19, 13, 1.8, 0, 6.283); g.fill();
      g.strokeStyle = '#777'; g.lineWidth = 1.6;
      for (var i = 0; i < 6; i++) { var x = 4 + i * 4.8; g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 52); g.stroke(); }
      g.beginPath(); g.ellipse(16, 6, 13, 4, 0, 0, 6.283); g.stroke();
    } },
    cell: { fp: [1, 1], h: 64, draw: function (g) {
      g.strokeStyle = OUT; g.lineWidth = 4;
      for (var i = 0; i < 5; i++) { g.beginPath(); g.moveTo(3 + i * 6.5, 0); g.lineTo(3 + i * 6.5, 64); g.stroke(); }
      g.strokeStyle = '#6a6e78'; g.lineWidth = 2.4;
      for (var j = 0; j < 5; j++) { g.beginPath(); g.moveTo(3 + j * 6.5, 0); g.lineTo(3 + j * 6.5, 64); g.stroke(); }
      box(g, 0, 26, 32, 4, 1, '#5a5e68');
    } },
    anvil: { fp: [2, 1], h: 40, draw: function (g) {
      box(g, 14, 26, 36, 14, 3, '#3a2a1e');
      box(g, 22, 16, 20, 12, 2, '#3a3e46');
      g.beginPath(); g.moveTo(4, 6); g.lineTo(54, 6); g.lineTo(60, 2); g.lineTo(58, 16); g.lineTo(14, 16); g.quadraticCurveTo(6, 14, 4, 6); g.closePath();
      g.fillStyle = vlin(g, 2, 16, '#7a808a', '#3a3e46'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = 'rgba(255,120,40,0.6)'; g.fillRect(24, 7, 12, 2);
    } },
    grave: { fp: [1, 1], h: 40, draw: function (g) {
      g.beginPath(); g.moveTo(5, 40); g.lineTo(5, 12); g.quadraticCurveTo(16, -2, 27, 12); g.lineTo(27, 40); g.closePath();
      g.fillStyle = lin(g, 5, 0, 27, '#7a7686', '#4a4654'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#3a3644'; g.fillRect(14.5, 12, 3, 16); g.fillRect(10, 17, 12, 3);
      g.fillStyle = 'rgba(70,110,60,0.6)'; g.beginPath(); g.ellipse(9, 38, 6, 3, 0, 0, 6.283); g.fill();
    } },
    rack: { fp: [1, 1], h: 56, draw: function (g) {
      box(g, 2, 4, 28, 5, 1, '#5a3a22'); box(g, 3, 4, 4, 52, 1, '#4a2e1a'); box(g, 25, 4, 4, 52, 1, '#4a2e1a');
      g.strokeStyle = '#c8ccd4'; g.lineWidth = 2;
      [11, 16, 21].forEach(function (x) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 48); g.stroke(); });
      g.fillStyle = '#8a8e96'; g.beginPath(); g.moveTo(8, 6); g.lineTo(14, 2); g.lineTo(14, 10); g.fill();
    } },
    shield: { fp: [1, 1], h: 40, draw: function (g) {
      g.beginPath(); g.moveTo(4, 4); g.lineTo(28, 4); g.lineTo(28, 20); g.quadraticCurveTo(16, 38, 4, 20); g.closePath();
      g.fillStyle = lin(g, 4, 0, 28, '#8a1c22', '#4a0a10'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#d8b040'; g.fillRect(14.5, 8, 3, 18); g.fillRect(9, 12, 14, 3);
    } },
    hay: { fp: [1, 1], h: 30, draw: function (g) {
      box(g, 1, 6, 30, 24, 4, vlin(g, 6, 30, '#d8b858', '#a8883a'));
      g.strokeStyle = 'rgba(120,90,30,0.7)'; g.lineWidth = 0.8;
      for (var i = 0; i < 8; i++) { g.beginPath(); g.moveTo(3 + i * 3.5, 8); g.lineTo(5 + i * 3.5, 28); g.stroke(); }
      g.strokeStyle = '#6a4a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(1, 14); g.lineTo(31, 14); g.moveTo(1, 22); g.lineTo(31, 22); g.stroke();
    } },
    trough: { fp: [2, 1], h: 26, draw: function (g) {
      box(g, 2, 6, 60, 18, 4, '#5a3a22'); box(g, 6, 8, 52, 8, 3, '#2a3a5a', 1);
      box(g, 6, 22, 4, 4, 1, '#3a2414'); box(g, 54, 22, 4, 4, 1, '#3a2414');
    } },
    horse: { fp: [2, 1], h: 56, draw: function (g) {
      box(g, 10, 18, 40, 20, 10, lin(g, 10, 0, 50, '#6a4428', '#3a2414'));
      [14, 22, 38, 46].forEach(function (x) { box(g, x - 2, 34, 5, 22, 2, '#3a2414'); });
      g.beginPath(); g.moveTo(46, 22); g.lineTo(54, 4); g.lineTo(62, 6); g.lineTo(60, 14); g.lineTo(52, 28); g.closePath();
      g.fillStyle = '#5a3a22'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(46, 20); g.lineTo(53, 4); g.lineTo(50, 22); g.fill();
      g.fillStyle = '#ff2a1a'; g.beginPath(); g.arc(57, 8, 1.3, 0, 6.283); g.fill();
      g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(10, 22); g.quadraticCurveTo(2, 30, 6, 42); g.stroke();
    } },
    winerack: { fp: [2, 1], h: 56, draw: function (g) {
      box(g, 0, 0, 64, 56, 2, '#3a2416');
      for (var y = 0; y < 4; y++) for (var x = 0; x < 6; x++) { ell(g, 7 + x * 10, 8 + y * 13, 4, 4, '#1a0a0a', 0); ell(g, 7 + x * 10, 8 + y * 13, 2, 2, (x + y) % 3 ? '#4a0a14' : '#2a4a1a', 0); }
    } },
    telescope: { fp: [1, 1], h: 56, draw: function (g) {
      g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(16, 30); g.lineTo(6, 56); g.moveTo(16, 30); g.lineTo(26, 56); g.moveTo(16, 30); g.lineTo(16, 56); g.stroke();
      g.strokeStyle = '#6a4428'; g.lineWidth = 1.8; g.stroke();
      g.save(); g.translate(16, 28); g.rotate(-0.7); box(g, -4, -26, 8, 34, 3, lin(g, -4, 0, 4, '#d8b040', '#8a6a12')); g.restore();
    } },
    globe: { fp: [1, 1], h: 46, draw: function (g) {
      box(g, 13, 30, 6, 12, 1, '#5a3a22'); ell(g, 16, 44, 9, 3, '#4a2e1a');
      ell(g, 16, 18, 13, 13, '#2a5a8a'); g.fillStyle = '#4a8a3a';
      g.beginPath(); g.ellipse(12, 14, 5, 7, 0.4, 0, 6.283); g.ellipse(21, 22, 4, 3, 0, 0, 6.283); g.fill();
      g.strokeStyle = '#c8a032'; g.lineWidth = 1.5; g.beginPath(); g.arc(16, 18, 15, -2.4, 0.8); g.stroke();
    } },
    painting: { fp: [1, 1], h: 0, wall: true },
    target: { fp: [1, 1], h: 40, draw: function (g) {
      box(g, 14, 26, 4, 14, 1, '#4a2e1a');
      ell(g, 16, 16, 14, 14, '#e8e0c8'); ell(g, 16, 16, 10, 10, '#a82020', 1); ell(g, 16, 16, 6, 6, '#e8e0c8', 1); ell(g, 16, 16, 2.5, 2.5, '#a82020', 1);
    } },
    bookpile: { fp: [1, 1], h: 26, draw: function (g) {
      var cs = ['#7a1a1a', '#1a4a6a', '#6a5a1a', '#4a1a5a', '#2a5a3a'];
      for (var i = 0; i < 5; i++) {
        var y = 22 - i * 4.4, off = Math.sin(i * 2.3) * 3;
        box(g, 4 + off, y, 24 - (i % 2) * 3, 4.4, 1, vlin(g, y, y + 4.4, cs[i], '#1a1010'), 1);
        g.fillStyle = 'rgba(240,230,200,0.6)'; g.fillRect(26 + off - (i % 2) * 3, y + 1, 1.2, 2.4);
      }
    } },
    desk: { fp: [2, 1], h: 42, draw: function (g) {
      box(g, 2, 14, 60, 10, 2, vlin(g, 14, 24, '#6a4428', '#4a2e1a'));
      box(g, 4, 24, 16, 18, 1.5, '#3e2614'); box(g, 44, 24, 16, 18, 1.5, '#3e2614');
      ell(g, 12, 33, 1.5, 1.5, '#c8a040', 1); ell(g, 52, 33, 1.5, 1.5, '#c8a040', 1);
      box(g, 22, 9, 14, 6, 1, '#e8dcc0', 1); g.fillStyle = '#5a4a3a'; g.fillRect(24, 11, 10, 0.8); g.fillRect(24, 13, 7, 0.8);
      ell(g, 44, 10, 3.5, 4, '#1a1a2a', 1); g.strokeStyle = '#ddd'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(44, 7); g.lineTo(49, -1); g.stroke();
    } },
    clock: { fp: [1, 1], h: 78, draw: function (g) {
      box(g, 6, 4, 20, 74, 3, lin(g, 6, 0, 26, '#5a3a22', '#2e1c10'));
      box(g, 4, 2, 24, 8, 3, '#6a4428');
      ell(g, 16, 20, 8, 8, '#e8e0c8'); g.strokeStyle = '#1a1010'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(16, 20); g.lineTo(16, 14.5); g.moveTo(16, 20); g.lineTo(20, 22); g.stroke();
      box(g, 10, 32, 12, 34, 2, '#140c08', 1);
      g.strokeStyle = '#c8a040'; g.lineWidth = 1; g.beginPath(); g.moveTo(16, 33); g.lineTo(16, 56); g.stroke(); ell(g, 16, 58, 3.5, 3.5, '#d8b040', 1);
    } },
    vase: { fp: [1, 1], h: 38, draw: function (g) {
      g.beginPath(); g.moveTo(12, 6); g.quadraticCurveTo(10, 12, 7, 20); g.quadraticCurveTo(4, 34, 12, 37); g.lineTo(20, 37);
      g.quadraticCurveTo(28, 34, 25, 20); g.quadraticCurveTo(22, 12, 20, 6); g.closePath();
      g.fillStyle = lin(g, 5, 0, 27, '#4a6a8a', '#1a2a3a'); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = 'rgba(230,220,180,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(7, 22); g.quadraticCurveTo(16, 26, 25, 22); g.stroke();
      ell(g, 16, 6, 5, 1.8, '#2a3a4a', 1);
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(15, 6); g.quadraticCurveTo(10, -6, 6, -8); g.moveTo(17, 6); g.quadraticCurveTo(22, -4, 27, -6); g.stroke();
    } },
    plant: { fp: [1, 1], h: 46, draw: function (g) {
      box(g, 8, 30, 16, 16, 3, vlin(g, 30, 46, '#8a4a2a', '#5a2a14'));
      g.strokeStyle = '#3a2a18'; g.lineWidth = 1.6; g.lineCap = 'round';
      [[16, 30, 6, 4], [16, 30, 26, 8], [16, 30, 14, 2], [16, 30, 22, 14], [16, 30, 9, 16]].forEach(function (b) {
        g.beginPath(); g.moveTo(b[0], b[1]); g.quadraticCurveTo((b[0] + b[2]) / 2 + 3, (b[1] + b[3]) / 2, b[2], b[3]); g.stroke();
      });
      g.fillStyle = '#4a3a20'; [[6, 4], [26, 8], [22, 14]].forEach(function (q) { g.beginPath(); g.ellipse(q[0], q[1], 2.5, 1.2, 0.6, 0, 6.283); g.fill(); });
    } },
    sofa: { fp: [2, 1], h: 40, draw: function (g) {
      box(g, 2, 6, 60, 22, 8, vlin(g, 6, 28, '#6a1a2a', '#4a0e1a'));
      box(g, 0, 16, 10, 22, 4, '#5a1422'); box(g, 54, 16, 10, 22, 4, '#5a1422');
      box(g, 8, 22, 48, 14, 4, vlin(g, 22, 36, '#7a2232', '#5a1422'));
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(32, 23); g.lineTo(32, 35); g.stroke();
      [16, 32, 48].forEach(function (x) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x, 13, 1.2, 0, 6.283); g.fill(); });
    } },
    chest: { fp: [1, 1], h: 30, draw: function (g) {
      box(g, 3, 12, 26, 18, 2, vlin(g, 12, 30, '#6a4428', '#3e2614'));
      g.beginPath(); g.moveTo(3, 14); g.quadraticCurveTo(16, 2, 29, 14); g.closePath(); g.fillStyle = '#7a5030'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#8a8e98'; g.fillRect(7, 6, 2.4, 24); g.fillRect(22.6, 6, 2.4, 24);
      box(g, 13, 14, 6, 6, 1, '#d8b040', 1);
    } },
    cauldron: { fp: [1, 1], h: 40, light: 40, flameAt: [[10, 40], [16, 41], [22, 40]], draw: function (g) {
      g.strokeStyle = '#2a2a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, 40); g.lineTo(10, 26); g.moveTo(27, 40); g.lineTo(22, 26); g.stroke();
      g.beginPath(); g.moveTo(3, 18); g.quadraticCurveTo(2, 36, 16, 37); g.quadraticCurveTo(30, 36, 29, 18); g.closePath();
      g.fillStyle = vlin(g, 18, 37, '#3a3a40', '#141418'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      ell(g, 16, 18, 13, 4, '#1a1a1e'); ell(g, 16, 18.5, 10.5, 2.8, '#3a6a2a', 0);
      g.fillStyle = 'rgba(160,220,120,0.5)'; g.beginPath(); g.arc(12, 18, 1.6, 0, 6.283); g.arc(19, 19, 1, 0, 6.283); g.fill();
    } },
    skeleton: { fp: [1, 1], h: 22, solid: false, draw: function (g) {
      g.strokeStyle = '#d8d0bc'; g.lineCap = 'round'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(10, 12); g.lineTo(24, 14);
      for (var i = 0; i < 4; i++) { g.moveTo(13 + i * 3, 9); g.quadraticCurveTo(14 + i * 3, 13, 13 + i * 3, 17); }
      g.moveTo(24, 14); g.lineTo(30, 8); g.moveTo(24, 14); g.lineTo(31, 19); g.moveTo(12, 10); g.lineTo(8, 3); g.moveTo(12, 16); g.lineTo(9, 21); g.stroke();
      ell(g, 5, 12, 4.5, 4, '#e4dcc8', 1); g.fillStyle = '#222'; g.beginPath(); g.arc(4, 11, 1, 0, 6.283); g.arc(4, 14, 1, 0, 6.283); g.fill();
    } },
    piano: { fp: [2, 1], h: 56, draw: function (g) {
      box(g, 2, 2, 60, 40, 3, lin(g, 2, 0, 62, '#1a1416', '#0a0808'));
      box(g, 0, 34, 64, 10, 2, '#141012');
      g.fillStyle = '#e8e4da'; g.fillRect(4, 36, 56, 6);
      g.fillStyle = '#111'; for (var i = 0; i < 14; i++) if (i % 7 !== 2 && i % 7 !== 6) g.fillRect(7 + i * 4, 36, 2, 3.5);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(6, 6, 52, 3);
      box(g, 6, 44, 4, 12, 1, '#141012'); box(g, 54, 44, 4, 12, 1, '#141012');
      box(g, 24, 12, 16, 10, 1, '#e8dcc0', 1);
      g.fillStyle = '#3a2a1a'; for (var j = 0; j < 4; j++) g.fillRect(26, 14 + j * 2, 12, 0.6);
    } },
    bathtub: { fp: [2, 1], h: 34, draw: function (g) {
      box(g, 4, 30, 5, 4, 1, '#c8a040'); box(g, 55, 30, 5, 4, 1, '#c8a040');
      box(g, 2, 8, 60, 24, 11, vlin(g, 8, 32, '#e8e4dc', '#a8a49c'));
      box(g, 6, 10, 52, 12, 6, vlin(g, 10, 22, '#4a0a0e', '#2a0406'), 1);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(20, 13, 8, 1.5, 0, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(120,6,10,0.7)'; g.beginPath(); g.moveTo(40, 22); g.quadraticCurveTo(41, 28, 40, 32); g.lineTo(42, 32); g.quadraticCurveTo(43, 27, 43, 22); g.fill();
    } },
    mirror2: { fp: [1, 1], h: 58, draw: function (g) {
      box(g, 5, 2, 22, 46, 10, '#8a6a2a'); box(g, 8, 5, 16, 40, 8, vlin(g, 5, 45, '#7a8aa0', '#2a3040'), 1);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(12, 12); g.lineTo(20, 30); g.moveTo(20, 30); g.lineTo(14, 40); g.moveTo(20, 30); g.lineTo(23, 22); g.stroke();
      box(g, 12, 48, 8, 10, 1, '#5a3a1a');
    } },
    bush: { fp: [1, 1], h: 36, wide: 44, draw: function (g) {
      [[12, 26, 11], [30, 24, 12], [22, 16, 12], [20, 28, 10]].forEach(function (b, i) {
        g.beginPath(); g.arc(b[0], b[1], b[2], 0, 6.283);
        var gr = g.createRadialGradient(b[0] - 3, b[1] - 4, 1, b[0], b[1], b[2]);
        gr.addColorStop(0, ['#3a4a2a', '#34442a', '#425a30', '#2e3e24'][i]); gr.addColorStop(1, '#141c10');
        g.fillStyle = gr; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke();
      });
      g.strokeStyle = '#2a1e12'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(22, 10); g.lineTo(18, 2); g.moveTo(32, 16); g.lineTo(40, 9); g.stroke();
      g.fillStyle = '#7a0a10'; [[16, 20], [28, 18], [24, 30]].forEach(function (q) { g.beginPath(); g.arc(q[0], q[1], 1.3, 0, 6.283); g.fill(); });
    } }
  };

  // Objetos coleccionables e íconos del HUD (vectoriales, 32×32).
  var ICON = {
    bandage: function (g) {
      g.save(); g.translate(16, 17); g.rotate(-0.35);
      box(g, -12, -6, 24, 12, 6, vlin(g, -6, 6, '#f4f0e6', '#c8c0b0'));
      g.strokeStyle = 'rgba(120,110,90,0.6)'; g.lineWidth = 0.8;
      for (var i = -8; i <= 8; i += 4) { g.beginPath(); g.moveTo(i, -5.5); g.lineTo(i + 2, 5.5); g.stroke(); }
      g.beginPath(); g.moveTo(12, 0); g.quadraticCurveTo(15, 6, 10, 11); g.lineTo(6, 9); g.quadraticCurveTo(9, 5, 8, 2); g.closePath();
      g.fillStyle = '#e8e2d4'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#b01818'; g.fillRect(-2.5, -4.5, 5, 9); g.fillRect(-4.5, -2.5, 9, 5);
      g.restore();
    },
    holy: function (g) {
      g.beginPath(); g.moveTo(13, 5); g.lineTo(19, 5); g.lineTo(19, 10); g.quadraticCurveTo(26, 13, 26, 21); g.quadraticCurveTo(26, 28, 16, 28);
      g.quadraticCurveTo(6, 28, 6, 21); g.quadraticCurveTo(6, 13, 13, 10); g.closePath();
      g.fillStyle = 'rgba(170,210,255,0.35)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.beginPath(); g.moveTo(7.5, 18); g.quadraticCurveTo(16, 15, 24.5, 18); g.quadraticCurveTo(26, 27, 16, 27); g.quadraticCurveTo(6, 27, 7.5, 18);
      g.fillStyle = vlin(g, 16, 28, '#9ad0ff', '#3a7ad0'); g.fill();
      box(g, 12.5, 2, 7, 4, 1, '#8a5a2a', 1);
      g.fillStyle = '#f4e8a0'; g.fillRect(15, 17, 2, 8); g.fillRect(12.5, 19.5, 7, 2);
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(10.5, 15, 1.2, 3, 0.4, 0, 6.283); g.fill();
    },
    hammer: function (g) {
      g.save(); g.translate(16, 17); g.rotate(-0.5);
      box(g, -2.5, -4, 5, 20, 2, lin(g, -2.5, 0, 2.5, '#a06a3a', '#6a4220'));
      box(g, -10, -12, 20, 9, 2, vlin(g, -12, -3, '#d0d6de', '#6a707a'));
      g.restore();
    },
    ingot: function (g) {
      g.beginPath(); g.moveTo(6, 22); g.lineTo(9, 12); g.lineTo(23, 12); g.lineTo(26, 22); g.closePath();
      g.fillStyle = vlin(g, 12, 22, '#dfe4ea', '#7c838e'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(11, 14, 6, 1.5);
    },
    nails: function (g) {
      [9, 16, 23].forEach(function (x, i) {
        g.save(); g.translate(x, 16); g.rotate((i - 1) * 0.25);
        box(g, -1.2, -7, 2.4, 16, 1, '#a8aeb8', 1); box(g, -3.5, -9, 7, 3, 1, '#d0d6de', 1);
        g.restore();
      });
    },
    coal: function (g) {
      g.beginPath(); g.moveTo(6, 22); g.lineTo(9, 12); g.lineTo(16, 8); g.lineTo(24, 11); g.lineTo(27, 21); g.lineTo(18, 26); g.closePath();
      g.fillStyle = vlin(g, 8, 26, '#3a3a44', '#141418'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#ff6a1f'; g.beginPath(); g.arc(14, 20, 2, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(12, 12, 4, 1.5);
    },
    horseshoe: function (g) {
      g.lineCap = 'round';
      g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.arc(16, 14, 9, Math.PI * 0.05, Math.PI * 0.95, true); g.stroke();
      g.strokeStyle = '#c8ced6'; g.lineWidth = 5.5; g.stroke();
      g.fillStyle = '#3a3a3a'; [[8, 12], [24, 12], [11, 6], [21, 6]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 1, 0, 6.283); g.fill(); });
    },
    key: function (g) {
      g.lineCap = 'round';
      g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(14, 16); g.lineTo(28, 16); g.moveTo(24, 16); g.lineTo(24, 22); g.moveTo(28, 16); g.lineTo(28, 21); g.stroke();
      g.strokeStyle = '#d8b040'; g.lineWidth = 2.6; g.stroke();
      ell(g, 9, 16, 6, 6, '#d8b040'); ell(g, 9, 16, 2.5, 2.5, '#2a1a0a', 0);
    },
    note: function (g) {
      g.save(); g.translate(16, 16); g.rotate(-0.12);
      box(g, -9, -11, 18, 22, 1.5, vlin(g, -11, 11, '#efe4c4', '#c8b88a'));
      g.fillStyle = '#6a5a3a'; for (var i = 0; i < 5; i++) g.fillRect(-6, -7 + i * 3.6, 12 - (i === 4 ? 5 : 0), 1);
      ell(g, 4, 7, 2.5, 2.5, '#8a0b0b', 0);
      g.restore();
    }
  };

  // Pre-render a la escala de pantalla k (px por unidad del mundo).
  function render(w, h, k, painter) {
    var c = RM.canvas(Math.ceil(w * k), Math.ceil(h * k)), g = c.getContext('2d');
    g.scale(k, k); g.lineJoin = 'round';
    painter(g);
    c.ww = w; c.wh = h;
    return c;
  }

  var Art = {
    T: T, TILE: TILE, PROP: PROP,
    floor: function (type, v, k) { return render(T, T, k, function (g) { floor(g, type, v); }); },
    wallFace: function (v, k) { return render(T, T, k, function (g) { wallFace(g, v); }); },
    wallTop: function (k) { return render(T, T, k, wallTop); },
    prop: function (type, k) {
      var d = PROP[type], w = d.wide || d.fp[0] * T;
      return render(w, d.h, k, function (g) { d.draw(g); });
    },
    icon: function (name, k) { return render(32, 32, k, ICON[name]); },
    icons: Object.keys(ICON),
    flame: flame, box: box, ell: ell, rrPath: rrPath, vlin: vlin
  };
  RM.Art2 = Art;
})(window.RM);
