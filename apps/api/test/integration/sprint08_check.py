import json, subprocess, urllib.request, datetime, random
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
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')
u = str(random.randint(10000, 99999))

s, b = req('GET', '/expense-categories', token=owner)
cats = {c['name']: c['id'] for c in b['data']}
check('Default categories created on first use', s == 200 and {'Vegetables', 'Gas', 'Groceries', 'Salary', 'Other'} <= set(cats), b)
veg, gas, groc = cats['Vegetables'], cats['Gas'], cats['Groceries']
def expense(cat, paise, date=None, tok=None, **extra):
    return req('POST', '/expenses', {'categoryId': cat, 'title': f'Test {u}', 'amountPaise': paise, 'expenseDate': date or today, **extra}, tok or owner)
def summ(frm, to=None, tok=None): return req('GET', f'/expenses/summary?from={frm}&to={to or frm}', token=tok or owner)[1]['data']

# Flow A — add
day0, month0 = summ(today), req('GET', f'/expenses/monthly/summary?month={today[:7]}', token=owner)[1]['data']
s, b = expense(veg, 250000, vendorName='Ramesh Sabji', paymentMethod='UPI', referenceNumber='UTR9', note='weekly veg')
check('A add ₹2,500 Vegetables', s == 201 and b['data']['amountPaise'] == 250000 and b['data']['category']['name'] == 'Vegetables' and b['data']['status'] == 'RECORDED' and b['data']['recordedBy'], (s, b))
eA = b['data']['id']
s, b = req('GET', f'/expenses?search=Ramesh&from={today}&to={today}', token=owner)
check('A appears in list (search vendor)', any(x['id'] == eA for x in b['data']), b)
day1 = summ(today)
check('A daily total +₹2,500', day1['totalPaise'] == day0['totalPaise'] + 250000 and day1['count'] == day0['count'] + 1, (day0, day1))
# Flow B — edit
s, b = req('PATCH', f'/expenses/{eA}', {'amountPaise': 270000}, manager)
check('B manager edits to ₹2,700 (other fields kept)', s == 200 and b['data']['amountPaise'] == 270000 and b['data']['vendorName'] == 'Ramesh Sabji' and b['data']['recordedBy'] and b['data']['paymentMethod'] == 'UPI', (s, b))
check('B daily total reflects edit', summ(today)['totalPaise'] == day0['totalPaise'] + 270000)
# Flow C — backdated
y = add(today, -1)
yd0 = summ(y)
s, b = expense(gas, 110000, date=y)
check('C yesterday gas accepted', s == 201 and b['data']['expenseDate'] == y, (s, b))
check('C under yesterday; today unaffected', summ(y)['totalPaise'] == yd0['totalPaise'] + 110000 and summ(today)['totalPaise'] == day0['totalPaise'] + 270000)
if y[:7] == today[:7]:
    m1 = req('GET', f'/expenses/monthly/summary?month={today[:7]}', token=owner)[1]['data']
    check('C monthly includes both', m1['totalPaise'] == month0['totalPaise'] + 270000 + 110000, (month0['totalPaise'], m1['totalPaise']))
# Flow D — future
n = psql("select count(*) from expenses")
s, b = expense(veg, 1000, date=add(today, 1))
check('D future date rejected, no row', s == 400 and b['error']['code'] == 'EXPENSE_DATE_INVALID' and psql("select count(*) from expenses") == n, (s, b))
s, b = req('PATCH', f'/expenses/{eA}', {'expenseDate': add(today, 1)}, owner)
check('D edit to future rejected', s == 400)
# Validation
for bad, label in ((0, 'zero'), (-5, 'negative'), (12.5, 'fractional paise'), (100_000_001, 'too large')):
    s, b = expense(veg, bad)
    check(f'Invalid amount ({label}) -> 400', s == 400 and 'amountPaise' in b['error']['fields'], (s, b))
s, b = req('POST', '/expenses', {'categoryId': veg, 'title': '  ', 'amountPaise': 100, 'expenseDate': today}, owner)
check('Blank title rejected', s == 400 and 'title' in b['error']['fields'])
s, b = expense(veg, 100, paymentMethod='CHEQUE')
check('Invalid payment method rejected', s == 400)

# Flow E/G — reversal arithmetic & monthly breakdown in an isolated past month
month = f"{2020 + random.randint(0, 4)}-{random.randint(1, 12):02d}"
mid = psql("select id from messes where name='Annapurna Student Mess'")
psql(f"delete from expenses where \"messId\"='{mid}' and to_char(\"expenseDate\", 'YYYY-MM')='{month}'")
d1 = f'{month}-05'
ids = [expense(c, p, date=d1)[1]['data']['id'] for c, p in ((groc, 100000), (veg, 50000), (gas, 30000))]
ms = req('GET', f'/expenses/monthly/summary?month={month}', token=owner)[1]['data']
check('G monthly total ₹1,800 = sum of breakdown', ms['totalPaise'] == 180000 and sum(c['totalPaise'] for c in ms['categories']) == 180000 and ms['count'] == 3 and ms['daily'] == [{'date': d1, 'totalPaise': 180000}], ms)
check('G breakdown sorted by amount', [c['name'] for c in ms['categories']] == ['Groceries', 'Vegetables', 'Gas'], ms['categories'])
s, b = req('POST', f'/expenses/{ids[1]}/reverse', {'reason': 'Entered twice'}, owner)
check('E reverse ₹500', s == 200 and b['data']['status'] == 'REVERSED' and b['data']['reversedBy'] and b['data']['reversalReason'] == 'Entered twice', (s, b))
ms = req('GET', f'/expenses/monthly/summary?month={month}', token=owner)[1]['data']
check('E total ₹1,300, reversed excluded from breakdown', ms['totalPaise'] == 130000 and ms['count'] == 2 and all(c['categoryId'] != veg for c in ms['categories']), ms)
s, b = req('GET', f'/expenses?from={month}-01&to={month}-28&pageSize=50', token=owner)
check('E reversed row still in history', len(b['data']) == 3 and sum(x['status'] == 'REVERSED' for x in b['data']) == 1, b)
s, b = req('GET', f'/expenses?from={month}-01&to={month}-28&status=REVERSED', token=owner)
check('Status filter REVERSED', [x['id'] for x in b['data']] == [ids[1]], b)
s, b = req('POST', f'/expenses/{ids[1]}/reverse', {}, owner)
check('Reverse twice -> EXPENSE_ALREADY_REVERSED', s == 409 and b['error']['code'] == 'EXPENSE_ALREADY_REVERSED', (s, b))
s, b = req('PATCH', f'/expenses/{ids[1]}', {'amountPaise': 1}, owner)
check('Edit reversed -> 409', s == 409, (s, b))
s, b = req('GET', f'/expenses?from={month}-01&to={month}-28&categoryId={groc}', token=owner)
check('Category filter', [x['id'] for x in b['data']] == [ids[0]], b)
s, b = req('GET', f'/expenses?from={month}-01&to={month}-28&sortBy=amount&sortOrder=asc', token=owner)
check('Amount sort', [x['amountPaise'] for x in b['data']] == [30000, 50000, 100000], b)

# Flow F — custom category
s, b = req('POST', '/expense-categories', {'name': f'Water Supply {u}'}, manager)
water = b['data']['id']
check('F manager adds custom category', s == 201 and b['data']['isActive'], (s, b))
s, b = req('POST', '/expense-categories', {'name': f'  water supply {u}  '.upper()}, owner)
check('F duplicate name (case-insensitive) -> EXPENSE_CATEGORY_EXISTS', s == 409 and b['error']['code'] == 'EXPENSE_CATEGORY_EXISTS', (s, b))
s, b = expense(water, 40000)
check('F expense with custom category', s == 201 and b['data']['category']['name'] == f'Water Supply {u}', b)
eW = b['data']['id']
s, b = req('PATCH', f'/expense-categories/{water}', {'isActive': False}, owner)
check('F deactivate category (not deleted)', s == 200 and not b['data']['isActive'] and b['data']['expenseCount'] == 1, (s, b))
s, b = expense(water, 100)
check('F inactive category rejected for new expense', s == 409 and b['error']['code'] == 'EXPENSE_CATEGORY_INACTIVE', (s, b))
s, b = req('PATCH', f'/expenses/{eW}', {'title': 'Water tanker', 'categoryId': water}, owner)
check('F existing expense in inactive category still editable', s == 200 and b['data']['title'] == 'Water tanker', (s, b))
s, b = req('GET', '/expense-categories', token=owner)
check('F inactive hidden by default', water not in [c['id'] for c in b['data']])
s, b = req('GET', '/expense-categories?includeInactive=true', token=owner)
check('F inactive listed with includeInactive', water in [c['id'] for c in b['data']])
s, b = req('PATCH', f'/expense-categories/{water}', {'name': 'Vegetables'}, owner)
check('Rename to existing name -> conflict', s == 409, (s, b))

# Flow H — revenue vs expense (delta-based, in a month within the payment backdate window)
fmonth = add(today, -40)[:7]
f0 = req('GET', f'/finance/monthly-summary?month={fmonth}', token=owner)[1]['data']
plan = req('POST', '/meal-plans', {'name': f'Big {u}', 'price': 60000, 'lunchIncluded': True, 'dinnerIncluded': True, 'durationType': 'MONTHS', 'durationValue': 1}, owner)[1]['data']['id']
sid = req('POST', '/students', {'firstName': 'Fin', 'mobile': '7' + str(random.randint(100000000, 999999999)), 'joiningDate': today}, owner)[1]['data']['id']
sub = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': plan, 'startDate': today}, owner)[1]['data']['id']
pdate = f'{fmonth}-15'
pay = lambda paise: req('POST', '/payments', {'studentId': sid, 'subscriptionId': sub, 'amountPaise': paise, 'method': 'CASH', 'paymentDate': pdate}, owner)[1]['data']
pay(5000000); p2 = pay(500000)
req('POST', f"/payments/{p2['id']}/reverse", {}, owner)
expense(groc, 3000000, date=pdate)
rev = expense(veg, 200000, date=pdate)[1]['data']['id']
req('POST', f'/expenses/{rev}/reverse', {}, owner)
f1 = req('GET', f'/finance/monthly-summary?month={fmonth}', token=owner)[1]['data']
check('H revenue +₹50,000 (reversed payment excluded)', f1['collectedPaise'] - f0['collectedPaise'] == 5000000, (f0, f1))
check('H expenses +₹30,000 (reversed expense excluded)', f1['expensesPaise'] - f0['expensesPaise'] == 3000000, (f0, f1))
check('H net = collected − expenses', f1['netPaise'] == f1['collectedPaise'] - f1['expensesPaise'])
check('H pending dues separate (not revenue)', f1['pendingDuesPaise'] > 0 and f1['collectedPaise'] - f0['collectedPaise'] == 5000000)

# Flow I — tenant isolation
s, b = req('GET', '/expense-categories', token=ownerB)
catsB = {c['name']: c['id'] for c in b['data']}
check('Each mess has its own "Vegetables"', catsB['Vegetables'] != veg)
s, b = expense(catsB['Vegetables'], 100, tok=owner)
check('I Mess A cannot use Mess B category -> 404', s == 404 and b['error']['code'] == 'EXPENSE_CATEGORY_NOT_FOUND', (s, b))
eB = expense(catsB['Vegetables'], 99900, tok=ownerB)[1]['data']['id']
check('I Mess A get Mess B expense -> 404', req('GET', f'/expenses/{eB}', token=owner)[0] == 404)
check('I Mess A edit Mess B expense -> 404', req('PATCH', f'/expenses/{eB}', {'amountPaise': 1}, owner)[0] == 404)
s, b = req('POST', f'/expenses/{eB}/reverse', {}, owner)
check('I Mess A reverse Mess B -> 404, untouched', s == 404 and psql(f"select status::text||\"amountPaise\"::text from expenses where id='{eB}'") == 'RECORDED99900', (s, b))
check('I Mess A category patch Mess B -> 404', req('PATCH', f"/expense-categories/{catsB['Gas']}", {'isActive': False}, owner)[0] == 404)
s, b = req('GET', f'/expenses?from={today}&to={today}&pageSize=100', token=owner)
check('I Mess A list excludes Mess B', not any(x['id'] == eB for x in b['data']))
check('I Mess A summary excludes Mess B', summ(today)['totalPaise'] == day0['totalPaise'] + 270000 + 40000)
check('Malformed id -> 404', req('GET', '/expenses/abc', token=owner)[0] == 404)

# Flow J — permissions
for name, (m, p, body) in {'list': ('GET', '/expenses', None), 'summary': ('GET', f'/expenses/summary?from={today}&to={today}', None), 'categories': ('GET', '/expense-categories', None), 'create': ('POST', '/expenses', {'categoryId': veg, 'title': 'x', 'amountPaise': 1, 'expenseDate': today}), 'finance': ('GET', f'/finance/monthly-summary?month={today[:7]}', None)}.items():
    check(f'J staff blocked from {name}', req(m, p, body, staff)[0] == 403)
stu = otp_login('9100000001')
check('J student blocked', req('GET', '/expenses', token=stu)[0] == 403 and req('GET', f'/finance/monthly-summary?month={today[:7]}', token=stu)[0] == 403)
check('J unauthenticated blocked', req('GET', '/expenses')[0] == 401)
check('Range > 366 days rejected', req('GET', f'/expenses/summary?from=2020-01-01&to={today}', token=owner)[0] == 400)
check('Bad month rejected', req('GET', '/finance/monthly-summary?month=2026-1', token=owner)[0] == 400)
print(f"\n{sum(results)}/{len(results)} checks passed")
