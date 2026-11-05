/* Red Main — la Dama Blanca (según el boceto): sombrero de ala ancha, pelo
   largo, cara sin rostro con un ojo en espiral, capa de hombros en punta,
   cruz doble, cinturón, falda larga deshilachada y un garfio en espiral.
   Dibujo vectorial animado + humo + la escena del garfio en primer plano.
   Unidades del mundo: pies en (0,0), alto ≈ 102. */
(function (RM) {
  'use strict';
  var TAU = Math.PI * 2;
  var OUT = 'rgba(30,26,40,0.9)';
  var C = {
    dress: '#eceaf2', dressS: '#b4b0c6', dressD: '#7e7a94', hair: '#1c1822', hairL: '#3a3446',
    hat: '#dcd9e4', hatD: '#9c98ae', band: '#3a3446', skin: '#f6f4fa', skinS: '#cbc7da', hook: '#4a4e5a', hookL: '#c0c4d0'
  };

  function fs(g, fill, lw) { g.fillStyle = fill; g.fill(); if (lw !== 0) { g.lineWidth = lw || 1.3; g.strokeStyle = OUT; g.stroke(); } }
  function lg(g, x1, x2, a, b, c) { var r = g.createLinearGradient(x1, 0, x2, 0); r.addColorStop(0, a); r.addColorStop(0.5, b); r.addColorStop(1, c || a); return r; }
  function vg(g, y1, y2, a, b) { var r = g.createLinearGradient(0, y1, 0, y2); r.addColorStop(0, a); r.addColorStop(1, b); return r; }
  function limb(g, x1, y1, x2, y2, w1, w2, fill) {
    var a = Math.atan2(y2 - y1, x2 - x1), nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x2 + nx * w2, y2 + ny * w2);
    g.arc(x2, y2, w2, a + Math.PI / 2, a - Math.PI / 2, true);
    g.lineTo(x1 - nx * w1, y1 - ny * w1); g.arc(x1, y1, w1, a - Math.PI / 2, a + Math.PI / 2, true);
    g.closePath(); fs(g, fill, 1.1);
  }
  function spiral(g, cx, cy, r0, turns, lw, color) {
    g.beginPath();
    for (var i = 0; i <= 60; i++) {
      var t = i / 60, a = t * turns * TAU, r = r0 * (1 - t * 0.85);
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = color; g.stroke();
  }

  // El garfio: mango recto y una espiral filosa. (x,y) = mano; a = ángulo del mango.
  function hook(g, x, y, a, scale) {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(scale || 1, scale || 1);
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 4.2; g.beginPath(); g.moveTo(-3, 0); g.lineTo(14, 0); g.stroke();
    g.strokeStyle = '#3a2a22'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.stroke();
    g.strokeStyle = C.hook; g.lineWidth = 2.4; g.beginPath(); g.moveTo(3, 0); g.lineTo(14, 0); g.stroke();
    spiral(g, 17.5, 2.5, 5.2, 1.35, 4.2, OUT);
    spiral(g, 17.5, 2.5, 5.2, 1.35, 2.4, C.hook);
    g.strokeStyle = C.hookL; g.lineWidth = 0.7; g.beginPath(); g.moveTo(5, -0.6); g.lineTo(13, -0.6); g.stroke();
    // Punta filosa.
    g.fillStyle = C.hookL; g.beginPath(); g.moveTo(21.6, 0.6); g.lineTo(25.5, -3.2); g.lineTo(22.8, 2.6); g.closePath(); g.fill();
    g.restore();
  }

  /* s = { t, mode: idle|point|run|windup|leap|clone|vanish, point: 0 abajo,1 izq,2 der,3 arriba,
           face: 0 frente, 3 espalda, lean: -1..1, alpha } */
  function draw(g, s) {
    var t = s.t || 0, mode = s.mode || 'idle';
    g.save();
    // Señalar a la izquierda = dibujar espejado.
    var mirror = (mode === 'point' && s.point === 1) || ((mode === 'run' || mode === 'leap' || mode === 'windup') && s.lean < 0);
    if (mirror) g.scale(-1, 1);
    var back = s.face === 3 && mode !== 'point';
    var hover = -3 - Math.sin(t * 2.2) * 2;
    var crouch = mode === 'windup' ? Math.min(1, (s.k || 1)) : 0;
    g.translate(0, hover);
    if (crouch) g.scale(1 + crouch * 0.06, 1 - crouch * 0.14);
    var leanK = (mode === 'run' ? 0.3 : mode === 'leap' ? 0.36 : 0) * Math.abs(s.lean || 1);
    if (leanK) g.transform(1, 0, -leanK, 1, 0, 0);

    // Aura.
    var au = g.createRadialGradient(0, -52, 4, 0, -52, 62);
    au.addColorStop(0, 'rgba(230,235,255,0.22)'); au.addColorStop(1, 'rgba(230,235,255,0)');
    g.fillStyle = au; g.fillRect(-64, -116, 128, 120);

    var sway = Math.sin(t * 3) * 2 + (mode === 'run' ? Math.sin(t * 14) * 2 - 4 : 0);
    var hairBack = mode === 'run' || mode === 'leap' ? 8 : 0;

    // Pelo largo de atrás.
    g.beginPath();
    g.moveTo(-10, -90); g.bezierCurveTo(-18 - hairBack * 0.3, -80, -16 + sway * 0.3 - hairBack, -60, -15 - hairBack, -44);
    g.quadraticCurveTo(-8 - hairBack * 0.5, -40, -2, -44); g.lineTo(2, -44); g.quadraticCurveTo(8, -40, 15 - hairBack * 0.4, -44);
    g.bezierCurveTo(16 + sway * 0.3, -60, 18, -80, 10, -90); g.closePath();
    fs(g, vg(g, -92, -44, C.hairL, C.hair), 1.2);

    // Falda larga con vuelo y borde deshilachado.
    var hemW = 26 + (mode === 'run' ? 3 : 0);
    g.beginPath();
    g.moveTo(-10.5, -49);
    g.bezierCurveTo(-14, -34, -22 + sway * 0.4, -16, -hemW + sway, -1);
    var n = 13;
    for (var i = 0; i <= n; i++) {
      var x = -hemW + sway + (i / n) * (hemW * 2), y = i % 2 ? -5 - Math.sin(t * 5 + i) * 1.6 : 1 + Math.sin(t * 4 + i * 1.7) * 1.2;
      g.lineTo(x, y);
    }
    g.bezierCurveTo(22 + sway * 0.4, -16, 14, -34, 10.5, -49);
    g.closePath();
    var sk = lg(g, -hemW, hemW, C.dress, '#f8f7fc', C.dressS);
    fs(g, sk, 1.3);
    g.save(); g.clip();
    // Pliegues.
    g.strokeStyle = 'rgba(110,104,140,0.45)'; g.lineWidth = 0.9;
    [-6, 0, 6, 12, -12].forEach(function (x, k) {
      g.beginPath(); g.moveTo(x * 0.5, -48); g.quadraticCurveTo(x * 1.2 + sway * 0.3, -26, x * 2 + sway * 0.8 + Math.sin(t * 3 + k) * 1.5, 0); g.stroke();
    });
    // Ruedo como pasto deshilachado.
    g.strokeStyle = 'rgba(70,66,90,0.55)'; g.lineWidth = 0.7;
    for (var f = 0; f < 22; f++) {
      var fx = -hemW + 2 + f * (hemW * 2 - 4) / 21 + sway;
      g.beginPath(); g.moveTo(fx, -14 - (f % 3) * 2); g.quadraticCurveTo(fx + 1.5, -7, fx + Math.sin(t * 6 + f) * 1.5, -1); g.stroke();
    }
    g.fillStyle = 'rgba(90,86,120,0.22)'; g.fillRect(8, -50, 30, 52);
    var fade = g.createLinearGradient(0, -12, 0, 3); fade.addColorStop(0, 'rgba(10,8,16,0)'); fade.addColorStop(1, 'rgba(10,8,16,0.35)');
    g.fillStyle = fade; g.fillRect(-40, -14, 80, 18);
    g.restore();

    // Torso (corpiño) con un borde deshilachado debajo de la capa.
    g.beginPath();
    g.moveTo(-10.5, -49); g.bezierCurveTo(-12, -55, -13, -60, -12, -64); g.lineTo(12, -64); g.bezierCurveTo(13, -60, 12, -55, 10.5, -49); g.closePath();
    fs(g, lg(g, -12, 12, C.dress, '#ffffff', C.dressS), 1.2);
    g.strokeStyle = 'rgba(100,96,130,0.5)'; g.lineWidth = 0.6;
    for (var j = -9; j <= 9; j += 2.2) { g.beginPath(); g.moveTo(j, -56); g.lineTo(j + 0.4, -53); g.stroke(); }
    // Cinturón doble.
    g.fillStyle = C.dressD;
    g.beginPath(); g.moveTo(-11, -52); g.lineTo(11, -52); g.lineTo(11, -49.4); g.lineTo(-11, -49.4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-11.4, -48.6); g.lineTo(11.4, -48.6); g.lineTo(11.6, -46.6); g.lineTo(-11.6, -46.6); g.closePath(); g.fill();

    // Brazo del garfio.
    var hk = hookArm(mode, t, s);
    if (!back || mode === 'windup') {
      limb(g, -13, -63, hk.ex, hk.ey, 3.6, 3, lg(g, -18, -8, C.dress, '#ffffff', C.dressS));
      limb(g, hk.ex, hk.ey, hk.hx, hk.hy, 3, 2.4, C.dress);
      hook(g, hk.hx, hk.hy, hk.a, 1);
      handDraw(g, hk.hx, hk.hy, hk.a);
    }

    // Capa corta de hombros en punta.
    g.beginPath();
    g.moveTo(-5, -73);
    g.quadraticCurveTo(-12, -70, -21, -61.5); g.lineTo(-17, -60); g.lineTo(-15, -57.5);
    for (var q = 0; q <= 8; q++) g.lineTo(-15 + q * 3.75, -57.5 + (q % 2 ? 1.8 : 0) + Math.abs(q - 4) * -0.3);
    g.lineTo(17, -60); g.lineTo(21, -61.5); g.quadraticCurveTo(12, -70, 5, -73); g.closePath();
    fs(g, vg(g, -74, -57, '#f8f7fc', C.dressS), 1.3);
    g.strokeStyle = 'rgba(100,96,130,0.5)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(-8, -68); g.quadraticCurveTo(-12, -63, -14, -59); g.moveTo(8, -68); g.quadraticCurveTo(12, -63, 14, -59); g.stroke();

    if (back) {
      // De espaldas: el pelo tapa todo.
      g.beginPath();
      g.moveTo(-9.5, -92); g.bezierCurveTo(-14, -80, -14, -66, -12, -56); g.quadraticCurveTo(0, -52, 12, -56); g.bezierCurveTo(14, -66, 14, -80, 9.5, -92); g.closePath();
      fs(g, vg(g, -92, -56, C.hairL, C.hair), 1.2);
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 0.8;
      for (var h = -6; h <= 6; h += 3) { g.beginPath(); g.moveTo(h, -88); g.quadraticCurveTo(h * 1.3, -72, h, -58); g.stroke(); }
    } else {
      // Cordón y cruz de doble travesaño.
      g.strokeStyle = '#2a2632'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-4, -72); g.lineTo(0, -64); g.lineTo(4, -72); g.stroke();
      g.fillStyle = '#1e1a24';
      g.fillRect(-0.9, -64.5, 1.8, 11); g.fillRect(-3.2, -62, 6.4, 1.6); g.fillRect(-2.4, -59.4, 4.8, 1.4);
      // Cara sin rostro.
      g.beginPath(); g.ellipse(0, -81, 7.4, 9, 0, 0, TAU);
      var fg = g.createRadialGradient(-2, -84, 1, 0, -80, 10); fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.7, C.skin); fg.addColorStop(1, C.skinS);
      fs(g, fg, 1.2);
      g.fillStyle = 'rgba(80,76,110,0.25)'; g.beginPath(); g.ellipse(0, -76, 6, 3.2, 0, 0, TAU); g.fill();
      // Ojo en espiral (rojo cuando caza).
      var hunting = mode === 'run' || mode === 'leap' || mode === 'windup' || mode === 'clone';
      spiral(g, 3.6, -83.4, 2.6, 1.6, 0.9, hunting ? '#c0101a' : '#2a2632');
      if (hunting) { g.fillStyle = 'rgba(255,40,40,0.35)'; g.beginPath(); g.arc(3.6, -83.4, 4, 0, TAU); g.fill(); }
      // Mechones de adelante.
      [-1, 1].forEach(function (k) {
        g.beginPath();
        g.moveTo(k * 6.5, -89); g.bezierCurveTo(k * 9.5, -82, k * 9, -72, k * 10.5 + sway * 0.2, -60);
        g.lineTo(k * 13, -61); g.bezierCurveTo(k * 12, -74, k * 12, -84, k * 9.5, -90); g.closePath();
        fs(g, C.hair, 1);
      });
    }
    // Sombrero: ala ancha y copa con cinta.
    g.beginPath(); g.ellipse(0, -89, 23, 5.2, -0.04, 0, TAU);
    fs(g, vg(g, -94, -84, C.hat, C.hatD), 1.3);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0, -87.5, 15, 2.4, 0, 0, Math.PI); g.fill();
    g.beginPath(); g.moveTo(-11, -90.5); g.lineTo(-10, -102); g.quadraticCurveTo(0, -104, 10, -102); g.lineTo(11, -90.5); g.quadraticCurveTo(0, -88.6, -11, -90.5); g.closePath();
    fs(g, lg(g, -11, 11, C.hat, '#f2f0f6', C.hatD), 1.3);
    g.beginPath(); g.moveTo(-10.8, -93.8); g.quadraticCurveTo(0, -92, 10.8, -93.8); g.lineTo(11, -90.6); g.quadraticCurveTo(0, -88.8, -11, -90.6); g.closePath();
    g.fillStyle = C.band; g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-6, -101); g.lineTo(-5.4, -95); g.moveTo(5, -101.4); g.lineTo(4.6, -95); g.stroke();

    // Brazo que señala (u otros gestos).
    var pa = pointArm(mode, t, s);
    if (pa) {
      limb(g, 13, -63, pa.ex, pa.ey, 3.6, 3, lg(g, 8, 20, C.dress, '#ffffff', C.dressS));
      limb(g, pa.ex, pa.ey, pa.hx, pa.hy, 3, 2.3, C.dress);
      pointHand(g, pa.hx, pa.hy, pa.a, pa.open);
    }
    g.restore();
  }

  function hookArm(mode, t, s) {
    var o;
    if (mode === 'windup') o = { ex: -18, ey: -76, hx: -12, hy: -96, a: -0.6 + Math.sin(t * 30) * 0.05 };
    else if (mode === 'leap' || mode === 'clone') o = { ex: -20, ey: -70, hx: -24, hy: -84, a: -1.9 };
    else if (mode === 'run') o = { ex: -20, ey: -58, hx: -21, hy: -70, a: -1.6 + Math.sin(t * 14) * 0.15 };
    else o = { ex: -18.5, ey: -53, hx: -10.5, hy: -45, a: 0.95 };
    return o;
  }
  function pointArm(mode, t, s) {
    var ang, tremble = Math.sin(t * 25) * 0.025;
    if (mode === 'point') {
      ang = s.point === 3 ? -1.25 : s.point === 0 ? 1.15 : 0.02;
      var ext = Math.min(1, (s.k == null ? 1 : s.k));
      ang = ang * ext + 1.35 * (1 - ext) + tremble;
      var ex = 13 + Math.cos(ang) * 13, ey = -63 + Math.sin(ang) * 13;
      return { ex: ex, ey: ey, hx: ex + Math.cos(ang) * 13, hy: ey + Math.sin(ang) * 13, a: ang };
    }
    if (mode === 'run') return { ex: 19, ey: -55, hx: 26, hy: -46 + Math.sin(t * 14) * 2, a: 0.9 };
    if (mode === 'leap' || mode === 'clone') return { ex: 22, ey: -68, hx: 32, hy: -72, a: -0.3, open: true };
    if (mode === 'windup') return { ex: 20, ey: -58, hx: 24, hy: -48, a: 1.2, open: true };
    return { ex: 16, ey: -51, hx: 15, hy: -39, a: 1.6 };
  }
  function handDraw(g, x, y) {
    g.beginPath(); g.ellipse(x, y, 2.6, 2.3, 0, 0, TAU); fs(g, C.skin, 1);
  }
  // Mano con el índice estirado.
  function pointHand(g, x, y, a, open) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.ellipse(1, 0, 3, 2.4, 0, 0, TAU); fs(g, C.skin, 1);
    g.lineCap = 'round';
    var fingers = open ? [[-1.6, 0.3], [-0.5, 0.1], [0.6, 0], [1.6, -0.15]] : [[0, 0]];
    fingers.forEach(function (f, i) {
      var len = open ? 6.5 : 8;
      g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(3, f[0]); g.lineTo(3 + len * Math.cos(f[1]), f[0] + len * Math.sin(f[1])); g.stroke();
      g.strokeStyle = C.skin; g.lineWidth = 1.3; g.stroke();
    });
    if (!open) { g.strokeStyle = OUT; g.lineWidth = 0.8; g.beginPath(); g.arc(3.4, 1.6, 1.2, -1, 2); g.stroke(); }
    g.restore();
  }

  /* ---------- Humo ---------- */
  var puffTex = null;
  function puffTexture() {
    if (puffTex) return puffTex;
    puffTex = RM.canvas(64, 64);
    var g = puffTex.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(210,210,222,0.9)'); gr.addColorStop(0.5, 'rgba(150,150,170,0.45)'); gr.addColorStop(1, 'rgba(120,120,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return puffTex;
  }
  var Smoke = {
    puff: function (list, x, y, n, spread, dark) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * TAU, sp = RM.rand(10, 60) * (spread || 1);
        list.push({ x: x + Math.cos(a) * 8, y: y - RM.rand(0, 70), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - RM.rand(8, 30), r: RM.rand(14, 30), life: 0, max: RM.rand(0.9, 1.8), dark: dark });
      }
    },
    update: function (list, dt) {
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 2); p.vy *= Math.exp(-dt * 1.5); p.r += dt * 24;
        if (p.life > p.max) list.splice(i, 1);
      }
    },
    draw: function (g, list) {
      var tex = puffTexture();
      list.forEach(function (p) {
        var a = Math.sin(Math.min(1, p.life / p.max) * Math.PI) * 0.85;
        g.globalAlpha = a; g.drawImage(tex, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      });
      g.globalAlpha = 1;
    }
  };

  /* ---------- Primer plano del ataque (pantalla completa) ---------- */
  // o = { kind: stab|tear|struggle, t, push (0..1 en forcejeo), pal, shake }
  function closeup(g, W, H, o) {
    var t = o.t, u = Math.min(W, H);
    g.save();
    var bg = g.createRadialGradient(W / 2, H / 2, u * 0.1, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#2a0608'); bg.addColorStop(1, '#000');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    var shake = (o.shake || 0) * u * 0.02;
    g.translate(W / 2 + (Math.random() - 0.5) * shake, H * 0.56 + (Math.random() - 0.5) * shake);
    var k = H / 330;
    g.scale(k, k);
    // Su cara asomando arriba a la derecha.
    g.save(); g.translate(205, -150); g.scale(1.7, 1.7);
    g.beginPath(); g.ellipse(0, 10, 34, 42, 0.2, 0, TAU);
    var fg = g.createRadialGradient(-8, 0, 4, 0, 10, 46); fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, C.skinS);
    g.fillStyle = fg; g.fill();
    spiral(g, 12, -2, 8, 1.7, 2.4, '#b00a14');
    g.fillStyle = C.hair; g.beginPath(); g.moveTo(-40, -20); g.quadraticCurveTo(-44, 30, -30, 70); g.lineTo(-18, 60); g.quadraticCurveTo(-30, 20, -24, -14); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(0, -26, 96, 22, 0.18, 0, TAU); g.fillStyle = vg(g, -48, -4, C.hat, C.hatD); g.fill();
    g.restore();
    // Recorrido del garfio hacia el ojo izquierdo (‑42, ‑18).
    var eye = { x: -42, y: -18 }, far = { x: 240, y: -230 }, tip;
    var hit = 0, lost = false, blood = 0, eyeOut = 0;
    if (o.kind === 'struggle') {
      var d = 0.18 + o.push * 0.8;
      tip = { x: eye.x + (far.x - eye.x) * d * 0.5 + Math.sin(t * 37) * 3, y: eye.y + (far.y - eye.y) * d * 0.5 + Math.cos(t * 41) * 3 };
    } else {
      var a1 = Math.min(1, t / 0.55);
      var e = 1 - Math.pow(1 - a1, 3);
      tip = { x: far.x + (eye.x - far.x) * e, y: far.y + (eye.y - far.y) * e };
      if (t > 0.55) { hit = 1; blood = Math.min(1, (t - 0.55) / 1.3); }
      if (o.kind === 'tear' && t > 1.15) {
        eyeOut = Math.min(1, (t - 1.15) / 0.5);
        lost = true;
        tip = { x: eye.x + (far.x - eye.x) * eyeOut * 0.55, y: eye.y + (far.y - eye.y) * eyeOut * 0.55 };
      }
    }
    RM.Hero.face(g, { pal: o.pal, fear: 1, hit: hit, lost: lost, blood: blood, look: 0.6 });
    // Manos del jugador agarrando la muñeca (forcejeo).
    var ang = Math.atan2(far.y - eye.y, far.x - eye.x);
    var pal = o.pal || RM.Hero.palette(0);
    if (o.kind === 'struggle') {
      [-1, 1].forEach(function (s) {
        var hx = tip.x + Math.cos(ang) * (70 + s * 14), hy = tip.y + Math.sin(ang) * (70 + s * 14) + 30;
        g.beginPath(); g.ellipse(hx, hy, 26, 20, ang, 0, TAU); g.fillStyle = pal.skin; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
        g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = 2;
        for (var f = -1; f <= 1; f++) { g.beginPath(); g.moveTo(hx - 14 + f * 8, hy - 8); g.lineTo(hx - 10 + f * 8, hy + 10); g.stroke(); }
      });
    }
    // Brazo blanco de ella + garfio.
    var hx2 = tip.x + Math.cos(ang) * 150, hy2 = tip.y + Math.sin(ang) * 150;
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 50; g.beginPath(); g.moveTo(hx2 + 30, hy2 - 30); g.lineTo(hx2 + 260, hy2 - 200); g.stroke();
    g.strokeStyle = C.dress; g.lineWidth = 44; g.stroke();
    g.strokeStyle = 'rgba(130,126,150,0.5)'; g.lineWidth = 2;
    for (var l = 0; l < 6; l++) { g.beginPath(); g.moveTo(hx2 + 40 + l * 12, hy2 - 50 - l * 6); g.lineTo(hx2 + 70 + l * 12, hy2 - 20 - l * 6); g.stroke(); }
    // Mango.
    g.strokeStyle = OUT; g.lineWidth = 20; g.beginPath(); g.moveTo(hx2, hy2); g.lineTo(tip.x + Math.cos(ang) * 40, tip.y + Math.sin(ang) * 40); g.stroke();
    g.strokeStyle = C.hook; g.lineWidth = 13; g.stroke();
    g.strokeStyle = C.hookL; g.lineWidth = 3; g.beginPath(); g.moveTo(hx2 - 4, hy2 - 6); g.lineTo(tip.x + Math.cos(ang) * 44 - 4, tip.y + Math.sin(ang) * 44 - 6); g.stroke();
    // Espiral que termina en punta.
    g.save(); g.translate(tip.x + Math.cos(ang) * 40, tip.y + Math.sin(ang) * 40); g.rotate(ang + Math.PI);
    spiral(g, 18, 16, 24, 1.15, 18, OUT); spiral(g, 18, 16, 24, 1.15, 11, C.hook);
    g.restore();
    g.fillStyle = C.hookL; g.beginPath(); g.moveTo(tip.x - 6, tip.y - 6); g.lineTo(tip.x + 10, tip.y + 2); g.lineTo(tip.x + 18, tip.y - 18); g.closePath(); g.fill();
    // Mano pálida de dedos largos.
    g.beginPath(); g.ellipse(hx2 + 10, hy2 - 10, 34, 26, ang, 0, TAU); g.fillStyle = C.skin; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 3;
    for (var fi = 0; fi < 4; fi++) { g.beginPath(); g.moveTo(hx2 - 14 + fi * 10, hy2 - 30 + fi * 4); g.quadraticCurveTo(hx2 - 30 + fi * 10, hy2 + 4, hx2 - 10 + fi * 10, hy2 + 20); g.stroke(); }
    // El ojo arrancado colgando de la punta.
    if (eyeOut > 0) {
      g.strokeStyle = '#7a0006'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(eye.x, eye.y); g.quadraticCurveTo((eye.x + tip.x) / 2, (eye.y + tip.y) / 2 + 30, tip.x, tip.y + 10); g.stroke();
      g.beginPath(); g.arc(tip.x, tip.y + 18, 17, 0, TAU); g.fillStyle = '#f2ece6'; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#4a2e18'; g.beginPath(); g.arc(tip.x - 5, tip.y + 22, 7, 0, TAU); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(tip.x - 5, tip.y + 22, 3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(170,0,10,0.8)'; g.lineWidth = 1.5;
      for (var v = 0; v < 5; v++) { g.beginPath(); g.moveTo(tip.x + 12, tip.y + 10 + v * 3); g.lineTo(tip.x + 2, tip.y + 16 + v * 2); g.stroke(); }
    }
    g.restore();
    // Destello rojo al clavarse.
    if (o.kind !== 'struggle' && t > 0.55 && t < 0.85) { g.fillStyle = 'rgba(200,0,0,' + (0.85 - t) * 2.4 + ')'; g.fillRect(0, 0, W, H); }
    var v2 = g.createRadialGradient(W / 2, H / 2, u * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    v2.addColorStop(0, 'rgba(0,0,0,0)'); v2.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = v2; g.fillRect(0, 0, W, H);
  }

  RM.Dama = { draw: draw, hook: hook, smoke: Smoke, closeup: closeup, C: C };
})(window.RM);
