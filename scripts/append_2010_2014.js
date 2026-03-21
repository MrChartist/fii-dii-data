const fs = require('fs');
const FILE_PATH = '/Users/mrchartist/FII DII Data/data/fpi_yearly_monthly.json';

const rawData = {
  "2014": [
    { "month": "January", "equity": 714, "debt_general": 12607, "total": 13321 },
    { "month": "February", "equity": 1405, "debt_general": 11336, "total": 12741 },
    { "month": "March", "equity": 20078, "debt_general": 11587, "total": 31665 },
    { "month": "April", "equity": 9600, "debt_general": -9185, "total": 418 },
    { "month": "May", "equity": 14007, "debt_general": 19771, "total": 33778 },
    { "month": "June", "equity": 13990, "debt_general": 16715, "total": 30705 },
    { "month": "July", "equity": 13110, "debt_general": 22935, "total": 36045 },
    { "month": "August", "equity": 5431, "debt_general": 16704, "total": 22135 },
    { "month": "September", "equity": 5104, "debt_general": 15869, "total": 20973 },
    { "month": "October", "equity": -1172, "debt_general": 17901, "total": 16729 },
    { "month": "November", "equity": 13756, "debt_general": 11723, "total": 25479 },
    { "month": "December", "equity": 1036, "debt_general": 11189, "total": 12225 },
    { "total": { "equity": 97059, "debt_general": 159152, "total": 256214 } }
  ],
  "2013": [
    { "month": "January", "equity": 22059, "debt_general": 2948, "total": 25007 },
    { "month": "February", "equity": 24440, "debt_general": 4000, "total": 28440 },
    { "month": "March", "equity": 9125, "debt_general": 5796, "total": 14921 },
    { "month": "April", "equity": 5413, "debt_general": 5334, "total": 10747 },
    { "month": "May", "equity": 22168, "debt_general": 5968, "total": 28136 },
    { "month": "June", "equity": -11027, "debt_general": -33135, "total": -44162 },
    { "month": "July", "equity": -6087, "debt_general": -12039, "total": -18126 },
    { "month": "August", "equity": -5923, "debt_general": -9775, "total": -15698 },
    { "month": "September", "equity": 13057, "debt_general": -5678, "total": 7379 },
    { "month": "October", "equity": 15706, "debt_general": -13581, "total": 2125 },
    { "month": "November", "equity": 8116, "debt_general": -5983, "total": 2133 },
    { "month": "December", "equity": 16087, "debt_general": 5291, "total": 21378 },
    { "total": { "equity": 113134, "debt_general": -50854, "total": 62280 } }
  ],
  "2012": [
    { "month": "January", "equity": 10355, "debt_general": 15970, "total": 26325 },
    { "month": "February", "equity": 25212, "debt_general": 10015, "total": 35227 },
    { "month": "March", "equity": 8382, "debt_general": -6588, "total": 1794 },
    { "month": "April", "equity": -1109, "debt_general": -3789, "total": -4898 },
    { "month": "May", "equity": -348, "debt_general": 3569, "total": 3221 },
    { "month": "June", "equity": -503, "debt_general": 1679, "total": 1176 },
    { "month": "July", "equity": 10276, "debt_general": 3391, "total": 13667 },
    { "month": "August", "equity": 10804, "debt_general": 264, "total": 11068 },
    { "month": "September", "equity": 19262, "debt_general": 623, "total": 19885 },
    { "month": "October", "equity": 11365, "debt_general": 7853, "total": 19218 },
    { "month": "November", "equity": 9579, "debt_general": 290, "total": 9869 },
    { "month": "December", "equity": 25086, "debt_general": 1704, "total": 26790 },
    { "total": { "equity": 128361, "debt_general": 34981, "total": 163342 } }
  ],
  "2011": [
    { "month": "January", "equity": -4813, "debt_general": 10179, "total": 5366 },
    { "month": "February", "equity": -4585, "debt_general": 1317, "total": -3268 },
    { "month": "March", "equity": 6896, "debt_general": -16, "total": 6880 },
    { "month": "April", "equity": 7211, "debt_general": -16, "total": 7195 },
    { "month": "May", "equity": -6613, "debt_general": 2338, "total": -4275 },
    { "month": "June", "equity": 4575, "debt_general": 310, "total": 4885 },
    { "month": "July", "equity": 8030, "debt_general": 2623, "total": 10653 },
    { "month": "August", "equity": -10836, "debt_general": 2932, "total": -7904 },
    { "month": "September", "equity": -159, "debt_general": -1706, "total": -1865 },
    { "month": "October", "equity": 1678, "debt_general": 1404, "total": 3082 },
    { "month": "November", "equity": -4198, "debt_general": 932, "total": -3266 },
    { "month": "December", "equity": 100, "debt_general": 21775, "total": 21875 },
    { "total": { "equity": -2714, "debt_general": 42072, "total": 39358 } }
  ],
  "2010": [
    { "month": "January", "equity": -499, "debt_general": 8914, "total": 8415 },
    { "month": "February", "equity": 1215, "debt_general": 3146, "total": 4361 },
    { "month": "March", "equity": 19927, "debt_general": 9511, "total": 29438 },
    { "month": "April", "equity": 9362, "debt_general": 3031, "total": 12393 },
    { "month": "May", "equity": -9438, "debt_general": 2451, "total": -6987 },
    { "month": "June", "equity": 10507, "debt_general": 740, "total": 11247 },
    { "month": "July", "equity": 16618, "debt_general": 8105, "total": 24723 },
    { "month": "August", "equity": 11685, "debt_general": 3000, "total": 14685 },
    { "month": "September", "equity": 24980, "debt_general": 7688, "total": 32668 },
    { "month": "October", "equity": 28561, "debt_general": -4261, "total": 24300 },
    { "month": "November", "equity": 18294, "debt_general": 2916, "total": 21210 },
    { "month": "December", "equity": 2048, "debt_general": 1166, "total": 3214 },
    { "total": { "equity": 133260, "debt_general": 46407, "total": 179667 } }
  ]
};

const file = fs.readFileSync(FILE_PATH, 'utf8');
const data = JSON.parse(file);

for (const year of ['2014', '2013', '2012', '2011', '2010']) {
    const rawYear = rawData[year];
    const totalRow = rawYear.pop().total;
    data.years[year] = {
        months: rawYear,
        total: totalRow
    };
}

fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
console.log('Merged 2010-2014 data successfully.');
