import json, re, subprocess, urllib.request, uuid
import os as _os
B = _os.environ.get('MESS_TEST_BASE', 'http://localhost:4100/api/v1')
results = []

def req(method, path, body=None, token=None, mobile=False, raw=None, ctype=None):
    headers = {}
    data = None
    if body is not None:
        data = json.dumps(body).encode(); headers['Content-Type'] = 'application/json'
    if raw is not None:
        data = raw; headers['Content-Type'] = ctype
    if token: headers['Authorization'] = f'Bearer {token}'
    if mobile: headers['x-client-type'] = 'MOBILE'
    r = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r) as res:
            txt = res.read().decode(); return res.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or 'null')

def check(name, cond, info=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {info}'))

def login(identifier):
    s, b = req('POST', '/auth/login', {'identifier': identifier, 'password': 'Password123'})
    return b['data']['accessToken']

def otp_login(mobile):
    s, b = req('POST', '/auth/otp/request', {'mobile': mobile})
    code = b['data']['devOtp']
    s, b = req('POST', '/auth/otp/verify', {'mobile': mobile, 'code': code}, mobile=True)
    return b['data']['accessToken']

def psql(sql):
    return subprocess.run(['psql', '-tA', 'mess_management', '-c', sql], capture_output=True, text=True).stdout.strip()

uniq = str(uuid.uuid4().int)[:6]
owner = login('9000000001'); manager = login('9000000002'); staff = login('9000000003'); ownerB = login('9000000011')

# Flow A
m1 = '98' + uniq + '01'
s, b = req('POST', '/students', {'firstName': 'Test', 'lastName': 'Flow', 'mobile': '+91 ' + m1[:5] + '-' + m1[5:], 'joiningDate': '2026-09-01',
    'parentName': 'Parent', 'parentMobile': '0' + '9' + uniq + '123', 'email': '', 'notes': 'veg only'}, owner)
check('A create (mobile normalized)', s == 201 and b['data']['mobile'] == m1 and b['data']['email'] is None and b['data']['appAccount'] == {'linked': False, 'lastLoginAt': None}, (s, b))
sid = b['data']['id']
check('A no userId/messId exposed', 'userId' not in b['data'] and 'messId' not in b['data'])
s, b = req('GET', '/students?search=' + m1[-6:], token=owner)
check('A list search by mobile', s == 200 and any(x['id'] == sid for x in b['data']) and 'meta' in b, (s, b))
s, b = req('GET', '/students?search=test%20flow&sortBy=name&sortOrder=asc', token=owner)
check('A multi-word search', any(x['id'] == sid for x in b['data']), b)
s, b = req('GET', f'/students/{sid}', token=staff)
check('A staff can view detail', s == 200 and b['data']['notes'] == 'veg only', (s, b))
s, b = req('PATCH', f'/students/{sid}', {'collegeName': 'COEP', 'lastName': ''}, owner)
check('A edit + clear field', s == 200 and b['data']['collegeName'] == 'COEP' and b['data']['lastName'] is None, (s, b))
s, b = req('PATCH', f'/students/{sid}', {'messId': 'x', 'userId': 'y', 'status': 'ARCHIVED'}, owner)
check('A rejects messId/userId/status in update', s == 400 and set(b['error']['fields']) >= {'messId', 'userId', 'status'}, (s, b))
s, b = req('PATCH', f'/students/{sid}/status', {'status': 'INACTIVE'}, manager)
check('A manager deactivates', s == 200 and b['data']['status'] == 'INACTIVE', (s, b))
s, b = req('GET', '/students?status=INACTIVE', token=owner)
check('A status filter', all(x['status'] == 'INACTIVE' for x in b['data']) and any(x['id'] == sid for x in b['data']), b)
s, b = req('PATCH', f'/students/{sid}/status', {'status': 'ACTIVE'}, owner)
check('A activate', b['data']['status'] == 'ACTIVE')
s, b = req('PATCH', f'/students/{sid}/status', {'status': 'ARCHIVED'}, owner)
check('A status endpoint refuses ARCHIVED', s == 400, (s, b))
s, b = req('POST', f'/students/{sid}/archive', token=manager)
check('A manager cannot archive', s == 403, (s, b))
s, b = req('POST', f'/students/{sid}/archive', token=owner)
check('A owner archives', s == 201 and b['data']['status'] == 'ARCHIVED' and b['data']['archivedAt'], (s, b))
s, b = req('GET', '/students?search=' + m1, token=owner)
check('A archived hidden by default', not any(x['id'] == sid for x in b['data']), b)
s, b = req('GET', '/students?status=ARCHIVED&search=' + m1, token=owner)
check('A archived filter shows it', any(x['id'] == sid for x in b['data']), b)
s, b = req('POST', '/students', {'firstName': 'Again', 'mobile': m1, 'joiningDate': '2026-09-01'}, owner)
check('A re-add archived -> STUDENT_ARCHIVED conflict', s == 409 and b['error']['code'] == 'STUDENT_ARCHIVED', (s, b))
s, b = req('PATCH', f'/students/{sid}', {'firstName': 'X'}, owner)
check('A edit archived blocked', s == 409, (s, b))
s, b = req('POST', f'/students/{sid}/restore', token=owner)
check('A restore', s == 201 and b['data']['status'] == 'ACTIVE' and b['data']['archivedAt'] is None, (s, b))

# Validation & duplicates
s, b = req('POST', '/students', {'firstName': '', 'mobile': '12345', 'joiningDate': '2026-02-30', 'parentMobile': 'abc'}, owner)
check('Validation errors', s == 400 and set(b['error']['fields']) >= {'firstName', 'mobile', 'joiningDate', 'parentMobile'}, (s, b))
s, b = req('POST', '/students', {'firstName': 'Dup', 'mobile': '91' + m1, 'joiningDate': '2026-09-01'}, owner)
check('Duplicate (919... form) -> STUDENT_DUPLICATE', s == 409 and b['error']['code'] == 'STUDENT_DUPLICATE', (s, b))
s, b = req('POST', '/students', {'firstName': 'Team', 'mobile': '9000000003', 'joiningDate': '2026-09-01'}, owner)
check('Team account mobile -> MOBILE_IN_USE', s == 409 and b['error']['code'] == 'MOBILE_IN_USE', (s, b))

# Roles
s, b = req('POST', '/students', {'firstName': 'S', 'mobile': '9' + uniq + '555', 'joiningDate': '2026-09-01'}, staff)
check('Staff cannot create', s == 403)
s, b = req('PATCH', f'/students/{sid}/status', {'status': 'INACTIVE'}, staff)
check('Staff cannot change status', s == 403)

# Flow B: owner adds first, student logs in later
mb = '97' + uniq + '02'
s, b = req('POST', '/students', {'firstName': 'Raj', 'lastName': 'Kumar', 'mobile': mb, 'joiningDate': '2026-09-02', 'collegeName': 'VIT'}, owner)
bid = b['data']['id']
users_before = psql(f"select count(*) from users where mobile='{mb}'")
stu = otp_login(mb)
s, b = req('GET', '/students/me', token=stu)
check('B student sees real profile after OTP', s == 200 and b['data']['linked'] and b['data']['profile']['id'] == bid and b['data']['profile']['mess']['name'] == 'Annapurna Student Mess', (s, b))
check('B profile hides admin notes', 'notes' not in b['data']['profile'])
check('B exactly one user + one student', users_before == '0' and psql(f"select count(*) from users where mobile='{mb}'") == '1' and psql(f"select count(*) from mess_students where mobile='{mb}'") == '1')
s, b = req('GET', f'/students/{bid}', token=owner)
check('B owner sees Linked', b['data']['appAccount']['linked'] is True and b['data']['appAccount']['lastLoginAt'], b)
s, b = req('PATCH', '/students/me', {'collegeName': 'MIT', 'email': 'raj@x.com'}, stu)
check('B self edit allowed fields', s == 200 and b['data']['collegeName'] == 'MIT', (s, b))
s, b = req('PATCH', '/students/me', {'mobile': '9999999999', 'status': 'ACTIVE', 'notes': 'x', 'joiningDate': '2026-01-01'}, stu)
check('B self edit rejects restricted fields', s == 400 and set(b['error']['fields']) >= {'mobile', 'status', 'notes', 'joiningDate'}, (s, b))
s, b = req('GET', '/students', token=stu)
check('B student blocked from owner list', s == 403, (s, b))
s, b = req('GET', f'/students/{sid}', token=stu)
check('B student blocked from other student by id', s == 403, (s, b))

# Flow C: student logs in first
mc = '96' + uniq + '03'
stc = otp_login(mc)
s, b = req('GET', '/students/me', token=stc)
check('C unlinked student -> linked:false (200)', s == 200 and b['data'] == {'linked': False}, (s, b))
s, b = req('PATCH', '/students/me', {'collegeName': 'X'}, stc)
check('C unlinked self edit -> STUDENT_NOT_LINKED', s == 404 and b['error']['code'] == 'STUDENT_NOT_LINKED', (s, b))
s, b = req('POST', '/students', {'firstName': 'Early', 'mobile': mc, 'joiningDate': '2026-09-03'}, owner)
check('C owner add links existing user', s == 201 and b['data']['appAccount']['linked'] is True, (s, b))
s, b = req('GET', '/students/me', token=stc)
check('C student now sees mess profile', b['data']['linked'] and b['data']['profile']['firstName'] == 'Early', b)
check('C no duplicate user', psql(f"select count(*) from users where mobile='{mc}'") == '1')

# Same student joins second mess (allowed); still one user
s, b = req('POST', '/students', {'firstName': 'Early', 'mobile': mc, 'joiningDate': '2026-09-03'}, ownerB)
check('C same person in another mess allowed + linked', s == 201 and b['data']['appAccount']['linked'], (s, b))

# Mobile change on linked student unlinks / relinks safely
s, b = req('PATCH', f'/students/{bid}', {'mobile': '95' + uniq + '04'}, owner)
check('Mobile change on linked student -> unlinked (new number has no account)', s == 200 and b['data']['appAccount']['linked'] is False, (s, b))
s, b = req('PATCH', f'/students/{bid}', {'mobile': mc}, owner)
check('Mobile change to existing student number in same mess -> conflict', s == 409, (s, b))

# Flow E: tenant isolation
s, b = req('GET', '/students?search=Neha', token=owner)
check('E Mess A search cannot see Mess B student', b['data'] == [], b)
neha = psql("select id from mess_students where mobile='9100000099'")
for name, (m, path, body) in {
    'detail': ('GET', f'/students/{neha}', None),
    'update': ('PATCH', f'/students/{neha}', {'firstName': 'Hacked'}),
    'status': ('PATCH', f'/students/{neha}/status', {'status': 'INACTIVE'}),
    'archive': ('POST', f'/students/{neha}/archive', None),
    'restore': ('POST', f'/students/{neha}/restore', None),
}.items():
    s, b = req(m, path, body, owner)
    check(f'E Mess A {name} Mess B student -> 404', s == 404, (s, b))
check('E Mess B student untouched', psql(f"select \"firstName\"||status from mess_students where id='{neha}'") == 'NehaACTIVE')
s, b = req('GET', '/students/not-a-uuid', token=owner)
check('E malformed id -> 404', s == 404, (s, b))
s, b = req('GET', '/students?messId=' + psql("select \"messId\" from mess_students where id='" + neha + "'"), token=owner)
check('E messId query param rejected', s == 400, (s, b))

# Flow D: CSV import
r1, r2, r3 = ['93' + uniq + f'{i:02d}' for i in (10, 11, 12)]
csv = ('﻿First Name,last_name,Mobile,email,collegeName,joiningDate,parentMobile\r\n'
       f'Amit,"Shah, Jr",{r1},amit@x.com,COEP,15/08/2026,\r\n'
       f'Sita,,+91 {r2},,"Fergusson ""FC""",,\r\n'
       f',Nobody,{r3},,,,\r\n'
       f'Dup,Row,{r1},,,,\r\n'
       f'Existing,One,{m1},,,,\r\n'
       f'Bad,Date,93{uniq}13,,,31-02-2026,\r\n'
       f'Team,Acct,9000000002,,,,\r\n'
       ',,,,,,\r\n')
boundary = 'XBOUNDARY'
def multipart(name, content, ctype='text/csv'):
    return (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n').encode() + content.encode() + f'\r\n--{boundary}--\r\n'.encode()
s, b = req('POST', '/students/import', token=owner, raw=multipart('students.csv', csv), ctype=f'multipart/form-data; boundary={boundary}')
d = b.get('data', {})
check('D import summary', s == 201 and (d['total'], d['imported'], d['skipped'], d['failed']) == (7, 2, 2, 3), (s, b))
issues = {i['row']: i for i in d.get('issues', [])}
check('D row-level issues', issues.get(4, {}).get('field') == 'firstName' and issues.get(5, {}).get('kind') == 'skipped'
      and issues.get(6, {}).get('kind') == 'skipped' and issues.get(7, {}).get('field') == 'joiningDate' and issues.get(8, {}).get('kind') == 'failed', d.get('issues'))
s, b = req('GET', '/students?search=Amit', token=owner)
got = [x for x in b['data'] if x['mobile'] == r1]
check('D imported rows in list with parsed date/quoted values', got and got[0]['joiningDate'] == '2026-08-15' and got[0]['lastName'] == 'Shah, Jr', b)
s, b = req('GET', '/students?search=' + r2, token=owner)
check('D +91 normalized + escaped quotes', b['data'] and b['data'][0]['collegeName'] == 'Fergusson "FC"', b)
s, b = req('POST', '/students/import', token=owner, raw=multipart('students.xlsx', 'x', 'application/octet-stream'), ctype=f'multipart/form-data; boundary={boundary}')
check('D non-CSV rejected', s == 400 and b['error']['code'] == 'FILE_INVALID', (s, b))
s, b = req('POST', '/students/import', token=owner, raw=multipart('a.csv', 'name,phone\nx,y\n'), ctype=f'multipart/form-data; boundary={boundary}')
check('D missing columns rejected', s == 400 and 'firstName' in b['error']['message'], (s, b))
s, b = req('POST', '/students/import', token=owner, raw=multipart('a.csv', 'firstName,mobile\n' + 'x,1\n' * 300000), ctype=f'multipart/form-data; boundary={boundary}')
check('D >1MB rejected', s == 413 and b['error']['code'] == 'FILE_INVALID', (s, b))
s, b = req('POST', '/students/import', token=staff, raw=multipart('a.csv', 'firstName,mobile\n'), ctype=f'multipart/form-data; boundary={boundary}')
check('D staff cannot import', s == 403, (s, b))

# Pagination
s, b = req('GET', '/students?page=1&pageSize=2&sortBy=name&sortOrder=asc', token=owner)
s2, b2 = req('GET', '/students?page=2&pageSize=2&sortBy=name&sortOrder=asc', token=owner)
check('Pagination meta + distinct pages', b['meta']['pageSize'] == 2 and len(b['data']) == 2 and b['meta']['total'] >= 4 and not {x['id'] for x in b['data']} & {x['id'] for x in b2['data']}, (b['meta'], b2.get('meta')))

# Sensitive data
s, b = req('GET', f'/students/{bid}', token=owner)
blob = json.dumps(b)
check('No auth secrets in detail', not re.search(r'password|token|session|userId', blob, re.I), blob)

print(f"\n{sum(ok for _, ok in results)}/{len(results)} checks passed")
