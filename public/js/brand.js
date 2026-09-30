/* Central brand registry + reusable branding components.
 * Product: FII & DII Data (keeps its own icon/name/accent). Parent: Mr. Chartist (monochrome logo, "By" endorsement).
 * Every page loads this before os27-ui.js; no other file should hard-code a logo path. */
(function (w) {
  'use strict';
  var BASE = '/brand';
  var B = {
    product: {
      name: 'FII & DII Data',
      accent: 'hsl(16 100% 60%)',
      mark: BASE + '/product/mark-64.png',
      mark2x: BASE + '/product/mark-128.png'
    },
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

  /* Product identity: own icon + own name (+ accent dot). size: 'nav' | 'topbar' | 'footer' */
  B.productLockup = function (o) {
    o = o || {};
    var size = o.size || 'nav';
    return '<span class="mc-product mc-product--' + size + '">' +
      '<img class="mc-product__mark" src="' + B.product.mark + '" srcset="' + B.product.mark + ' 1x, ' + B.product.mark2x + ' 2x" alt="" width="28" height="28" decoding="async">' +
      '<span class="mc-product__name">' + esc(B.product.name) + '</span><i class="os-dot-accent" aria-hidden="true"></i></span>';
  };

  /* "By Mr. Chartist": black logo on light surfaces, white on dark (CSS switches on [data-theme]). size: 'nav' | 'footer' | 'modal' */
  B.endorsement = function (o) {
    o = o || {};
    var size = o.size || 'nav';
    return '<a class="mc-endorse mc-endorse--' + size + '" href="' + B.parent.url + '" target="_blank" rel="noopener" aria-label="By ' + B.parent.name + '">' +
      '<span class="mc-endorse__by" aria-hidden="true">By</span>' +
      '<img class="mc-logo mc-logo--on-light" src="' + B.parent.logoOnLight + '" alt="" decoding="async">' +
      '<img class="mc-logo mc-logo--on-dark" src="' + B.parent.logoOnDark + '" alt="" decoding="async"></a>';
  };

  /* Static colour variant for canvas/html2canvas exports, where the theme is known at call time. */
  B.endorsementFor = function (isLight) {
    return { by: 'By', src: isLight ? B.parent.logoOnLight : B.parent.logoOnDark };
  };
  w.MCBrand = B;
})(window);
