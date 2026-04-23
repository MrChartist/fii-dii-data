// Live test: send ALL message types to @official_mrchartist
require('dotenv').config();
const axios = require('axios');
const tg = require('./telegram');
const tgMsg = require('./telegram-messages');
const { getState } = require('./agents/agent-utils');

const token = process.env.TELEGRAM_BOT_TOKEN;
const channel = process.env.TELEGRAM_CHANNEL_ID;
const latest = require('./data/latest.json');

const regime = getState('regime-classifier');
const streak = getState('fii-streak');
const flowStrength = getState('flow-strength');
const flowDiv = getState('flow-divergence');
const weeklyDigest = getState('weekly-digest');
const sectorRotation = getState('sector-rotation');

let sectorData;
try { sectorData = require('./data/sector_latest.json'); } catch (e) { sectorData = null; }

const type = process.argv[2] || 'all';

async function send(label, msg) {
    console.log(`\n--- ${label} ---`);
    console.log(msg.substring(0, 200) + '...');
    await tg.sendToChannel(channel, msg, token, axios);
    console.log(`Sent ${label}!`);
}

async function run() {
    if (type === 'cash' || type === 'all') {
        const msg = tgMsg.buildCashFlowMessage(latest, regime, streak, flowStrength);
        await send('CASH FLOW', msg);
        await new Promise(r => setTimeout(r, 1500));
    }

    if (type === 'derivatives' || type === 'all') {
        const msg = tgMsg.buildDerivativesMessage(latest);
        await send('DERIVATIVES', msg);
        await new Promise(r => setTimeout(r, 1500));
    }

    if (type === 'sector' || type === 'all') {
        if (sectorData && sectorData.sectors) {
            const msg = tgMsg.buildSectorMessage(sectorData, sectorRotation);
            if (msg) await send('SECTOR ROTATION', msg);
        } else {
            console.log('No sector data available');
        }
        await new Promise(r => setTimeout(r, 1500));
    }

    if (type === 'weekly' || type === 'all') {
        const { getHistoryData } = require('./scripts/fetch_data');
        const history = getHistoryData(5);
        const msg = tgMsg.buildWeeklyDigestMessage(weeklyDigest, regime, streak, history);
        await send('WEEKLY DIGEST', msg);
        await new Promise(r => setTimeout(r, 1500));
    }

    if (type === 'morning' || type === 'all') {
        const msg = tgMsg.buildMorningBriefMessage(latest, regime, streak, flowDiv);
        await send('MORNING BRIEF', msg);
        await new Promise(r => setTimeout(r, 1500));
    }

    if (type === 'divergence' || type === 'all') {
        if (flowDiv && flowDiv.last_signal && flowDiv.last_signal !== 'NONE') {
            const msg = tgMsg.buildDivergenceMessage(flowDiv, latest);
            await send('DIVERGENCE ALERT', msg);
        } else {
            console.log('No active divergence signal');
        }
    }

    console.log('\nAll done!');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
