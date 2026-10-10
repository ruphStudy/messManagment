import json, subprocess, urllib.request, datetime, random, uuid, concurrent.futures, re
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
today = subprocess.run(['node', '-e', "console.log(require('./packages/shared/dist').businessToday())"], capture_output=True, text=True).stdout.strip()
def add(d, n): return (datetime.date.fromisoformat(d) + datetime.timedelta(days=n)).isoformat()
mob = lambda: '7' + str(random.randint(100000000, 999999999))
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
u = str(random.randint(10000, 99999))
P2000 = req('POST', '/meal-plans', {'name': f'Fee2000 {u}', 'price': 2000, 'lunchIncluded': True, 'dinnerIncluded': True, 'durationType': 'MONTHS', 'durationValue': 1, 'mealCredits': 10}, owner)[1]['data']['id']
def student(tok=None, start=None):
    m = mob()
    sid = req('POST', '/students', {'firstName': 'Pay', 'lastName': u, 'mobile': m, 'joiningDate': today}, tok or owner)[1]['data']['id']
    sub = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': P2000, 'startDate': start or today}, tok or owner)[1]['data']
    return sid, m, sub
def pay(sid, sub, paise, method='CASH', tok=None, **extra):
    return req('POST', '/payments', {'studentId': sid, 'subscriptionId': sub, 'amountPaise': paise, 'method': method, **extra}, tok or owner)
def sub_payment(sub_id, tok=None): return req('GET', f'/subscriptions/{sub_id}', token=tok or owner)[1]['data']['payment']
credits = lambda sub_id: psql(f"select \"remainingMealCredits\"||'/'||\"endDate\" from student_subscriptions where id='{sub_id}'")

# Subscription carries payment summary
sidA, mA, subA = student()
check('New subscription shows UNPAID ₹2,000 due', subA['payment'] == {'payablePaise': 200000, 'paidPaise': 0, 'duePaise': 200000, 'status': 'UNPAID'}, subA.get('payment'))
before_credits = credits(subA['id'])
# Flow A — full cash
s, b = pay(sidA, subA['id'], 200000, 'CASH')
check('A record ₹2,000 cash', s == 201 and b['data']['amountPaise'] == 200000 and b['data']['balanceAfterPaise'] == 0 and b['data']['referenceNumber'] is None and re.match(r'^RCPT-\d{4}-\d{6}$', b['data']['receiptNumber']), (s, b))
check('A due 0, PAID', sub_payment(subA['id']) == {'payablePaise': 200000, 'paidPaise': 200000, 'duePaise': 0, 'status': 'PAID'})
s, b = pay(sidA, subA['id'], 100)
check('A further payment -> NO_OUTSTANDING_BALANCE', s == 409 and b['error']['code'] == 'NO_OUTSTANDING_BALANCE', (s, b))
check('A payment does not change credits/dates', credits(subA['id']) == before_credits)
stA = otp_login(mA)
s, b = req('GET', '/students/me/payments', token=stA)
check('A student sees payment', s == 200 and b['meta']['total'] == 1 and b['data'][0]['amountPaise'] == 200000, b)
s, b = req('GET', '/students/me/fees', token=stA)
check('A student fees: due 0, PAID', b['data']['totalDuePaise'] == 0 and b['data']['subscriptions'][0]['payment']['status'] == 'PAID', b)

# Flow B — partial UPI
sidB, mB, subB = student()
s1, b1 = pay(sidB, subB['id'], 100000, 'UPI', referenceNumber='UTR123456')
check('B ₹1,000 UPI with UTR -> due ₹1,000', s1 == 201 and b1['data']['referenceNumber'] == 'UTR123456' and sub_payment(subB['id'])['duePaise'] == 100000, b1)
s2, b2 = pay(sidB, subB['id'], 50000, 'UPI')
p = sub_payment(subB['id'])
check('B + ₹500 -> paid ₹1,500, due ₹500, PARTIAL', p == {'payablePaise': 200000, 'paidPaise': 150000, 'duePaise': 50000, 'status': 'PARTIAL'}, p)
check('B earlier payment unchanged', req('GET', f"/payments/{b1['data']['id']}", token=owner)[1]['data']['balanceAfterPaise'] == 100000)
# Flow C — overpayment
n_before = psql(f"select count(*) from payments where \"subscriptionId\"='{subB['id']}'")
s, b = pay(sidB, subB['id'], 60000)
check('C ₹600 on ₹500 due -> PAYMENT_EXCEEDS_BALANCE', s == 409 and b['error']['code'] == 'PAYMENT_EXCEEDS_BALANCE' and '₹500' in b['error']['message'], (s, b))
check('C no payment created', psql(f"select count(*) from payments where \"subscriptionId\"='{subB['id']}'") == n_before)
for bad, label in ((0, 'zero'), (-100, 'negative'), (10.5, 'fractional paise')):
    s, b = pay(sidB, subB['id'], bad)
    check(f'Invalid amount ({label}) -> 400', s == 400 and 'amountPaise' in b['error']['fields'], (s, b))
s, b = pay(sidB, subB['id'], 100, 'CHEQUE')
check('Invalid method -> 400', s == 400)
s, b = pay(sidB, subB['id'], 100, paymentDate=add(today, 1))
check('Future payment date -> 400', s == 400 and 'paymentDate' in b['error']['fields'], (s, b))
s, b = pay(sidB, subB['id'], 100, paymentDate=add(today, -3))
check('Backdated payment allowed', s == 201 and b['data']['paymentDate'] == add(today, -3), (s, b))
back_id = b['data']['id']

# Flow D — reversal (Prompt 41 example)
s, b = req('POST', f"/payments/{b2['data']['id']}/reverse", {'reason': 'Entered twice'}, manager)
check('D manager reverses ₹500 payment', s == 200 and b['data']['status'] == 'REVERSED' and b['data']['reversedBy'] and b['data']['reversalReason'] == 'Entered twice', (s, b))
check('D paid ₹1,001 → after reversal paid = 1000+1, due recalculated', sub_payment(subB['id'])['paidPaise'] == 100100 and sub_payment(subB['id'])['duePaise'] == 99900)
s, b = req('POST', f"/payments/{b2['data']['id']}/reverse", {}, owner)
check('D reverse twice -> PAYMENT_ALREADY_REVERSED', s == 409 and b['error']['code'] == 'PAYMENT_ALREADY_REVERSED', (s, b))
check('D original row kept', psql(f"select status from payments where id='{b2['data']['id']}'") == 'REVERSED')
s, b = req('POST', f"/payments/{back_id}/reverse", {}, staff)
check('Staff cannot reverse', s == 403)
stB = otp_login(mB)
s, b = req('GET', '/students/me/payments', token=stB)
check('D student history marks reversed', any(x['status'] == 'REVERSED' for x in b['data']) and b['meta']['total'] == 3, b)
s, b = req('GET', f"/students/me/payments/{b1['data']['id']}", token=stB)
check('Student receipt view (own)', s == 200 and b['data']['receiptNumber'] == b1['data']['receiptNumber'] and b['data']['mess']['name'] == 'Annapurna Student Mess' and b['data']['currentDuePaise'] == 99900, (s, b))

# Flow E — expired subscription with balance
sidE, _, subE = student(start=add(today, -60))
check('E expired sub', subE['status'] == 'EXPIRED')
s, b = pay(sidE, subE['id'], 50000)
check('E payment on expired accepted', s == 201 and sub_payment(subE['id'])['duePaise'] == 150000, (s, b))
# Cancelled
sidX, _, subX = student(start=add(today, 10))
req('POST', f"/subscriptions/{subX['id']}/cancel", token=owner)
s, b = pay(sidX, subX['id'], 1000)
check('Cancelled subscription -> SUBSCRIPTION_CANCELLED', s == 409 and b['error']['code'] == 'SUBSCRIPTION_CANCELLED', (s, b))

# Flow F/G — upcoming renewal + choice
sidF, _, subF = student()
renewal = req('POST', f"/subscriptions/{subF['id']}/renew", {}, owner)[1]['data']
s, b = pay(sidF, renewal['id'], 200000, 'UPI')
check('F advance payment on upcoming renewal', s == 201 and sub_payment(renewal['id'])['status'] == 'PAID' and sub_payment(subF['id'])['status'] == 'UNPAID', (s, b))
s, b = req('GET', f'/payments/dues?studentId={sidF}', token=owner)
check('G dues list shows only the unpaid current sub', s == 200 and [x['subscriptionId'] for x in b['data']] == [subF['id']] and b['data'][0]['payment']['duePaise'] == 200000, b)
s, b = pay(sidF, subA['id'], 100)
check('Subscription must belong to the student -> 404', s == 404 and b['error']['code'] == 'SUBSCRIPTION_NOT_FOUND', (s, b))

# Lists / filters
s, b = req('GET', f'/payments?studentId={sidB}&status=RECORDED', token=staff)
check('Staff can view; status filter', s == 200 and all(x['status'] == 'RECORDED' for x in b['data']) and b['meta']['total'] == 2, b)
s, b = req('GET', f'/payments?method=UPI&search={mB}', token=owner)
check('Method + search filter', b['data'] and all(x['method'] == 'UPI' and x['student']['id'] == sidB for x in b['data']), b)
s, b = req('GET', f'/payments?from={today}&to={today}&sortBy=amount&sortOrder=desc&pageSize=100', token=owner)
check('Date range + amount sort', all(x['paymentDate'] == today for x in b['data']) and [x['amountPaise'] for x in b['data']] == sorted([x['amountPaise'] for x in b['data']], reverse=True), b)
s, b = pay(sidB, subB['id'], 100, tok=staff)
check('Staff cannot record', s == 403)
s, b = req('GET', f"/payments/{b1['data']['id']}/receipt", token=owner)
check('Owner receipt', s == 200 and b['data']['student']['id'] == sidB and b['data']['recordedBy'] and b['data']['generatedAt'], b)

# Monthly status + dashboard
month = today[:7]
s, b = req('GET', f'/payments/monthly/summary?month={month}', token=owner)
m = b['data']
check('Monthly summary arithmetic', s == 200 and m['pendingPaise'] == m['expectedPaise'] - m['collectedPaise'] and m['counts']['PAID'] >= 1 and m['counts']['PARTIAL'] >= 1, m)
s, b = req('GET', f'/payments/monthly?month={month}&paymentStatus=PARTIAL&pageSize=100', token=owner)
check('Monthly list filter PARTIAL', s == 200 and all(x['payment']['status'] == 'PARTIAL' for x in b['data']) and any(x['subscriptionId'] == subB['id'] for x in b['data']), b)
check('Monthly bad month -> 400', req('GET', '/payments/monthly/summary?month=2026-13', token=owner)[0] == 400)
s, b = req('GET', '/payments/summary', token=owner)
d = b['data']
expect_today = int(psql(f"select coalesce(sum(\"amountPaise\"),0) from payments p join messes m on m.id=p.\"messId\" where m.name='Annapurna Student Mess' and p.status='RECORDED' and p.\"paymentDate\"='{today}'"))
check('Dashboard: collected today matches DB, pending > 0', d['collectedTodayPaise'] == expect_today and d['pendingDuesPaise'] > 0 and d['studentsWithDues'] >= 1 and d['collectedThisMonthPaise'] >= d['collectedTodayPaise'], (d, expect_today))

# Idempotency + concurrency
sidI, _, subI = student()
key = str(uuid.uuid4())
with concurrent.futures.ThreadPoolExecutor(6) as ex:
    outs = list(ex.map(lambda _: pay(sidI, subI['id'], 50000, idempotencyKey=key), range(6)))
ids = {o[1]['data']['id'] for o in outs if o[0] == 201}
check('Idempotent double-submit (6 parallel, same key) -> one payment', len(ids) == 1 and psql(f"select count(*) from payments where \"subscriptionId\"='{subI['id']}'") == '1' and sub_payment(subI['id'])['paidPaise'] == 50000, [o[0] for o in outs])
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    outs = list(ex.map(lambda _: pay(sidI, subI['id'], 100000), range(8)))
codes = sorted(o[0] for o in outs)
check('Parallel ₹1,000 payments on ₹1,500 due -> exactly one succeeds, never overpaid', codes.count(201) == 1 and sub_payment(subI['id'])['paidPaise'] == 150000, codes)
seqs = psql("select count(*) - count(distinct (\"messId\", \"receiptNumber\")) from payments")
check('Receipt numbers unique per mess', seqs == '0')
check('Stored paid totals reconcile with payment rows (all subscriptions)', psql('select count(*) from student_subscriptions s where s."amountPaidPaise" <> coalesce((select sum("amountPaise") from payments p where p."subscriptionId"=s.id and p.status=\'RECORDED\'),0)') == '0')

# Flow H — tenant isolation
sidHB, _, _ = student(ownerB) if False else (None, None, None)
mB2 = mob()
sidB2 = req('POST', '/students', {'firstName': 'Other', 'mobile': mB2, 'joiningDate': today}, ownerB)[1]['data']['id']
planB = req('POST', '/meal-plans', {'name': f'B {u}', 'price': 1000, 'lunchIncluded': True, 'dinnerIncluded': False, 'durationType': 'MONTHS', 'durationValue': 1}, ownerB)[1]['data']['id']
subB2 = req('POST', f'/students/{sidB2}/subscriptions', {'mealPlanId': planB, 'startDate': today}, ownerB)[1]['data']['id']
s, b = pay(sidB2, subB2, 100, tok=owner)
check('H Mess A record for Mess B subscription -> 404', s == 404, (s, b))
s, b = pay(sidB2, subB2, 100, tok=ownerB)
payB = b['data']['id']
check('H Mess B receipt sequence independent', b['data']['receiptNumber'].startswith('RCPT-'))
check('H Mess A get Mess B payment -> 404', req('GET', f'/payments/{payB}', token=owner)[0] == 404)
check('H Mess A receipt Mess B -> 404', req('GET', f'/payments/{payB}/receipt', token=owner)[0] == 404)
s, b = req('POST', f'/payments/{payB}/reverse', {}, owner)
check('H Mess A reverse Mess B -> 404, untouched', s == 404 and psql(f"select status from payments where id='{payB}'") == 'RECORDED', (s, b))
s, b = req('GET', f'/payments?pageSize=100&from={today}', token=owner)
check('H Mess A list excludes Mess B', not any(x['id'] == payB for x in b['data']))
s, b = req('GET', f'/payments/dues?studentId={sidB2}', token=owner)
check('H Mess A dues excludes Mess B', b['data'] == [])
check('Malformed id -> 404', req('GET', '/payments/xyz', token=owner)[0] == 404)

# Flow I — student security
s, b = req('GET', f"/students/me/payments/{b1['data']['id']}", token=stA)
check("I student can't open another student's receipt -> 404", s == 404 and b['error']['code'] == 'PAYMENT_NOT_FOUND', (s, b))
for name, (mth, path, body) in {'list': ('GET', '/payments', None), 'record': ('POST', '/payments', {'studentId': sidA, 'subscriptionId': subA['id'], 'amountPaise': 1, 'method': 'CASH'}), 'reverse': ('POST', f"/payments/{b1['data']['id']}/reverse", {}), 'dues': ('GET', '/payments/dues', None)}.items():
    check(f'I student blocked from {name}', req(mth, path, body, stA)[0] == 403)
check('Unauthenticated blocked', req('GET', '/payments')[0] == 401)
print(f"\n{sum(results)}/{len(results)} checks passed")
