/**
 * build_isin_map.js
 * 
 * Fetches the Nifty 500 list from NSE to map top 500 company ISINs to their
 * respective macroeconomic Industries (Sectors).
 * The resulting map is saved to `data/isin_sector_map.json` and vastly 
 * expands the sector mapping capability compared to the hardcoded default.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const NIFTY_500_URL = 'https://archives.nseindia.com/content/indices/ind_nifty500list.csv';
const DATA_DIR = path.join(process.cwd(), 'data');
const OUT_FILE = path.join(DATA_DIR, 'isin_sector_map.json');

async function buildMap() {
    console.log('[ISIN MAP] Fetching Nifty 500 list from NSE...');
    
    try {
        const response = await axios.get(NIFTY_500_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/csv'
            },
            timeout: 10000
        });

        const lines = response.data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // CSV Headers: Company Name, Industry, Symbol, Series, ISIN Code
        if (lines.length < 2) {
            throw new Error('CSV seems empty or invalid.');
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const isinIdx = headers.indexOf('ISIN Code');
        const indIdx = headers.indexOf('Industry');

        if (isinIdx === -1 || indIdx === -1) {
            throw new Error('Could not find ISIN Code or Industry columns.');
        }

        // We also want to merge with the existing DEFAULT_ISIN_SECTOR_MAP 
        // from fetch_tradewise_backfill.js just in case any are missing from Nifty 500
        const isinMap = {};

        // Merge defaults first
        const defaults = {
            'INE009A01021': 'Financial Services',
            'INE040A01034': 'Financial Services',
            'INE062A01020': 'Financial Services',
            'INE090A01021': 'Financial Services',
            'INE154A01025': 'Financial Services',
            'INE160A01022': 'Financial Services',
            'INE584A01023': 'Financial Services',
            'INE238A01034': 'Financial Services',
            'INE476A01022': 'Financial Services',
            'INE467B01029': 'Information Technology',
            'INE860A01027': 'Information Technology',
            'INE075A01022': 'Information Technology',
            'INE356A01018': 'Information Technology',
            'INE002A01018': 'Oil, Gas & Consumable Fuels',
            'INE213A01029': 'Oil, Gas & Consumable Fuels',
            'INE089A01023': 'Healthcare',
            'INE585B01010': 'Automobile and Auto Components',
            'INE917I01010': 'Automobile and Auto Components',
            'INE758T01015': 'Automobile and Auto Components',
            'INE030A01027': 'Fast Moving Consumer Goods',
            'INE047A01021': 'Fast Moving Consumer Goods',
            'INE081A01020': 'Metals & Mining',
            'INE752E01010': 'Power',
            'INE733E01010': 'Power',
        };
        Object.assign(isinMap, defaults);

        // Now parse Nifty 500
        let addedCount = 0;
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            if (parts.length < headers.length) continue;
            
            const isin = parts[isinIdx];
            const industry = parts[indIdx];
            
            if (isin && industry && isin.startsWith('INE')) {
                isinMap[isin] = industry;
                addedCount++;
            }
        }

        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        fs.writeFileSync(OUT_FILE, JSON.stringify(isinMap, null, 2));
        console.log(`[ISIN MAP] Successfully saved map. Size: ${Object.keys(isinMap).length} entries.`);
        console.log(`[ISIN MAP] (Added/Overwrote ${addedCount} from Nifty 500)`);

    } catch (err) {
        console.error('[ISIN MAP] Failed:', err.message);
        process.exit(1);
    }
}

buildMap();
