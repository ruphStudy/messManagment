import json, subprocess, urllib.request, random, time
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
        if out[0] != 429 or not path.startswith(('/auth', '/staff')): return out
        time.sleep(61)
    return out
def check(name, cond, info=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {str(info)[:500]}'))
def login_full(i, pw='Password123'): return req('POST', '/auth/login', {'identifier': i, 'password': pw})
def login(i, pw='Password123'): return login_full(i, pw)[1]['data']['accessToken']
def otp(m):
    c = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    return req('POST', '/auth/otp/verify', {'mobile': m, 'code': c})[1]['data']['accessToken']
def psql(sql): return subprocess.run(['psql', '-tA', 'mess_management', '-c', sql], capture_output=True, text=True).stdout.strip()
def node(js): return subprocess.run(['node', '-e', f"const s=require('./packages/shared/dist');{js}"], capture_output=True, text=True).stdout.strip()
def mob(): return '7' + str(random.randint(100000000, 999999999))
def code(b): return (b or {}).get('error', {}).get('code')
SECRET = ('passwordHash', 'refreshTokenHash', 'codeHash', 'pushToken')
def safe(b): return not any(f'"{k}"' in json.dumps(b) for k in SECRET)
u = str(random.randint(10000, 99999))
today = node('console.log(s.businessToday())')
owner, ownerB, admin = login('9000000001'), login('9000000011'), login('9000000000')
MESS_A = psql("select id from messes where name='Annapurna Student Mess'"); MESS_B = psql("select id from messes where name='Sai Tiffin Service'")
OWNER_ID = psql("select id from users where mobile='9000000001'")

# ── A: owner adds staff ──
sm = mob()
s, b = req('POST', '/staff', {'firstName': 'Seva', 'lastName': f'K{u}', 'mobile': sm, 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, owner)
staff_id = b['data']['staff']['id'] if s == 201 else None
check('A owner adds staff (new account, temp password)', s == 201 and b['data']['reusedAccount'] is False and b['data']['staff']['role'] == 'MESS_STAFF' and b['data']['staff']['mustChangePassword'] is True and safe(b), b)
check('A one user + one membership created', psql(f"select count(*) from users where mobile='{sm}'") == '1' and psql(f"select role||'/'||status from mess_memberships where \"userId\"='{staff_id}'") == 'MESS_STAFF/ACTIVE')
check('A new account needs a temporary password', req('POST', '/staff', {'firstName': 'X', 'mobile': mob(), 'role': 'MESS_STAFF'}, owner)[0] == 400)
check('A weak temporary password rejected', req('POST', '/staff', {'firstName': 'X', 'mobile': mob(), 'role': 'MESS_STAFF', 'temporaryPassword': 'short'}, owner)[0] == 400)
s, b = login_full(sm, 'Temp1234x'); st1 = b['data']['accessToken']
check('A staff logs in: role MESS_STAFF, must change password', s == 200 and b['data']['role'] == 'MESS_STAFF' and b['data']['user']['mustChangePassword'] is True and b['data']['membership']['mess']['id'] == MESS_A, b)
check('A temporary password: business APIs wait for a password change (Sprint 14 API rule)', code(req('GET', '/students', token=st1)[1]) == 'PASSWORD_CHANGE_REQUIRED')
sid = psql(f"select id from mess_students where \"messId\"='{MESS_A}' and mobile='9100000001'")
blocked = {
    'GET /staff': req('GET', '/staff', token=st1)[0],
    'POST /staff': req('POST', '/staff', {'firstName': 'Y', 'mobile': mob(), 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, st1)[0],
    'PATCH /mess': req('PATCH', '/mess', {'name': 'Hacked'}, st1)[0],
    'PATCH /mess/settings': req('PATCH', '/mess/settings', {'lunchStart': '11:00'}, st1)[0],
    'POST /expenses': req('POST', '/expenses', {'title': 'x', 'amountPaise': 1, 'expenseDate': today, 'categoryId': sid}, st1)[0],
    'POST /payments': req('POST', '/payments', {'studentId': sid, 'subscriptionId': sid, 'amountPaise': 1, 'method': 'CASH'}, st1)[0],
    'GET /reports/payments': req('GET', '/reports/payments', token=st1)[0],
    f'PATCH /staff/owner': req('PATCH', f'/staff/{OWNER_ID}', {'firstName': 'X'}, st1)[0],
}
check('A staff blocked from team/settings/finance APIs (403)', set(blocked.values()) == {403}, blocked)

# ── Account: change password (+ revoke other sessions) ──
st2 = login(sm, 'Temp1234x')
s, b = req('POST', '/auth/change-password', {'currentPassword': 'wrongpass1', 'newPassword': 'Mine12345'}, st2)
check('Acct wrong current password -> PASSWORD_INCORRECT', s == 400 and code(b) == 'PASSWORD_INCORRECT')
check('Acct same password rejected', req('POST', '/auth/change-password', {'currentPassword': 'Temp1234x', 'newPassword': 'Temp1234x'}, st2)[0] == 400)
s, b = req('POST', '/auth/change-password', {'currentPassword': 'Temp1234x', 'newPassword': 'Mine12345'}, st2)
check('Acct password changed, flag cleared', s == 200 and b['data']['user']['mustChangePassword'] is False, b)
check('A staff operational access ok after password change', req('GET', '/students', token=st2)[0] == 200 and req('GET', '/attendance/summary', token=st2)[0] == 200 and req('GET', '/menus/' + today, token=st2)[0] == 200)
check('Acct other session revoked, current kept', req('GET', '/students', token=st1)[0] == 401 and req('GET', '/students', token=st2)[0] == 200)
check('Acct old password no longer works', login_full(sm, 'Temp1234x')[0] == 401 and login_full(sm, 'Mine12345')[0] == 200)
s, b = req('PATCH', '/auth/me', {'firstName': 'Sevak', 'email': f'sevak{u}@x.in'}, st2)
check('Acct update own name/email', s == 200 and b['data']['user']['firstName'] == 'Sevak' and b['data']['role'] == 'MESS_STAFF', b)
check('Acct email taken -> 409', req('PATCH', '/auth/me', {'email': 'owner@demo.mess'}, st2)[0] == 409)
check('Acct cannot change role/mobile via /auth/me', req('PATCH', '/auth/me', {'role': 'MESS_OWNER'}, st2)[0] == 400 and req('PATCH', '/auth/me', {'mobile': '9999999999'}, st2)[0] == 400)
stuA = otp('9100000001')
check('Acct student cannot use team account endpoint', req('PATCH', '/auth/me', {'firstName': 'Z'}, stuA)[0] == 403)

# ── B: owner adds manager; manager scope ──
mm = mob()
s, b = req('POST', '/staff', {'firstName': 'Mana', 'lastName': f'G{u}', 'mobile': mm, 'email': f'mana{u}@x.in', 'role': 'MESS_MANAGER', 'temporaryPassword': 'Temp1234x'}, owner)
mgr_id = b['data']['staff']['id']
check('B owner adds manager', s == 201 and b['data']['staff']['role'] == 'MESS_MANAGER')
mgr = login(mm, 'Temp1234x')
req('POST', '/auth/change-password', {'currentPassword': 'Temp1234x', 'newPassword': 'MgrOwn1234'}, mgr)
check('B manager sees team + can manage staff actions', req('GET', '/staff', token=mgr)[0] == 200 and req('GET', f'/staff/{staff_id}', token=mgr)[1]['data']['actions']['edit'] is True)
check('B manager: actions on owner/other manager are false', req('GET', f'/staff/{OWNER_ID}', token=mgr)[1]['data']['actions'] == {'edit': False, 'changeRole': False, 'setStatus': False, 'resetPassword': False})
s, b = req('POST', '/staff', {'firstName': 'M2', 'mobile': mob(), 'role': 'MESS_MANAGER', 'temporaryPassword': 'Temp1234x'}, mgr)
check('H manager cannot create a manager', s == 403 and code(b) == 'STAFF_ROLE_INVALID', b)
s, b = req('POST', '/staff', {'firstName': 'S2', 'mobile': mob(), 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, mgr)
staff2_id = b['data']['staff']['id'] if s == 201 else None
check('B manager can add staff', s == 201)
check('H manager cannot promote staff to manager', code(req('PATCH', f'/staff/{staff2_id}', {'role': 'MESS_MANAGER'}, mgr)[1]) == 'STAFF_ROLE_INVALID' and psql(f"select role from mess_memberships where \"userId\"='{staff2_id}'") == 'MESS_STAFF')
check('H manager cannot edit owner', code(req('PATCH', f'/staff/{OWNER_ID}', {'firstName': 'X'}, mgr)[1]) == 'STAFF_CANNOT_MODIFY_OWNER' and code(req('POST', f'/staff/{OWNER_ID}/status', {'status': 'INACTIVE'}, mgr)[1]) == 'STAFF_CANNOT_MODIFY_OWNER')
check('H manager cannot deactivate/reset self', code(req('POST', f'/staff/{mgr_id}/status', {'status': 'INACTIVE'}, mgr)[1]) == 'STAFF_CANNOT_MODIFY_SELF' and code(req('POST', f'/staff/{mgr_id}/reset-password', {'temporaryPassword': 'Temp9999x'}, mgr)[1]) == 'STAFF_CANNOT_MODIFY_SELF')
mm2 = mob(); m2 = req('POST', '/staff', {'firstName': 'Mgr2', 'mobile': mm2, 'role': 'MESS_MANAGER', 'temporaryPassword': 'Temp1234x'}, owner)[1]['data']['staff']['id']
check('H manager cannot touch another manager', req('PATCH', f'/staff/{m2}', {'firstName': 'X'}, mgr)[0] == 403 and req('POST', f'/staff/{m2}/reset-password', {'temporaryPassword': 'Temp9999x'}, mgr)[0] == 403)
for r in ('PLATFORM_ADMIN', 'MESS_OWNER', 'STUDENT', 'ROOT'):
    check(f'H payload role {r} rejected on create', req('POST', '/staff', {'firstName': 'R', 'mobile': mob(), 'role': r, 'temporaryPassword': 'Temp1234x'}, owner)[0] == 400)
check('H PATCH role MESS_OWNER / PLATFORM_ADMIN rejected', req('PATCH', f'/staff/{staff_id}', {'role': 'MESS_OWNER'}, owner)[0] == 400 and req('PATCH', f'/staff/{staff_id}', {'role': 'PLATFORM_ADMIN'}, owner)[0] == 400)
check('H owner cannot modify self/ownership', code(req('POST', f'/staff/{OWNER_ID}/status', {'status': 'INACTIVE'}, owner)[1]) == 'STAFF_CANNOT_MODIFY_OWNER' and code(req('PATCH', f'/staff/{OWNER_ID}', {'role': 'MESS_STAFF'}, owner)[1]) == 'STAFF_CANNOT_MODIFY_OWNER' and psql(f"select role||'/'||status from mess_memberships where \"userId\"='{OWNER_ID}' and \"messId\"='{MESS_A}'") == 'MESS_OWNER/ACTIVE')
check('H mess always has exactly one active owner', psql(f"select count(*) from mess_memberships where \"messId\"='{MESS_A}' and role='MESS_OWNER' and status='ACTIVE'") == '1')
check('B manager: settings yes, profile no', req('PATCH', '/mess/settings', {'dinnerEnd': '21:30'}, mgr)[0] == 200 and req('PATCH', '/mess', {'name': 'X'}, mgr)[0] == 403 and req('PATCH', '/mess/settings', {'name': 'X'}, mgr)[0] == 400)

# ── C: role change ──
s, b = req('PATCH', f'/staff/{staff_id}', {'role': 'MESS_MANAGER', 'firstName': 'Promo'}, owner)
check('C owner promotes staff -> manager', s == 200 and b['data']['role'] == 'MESS_MANAGER' and psql(f"select role from users where id='{staff_id}'") == 'MESS_MANAGER')
check('C permissions update on existing session', req('GET', '/staff', token=st2)[0] == 200 and req('GET', '/auth/me', token=st2)[1]['data']['role'] == 'MESS_MANAGER')
req('PATCH', f'/staff/{staff_id}', {'role': 'MESS_STAFF'}, owner)
check('C demote back -> staff blocked again', req('GET', '/staff', token=st2)[0] == 403)

# ── D: deactivate / reactivate ──
s, b = req('POST', f'/staff/{staff_id}/status', {'status': 'INACTIVE'}, owner)
check('D deactivated', s == 200 and b['data']['status'] == 'INACTIVE')
check('D existing session revoked', req('GET', '/students', token=st2)[0] == 401)
s, b = login_full(sm, 'Mine12345')
check('D login blocked', s == 403 and code(b) == 'ACCOUNT_DISABLED', b)
check('D history kept (user + membership rows)', psql(f"select count(*) from mess_memberships where \"userId\"='{staff_id}' and status='REMOVED'") == '1' and psql(f"select count(*) from users where id='{staff_id}'") == '1')
check('D deactivate twice -> 409', req('POST', f'/staff/{staff_id}/status', {'status': 'INACTIVE'}, owner)[0] == 409)
check('D list status filter', any(x['id'] == staff_id for x in req('GET', '/staff?status=INACTIVE&pageSize=100', token=owner)[1]['data']) and all(x['status'] == 'ACTIVE' for x in req('GET', '/staff?status=ACTIVE&pageSize=100', token=owner)[1]['data']))
check('Dup re-adding a deactivated member -> 409 (reactivate instead)', code(req('POST', '/staff', {'firstName': 'Again', 'mobile': sm, 'role': 'MESS_STAFF'}, owner)[1]) == 'STAFF_ALREADY_EXISTS' and psql(f"select count(*) from mess_memberships where \"userId\"='{staff_id}'") == '1')
s, b = req('POST', f'/staff/{staff_id}/status', {'status': 'ACTIVE'}, owner)
check('D reactivated, login works with same password', s == 200 and login_full(sm, 'Mine12345')[0] == 200)

# ── E: owner resets password ──
st3 = login(sm, 'Mine12345')
s, b = req('POST', f'/staff/{staff_id}/reset-password', {'temporaryPassword': 'Reset7777y'}, owner)
check('E reset ok, safe response, must change', s == 200 and b['data']['mustChangePassword'] is True and safe(b), b)
check('E sessions revoked + old password dead', req('GET', '/students', token=st3)[0] == 401 and login_full(sm, 'Mine12345')[0] == 401)
s, b = login_full(sm, 'Reset7777y')
check('E new temporary password works', s == 200 and b['data']['user']['mustChangePassword'] is True)
check('E weak reset password rejected', req('POST', f'/staff/{staff_id}/reset-password', {'temporaryPassword': 'abc'}, owner)[0] == 400)

# ── Duplicates / reuse ──
check('Dup active member -> 409', code(req('POST', '/staff', {'firstName': 'D', 'mobile': mm, 'role': 'MESS_STAFF'}, owner)[1]) == 'STAFF_ALREADY_EXISTS')
check('Dup student account -> 409', req('POST', '/staff', {'firstName': 'D', 'mobile': '9100000001', 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, owner)[0] == 409)
check('Dup other mess owner / platform admin -> 409', req('POST', '/staff', {'firstName': 'D', 'mobile': '9000000011', 'role': 'MESS_STAFF'}, owner)[0] == 409 and req('POST', '/staff', {'firstName': 'D', 'mobile': '9000000000', 'role': 'MESS_STAFF'}, owner)[0] == 409)
check('Dup email of another account -> 409', req('POST', '/staff', {'firstName': 'D', 'mobile': mob(), 'email': 'owner@other.mess', 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, owner)[0] == 409)
xm = mob()
xb = req('POST', '/staff', {'firstName': 'Cross', 'mobile': xm, 'role': 'MESS_STAFF', 'temporaryPassword': 'CrossPw123'}, ownerB)[1]['data']['staff']['id']
check('Reuse: staff active in Mess B cannot be added to Mess A', code(req('POST', '/staff', {'firstName': 'Cross', 'mobile': xm, 'role': 'MESS_STAFF'}, owner)[1]) == 'STAFF_ALREADY_EXISTS')
req('POST', f'/staff/{xb}/status', {'status': 'INACTIVE'}, ownerB)
s, b = req('POST', '/staff', {'firstName': 'Ignored', 'mobile': xm, 'role': 'MESS_MANAGER', 'temporaryPassword': 'NotUsed123'}, owner)
check('Reuse: ex-Mess-B staff linked to Mess A (no duplicate user)', s == 201 and b['data']['reusedAccount'] is True and b['data']['staff']['id'] == xb and psql(f"select count(*) from users where mobile='{xm}'") == '1', b)
s, b = login_full(xm, 'CrossPw123')
check('Reuse: keeps own password, lands in Mess A as manager', s == 200 and b['data']['membership']['mess']['id'] == MESS_A and b['data']['role'] == 'MESS_MANAGER', b)
check('Reuse: Mess B membership untouched (still inactive history)', psql(f"select role||'/'||status from mess_memberships where \"userId\"='{xb}' and \"messId\"='{MESS_B}'") == 'MESS_STAFF/REMOVED')
check('Reuse: cannot reactivate in B while active in A', req('POST', f'/staff/{xb}/status', {'status': 'ACTIVE'}, ownerB)[0] == 409)

# ── I: tenant isolation ──
mB = mob(); bstaff = req('POST', '/staff', {'firstName': 'Bonly', 'mobile': mB, 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, ownerB)[1]['data']['staff']['id']
ownerB_id = psql("select id from users where mobile='9000000011'")
check('I owner A cannot see Mess B member', req('GET', f'/staff/{bstaff}', token=owner)[0] == 404 and all(x['id'] != bstaff for x in req('GET', '/staff?pageSize=100', token=owner)[1]['data']))
check('I owner A cannot edit/deactivate/reset Mess B member', [req('PATCH', f'/staff/{bstaff}', {'firstName': 'X'}, owner)[0], req('POST', f'/staff/{bstaff}/status', {'status': 'INACTIVE'}, owner)[0], req('POST', f'/staff/{bstaff}/reset-password', {'temporaryPassword': 'Temp9999x'}, owner)[0]] == [404, 404, 404])
check('I manager A cannot target Mess B owner/staff', req('GET', f'/staff/{ownerB_id}', token=mgr)[0] == 404 and req('PATCH', f'/staff/{bstaff}', {'role': 'MESS_STAFF'}, mgr)[0] == 404)
check('I Mess B member unchanged', psql(f"select \"firstName\"||'/'||status from users where id='{bstaff}'") == 'Bonly/ACTIVE' and login_full(mB, 'Temp1234x')[0] == 200)
check('I malformed / unknown ids -> 404', req('GET', '/staff/abc', token=owner)[0] == 404 and req('GET', '/staff/00000000-0000-4000-8000-000000000000', token=owner)[0] == 404)
STU_UID = psql("select id from users where mobile='9100000001'")
check('I student id (non-team) not reachable', req('GET', f'/staff/{STU_UID}', token=owner)[0] == 404)

# ── F: settings ──
times = {'breakfastStart': '07:30', 'breakfastEnd': '09:30', 'lunchStart': '12:00', 'lunchEnd': '14:30', 'dinnerStart': '19:30', 'dinnerEnd': '21:30'}
s, b = req('PATCH', '/mess/settings', {**times, 'breakfastAvailable': True}, owner)
check('F serving times saved', s == 200 and all(b['data'][k] == v for k, v in times.items()), b)
s, b = req('PATCH', '/mess/settings', {'lunchStart': '15:00', 'lunchEnd': '14:00'}, owner)
check('F start >= end rejected (field error)', s == 400 and 'lunchEnd' in (b['error'].get('fields') or {}), b)
check('F bad HH:mm rejected', req('PATCH', '/mess/settings', {'dinnerStart': '25:00'}, owner)[0] == 400 and req('PATCH', '/mess/settings', {'dinnerStart': '7pm'}, owner)[0] == 400)
check('F DB check constraint enforces order', 'violates check constraint' in subprocess.run(['psql', 'mess_management', '-c', f"update messes set \"lunchEnd\"='11:00' where id='{MESS_A}'"], capture_output=True, text=True).stderr)
check('F meal availability via settings', req('PATCH', '/mess/settings', {'breakfastAvailable': False}, owner)[1]['data']['breakfastAvailable'] is False and req('PATCH', '/mess/settings', {'breakfastAvailable': True}, owner)[1]['data']['breakfastAvailable'] is True)
check('F at least one meal still required', req('PATCH', '/mess/settings', {'breakfastAvailable': False, 'lunchAvailable': False, 'dinnerAvailable': False}, owner)[0] == 400)
check('F owner profile PATCH still works', req('PATCH', '/mess', {'address': '12, Near College Road'}, owner)[0] == 200)
# Pause cut-off is the single source for eligibility.
req('PATCH', '/mess/settings', {'lunchPauseCutoff': '00:00'}, owner)
s, b = req('POST', '/students/me/pauses', {'fromDate': today, 'toDate': today, 'mealTypes': ['lunch']}, stuA)
outcome = json.dumps(b)
check('F lunch cut-off 00:00 -> today lunch pause refused', 'PAUSE_CUTOFF_PASSED' in outcome, b)
req('PATCH', '/mess/settings', {'lunchPauseCutoff': '23:59'}, owner)
s, b = req('POST', '/students/me/pauses', {'fromDate': today, 'toDate': today, 'mealTypes': ['lunch']}, stuA)
outcome = json.dumps(b)
now = node('console.log(s.businessNowTime())')
check('F cut-off moved to 23:59 -> no longer cut off', 'PAUSE_CUTOFF_PASSED' not in outcome or now >= '23:59', b)
for p in (b.get('data', {}).get('results') or b.get('data', {}).get('created') or []):
    if isinstance(p, dict) and p.get('pauseId'): req('POST', f"/students/me/pauses/{p['pauseId']}/cancel", {}, stuA)
psql(f"update meal_pauses set status='CANCELLED', \"cancelledAt\"=now(), \"activeMarker\"=null where \"messId\"='{MESS_A}' and \"pauseDate\"='{today}' and \"mealType\"='lunch' and status='ACTIVE' and \"studentId\"=(select id from mess_students where \"messId\"='{MESS_A}' and mobile='9100000001')")
req('PATCH', '/mess/settings', {'lunchPauseCutoff': '09:00'}, owner)
check('F one cut-off source (mess column only)', psql("select count(*) from information_schema.columns where column_name ilike '%cutoff%'") == '3')

# ── G: timing used by student Home + scanner rule ──
s, b = req('GET', '/students/me/menu/today', token=stuA)
check('G student menu returns configured serving times', s == 200 and b['data']['servingTimes'] == times, b.get('data', {}).get('servingTimes'))
T = json.dumps(times); ALL = '["breakfast","lunch","dinner"]'
cases = node(f"""const t={T};const a={ALL};const f=(n,sv=a)=>JSON.stringify(s.mealAtTime(t,sv,n));
console.log(JSON.stringify([f('07:00'),f('08:00'),f('09:30'),f('10:00'),f('13:00'),f('15:00'),f('20:00'),f('22:00'),f('08:00',['lunch','dinner']),JSON.stringify(s.remainingMeals(t,a,'13:00')),JSON.stringify(s.remainingMeals(t,a,'22:00'))]))""")
got = json.loads(cases)
expect = ['{"meal":"breakfast","state":"NEXT"}', '{"meal":"breakfast","state":"CURRENT"}', '{"meal":"lunch","state":"NEXT"}', '{"meal":"lunch","state":"NEXT"}', '{"meal":"lunch","state":"CURRENT"}', '{"meal":"dinner","state":"NEXT"}', '{"meal":"dinner","state":"CURRENT"}', 'null', '{"meal":"lunch","state":"NEXT"}', '["lunch","dinner"]', '[]']
check('G mealAtTime/remainingMeals follow configured windows (07:30-09:30/12:00-14:30/19:30-21:30)', got == expect, list(zip(got, expect)))
check('G IST clock helper (mobile) == Intl business time', node('console.log(s.istClockTime()===s.businessNowTime().slice(0,5))') == 'true')
grep = subprocess.run("grep -rn 'getHours()' ./apps/web/src ./apps/mobile/src", shell=True, capture_output=True, text=True).stdout
check('G no hardcoded clock boundaries left in web/mobile', grep.strip() == '', grep)

# ── Suspension interaction ──
req('POST', f'/admin/messes/{MESS_A}/suspend', {'reason': f'S13 test {u}'}, admin)
check('S suspended: team page readable', req('GET', '/staff', token=owner)[0] == 200 and req('GET', '/mess', token=owner)[0] == 200)
check('S suspended: staff + settings mutations blocked', code(req('POST', '/staff', {'firstName': 'Z', 'mobile': mob(), 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, owner)[1]) == 'MESS_SUSPENDED' and code(req('PATCH', '/mess/settings', {'lunchStart': '12:00'}, owner)[1]) == 'MESS_SUSPENDED' and code(req('POST', f'/staff/{staff2_id}/status', {'status': 'INACTIVE'}, owner)[1]) == 'MESS_SUSPENDED' and code(req('POST', f'/staff/{staff2_id}/reset-password', {'temporaryPassword': 'Temp9999x'}, owner)[1]) == 'MESS_SUSPENDED')
req('POST', f'/admin/messes/{MESS_A}/reactivate', {}, admin)
check('S reactivated: mutations work again', req('PATCH', '/mess/settings', {'lunchStart': '12:00'}, owner)[0] == 200 and req('PATCH', f'/staff/{staff2_id}', {'firstName': 'Back'}, owner)[0] == 200)

# ── Forgot password (team, OTP) ──
fm = mob(); fid = req('POST', '/staff', {'firstName': 'Forgot', 'mobile': fm, 'role': 'MESS_STAFF', 'temporaryPassword': 'Temp1234x'}, owner)[1]['data']['staff']['id']
ftok = login(fm, 'Temp1234x')
s, b = req('POST', '/auth/password-reset/request', {'mobile': fm})
dev = b['data'].get('devOtp')
check('FP request issues OTP for team account', s == 200 and dev)
s2, b2 = req('POST', '/auth/password-reset/request', {'mobile': mob()})
s3, b3 = req('POST', '/auth/password-reset/request', {'mobile': '9100000002'})
check('FP unknown/student numbers: same response, no code', s2 == 200 and 'devOtp' not in b2['data'] and s3 == 200 and 'devOtp' not in b3['data'] and set(b2['data']) == {'expiresIn', 'resendIn'})
check('FP wrong code rejected', req('POST', '/auth/password-reset/confirm', {'mobile': fm, 'code': '000000' if dev != '000000' else '111111', 'newPassword': 'NewPass123'})[0] == 400)
s, b = req('POST', '/auth/password-reset/confirm', {'mobile': fm, 'code': dev, 'newPassword': 'NewPass123'})
check('FP confirm resets password + signs out', s == 204 and req('GET', '/students', token=ftok)[0] == 401 and login_full(fm, 'Temp1234x')[0] == 401 and login_full(fm, 'NewPass123')[0] == 200)
check('FP student cannot reset via team flow', req('POST', '/auth/password-reset/confirm', {'mobile': '9100000002', 'code': '123456', 'newPassword': 'NewPass123'})[0] == 400)

# ── Permission matrix / nav source ──
matrix = node("""const r=['MESS_OWNER','MESS_MANAGER','MESS_STAFF'];const p=['STAFF_VIEW','STAFF_MANAGE','MESS_UPDATE','MESS_SETTINGS_UPDATE','EXPENSE_VIEW','FINANCE_VIEW','ATTENDANCE_MARK','STUDENT_VIEW','COMPLAINT_VIEW','PAYMENT_RECORD'];
console.log(JSON.stringify(Object.fromEntries(r.map(x=>[x,p.map(q=>s.can(x,s.Permission[q])?1:0).join('')]))))""")
check('P permission matrix (staff: no team/settings/finance)', json.loads(matrix) == {'MESS_OWNER': '1111111111', 'MESS_MANAGER': '1101111111', 'MESS_STAFF': '0000001110'}, matrix)
check('P owner keeps every module permission', node("console.log(Object.values(s.Permission).filter(p=>!['platform:admin','student:self'].includes(p)).every(p=>s.can('MESS_OWNER',p)))") == 'true')
check('P no secrets in staff list', safe(req('GET', '/staff?pageSize=100', token=owner)[1]))

print(f"\n{sum(results)}/{len(results)} checks passed")
