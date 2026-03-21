const axios = require('axios');
const fs = require('fs');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function parseNum(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/,/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function stripHtml(str) {
    return String(str || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
}

axios.get('https://www.fpi.nsdl.co.in/web/Reports/Latest.aspx', { headers: HEADERS }).then(res => {
    const html = res.data;
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let m;
    while ((m = trRegex.exec(html)) !== null) {
        const cellMatches = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
        const cells = cellMatches.map(c => stripHtml(c[1]));
        if (cells.length >= 3) rows.push(cells);
    }

    const compiled = [];
    let curDay = null;
    let mode = 'equity';

    for (const row of rows) {
        const label = row[0].trim();
        const lower = label.toLowerCase();
        
        // Skip irrelevant top rows
        if (/date|month|year|category|sr\./i.test(label) && !/^\d+\-/.test(label)) continue;
        
        // New Date Row identifies the start of Equity for that day
        if (/^\d{1,2}-[a-zA-Z]{3}-\d{4}$/.test(label)) {
            if (curDay) compiled.push(curDay);
            curDay = {
                date: label,
                equity_net: 0, debt_net: 0, hybrid_net: 0, total_net: 0
            };
            mode = 'equity';
        }
        
        if (!curDay) continue;

        if (lower.includes('debt-general')) mode = 'debt';
        else if (lower.includes('debt-vrr') || lower.includes('debt-far')) mode = 'debt';
        else if (lower.includes('hybrid')) mode = 'hybrid';
        else if (lower.includes('mutual funds')) mode = 'mf';
        else if (lower.includes('aifs')) mode = 'aif';
        else if (lower === 'total') continue; // overall total row

        const nums = row.slice(1).map(parseNum);
        const net = nums[2] || 0; // The 3rd value is exactly Net Investment
        
        // We sum the main category rows directly (date row, debt categories, hybrid, aifs)
        // because these rows have perfectly aligned 4 columns (Label, Purchase, Sales, Net)
        if (
            /^\d{1,2}-[a-zA-Z]{3}-\d{4}$/.test(label) || 
            lower.includes('debt-general') ||
            lower.includes('debt-vrr') ||
            lower.includes('debt-far') ||
            lower.includes('hybrid') ||
            lower.includes('aifs')
        ) {
            console.log(`Adding ${net} to ${mode} from row ${label}`);
            if (mode === 'equity') curDay.equity_net += net;
            else if (mode === 'debt') curDay.debt_net += net;
            else if (mode === 'hybrid') curDay.hybrid_net += net;
            else if (mode === 'aif') curDay.total_net += net; // Just tracking it in total for now
            
            curDay.total_net += net;
        }
    }
    
    if (curDay) compiled.push(curDay);
    
    console.log(JSON.stringify(compiled, null, 2));
});
