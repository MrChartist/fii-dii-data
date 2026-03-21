const fs = require('fs');
const FILE_PATH = '/Users/mrchartist/FII DII Data/data/fpi_yearly_monthly.json';

const rawData = {
  "2019": [
    { "month": "January", "equity": -4262, "debt_general": -1301, "total": -5556 },
    { "month": "February", "equity": 17220, "debt_general": -6037, "total": 12053 },
    { "month": "March", "equity": 33981, "debt_general": 12002, "total": 48751 },
    { "month": "April", "equity": 21193, "debt_general": -5099, "total": 16728 },
    { "month": "May", "equity": 7920, "debt_general": 1187, "total": 11370 },
    { "month": "June", "equity": 2596, "debt_general": 8319, "total": 13111 },
    { "month": "July", "equity": -12419, "debt_general": 9433, "total": -3003 },
    { "month": "August", "equity": -17592, "debt_general": 11672, "total": -5871 },
    { "month": "September", "equity": 7548, "debt_general": -990, "total": 6582 },
    { "month": "October", "equity": 12368, "debt_general": 3670, "total": 16069 },
    { "month": "November", "equity": 25231, "debt_general": -2358, "total": 22999 },
    { "month": "December", "equity": 7338, "debt_general": -4616, "total": 2762 },
    { "total": { "equity": 101122, "debt_general": 25882, "total": 135995 } }
  ],
  "2018": [
    { "month": "January", "equity": 13781, "debt_general": 8523, "total": 22272 },
    { "month": "February", "equity": -11423, "debt_general": -254, "total": -11674 },
    { "month": "March", "equity": 11654, "debt_general": -9044, "total": 2662 },
    { "month": "April", "equity": -5552, "debt_general": -10036, "total": -15561 },
    { "month": "May", "equity": -10060, "debt_general": -19654, "total": -29776 },
    { "month": "June", "equity": -4831, "debt_general": -10970, "total": -15795 },
    { "month": "July", "equity": 2264, "debt_general": 43, "total": 2264 },
    { "month": "August", "equity": 1775, "debt_general": 3414, "total": 5146 },
    { "month": "September", "equity": -10825, "debt_general": -10198, "total": -21035 },
    { "month": "October", "equity": -28921, "debt_general": -9978, "total": -38906 },
    { "month": "November", "equity": 5981, "debt_general": 5610, "total": 11595 },
    { "month": "December", "equity": 3143, "debt_general": 4749, "total": 7889 },
    { "total": { "equity": -33014, "debt_general": -47795, "total": -80919 } }
  ],
  "2017": [
    { "month": "January", "equity": -1177, "debt_general": -2319, "total": -3496 },
    { "month": "February", "equity": 9902, "debt_general": 5960, "total": 15862 },
    { "month": "March", "equity": 30906, "debt_general": 25355, "total": 56261 },
    { "month": "April", "equity": 2394, "debt_general": 20364, "total": 22758 },
    { "month": "May", "equity": 7711, "debt_general": 19155, "total": 26866 },
    { "month": "June", "equity": 3617, "debt_general": 25685, "total": 29302 },
    { "month": "July", "equity": 5161, "debt_general": 18867, "total": 24028 },
    { "month": "August", "equity": -12770, "debt_general": 15447, "total": 2677 },
    { "month": "September", "equity": -11392, "debt_general": 1349, "total": -10043 },
    { "month": "October", "equity": 3055, "debt_general": 16064, "total": 19119 },
    { "month": "November", "equity": 19728, "debt_general": 531, "total": 20258 },
    { "month": "December", "equity": -5883, "debt_general": 2350, "total": -3544 },
    { "total": { "equity": 51252, "debt_general": 148808, "total": 200048 } }
  ],
  "2016": [
    { "month": "January", "equity": -11127, "debt_general": 2313, "total": -8814 },
    { "month": "February", "equity": -5522, "debt_general": -8194, "total": -13716 },
    { "month": "March", "equity": 21142, "debt_general": -1477, "total": 19665 },
    { "month": "April", "equity": 8415, "debt_general": 6418, "total": 14833 },
    { "month": "May", "equity": 2542, "debt_general": -4409, "total": -1867 },
    { "month": "June", "equity": 3714, "debt_general": -6221, "total": -2507 },
    { "month": "July", "equity": 12611, "debt_general": 6847, "total": 19458 },
    { "month": "August", "equity": 9071, "debt_general": -2626, "total": 6445 },
    { "month": "September", "equity": 10444, "debt_general": 9789, "total": 20233 },
    { "month": "October", "equity": -4306, "debt_general": -6000, "total": -10306 },
    { "month": "November", "equity": -18244, "debt_general": -21151, "total": -39395 },
    { "month": "December", "equity": -8177, "debt_general": -18933, "total": -27110 },
    { "total": { "equity": 20563, "debt_general": -43644, "total": -23081 } }
  ],
  "2015": [
    { "month": "January", "equity": 12919, "debt_general": 20768, "total": 33687 },
    { "month": "February", "equity": 11475, "debt_general": 13089, "total": 24564 },
    { "month": "March", "equity": 12076, "debt_general": 8649, "total": 20725 },
    { "month": "April", "equity": 11721, "debt_general": 3610, "total": 15331 },
    { "month": "May", "equity": -5769, "debt_general": -8503, "total": -14272 },
    { "month": "June", "equity": -3344, "debt_general": 1737, "total": -1607 },
    { "month": "July", "equity": 5321, "debt_general": 2, "total": 5323 },
    { "month": "August", "equity": -16878, "debt_general": -646, "total": -17524 },
    { "month": "September", "equity": -6477, "debt_general": 690, "total": -5787 },
    { "month": "October", "equity": 6649, "debt_general": 15703, "total": 22352 },
    { "month": "November", "equity": -7074, "debt_general": -3754, "total": -10828 },
    { "month": "December", "equity": -2818, "debt_general": -5489, "total": -8307 },
    { "total": { "equity": 17801, "debt_general": 45856, "total": 63657 } }
  ]
};

const file = fs.readFileSync(FILE_PATH, 'utf8');
const data = JSON.parse(file);

for (const year of ['2019', '2018', '2017', '2016', '2015']) {
    const rawYear = rawData[year];
    const totalRow = rawYear.pop().total;
    data.years[year] = {
        months: rawYear,
        total: totalRow
    };
}

fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
console.log('Merged 2015-2019 data successfully.');
