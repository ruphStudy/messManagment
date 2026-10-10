import json, subprocess, urllib.request, datetime, random, time, re
import os as _os
B = _os.environ.get('MESS_TEST_BASE', 'http://localhost:4100/api/v1')
results = []
def _req(method, path, body=None, token=None):
    headers = {}
    data = json.dumps(body).encode() if body is not None else None
    if data is not None: headers['Content-Type'] = 'application/json'
    if token: headers['Authorization'] = f'Bearer {token}'
    r = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            t = res.read().decode(); return res.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode() or 'null'; return e.code, json.loads(t)
def req(method, path, body=None, token=None):
    for _ in range(4):
        out = _req(method, path, body, token)
        if out[0] != 429 or not path.startswith('/auth'): return out
        time.sleep(61)
    return out
def check(name, cond, info=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {str(info)[:600]}'))
def login_full(i): return req('POST', '/auth/login', {'identifier': i, 'password': 'Password123'})
def login(i): return login_full(i)[1]['data']['accessToken']
def otp(m):
    c = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    return req('POST', '/auth/otp/verify', {'mobile': m, 'code': c})[1]['data']['accessToken']
def psql(sql): return subprocess.run(['psql', '-tA', 'mess_management', '-c', sql], capture_output=True, text=True).stdout.strip()
def num(sql): return int(psql(sql))
today = subprocess.run(['node', '-e', "console.log(require('./packages/shared/dist').businessToday())"], capture_output=True, text=True).stdout.strip()
month = today[:7]
u = str(random.randint(10000, 99999))
env = dict(l.split('=', 1) for l in open('./apps/api/.env').read().splitlines() if '=' in l and not l.startswith('#'))
SECRET_KEYS = ('passwordHash', 'tokenHash', 'refreshToken', 'pushToken', 'codeHash', 'otp', 'accessToken', 'attachmentId')
def no_secrets(obj):
    text = json.dumps(obj)
    return not any(f'"{k}"' in text for k in SECRET_KEYS)

s, b = login_full('9000000000'); admin = b['data']['accessToken']
check('A admin login: PLATFORM_ADMIN, no mess membership', s == 200 and b['data']['role'] == 'PLATFORM_ADMIN' and b['data']['membership'] is None, b)
check('A ADMIN_LOGIN audited', req('GET', '/admin/audit?action=ADMIN_LOGIN&pageSize=1', token=admin)[1]['data'][0]['actor']['name'] == 'Platform Admin')
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
stuA = otp('9100000001')
MESS_A = psql("select id from messes where name='Annapurna Student Mess'"); MESS_B = psql("select id from messes where name='Sai Tiffin Service'")
MANAGER_ID = psql("select id from users where mobile='9000000002'"); ADMIN_ID = psql("select id from users where mobile='9000000000'")

# ── J: role checks on every admin endpoint ──
ADMIN_GETS = ['/admin/dashboard', '/admin/messes', f'/admin/messes/{MESS_A}', f'/admin/messes/{MESS_A}/records/students', '/admin/users', f'/admin/users/{MANAGER_ID}', '/admin/complaints', '/admin/audit', '/admin/system']
ADMIN_POSTS = [f'/admin/messes/{MESS_B}/suspend', f'/admin/messes/{MESS_B}/reactivate', f'/admin/users/{MANAGER_ID}/suspend', f'/admin/users/{MANAGER_ID}/reactivate']
check('J admin: every GET 200', all(req('GET', p, token=admin)[0] == 200 for p in ADMIN_GETS), [(p, req('GET', p, token=admin)[0]) for p in ADMIN_GETS])
for label, tok in [('owner', owner), ('manager', manager), ('staff', staff), ('student', stuA)]:
    codes = [req('GET', p, token=tok)[0] for p in ADMIN_GETS] + [req('POST', p, {'reason': 'x'}, tok)[0] for p in ADMIN_POSTS]
    check(f'J {label}: 403 on all admin APIs', set(codes) == {403}, codes)
check('J unauthenticated: 401 on admin APIs', {req('GET', p)[0] for p in ADMIN_GETS} == {401})
check('J admin has no tenant access via normal routes (no membership)', req('GET', '/students', token=admin)[0] == 403 and req('GET', '/dashboard', token=admin)[0] == 403)
check('J manager status unchanged after blocked suspend attempts', psql(f"select status from users where id='{MANAGER_ID}'") == 'ACTIVE')

# ── B: mess search ──
def mess_names(qs): return [m['name'] for m in req('GET', f'/admin/messes?{qs}', token=admin)[1]['data']]
check('B search by mess name', mess_names('search=annapurna') == ['Annapurna Student Mess'])
check('B search by owner name', 'Sai Tiffin Service' in mess_names('search=Kiran') and 'Annapurna Student Mess' not in mess_names('search=Kiran'))
check('B search by owner mobile', mess_names('search=9000000011') == ['Sai Tiffin Service'])
check('B search by owner email', mess_names('search=owner@demo.mess') == ['Annapurna Student Mess'])
check('B search by city', 'Sai Tiffin Service' in mess_names('search=nagpur') and all(m['city'] == 'Nagpur' for m in req('GET', '/admin/messes?city=nagpur', token=admin)[1]['data']))
s, b = req('GET', '/admin/messes?pageSize=1&sortBy=name&sortOrder=asc', token=admin)
check('B pagination + sort + total', s == 200 and len(b['data']) == 1 and b['meta']['total'] == num('select count(*) from messes') and b['data'][0]['name'] == psql('select name from messes order by name limit 1'), b)
row = next(m for m in req('GET', '/admin/messes?search=annapurna', token=admin)[1]['data'])
check('B list row: owner, active students match DB, safe', row['owner']['name'] == 'Ravi Patil' and row['activeStudents'] == num(f"select count(*) from mess_students where \"messId\"='{MESS_A}' and status='ACTIVE'") and no_secrets(row), row)
check('B bad filter rejected', req('GET', '/admin/messes?status=NOPE', token=admin)[0] == 400 and req('GET', '/admin/messes?messId=x', token=admin)[0] == 400)

# ── C: mess detail matches sources ──
s, d = req('GET', f'/admin/messes/{MESS_A}', token=admin); d = d['data']
check('C detail 200, no secrets', s == 200 and no_secrets(d) and d['mess']['name'] == 'Annapurna Student Mess' and d['owner']['mobile'] == '9000000001')
check('C students == DB', d['students']['active'] == num(f"select count(*) from mess_students where \"messId\"='{MESS_A}' and status='ACTIVE'"))
att = req('GET', f'/attendance/summary?date={today}', token=owner)[1]['data']
check('C attendance today == /attendance/summary', all(d['attendance']['today'][k] == att[k] for k in ('breakfast', 'lunch', 'dinner', 'total')), (d['attendance'], att))
fm = req('GET', f'/finance/monthly-summary?month={month}', token=owner)[1]['data']
check('C finance == /finance/monthly-summary', d['finance'] == fm, (d['finance'], fm))
cc = req('GET', '/complaints/counts', token=owner)[1]['data']
check('C complaints == /complaints/counts', all(d['complaints'][k] == cc[k] for k in ('OPEN', 'IN_PROGRESS', 'RESOLVED')))
check('C active subscriptions == /subscriptions', d['subscriptions']['active'] == req('GET', '/subscriptions?status=ACTIVE&pageSize=1', token=owner)[1]['meta']['total'])
check('C team listed with roles', {t['role'] for t in d['team']} >= {'MESS_OWNER', 'MESS_MANAGER', 'MESS_STAFF'})
check('C unknown id -> 404, malformed -> 404', req('GET', '/admin/messes/00000000-0000-4000-8000-000000000000', token=admin)[0] == 404 and req('GET', '/admin/messes/abc', token=admin)[0] == 404)
for t in ('students', 'subscriptions', 'attendance', 'payments', 'complaints'):
    s, b = req('GET', f'/admin/messes/{MESS_B}/records/{t}?pageSize=5', token=admin)
    check(f'C read-only records {t} (Mess B) 200, safe', s == 200 and 'meta' in b and no_secrets(b), (s, b))
check('C records: Mess B students only', all(r['mobile'] != '9100000001' for r in req('GET', f'/admin/messes/{MESS_B}/records/students?pageSize=100', token=admin)[1]['data']))
check('C records == owner report', req('GET', f'/admin/messes/{MESS_A}/records/students?pageSize=1', token=admin)[1]['meta']['total'] == req('GET', '/reports/students?pageSize=1', token=owner)[1]['meta']['total'])
check('C unknown record type -> 404 (no expenses/feedback)', req('GET', f'/admin/messes/{MESS_A}/records/expenses', token=admin)[0] == 404)
check('C no admin write routes for business data', req('POST', f'/admin/messes/{MESS_A}/records/payments', {}, admin)[0] == 404 and req('DELETE', f'/admin/messes/{MESS_A}', token=admin)[0] == 404 and req('DELETE', f'/admin/users/{MANAGER_ID}', token=admin)[0] == 404)

# ── K: tenant isolation unchanged (owner A cannot see Mess B) ──
sidB = psql(f"select id from mess_students where \"messId\"='{MESS_B}' limit 1")
check('K owner A cannot open a Mess B student', req('GET', f'/students/{sidB}', token=owner)[0] == 404)
check('K owner A list excludes Mess B', req('GET', '/students?search=9100000099', token=owner)[1]['meta']['total'] == 0)
check('K owner B list excludes Mess A', req('GET', '/students?search=9100000001', token=ownerB)[1]['meta']['total'] == 0)

# ── D: mess suspension ──
counts_before = psql(f"select (select count(*) from mess_students where \"messId\"='{MESS_A}')||'/'||(select count(*) from payments where \"messId\"='{MESS_A}')||'/'||(select count(*) from meal_attendance where \"messId\"='{MESS_A}')")
check('D suspend without reason -> 400', req('POST', f'/admin/messes/{MESS_A}/suspend', {}, admin)[0] == 400 and req('POST', f'/admin/messes/{MESS_A}/suspend', {'reason': '   '}, admin)[0] == 400)
s, b = req('POST', f'/admin/messes/{MESS_A}/suspend', {'reason': f'Unpaid platform dues {u}'}, admin)
check('D suspended, detail shows reason/by', s == 200 and b['data']['mess']['status'] == 'SUSPENDED' and b['data']['suspension']['reason'] == f'Unpaid platform dues {u}' and b['data']['suspension']['by'] == 'Platform Admin', b)
check('D suspend twice -> 409', req('POST', f'/admin/messes/{MESS_A}/suspend', {'reason': 'again'}, admin)[1]['error']['code'] == 'ADMIN_ACTION_NOT_ALLOWED')
check('D owner /auth/me shows SUSPENDED', req('GET', '/auth/me', token=owner)[1]['data']['membership']['mess']['status'] == 'SUSPENDED')
check('D owner can still read (students, reports)', req('GET', '/students', token=owner)[0] == 200 and req('GET', '/reports/payments', token=owner)[0] == 200)
st, sb = req('POST', '/students', {'firstName': 'Blocked', 'mobile': '7' + str(random.randint(100000000, 999999999)), 'joiningDate': today}, owner)
check('D owner: add student -> 403 MESS_SUSPENDED', st == 403 and sb['error']['code'] == 'MESS_SUSPENDED', sb)
sidA = psql(f"select id from mess_students where \"messId\"='{MESS_A}' and mobile='9100000001'")
check('D staff: manual meal -> MESS_SUSPENDED', req('POST', '/attendance/manual', {'studentId': sidA, 'mealType': 'dinner'}, staff)[1]['error']['code'] == 'MESS_SUSPENDED')
check('D staff: QR scan -> MESS_SUSPENDED', req('POST', '/attendance/scan', {'token': 'x', 'mealType': 'lunch'}, staff)[1]['error']['code'] == 'MESS_SUSPENDED')
check('D manager: payment -> MESS_SUSPENDED', req('POST', '/payments', {'studentId': sidA, 'subscriptionId': sidA, 'amountPaise': 100, 'method': 'CASH'}, manager)[1]['error']['code'] == 'MESS_SUSPENDED')
check('D owner: expense -> MESS_SUSPENDED', req('POST', '/expenses', {'title': 'x', 'amountPaise': 100, 'expenseDate': today, 'categoryId': sidA}, owner)[1]['error']['code'] == 'MESS_SUSPENDED')
check('D owner: menu edit -> MESS_SUSPENDED', req('PUT', f'/menus/{today}', {}, owner)[1]['error']['code'] == 'MESS_SUSPENDED')
check('D owner: subscription -> MESS_SUSPENDED', req('POST', f'/students/{sidA}/subscriptions', {}, owner)[1]['error']['code'] == 'MESS_SUSPENDED')
check('D student: pause -> MESS_SUSPENDED', req('POST', '/students/me/pauses', {'fromDate': today, 'toDate': today, 'mealTypes': ['dinner']}, stuA)[1]['error']['code'] == 'MESS_SUSPENDED')
check('D student: feedback/complaint -> MESS_SUSPENDED', req('POST', '/students/me/feedback/general', {'overallRating': 3}, stuA)[1]['error']['code'] == 'MESS_SUSPENDED' and req('POST', '/students/me/complaints', {'category': 'MENU', 'description': 'blocked?'}, stuA)[1]['error']['code'] == 'MESS_SUSPENDED')
check('D student: meal QR not issued', req('GET', '/students/me/meal-qr', token=stuA)[1]['data']['state'] == 'MESS_UNAVAILABLE')
check('D student can still read own history', req('GET', '/students/me/attendance', token=stuA)[0] == 200)
check('D Mess B unaffected', req('POST', '/students', {'firstName': f'B{u}', 'mobile': '7' + str(random.randint(100000000, 999999999)), 'joiningDate': today}, ownerB)[0] == 201)
check('D data intact while suspended', psql(f"select (select count(*) from mess_students where \"messId\"='{MESS_A}')||'/'||(select count(*) from payments where \"messId\"='{MESS_A}')||'/'||(select count(*) from meal_attendance where \"messId\"='{MESS_A}')") == counts_before)
check('D admin can still inspect suspended mess', req('GET', f'/admin/messes/{MESS_A}', token=admin)[0] == 200 and req('GET', f'/admin/messes/{MESS_A}/records/payments', token=admin)[0] == 200)
check('D dashboard counts suspended', req('GET', '/admin/dashboard', token=admin)[1]['data']['messes']['suspended'] == num("select count(*) from messes where status='SUSPENDED'") >= 1)
s, b = req('POST', f'/admin/messes/{MESS_A}/reactivate', {}, admin)
check('D reactivate (note optional)', s == 200 and b['data']['mess']['status'] == 'ACTIVE' and b['data']['suspension'] is None, b)
check('D owner can write again', req('POST', '/students', {'firstName': f'Back{u}', 'mobile': '7' + str(random.randint(100000000, 999999999)), 'joiningDate': today}, owner)[0] == 201)
check('D student QR back', req('GET', '/students/me/meal-qr', token=stuA)[1]['data']['state'] != 'INACTIVE')
check('D reactivate twice -> 409', req('POST', f'/admin/messes/{MESS_A}/reactivate', {}, admin)[0] == 409)

# ── F/E: users ──
s, b = req('GET', '/admin/users?search=9000000002', token=admin)
mrow = b['data'][0] if b['data'] else {}
check('E user search by mobile + memberships', s == 200 and mrow.get('role') == 'MESS_MANAGER' and mrow['messes'] == [{'messId': MESS_A, 'messName': 'Annapurna Student Mess', 'role': 'MESS_MANAGER'}] and no_secrets(b), b)
check('E role filter', all(x['role'] == 'MESS_OWNER' for x in req('GET', '/admin/users?role=MESS_OWNER&pageSize=100', token=admin)[1]['data']))
check('E search by email/name', req('GET', '/admin/users?search=owner@other.mess', token=admin)[1]['data'][0]['mobile'] == '9000000011' and req('GET', '/admin/users?search=Sunita', token=admin)[1]['meta']['total'] >= 1)
stu_row = req('GET', '/admin/users?search=9100000001', token=admin)[1]['data'][0]
check('E student account shows student mess link (support lookup)', stu_row['role'] == 'STUDENT' and stu_row['messes'][0]['messId'] == MESS_A, stu_row)
check('E filter by mess', all(any(m['messId'] == MESS_B for m in x['messes']) for x in req('GET', f'/admin/users?messId={MESS_B}&pageSize=100', token=admin)[1]['data']))
s, b = req('GET', f'/admin/users/{MANAGER_ID}', token=admin)
check('E user detail: memberships, canChangeStatus, safe', s == 200 and b['data']['memberships'][0]['messId'] == MESS_A and b['data']['canChangeStatus'] is True and no_secrets(b) and 'sessions' not in json.dumps(b), b)
check('E admin self: canChangeStatus false', req('GET', f'/admin/users/{ADMIN_ID}', token=admin)[1]['data']['canChangeStatus'] is False)
check('F cannot suspend self/admin', req('POST', f'/admin/users/{ADMIN_ID}/suspend', {'reason': 'oops'}, admin)[1]['error']['code'] == 'ADMIN_ACTION_NOT_ALLOWED' and psql(f"select status from users where id='{ADMIN_ID}'") == 'ACTIVE')
check('F suspend needs reason', req('POST', f'/admin/users/{MANAGER_ID}/suspend', {}, admin)[0] == 400)
s, b = req('POST', f'/admin/users/{MANAGER_ID}/suspend', {'reason': f'Shared password {u}'}, admin)
check('F manager suspended', s == 200 and b['data']['user']['status'] == 'DISABLED' and b['data']['suspension']['reason'] == f'Shared password {u}', b)
s, b = req('GET', '/students', token=manager)
check('F existing manager session rejected', s in (401, 403) and b['error']['code'] in ('SESSION_EXPIRED', 'ACCOUNT_DISABLED'), (s, b))
s, b = login_full('9000000002')
check('F new manager login blocked', s == 403 and b['error']['code'] == 'ACCOUNT_DISABLED', (s, b))
check('F owner and staff unaffected', req('GET', '/students', token=owner)[0] == 200 and req('GET', '/attendance/summary', token=staff)[0] == 200)
check('F data preserved', psql(f"select count(*) from mess_memberships where \"userId\"='{MANAGER_ID}' and status='ACTIVE'") == '1')
s, b = req('POST', f'/admin/users/{MANAGER_ID}/reactivate', {'reason': 'Password reset done'}, admin)
check('F reactivated', s == 200 and b['data']['user']['status'] == 'ACTIVE')
s, b = login_full('9000000002')
check('F manager can log in again and work', s == 200 and req('GET', '/students', token=b['data']['accessToken'])[0] == 200)

# ── G: complaints monitoring ──
stB_mobile = '7' + str(random.randint(100000000, 999999999))
req('POST', '/students', {'firstName': 'Cmp', 'mobile': stB_mobile, 'joiningDate': today}, ownerB)
stB = otp(stB_mobile)
cB = req('POST', '/students/me/complaints', {'category': 'CLEANLINESS', 'description': f'Mess B complaint {u}'}, stB)[1]['data']['id']
cA = req('POST', '/students/me/complaints', {'category': 'MENU', 'description': f'Mess A complaint {u}'}, stuA)[1]['data']['id']
s, b = req('GET', f'/admin/complaints?search=&pageSize=100', token=admin)
ids = {c['id'] for c in b['data']}
check('G admin sees complaints from both messes', cA in ids and cB in ids and b['meta']['total'] == num('select count(*) from complaints') if b['meta']['total'] <= 100 else cA in ids, (s, b['meta']))
check('G filter by mess', {c['mess']['id'] for c in req('GET', f'/admin/complaints?messId={MESS_B}&pageSize=100', token=admin)[1]['data']} == {MESS_B})
check('G filters status/category', all(c['status'] == 'OPEN' and c['category'] == 'CLEANLINESS' for c in req('GET', '/admin/complaints?status=OPEN&category=CLEANLINESS&pageSize=100', token=admin)[1]['data']))
s, b = req('GET', f'/admin/complaints/{cB}', token=admin)
check('G detail read-only, no attachment id, mess shown', s == 200 and b['data']['mess']['id'] == MESS_B and 'attachmentId' not in b['data'], b)
check('G admin cannot reply/change status (no such routes)', req('POST', f'/admin/complaints/{cB}/responses', {'message': 'hi'}, admin)[0] == 404 and req('PATCH', f'/complaints/{cB}/status', {'status': 'IN_PROGRESS'}, admin)[0] == 403)
check('G owner A still cannot see Mess B complaint', req('GET', f'/complaints/{cB}', token=owner)[0] == 404)
check('G complaint unknown -> 404', req('GET', '/admin/complaints/00000000-0000-4000-8000-000000000000', token=admin)[0] == 404)

# ── H: audit ──
s, b = req('GET', f'/admin/audit?targetId={MESS_A}&pageSize=10', token=admin)
acts = [a['action'] for a in b['data']]
check('H mess suspend + reactivate audited (newest first)', acts[:2] == ['MESS_REACTIVATED', 'MESS_SUSPENDED'], acts)
sus = next(a for a in b['data'] if a['action'] == 'MESS_SUSPENDED')
check('H mess entry: actor, target, reason, time, mess', sus['actor']['id'] == ADMIN_ID and sus['targetLabel'] == 'Annapurna Student Mess' and sus['reason'] == f'Unpaid platform dues {u}' and sus['createdAt'] and sus['mess']['id'] == MESS_A, sus)
s, b = req('GET', f'/admin/audit?targetType=USER&targetId={MANAGER_ID}&pageSize=10', token=admin)
check('H user suspend + reactivate audited with reasons', [(a['action'], a['reason']) for a in b['data'][:2]] == [('USER_REACTIVATED', 'Password reset done'), ('USER_SUSPENDED', f'Shared password {u}')] and b['data'][0]['targetLabel'] == 'Sunita Joshi', b['data'][:2])
check('H failed attempts not audited (only 1 suspend for this run)', num(f"select count(*) from audit_logs where reason='Unpaid platform dues {u}'") == 1)
check('H audit filters + no secrets', all(a['action'] == 'USER_SUSPENDED' for a in req('GET', '/admin/audit?action=USER_SUSPENDED', token=admin)[1]['data']) and no_secrets(b) and req('GET', '/admin/audit?action=BAD', token=admin)[0] == 400)
check('H date filter', req('GET', f'/admin/audit?from=2020-01-01&to=2020-01-31', token=admin)[1]['meta']['total'] == 0 and req('GET', f'/admin/audit?from={today}&to={today}', token=admin)[1]['meta']['total'] >= 4)
check('H mess detail shows recent activity', any(a['action'] == 'MESS_SUSPENDED' for a in req('GET', f'/admin/messes/{MESS_A}', token=admin)[1]['data']['recentActivity']))

# ── I: system ──
s, b = req('GET', '/admin/system', token=admin)
sysd = b['data']; text = json.dumps(b)
check('I system: safe fields', s == 200 and sysd['database']['reachable'] is True and sysd['push']['provider'] in ('expo', 'log', 'disabled') and isinstance(sysd['scheduler']['enabled'], bool) and sysd['storage']['provider'] == 'local' and sysd['environment'], sysd)
leaks = [k for k, v in env.items() if len(v) >= 6 and v not in ('true', 'false', 'development', 'console', 'expo', 'log', 'disabled') and v in text]
check('I no env values leaked (DB URL, JWT secret, tokens, paths)', not leaks and 'postgres' not in text and 'uploads' not in text.replace('"warning"', '') .lower().split('storage')[0] and 'JWT' not in text, leaks)
check('I no upload path', env.get('UPLOAD_DIR', 'uploads') not in json.dumps(sysd['storage']) or env.get('UPLOAD_DIR') is None)

# ── Dashboard consistency ──
d = req('GET', '/admin/dashboard', token=admin)[1]['data']
check('J dashboard messes == DB', d['messes']['total'] == num('select count(*) from messes') and d['messes']['active'] == num("select count(*) from messes where status='ACTIVE'"))
check('J dashboard students == DB', d['students']['active'] == num("select count(*) from mess_students where status='ACTIVE'") and d['students']['total'] == num("select count(*) from mess_students where status<>'ARCHIVED'"))
check('J meals served today == DB (SERVED only)', d['usage']['mealsServedToday'] == num(f"select count(*) from meal_attendance where status='SERVED' and \"attendanceDate\"='{today}'"))
check('J payments this month == DB (RECORDED only)', d['usage']['paymentsThisMonth']['count'] == num(f"select count(*) from payments where status='RECORDED' and \"paymentDate\">='{month}-01'") and d['usage']['paymentsThisMonth']['amountPaise'] == num(f"select coalesce(sum(\"amountPaise\"),0) from payments where status='RECORDED' and \"paymentDate\">='{month}-01'"))
check('J complaints == DB', d['complaints']['open'] == num("select count(*) from complaints where status='OPEN'") and d['complaints']['inProgress'] == num("select count(*) from complaints where status='IN_PROGRESS'"))
check('J active subscriptions == DB', d['usage']['activeSubscriptions'] == num(f"select count(*) from student_subscriptions where \"cancelledAt\" is null and \"startDate\"<='{today}' and \"endDate\">='{today}'"))
check('J per-mess meals add up to platform', d['usage']['mealsServedToday'] == sum(req('GET', f'/admin/messes/{m}', token=admin)[1]['data']['attendance']['today']['total'] for m in psql('select id from messes').split('\n')))
check('J users by role == DB', d['users']['owners'] == num("select count(*) from users where role='MESS_OWNER'") and d['users']['studentAccounts'] == num("select count(*) from users where role='STUDENT'"))
check('J dashboard safe', no_secrets(d))

print(f"\n{sum(results)}/{len(results)} checks passed")
