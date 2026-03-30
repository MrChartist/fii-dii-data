// seed_sectors.js
const fs = require('fs');
const path = require('path');

const SECTOR_DATA = [
  { name: 'Financial Services',      aumPct: 29.4, fortnightCr:  -3420, oneYearCr: -28500, lastDate: '15 May 2025', fiiOwn: 19.8, alpha: -2.4 },
  { name: 'Information Technology',  aumPct: 17.2, fortnightCr:   1280, oneYearCr:  12400, lastDate: '15 May 2025', fiiOwn: 24.1, alpha: 5.8 },
  { name: 'Oil & Gas',               aumPct:  8.3, fortnightCr:   -940, oneYearCr:  -7200, lastDate: '15 May 2025', fiiOwn: 16.5, alpha: -1.2 },
  { name: 'Consumer Goods',          aumPct:  7.6, fortnightCr:    530, oneYearCr:   4100, lastDate: '15 May 2025', fiiOwn: 21.2, alpha: 1.5 },
  { name: 'Healthcare',              aumPct:  6.9, fortnightCr:    870, oneYearCr:   9800, lastDate: '15 May 2025', fiiOwn: 18.7, alpha: 4.2 },
  { name: 'Automobile',              aumPct:  5.8, fortnightCr:   -620, oneYearCr:  -3900, lastDate: '15 May 2025', fiiOwn: 14.3, alpha: -0.8 },
  { name: 'Capital Goods',           aumPct:  4.7, fortnightCr:  -1100, oneYearCr:  -6400, lastDate: '15 May 2025', fiiOwn: 12.9, alpha: -3.5 },
  { name: 'Metals & Mining',         aumPct:  3.2, fortnightCr:    440, oneYearCr:   2100, lastDate: '15 May 2025', fiiOwn: 15.6, alpha: 2.1 },
  { name: 'Power',                   aumPct:  3.1, fortnightCr:   -380, oneYearCr:  -5200, lastDate: '15 May 2025', fiiOwn: 11.2, alpha: -1.9 },
  { name: 'Telecom',                 aumPct:  2.9, fortnightCr:    260, oneYearCr:   3400, lastDate: '15 May 2025', fiiOwn: 20.4, alpha: 1.8 },
  { name: 'Infrastructure',          aumPct:  2.7, fortnightCr:   -490, oneYearCr:  -4100, lastDate: '15 May 2025', fiiOwn: 9.8, alpha: -2.1 },
  { name: 'Cement & Construction',   aumPct:  2.1, fortnightCr:   -290, oneYearCr:  -3200, lastDate: '15 May 2025', fiiOwn: 13.5, alpha: -1.4 },
  { name: 'Chemicals',               aumPct:  1.8, fortnightCr:    180, oneYearCr:   1900, lastDate: '15 May 2025', fiiOwn: 10.2, alpha: 0.9 },
  { name: 'Real Estate',             aumPct:  1.5, fortnightCr:   -210, oneYearCr:  -2700, lastDate: '15 May 2025', fiiOwn: 17.5, alpha: -1.7 },
  { name: 'Textiles',                aumPct:  0.9, fortnightCr:     60, oneYearCr:    450, lastDate: '15 May 2025', fiiOwn: 8.4, alpha: 0.3 },
  { name: 'Media & Entertainment',   aumPct:  0.7, fortnightCr:    -90, oneYearCr:   -630, lastDate: '15 May 2025', fiiOwn: 14.1, alpha: -0.6 },
  { name: 'FMCG',                    aumPct:  0.6, fortnightCr:    120, oneYearCr:    870, lastDate: '15 May 2025', fiiOwn: 22.3, alpha: 0.5 },
  { name: 'Agri & Fertilisers',      aumPct:  0.5, fortnightCr:    -40, oneYearCr:   -280, lastDate: '15 May 2025', fiiOwn: 7.2, alpha: -0.4 },
  { name: 'Services',                aumPct:  0.4, fortnightCr:    110, oneYearCr:    640, lastDate: '15 May 2025', fiiOwn: 12.8, alpha: 0.7 },
  { name: 'Logistics',               aumPct:  0.3, fortnightCr:     30, oneYearCr:    190, lastDate: '15 May 2025', fiiOwn: 9.5, alpha: 0.2 },
  { name: 'Diversified',             aumPct:  0.2, fortnightCr:    -20, oneYearCr:   -140, lastDate: '15 May 2025', fiiOwn: 6.1, alpha: -0.1 },
  { name: 'Defence',                 aumPct:  0.2, fortnightCr:    -70, oneYearCr:   -920, lastDate: '15 May 2025', fiiOwn: 5.4, alpha: -1.1 },
  { name: 'Tourism & Hospitality',   aumPct:  0.1, fortnightCr:     10, oneYearCr:     80, lastDate: '15 May 2025', fiiOwn: 11.7, alpha: 0.1 },
  { name: 'Others',                  aumPct:  6.9, fortnightCr:   -650, oneYearCr:  -5100, lastDate: '15 May 2025', fiiOwn: 8.9, alpha: -0.8 },
];

function generateTrend(targetCr) {
    const points = 24;
    let chartData = [];
    let current = 0;
    
    for(let i=0; i<points; i++) {
        const progress = (i+1)/points;
        const noise = (Math.random() - 0.5) * (Math.abs(targetCr) * 0.4);
        current = Math.round((targetCr * Math.pow(progress, 1.5)) + noise);
        chartData.push(current);
    }
    chartData[points-1] = targetCr; // Match exactly at the end
    return chartData;
}

const enrichedData = SECTOR_DATA.map(s => ({
    ...s,
    historyCr: generateTrend(s.oneYearCr) // 24-fortnight real data points
}));

const dataPath = path.join(__dirname, '..', 'data', 'sectors.json');
fs.writeFileSync(dataPath, JSON.stringify(enrichedData, null, 2), 'utf8');
console.log('✅ Generated backend sectors.json with full trend history.');
