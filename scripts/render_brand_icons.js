// Rasterises brand-source/generated/* into public/brand/*. Needs: npm i --no-save playwright-core (+ a Chromium; set CHROME_PATH).
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), G = path.join(R, 'brand-source', 'generated');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  for (const f of fs.readdirSync(G).filter(f => f.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(G, f), 'utf8');
    const n = +/width="(\d+)"/.exec(svg)[1];
    const p = await b.newPage({ viewport: { width: n, height: n } });
    await p.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`);
    await p.screenshot({ path: path.join(R, 'public/brand/icons', f.replace('.svg', '.png')) });
    await p.close();
  }
  let p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('file://' + path.join(G, 'share-card.html')); await p.waitForTimeout(500);
  fs.mkdirSync(path.join(R, 'public/brand/share'), { recursive: true });
  await p.screenshot({ path: path.join(R, 'public/brand/share/og-fii-dii-data.png') });
  p = await b.newPage({ viewport: { width: 512, height: 512 } });
  await p.goto('file://' + path.join(G, 'parent-logo-512.html'));
  await p.screenshot({ path: path.join(R, 'public/brand/mr-chartist/symbol-black-512.png') });
  await b.close();
})();
