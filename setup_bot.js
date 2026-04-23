// Set bot commands and description
require('dotenv').config();
const axios = require('axios');
const token = process.env.TELEGRAM_BOT_TOKEN;

async function setup() {
    // 1. Set commands
    const res1 = await axios.post(`https://api.telegram.org/bot${token}/setMyCommands`, {
        commands: [
            { command: 'latest', description: 'Today\'s full FII/DII report' },
            { command: 'fno', description: 'F&O derivatives positioning' },
            { command: 'sector', description: 'FPI sector rotation data' },
            { command: 'regime', description: 'Current market regime' },
            { command: 'weekly', description: 'Weekly institutional digest' },
            { command: 'start', description: 'Subscribe to alerts' },
            { command: 'stop', description: 'Unsubscribe from alerts' },
            { command: 'status', description: 'Bot status & data freshness' },
            { command: 'help', description: 'All commands' }
        ]
    });
    console.log('Commands:', res1.data.ok ? 'Set!' : res1.data);

    // 2. Set description (shown when user opens bot for first time)
    const res2 = await axios.post(`https://api.telegram.org/bot${token}/setMyDescription`, {
        description: 'Real-time FII & DII institutional money flow alerts for the Indian stock market.\n\nDaily cash flows, F&O derivatives positioning, sector rotation tracking, AI regime classification, and streak alerts.\n\nPowered by FlowMatrix | Mr. Chartist'
    });
    console.log('Description:', res2.data.ok ? 'Set!' : res2.data);

    // 3. Set short description (shown in chat list)
    const res3 = await axios.post(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
        short_description: 'FII/DII Flow Alerts | F&O Positioning | Sector Rotation | AI Regime \u2014 by Mr. Chartist'
    });
    console.log('Short desc:', res3.data.ok ? 'Set!' : res3.data);

    // 4. Set bot name
    const res4 = await axios.post(`https://api.telegram.org/bot${token}/setMyName`, {
        name: 'FlowMatrix \u2014 FII/DII Data'
    });
    console.log('Name:', res4.data.ok ? 'Set!' : res4.data);

    console.log('\nAll bot settings configured!');
}

setup().catch(e => console.error(e.response?.data || e.message));
