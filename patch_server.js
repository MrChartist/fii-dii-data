// Fix: remove duplicate content (lines 462-916 are a re-paste of the file header + old function)
const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const lines = s.split(/\r?\n/);
console.log('Original lines:', lines.length);

// Keep lines 1-461 (0-indexed: 0-460) + lines 917+ (0-indexed: 916+)
const keep = [...lines.slice(0, 461), ...lines.slice(916)];
console.log('New lines:', keep.length);

fs.writeFileSync('server.js', keep.join('\r\n'), 'utf8');
console.log('Fixed!');
