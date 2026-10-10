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
        with urllib.request.urlopen(r, timeout=30) as res:
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
    return f"{h}.{p}." + base64.urlsafe_b64encode(hmac.new(secret.encode(), f'{h}.{p}'.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
MESS_A = psql("select id from messes where name='Annapurna Student Mess'")
def mint(sid, mid=MESS_A): return jwt({'sid': sid, 'mid': mid, 'aud': 'meal-qr', 'iat': int(time.time()), 'exp': int(time.time()) + 60}, SECRET + ':meal-qr')
mob = lambda: '7' + str(random.randint(100000000, 999999999))
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
u = str(random.randint(10000, 99999))
def plan(tok, name, l, d, credits=None, months=1):
    return req('POST', '/meal-plans', {'name': f'{name} {u}', 'price': 100, 'lunchIncluded': l, 'dinnerIncluded': d, 'durationType': 'MONTHS', 'durationValue': months, 'mealCredits': credits}, tok)[1]['data']['id']
LD = plan(owner, 'LD', True, True); LD10 = plan(owner, 'LD10', True, True, 10); DO = plan(owner, 'DO', False, True)
def student(tok, plan_id, start=None, end=None):
    m = mob()
    sid = req('POST', '/students', {'firstName': 'Pause', 'lastName': u, 'mobile': m, 'joiningDate': today}, tok)[1]['data']['id']
    body = {'mealPlanId': plan_id, 'startDate': start or today}
    if end: body['endDate'] = end
    sub = req('POST', f'/students/{sid}/subscriptions', body, tok)[1]['data']['id'] if plan_id else None
    return sid, m, sub
def cutoffs(b='06:00', l='09:00', d='16:00', tok=None):
    return req('PATCH', '/mess/settings', {'breakfastPauseCutoff': b, 'lunchPauseCutoff': l, 'dinnerPauseCutoff': d}, tok or owner)
def expected(date, tok=None): return req('GET', f'/attendance/expected?date={date}', token=tok or staff)[1]['data']['meals']
def pause_for(sid, frm, to, meals, tok=None, reason=None):
    body = {'fromDate': frm, 'toDate': to, 'mealTypes': meals}
    if reason: body['reason'] = reason
    return req('POST', f'/students/{sid}/pauses', body, tok or owner)
remaining = lambda sub: psql(f"select \"remainingMealCredits\" from student_subscriptions where id='{sub}'")

# Settings
s, b = cutoffs('06:00', '09:30', '16:00', manager)
check('Cut-offs configurable via mess settings', s == 200 and b['data']['lunchPauseCutoff'] == '09:30', (s, b))
s, b = req('PATCH', '/mess', {'lunchPauseCutoff': '9am'}, owner)
check('Invalid cut-off rejected', s == 400 and 'lunchPauseCutoff' in b['error']['fields'], (s, b))
s, b = req('PATCH', '/mess', {'lunchPauseCutoff': '10:00'}, staff)
check('Staff cannot change cut-offs', s == 403)
cutoffs('23:59', '23:59', '23:59')  # today's cut-offs still open

# Flow A — same-day pause via the student app
sidA, mA, subA = student(owner, LD10)
stA = otp_login(mA)
before = expected(today)
s, b = req('POST', '/students/me/pauses', {'fromDate': today, 'toDate': today, 'mealTypes': ['lunch'], 'reason': 'Exams'}, stA)
check('A student pauses today lunch', s == 201 and len(b['data']['created']) == 1 and b['data']['failed'] == [] and b['data']['skipped'] == [], (s, b))
pauseA = b['data']['created'][0]['id']
after = expected(today)
check('A expected lunch -1, dinner unchanged', after['lunch']['expected'] == before['lunch']['expected'] - 1 and after['lunch']['paused'] == before['lunch']['paused'] + 1 and after['dinner'] == before['dinner'], (before, after))
s, b = req('POST', '/attendance/scan', {'qrToken': mint(sidA), 'mealType': 'lunch'}, staff)
check('A paused lunch scan -> MEAL_PAUSED', b['data']['reason'] == 'MEAL_PAUSED' and b['data']['message'] == 'Lunch is paused for today.', b)
s, b = req('POST', '/attendance/manual', {'studentId': sidA, 'mealType': 'lunch'}, owner)
check('A manual attendance also MEAL_PAUSED', b['data']['reason'] == 'MEAL_PAUSED', b)
s, b = req('POST', '/attendance/scan', {'qrToken': mint(sidA), 'mealType': 'dinner'}, staff)
check('A dinner still served', b['data']['outcome'] == 'SERVED', b)
s, b = req('GET', '/students/me/pause-settings', token=stA)
check('A pause-settings: lunch PAUSED, dinner SERVED', b['data']['todayMeals'] == {'breakfast': 'NOT_INCLUDED', 'lunch': 'PAUSED', 'dinner': 'SERVED'} and b['data']['cutoffs']['lunch'] == '23:59', b)
s, b = req('GET', '/students/me/meal-qr', token=stA)
check('A QR shows pausedToday', b['data']['pausedToday'] == ['lunch'] and b['data']['servedToday'] == ['dinner'], b)

# Flow E — credits untouched by pause / cancel
check('E credits unchanged by pause (10 - 1 dinner = 9)', remaining(subA) == '9')
s, b = req('POST', f'/students/me/pauses/{pauseA}/cancel', token=stA)
check('E student cancels (resumes) lunch', s == 200 and b['data']['status'] == 'CANCELLED' and not b['data']['canCancel'] and 'student' not in b['data'], (s, b))
check('E credits unchanged by cancel', remaining(subA) == '9')
check('E expected restored', expected(today)['lunch']['expected'] == before['lunch']['expected'])
s, b = req('POST', f'/students/me/pauses/{pauseA}/cancel', token=stA)
check('Cancel twice -> PAUSE_ALREADY_CANCELLED', s == 409 and b['error']['code'] == 'PAUSE_ALREADY_CANCELLED', (s, b))
s, b = req('POST', '/attendance/scan', {'qrToken': mint(sidA), 'mealType': 'lunch'}, staff)
check('E lunch served after cancel; credit 9 -> 8', b['data']['outcome'] == 'SERVED' and remaining(subA) == '8', b)

# Flow F — already served
s, b = req('POST', '/students/me/pauses', {'fromDate': today, 'toDate': today, 'mealTypes': ['lunch', 'dinner']}, stA)
check('F pausing eaten meals -> skipped ATTENDANCE_ALREADY_SERVED, none created', b['data']['created'] == [] and {x['reason'] for x in b['data']['skipped']} == {'ATTENDANCE_ALREADY_SERVED'} and len(b['data']['skipped']) == 2, b)
check('F attendance unchanged', psql(f"select count(*) from meal_attendance where \"studentId\"='{sidA}' and status='SERVED'") == '2')

# Flow B — cut-off passed
cutoffs('00:00', '00:00', '00:00')
sidB, mB, subB = student(owner, LD)
eb = expected(today)
s, b = pause_for(sidB, today, today, ['lunch'])
check('B cut-off passed -> failed PAUSE_CUTOFF_PASSED, nothing created', b['data']['created'] == [] and b['data']['failed'][0]['reason'] == 'PAUSE_CUTOFF_PASSED' and b['data']['failed'][0]['message'] == 'Lunch can no longer be paused for today.', b)
check('B expected unchanged', expected(today) == eb)
s, b = pause_for(sidB, add(today, 1), add(today, 1), ['lunch'])
check('B tomorrow still allowed after today cut-off', len(b['data']['created']) == 1, b)
cutoffs('23:59', '23:59', '23:59')

# Flow C — multi-day future leave
sidC, mC, subC = student(owner, LD)
d1 = add(today, 2)
e_before = [expected(add(d1, i)) for i in range(3)]
s, b = pause_for(sidC, d1, add(d1, 2), ['lunch', 'dinner'], manager, 'Going home')
check('C 3 days x 2 meals -> 6 created', s == 201 and len(b['data']['created']) == 6, (s, b))
e_after = [expected(add(d1, i)) for i in range(3)]
check('C expected -1 per meal per day', all(e_after[i][m]['expected'] == e_before[i][m]['expected'] - 1 for i in range(3) for m in ('lunch', 'dinner')), (e_before, e_after))
s, b = pause_for(sidC, d1, add(d1, 1), ['lunch', 'breakfast'])
check('C repeat: lunch skipped as already paused, breakfast failed (not in plan)', len(b['data']['skipped']) == 2 and all(x['reason'] == 'PAUSE_ALREADY_EXISTS' for x in b['data']['skipped']) and len(b['data']['failed']) == 2 and all(x['reason'] == 'MEAL_NOT_INCLUDED' for x in b['data']['failed']), b)
s, b = req('GET', f'/pauses/calendar?from={d1}&to={add(d1, 2)}', token=staff)
check('C calendar counts', s == 200 and all(x['lunch'] >= 1 and x['dinner'] >= 1 for x in b['data']) and len(b['data']) == 3, b)

# Flow D — cancel restores tomorrow
sidD, mD, subD = student(owner, LD)
tm = add(today, 1)
e0 = expected(tm)['lunch']['expected']
s, b = pause_for(sidD, tm, tm, ['lunch'])
pid = b['data']['created'][0]['id']
check('D expected tomorrow -1', expected(tm)['lunch']['expected'] == e0 - 1)
s, b = req('POST', f'/pauses/{pid}/cancel', token=manager)
check('D manager cancels; history kept with who', s == 200 and b['data']['status'] == 'CANCELLED' and b['data']['cancelledBy'] and b['data']['createdBy'], (s, b))
check('D expected restored', expected(tm)['lunch']['expected'] == e0)
check('D cancelled row kept', psql(f"select status from meal_pauses where id='{pid}'") == 'CANCELLED')

# Flow G — renewal spanning
end = add(today, 1)
sidG, mG, subG = student(owner, LD, today, end)
req('POST', f'/subscriptions/{subG}/renew', {'mealPlanId': DO}, owner)  # renewal = Dinner Only from end+1
s, b = pause_for(sidG, today, add(end, 2), ['lunch', 'dinner'])
created = {(x['date'], x['mealType']) for x in b['data']['created']}
failed = {(x['date'], x['mealType']): x['reason'] for x in b['data']['failed']}
check('G dates validated against the plan valid on each date (current L+D, renewal Dinner only)',
      created == {(today, 'lunch'), (today, 'dinner'), (end, 'lunch'), (end, 'dinner'), (add(end, 1), 'dinner'), (add(end, 2), 'dinner')}
      and failed == {(add(end, 1), 'lunch'): 'MEAL_NOT_INCLUDED', (add(end, 2), 'lunch'): 'MEAL_NOT_INCLUDED'}, b)
s, b = pause_for(sidG, add(today, 40), add(today, 41), ['dinner'])
check('G beyond all plans -> NO_ACTIVE_SUBSCRIPTION', len(b['data']['failed']) == 2 and b['data']['failed'][0]['reason'] == 'NO_ACTIVE_SUBSCRIPTION', b)

# Flow H — plan change (immediate L+D now; future plan dinner only via change AFTER_CURRENT)
sidH, mH, subH = student(owner, LD, today, add(today, 2))
req('POST', f'/subscriptions/{subH}/change-plan', {'mealPlanId': DO, 'mode': 'AFTER_CURRENT'}, owner)
s, b = pause_for(sidH, add(today, 3), add(today, 3), ['lunch', 'dinner'])
check('H after plan change: future lunch rejected, dinner paused', [x['mealType'] for x in b['data']['created']] == ['dinner'] and b['data']['failed'][0]['reason'] == 'MEAL_NOT_INCLUDED', b)

# Flow I — owner manual pause visible to student
sidI, mI, subI = student(owner, LD)
stI = otp_login(mI)
s, b = pause_for(sidI, tm, tm, ['dinner'], owner, 'Called the owner')
s, b = req('GET', '/students/me/pauses?view=upcoming', token=stI)
check('I student sees owner-made pause (source MESS)', b['data'] and b['data'][0]['source'] == 'MESS' and b['data'][0]['reason'] == 'Called the owner' and b['data'][0]['canCancel'], b)
s, b = req('GET', f'/pauses?studentId={sidI}', token=staff)
check('I staff can view pause list', s == 200 and b['meta']['total'] == 1 and b['data'][0]['createdBy'], b)
s, b = pause_for(sidI, tm, tm, ['lunch'], staff)
check('Staff cannot create pause', s == 403)
s, b = req('POST', f"/pauses/{psql(f'select id from meal_pauses where \"studentId\"=' + chr(39) + sidI + chr(39))}/cancel", token=staff)
check('Staff cannot cancel pause', s == 403)

# Validation
s, b = pause_for(sidI, add(today, -1), today, ['lunch'])
check('Past start date -> PAUSE_DATE_PAST', s == 400 and b['error']['code'] == 'PAUSE_DATE_PAST', (s, b))
s, b = pause_for(sidI, today, add(today, 31), ['lunch'])
check('Range > 31 days rejected', s == 400, (s, b))
s, b = pause_for(sidI, tm, today, ['lunch'])
check('to < from rejected', s == 400)
s, b = pause_for(sidI, tm, tm, [])
check('No meals rejected', s == 400 and 'mealTypes' in b['error']['fields'])
s, b = pause_for(sidI, tm, tm, ['snack'])
check('Invalid meal rejected', s == 400)
req('PATCH', f'/students/{sidI}/status', {'status': 'INACTIVE'}, owner)
s, b = pause_for(sidI, tm, tm, ['lunch'])
check('Inactive student -> STUDENT_NOT_ACTIVE', s == 409 and b['error']['code'] == 'STUDENT_NOT_ACTIVE', (s, b))
before_inactive = expected(tm)
req('PATCH', f'/students/{sidI}/status', {'status': 'ACTIVE'}, owner)
check('Inactive students are not counted as expected', expected(tm)['dinner']['entitled'] == before_inactive['dinner']['entitled'] + 1, (before_inactive['dinner'], expected(tm)['dinner']))

# Past pause cannot be cancelled
past_id = psql(f"insert into meal_pauses (id, \"messId\", \"studentId\", \"subscriptionId\", \"pauseDate\", \"mealType\", source, \"updatedAt\") values (gen_random_uuid(), '{MESS_A}', '{sidI}', '{subI}', '{add(today, -1)}', 'lunch', 'MESS', now()) returning id").split('\n')[0]
s, b = req('POST', f'/pauses/{past_id}/cancel', token=owner)
check('Past pause cannot be cancelled', s == 409 and b['error']['code'] == 'PAUSE_DATE_PAST', (s, b))
s, b = req('GET', '/students/me/pauses?view=past', token=stI)
check('Student past view shows it (not cancellable)', b['data'] and b['data'][0]['date'] == add(today, -1) and not b['data'][0]['canCancel'], b)

# Flow J — tenant isolation
sidB2, mB2, subB2 = student(ownerB, plan(ownerB, 'BLD', True, True))
s, b = pause_for(sidB2, tm, tm, ['lunch'], owner)
check('J Mess A create for Mess B student -> 404', s == 404, (s, b))
s, b = pause_for(sidB2, tm, tm, ['lunch'], ownerB)
pB = b['data']['created'][0]['id']
s, b = req('POST', f'/pauses/{pB}/cancel', token=owner)
check('J Mess A cancel Mess B pause -> 404', s == 404 and psql(f"select status from meal_pauses where id='{pB}'") == 'ACTIVE', (s, b))
s, b = req('GET', f'/pauses?from={tm}&to={tm}&pageSize=100', token=owner)
check('J Mess A list excludes Mess B', not any(x['id'] == pB for x in b['data']))
s, b = req('GET', f'/pauses?studentId={sidB2}', token=owner)
check('J filtering by Mess B student id -> empty', b['data'] == [])
s, b = req('POST', f'/students/me/pauses/{pB}/cancel', token=stI)
check('J student cannot cancel another student pause -> 404', s == 404 and b['error']['code'] == 'PAUSE_NOT_FOUND', (s, b))
s, b = req('GET', '/pauses', token=stI)
check('Student blocked from owner pause API', s == 403)
check('Unauthenticated blocked', req('GET', '/students/me/pauses')[0] == 401)
check('Malformed id -> 404', req('POST', '/pauses/abc/cancel', token=owner)[0] == 404)

# Flow K — concurrency
sidK, mK, subK = student(owner, LD)
d = add(today, 5)
with concurrent.futures.ThreadPoolExecutor(10) as ex:
    out = list(ex.map(lambda _: pause_for(sidK, d, d, ['lunch', 'dinner'])[1]['data'], range(10)))
check('K 10 identical requests -> 2 created in total, rest skipped', sum(len(o['created']) for o in out) == 2 and psql(f"select count(*) from meal_pauses where \"studentId\"='{sidK}' and status='ACTIVE'") == '2', [len(o['created']) for o in out])
pk = psql(f"select id from meal_pauses where \"studentId\"='{sidK}' and \"mealType\"='lunch'")
with concurrent.futures.ThreadPoolExecutor(6) as ex:
    codes = list(ex.map(lambda _: req('POST', f'/pauses/{pk}/cancel', token=owner)[0], range(6)))
check('K parallel cancels -> exactly one 200, rest 409', sorted(codes) == [200] + [409] * 5 and psql(f"select count(*) from meal_pauses where id='{pk}'") == '1', codes)

# Unlinked
other = otp_login(mob())
check('Unlinked: pause-settings linked:false', req('GET', '/students/me/pause-settings', token=other)[1]['data'] == {'linked': False})
s, b = req('POST', '/students/me/pauses', {'fromDate': tm, 'toDate': tm, 'mealTypes': ['lunch']}, other)
check('Unlinked: create -> STUDENT_NOT_LINKED', s == 404 and b['error']['code'] == 'STUDENT_NOT_LINKED', (s, b))

# Expected vs served consistency
e = expected(today)
check('Expected math consistent', all(m['expected'] == m['entitled'] - m['paused'] and m['remaining'] == max(0, m['expected'] - m['served']) for m in e.values()), e)
check('Mess B expected independent', req('GET', f'/attendance/expected?date={tm}', token=ownerB)[1]['data']['meals']['lunch']['paused'] >= 1)
cutoffs()
print(f"\n{sum(results)}/{len(results)} checks passed")
