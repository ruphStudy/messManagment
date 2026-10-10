import json, subprocess, urllib.request, urllib.parse, datetime, random, csv, io
import os as _os
B = _os.environ.get('MESS_TEST_BASE', 'http://localhost:4100/api/v1')
results = []
import time
def req(method, path, body=None, token=None, raw=False):
    for _ in range(4):
        out = _req(method, path, body, token, raw)
        if out[0] != 429 or not path.startswith('/auth'): return out
        time.sleep(61)
    return out
def _req(method, path, body=None, token=None, raw=False):
    headers = {}
    data = json.dumps(body).encode() if body is not None else None
    if data: headers['Content-Type'] = 'application/json'
    if token: headers['Authorization'] = f'Bearer {token}'
    r = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            t = res.read()
            if raw: return res.status, t.decode('utf-8'), dict(res.headers)
            t = t.decode(); return res.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode() or 'null'
        return (e.code, json.loads(t), {}) if raw else (e.code, json.loads(t))
def check(name, cond, info=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {str(info)[:700]}'))
def login(i): return req('POST', '/auth/login', {'identifier': i, 'password': 'Password123'})[1]['data']['accessToken']
def otp_login(m):
    code = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    return req('POST', '/auth/otp/verify', {'mobile': m, 'code': code}, ) and req('POST', '/auth/otp/verify', {'mobile': m, 'code': code})
def psql(sql): return subprocess.run(['psql', '-tA', 'mess_management', '-c', sql], capture_output=True, text=True).stdout.strip()
today = subprocess.run(['node', '-e', "console.log(require('./packages/shared/dist').businessToday())"], capture_output=True, text=True).stdout.strip()
def add(d, n): return (datetime.date.fromisoformat(d) + datetime.timedelta(days=n)).isoformat()
month = today[:7]; mstart = f'{month}-01'
y, m = map(int, month.split('-')); mend = (datetime.date(y + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1)).isoformat()
u = str(random.randint(10000, 99999))
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
MESS_A = psql("select id from messes where name='Annapurna Student Mess'")
def g(path, tok=None): return req('GET', path, token=tok or owner)[1]['data']
def csv_rows(text): return list(csv.reader(io.StringIO(text.lstrip('﻿'))))

# Fresh activity so every section has data: a student, plan, served + reversed meals, payments, expense, feedback, complaint
plan = req('POST', '/meal-plans', {'name': f'R {u}', 'price': 1000, 'breakfastIncluded': True, 'lunchIncluded': True, 'dinnerIncluded': True, 'durationType': 'MONTHS', 'durationValue': 1}, owner)[1]['data']['id']
mob = '7' + str(random.randint(100000000, 999999999))
sid = req('POST', '/students', {'firstName': f'=cmd|{u}', 'lastName': 'राजेश', 'mobile': mob, 'joiningDate': today, 'collegeName': 'Pune, "COEP"'}, owner)[1]['data']['id']
sub = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': plan, 'startDate': add(today, -2)}, owner)[1]['data']['id']
lunch = req('POST', '/attendance/manual', {'studentId': sid, 'mealType': 'lunch'}, owner)[1]['data']['attendance']['id']
din = req('POST', '/attendance/manual', {'studentId': sid, 'mealType': 'dinner'}, owner)[1]['data']['attendance']['id']
req('POST', f'/attendance/{din}/reverse', {}, owner)
p1 = req('POST', '/payments', {'studentId': sid, 'subscriptionId': sub, 'amountPaise': 40000, 'method': 'UPI'}, owner)[1]['data']['id']
p2 = req('POST', '/payments', {'studentId': sid, 'subscriptionId': sub, 'amountPaise': 10000, 'method': 'CASH'}, owner)[1]['data']['id']
req('POST', f'/payments/{p2}/reverse', {}, owner)
cats = {c['name']: c['id'] for c in g('/expense-categories')}
e1 = req('POST', '/expenses', {'categoryId': cats['Gas'], 'title': '=HYPERLINK("http://x")', 'amountPaise': 123450, 'expenseDate': today, 'vendorName': 'Kumar, "Bros"\nPune', 'note': f'n{u}'}, owner)[1]['data']['id']
e2 = req('POST', '/expenses', {'categoryId': cats['Gas'], 'title': f'oops {u}', 'amountPaise': 5000, 'expenseDate': today, 'note': f'n{u}'}, owner)[1]['data']['id']
req('POST', f'/expenses/{e2}/reverse', {}, owner)

# ── Dashboard: owner, consistency with source modules ──
s, b = req('GET', '/dashboard', token=owner)
d = b['data']
check('Dashboard 200 with all owner sections', s == 200 and all(k in d for k in ('students', 'subscriptions', 'money', 'feedback', 'complaints', 'meals', 'menu', 'actionItems')) and d['dates'] == {'today': today, 'tomorrow': add(today, 1), 'month': month}, d)
check('Meals today == /attendance/expected', d['meals']['today'] == g(f'/attendance/expected?date={today}'))
check('Meals tomorrow == /attendance/expected', d['meals']['tomorrow'] == g(f"/attendance/expected?date={add(today, 1)}"))
asum = g(f'/attendance/summary?date={today}')
check('Served excludes reversed (matches attendance summary)', all(d['meals']['today']['meals'][m]['served'] == asum[m] for m in ('breakfast', 'lunch', 'dinner')), (d['meals']['today'], asum))
ps = g('/payments/summary')
check('Money == /payments/summary', d['money']['collectedTodayPaise'] == ps['collectedTodayPaise'] and d['money']['collectedThisMonthPaise'] == ps['collectedThisMonthPaise'] and d['money']['pendingDuesPaise'] == ps['pendingDuesPaise'] and d['money']['studentsWithDues'] == ps['studentsWithDues'], (d['money'], ps))
fm = g(f'/finance/monthly-summary?month={month}')
check('Balance == /finance/monthly-summary', d['money']['balance'] == fm and d['money']['expensesThisMonthPaise'] == fm['expensesPaise'], (d['money']['balance'], fm))
check('Expenses today == /expenses/summary', d['money']['expensesTodayPaise'] == g(f'/expenses/summary?from={today}&to={today}')['totalPaise'])
fs = g(f'/feedback/summary?from={mstart}&to={today}')
check('Rating == /feedback/summary (month)', d['feedback']['monthAverage'] == fs['averages']['overall'] and d['feedback']['monthCount'] == fs['mealCount'] + fs['generalCount'], (d['feedback'], fs))
cc = g('/complaints/counts')
check('Complaints == /complaints/counts', all(d['complaints'][k] == cc[k] for k in ('OPEN', 'IN_PROGRESS', 'RESOLVED')))
day = g(f'/menus/{today}')
check('Menu status matches menu', d['menu']['status'] == ('NOT_CREATED' if not day['menu'] else 'PUBLISHED' if day['menu']['isPublished'] else 'DRAFT'))
check('Active students == DB', d['students']['active'] == int(psql(f"select count(*) from mess_students where \"messId\"='{MESS_A}' and status='ACTIVE'")))
check('Subscriptions active/upcoming/expiring == /subscriptions totals',
      d['subscriptions']['active'] == req('GET', '/subscriptions?status=ACTIVE&pageSize=1', token=owner)[1]['meta']['total']
      and d['subscriptions']['upcoming'] == req('GET', '/subscriptions?status=UPCOMING&pageSize=1', token=owner)[1]['meta']['total']
      and d['subscriptions']['expiringSoon'] == req('GET', '/subscriptions?expiringSoon=true&pageSize=1', token=owner)[1]['meta']['total'], d['subscriptions'])
check('Action items reference real screens', all(i['href'].startswith('/') and i['count'] > 0 for i in d['actionItems']) and any(i['key'] == 'STUDENTS_WITH_DUES' for i in d['actionItems']), d['actionItems'])
s, b = req('GET', '/dashboard', token=manager)
check('Manager sees financial sections', s == 200 and 'money' in b['data'] and 'feedback' in b['data'])
s, b = req('GET', '/dashboard', token=staff)
check('Staff dashboard: meals + menu only (no money/students/feedback/complaints)', s == 200 and set(b['data']) == {'dates', 'meals', 'menu', 'actionItems'} and b['data']['actionItems'] == [], list(b['data']))
check('Staff meals identical to owner meals', b['data']['meals'] == d['meals'])

# ── Reports: permissions ──
types = ['students', 'attendance', 'pauses', 'subscriptions', 'payments', 'dues', 'expenses', 'feedback', 'complaints']
check('Owner can open every report', all(req('GET', f'/reports/{t}?pageSize=1', token=owner)[0] == 200 for t in types))
check('Manager can open every report', all(req('GET', f'/reports/{t}?pageSize=1', token=manager)[0] == 200 for t in types))
staff_codes = {t: req('GET', f'/reports/{t}?pageSize=1', token=staff)[0] for t in types}
check('Staff: students/attendance/pauses/complaints only; financial + feedback blocked (view)', staff_codes == {'students': 200, 'attendance': 200, 'pauses': 200, 'subscriptions': 403, 'payments': 403, 'dues': 403, 'expenses': 403, 'feedback': 403, 'complaints': 200}, staff_codes)
check('Staff: financial exports blocked', all(req('GET', f'/reports/{t}/export', token=staff, raw=True)[0] == 403 for t in ('payments', 'dues', 'expenses', 'subscriptions')))
code, body = req('POST', '/auth/otp/request', {'mobile': '9100000001'}); stu = req('POST', '/auth/otp/verify', {'mobile': '9100000001', 'code': body['data']['devOtp']})[1]['data']['accessToken']
check('Student blocked from dashboard and all reports', req('GET', '/dashboard', token=stu)[0] == 403 and all(req('GET', f'/reports/{t}', token=stu)[0] == 403 for t in types))
check('Unauthenticated blocked', req('GET', '/reports/payments')[0] == 401 and req('GET', '/dashboard')[0] == 401)

# ── Student report ──
s, b = req('GET', f'/reports/students?search={mob}', token=owner)
r = b['data'][0] if b['data'] else {}
check('Student report row with current plan & app-linked', s == 200 and r.get('currentPlan', {}).get('name') == f'R {u}' and r['currentPlan']['status'] == 'ACTIVE' and r['appLinked'] is False, b)
check('Student report joining-date filter', req('GET', f'/reports/students?search={mob}&joinedFrom={add(today, 1)}&joinedTo={add(today, 30)}', token=owner)[1]['meta']['total'] == 0)
code, text, hdr = req('GET', f'/reports/students/export?search={mob}', token=owner, raw=True)
rows = csv_rows(text)
check('Student CSV: headers, 1 row, Unicode, formula-safe, quoted comma', code == 200 and rows[0][:3] == ['Name', 'Mobile', 'College'] and len(rows) == 2 and rows[1][0] == f"'=cmd|{u} राजेश" and rows[1][2] == 'Pune, "COEP"', rows)
check('Student CSV has no ids/secrets', not any(h.lower() in ('id', 'userid', 'password', 'token') for h in rows[0]) and sid not in text)
check('CSV headers: utf-8, attachment filename', hdr.get('Content-Type', '').startswith('text/csv') and f'students-{today}.csv' in hdr.get('Content-Disposition', ''), hdr)

# ── Attendance report ──
s, b = req('GET', f'/reports/attendance?from={today}&to={today}&search={mob}', token=owner)
check('Attendance report: reversed row visible', s == 200 and {x['status'] for x in b['data']} == {'SERVED', 'REVERSED'}, b)
check('Attendance summary excludes reversed', b['summary'] == {'breakfast': 0, 'lunch': 1, 'dinner': 0, 'total': 1}, b['summary'])
s, b = req('GET', f'/reports/attendance?from={mstart}&to={mend}', token=owner)
served_db = int(psql(f"select count(*) from meal_attendance where \"messId\"='{MESS_A}' and status='SERVED' and \"attendanceDate\" between '{mstart}' and '{mend}'"))
check('Attendance month summary == DB served count', b['summary']['total'] == served_db, (b['summary'], served_db))
check('Attendance meal filter', all(x['mealType'] == 'lunch' for x in req('GET', f'/reports/attendance?from={mstart}&to={mend}&mealType=lunch&pageSize=100', token=owner)[1]['data']))
code, text, hdr = req('GET', f'/reports/attendance/export?from={today}&to={today}&search={mob}', token=owner, raw=True)
rows = csv_rows(text)
check('Attendance CSV matches filter (2 rows, statuses readable)', code == 200 and len(rows) == 3 and {rows[1][7], rows[2][7]} == {'Served', 'Reversed'} and f'attendance-{today}.csv' in hdr['Content-Disposition'], rows)

# ── Pauses ──
req('POST', f'/students/{sid}/pauses', {'fromDate': add(today, 1), 'toDate': add(today, 1), 'mealTypes': ['lunch', 'dinner']}, owner)
s, b = req('GET', f'/reports/pauses?from={add(today, 1)}&to={add(today, 1)}&search={mob}', token=staff)
check('Pause report (staff) with summary', s == 200 and b['meta']['total'] == 2 and b['summary']['active'] == {'breakfast': 0, 'lunch': 1, 'dinner': 1}, b)

# ── Subscriptions ──
s, b = req('GET', f'/reports/subscriptions?search={mob}', token=owner)
check('Subscription report fee/paid/due from snapshot', s == 200 and b['data'][0]['payment'] == {'payablePaise': 100000, 'paidPaise': 40000, 'duePaise': 60000, 'status': 'PARTIAL'}, b)
code, text, _ = req('GET', f'/reports/subscriptions/export?search={mob}', token=owner, raw=True)
rows = csv_rows(text)
check('Subscription CSV rupee amounts', rows[1][8:11] == ['1000', '400', '600'] and rows[1][6] == 'Unlimited', rows)

# ── Payments & dues ──
s, b = req('GET', f'/reports/payments?search={mob}', token=owner)
check('Payment report: reversed visible, excluded from collected', s == 200 and b['meta']['total'] == 2 and b['summary'] == {'collectedPaise': 40000, 'recordedCount': 1, 'reversedCount': 1}, b)
s, b = req('GET', f'/reports/payments?from={mstart}&to={mend}', token=owner)
check('Payment month collected == finance collected', b['summary']['collectedPaise'] == fm['collectedPaise'], (b['summary'], fm))
code, text, hdr = req('GET', f'/reports/payments/export?from={mstart}&to={mend}', token=owner, raw=True)
check('Month export filename payments-YYYY-MM.csv', f'payments-{month}.csv' in hdr['Content-Disposition'], hdr)
s, b = req('GET', '/reports/dues', token=owner)
check('Dues totals == Sprint 7 pending dues', b['summary'] == {'duePaise': ps['pendingDuesPaise'], 'studentsOwing': ps['studentsWithDues']}, (b['summary'], ps))
sidE = req('POST', '/students', {'firstName': 'Old', 'mobile': '7' + str(random.randint(100000000, 999999999)), 'joiningDate': today}, owner)[1]['data']['id']
subE = req('POST', f'/students/{sidE}/subscriptions', {'mealPlanId': plan, 'startDate': add(today, -90)}, owner)[1]['data']['id']
s, b = req('GET', f'/reports/dues?subscriptionStatus=EXPIRED&pageSize=100&studentId={sidE}', token=owner)
check('Expired unpaid subscription appears in dues', [x['subscriptionId'] for x in b['data']] == [subE] and b['data'][0]['subscriptionStatus'] == 'EXPIRED', b)

# ── Expenses ──
s, b = req('GET', f'/reports/expenses?from={today}&to={today}&search=n{u}', token=owner)
check('Expense report: reversed visible, excluded from total', s == 200 and b['meta']['total'] == 2 and b['summary'] == {'totalPaise': 123450, 'recordedCount': 1, 'reversedCount': 1}, b)
s, b = req('GET', f'/reports/expenses?from={mstart}&to={mend}', token=owner)
check('Expense month total == finance expenses', b['summary']['totalPaise'] == fm['expensesPaise'], (b['summary'], fm))
check('Expense category filter', all(x['category']['id'] == cats['Gas'] for x in req('GET', f"/reports/expenses?from={mstart}&to={mend}&categoryId={cats['Gas']}&pageSize=100", token=owner)[1]['data']))
code, text, _ = req('GET', f'/reports/expenses/export?from={today}&to={today}&search=n{u}&status=RECORDED', token=owner, raw=True)
rows = csv_rows(text)
check('Expense CSV: formula prefixed, quotes+comma+newline preserved, amount 1234.50', rows[1][2] == "'=HYPERLINK(\"http://x\")" and rows[1][3] == 'Kumar, "Bros"\nPune' and rows[1][4] == '1234.50', rows)
check('Raw CSV quoted multiline cell', '"Kumar, ""Bros""\nPune"' in text.replace('\r\n', '\n'))

# ── Feedback ──
code, eb = req('POST', '/auth/otp/request', {'mobile': mob})
stS = req('POST', '/auth/otp/verify', {'mobile': mob, 'code': eb['data']['devOtp']})[1]['data']['accessToken']
req('POST', '/students/me/feedback/meal', {'attendanceId': lunch, 'overallRating': 2, 'comment': '-bad'}, stS)
s, b = req('GET', f'/reports/feedback?from={mstart}&to={today}', token=owner)
fs2 = g(f'/feedback/summary?from={mstart}&to={today}')
check('Feedback report averages == /feedback/summary', s == 200 and b['summary'] == fs2, (b['summary'], fs2))
code, text, _ = req('GET', f'/reports/feedback/export?from={today}&to={today}&search={mob}', token=owner, raw=True)
rows = csv_rows(text)
check('Feedback CSV: "-bad" formula-guarded, counted flag', rows[1][9] == "'-bad" and rows[1][10] == 'Yes', rows)

# ── Complaints ──
req('POST', '/students/me/complaints', {'category': 'CLEANLINESS', 'description': f'@sum dirty {u}'}, stS)
s, b = req('GET', f'/reports/complaints?search={mob}', token=staff)
check('Complaint report (staff) + filtered counts', s == 200 and b['meta']['total'] == 1 and b['summary'] == {'OPEN': 1, 'IN_PROGRESS': 0, 'RESOLVED': 0}, b)
code, text, _ = req('GET', f'/reports/complaints/export?search={mob}', token=owner, raw=True)
check('Complaint CSV: no file paths/ids, formula-guarded description', 'uploads' not in text and "'@sum dirty" in text and 'attachmentId' not in text, text[:300])

# ── Limits & validation ──
check('Range > 366 days -> REPORT_RANGE_TOO_LARGE', req('GET', f'/reports/payments?from=2024-01-01&to={today}', token=owner)[1]['error']['code'] == 'REPORT_RANGE_TOO_LARGE')
check('to < from rejected', req('GET', f'/reports/expenses?from={today}&to={add(today, -1)}', token=owner)[0] == 400)
check('Unknown filter rejected', req('GET', '/reports/students?messId=x', token=owner)[0] == 400)
psql(f"""insert into expenses (id, "messId", "categoryId", title, "amountPaise", "expenseDate", "updatedAt")
select gen_random_uuid(), '{MESS_A}', '{cats['Other']}', 'bulk '||g, 100, '2021-06-15', now() from generate_series(1, 10001) g""")
code, b, _ = req('GET', '/reports/expenses/export?from=2021-06-01&to=2021-06-30', token=owner, raw=True)
check('Export > 10,000 rows -> EXPORT_TOO_LARGE', code == 400 and b['error']['code'] == 'EXPORT_TOO_LARGE', (code, b))
code, text, _ = req('GET', '/reports/expenses/export?from=2021-06-01&to=2021-06-30&search=bulk%2010001', token=owner, raw=True)
check('Export under the limit works for the same data', code == 200 and len(csv_rows(text)) == 2)
psql(f"delete from expenses where \"messId\"='{MESS_A}' and \"expenseDate\"='2021-06-15' and title like 'bulk %'")

# ── Tenant isolation ──
mB = '7' + str(random.randint(100000000, 999999999))
sidB = req('POST', '/students', {'firstName': 'Bonly', 'mobile': mB, 'joiningDate': today}, ownerB)[1]['data']['id']
check('Mess A student report never shows Mess B student', req('GET', f'/reports/students?search={mB}', token=owner)[1]['meta']['total'] == 0)
code, text, _ = req('GET', f'/reports/students/export?search={mB}', token=owner, raw=True)
check('Mess A export never contains Mess B rows', code == 200 and len(csv_rows(text)) == 1)
check('Filtering by Mess B student id returns nothing', req('GET', f'/reports/dues?studentId={sidB}', token=owner)[1]['meta']['total'] == 0)
dB = req('GET', '/dashboard', token=ownerB)[1]['data']
check('Mess B dashboard independent of Mess A', dB['students']['active'] == int(psql("select count(*) from mess_students s join messes m on m.id=s.\"messId\" where m.name='Sai Tiffin Service' and s.status='ACTIVE'")))
print(f"\n{sum(results)}/{len(results)} checks passed")
