const fs = require('fs');
const FILE_PATH = '/Users/mrchartist/FII DII Data/data/fpi_yearly_monthly.json';

const rawData = {
  "2009": [
    { "month": "January", "equity": -4245, "debt_general": 804, "total": -3441 },
    { "month": "February", "equity": -2437, "debt_general": -688, "total": -3125 },
    { "month": "March", "equity": 530, "debt_general": -6418, "total": -5888 },
    { "month": "April", "equity": 6510, "debt_general": 2488, "total": 8998 },
    { "month": "May", "equity": 20116, "debt_general": -2707, "total": 17409 },
    { "month": "June", "equity": 3831, "debt_general": 1069, "total": 4900 },
    { "month": "July", "equity": 11066, "debt_general": 2116, "total": 13182 },
    { "month": "August", "equity": 4906, "debt_general": -378, "total": 4528 },
    { "month": "September", "equity": 18346, "debt_general": 2228, "total": 20574 },
    { "month": "October", "equity": 9076, "debt_general": 6895, "total": 15971 },
    { "month": "November", "equity": 5498, "debt_general": 684, "total": 6182 },
    { "month": "December", "equity": 10234, "debt_general": -1522, "total": 8712 },
    { "total": { "equity": 83431, "debt_general": 4571, "total": 88002 } }
  ],
  "2008": [
    { "month": "January", "equity": -13035, "debt_general": 1951, "total": -11084 },
    { "month": "February", "equity": 1733, "debt_general": 2496, "total": 4229 },
    { "month": "March", "equity": -131, "debt_general": -880, "total": -1011 },
    { "month": "April", "equity": 1076, "debt_general": -1702, "total": -626 },
    { "month": "May", "equity": -5013, "debt_general": -163, "total": -5176 },
    { "month": "June", "equity": -10098, "debt_general": -999, "total": -11097 },
    { "month": "July", "equity": -1833, "debt_general": 3620, "total": 1787 },
    { "month": "August", "equity": -1210, "debt_general": 1256, "total": 46 },
    { "month": "September", "equity": -8280, "debt_general": 3206, "total": -5074 },
    { "month": "October", "equity": -15346, "debt_general": -1860, "total": -17206 },
    { "month": "November", "equity": -2598, "debt_general": 4217, "total": 1619 },
    { "month": "December", "equity": 1748, "debt_general": 629, "total": 2377 },
    { "total": { "equity": -52987, "debt_general": 11771, "total": -41216 } }
  ],
  "2007": [
    { "month": "January", "equity": 492, "debt_general": -2174, "total": -1682 },
    { "month": "February", "equity": 7239, "debt_general": 956, "total": 8195 },
    { "month": "March", "equity": -1081, "debt_general": 1443, "total": 362 },
    { "month": "April", "equity": 6678, "debt_general": 1041, "total": 7719 },
    { "month": "May", "equity": 3960, "debt_general": 1360, "total": 5320 },
    { "month": "June", "equity": 1640, "debt_general": -542, "total": 1098 },
    { "month": "July", "equity": 23873, "debt_general": -1264, "total": 22609 },
    { "month": "August", "equity": -7770, "debt_general": 607, "total": -7163 },
    { "month": "September", "equity": 16131, "debt_general": 2655, "total": 18786 },
    { "month": "October", "equity": 20591, "debt_general": 2500, "total": 23091 },
    { "month": "November", "equity": -5850, "debt_general": -468, "total": -6318 },
    { "month": "December", "equity": 5577, "debt_general": 3312, "total": 8889 },
    { "total": { "equity": 71480, "debt_general": 9426, "total": 80906 } }
  ],
  "2006": [
    { "month": "January", "equity": 3679, "debt_general": -921, "total": 2758 },
    { "month": "February", "equity": 7587, "debt_general": -151, "total": 7436 },
    { "month": "March", "equity": 6690, "debt_general": -259, "total": 6431 },
    { "month": "April", "equity": 523, "debt_general": 249, "total": 772 },
    { "month": "May", "equity": -7353, "debt_general": 706, "total": -6647 },
    { "month": "June", "equity": 480, "debt_general": 394, "total": 874 },
    { "month": "July", "equity": 1143, "debt_general": 154, "total": 1297 },
    { "month": "August", "equity": 4645, "debt_general": 804, "total": 5449 },
    { "month": "September", "equity": 5424, "debt_general": 708, "total": 6132 },
    { "month": "October", "equity": 8014, "debt_general": 657, "total": 8671 },
    { "month": "November", "equity": 9381, "debt_general": 805, "total": 10186 },
    { "month": "December", "equity": -3669, "debt_general": 900, "total": -2769 },
    { "total": { "equity": 36544, "debt_general": 4046, "total": 40590 } }
  ],
  "2005": [
    { "month": "January", "equity": 458, "debt_general": -774, "total": -316 },
    { "month": "February", "equity": 8375, "debt_general": 834, "total": 9209 },
    { "month": "March", "equity": 7501, "debt_general": 425, "total": 7926 },
    { "month": "April", "equity": -655, "debt_general": -821, "total": -1476 },
    { "month": "May", "equity": -1143, "debt_general": -246, "total": -1389 },
    { "month": "June", "equity": 5330, "debt_general": -70, "total": 5260 },
    { "month": "July", "equity": 7935, "debt_general": -172, "total": 7763 },
    { "month": "August", "equity": 5052, "debt_general": -430, "total": 4622 },
    { "month": "September", "equity": 4645, "debt_general": -187, "total": 4458 },
    { "month": "October", "equity": -3694, "debt_general": -934, "total": -4628 },
    { "month": "November", "equity": 4039, "debt_general": -2166, "total": 1873 },
    { "month": "December", "equity": 9337, "debt_general": -975, "total": 8362 },
    { "total": { "equity": 47180, "debt_general": -5516, "total": 41664 } }
  ]
};

const file = fs.readFileSync(FILE_PATH, 'utf8');
const data = JSON.parse(file);

for (const year of ['2009', '2008', '2007', '2006', '2005']) {
    const rawYear = rawData[year];
    const totalRow = rawYear.pop().total;
    data.years[year] = {
        months: rawYear,
        total: totalRow
    };
}

fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
console.log('Merged 2005-2009 data successfully.');
