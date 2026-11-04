/* Red Main — ilustraciones procedurales de las tarjetas de modo y de los niveles.
   Cada pintor recibe un contexto 2D ya escalado y el tamaño lógico (w, h). */
(function (RM) {
  'use strict';
  var rand = RM.rand;

  function seeded(seed) {
    var s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function sky(g, w, h, stops) {
    var gr = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }

  function glow(g, x, y, r, color) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function rainLines(g, w, h, n, color, r) {
    g.strokeStyle = color; g.lineWidth = Math.max(1, w / 260);
    g.beginPath();
    for (var i = 0; i < n; i++) {
      var x = r() * w * 1.2, y = r() * h, l = h * (0.03 + r() * 0.05);
      g.moveTo(x, y); g.lineTo(x - l * 0.25, y + l);
    }
    g.stroke();
  }

  function tree(g, x, base, h, trunk, leaf, r) {
    g.fillStyle = trunk;
    g.beginPath();
    g.moveTo(x - h * 0.06, base); g.lineTo(x - h * 0.035, base - h * 0.55);
    g.lineTo(x + h * 0.035, base - h * 0.55); g.lineTo(x + h * 0.07, base);
    g.fill();
    g.fillStyle = leaf;
    for (var i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(x + (r() - 0.5) * h * 0.35, base - h * (0.62 + r() * 0.3), h * (0.13 + r() * 0.1), 0, 6.283);
      g.fill();
    }
  }

  function deadTree(g, x, base, h, color, r) {
    g.strokeStyle = color; g.lineCap = 'round';
    (function br(x0, y0, len, ang, wd, d) {
      var x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      g.lineWidth = wd; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (d <= 0) return;
      br(x1, y1, len * 0.72, ang - 0.3 - r() * 0.4, wd * 0.65, d - 1);
      br(x1, y1, len * 0.72, ang + 0.3 + r() * 0.4, wd * 0.65, d - 1);
    })(x, base, h * 0.38, -Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.05, 4);
  }

  var Art = {};

  // HISTORIA: el errante del sombrero señala a la criatura que espía detrás del árbol.
  Art.story = function (g, w, h) {
    var r = seeded(11);
    sky(g, w, h, [[0, '#2c303c'], [0.6, '#4a4f5c'], [1, '#1c1e24']]);
    glow(g, w * 0.3, h * 0.2, h * 0.35, 'rgba(230,230,240,0.35)');
    g.fillStyle = '#e8e8ee'; g.beginPath(); g.arc(w * 0.3, h * 0.2, h * 0.07, 0, 6.283); g.fill();
    for (var i = 0; i < 4; i++) deadTree(g, w * (0.05 + i * 0.16), h * 0.9, h * 0.55, 'rgba(20,22,28,0.55)', r);
    g.fillStyle = '#15161b'; g.fillRect(0, h * 0.86, w, h * 0.14);
    // Árbol grande a la derecha.
    var tx = w * 0.82;
    g.fillStyle = '#3a2416';
    g.beginPath(); g.moveTo(tx - w * 0.09, h); g.lineTo(tx - w * 0.06, h * 0.1); g.lineTo(tx + w * 0.07, h * 0.1); g.lineTo(tx + w * 0.11, h); g.fill();
    g.fillStyle = '#1d2a14';
    for (var k = 0; k < 7; k++) { g.beginPath(); g.arc(tx + (r() - 0.4) * w * 0.3, h * (0.02 + r() * 0.16), h * (0.1 + r() * 0.06), 0, 6.283); g.fill(); }
    // Criatura asomada.
    var cx = tx - w * 0.07, cy = h * 0.5;
    g.fillStyle = '#26272c';
    g.beginPath(); g.ellipse(cx, cy, w * 0.07, h * 0.14, -0.2, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(cx - w * 0.02, cy + h * 0.25, w * 0.05, h * 0.16, 0.2, 0, 6.283); g.fill();
    g.strokeStyle = '#26272c'; g.lineWidth = w * 0.025; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - w * 0.03, cy + h * 0.1); g.lineTo(cx - w * 0.1, cy + h * 0.2); g.lineTo(cx - w * 0.12, cy + h * 0.16); g.stroke();
    glow(g, cx - w * 0.03, cy - h * 0.05, h * 0.08, 'rgba(255,0,0,0.6)');
    g.fillStyle = '#ff2a1a';
    g.beginPath(); g.arc(cx - w * 0.045, cy - h * 0.05, h * 0.017, 0, 6.283); g.arc(cx - w * 0.005, cy - h * 0.06, h * 0.017, 0, 6.283); g.fill();
    // Sonrisa de dientes.
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(cx - w * 0.02, cy + h * 0.03, w * 0.04, h * 0.03, 0, 0, 6.283); g.fill();
    g.fillStyle = '#eee';
    for (var t = 0; t < 7; t++) {
      var x0 = cx - w * 0.055 + t * w * 0.01;
      g.beginPath(); g.moveTo(x0, cy + h * 0.012); g.lineTo(x0 + w * 0.005, cy + h * 0.045); g.lineTo(x0 + w * 0.01, cy + h * 0.012); g.fill();
    }
    // El errante.
    var mx = w * 0.27, my = h * 0.95;
    g.fillStyle = '#d9d9dc';
    g.beginPath(); g.moveTo(mx - w * 0.1, my); g.lineTo(mx - w * 0.07, my - h * 0.32); g.lineTo(mx + w * 0.07, my - h * 0.32); g.lineTo(mx + w * 0.09, my); g.fill();
    g.strokeStyle = '#d9d9dc'; g.lineWidth = w * 0.045;
    g.beginPath(); g.moveTo(mx + w * 0.04, my - h * 0.28); g.lineTo(mx + w * 0.22, my - h * 0.33); g.stroke();
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(mx + w * 0.24, my - h * 0.335, w * 0.022, 0, 6.283); g.fill();
    g.beginPath(); g.arc(mx, my - h * 0.42, h * 0.085, 0, 6.283); g.fill();
    g.fillStyle = '#000'; g.fillRect(mx - h * 0.08, my - h * 0.445, h * 0.16, h * 0.03);
    g.fillStyle = '#5b3a22';
    g.beginPath(); g.ellipse(mx, my - h * 0.49, h * 0.15, h * 0.03, -0.1, 0, 6.283); g.fill();
    g.beginPath(); g.moveTo(mx - h * 0.08, my - h * 0.5); g.quadraticCurveTo(mx, my - h * 0.66, mx + h * 0.08, my - h * 0.51); g.fill();
    g.fillStyle = '#3c2616'; g.fillRect(mx - h * 0.08, my - h * 0.53, h * 0.16, h * 0.022);
    rainLines(g, w, h, 60, 'rgba(220,225,240,0.25)', r);
  };

  // 1 JUGADOR: fogata en un claro del bosque (las llamas se animan aparte).
  Art.solo = function (g, w, h) {
    var r = seeded(23);
    sky(g, w, h, [[0, '#0b0714'], [0.7, '#1d1030'], [1, '#120a1a']]);
    for (var s = 0; s < 40; s++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.5) + ')'; g.fillRect(r() * w, r() * h * 0.5, 1.2, 1.2); }
    glow(g, w * 0.5, h * 0.78, h * 0.6, 'rgba(255,110,20,0.45)');
    g.fillStyle = '#140d0a'; g.fillRect(0, h * 0.85, w, h * 0.15);
    var trees = [0.08, 0.28, 0.72, 0.92];
    for (var i = 0; i < trees.length; i++) tree(g, w * trees[i], h * 0.88, h * (0.75 + r() * 0.2), '#4a2a18', '#1f3a16', r);
    // Luz de la fogata sobre los troncos.
    g.globalCompositeOperation = 'lighter';
    glow(g, w * 0.5, h * 0.8, h * 0.35, 'rgba(255,90,0,0.35)');
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = '#3b2010'; g.lineWidth = h * 0.035; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * 0.42, h * 0.88); g.lineTo(w * 0.58, h * 0.83); g.moveTo(w * 0.42, h * 0.83); g.lineTo(w * 0.58, h * 0.88); g.stroke();
  };
  Art.soloFire = { x: 0.5, y: 0.83 };

  // ONLINE: tres siluetas bajo una señal, en ámbar enfermizo.
  Art.online = function (g, w, h) {
    var r = seeded(37);
    sky(g, w, h, [[0, '#5a4300'], [0.6, '#8a6a00'], [1, '#2a1f00']]);
    glow(g, w * 0.5, h * 0.25, h * 0.5, 'rgba(255,230,120,0.35)');
    g.strokeStyle = 'rgba(30,20,0,0.85)'; g.lineWidth = h * 0.03; g.lineCap = 'round';
    for (var a = 1; a <= 3; a++) {
      g.beginPath(); g.arc(w * 0.5, h * 0.36, h * 0.07 * a, -Math.PI * 0.78, -Math.PI * 0.22); g.stroke();
    }
    g.fillStyle = 'rgba(30,20,0,0.9)'; g.beginPath(); g.arc(w * 0.5, h * 0.36, h * 0.025, 0, 6.283); g.fill();
    var fig = function (x, s, ghost) {
      g.fillStyle = '#1a1200';
      var base = h * 0.98;
      g.beginPath();
      g.moveTo(x - s * 0.3, base);
      g.quadraticCurveTo(x - s * 0.34, base - s * 0.7, x - s * 0.18, base - s * 0.85);
      g.arc(x, base - s * 1.05, s * 0.24, Math.PI * 0.8, Math.PI * 0.2);
      g.quadraticCurveTo(x + s * 0.34, base - s * 0.7, x + s * 0.3, base);
      if (ghost) { for (var k = 0; k < 4; k++) g.lineTo(x + s * 0.3 - (k + 0.5) * s * 0.15, base - (k % 2 ? 0 : s * 0.08)); }
      g.fill();
      if (ghost) {
        g.fillStyle = '#fff2b0';
        g.beginPath(); g.arc(x - s * 0.08, base - s * 1.07, s * 0.06, 0, 6.283); g.arc(x + s * 0.08, base - s * 1.07, s * 0.06, 0, 6.283); g.fill();
      }
    };
    fig(w * 0.22, h * 0.42, false);
    fig(w * 0.78, h * 0.42, false);
    fig(w * 0.5, h * 0.5, true);
    rainLines(g, w, h, 40, 'rgba(255,240,180,0.2)', r);
  };

  // Miniaturas de los 4 niveles de 1 Jugador.
  Art.level = function (n, g, w, h) {
    var r = seeded(50 + n * 7), i;
    if (n === 1) { // El Castillo del Terror
      sky(g, w, h, [[0, '#0c0a1c'], [1, '#2a1c3a']]);
      glow(g, w * 0.75, h * 0.22, h * 0.45, 'rgba(220,220,255,0.35)');
      g.fillStyle = '#e8e8f6'; g.beginPath(); g.arc(w * 0.75, h * 0.22, h * 0.08, 0, 6.283); g.fill();
      g.fillStyle = '#08060e';
      g.fillRect(w * 0.18, h * 0.42, w * 0.64, h * 0.5);
      [[0.14, 0.3, 0.12], [0.44, 0.18, 0.12], [0.74, 0.32, 0.12]].forEach(function (tw) {
        g.fillRect(w * tw[0], h * tw[1], w * tw[2], h);
        g.beginPath(); g.moveTo(w * (tw[0] - 0.02), h * tw[1]); g.lineTo(w * (tw[0] + tw[2] / 2), h * (tw[1] - 0.14)); g.lineTo(w * (tw[0] + tw[2] + 0.02), h * tw[1]); g.fill();
      });
      for (i = 0; i < 12; i++) g.fillRect(w * (0.18 + i * 0.055), h * 0.38, w * 0.03, h * 0.05);
      g.fillStyle = '#ffb040';
      [[0.2, 0.45], [0.5, 0.3], [0.78, 0.5], [0.35, 0.6], [0.62, 0.62]].forEach(function (p) { if (r() < 0.85) g.fillRect(w * p[0], h * p[1], 3, 5); });
      g.fillStyle = '#f0f0f8'; g.fillRect(w * 0.505, h * 0.27, 2, 5);
      g.fillStyle = '#0c1a10'; g.fillRect(0, h * 0.9, w, h * 0.1);
    } else if (n === 2) { // Pantano de Ceniza
      sky(g, w, h, [[0, '#2a2a28'], [0.6, '#4a4740'], [1, '#1a1a18']]);
      for (i = 0; i < 5; i++) deadTree(g, w * (0.1 + i * 0.2) + (r() - 0.5) * 20, h * 0.8, h * (0.5 + r() * 0.3), '#141412', r);
      g.fillStyle = '#23241f'; g.fillRect(0, h * 0.78, w, h);
      g.fillStyle = 'rgba(160,160,150,0.18)';
      for (i = 0; i < 12; i++) { g.beginPath(); g.ellipse(r() * w, h * (0.7 + r() * 0.2), w * 0.2, h * 0.04, 0, 0, 6.283); g.fill(); }
      for (i = 0; i < 50; i++) { g.fillStyle = 'rgba(220,210,200,' + r() * 0.5 + ')'; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    } else if (n === 3) { // La Ciudad Ahogada
      sky(g, w, h, [[0, '#0a0818'], [1, '#201634']]);
      var bx = 0;
      while (bx < w) {
        var bw = w * (0.06 + r() * 0.1), bh = h * (0.25 + r() * 0.4);
        g.fillStyle = '#120c20'; g.fillRect(bx, h * 0.7 - bh, bw, bh);
        for (var wy = h * 0.7 - bh + 4; wy < h * 0.68; wy += 6) for (var wx = bx + 3; wx < bx + bw - 3; wx += 5) if (r() < 0.12) { g.fillStyle = r() < 0.4 ? '#c8201a' : '#c89a50'; g.fillRect(wx, wy, 2, 3); }
        bx += bw + 2;
      }
      var water = g.createLinearGradient(0, h * 0.7, 0, h);
      water.addColorStop(0, '#1a2440'); water.addColorStop(1, '#05060e');
      g.fillStyle = water; g.fillRect(0, h * 0.7, w, h * 0.3);
      g.strokeStyle = 'rgba(200,60,50,0.4)'; g.lineWidth = 1;
      for (i = 0; i < 18; i++) { var ly = h * (0.72 + r() * 0.26), lx = r() * w; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + w * 0.08, ly); g.stroke(); }
    } else { // Ojo de la Tormenta
      sky(g, w, h, [[0, '#1a0004'], [0.5, '#3a0610'], [1, '#0a0002']]);
      glow(g, w * 0.5, h * 0.45, h * 0.6, 'rgba(255,0,0,0.4)');
      g.strokeStyle = '#ff3a2a'; g.lineWidth = 2; g.shadowColor = '#f00'; g.shadowBlur = 10;
      var ew = w * 0.32, eh = h * 0.16;
      g.beginPath(); g.moveTo(w * 0.5 - ew, h * 0.45); g.quadraticCurveTo(w * 0.5, h * 0.45 - eh * 2, w * 0.5 + ew, h * 0.45); g.quadraticCurveTo(w * 0.5, h * 0.45 + eh * 2, w * 0.5 - ew, h * 0.45); g.stroke();
      g.shadowBlur = 0;
      var ir = g.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, eh * 1.1);
      ir.addColorStop(0, '#ffd36a'); ir.addColorStop(0.4, '#ff3a10'); ir.addColorStop(1, '#3a0000');
      g.fillStyle = ir; g.beginPath(); g.arc(w * 0.5, h * 0.45, eh * 1.05, 0, 6.283); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(w * 0.5, h * 0.45, eh * 0.14, eh * 0.9, 0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255,230,255,0.8)'; g.lineWidth = 1.5;
      var lx2 = w * 0.15, ly2 = 0; g.beginPath(); g.moveTo(lx2, ly2);
      for (i = 0; i < 6; i++) { lx2 += (r() - 0.4) * w * 0.06; ly2 += h * 0.06; g.lineTo(lx2, ly2); }
      g.stroke();
    }
    var v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  };

  Art.LEVELS = [
    { n: 1, name: 'El Castillo del Terror', diff: 2, label: 'Normal', desc: 'La Dama Blanca vaga por los pasillos. Juntá los materiales, forjá la herradura y escapá.' },
    { n: 2, name: 'Pantano de Ceniza', diff: 2, label: 'Normal', desc: 'Cruzá el pantano sin hundirte. Algo respira bajo el agua.' },
    { n: 3, name: 'La Ciudad Ahogada', diff: 3, label: 'Difícil', desc: 'Las ventanas rojas te miran. No te quedes quieto.' },
    { n: 4, name: 'Ojo de la Tormenta', diff: 4, label: 'Pesadilla', desc: 'Sobreviví a la tormenta. El ojo nunca parpadea.' }
  ];

  // Pinta en un canvas nuevo y devuelve la imagen como dataURL (para el DOM).
  Art.toDataURL = function (painter, w, h, scale) {
    var c = RM.canvas(w * scale, h * scale), g = c.getContext('2d');
    g.scale(scale, scale);
    painter(g, w, h);
    return c.toDataURL('image/jpeg', 0.86);
  };

  Art.rand = rand;
  RM.Art = Art;
})(window.RM);
