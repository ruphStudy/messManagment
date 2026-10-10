"""Signup intents & account rules: only Owner (new mess) and Student (verified mobile) self-register; managers/staff
are created by their mess; platform admin is internal; existing accounts are reused, never duplicated or re-roled;
the device never decides access."""
import json, os, random, subprocess, time, urllib.request
import os as _os
B = _os.environ.get('MESS_TEST_BASE', 'http://localhost:4100/api/v1')
results = []
def _req(method, path, body=None, token=None, client=None):
    headers = {}
    data = json.dumps(body).encode() if body is not None else None
    if data is not None: headers['Content-Type'] = 'application/json'
    if token: headers['Authorization'] = f'Bearer {token}'
    if client: headers['x-client-type'] = client
    r = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            t = res.read().decode(); return res.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode() or 'null'
        try: return e.code, json.loads(t)
        except ValueError: return e.code, None
def req(*a, **k):
    for _ in range(4):
        out = _req(*a, **k)
        if out[0] != 429: return out
        time.sleep(61)
    return out
def check(name, cond, info=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {str(info)[:400]}'))
def code(b): return (b or {}).get('error', {}).get('code')
def psql(sql): return subprocess.run(['psql', '-tA', os.environ.get('MESS_TEST_DB', 'mess_management'), '-c', sql], capture_output=True, text=True).stdout.strip()
def mob(): return '7' + str(random.randint(100000000, 999999999))
def otp(m, path='/auth/otp/verify', client=None):
    s, b = req('POST', '/auth/otp/request', {'mobile': m}, client=client)
    if s != 200: return s, b
    return req('POST', path, {'mobile': m, 'code': b['data']['devOtp']}, client=client)
def login(i, pw='Password123', client=None): return req('POST', '/auth/login', {'identifier': i, 'password': pw}, client=client)
today = subprocess.run(['node', '-e', "console.log(require('./packages/shared/dist').businessToday())"], capture_output=True, text=True).stdout.strip()
u = str(random.randint(10000, 99999))
owner = login('9000000001')[1]['data']['accessToken']
MESS_B = psql("select id from messes where name='Sai Tiffin Service'")
OWNER_B = psql("select \"ownerId\" from messes where name='Sai Tiffin Service'")
owner_body = lambda m, e: {'firstName': 'New', 'lastName': f'Owner{u}', 'mobile': m, 'email': e, 'password': 'Owner1234'}

# ── A: Owner signup → only a NEW mess ──
om, oe = mob(), f'own{u}@x.in'
s, b = req('POST', '/auth/register/owner', owner_body(om, oe))
check('A owner signup creates MESS_OWNER account with no mess yet', s == 201 and b['data']['user']['role'] == 'MESS_OWNER' and psql(f"select count(*) from mess_memberships m join users u on u.id=m.\"userId\" where u.mobile='{om}'") == '0', b)
check('A legacy /auth/register still works', req('POST', '/auth/register', owner_body(mob(), f'leg{u}@x.in'))[0] == 201)
for extra in ({'role': 'MESS_MANAGER'}, {'role': 'MESS_STAFF'}, {'role': 'PLATFORM_ADMIN'}, {'role': 'MESS_OWNER', 'messId': MESS_B}, {'signupIntent': 'OWNER', 'messId': MESS_B}):
    m = mob()
    s, b = req('POST', '/auth/register/owner', {**owner_body(m, f'x{m}@x.in'), **extra})
    check(f'A attack {extra} rejected, nothing created', s == 400 and psql(f"select count(*) from users where mobile='{m}'") == '0', (s, b))
for extra in ({'role': 'MESS_MANAGER'}, {'role': 'PLATFORM_ADMIN'}, {'messId': MESS_B}):
    m = mob(); c = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    s, b = req('POST', '/auth/register/student', {'mobile': m, 'code': c, **extra})
    check(f'A student signup with {extra} rejected', s == 400 and psql(f"select count(*) from users where mobile='{m}'") == '0', (s, b))
check('A no public route creates managers/staff/admins', all(req('POST', p, {'firstName': 'X', 'mobile': mob(), 'role': 'MESS_MANAGER'})[0] in (401, 404) for p in ('/auth/register/manager', '/auth/register/staff', '/auth/register/admin', '/staff')))
s, b = login(om, 'Owner1234'); ot = b['data']['accessToken']
check('A new owner lands without membership (→ onboarding)', s == 200 and b['data']['membership'] is None and b['data']['role'] == 'MESS_OWNER' and b['data'].get('student') is None, b['data'])
check('A cannot use /mess with someone else\'s mess id', req('POST', '/mess', {'id': MESS_B, 'name': 'Steal'}, ot)[0] == 400 and psql(f"select \"ownerId\" from messes where id='{MESS_B}'") == OWNER_B)
check('A new owner has no access to existing messes', req('GET', '/students', token=ot)[0] == 403 and req('GET', f'/admin/messes/{MESS_B}', token=ot)[0] == 403)
mess = {'name': f'New Mess {u}', 'mobile': om, 'email': None, 'messType': 'STUDENT_MESS', 'foodType': 'VEG', 'address': '1 Road', 'city': 'Pune', 'state': 'Maharashtra', 'pincode': '411001', 'breakfastAvailable': False, 'lunchAvailable': True, 'dinnerAvailable': True, 'openingTime': None, 'closingTime': None}
s, b = req('POST', '/mess', mess, ot)
new_mess = b['data']['id'] if s == 201 else None
me = req('GET', '/auth/me', token=ot)[1]['data']
check('A onboarding creates OWN new mess + MESS_OWNER membership', s == 201 and me['membership']['role'] == 'MESS_OWNER' and me['membership']['mess']['id'] == new_mess != MESS_B, (s, me))
check('A second mess / duplicate setup refused', code(req('POST', '/mess', {**mess, 'name': 'Second'}, ot)[1]) == 'MESS_ALREADY_EXISTS')
check('A new owner sees only own mess (tenant isolation)', req('GET', '/students?pageSize=100', token=ot)[1]['meta']['total'] == 0 and req('GET', f"/students/{psql(f'select id from mess_students where \"messId\"=' + chr(39) + MESS_B + chr(39) + ' limit 1')}", token=ot)[0] == 404)
s, b = req('POST', '/auth/register/owner', owner_body(om, f'other{u}@x.in'))
check('A duplicate owner signup (same mobile) -> ACCOUNT_EXISTS, sign in', s == 409 and code(b) == 'ACCOUNT_EXISTS' and 'sign in' in b['error']['message'].lower() and psql(f"select count(*) from users where mobile='{om}'") == '1')
s, b = req('POST', '/auth/register/owner', owner_body(mob(), oe))
check('A duplicate owner signup (same email) -> ACCOUNT_EXISTS', s == 409 and code(b) == 'ACCOUNT_EXISTS')

# ── B: Student signup with an existing mess record ──
sm = mob()
sid = req('POST', '/students', {'firstName': 'Pre', 'lastName': u, 'mobile': sm, 'joiningDate': today}, owner)[1]['data']['id']
s, b = otp(sm, '/auth/register/student')
check('B student signup links to the existing record', s == 200 and b['data']['role'] == 'STUDENT' and b['data']['student']['linked'] is True and b['data']['student']['mess']['name'] == 'Annapurna Student Mess', b.get('data'))
check('B exactly one user, record linked', psql(f"select count(*) from users where mobile='{sm}'") == '1' and psql(f"select \"userId\" is not null from mess_students where id='{sid}'") == 't')
st = b['data']['accessToken']
check('B student permissions only', req('GET', '/students/me', token=st)[0] == 200 and req('GET', '/students', token=st)[0] == 403 and req('GET', '/staff', token=st)[0] == 403)
s, b = otp(sm, '/auth/register/student')
check('B signing up again = sign in (same account)', s == 200 and b['data']['user']['id'] == psql(f"select id from users where mobile='{sm}'") and psql(f"select count(*) from users where mobile='{sm}'") == '1')

# ── C: Student signs up before the mess adds them ──
cm = mob()
s, b = otp(cm, '/auth/register/student')
ct = b['data']['accessToken'] if s == 200 else None
check('C signup succeeds unlinked', s == 200 and b['data']['student'] == {'linked': False, 'mess': None}, b.get('data'))
check('C /auth/me shows waiting state; no QR', req('GET', '/auth/me', token=ct)[1]['data']['student']['linked'] is False and req('GET', '/students/me/meal-qr', token=ct)[1]['data']['state'] == 'NOT_LINKED')
req('POST', '/students', {'firstName': 'Later', 'mobile': cm, 'joiningDate': today}, owner)
me = req('GET', '/auth/me', token=ct)[1]['data']
check('C owner adds same mobile -> link resolves on refresh, no duplicate user', me['student']['linked'] is True and psql(f"select count(*) from users where mobile='{cm}'") == '1', me)

# ── Normalized mobile: equivalent inputs = one identity ──
nm = mob()
ids = set()
for variant in (nm, f'+91 {nm}', f'91{nm}', f'0{nm}'):
    s, b = otp(variant)
    ids.add(b['data']['user']['id'] if s == 200 else f'err{s}')
check('N 9876543210 / +91 / 91 / 0 prefixes resolve to one account', len(ids) == 1 and psql(f"select count(*) from users where mobile like '%{nm}'") == '1', ids)

# ── D/E: Manager & Staff are created by the mess and simply sign in ──
for role in ('MESS_MANAGER', 'MESS_STAFF'):
    m = mob()
    tid = req('POST', '/staff', {'firstName': role, 'mobile': m, 'role': role, 'temporaryPassword': 'Temp1234x'}, owner)[1]['data']['staff']['id']
    s, b = login(m, 'Temp1234x')
    check(f'{role}: created by owner, signs in (temp password restriction intact)', s == 200 and b['data']['role'] == role and b['data']['user']['mustChangePassword'] is True and code(req('GET', '/students', token=b['data']['accessToken'])[1]) == 'PASSWORD_CHANGE_REQUIRED')
    s1, b1 = req('POST', '/auth/register/owner', owner_body(m, f'{role.lower()}{u}@x.in'))
    s2, b2 = req('POST', '/auth/otp/request', {'mobile': m})
    check(f'{role}: owner/student signup with same mobile blocked -> sign in', code(b1) == 'ACCOUNT_EXISTS' and code(b2) == 'PASSWORD_SIGN_IN_REQUIRED')
    check(f'{role}: no duplicate user, role/membership/flag untouched', psql(f"select count(*) from users where mobile='{m}'") == '1' and psql(f"select role||'/'||\"mustChangePassword\" from users where id='{tid}'") == f'{role}/true' and psql(f"select role||'/'||status from mess_memberships where \"userId\"='{tid}'") == f'{role}/ACTIVE')
    check(f'{role}: error does not reveal role or mess', all(w not in json.dumps([b1, b2]) for w in ('MANAGER', 'STAFF', 'Annapurna', 'Manager', 'Staff')), [b1, b2])

# ── F: Platform admin is internal only ──
s, b = req('POST', '/auth/register/owner', owner_body('9000000000', f'adm{u}@x.in'))
check('F admin mobile cannot be re-registered / re-roled', code(b) == 'ACCOUNT_EXISTS' and psql("select role from users where mobile='9000000000'") == 'PLATFORM_ADMIN')
check('F admin cannot be created publicly (role field rejected)', req('POST', '/auth/register/owner', {**owner_body(mob(), f'a{u}@x.in'), 'role': 'PLATFORM_ADMIN'})[0] == 400 and psql("select count(*) from users where role='PLATFORM_ADMIN'") == '1')
check('F admin OTP path refused (password account)', code(req('POST', '/auth/otp/request', {'mobile': '9000000000'})[1]) == 'PASSWORD_SIGN_IN_REQUIRED')

# ── G: Platform independence (client header never changes role/access) ──
pairs = {}
for ident in ('9000000001', '9000000002', '9000000003', '9000000000'):
    web = login(ident)[1]['data']; mobi = login(ident, client='MOBILE')[1]['data']
    pairs[ident] = (web['role'], mobi['role'], 'refreshToken' in mobi)
check('G team/admin password sign-in works from web and mobile clients, same role', all(w == m and r for w, m, r in pairs.values()), pairs)
s_web, b_web = otp('9100000002')
s_mob, b_mob = otp('9100000002', client='MOBILE')
check('G student OTP works from web and mobile clients, same role', s_web == 200 and s_mob == 200 and b_web['data']['role'] == b_mob['data']['role'] == 'STUDENT' and 'refreshToken' in b_mob['data'])
check('G web-signed-in student reaches own data', req('GET', '/students/me/payments', token=b_web['data']['accessToken'])[0] == 200)
mgr_mobile = login('9000000002', client='MOBILE')[1]['data']['accessToken']
check('G manager on a mobile client keeps manager permissions', req('GET', '/staff', token=mgr_mobile)[0] == 200 and req('PATCH', '/mess', {'name': ''}, mgr_mobile)[0] == 403)
check('G student password sign-in -> OTP_SIGN_IN_REQUIRED or invalid (never a device message)', code(login('9100000002', 'whatever')[1]) in ('INVALID_CREDENTIALS', 'OTP_SIGN_IN_REQUIRED'))

# ── Disabled / suspended can't bypass by signing up again ──
dm = mob(); otp(dm)
duid = psql(f"select id from users where mobile='{dm}'")
admin = login('9000000000')[1]['data']['accessToken']
req('POST', f'/admin/users/{duid}/suspend', {'reason': 'signup bypass test'}, admin)
s1, b1 = otp(dm, '/auth/register/student')
s2, b2 = req('POST', '/auth/register/owner', owner_body(dm, f'dis{u}@x.in'))
check('X disabled account: student signup refused, owner signup refused, still one user', code(b1) == 'ACCOUNT_DISABLED' and code(b2) == 'ACCOUNT_EXISTS' and psql(f"select count(*)||'/'||max(status::text) from users where mobile='{dm}'") == '1/DISABLED', (b1, b2))
req('POST', f'/admin/users/{duid}/reactivate', {}, admin)

# ── H: existing seeded accounts still sign in with correct context ──
seeded = {i: login(i)[1]['data'] for i in ('9000000000', '9000000001', '9000000002', '9000000003', '9000000011')}
check('H seeded password accounts sign in with expected roles', {i: d['role'] for i, d in seeded.items()} == {'9000000000': 'PLATFORM_ADMIN', '9000000001': 'MESS_OWNER', '9000000002': 'MESS_MANAGER', '9000000003': 'MESS_STAFF', '9000000011': 'MESS_OWNER'})
s, b = otp('9100000001')
check('H seeded student signs in linked, /auth/me exposes safe context', s == 200 and b['data']['student']['linked'] is True and set(req('GET', '/auth/me', token=b['data']['accessToken'])[1]['data']) == {'user', 'membership', 'role', 'student'} and 'passwordHash' not in json.dumps(b))
check('H /auth/me user has status + mustChangePassword', {'status', 'mustChangePassword'} <= set(seeded['9000000003']['user']))

print(f"\n{sum(results)}/{len(results)} checks passed")
