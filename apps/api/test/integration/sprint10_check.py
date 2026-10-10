import json, subprocess, urllib.request, datetime, random, uuid, time, concurrent.futures
import os as _os
B = _os.environ.get('MESS_TEST_BASE', 'http://localhost:4100/api/v1')
results = []
def req(method, path, body=None, token=None, mobile=False, raw=None, ctype=None, binary=False):
    headers = {}
    data = json.dumps(body).encode() if body is not None else None
    if data: headers['Content-Type'] = 'application/json'
    if raw is not None: data, headers['Content-Type'] = raw, ctype
    if token: headers['Authorization'] = f'Bearer {token}'
    if mobile: headers['x-client-type'] = 'MOBILE'
    r = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            t = res.read()
            if binary: return res.status, t, res.headers.get('Content-Type')
            t = t.decode(); return res.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode() or 'null'
        return (e.code, json.loads(t), None) if binary else (e.code, json.loads(t))
def check(name, cond, info=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {str(info)[:700]}'))
def login(i): return req('POST', '/auth/login', {'identifier': i, 'password': 'Password123'})[1]['data']['accessToken']
def otp_login(m):
    code = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    return req('POST', '/auth/otp/verify', {'mobile': m, 'code': code}, mobile=True)[1]['data']['accessToken']
def psql(sql): return subprocess.run(['psql', '-tA', 'mess_management', '-c', sql], capture_output=True, text=True).stdout.strip()
today = subprocess.run(['node', '-e', "console.log(require('./packages/shared/dist').businessToday())"], capture_output=True, text=True).stdout.strip()
def add(d, n): return (datetime.date.fromisoformat(d) + datetime.timedelta(days=n)).isoformat()
mob = lambda: '7' + str(random.randint(100000000, 999999999))
u = str(random.randint(10000, 99999))
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
def plan(tok): return req('POST', '/meal-plans', {'name': f'FB {u} {random.randint(0, 9999)}', 'price': 100, 'breakfastIncluded': True, 'lunchIncluded': True, 'dinnerIncluded': True, 'durationType': 'MONTHS', 'durationValue': 1}, tok)[1]['data']['id']
PA, PB = plan(owner), plan(ownerB)
def student(tok, p):
    m = mob()
    sid = req('POST', '/students', {'firstName': 'Fb', 'lastName': u, 'mobile': m, 'joiningDate': today}, tok)[1]['data']['id']
    req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': p, 'startDate': add(today, -10)}, tok)
    return sid, m
def serve(sid, meal, tok=None): return req('POST', '/attendance/manual', {'studentId': sid, 'mealType': meal}, tok or owner)[1]['data']['attendance']['id']
sidA, mA = student(owner, PA); stA = otp_login(mA)
sidC, mC = student(owner, PA); stC = otp_login(mC)
sidB, mB = student(ownerB, PB); stB = otp_login(mB)
req('POST', '/push-devices/register', {'pushToken': f'ExponentPushToken[fb{u}AAAAAAAAAA]', 'platform': 'ANDROID'}, stA)

# Flow A — meal rating
lunch = serve(sidA, 'lunch')
s, b = req('GET', '/students/me/feedback/eligible-meals', token=stA)
check('A served lunch is eligible', s == 200 and [x['attendanceId'] for x in b['data']] == [lunch] and b['data'][0]['mealType'] == 'lunch' and b['data'][0]['date'] == today, b)
sum0 = req('GET', f'/feedback/summary?from={today}&to={today}', token=owner)[1]['data']
body = {'attendanceId': lunch, 'overallRating': 4, 'tasteRating': 5, 'qualityRating': 4, 'quantityRating': 2, 'cleanlinessRating': 3, 'comment': f'Dal was great {u}'}
s, b = req('POST', '/students/me/feedback/meal', body, stA)
check('A rate with all five dimensions + comment', s == 201 and b['data']['overallRating'] == 4 and b['data']['quantityRating'] == 2 and b['data']['comment'].startswith('Dal') and b['data']['mealType'] == 'lunch', (s, b))
check('A no longer eligible', req('GET', '/students/me/feedback/eligible-meals', token=stA)[1]['data'] == [])
# Flow B — duplicate (sequential + concurrent)
s, b = req('POST', '/students/me/feedback/meal', body, stA)
check('B second rating -> FEEDBACK_ALREADY_SUBMITTED', s == 409 and b['error']['code'] == 'FEEDBACK_ALREADY_SUBMITTED', (s, b))
dinner = serve(sidA, 'dinner')
with concurrent.futures.ThreadPoolExecutor(6) as ex:
    codes = sorted(ex.map(lambda _: req('POST', '/students/me/feedback/meal', {'attendanceId': dinner, 'overallRating': 1}, stA)[0], range(6)))
check('B 6 parallel ratings of one meal -> exactly one stored', codes.count(201) == 1 and psql(f"select count(*) from feedback where \"attendanceId\"='{dinner}'") == '1', codes)
s, b = req('GET', f'/feedback?search={mA}&type=MEAL', token=owner)
check('A owner sees ratings', s == 200 and b['meta']['total'] == 2 and any(x['comment'] == f'Dal was great {u}' and x['student']['id'] == sidA for x in b['data']), b)
sum1 = req('GET', f'/feedback/summary?from={today}&to={today}', token=owner)[1]['data']
check('A summary count +2 and averages in range', sum1['mealCount'] == sum0['mealCount'] + 2 and all(v is None or 1 <= v <= 5 for v in sum1['averages'].values()), (sum0, sum1))
s, b = req('GET', f'/feedback?search={mA}&rating=1', token=owner)
check('Rating filter (exact overall)', [x['overallRating'] for x in b['data']] == [1], b)
s, b = req('GET', f'/feedback?search={mA}&mealType=lunch', token=owner)
check('Meal filter', [x['mealType'] for x in b['data']] == ['lunch'], b)

# No attendance / someone else's / validation
s, b = req('POST', '/students/me/feedback/meal', {'attendanceId': str(uuid.uuid4()), 'overallRating': 5}, stA)
check('No attendance -> FEEDBACK_NOT_ALLOWED', s == 403 and b['error']['code'] == 'FEEDBACK_NOT_ALLOWED', (s, b))
lunchC = serve(sidC, 'lunch')
s, b = req('POST', '/students/me/feedback/meal', {'attendanceId': lunchC, 'overallRating': 5}, stA)
check("Can't rate another student's meal", s == 403 and psql(f"select count(*) from feedback where \"attendanceId\"='{lunchC}'") == '0', (s, b))
for bad, label in ((0, '0'), (6, '6'), (3.5, 'non-integer'), ('5', 'string')):
    s, b = req('POST', '/students/me/feedback/meal', {'attendanceId': lunchC, 'overallRating': bad}, stC)
    check(f'Rating {label} rejected', s == 400 and 'overallRating' in b['error']['fields'], (s, b))
s, b = req('POST', '/students/me/feedback/meal', {'attendanceId': lunchC, 'overallRating': 5, 'tasteRating': 9}, stC)
check('Detail rating out of range rejected', s == 400 and 'tasteRating' in b['error']['fields'])

# Reversed / window
bf = serve(sidC, 'breakfast')
req('POST', f'/attendance/{bf}/reverse', {}, owner)
check('Reversed meal not eligible', bf not in [x['attendanceId'] for x in req('GET', '/students/me/feedback/eligible-meals', token=stC)[1]['data']])
s, b = req('POST', '/students/me/feedback/meal', {'attendanceId': bf, 'overallRating': 5}, stC)
check('Reversed meal direct submit rejected', s == 403, (s, b))
s, b = req('POST', '/students/me/feedback/meal', {'attendanceId': lunchC, 'overallRating': 1, 'quantityRating': 1}, stC)
sumBefore = req('GET', f'/feedback/summary?from={today}&to={today}', token=owner)[1]['data']
req('POST', f'/attendance/{lunchC}/reverse', {}, owner)
sumAfter = req('GET', f'/feedback/summary?from={today}&to={today}', token=owner)[1]['data']
check('Rated-then-reversed: excluded from summary', sumAfter['mealCount'] == sumBefore['mealCount'] - 1, (sumBefore, sumAfter))
s, b = req('GET', f'/feedback?search={mC}', token=owner)
check('Rated-then-reversed: kept in list, flagged', len(b['data']) == 1 and b['data'][0]['mealReversed'] is True, b)
old = serve(sidC, 'dinner')
psql(f"update meal_attendance set \"attendanceDate\"='{add(today, -8)}' where id='{old}'")
check('Older than 7 days not eligible', old not in [x['attendanceId'] for x in req('GET', '/students/me/feedback/eligible-meals', token=stC)[1]['data']])
s, b = req('POST', '/students/me/feedback/meal', {'attendanceId': old, 'overallRating': 4}, stC)
check('Older than 7 days direct submit rejected', s == 403 and 'within 7 days' in b['error']['message'], (s, b))

# Flow C — general feedback
c0 = psql('select count(*) from complaints')
s, b = req('POST', '/students/me/feedback/general', {'overallRating': 3, 'comment': f'Please add more salad {u}'}, stA)
check('C general feedback (rating + comment)', s == 201 and b['data']['type'] == 'GENERAL' and b['data']['mealType'] is None, (s, b))
s, b = req('POST', '/students/me/feedback/general', {'comment': 'Only a comment'}, stA)
check('C comment-only general feedback', s == 201)
s, b = req('POST', '/students/me/feedback/general', {'comment': '   '}, stA)
check('C empty general feedback rejected', s == 400, (s, b))
s, b = req('GET', f'/feedback?type=GENERAL&search={mA}', token=manager)
check('C owner/manager sees general feedback', b['meta']['total'] == 2, b)
check('C no complaint auto-created', psql('select count(*) from complaints') == c0)
check('Student own feedback history', req('GET', '/students/me/feedback', token=stA)[1]['meta']['total'] == 4)

# Flow D — complaint + photo
png = b'\x89PNG\r\n\x1a\n' + b'\x00' * 200
def upload(tok, content, name='photo.png', ctype='image/png'):
    bnd = 'XB' + u
    raw = (f'--{bnd}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n').encode() + content + f'\r\n--{bnd}--\r\n'.encode()
    return req('POST', '/students/me/uploads/complaint-photo', token=tok, raw=raw, ctype=f'multipart/form-data; boundary={bnd}')
s, b = upload(stA, png)
check('D upload valid PNG', s == 201 and b['data']['mimeType'] == 'image/png' and b['data']['sizeBytes'] == len(png), (s, b))
fid = b['data']['id']
check('D storage key random, not client filename', 'photo' not in psql(f"select \"storageKey\" from stored_files where id='{fid}'"))
s, b = upload(stA, b'GIF89a not allowed', 'x.png', 'image/png')
check('D wrong real type (spoofed MIME) rejected', s == 400 and b['error']['code'] == 'ATTACHMENT_INVALID', (s, b))
s, b = upload(stA, b'\xff\xd8\xff' + b'\x00' * (5 * 1024 * 1024 + 10), 'big.jpg', 'image/jpeg')
check('D > 5 MB rejected', s == 413, (s, b))
check('D owner cannot use student upload endpoint', upload(owner, png)[0] == 403)
s, b = req('POST', '/students/me/complaints', {'category': 'FOOD_QUALITY', 'description': '', 'attachmentId': fid}, stA)
check('D blank description rejected', s == 400 and 'description' in b['error']['fields'])
s, b = req('POST', '/students/me/complaints', {'category': 'NOISE', 'description': 'x'}, stA)
check('D invalid category rejected', s == 400)
s, b = req('POST', '/students/me/complaints', {'category': 'FOOD_QUALITY', 'description': 'x' * 1001}, stA)
check('D > 1000 chars rejected', s == 400)
s, b = req('POST', '/students/me/complaints', {'category': 'FOOD_QUALITY', 'description': 'Hair', 'attachmentId': fid}, stC)
check("D can't attach another student's photo", s == 400 and b['error']['code'] == 'ATTACHMENT_INVALID', (s, b))
key = str(uuid.uuid4())
own_notes0 = req('GET', '/notifications/unread-count', token=owner)[1]['data']['count']
s, b = req('POST', '/students/me/complaints', {'category': 'FOOD_QUALITY', 'description': f'Found a stone in rice {u}', 'attachmentId': fid, 'idempotencyKey': key}, stA)
check('D complaint created with photo (push failing)', s == 201 and b['data']['status'] == 'OPEN' and b['data']['attachmentId'] == fid and b['data']['messages'] == [], (s, b))
cid = b['data']['id']
s, b = req('POST', '/students/me/complaints', {'category': 'FOOD_QUALITY', 'description': f'Found a stone in rice {u}', 'attachmentId': fid, 'idempotencyKey': key}, stA)
check('D retry with same key -> same complaint', s == 201 and b['data']['id'] == cid and psql(f"select count(*) from complaints where \"studentId\"='{sidA}'") == '1', (s, b))
s, b = req('POST', '/students/me/complaints', {'category': 'OTHER', 'description': 'again', 'attachmentId': fid}, stA)
check('D photo already attached cannot be reused', s == 400)
check('Owner gets one COMPLAINT_CREATED notification', req('GET', '/notifications/unread-count', token=owner)[1]['data']['count'] == own_notes0 + 1 and req('GET', '/notifications?type=COMPLAINT_CREATED', token=owner)[1]['data'][0]['data']['complaintId'] == cid)

# Attachment access
for who, tok, exp in (('uploader', stA, 200), ('owner A', owner, 200), ('staff A', staff, 200), ('other student', stC, 404), ('owner B', ownerB, 404)):
    s, data, ct = req('GET', f'/files/{fid}', token=tok, binary=True)
    check(f'File access: {who} -> {exp}', s == exp and (exp != 200 or (data == png and ct == 'image/png')), s)
check('File unauthenticated -> 401', req('GET', f'/files/{fid}', binary=True)[0] == 401)

# Flow E/F/G — workflow, replies, notifications
s, b = req('GET', '/complaints?status=OPEN&pageSize=100', token=staff)
check('E staff sees queue; complaint OPEN', s == 200 and any(x['id'] == cid and x['status'] == 'OPEN' and x['hasAttachment'] for x in b['data']), b)
check('E staff cannot change status', req('PATCH', f'/complaints/{cid}/status', {'status': 'IN_PROGRESS'}, staff)[0] == 403)
check('E staff cannot reply', req('POST', f'/complaints/{cid}/responses', {'message': 'hi'}, staff)[0] == 403)
n0 = req('GET', '/notifications?type=COMPLAINT_UPDATED', token=stA)[1]['meta']['total']
s, b = req('PATCH', f'/complaints/{cid}/status', {'status': 'IN_PROGRESS'}, manager)
check('E manager: OPEN -> IN_PROGRESS', s == 200 and b['data']['status'] == 'IN_PROGRESS' and b['data']['inProgressAt'], (s, b))
check('E student sees IN_PROGRESS', req('GET', f'/students/me/complaints/{cid}', token=stA)[1]['data']['status'] == 'IN_PROGRESS')
s, b = req('POST', f'/complaints/{cid}/responses', {'message': f'Sorry! We changed the rice supplier {u}'}, owner)
check('F owner reply appended', s == 200 and len(b['data']['messages']) == 1 and b['data']['messages'][0]['author'] == 'MESS' and b['data']['messages'][0]['authorName'], (s, b))
s, b = req('POST', f'/complaints/{cid}/responses', {'message': '   '}, owner)
check('F blank reply rejected', s == 400)
sd = req('GET', f'/students/me/complaints/{cid}', token=stA)[1]['data']
check('F student sees reply', sd['messages'][0]['message'].startswith('Sorry!') and 'student' not in sd, sd)
s, b = req('PATCH', f'/complaints/{cid}/status', {'status': 'RESOLVED'}, owner)
check('E IN_PROGRESS -> RESOLVED with who/when', s == 200 and b['data']['status'] == 'RESOLVED' and b['data']['resolvedAt'] and b['data']['resolvedBy'], (s, b))
check('E RESOLVED cannot go back', req('PATCH', f'/complaints/{cid}/status', {'status': 'IN_PROGRESS'}, owner)[1]['error']['code'] == 'COMPLAINT_ALREADY_RESOLVED')
check('E no replies after resolved', req('POST', f'/complaints/{cid}/responses', {'message': 'late'}, owner)[1]['error']['code'] == 'COMPLAINT_ALREADY_RESOLVED')
check('E OPEN status not allowed as target', req('PATCH', f'/complaints/{cid}/status', {'status': 'OPEN'}, owner)[0] == 400)
nn = req('GET', '/notifications?type=COMPLAINT_UPDATED', token=stA)[1]
check('G student got exactly 3 updates (in progress, reply, resolved)', nn['meta']['total'] == n0 + 3 and all(x['data']['complaintId'] == cid for x in nn['data'][:3]), nn)
time.sleep(1.5)
check('G push failed but actions succeeded (in-app kept, pushStatus FAILED)', psql(f"select count(*) from notifications where type='COMPLAINT_UPDATED' and \"userId\"=(select \"userId\" from mess_students where id='{sidA}') and \"pushStatus\"='FAILED'") == '3')
cid2 = req('POST', '/students/me/complaints', {'category': 'CLEANLINESS', 'description': f'Tables dirty {u}'}, stC)[1]['data']['id']
s, b = req('PATCH', f'/complaints/{cid2}/status', {'status': 'RESOLVED'}, owner)
check('E OPEN -> RESOLVED directly', s == 200 and b['data']['status'] == 'RESOLVED')
s, b = req('GET', '/students/me/complaints', token=stA)
check('Student list own complaints with response count', b['meta']['total'] == 1 and b['data'][0]['responseCount'] == 1 and b['data'][0]['lastResponseAt'], b)
s, b = req('GET', f'/complaints?category=CLEANLINESS&search={mC}', token=owner)
check('Queue filters (category + search)', [x['id'] for x in b['data']] == [cid2], b)
s, b = req('GET', f'/complaints?from={today}&to={today}&pageSize=100', token=owner)
check('Queue date range + open first ordering', s == 200 and [x['status'] for x in b['data']] == sorted([x['status'] for x in b['data']], key=['OPEN', 'IN_PROGRESS', 'RESOLVED'].index), b)
cnt = req('GET', '/complaints/counts', token=owner)[1]['data']
check('Counts endpoint', cnt['RESOLVED'] >= 2 and set(cnt) == {'OPEN', 'IN_PROGRESS', 'RESOLVED'}, cnt)

# Flow H — security
s, b = req('GET', f'/students/me/complaints/{cid}', token=stC)
check("H student can't read another's complaint -> 404", s == 404 and b['error']['code'] == 'COMPLAINT_NOT_FOUND', (s, b))
cidB = req('POST', '/students/me/complaints', {'category': 'MENU', 'description': f'B mess {u}'}, stB)[1]['data']['id']
check('H Mess A detail Mess B complaint -> 404', req('GET', f'/complaints/{cidB}', token=owner)[0] == 404)
check('H Mess A status Mess B complaint -> 404', req('PATCH', f'/complaints/{cidB}/status', {'status': 'RESOLVED'}, owner)[0] == 404)
check('H Mess A reply Mess B complaint -> 404', req('POST', f'/complaints/{cidB}/responses', {'message': 'x'}, owner)[0] == 404)
check('H Mess B complaint untouched', psql(f"select status from complaints where id='{cidB}'") == 'OPEN')
check('H Mess A queue excludes Mess B', all(x['id'] != cidB for x in req('GET', '/complaints?pageSize=100', token=owner)[1]['data']))
check('H Mess A feedback excludes Mess B', req('GET', f'/feedback?search={mB}', token=owner)[1]['meta']['total'] == 0)
check('H student blocked from owner complaint & feedback APIs', req('GET', '/complaints', token=stA)[0] == 403 and req('GET', '/feedback', token=stA)[0] == 403)
check('H staff blocked from feedback', req('GET', '/feedback', token=staff)[0] == 403)
check('H malformed id -> 404', req('GET', '/complaints/abc', token=owner)[0] == 404)
check('Notifications for complaints never cross messes', psql(f"select count(*) from notifications where type in ('COMPLAINT_CREATED','COMPLAINT_UPDATED') and \"messId\"=(select id from messes where name='Sai Tiffin Service') and \"userId\" in (select id from users where mobile in ('9000000001','9000000002'))") == '0')
print(f"\n{sum(results)}/{len(results)} checks passed")
