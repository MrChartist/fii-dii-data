/* Large-display scaling: the layout is authored for ~1400px. On QHD/4K
   viewports it would sit as a small column with 14px text, so scale the whole
   UI up proportionally (2560px → 1.35x, 3840px → 2x). Text, borders and charts
   are vector/retina-rendered, so they stay sharp. */
(function () {
  var d = document.documentElement;
  function apply() {
    var w = window.innerWidth || d.clientWidth || 0;
    var z = w >= 2200 ? Math.min(2, w / 1920) : 1;
    z = Math.round(z * 20) / 20;
    if ((window.MC_ZOOM || 1) === z) return;
    window.MC_ZOOM = z;
    d.style.zoom = z > 1 ? z : '';
    d.style.setProperty('--mc-zoom', z);
    try { window.dispatchEvent(new CustomEvent('mc-zoom', { detail: z })); } catch (e) {}
  }
  apply();
  window.addEventListener('resize', apply);
})();
