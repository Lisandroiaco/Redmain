/* Red Main — utilidades compartidas y ajustes persistentes. */
window.RM = window.RM || {};
(function (RM) {
  'use strict';

  RM.rand = function (a, b) { return a + Math.random() * (b - a); };
  RM.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  RM.lerp = function (a, b, t) { return a + (b - a) * t; };
  RM.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  RM.easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  RM.smooth = function (a, b, x) { var t = RM.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  RM.canvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  // Puente nativo que expone la app Android (MainActivity.Bridge).
  RM.native = window.RedMainNative || null;
  RM.isApp = !!RM.native;

  RM.vibrate = function (pattern) {
    if (!RM.settings.vibration) return;
    try {
      if (RM.native && RM.native.vibrate) {
        RM.native.vibrate(Array.isArray(pattern) ? pattern.join(',') : String(pattern));
      } else if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) { /* sin vibración disponible */ }
  };

  var KEY = 'redmain.settings.v1';
  var defaults = { music: 0.6, sfx: 0.9, rain: 1, vibration: true, thunder: true, quality: 'alta' };
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  RM.settings = Object.assign({}, defaults, saved);
  RM.saveSettings = function () {
    try { localStorage.setItem(KEY, JSON.stringify(RM.settings)); } catch (e) { /* almacenamiento no disponible */ }
  };

  RM.qualityProfile = function () {
    var q = RM.settings.quality;
    var dpr = window.devicePixelRatio || 1;
    if (q === 'baja') return { dpr: 1, rain: 0.45, grain: false, embers: 0.5 };
    if (q === 'media') return { dpr: Math.min(dpr, 1.5), rain: 0.75, grain: true, embers: 0.8 };
    return { dpr: Math.min(dpr, 2), rain: 1, grain: true, embers: 1 };
  };
})(window.RM);
