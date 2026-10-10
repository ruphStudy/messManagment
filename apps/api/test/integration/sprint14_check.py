"""Sprint 14 release suite: roles, permissions, forced password change, sessions, account states, health,
production config, seed safety, secrets, tenant 404s and an owner→student→staff end-to-end flow."""
import json, os, subprocess, random, time, urllib.request
import os as _os
B = _os.environ.get('MESS_TEST_BASE', 'http://localhost:4100/api/v1')
results = []
def _req(method, path, body=None, token=None, mobile=False):
    headers = {}
    data = json.dumps(body).encode() if body is not None else None
    if data is not None: headers['Content-Type'] = 'application/json'
    if token: headers['Authorization'] = f'Bearer {token}'
    if mobile: headers['x-client-type'] = 'MOBILE'
    r = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            t = res.read().decode(); return res.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode() or 'null'
        try: return e.code, json.loads(t)
        except ValueError: return e.code, None
def req(method, path, body=None, token=None, mobile=False):
    for _ in range(4):
        out = _req(method, path, body, token, mobile)
        if out[0] != 429: return out
        time.sleep(61)
    return out
def check(name, cond, info=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {str(info)[:500]}'))
def code(b): return (b or {}).get('error', {}).get('code')
def login_full(i, pw='Password123'): return req('POST', '/auth/login', {'identifier': i, 'password': pw})
def login(i, pw='Password123'): return login_full(i, pw)[1]['data']['accessToken']
def otp_full(m):
    c = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    return req('POST', '/auth/otp/verify', {'mobile': m, 'code': c}, mobile=True)[1]['data']
def psql(sql): return subprocess.run(['psql', '-tA', os.environ.get('MESS_TEST_DB', 'mess_management'), '-c', sql], capture_output=True, text=True).stdout.strip()
def node(js, env=None): return subprocess.run(['node', '-e', js], capture_output=True, text=True, env={**os.environ, **(env or {})}).stdout.strip()
def mob(): return '7' + str(random.randint(100000000, 999999999))
today = node("console.log(require('./packages/shared/dist').businessToday())")
add = lambda d, n: node(f"console.log(require('./packages/shared/dist').addDays('{d}',{n}))")
u = str(random.randint(10000, 99999))
DOTENV = dict(l.split('=', 1) for l in open('apps/api/.env').read().splitlines() if '=' in l and not l.startswith('#'))
SECRET_KEYS = ('passwordHash', 'refreshTokenHash', 'previousTokenHash', 'codeHash', 'pushToken', 'tokenHash')
SECRET_VALUES = [v for k, v in DOTENV.items() if k in ('JWT_ACCESS_SECRET', 'DATABASE_URL', 'EXPO_ACCESS_TOKEN') and len(v) > 8]
def leaks(obj):
    t = json.dumps(obj)
    return [k for k in SECRET_KEYS if f'"{k}"' in t] + [v[:6] + '…' for v in SECRET_VALUES if v in t]

# ── 1. Role landing ──
tok, landing = {}, {}
for role, ident in [('admin', '9000000000'), ('owner', '9000000001'), ('manager', '9000000002'), ('staff', '9000000003')]:
    s, b = login_full(ident); tok[role] = b['data']['accessToken']; landing[role] = (b['data']['role'], (b['data']['membership'] or {}).get('role'))
stu = otp_full('9100000001'); tok['student'] = stu['accessToken']; landing['student'] = (stu['role'], stu['membership'])
check('1 landing: admin w/o membership, team with membership role, student via OTP',
      landing == {'admin': ('PLATFORM_ADMIN', None), 'owner': ('MESS_OWNER', 'MESS_OWNER'), 'manager': ('MESS_MANAGER', 'MESS_MANAGER'), 'staff': ('MESS_STAFF', 'MESS_STAFF'), 'student': ('STUDENT', None)}, landing)
check('1 student accounts use OTP, password accounts use password (role-based, not device)', code(login_full('9100000001', 'x')[1]) in ('INVALID_CREDENTIALS', 'OTP_SIGN_IN_REQUIRED') and code(req('POST', '/auth/otp/request', {'mobile': '9000000003'})[1]) == 'PASSWORD_SIGN_IN_REQUIRED')

# ── 2. Permission matrix (owner, manager, staff, student, admin) ──
MATRIX = [
    ('GET', '/students', None, (200, 200, 200, 403, 403)),
    ('POST', '/students', {}, (400, 400, 403, 403, 403)),
    ('GET', '/meal-plans', None, (200, 200, 200, 403, 403)),
    ('POST', '/meal-plans', {}, (400, 400, 403, 403, 403)),
    ('PUT', f'/menus/{today}', {}, (400, 400, 403, 403, 403)),
    ('POST', '/attendance/manual', {}, (400, 400, 400, 403, 403)),
    ('POST', '/attendance/scan', {}, (400, 400, 400, 403, 403)),
    ('GET', '/pauses', None, (200, 200, 200, 403, 403)),
    ('GET', '/payments/summary', None, (200, 200, 200, 403, 403)),
    ('POST', '/payments', {}, (400, 400, 403, 403, 403)),
    ('GET', '/expenses', None, (200, 200, 403, 403, 403)),
    ('POST', '/expenses', {}, (400, 400, 403, 403, 403)),
    ('GET', '/finance/monthly-summary?month=' + today[:7], None, (200, 200, 403, 403, 403)),
    ('GET', '/feedback/summary?from=' + today + '&to=' + today, None, (200, 200, 403, 403, 403)),
    ('GET', '/complaints', None, (200, 200, 200, 403, 403)),
    ('GET', '/reports/attendance', None, (200, 200, 200, 403, 403)),
    ('GET', '/reports/payments', None, (200, 200, 403, 403, 403)),
    ('GET', '/dashboard', None, (200, 200, 200, 403, 403)),
    ('GET', '/staff', None, (200, 200, 403, 403, 403)),
    ('POST', '/staff', {}, (400, 400, 403, 403, 403)),
    ('PATCH', '/mess', {'name': ''}, (400, 403, 403, 403, 403)),
    ('PATCH', '/mess/settings', {'lunchStart': '25:00'}, (400, 400, 403, 403, 403)),
    ('GET', '/students/me/meal-qr', None, (403, 403, 403, 200, 403)),
    ('GET', '/students/me/payments', None, (403, 403, 403, 200, 403)),
    ('GET', '/admin/dashboard', None, (403, 403, 403, 403, 200)),
    ('POST', '/admin/messes/00000000-0000-4000-8000-000000000000/suspend', {'reason': 'x'}, (403, 403, 403, 403, 404)),
]
order = ('owner', 'manager', 'staff', 'student', 'admin')
bad = []
for m, p, body, expect in MATRIX:
    got = tuple(req(m, p, body, tok[r])[0] for r in order)
    if got != expect: bad.append((m, p, got, expect))
    if req(m, p, body)[0] != 401: bad.append((m, p, 'unauth', req(m, p, body)[0]))
check(f'2 permission matrix: {len(MATRIX)} endpoints x 5 roles + unauthenticated', not bad, bad)

# ── 3. Forced password change (API-enforced) ──
tm = mob()
tid = req('POST', '/staff', {'firstName': 'Temp', 'mobile': tm, 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, tok['owner'])[1]['data']['staff']['id']
s, b = login_full(tm, 'Temp1234x'); t1 = b['data']['accessToken']
check('3 temp-password login still issues a session (flag set)', s == 200 and b['data']['user']['mustChangePassword'] is True)
blocked = {p: (req('GET', p, token=t1)[0], code(req('GET', p, token=t1)[1])) for p in ('/students', '/dashboard', '/notifications/unread-count', '/menus/' + today, '/attendance/summary')}
check('3 business APIs blocked with PASSWORD_CHANGE_REQUIRED', all(v == (403, 'PASSWORD_CHANGE_REQUIRED') for v in blocked.values()), blocked)
check('3 writes blocked too (incl. own profile edit)', code(req('POST', '/attendance/manual', {}, t1)[1]) == 'PASSWORD_CHANGE_REQUIRED' and code(req('PATCH', '/auth/me', {'firstName': 'X'}, t1)[1]) == 'PASSWORD_CHANGE_REQUIRED')
check('3 /auth/me allowed during change', req('GET', '/auth/me', token=t1)[0] == 200)
check('3 re-login keeps the restriction', code(req('GET', '/students', token=login(tm, 'Temp1234x'))[1]) == 'PASSWORD_CHANGE_REQUIRED')
s, b = req('POST', '/auth/change-password', {'currentPassword': 'Temp1234x', 'newPassword': 'Own12345pw'}, t1)
check('3 change password clears flag, access resumes', s == 200 and b['data']['user']['mustChangePassword'] is False and req('GET', '/students', token=t1)[0] == 200)
req('POST', f'/staff/{tid}/reset-password', {'temporaryPassword': 'Again1234x'}, tok['owner'])
check('3 owner reset re-applies the restriction', code(req('GET', '/students', token=login(tm, 'Again1234x'))[1]) == 'PASSWORD_CHANGE_REQUIRED')

# ── 4. Session lifecycle (mobile refresh tokens) ──
sm = mob(); req('POST', '/students', {'firstName': 'Life', 'mobile': sm, 'joiningDate': today}, tok['owner'])
d = otp_full(sm); acc, ref = d['accessToken'], d['refreshToken']
s, b = req('POST', '/auth/refresh', {'refreshToken': ref}, mobile=True)
ref2 = b['data']['refreshToken'] if s == 200 else None
check('4 refresh rotates the token', s == 200 and ref2 and ref2 != ref)
time.sleep(31)  # past the rotation grace window: replaying the old token now revokes the session
s_replay = req('POST', '/auth/refresh', {'refreshToken': ref}, mobile=True)[0]
check('4 replayed old refresh token is refused and ends the session', s_replay == 401 and req('POST', '/auth/refresh', {'refreshToken': ref2}, mobile=True)[0] == 401)
d = otp_full(sm); acc, ref = d['accessToken'], d['refreshToken']
s = req('POST', '/auth/logout', {'refreshToken': ref}, mobile=True)[0]
check('4 logout revokes session (refresh + access fail)', s == 204 and req('POST', '/auth/refresh', {'refreshToken': ref}, mobile=True)[0] == 401 and req('GET', '/auth/me', token=acc)[0] == 401)
check('4 garbage tokens fail cleanly (401, no 500)', req('GET', '/auth/me', token='abc.def.ghi')[0] == 401 and req('POST', '/auth/refresh', {'refreshToken': 'nope'}, mobile=True)[0] == 401)
uid = psql(f"select id from users where mobile='{sm}'")
d = otp_full(sm); acc = d['accessToken']
req('POST', f'/admin/users/{uid}/suspend', {'reason': 'S14 lifecycle'}, tok['admin'])
check('4 platform-suspended user: session dead, OTP login blocked', req('GET', '/auth/me', token=acc)[0] in (401, 403) and code(req('POST', '/auth/otp/request', {'mobile': sm})[1]) == 'ACCOUNT_DISABLED')
req('POST', f'/admin/users/{uid}/reactivate', {}, tok['admin'])
check('4 reactivated user can sign in again', bool(otp_full(sm)['accessToken']))

# ── 5. Account states (student app) ──
sid_life = psql(f"select id from mess_students where mobile='{sm}'")
st_tok = otp_full(sm)['accessToken']
check('5 linked, no plan -> NO_PLAN', req('GET', '/students/me/meal-qr', token=st_tok)[1]['data']['state'] == 'NO_PLAN')
req('PATCH', f'/students/{sid_life}/status', {'status': 'INACTIVE'}, tok['owner'])
check('5 inactive student -> INACTIVE', req('GET', '/students/me/meal-qr', token=st_tok)[1]['data']['state'] == 'INACTIVE')
req('POST', f'/students/{sid_life}/archive', {}, tok['owner'])
check('5 archived student -> not linked', req('GET', '/students/me/meal-qr', token=st_tok)[1]['data']['state'] == 'NOT_LINKED' and req('GET', '/students/me', token=st_tok)[1]['data']['linked'] is False)
nobody = otp_full(mob())['accessToken']
check('5 brand-new number -> NOT_LINKED (no crash)', req('GET', '/students/me/meal-qr', token=nobody)[1]['data']['state'] == 'NOT_LINKED')
MESS_A = psql("select id from messes where name='Annapurna Student Mess'")
req('POST', f'/admin/messes/{MESS_A}/suspend', {'reason': f'S14 states {u}'}, tok['admin'])
qr = req('GET', '/students/me/meal-qr', token=tok['student'])[1]['data']
me = req('GET', '/students/me', token=tok['student'])[1]['data']
check('5 suspended mess -> MESS_UNAVAILABLE QR + profile shows SUSPENDED', qr['state'] == 'MESS_UNAVAILABLE' and me['profile']['mess']['status'] == 'SUSPENDED', (qr, me.get('profile', {}).get('mess')))
check('5 suspended mess: student history readable, pause blocked', req('GET', '/students/me/payments', token=tok['student'])[0] == 200 and code(req('POST', '/students/me/pauses', {'fromDate': add(today, 2), 'toDate': add(today, 2), 'mealTypes': ['dinner']}, tok['student'])[1]) == 'MESS_SUSPENDED')
check('5 suspended mess: team reads ok, writes MESS_SUSPENDED', req('GET', '/students', token=tok['manager'])[0] == 200 and code(req('POST', '/meal-plans', {}, tok['manager'])[1]) == 'MESS_SUSPENDED')
req('POST', f'/admin/messes/{MESS_A}/reactivate', {}, tok['admin'])
check('5 reactivated mess -> QR state back', req('GET', '/students/me/meal-qr', token=tok['student'])[1]['data']['state'] != 'MESS_UNAVAILABLE')

# ── 6. Health (public, minimal) ──
s, b = req('GET', '/health')
check('6 health: only status/database/version', s == 200 and set(b['data']) == {'status', 'database', 'version'} and b['data']['status'] == 'ok' and not leaks(b), b)

# ── 7. Production config validation (fail fast) ──
LOAD = "try{require('./apps/api/dist/config/app-config').loadConfig();console.log('LOADED')}catch(e){console.log(e.message)}"
base = {'NODE_ENV': 'production', 'DATABASE_URL': 'postgresql://app@db.internal:5432/mess', 'JWT_ACCESS_SECRET': 'x' * 48}
unsafe = node(LOAD, {**base, 'JWT_ACCESS_SECRET': 'change-me-to-a-long-random-string-xxxxxxx', 'CORS_ORIGINS': 'http://localhost:3100', 'PUSH_PROVIDER': 'log', 'OTP_DEV_ECHO': 'true', 'SCHEDULER_ENABLED': '', 'UPLOAD_DIR': 'uploads', 'UPLOAD_STORAGE_PERSISTENT': '', 'SMS_PROVIDER': 'console'})
for needle in ('JWT_ACCESS_SECRET looks like a placeholder', 'CORS_ORIGINS entry', 'PUSH_PROVIDER=log', 'OTP_DEV_ECHO', 'SCHEDULER_ENABLED', 'UPLOAD_DIR must be an absolute', 'UPLOAD_STORAGE_PERSISTENT', 'SMS_PROVIDER=console'):
    check(f'7 unsafe production config rejected: {needle}', needle in unsafe, unsafe)
safe_env = {**base, 'CORS_ORIGINS': 'https://app.example.in', 'PUSH_PROVIDER': 'expo', 'SCHEDULER_ENABLED': 'true', 'UPLOAD_DIR': '/data/uploads', 'UPLOAD_STORAGE_PERSISTENT': 'true', 'OTP_DEV_ECHO': 'false', 'SMS_PROVIDER': 'console'}
only_sms = node(LOAD, safe_env)
check('7 otherwise-correct production config only fails on the missing SMS provider (known blocker)', 'SMS_PROVIDER=console' in only_sms and only_sms.count(' - ') == 1, only_sms)
check('7 development config still loads', node(LOAD, {'NODE_ENV': 'development', 'DATABASE_URL': 'postgresql://x@localhost/x', 'JWT_ACCESS_SECRET': 'x' * 48}) == 'LOADED')

# ── 8. Seed refuses production ──
seed = subprocess.run(['npx', 'ts-node', '--transpile-only', 'prisma/seed.ts'], cwd='apps/api', capture_output=True, text=True, env={**os.environ, 'NODE_ENV': 'production'})
check('8 demo seed refuses NODE_ENV=production', seed.returncode != 0 and 'Refusing to seed production' in (seed.stdout + seed.stderr), (seed.stdout + seed.stderr)[-300:])

# ── 9. Secrets never in responses ──
SAMPLES = {'owner': ['/auth/me', '/students?pageSize=5', '/staff', '/mess', '/payments?pageSize=5', '/notifications?pageSize=5', '/complaints?pageSize=5'],
           'admin': ['/admin/users?pageSize=20', f'/admin/messes/{MESS_A}', '/admin/system', '/admin/audit?pageSize=20', '/admin/complaints?pageSize=5'],
           'student': ['/students/me', '/students/me/payments', '/notifications?pageSize=5', '/students/me/complaints']}
found = {f'{r} {p}': leaks(req('GET', p, token=tok[r])[1]) for r, ps in SAMPLES.items() for p in ps}
check('9 no hashes/tokens/env secrets in API responses', not any(found.values()), {k: v for k, v in found.items() if v})

# ── 10. Owner → staff → student end-to-end ──
O, S, M = tok['owner'], tok['staff'], tok['manager']
plan = req('POST', '/meal-plans', {'name': f'E2E {u}', 'price': 3000, 'breakfastIncluded': True, 'lunchIncluded': True, 'dinnerIncluded': True, 'durationType': 'MONTHS', 'durationValue': 1}, O)[1]['data']['id']
em = mob()
esid = req('POST', '/students', {'firstName': 'Flow', 'lastName': u, 'mobile': em, 'joiningDate': today}, O)[1]['data']['id']
esub = req('POST', f'/students/{esid}/subscriptions', {'mealPlanId': plan, 'startDate': today}, O)[1]['data']['id']
meal = lambda items: {'available': True, 'items': items, 'note': None}
req('PUT', f'/menus/{today}', {'breakfast': meal(['Poha']), 'lunch': meal(['Dal', 'Rice']), 'dinner': meal(['Roti']), 'generalNote': None}, M)
s_pub = req('POST', f'/menus/{today}/publish', token=M)[0]
est = otp_full(em)['accessToken']
check('10 student OTP login links to the right mess', req('GET', '/students/me', token=est)[1]['data']['profile']['mess']['id'] == MESS_A)
check('10 published menu visible to student', s_pub in (200, 201) and req('GET', '/students/me/menu/today', token=est)[1]['data']['days'][0]['menu'] is not None)
qr = req('GET', '/students/me/meal-qr', token=est)[1]['data']
check('10 student gets a meal QR', qr['state'] == 'READY' and qr['token'])
before = req('GET', f'/attendance/summary?date={today}', token=O)[1]['data']['lunch']
s, b = req('POST', '/attendance/scan', {'qrToken': qr['token'], 'mealType': 'lunch'}, S)
check('10 staff scans QR (served)', s in (200, 201) and b['data']['outcome'] == 'SERVED', b)
again = req('POST', '/attendance/scan', {'qrToken': qr['token'], 'mealType': 'lunch'}, S)[1]['data']
check('10 second scan -> rejected ALREADY_SERVED with a readable message', again['outcome'] == 'REJECTED' and again['reason'] == 'ALREADY_SERVED' and again['message'], again)
att_id = psql(f"select id from meal_attendance where \"studentId\"='{esid}' and status='SERVED' limit 1")
s, b = req('POST', '/students/me/pauses', {'fromDate': add(today, 1), 'toDate': add(today, 1), 'mealTypes': ['dinner']}, est)
check('10 student pauses tomorrow dinner', s in (200, 201) and 'PAUSE' not in json.dumps(b).replace('PAUSED', ''), b)
pay = req('POST', '/payments', {'studentId': esid, 'subscriptionId': esub, 'amountPaise': 150050, 'method': 'UPI'}, O)[1]['data']
s, rec = req('GET', f"/payments/{pay['id']}/receipt", token=O)
check('10 payment + receipt (number, amount, plan, balance)', s == 200 and rec['data']['receiptNumber'] == pay['receiptNumber'] and rec['data']['amountPaise'] == 150050 and rec['data']['subscription']['planName'] == f'E2E {u}' and rec['data']['balanceAfterPaise'] == 300000 - 150050, rec)
check('10 student sees own payment', any(p['id'] == pay['id'] for p in req('GET', '/students/me/payments', token=est)[1]['data']))
cat = req('GET', '/expense-categories', token=O)[1]['data'][0]['id']
s_exp = req('POST', '/expenses', {'categoryId': cat, 'title': f'Veg {u}', 'amountPaise': 45000, 'expenseDate': today}, M)[0]
check('10 manager records expense', s_exp == 201)
s_rem = req('POST', f'/students/{esid}/reminders', {'reason': 'PAYMENT'}, O)[0]
check('10 payment reminder reaches student in-app', s_rem in (200, 201) and any(n['type'] == 'PAYMENT_DUE' for n in req('GET', '/notifications?pageSize=10', token=est)[1]['data']))
check('10 student rates the meal', req('POST', '/students/me/feedback/meal', {'attendanceId': att_id, 'overallRating': 4}, est)[0] == 201)
cid = req('POST', '/students/me/complaints', {'category': 'QUANTITY', 'description': f'Less rice {u}'}, est)[1]['data']['id']
s1 = req('PATCH', f'/complaints/{cid}/status', {'status': 'IN_PROGRESS'}, M)[0]
s2 = req('PATCH', f'/complaints/{cid}/status', {'status': 'RESOLVED'}, O)[0]
check('10 complaint raised and resolved, student sees it', s1 == 200 and s2 == 200 and req('GET', f'/students/me/complaints/{cid}', token=est)[1]['data']['status'] == 'RESOLVED')
dash = req('GET', '/dashboard', token=O)[1]['data']
ps = req('GET', '/payments/summary', token=O)[1]['data']
summ = req('GET', f'/attendance/summary?date={today}', token=O)[1]['data']
check('10 dashboard reflects the flow (served, collected, expenses)', dash['meals']['today']['meals']['lunch']['served'] == summ['lunch'] == before + 1 and dash['money']['collectedTodayPaise'] == ps['collectedTodayPaise'] and dash['money']['expensesTodayPaise'] >= 45000, (dash['meals']['today']['meals']['lunch'], summ, before))
rp = req('GET', f'/reports/payments?from={today}&to={today}&search={em}', token=O)[1]
check('10 payments report shows it with matching total', rp['meta']['total'] == 1 and rp['summary']['collectedPaise'] == 150050, rp.get('summary'))
check('10 tomorrow expected meals include the pause', req('GET', f'/attendance/expected?date={add(today, 1)}', token=S)[1]['data']['meals']['dinner']['paused'] >= 1)
check('10 staff still blocked from finance/team during the flow', req('GET', '/expenses', token=S)[0] == 403 and req('POST', '/staff', {}, S)[0] == 403)

# ── 11. Guessed / cross-tenant ids -> 404 ──
ownerB = login('9000000011')
MESS_B = psql("select id from messes where name='Sai Tiffin Service'")
ids = {k: psql(f'select id from {t} where "messId"=\'{MESS_B}\' limit 1') for k, t in [('students', 'mess_students'), ('payments', 'payments'), ('complaints', 'complaints'), ('meal-plans', 'meal_plans'), ('subscriptions', 'student_subscriptions'), ('expenses', 'expenses')]}
codes = {k: req('GET', f'/{k}/{v}', token=O)[0] for k, v in ids.items() if v}
check('11 Mess A owner gets 404 for Mess B records', codes and set(codes.values()) == {404}, codes)
check('11 Mess B owner gets 404 for Mess A student/payment', req('GET', f'/students/{esid}', token=ownerB)[0] == 404 and req('GET', f"/payments/{pay['id']}/receipt", token=ownerB)[0] == 404)
check('11 admin reads cross-mess only via /admin', req('GET', f'/admin/messes/{MESS_B}', token=tok['admin'])[0] == 200 and req('GET', f"/students/{ids['students']}", token=tok['admin'])[0] == 403)

print(f"\n{sum(results)}/{len(results)} checks passed")
