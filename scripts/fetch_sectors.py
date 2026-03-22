#!/usr/bin/env python3
# scripts/fetch_sectors.py
# ─────────────────────────────────────────────────────────────────────────────
# 100% NSE data — most accurate sector rotation calculations
#
#   1D  = percentChange                          ← NSE allIndices (direct)
#   1W  = (last - oneWeekAgoVal) / oneWeekAgoVal ← NSE allIndices (calculated)
#   1M  = perChange30d                           ← NSE allIndices (direct)
#   3M  = (last - close_63td_ago) / close_63td_ago ← niftyindices.com historical
#   1Y  = perChange365d                          ← NSE allIndices (direct)
#
# RS Rank, RRG Quadrant, Signal — auto-calculated
# ─────────────────────────────────────────────────────────────────────────────

import urllib.request, json, os, time, requests
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

SECTORS = [
    { 'name': 'Auto',          'nse': 'NIFTY AUTO',            'ni': 'NIFTY AUTO'               },
    { 'name': 'Banking',       'nse': 'NIFTY BANK',            'ni': 'NIFTY BANK'               },
    { 'name': 'Commodities',   'nse': 'NIFTY COMMODITIES',     'ni': 'NIFTY COMMODITIES'        },
    { 'name': 'Cons Durables', 'nse': 'NIFTY CONSR DURBL',     'ni': 'NIFTY CONSUMER DURABLES'  },
    { 'name': 'Consumption',   'nse': 'NIFTY CONSUMPTION',     'ni': 'NIFTY INDIA CONSUMPTION'  },
    { 'name': 'Defence',       'nse': 'NIFTY IND DEFENCE',     'ni': 'NIFTY INDIA DEFENCE'      },
    { 'name': 'Energy',        'nse': 'NIFTY ENERGY',          'ni': 'NIFTY ENERGY'             },
    { 'name': 'Finance',       'nse': 'NIFTY FIN SERVICE',     'ni': 'NIFTY FINANCIAL SERVICES' },
    { 'name': 'FMCG',          'nse': 'NIFTY FMCG',            'ni': 'NIFTY FMCG'               },
    { 'name': 'Healthcare',    'nse': 'NIFTY HEALTHCARE INDEX', 'ni': 'NIFTY HEALTHCARE'         },
    { 'name': 'Infra',         'nse': 'NIFTY INFRASTRUCTURE',  'ni': 'NIFTY INFRASTRUCTURE'     },
    { 'name': 'IT',            'nse': 'NIFTY IT',              'ni': 'NIFTY IT'                 },
    { 'name': 'Media',         'nse': 'NIFTY MEDIA',           'ni': 'NIFTY MEDIA'              },
    { 'name': 'Metal',         'nse': 'NIFTY METAL',           'ni': 'NIFTY METAL'              },
    { 'name': 'OilGas',        'nse': 'NIFTY OIL AND GAS',     'ni': 'NIFTY OIL AND GAS'        },
    { 'name': 'Pharma',        'nse': 'NIFTY PHARMA',          'ni': 'NIFTY PHARMA'             },
    { 'name': 'PSE',           'nse': 'NIFTY PSE',             'ni': 'NIFTY PSE'                },
    { 'name': 'PSUBank',       'nse': 'NIFTY PSU BANK',        'ni': 'NIFTY PSU BANK'           },
    { 'name': 'PVTBank',       'nse': 'NIFTY PVT BANK',        'ni': 'NIFTY PRIVATE BANK'       },
    { 'name': 'Realty',        'nse': 'NIFTY REALTY',          'ni': 'NIFTY REALTY'             },
    { 'name': 'Service',       'nse': 'NIFTY SERV SECTOR',     'ni': 'NIFTY SERVICES SECTOR'    },
    { 'name': 'SmallCap',      'nse': 'NIFTY SMLCAP 100',      'ni': 'NIFTY SMALLCAP 100'       },
]

def safe_float(v):
    try:
        return float(str(v).replace(',','')) if v not in (None,'','-','NaN') else None
    except: return None

def pct(current, old):
    if not current or not old or old == 0: return None
    return round((current - old) / old * 100, 2)

def fmt(v):
    return 'N/A' if v is None else f"{'+'if v>=0 else ''}{v:.2f}%"

# ── Fetch NSE allIndices ──────────────────────────────────────────────────
def fetch_nse_all():
    req = urllib.request.Request(
        'https://www.nseindia.com/api/allIndices',
        headers={
            'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
            'Accept':          'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer':         'https://www.nseindia.com/',
        }
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        data = json.loads(res.read().decode('utf-8'))
    return {(d.get('indexSymbol') or '').upper().strip(): d for d in data.get('data', [])}

# ── Fetch 3M from niftyindices.com ───────────────────────────────────────
def fetch_3m_niftyindices(sectors_data):
    print('\n📈 Fetching 3M from niftyindices.com...')
    try:
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        })
        session.get('https://niftyindices.com/reports/historical-data', timeout=30)
        time.sleep(2)
    except Exception as e:
        print(f'  ⚠️  Session failed: {e}')
        return

    today = datetime.now()
    # Fetch 100 calendar days to get ~63 trading days
    from_date = (today - timedelta(days=100)).strftime('%b %d %Y')
    to_date   = today.strftime('%b %d %Y')

    for s in sectors_data:
        ni_name = next((x['ni'] for x in SECTORS if x['name'] == s['name']), None)
        if not ni_name or s.get('last') is None:
            continue
        try:
            payload = json.dumps({'cinfo': json.dumps({
                'name': ni_name,
                'startDate': from_date,
                'endDate': to_date,
                'indexName': ni_name
            })})
            res = session.post(
                'https://niftyindices.com/Backpage.aspx/getHistoricaldatatabletoString',
                data=payload,
                headers={
                    'Content-Type':   'application/json; charset=UTF-8',
                    'Accept':         'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer':        'https://niftyindices.com/reports/historical-data',
                },
                timeout=45
            )
            hist = json.loads(json.loads(res.text)['d'])
            if len(hist) >= 10:
                current_close = safe_float(hist[0]['CLOSE'])
                # 63 trading days ≈ 3 months
                idx_3m = min(63, len(hist) - 1)
                close_3m = safe_float(hist[idx_3m]['CLOSE'])
                date_3m  = hist[idx_3m]['HistoricalDate']
                s['r3m'] = pct(current_close, close_3m)
                print(f'  ✅ {s["name"].ljust(16)} 3M: {fmt(s["r3m"])}  (vs {date_3m}  close={close_3m})')
            time.sleep(1)
        except Exception as e:
            print(f'  ⚠️  {s["name"].ljust(16)} 3M failed: {str(e)[:50]}')
            time.sleep(1)

# ── RS Rank, RRG, Signal ──────────────────────────────────────────────────
def calculate_signals(sectors):
    valid = sorted([s for s in sectors if s.get('r1m') is not None],
                   key=lambda s: s['r1m'], reverse=True)
    total = len(valid)
    for i, s in enumerate(valid):
        rank = i + 1
        s['rsRank'] = rank
        pp  = rank / total
        mom = 'rising'  if (s.get('r1w') or 0) > 0.5  else \
              'falling' if (s.get('r1w') or 0) < -0.5 else 'flat'
        if   pp <= 0.25 and mom != 'falling': s['rrg']='Leading';   s['signal']='OVERWEIGHT'
        elif pp <= 0.25:                       s['rrg']='Weakening'; s['signal']='REDUCE'
        elif pp <= 0.55 and mom=='rising':     s['rrg']='Improving'; s['signal']='ACCUMULATE'
        elif pp <= 0.55:                       s['rrg']='Neutral';   s['signal']='HOLD'
        elif pp > 0.80:                        s['rrg']='Lagging';   s['signal']='EXIT'
        else:                                  s['rrg']='Weakening'; s['signal']='REDUCE'
    for s in sectors:
        if s.get('r1m') is None:
            s.update({'rsRank': None, 'rrg': None, 'signal': None})
    return sectors

# ── Main ──────────────────────────────────────────────────────────────────
def fetch_sectors():
    now_ist  = datetime.now(IST)
    day_name = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][now_ist.weekday()]

    print('━' * 65)
    print(f'🔄 NSE Sector Rotation — {day_name} {now_ist.strftime("%Y-%m-%d %H:%M")} IST')
    print('   1D / 1W / 1M / 1Y → NSE allIndices (direct)')
    print('   3M                → niftyindices.com historical (63 trading days)')
    print('   RS Rank / RRG / Signal → auto-calculated')
    print('━' * 65 + '\n')

    # Step 1: NSE allIndices
    print('📡 Fetching NSE allIndices...')
    try:
        index_map = fetch_nse_all()
        print(f'   ✅ Got {len(index_map)} indices\n')
    except Exception as e:
        print(f'   ❌ Failed: {e}')
        write_output([]); return

    # Step 2: Extract each sector
    sectors = []
    for s in SECTORS:
        nse_sym = s['nse'].upper().strip()
        found   = index_map.get(nse_sym)
        if not found:
            for sym, idx in index_map.items():
                if nse_sym in sym or sym in nse_sym:
                    found = idx; break

        if found:
            current = safe_float(found.get('last'))
            prev    = safe_float(found.get('previousClose'))
            wk1     = safe_float(found.get('oneWeekAgoVal'))
            r1d     = safe_float(found.get('percentChange'))
            r1w     = pct(current, wk1)
            r1m     = safe_float(found.get('perChange30d')) or pct(current, safe_float(found.get('oneMonthAgoVal')))
            r1y     = safe_float(found.get('perChange365d'))

            entry = {
                'name':     s['name'],
                'source':   'NSE',
                'last':     current,
                'lastDate': found.get('previousDay', now_ist.strftime('%d-%b-%Y')),
                'r1d': r1d, 'r1w': r1w, 'r1m': r1m, 'r3m': None, 'r1y': r1y,
            }
            sectors.append(entry)
            print(f"  ✅ {s['name'].ljust(16)}  1D:{fmt(r1d).rjust(8)}  1W:{fmt(r1w).rjust(8)}  1M:{fmt(r1m).rjust(8)}  1Y:{fmt(r1y).rjust(8)}")
        else:
            print(f"  ⚠️  {s['name'].ljust(16)} NOT FOUND")
            sectors.append({'name':s['name'],'source':'NSE','last':None,'lastDate':None,
                            'r1d':None,'r1w':None,'r1m':None,'r3m':None,'r1y':None})

    # Step 3: 3M from niftyindices.com
    fetch_3m_niftyindices(sectors)

    # Step 4: RS Rank, RRG, Signal
    sectors = calculate_signals(sectors)

    # Summary
    valid  = [s for s in sectors if s.get('r1d') is not None]
    ranked = sorted([s for s in sectors if s.get('rsRank')], key=lambda x: x['rsRank'])
    with_3m = [s for s in sectors if s.get('r3m') is not None]

    print('\n' + '━' * 65)
    print(f'📊 {len(valid)}/{len(sectors)} sectors | 3M data: {len(with_3m)}/{len(sectors)}')
    print(f'📅 As of: {now_ist.strftime("%d %b %Y %H:%M IST")}')
    if ranked:
        print('\n🏆 Top 5 (RS Rank by 1M):')
        for s in ranked[:5]:
            print(f"   #{s['rsRank']} {s['name'].ljust(16)} 1M:{fmt(s.get('r1m')).rjust(8)}  3M:{fmt(s.get('r3m')).rjust(8)}  {s.get('rrg')} → {s.get('signal')}")
        print('📉 Bottom 5:')
        for s in ranked[-5:]:
            print(f"   #{s['rsRank']} {s['name'].ljust(16)} 1M:{fmt(s.get('r1m')).rjust(8)}  3M:{fmt(s.get('r3m')).rjust(8)}  {s.get('rrg')} → {s.get('signal')}")

    write_output(sectors)

def write_output(sectors):
    out = {
        '_updated_at': datetime.now(timezone.utc).isoformat(),
        '_source':     'NSE allIndices (1D/1W/1M/1Y) + niftyindices.com (3M = 63 trading days)',
        '_note':       '1D=NSE percentChange | 1W=(last-1wkAgo)/1wkAgo | 1M=NSE perChange30d | 3M=niftyindices 63td | 1Y=NSE perChange365d',
        'sectors':     sectors
    }
    out_dir  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
    out_path = os.path.join(out_dir, 'sector-returns.json')
    os.makedirs(out_dir, exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(out, f, indent=2)
    print(f'\n✅ Saved {len(sectors)} sectors → data/sector-returns.json')
    print('━' * 65)

if __name__ == '__main__':
    fetch_sectors()
