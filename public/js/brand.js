/* Central brand registry + reusable branding components.
 * Main identity: the approved Mr. Chartist logo (monochrome: black on light, white on dark).
 * "FII & DII Data" is the product name shown beside it. No other file should hard-code a logo path. */
(function (w) {
  'use strict';
  var BASE = '/brand';
  var B = {
    product: { name: 'FII & DII Data', accent: 'hsl(16 100% 60%)' },
    parent: {
      name: 'Mr. Chartist',
      url: 'https://mrchartist.com',
      logoOnLight: BASE + '/mr-chartist/logo-horizontal-black.svg',
      logoOnDark: BASE + '/mr-chartist/logo-horizontal-white.svg',
      symbolOnLight: BASE + '/mr-chartist/symbol-black.svg',
      symbolOnDark: BASE + '/mr-chartist/symbol-white.svg'
    }
  };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function imgs(cls, light, dark) {
    return '<img class="mc-img mc-img--on-light ' + cls + '" src="' + light + '" alt="" decoding="async">' +
           '<img class="mc-img mc-img--on-dark ' + cls + '" src="' + dark + '" alt="" decoding="async">';
  }

  /* Main lockup: Mr. Chartist logo | FII & DII Data.
   * size: 'nav' (full logo >1360px, symbol below) | 'topbar' (symbol) | 'footer' (large logo + product name) */
  B.lockup = function (o) {
    var size = (o && o.size) || 'nav';
    return '<span class="mc-lockup mc-lockup--' + size + '">' +
      imgs('mc-full', B.parent.logoOnLight, B.parent.logoOnDark) +
      imgs('mc-sym', B.parent.symbolOnLight, B.parent.symbolOnDark) +
      '<i class="mc-lockup__sep" aria-hidden="true"></i>' +
      '<span class="mc-lockup__product">' + esc(B.product.name) + '</span><i class="os-dot-accent" aria-hidden="true"></i></span>';
  };

  /* Logo for canvas/html2canvas exports, where the theme is known at call time. */
  B.logoFor = function (isLight) { return isLight ? B.parent.logoOnLight : B.parent.logoOnDark; };
  w.MCBrand = B;
})(window);
