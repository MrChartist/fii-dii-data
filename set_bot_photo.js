// Set bot profile photo using InputProfilePhotoStatic format
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN;
const logoPath = process.argv[2] || path.join(__dirname, 'public', 'icons', 'icon-512x512.png');

if (!fs.existsSync(logoPath)) {
    console.error('File not found:', logoPath);
    process.exit(1);
}

const fileData = fs.readFileSync(logoPath);
const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

// Build multipart body with InputProfilePhotoStatic JSON + attached file
let body = '';
// Part 1: the photo JSON referencing the attached file
body += `--${boundary}\r\n`;
body += `Content-Disposition: form-data; name="photo"\r\n\r\n`;
body += `{"type":"static","photo":"attach://photo_file"}\r\n`;
// Part 2: the actual file
body += `--${boundary}\r\n`;
body += `Content-Disposition: form-data; name="photo_file"; filename="logo.png"\r\n`;
body += `Content-Type: image/png\r\n\r\n`;

const bodyStart = Buffer.from(body, 'utf8');
const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
const fullBody = Buffer.concat([bodyStart, fileData, bodyEnd]);

const url = new URL(`https://api.telegram.org/bot${token}/setMyProfilePhoto`);

const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            if (result.ok) {
                console.log('\u2705 Bot profile photo set successfully!');
            } else {
                console.error('Failed:', result.description);
            }
        } catch {
            console.log('Response:', data);
        }
    });
});

req.on('error', e => console.error('Error:', e.message));
req.write(fullBody);
req.end();
