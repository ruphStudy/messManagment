import json, subprocess, urllib.request, datetime, random
import os as _os
B = _os.environ.get('MESS_TEST_BASE', 'http://localhost:4100/api/v1')
results = []
def req(method, path, body=None, token=None, mobile=False):
    headers = {}
    data = json.dumps(body).encode() if body is not None else None
    if data: headers['Content-Type'] = 'application/json'
    if token: headers['Authorization'] = f'Bearer {token}'
    if mobile: headers['x-client-type'] = 'MOBILE'
    r = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r) as res:
            t = res.read().decode(); return res.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or 'null')
def check(name, cond, info=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {str(info)[:600]}'))
def login(i): return req('POST', '/auth/login', {'identifier': i, 'password': 'Password123'})[1]['data']['accessToken']
def otp_login(m):
    code = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    return req('POST', '/auth/otp/verify', {'mobile': m, 'code': code}, mobile=True)[1]['data']['accessToken']
def psql(sql): return subprocess.run(['psql', '-tA', 'mess_management', '-c', sql], capture_output=True, text=True).stdout.strip()
today = subprocess.run(['node', '-e', "console.log(require('./packages/shared/dist').businessToday())"], capture_output=True, text=True).stdout.strip()
def add(d, n): return (datetime.date.fromisoformat(d) + datetime.timedelta(days=n)).isoformat()
messA = psql("select id from messes where name='Annapurna Student Mess'")
messB = psql("select id from messes where name='Sai Tiffin Service'")

CREDITS_SQL = """select coalesce(sum("remainingMealCredits"),0)||'/'||count(*) from student_subscriptions"""
credits_before = psql(CREDITS_SQL)
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
stuA = otp_login('9100000001'); stuB = otp_login('9100000099')

def meal(items, available=True, note=None): return {'available': available, 'items': items, 'note': note}
menu = lambda **kw: {'breakfast': kw.get('b', meal(['Poha'])), 'lunch': kw.get('l', meal(['Chapati', 'Dal'])), 'dinner': kw.get('d', meal(['Rice'])), 'generalNote': kw.get('g')}

# Flow A — draft vs publish, using a day inside the student's 7-day window
d = add(today, 3)
psql(f"delete from daily_menus where \"messId\" in ('{messA}','{messB}') and \"menuDate\" >= '{add(today,2)}'")
s, b = req('GET', f'/menus/{d}', token=owner)
check('A empty day -> menu null (200)', s == 200 and b['data'] == {'date': d, 'menu': None}, (s, b))
s, b = req('PUT', f'/menus/{d}', menu(l=meal(['  Chapati ', '', 'chapati', 'Dal  Tadka', 'Jeera Rice']), g='Sunday special'), owner)
check('A create draft; items trimmed/deduped', s == 200 and b['data']['lunch']['items'] == ['Chapati', 'Dal Tadka', 'Jeera Rice'] and not b['data']['isPublished'] and b['data']['generalNote'] == 'Sunday special', (s, b))
s, b = req('GET', '/students/me/menu/week', token=stuA)
day = next(x for x in b['data']['days'] if x['date'] == d)
check('A student cannot see draft', s == 200 and day['menu'] is None and len(b['data']['days']) == 7 and b['data']['days'][0]['date'] == today, (s, b))
s, b = req('POST', f'/menus/{d}/publish', token=owner)
check('A publish', s == 201 and b['data']['isPublished'] and b['data']['publishedAt'], (s, b))
s, b = req('GET', '/students/me/menu/week', token=stuA)
day = next(x for x in b['data']['days'] if x['date'] == d)
check('A student sees published menu (no publish metadata)', day['menu'] and day['menu']['lunch']['items'][0] == 'Chapati' and 'isPublished' not in day['menu'] and 'id' not in day['menu'], day)
check('A servedMeals from mess settings', b['data']['servedMeals'] == {'breakfast': True, 'lunch': True, 'dinner': True} and b['data']['messName'] == 'Annapurna Student Mess', b['data'].get('servedMeals'))

# Flow B — edit published
s, b = req('PUT', f'/menus/{d}', menu(l=meal(['Chapati', 'Rajma'])), manager)
check('B manager edits published menu; stays published', s == 200 and b['data']['isPublished'] and b['data']['lunch']['items'] == ['Chapati', 'Rajma'], (s, b))
s, b = req('GET', '/students/me/menu/week', token=stuA)
check('B student sees updated items', next(x for x in b['data']['days'] if x['date'] == d)['menu']['lunch']['items'] == ['Chapati', 'Rajma'])

# Flow C — unavailable
s, b = req('PUT', f'/menus/{d}', menu(l=meal(['Chapati', 'Rajma']), d=meal([], False, 'Kitchen closed')), owner)
check('C dinner unavailable with empty items accepted', s == 200 and b['data']['dinner'] == {'available': False, 'items': [], 'note': 'Kitchen closed'}, (s, b))
s, b = req('GET', '/students/me/menu/week', token=stuA)
dn = next(x for x in b['data']['days'] if x['date'] == d)['menu']['dinner']
check('C student gets unavailable dinner, no items', dn['available'] is False and dn['items'] == [] and dn['note'] == 'Kitchen closed', dn)
s, b = req('POST', f'/menus/{d}/unpublish', token=owner)
check('Unpublish keeps content', s == 201 and not b['data']['isPublished'] and b['data']['lunch']['items'] == ['Chapati', 'Rajma'], (s, b))
s, b = req('GET', '/students/me/menu/week', token=stuA)
check('Unpublished hidden from student again', next(x for x in b['data']['days'] if x['date'] == d)['menu'] is None)

# Today / tomorrow
s, b = req('GET', '/students/me/menu/today', token=stuA)
check('Student today -> 1 day = today', s == 200 and len(b['data']['days']) == 1 and b['data']['days'][0]['date'] == today, (s, b))
s, b = req('GET', '/students/me/menu/tomorrow', token=stuA)
check('Student tomorrow -> 1 day = tomorrow', len(b['data']['days']) == 1 and b['data']['days'][0]['date'] == add(today, 1), b)
s, b = req('GET', '/students/me/menu/yesterday', token=stuA)
check('Invalid student range -> 404', s == 404, (s, b))

# Validation
s, b = req('PUT', f'/menus/{d}', {'breakfast': meal(['x' * 61]), 'lunch': meal([f'i{i}' for i in range(16)]), 'dinner': {'available': 'yes', 'items': 'rice'}, 'generalNote': 'n' * 301}, owner)
f = set(b['error']['fields']) if s == 400 else set()
check('Validation: item length, count, types, note', s == 400 and {'breakfast.items', 'lunch.items', 'dinner.available', 'dinner.items', 'generalNote'} <= f, (s, b))
s, b = req('PUT', f'/menus/{d}', {'lunch': meal(['x'])}, owner)
check('Validation: all three meals required', s == 400 and {'breakfast', 'dinner'} <= set(b['error']['fields']), (s, b))
s, b = req('GET', '/menus/2026-02-30', token=owner)
check('Invalid date param -> 400', s == 400 and 'date' in b['error']['fields'], (s, b))
s, b = req('GET', f'/menus?from={today}&to={add(today, 31)}', token=owner)
check('Range > 31 days rejected', s == 400, (s, b))
s, b = req('GET', f'/menus?from={today}&to={add(today, -1)}', token=owner)
check('Range to<from rejected', s == 400, (s, b))
s, b = req('POST', f'/menus/{add(today, 20)}/publish', token=owner)
check('Publish non-existent day -> 404', s == 404, (s, b))

# Roles
s, b = req('GET', f'/menus/{d}', token=staff)
check('Staff can view drafts', s == 200 and b['data']['menu'] is not None)
for name, (m, p, body) in {'save': ('PUT', f'/menus/{d}', menu()), 'publish': ('POST', f'/menus/{d}/publish', None), 'copy': ('POST', f'/menus/{d}/copy-from', {'sourceDate': today}), 'copy-week': ('POST', '/menus/copy-week', {'weekStart': today})}.items():
    s, b = req(m, p, body, staff)
    check(f'Staff cannot {name}', s == 403, (s, b))
s, b = req('GET', f'/menus/{d}', token=stuA)
check('Student blocked from owner menu API', s == 403)
s, b = req('PUT', f'/menus/{d}', menu(), stuA)
check('Student cannot edit', s == 403)
s, b = req('GET', f'/menus/{d}')
check('Unauthenticated blocked', s == 401)

# Flow D — weekly owner view
wk = '2031-03-03'  # a Monday far ahead, isolated from other runs
psql(f"delete from daily_menus where \"messId\"='{messA}' and \"menuDate\" between '2031-02-24' and '2031-03-16'")
for i in (0, 2, 4):
    req('PUT', f'/menus/{add(wk, i)}', menu(l=meal([f'Lunch day {i}'])), owner)
req('POST', f'/menus/{add(wk, 2)}/publish', token=owner)
s, b = req('GET', f'/menus?from={wk}&to={add(wk, 6)}', token=owner)
check('D weekly range: 7 ordered days with gaps', s == 200 and [x['date'] for x in b['data']] == [add(wk, i) for i in range(7)] and [x['menu'] is not None for x in b['data']] == [True, False, True, False, True, False, False], b)
check('D draft/published state in range', b['data'][2]['menu']['isPublished'] and not b['data'][0]['menu']['isPublished'])

# Flow E — copy previous day
s, b = req('POST', f'/menus/{add(wk, 1)}/copy-from', {'sourceDate': wk}, owner)
check('E copy Mon -> Tue as draft', s == 201 and b['data']['lunch']['items'] == ['Lunch day 0'] and not b['data']['isPublished'], (s, b))
req('POST', f'/menus/{wk}/publish', token=owner)
req('PUT', f'/menus/{add(wk, 1)}', menu(l=meal(['Tuesday only'])), owner)
s, b = req('GET', f'/menus/{wk}', token=owner)
check('E editing Tue leaves Mon unchanged', b['data']['menu']['lunch']['items'] == ['Lunch day 0'] and b['data']['menu']['isPublished'], b)
s, b = req('POST', f'/menus/{add(wk, 1)}/copy-from', {'sourceDate': wk}, owner)
check('E copy onto existing day -> MENU_EXISTS', s == 409 and b['error']['code'] == 'MENU_EXISTS', (s, b))
s, b = req('POST', f'/menus/{add(wk, 2)}/copy-from', {'sourceDate': wk, 'replace': True}, owner)
check('E replace=true overwrites and resets to draft', s == 201 and b['data']['lunch']['items'] == ['Lunch day 0'] and not b['data']['isPublished'], (s, b))
s, b = req('POST', f'/menus/{add(wk, 3)}/copy-from', {'sourceDate': add(wk, 5)}, owner)
check('E copy from empty day -> 404', s == 404, (s, b))
s, b = req('POST', f'/menus/{wk}/copy-from', {'sourceDate': wk}, owner)
check('E copy onto itself -> 400', s == 400, (s, b))

# Flow F — copy previous week (into next week, passing a mid-week date)
nxt = add(wk, 7)
req('PUT', f'/menus/{add(nxt, 4)}', menu(l=meal(['Already here'])), owner)
s, b = req('POST', '/menus/copy-week', {'weekStart': add(nxt, 3)}, owner)
r = b['data']
check('F copied/skipped summary', s == 201 and r['copied'] == [nxt, add(nxt, 1), add(nxt, 2)] and {x['date'] for x in r['skipped']} == {add(nxt, i) for i in (3, 4, 5, 6)} and r['failed'] == [], (s, b))
check('F existing destination day kept', next(x for x in r['skipped'] if x['date'] == add(nxt, 4))['reason'] == 'Already has a menu')
s, b = req('GET', f'/menus?from={nxt}&to={add(nxt, 6)}', token=owner)
check('F weekday mapping + drafts', b['data'][0]['menu']['lunch']['items'] == ['Lunch day 0'] and b['data'][1]['menu']['lunch']['items'] == ['Tuesday only'] and not any(x['menu']['isPublished'] for x in b['data'] if x['menu']) and b['data'][4]['menu']['lunch']['items'] == ['Already here'], b)
s, b = req('POST', '/menus/copy-week', {'weekStart': nxt, 'replace': True}, owner)
check('F replace=true overwrites existing day', b['data']['copied'] == [nxt, add(nxt, 1), add(nxt, 2), add(nxt, 4)], b)

# Flow G — tenant isolation
req('PUT', f'/menus/{d}', menu(l=meal(['Mess B secret'])), ownerB)
req('POST', f'/menus/{d}/publish', token=ownerB)
s, b = req('GET', f'/menus/{d}', token=owner)
check('G Mess A reads own day, not Mess B content', s == 200 and 'Mess B secret' not in json.dumps(b), b)
s, b = req('GET', f'/menus?from={today}&to={add(today, 6)}', token=owner)
check('G Mess A range has no Mess B content', 'Mess B secret' not in json.dumps(b))
s, b = req('GET', '/students/me/menu/week', token=stuA)
check('G Student A never sees Mess B menu', 'Mess B secret' not in json.dumps(b) and b['data']['messName'] == 'Annapurna Student Mess')
s, b = req('GET', '/students/me/menu/week', token=stuB)
check('G Student B sees own mess menu', 'Mess B secret' in json.dumps(b) and b['data']['messName'] == 'Sai Tiffin Service', b)
psql(f"delete from daily_menus where \"messId\"='{messA}' and \"menuDate\"='{add(today,4)}'")
s, b = req('POST', f'/menus/{add(today, 4)}/copy-from', {'sourceDate': d}, owner)
# Mess A has an (unpublished) menu on d, so copy uses Mess A's own content, never Mess B's
check('G copy-from resolves source within own mess only', s == 201 and 'Mess B secret' not in json.dumps(b), (s, b))
psql(f"delete from daily_menus where \"messId\"='{messA}' and \"menuDate\" in ('{d}','{add(today,4)}')")
s, b = req('POST', f'/menus/{add(today, 4)}/copy-from', {'sourceDate': d}, owner)
check('G copy from date that only Mess B has -> 404', s == 404, (s, b))
s, b = req('POST', f'/menus/{d}/publish', token=owner)
check('G Mess A cannot publish Mess B day (404)', s == 404, (s, b))
check('G Mess B menu untouched', psql(f"select \"lunchItems\"[1]||\"isPublished\" from daily_menus where \"messId\"='{messB}' and \"menuDate\"='{d}'") == 'Mess B secrettrue')

# Unlinked student
other = otp_login('6' + str(random.randint(100000000, 999999999)))
s, b = req('GET', '/students/me/menu/today', token=other)
check('Unlinked student -> linked:false', s == 200 and b['data'] == {'linked': False}, b)

# Informational only: no subscription/credit side effects
check('No meal credits touched by menu actions', psql(CREDITS_SQL) == credits_before, (credits_before, psql(CREDITS_SQL)))
print(f"\n{sum(results)}/{len(results)} checks passed")
