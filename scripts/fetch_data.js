const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const NSE_API = "https://www.nseindia.com/api/fiidiiTradeReact";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive"
};

/**
 * Fetch cash data from NSE API
 */
async function fetchNSE() {
    try {
        const response = await axios.get(NSE_API, { headers: HEADERS, timeout: 25000 });
        return response.data;
    } catch (error) {
        console.error("Failed to fetch NSE cash data:", error.message);
        throw error;
    }
}

/**
 * Fetch F&O Open Interest CSV
 */
async function fetchFaoOi(dateStr) {
    // Expected dateStr Format: "16-Mar-2026"
    const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]];
    const year = parts[2];
    const formattedDate = `${day}${month}${year}`;
    
    const url = `https://nsearchives.nseindia.com/content/nsccl/fao_participant_oi_${formattedDate}.csv`;
    
    try {
        const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        return response.data;
    } catch (error) {
        // Fallback with 'b' if needed, though previously we determined NSE dropped the 'b' frequently recently
        console.error("Warning: Failed to fetch F&O data from URL:", url, error.message);
        return null;
    }
}

/**
 * Parse FII & DII from the CSV string, now including Stock Futures
 */
function parseFao(csvText) {
    const faoData = {};
    if (!csvText) return faoData;

    try {
        // Find where the actual header begins
        const lines = csvText.trim().split('\n');
        // Usually, row 0 is a title row like "Participant wise...", row 1 is headers
        if (lines.length < 2) return faoData;
        
        const records = parse(lines.slice(1).join('\n'), {
            skip_empty_lines: true,
            relax_column_count: true
        });

        // Loop over parsed records (skipping header row inherently if it was row 0 of the subset)
        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            if (!row || row.length < 14) continue;
            
            const clientType = (row[0] || "").trim().toUpperCase();
            
            if (clientType.includes("FII") || clientType.includes("DII")) {
                const getInt = (val) => {
                    if (!val) return 0;
                    const parsed = parseInt(val.trim(), 10);
                    return isNaN(parsed) ? 0 : parsed;
                };

                const key = clientType.includes("FII") ? "FII" : "DII";
                
                faoData[key] = {
                    idx_fut_long: getInt(row[1]),
                    idx_fut_short: getInt(row[2]),
                    stk_fut_long: getInt(row[3]), // Added Stock Futures Long
                    stk_fut_short: getInt(row[4]), // Added Stock Futures Short
                    idx_call_long: getInt(row[5]),
                    idx_call_short: getInt(row[6]),
                    idx_put_long: getInt(row[7]),
                    idx_put_short: getInt(row[8]),
                };
            }
        }
    } catch (e) {
        console.error("Error parsing CSV:", e.message);
    }
    
    return faoData;
}

/**
 * Transform data into flat structure for dashboard JSON
 */
async function transformData(rawCash, rawFaoCsv) {
    const out = {
        date: "",
        fii_buy: 0, fii_sell: 0, fii_net: 0,
        dii_buy: 0, dii_sell: 0, dii_net: 0,
        fii_idx_fut_long: 0, fii_idx_fut_short: 0, fii_idx_fut_net: 0,
        dii_idx_fut_long: 0, dii_idx_fut_short: 0, dii_idx_fut_net: 0,
        fii_stk_fut_long: 0, fii_stk_fut_short: 0, fii_stk_fut_net: 0, // Stock futures
        dii_stk_fut_long: 0, dii_stk_fut_short: 0, dii_stk_fut_net: 0, // Stock futures
        fii_idx_call_long: 0, fii_idx_call_short: 0, fii_idx_call_net: 0,
        fii_idx_put_long: 0, fii_idx_put_short: 0, fii_idx_put_net: 0,
    };

    // 1. Process Cash Data
    for (const row of rawCash) {
        const cat = (row.category || "").toUpperCase();
        if (cat.includes("FII") || cat.includes("FPI")) {
            out.fii_buy = parseFloat(row.buyValue || 0);
            out.fii_sell = parseFloat(row.sellValue || 0);
            out.fii_net = parseFloat(row.netValue || 0);
            out.date = row.date || "";
        } else if (cat.includes("DII")) {
            out.dii_buy = parseFloat(row.buyValue || 0);
            out.dii_sell = parseFloat(row.sellValue || 0);
            out.dii_net = parseFloat(row.netValue || 0);
        }
    }

    // 2. Process & Merge F&O Data
    if (out.date && rawFaoCsv) {
        const faoParsed = parseFao(rawFaoCsv);
        
        if (faoParsed["FII"]) {
            const f = faoParsed["FII"];
            out.fii_idx_fut_long = f.idx_fut_long;
            out.fii_idx_fut_short = f.idx_fut_short;
            out.fii_idx_fut_net = f.idx_fut_long - f.idx_fut_short;
            
            // Stock Futures mapping
            out.fii_stk_fut_long = f.stk_fut_long;
            out.fii_stk_fut_short = f.stk_fut_short;
            out.fii_stk_fut_net = f.stk_fut_long - f.stk_fut_short;
            
            out.fii_idx_call_long = f.idx_call_long;
            out.fii_idx_call_short = f.idx_call_short;
            out.fii_idx_call_net = f.idx_call_long - f.idx_call_short;
            
            out.fii_idx_put_long = f.idx_put_long;
            out.fii_idx_put_short = f.idx_put_short;
            out.fii_idx_put_net = f.idx_put_long - f.idx_put_short;
        }
        
        if (faoParsed["DII"]) {
            const d = faoParsed["DII"];
            out.dii_idx_fut_long = d.idx_fut_long;
            out.dii_idx_fut_short = d.idx_fut_short;
            out.dii_idx_fut_net = d.idx_fut_long - d.idx_fut_short;
            
            out.dii_stk_fut_long = d.stk_fut_long;
            out.dii_stk_fut_short = d.stk_fut_short;
            out.dii_stk_fut_net = d.stk_fut_long - d.stk_fut_short;
        }
    }

    const now = new Date();
    out._updated_at = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: 'medium', timeStyle: 'short' }) + " IST";
    out._source = "node-cron-server";
    
    return out;
}

/**
 * Handle appending/updating the local history.json
 */
function updateHistory(latest) {
    const historyPath = path.join(__dirname, '..', 'data', 'history.json');
    let history = [];
    
    try {
        if (fs.existsSync(historyPath)) {
            const rawData = fs.readFileSync(historyPath, 'utf8');
            history = JSON.parse(rawData);
        }
    } catch (e) {
        history = [];
    }
    
    // Filter out duplicates
    history = history.filter(row => row.date !== latest.date);
    
    // Add today to the start
    history.unshift(latest);
    
    // Maintain maximum rolling window sizes
    history = history.slice(0, 60);
    
    // Ensure dir exists
    const dataDir = path.dirname(historyPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    return history;
}

/**
 * Master Execution Logic
 */
async function fetchAndProcessData() {
    console.log(`[${new Date().toISOString()}] Starting integrated data fetch pipeline...`);
    
    try {
        const rawCash = await fetchNSE();
        
        let targetDate = "";
        for (const row of rawCash) {
            const cat = (row.category || "").toUpperCase();
            if (cat.includes("FII") || cat.includes("FPI") || cat.includes("DII")) {
                targetDate = row.date || "";
                break;
            }
        }
        
        let rawFaoCsv = null;
        if (targetDate) {
            rawFaoCsv = await fetchFaoOi(targetDate);
        }
        
        const data = await transformData(rawCash, rawFaoCsv);
        
        if (!data.date) {
            console.log("❌ No data returned from NSE. Market might be closed.");
            return null;
        }

        console.log(`✅ Extracted Matrix - Date: ${data.date}`);
        console.log(`   [CASH] FII Net: ${data.fii_net} | DII Net: ${data.dii_net}`);
        console.log(`   [F&O ] FII Idx Fut Net: ${data.fii_idx_fut_net || 0} | Call Net: ${data.fii_idx_call_net || 0} | Put Net: ${data.fii_idx_put_net || 0}`);
        console.log(`   [STK ] FII Stk Fut Net: ${data.fii_stk_fut_net || 0} | DII Stk Fut Net: ${data.dii_stk_fut_net || 0}`);

        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(dataDir, 'latest.json'), JSON.stringify(data, null, 2));
        updateHistory(data);
        
        console.log("💾 JSON databases updated successfully.");
        return data;
        
    } catch (error) {
        console.error("❌ Critical Pipeline Error:", error);
    }
}

// Allow CLI execution
if (require.main === module) {
    fetchAndProcessData();
}

module.exports = {
    fetchAndProcessData
};
