import json, subprocess, urllib.request, datetime, random, time, sys, os
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
def restart_api(extra_env):
    """Asks the test harness (run.py) to restart its own API process with extra env (never pkill)."""
    ctl = os.environ['MESS_TEST_CONTROL']
    urllib.request.urlopen(urllib.request.Request(ctl + '/restart', data=json.dumps({'env': extra_env}).encode(), method='POST'), timeout=180)
today = subprocess.run(['node', '-e', "console.log(require('./packages/shared/dist').businessToday())"], capture_output=True, text=True).stdout.strip()
def add(d, n): return (datetime.date.fromisoformat(d) + datetime.timedelta(days=n)).isoformat()
mob = lambda: '7' + str(random.randint(100000000, 999999999))
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
u = str(random.randint(10000, 99999))
plan = lambda tok, days=30, price=500: req('POST', '/meal-plans', {'name': f'N{price}-{days} {u}{random.randint(0,999)}', 'price': price, 'lunchIncluded': True, 'dinnerIncluded': True, 'durationType': 'DAYS', 'durationValue': days}, tok)[1]['data']['id']
P = plan(owner)
def student(tok=None, start=None, plan_id=None):
    m = mob()
    sid = req('POST', '/students', {'firstName': 'Note', 'lastName': u, 'mobile': m, 'joiningDate': today}, tok or owner)[1]['data']['id']
    sub = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': plan_id or P, 'startDate': start or today}, tok or owner)[1]['data']['id'] if (plan_id or P) else None
    return sid, m, sub
def notes(tok, q=''): return req('GET', f'/notifications{q}', token=tok)[1]
def unread(tok): return req('GET', '/notifications/unread-count', token=tok)[1]['data']['count']

# Students (OTP budget: 5/min)
sidA, mA, subA = student(); stA = otp_login(mA)
sidO, mO, subO = student(); stO = otp_login(mO)  # opts out of menus
check('New student starts with 0 unread', unread(stA) == 0)

# Flow A + B — payment reminder
paid_before = psql(f"select \"amountPaidPaise\" from student_subscriptions where id='{subA}'")
s, b = req('POST', f'/students/{sidA}/reminders', {'reason': 'PAYMENT'}, owner)
check('B payment reminder sent', s == 200 and [x['studentId'] for x in b['data']['sent']] == [sidA], (s, b))
n = notes(stA)
check('A/B student sees PAYMENT_DUE with amount', n['meta']['total'] == 1 and n['data'][0]['type'] == 'PAYMENT_DUE' and '₹500' in n['data'][0]['title'] and n['data'][0]['data']['screen'] == 'payments' and n['data'][0]['readAt'] is None, n)
check('A unread count = 1', unread(stA) == 1)
check('B payment values unchanged', psql(f"select \"amountPaidPaise\" from student_subscriptions where id='{subA}'") == paid_before and psql(f"select count(*) from payments where \"subscriptionId\"='{subA}'") == '0')
nid = n['data'][0]['id']
s, b = req('POST', f'/notifications/{nid}/read', token=stA)
check('A mark read; unread 0', s == 200 and b['data']['readAt'] and unread(stA) == 0, (s, b))
first_read = b['data']['readAt']
s, b = req('POST', f'/notifications/{nid}/read', token=stA)
check('A read is idempotent (keeps first read time)', s == 200 and b['data']['readAt'] == first_read)
s, b = req('POST', f'/students/{sidA}/reminders', {'reason': 'PAYMENT'}, owner)
check('Double-click payment reminder within window -> skipped, no duplicate', b['data']['sent'] == [] and 'Already reminded' in b['data']['skipped'][0]['reason'] and notes(stA)['meta']['total'] == 1, b)
s, b = req('POST', f'/students/{sidA}/reminders', {'reason': 'GENERAL', 'note': 'Please collect your ID card'}, manager)
check('Manual GENERAL reminder by manager', s == 200 and len(b['data']['sent']) == 1, (s, b))
check('Manual reminder content', notes(stA)['data'][0]['body'] == 'Please collect your ID card' and notes(stA)['data'][0]['type'] == 'MANUAL_REMINDER')
s, b = req('POST', f'/students/{sidA}/reminders', {'reason': 'GENERAL', 'note': 'x' * 201}, owner)
check('Note > 200 chars rejected', s == 400 and 'note' in b['error']['fields'], (s, b))
s, b = req('POST', f'/students/{sidA}/reminders', {'reason': 'SPAM'}, owner)
check('Invalid reason rejected', s == 400)
check('Unread filter', notes(stA, '?unreadOnly=true')['meta']['total'] == unread(stA) == 1)
s, b = req('POST', '/notifications/read-all', token=stA)
check('Read all', s == 200 and unread(stA) == 0)

# No-due & unlinked
sidZ, _, subZ = student()
req('POST', '/payments', {'studentId': sidZ, 'subscriptionId': subZ, 'amountPaise': 50000, 'method': 'CASH'}, owner)
s, b = req('POST', f'/students/{sidZ}/reminders', {'reason': 'PAYMENT'}, owner)
check('No-due reminder skipped "Nothing due", no notification', b['data']['sent'] == [] and b['data']['skipped'][0]['reason'] == 'Nothing due', b)
sidU, _, _ = student()
s, b = req('POST', f'/students/{sidU}/reminders', {'reason': 'PAYMENT'}, owner)
check('Unlinked student skipped "Not using the app yet"', b['data']['skipped'][0]['reason'] == 'Not using the app yet', b)

# Flow C — bulk
mB = mob(); sidB = req('POST', '/students', {'firstName': 'Bee', 'mobile': mB, 'joiningDate': today}, ownerB)[1]['data']['id']
s, b = req('POST', '/reminders/payment-due/bulk', {'studentIds': [sidO, sidZ, sidU, sidB]}, owner)
d = b['data']
check('C bulk summary: sent O, skipped Z/U, Mess B student failed as not found', [x['studentId'] for x in d['sent']] == [sidO] and {x['studentId'] for x in d['skipped']} == {sidZ, sidU} and [x['studentId'] for x in d['failed']] == [sidB] and d['failed'][0]['name'] == 'Unknown', d)
s, b = req('POST', '/reminders/payment-due/bulk', {'allWithDues': True}, owner)
d = b['data']
ids_all = [x['studentId'] for x in d['sent'] + d['skipped'] + d['failed']]
check('C allWithDues targets only own mess students with dues', s == 200 and sidB not in ids_all and sidZ not in ids_all and sidO in ids_all, d)
check('Bulk > 200 rejected', req('POST', '/reminders/payment-due/bulk', {'studentIds': [sidA] * 201}, owner)[0] == 400)
check('Bulk with nothing selected rejected', req('POST', '/reminders/payment-due/bulk', {'studentIds': []}, owner)[0] == 400)

# Flow D — expiry
P30 = plan(owner, 30)
sidE, mE, subE = student(start=add(today, -26), plan_id=P30)  # ends today+3
check('D sub ends in 3 days', psql(f"select \"endDate\" from student_subscriptions where id='{subE}'") == add(today, 3))
psql(f"update mess_students set \"userId\"=(select \"userId\" from mess_students where id='{sidA}') where id='{sidE}'") if False else None
stE = None
# Link E via OTP later; first run with E unlinked -> not notified
s, b = req('POST', '/reminders/expiry/run', token=owner)
check('D run ok', s == 200 and b['data']['date'] == today, (s, b))
owner_before = unread(owner)
time.sleep(1)
stE = otp_login(mE)
s, b = req('POST', '/reminders/expiry/run', token=owner)
ne = notes(stE)
check('D linked student gets one expiry reminder with date', ne['meta']['total'] == 1 and ne['data'][0]['type'] == 'SUBSCRIPTION_EXPIRING' and datetime.date.fromisoformat(add(today, 3)).strftime('%-d %b') in ne['data'][0]['body'] and 'contact your mess' in ne['data'][0]['body'], ne)
s, b = req('POST', '/reminders/expiry/run', token=owner)
check('D second run does not duplicate', notes(stE)['meta']['total'] == 1 and b['data']['notified'] == 0 and b['data']['skippedDuplicates'] >= 1, b)
on = notes(owner, '?type=SYSTEM')
check('D owner gets one daily SYSTEM summary', on['meta']['total'] >= 1 and on['data'][0]['data']['screen'] == 'subscriptions' and psql(f"select count(*) from notifications where \"dedupeKey\"='expiry-summary:{psql(chr(39).join(['select id from messes where name=', 'Annapurna Student Mess', '']))}:{today}' and \"userId\"=(select id from users where mobile='9000000001')") == '1', on)
req('POST', f'/subscriptions/{subE}/renew', {}, owner)
psql(f"delete from notifications where \"userId\"=(select \"userId\" from mess_students where id='{sidE}')")
req('POST', '/reminders/expiry/run', token=owner)
check('D renewal scheduled -> no reminder', notes(stE)['meta']['total'] == 0)
check('Staff cannot run expiry / send reminders', req('POST', '/reminders/expiry/run', token=staff)[0] == 403 and req('POST', f'/students/{sidA}/reminders', {'reason': 'GENERAL'}, staff)[0] == 403 and req('POST', '/reminders/payment-due/bulk', {'allWithDues': True}, staff)[0] == 403)

# Flow H setup — O turns off menu updates
s, b = req('PATCH', '/notification-preferences', {'menuUpdatesEnabled': False}, stO)
check('H preferences update', s == 200 and b['data']['menuUpdatesEnabled'] is False and b['data']['pushEnabled'] is True, (s, b))
check('H preferences read back', req('GET', '/notification-preferences', token=stO)[1]['data']['menuUpdatesEnabled'] is False)
check('Preferences default all on', all(req('GET', '/notification-preferences', token=stA)[1]['data'].values()))

# Flow E — menu change
meal = lambda items: {'available': True, 'items': items, 'note': None}
menu = lambda lunch: {'breakfast': meal(['Poha']), 'lunch': meal(lunch), 'dinner': meal(['Rice']), 'generalNote': None}
req('PUT', f'/menus/{today}', menu(['Dal']), owner); req('POST', f'/menus/{today}/publish', token=owner)
psql(f"delete from notifications where type='MENU_CHANGED'")
cA0, cO0 = notes(stA, '?type=MENU_CHANGED')['meta']['total'], notes(stO, '?type=MENU_CHANGED')['meta']['total']
s, b = req('PUT', f'/menus/{today}', menu(['Dal', f'Paneer {u}']), owner)
check('E published menu change saves', s == 200 and b['data']['isPublished'])
na = notes(stA, '?type=MENU_CHANGED')
check('E student notified of change', na['meta']['total'] == cA0 + 1 and na['data'][0]['data']['screen'] == 'menu' and "Today's menu" in na['data'][0]['title'], na)
check('H opted-out student not notified', notes(stO, '?type=MENU_CHANGED')['meta']['total'] == cO0)
req('PUT', f'/menus/{today}', menu(['Dal', f'Paneer {u}', 'Salad']), owner)
check('E repeated edit within 10 min -> no second notification', notes(stA, '?type=MENU_CHANGED')['meta']['total'] == cA0 + 1)
total_before = psql("select count(*) from notifications where type='MENU_CHANGED'")
req('PUT', f'/menus/{today}', menu(['Dal', f'Paneer {u}', 'Salad']), owner)
check('E identical save -> no notification', psql("select count(*) from notifications where type='MENU_CHANGED'") == total_before)
tm = add(today, 1)
req('POST', f'/menus/{tm}/unpublish', token=owner)
total_before = psql("select count(*) from notifications where type='MENU_CHANGED'")
req('PUT', f'/menus/{tm}', menu(['Rajma', f'Rice {u}']), owner)
check('E draft edit -> no notification', psql("select count(*) from notifications where type='MENU_CHANGED'") == total_before)
far = add(today, 5); req('PUT', f'/menus/{far}', menu(['A']), owner); req('POST', f'/menus/{far}/publish', token=owner); req('PUT', f'/menus/{far}', menu(['B']), owner)
check('E change beyond tomorrow -> no notification', psql("select count(*) from notifications where type='MENU_CHANGED'") == total_before)
check('Menu notifications stay in Mess A: none tagged Mess B, every recipient is a Mess A student',
      psql("select count(*) from notifications where type='MENU_CHANGED' and \"messId\"=(select id from messes where name='Sai Tiffin Service')") == '0'
      and psql("select count(*) from notifications n where n.type='MENU_CHANGED' and not exists (select 1 from mess_students s where s.\"userId\"=n.\"userId\" and s.\"messId\"=n.\"messId\")") == '0')

# Flow F — pauses
s, b = req('POST', '/students/me/pauses', {'fromDate': add(today, 2), 'toDate': add(today, 4), 'mealTypes': ['lunch', 'dinner']}, stA)
check('F pause 6 meals created', len(b['data']['created']) == 6, b)
pn = notes(stA, '?type=MEAL_PAUSE_CREATED')
check('F exactly one summary notification', pn['meta']['total'] == 1 and '6 meals' in pn['data'][0]['title'] and pn['data'][0]['data']['screen'] == 'pause', pn)
s, b = req('POST', f"/students/me/pauses/{b['data']['created'][0]['id']}/cancel", token=stA)
cn = notes(stA, '?type=MEAL_PAUSE_CANCELLED')
check('F cancel -> one cancellation notification', s == 200 and cn['meta']['total'] == 1 and 'cancelled' in cn['data'][0]['body'], cn)

# Flow G — push devices
tokA = f'ExponentPushToken[test{u}AAAAAAAA]'
s, b = req('POST', '/push-devices/register', {'pushToken': tokA, 'platform': 'ANDROID', 'deviceLabel': 'Pixel'}, stA)
check('G register', s == 200 and b['data']['registered'])
req('POST', '/push-devices/register', {'pushToken': tokA, 'platform': 'ANDROID'}, stA)
check('G re-register same token -> single row', psql(f"select count(*) from push_devices where \"pushToken\"='{tokA}'") == '1')
tokA2 = f'ExponentPushToken[test{u}BBBBBBBB]'
req('POST', '/push-devices/register', {'pushToken': tokA2, 'platform': 'IOS'}, stA)
check('G multiple devices per user', psql(f"select count(*) from push_devices where \"userId\"=(select \"userId\" from mess_students where id='{sidA}') and \"isActive\"") == '2')
check('G invalid token rejected', req('POST', '/push-devices/register', {'pushToken': 'not-a-token', 'platform': 'IOS'}, stA)[0] == 400)
s, b = req('POST', '/push-devices/unregister', {'pushToken': tokA2}, stO)
check("G another user can't unregister someone else's token", psql(f"select \"isActive\" from push_devices where \"pushToken\"='{tokA2}'") == 't')
req('POST', '/push-devices/unregister', {'pushToken': tokA2}, stA)
check('G unregister deactivates', psql(f"select \"isActive\" from push_devices where \"pushToken\"='{tokA2}'") == 'f')
req('POST', '/push-devices/register', {'pushToken': tokA2, 'platform': 'IOS'}, stO)
check('G token reassigned to new signed-in user', psql(f"select \"userId\" = (select \"userId\" from mess_students where id='{sidO}') and \"isActive\" from push_devices where \"pushToken\"='{tokA2}'") == 't')
req('POST', f'/students/{sidA}/reminders', {'reason': 'CONTACT_MESS'}, owner)
time.sleep(1.5)
check('Push SENT via log provider when device registered', psql(f"select \"pushStatus\" from notifications where \"userId\"=(select \"userId\" from mess_students where id='{sidA}') order by \"createdAt\" desc limit 1") == 'SENT')
req('PATCH', '/notification-preferences', {'pushEnabled': False}, stA)
req('POST', f'/students/{sidA}/reminders', {'reason': 'RENEWAL'}, owner)
time.sleep(1)
check('pushEnabled=false -> in-app only (NOT_SENT)', psql(f"select type||'/'||\"pushStatus\" from notifications where \"userId\"=(select \"userId\" from mess_students where id='{sidA}') order by \"createdAt\" desc limit 1") == 'MANUAL_REMINDER/NOT_SENT')
req('PATCH', '/notification-preferences', {'pushEnabled': True}, stA)

# Flow I — push provider failure
restart_api({'PUSH_PROVIDER': 'expo', 'EXPO_PUSH_URL': 'http://127.0.0.1:9/push'})
owner = login('9000000001')
s, b = req('POST', '/students/me/pauses', {'fromDate': add(today, 6), 'toDate': add(today, 6), 'mealTypes': ['dinner']}, stA)
check('I pause still succeeds when push provider is down', s == 201 and len(b['data']['created']) == 1, (s, b))
time.sleep(2)
check('I in-app notification kept, push marked FAILED', psql(f"select type||'/'||\"pushStatus\" from notifications where \"userId\"=(select \"userId\" from mess_students where id='{sidA}') order by \"createdAt\" desc limit 1") == 'MEAL_PAUSE_CREATED/FAILED')
s, b = req('POST', f'/students/{sidA}/reminders', {'reason': 'GENERAL', 'note': f'outage {u}'}, owner)
check('I reminder still reported sent', s == 200 and len(b['data']['sent']) == 1, (s, b))
restart_api({})
owner = login('9000000001')

# Flow J — security
nidO = notes(stO)['data'][0]['id']
s, b = req('POST', f'/notifications/{nidO}/read', token=stA)
check("J student can't read another's notification -> 404", s == 404 and b['error']['code'] == 'NOTIFICATION_NOT_FOUND', (s, b))
check("J list only own", all(x['id'] != nidO for x in notes(stA, '?pageSize=100')['data']))
s, b = req('POST', f'/students/{sidB}/reminders', {'reason': 'GENERAL'}, owner)
check('J Mess A cannot target Mess B student -> 404', s == 404, (s, b))
check('J student cannot send reminders', req('POST', f'/students/{sidA}/reminders', {'reason': 'GENERAL'}, stA)[0] == 403)
check('Unauthenticated blocked', req('GET', '/notifications')[0] == 401)
check('Malformed id -> 404', req('POST', '/notifications/abc/read', token=stA)[0] == 404)
p1, p2 = req('GET', '/notifications?pageSize=2&page=1', token=stA)[1], req('GET', '/notifications?pageSize=2&page=2', token=stA)[1]
check('Pagination newest first, distinct pages', p1['meta']['pageSize'] == 2 and not {x['id'] for x in p1['data']} & {x['id'] for x in p2['data']} and p1['data'][0]['createdAt'] >= p1['data'][1]['createdAt'], (p1['meta'], p2['meta']))
check('No payments created by reminders', psql(f"select count(*) from payments where \"studentId\"='{sidA}'") == '0')
print(f"\n{sum(results)}/{len(results)} checks passed")
