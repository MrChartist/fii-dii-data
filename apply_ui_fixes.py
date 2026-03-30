import re
import os

with open("public/index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Replace the LATEST EXTRACTED SESSION HTML
html = html.replace(
    '<div class="c-title" style="color:var(--blue); font-size:18px;">Latest Extracted Session</div>',
    '<div class="c-title" style="color:var(--t1); font-size:18px; margin-bottom:4px;">Latest Extracted Session</div>\n          <div style="display:flex; gap:12px; font-size:10px; font-weight:700; color:var(--green); margin-bottom:12px;">\n            <span style="display:flex; align-items:center; gap:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Cash Synced</span>\n            <span style="display:flex; align-items:center; gap:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> F&O Synced</span>\n          </div>'
)

# 2. Replace standard emoji strings
replacements = {
    '📷 Export': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg> Export',
    '>📷<': '><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:2px;"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg><',
    
    # Title Icon Emojis
    '>🗄️<': '><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg><',
    '>📈<': '><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg><',
    '>🎲<': '><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="m9 12 6-6M9 12l6 6"/></svg><',
    '>📖<': '><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><',
    '📊 Institutional Flow Canvas': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Institutional Flow Canvas',
    '📊 Open Interest Breakdown': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="m9 12 6-6M9 12l6 6"/></svg> Open Interest Breakdown',
    '🌐 Sector-Wise FII / FPI Allocation': 'Sector-Wise FII / FPI Allocation',
    
    # Chart Buttons
    '📊 Hide Sector Chart': 'Hide Sector Chart',
    '📊 View Interactive Sector Chart': 'View Interactive Sector Chart',
    '📉 Hide Positioning Chart': 'Hide Positioning Chart',
    '📉 Show Historical Positioning Chart': 'Show Historical Positioning Chart',
    
    # Subtabs
    '📅 Daily': 'Daily',
    '📊 Weekly': 'Weekly',
    '📆 Monthly': 'Monthly',
    '📈 Annual': 'Annual',
    
    # Signal Emojis
    '🔥': '',
    '🔴': '',
    '🟢': '',
    '🔵': '',
    '🟡': '',
    '🔶': '',
    '⚠️': '',
    '🚨': '',
    '💡': '',
    
    # Header Icon
    '<div class="header-icon">📊</div>': '<div class="header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg></div>'
}

for old, new in replacements.items():
    html = html.replace(old, new)


# 3. Handle the emojis in the sector hardcoded array via Regex
# format: emoji: '🏦' -> to just be removed, or replaced with an SVG?
# Let's just remove the emoji property and the UI handles it cleanly or we keep it empty.
html = re.sub(r"emoji:\s*'[^']+',", "", html)

with open("public/index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("Applied UI fixes to index.html successfully.")
