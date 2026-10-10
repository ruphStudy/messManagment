import json, subprocess, urllib.request, datetime, random, base64, hmac, hashlib, time, concurrent.futures
import os as _os
B = _os.environ.get('MESS_TEST_BASE', 'http://localhost:4100/api/v1')
SECRET = [l.split('=',1)[1].strip() for l in open('./apps/api/.env') if l.startswith('JWT_ACCESS_SECRET=')][0]
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
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {str(info)[:700]}'))
def login(i): return req('POST', '/auth/login', {'identifier': i, 'password': 'Password123'})[1]['data']['accessToken']
def otp_login(m):
    code = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    return req('POST', '/auth/otp/verify', {'mobile': m, 'code': code}, mobile=True)[1]['data']['accessToken']
def psql(sql): return subprocess.run(['psql', '-tA', 'mess_management', '-c', sql], capture_output=True, text=True).stdout.strip()
today = subprocess.run(['node', '-e', "console.log(require('./packages/shared/dist').businessToday())"], capture_output=True, text=True).stdout.strip()
def add(d, n): return (datetime.date.fromisoformat(d) + datetime.timedelta(days=n)).isoformat()
def b64(d): return base64.urlsafe_b64encode(json.dumps(d, separators=(',', ':')).encode()).rstrip(b'=').decode()
def jwt(claims, secret):
    h = b64({'alg': 'HS256', 'typ': 'JWT'}); p = b64(claims)
    sig = base64.urlsafe_b64encode(hmac.new(secret.encode(), f'{h}.{p}'.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f'{h}.{p}.{sig}'
mob = lambda: '7' + str(random.randint(100000000, 999999999))

owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
u = str(random.randint(10000, 99999))
def plan(tok, name, l, d, credits=None, b=False):
    s, r = req('POST', '/meal-plans', {'name': f'{name} {u}', 'price': 100, 'breakfastIncluded': b, 'lunchIncluded': l, 'dinnerIncluded': d, 'durationType': 'MONTHS', 'durationValue': 1, 'mealCredits': credits}, tok)
    return r['data']['id']
LD10 = plan(owner, 'LD10', True, True, 10)
LDU = plan(owner, 'LDU', True, True)
DO = plan(owner, 'DinnerOnly', False, True)
def student(tok, plan_id, start=None):
    m = mob()
    sid = req('POST', '/students', {'firstName': 'Att', 'lastName': u, 'mobile': m, 'joiningDate': today}, tok)[1]['data']['id']
    sub = None
    if plan_id: sub = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': plan_id, 'startDate': start or today}, tok)[1]['data']['id']
    return sid, m, sub
def qr_for(m):
    t = otp_login(m); s, b = req('GET', '/students/me/meal-qr', token=t); return t, b['data']
MESS_A = psql("select id from messes where name='Annapurna Student Mess'")
def mint(sid, mid=None):
    # A valid QR exactly like the API issues (same key/audience/TTL) — avoids OTP rate limits for scan-only students.
    return {'token': jwt({'sid': sid, 'mid': mid or MESS_A, 'aud': 'meal-qr', 'iat': int(time.time()), 'exp': int(time.time()) + 60}, SECRET + ':meal-qr')}
def scan(token, meal, tok=None): return req('POST', '/attendance/scan', {'qrToken': token, 'mealType': meal}, tok or staff)
remaining = lambda sub: psql(f"select \"remainingMealCredits\" from student_subscriptions where id='{sub}'")

# Flow A — QR success (limited 10)
sidA, mA, subA = student(owner, LD10)
stA, q = qr_for(mA)
check('A student gets READY QR with expiry ~60s', q['state'] == 'READY' and 55 <= q['expiresIn'] <= 60 and q['meals'] == {'breakfast': False, 'lunch': True, 'dinner': True} and q['servedToday'] == [], q)
check('A QR token does not contain raw mobile/name', mA not in q['token'] and 'Att' not in base64.urlsafe_b64decode(q['token'].split('.')[1] + '==').decode())
s, b = scan(q['token'], 'lunch')
d = b['data']
check('A staff scan lunch -> SERVED', s == 200 and d['outcome'] == 'SERVED' and d['attendance']['source'] == 'QR' and d['attendance']['creditDeducted'] and d['attendance']['remainingMealCredits'] == 9 and d['attendance']['date'] == today, (s, b))
check('A credit 10 -> 9', remaining(subA) == '9')
attA = d['attendance']['id']
# Flow B — duplicate
s, b = scan(q['token'], 'lunch', manager)
check('B duplicate -> ALREADY_SERVED with student name', b['data']['outcome'] == 'REJECTED' and b['data']['reason'] == 'ALREADY_SERVED' and b['data']['message'] == 'Lunch already served today.' and b['data']['student']['id'] == sidA, b)
check('B no second deduction / row', remaining(subA) == '9' and psql(f"select count(*) from meal_attendance where \"studentId\"='{sidA}'") == '1')
s, b = req('GET', '/students/me/meal-qr', token=stA)
check('Student QR shows lunch served today', b['data']['servedToday'] == ['lunch'], b)
# Breakfast not in plan
s, b = scan(q['token'], 'breakfast')
check('Breakfast not in LD plan -> MEAL_NOT_INCLUDED', b['data']['reason'] == 'MEAL_NOT_INCLUDED' and remaining(subA) == '9', b)

# Flow C — wrong meal
sidC, mC, subC = student(owner, DO)
qc = mint(sidC)
s, b = scan(qc['token'], 'lunch')
check('C Dinner-only scanned for lunch -> MEAL_NOT_INCLUDED, no row', b['data']['reason'] == 'MEAL_NOT_INCLUDED' and b['data']['message'] == 'Lunch is not included in this plan.' and psql(f"select count(*) from meal_attendance where \"studentId\"='{sidC}'") == '0', b)

# Flow D — expired / future subscriptions
sidD, mD, subD = student(owner, LD10, add(today, -60))
_, qd = qr_for(mD)
check('D expired plan -> QR state NO_PLAN (no token)', qd['state'] == 'NO_PLAN' and 'token' not in qd, qd)
s, b = req('POST', '/attendance/manual', {'studentId': sidD, 'mealType': 'lunch'}, staff)
check('D expired plan manual -> NO_ACTIVE_SUBSCRIPTION', b['data']['reason'] == 'NO_ACTIVE_SUBSCRIPTION', b)
sidF, mF, subF = student(owner, LD10, add(today, 5))
s, b = req('POST', '/attendance/manual', {'studentId': sidF, 'mealType': 'lunch'}, staff)
check('D future plan -> NO_ACTIVE_SUBSCRIPTION, upcoming credits untouched', b['data']['reason'] == 'NO_ACTIVE_SUBSCRIPTION' and remaining(subF) == '10', b)
# Upcoming renewal not consumed
req('POST', f'/subscriptions/{subA}/renew', {}, owner)
s, b = scan(q['token'], 'dinner')
renewal = psql(f"select \"remainingMealCredits\" from student_subscriptions where \"studentId\"='{sidA}' and \"startDate\" > '{today}'")
check('Upcoming renewal untouched; current used', b['data']['outcome'] == 'SERVED' and remaining(subA) == '8' and renewal == '10', (b, renewal))

# Flow E — credits exhaustion
sidE, mE, subE = student(owner, LD10)
psql(f"update student_subscriptions set \"remainingMealCredits\"=1 where id='{subE}'")
qe = mint(sidE)
s1, b1 = scan(qe['token'], 'lunch'); s2, b2 = scan(qe['token'], 'dinner')
check('E last credit: lunch ok -> 0, dinner NO_MEAL_CREDITS', b1['data']['outcome'] == 'SERVED' and b2['data']['reason'] == 'NO_MEAL_CREDITS' and remaining(subE) == '0', (b1, b2))
check('E no negative credits, one row', psql(f"select count(*) from meal_attendance where \"studentId\"='{sidE}'") == '1')

# Unlimited
sidU, mU, subU = student(owner, LDU)
qu = mint(sidU)
s, b = scan(qu['token'], 'lunch')
check('Unlimited: served, credits null, not deducted', b['data']['outcome'] == 'SERVED' and b['data']['attendance']['remainingMealCredits'] is None and not b['data']['attendance']['creditDeducted'], b)
s, b = scan(qu['token'], 'lunch')
check('Unlimited duplicate still blocked', b['data']['reason'] == 'ALREADY_SERVED')

# Flow F — manual
sidM, mM, subM = student(owner, LD10)
s, b = req('POST', '/attendance/manual', {'studentId': sidM, 'mealType': 'lunch', 'note': 'Phone not working'}, staff)
check('F manual served with note, source MANUAL, credit deducted', s == 200 and b['data']['outcome'] == 'SERVED' and b['data']['attendance']['source'] == 'MANUAL' and b['data']['attendance']['note'] == 'Phone not working' and remaining(subM) == '9', (s, b))
s, b = req('POST', '/attendance/manual', {'studentId': sidM, 'mealType': 'lunch'}, owner)
check('F manual duplicate -> ALREADY_SERVED', b['data']['reason'] == 'ALREADY_SERVED' and remaining(subM) == '9')
s, b = req('GET', f'/attendance?date={today}&search={mM}', token=staff)
check('F daily list shows manual entry', s == 200 and b['data'][0]['source'] == 'MANUAL' and b['data'][0]['servedBy'], b)
req('PATCH', f'/students/{sidM}/status', {'status': 'INACTIVE'}, owner)
s, b = req('POST', '/attendance/manual', {'studentId': sidM, 'mealType': 'dinner'}, staff)
check('Inactive student -> STUDENT_NOT_ACTIVE', b['data']['reason'] == 'STUDENT_NOT_ACTIVE', b)
stM = otp_login(mM)
s, b = req('GET', '/students/me/meal-qr', token=stM)
check('Inactive student QR state INACTIVE, no token', b['data']['state'] == 'INACTIVE' and 'token' not in b['data'], b)
req('PATCH', f'/students/{sidM}/status', {'status': 'ACTIVE'}, owner)

# Flow G — reversal
s, b = req('POST', f'/attendance/{attA}/reverse', {'reason': 'Scanned wrong student'}, staff)
check('G staff cannot reverse', s == 403, (s, b))
before = remaining(subA)
s, b = req('POST', f'/attendance/{attA}/reverse', {'reason': 'Scanned wrong student'}, manager)
check('G manager reverses: status REVERSED, reason & who recorded', s == 200 and b['data']['status'] == 'REVERSED' and b['data']['reversalReason'] == 'Scanned wrong student' and b['data']['reversedBy'], (s, b))
check('G credit restored exactly once', int(remaining(subA)) == int(before) + 1, (before, remaining(subA)))
s, b = req('POST', f'/attendance/{attA}/reverse', {}, owner)
check('G second reversal -> ATTENDANCE_ALREADY_REVERSED, no extra credit', s == 409 and b['error']['code'] == 'ATTENDANCE_ALREADY_REVERSED' and int(remaining(subA)) == int(before) + 1, (s, b))
s, b = scan(q['token'], 'lunch')
check('G lunch can be served again after reversal', b['data']['outcome'] == 'SERVED' and int(remaining(subA)) == int(before), b)
check('G history keeps reversed row', psql(f"select string_agg(status::text, ',' order by \"createdAt\") from meal_attendance where \"studentId\"='{sidA}' and \"mealType\"='lunch'") == 'REVERSED,SERVED')
s, b = req('GET', f'/attendance/summary?date={today}', token=staff)
check('Summary counts exclude reversed', s == 200 and b['data']['total'] == b['data']['breakfast'] + b['data']['lunch'] + b['data']['dinner'] and b['data']['lunch'] >= 3, b)
s, b = req('GET', f'/attendance?date={today}&status=REVERSED&pageSize=100', token=owner)
check('List filter by status REVERSED', all(x['status'] == 'REVERSED' for x in b['data']) and any(x['id'] == attA for x in b['data']), b)
s, b = req('GET', f'/attendance?date={today}&mealType=dinner&pageSize=100', token=owner)
check('List filter by meal', b['data'] and all(x['mealType'] == 'dinner' for x in b['data']), b)

# QR security
exp = jwt({'sid': sidU, 'mid': psql("select id from messes where name='Annapurna Student Mess'"), 'aud': 'meal-qr', 'iat': int(time.time()) - 120, 'exp': int(time.time()) - 60}, SECRET + ':meal-qr')
check('Expired QR -> QR_EXPIRED', scan(exp, 'dinner')[1]['data']['reason'] == 'QR_EXPIRED')
forged = jwt({'sid': sidU, 'mid': 'x', 'aud': 'meal-qr', 'exp': int(time.time()) + 60}, 'wrong-secret')
check('Forged signature -> QR_INVALID', scan(forged, 'dinner')[1]['data']['reason'] == 'QR_INVALID')
check('Access token as QR -> QR_INVALID', scan(stA, 'dinner')[1]['data']['reason'] == 'QR_INVALID')
check('Garbage QR -> QR_INVALID', scan('hello', 'dinner')[1]['data']['reason'] == 'QR_INVALID')
s, b = scan(q['token'], 'snacks')
check('Invalid meal type -> 400', s == 400, (s, b))

# Flow H — tenant isolation
sidB, mB, subB = student(ownerB, plan(ownerB, 'BLD', True, True))
_, qb = qr_for(mB)
s, b = scan(qb['token'], 'lunch', staff)
check('H Mess B QR at Mess A scanner -> STUDENT_NOT_FOUND, no details', b['data']['reason'] == 'STUDENT_NOT_FOUND' and b['data']['student'] is None and psql(f"select count(*) from meal_attendance where \"studentId\"='{sidB}'") == '0', b)
s, b = req('POST', '/attendance/manual', {'studentId': sidB, 'mealType': 'lunch'}, owner)
check('H Mess A manual on Mess B student -> 404', s == 404, (s, b))
s, b = scan(qb['token'], 'lunch', ownerB)
attB = b['data']['attendance']['id']
check('H Mess B serves own student', b['data']['outcome'] == 'SERVED')
s, b = req('POST', f'/attendance/{attB}/reverse', {}, owner)
check('H Mess A reverse Mess B attendance -> 404', s == 404 and psql(f"select status from meal_attendance where id='{attB}'") == 'SERVED', (s, b))
s, b = req('GET', f'/attendance?date={today}&pageSize=100', token=owner)
check('H Mess A list excludes Mess B', not any(x['id'] == attB for x in b['data']))
s, b = req('POST', '/attendance/not-a-uuid/reverse', {}, owner)
check('Malformed id -> 404', s == 404)

# Students: own history only, no scanner
s, b = req('GET', '/students/me/attendance', token=stA)
check('Student history: own rows only incl reversed', s == 200 and b['meta']['total'] == int(psql(f"select count(*) from meal_attendance where \"studentId\"='{sidA}'")) and {x['status'] for x in b['data']} == {'SERVED', 'REVERSED'}, b)
check('Student history hides internal fields', all(set(x) == {'id', 'date', 'mealType', 'status', 'servedAt', 'planName'} for x in b['data']))
for name, (m, p, body) in {'scan': ('POST', '/attendance/scan', {'qrToken': q['token'], 'mealType': 'dinner'}), 'manual': ('POST', '/attendance/manual', {'studentId': sidA, 'mealType': 'dinner'}), 'list': ('GET', '/attendance', None), 'reverse': ('POST', f'/attendance/{attA}/reverse', {})}.items():
    check(f'Student blocked from {name}', req(m, p, body, stA)[0] == 403)
check('Unauthenticated scan blocked', req('POST', '/attendance/scan', {'qrToken': 'x', 'mealType': 'lunch'})[0] == 401)
other = otp_login(mob())
check('Unlinked student QR -> NOT_LINKED', req('GET', '/students/me/meal-qr', token=other)[1]['data'] == {'state': 'NOT_LINKED'})

# Flow I — concurrency
sidX, mX, subX = student(owner, LD10)
qx = mint(sidX)
with concurrent.futures.ThreadPoolExecutor(10) as ex:
    out = list(ex.map(lambda _: scan(qx['token'], 'lunch')[1]['data'], range(10)))
served = [o for o in out if o['outcome'] == 'SERVED']
check('I 10 parallel lunch scans -> exactly 1 served, rest ALREADY_SERVED', len(served) == 1 and all(o['reason'] == 'ALREADY_SERVED' for o in out if o['outcome'] != 'SERVED'), [o.get('reason') for o in out])
check('I credits 10 -> 9 exactly', remaining(subX) == '9')
with concurrent.futures.ThreadPoolExecutor(10) as ex:
    out = list(ex.map(lambda i: scan(qx['token'], 'dinner' if i % 2 else 'breakfast')[1]['data'], range(10)))
check('I parallel dinner(+invalid breakfast) -> 1 dinner served, credits 8', sum(o['outcome'] == 'SERVED' for o in out) == 1 and remaining(subX) == '8', [o.get('reason') for o in out])
sidY, mY, subY = student(owner, LD10)
psql(f"update student_subscriptions set \"remainingMealCredits\"=1 where id='{subY}'")
qy = mint(sidY)
with concurrent.futures.ThreadPoolExecutor(10) as ex:
    out = list(ex.map(lambda i: scan(qy['token'], 'lunch' if i % 2 else 'dinner')[1]['data'], range(10)))
check('I last credit raced across lunch/dinner -> 1 served, credits 0', sum(o['outcome'] == 'SERVED' for o in out) == 1 and remaining(subY) == '0', [o.get('reason') for o in out])
check('Global: no credits below 0 or above total', psql('select count(*) from student_subscriptions where "remainingMealCredits" < 0 or "remainingMealCredits" > "totalMealCredits"') == '0')
print(f"\n{sum(results)}/{len(results)} checks passed")
