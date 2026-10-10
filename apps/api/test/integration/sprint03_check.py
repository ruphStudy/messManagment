import json, subprocess, sys, urllib.request, uuid, datetime
sys.path.insert(0, './packages/shared')
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
        with urllib.request.urlopen(r) as res:
            t = res.read().decode(); return res.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or 'null')
def check(name, cond, info=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {info}'))
def login(i):
    return req('POST', '/auth/login', {'identifier': i, 'password': 'Password123'})[1]['data']['accessToken']
def otp_login(m):
    code = req('POST', '/auth/otp/request', {'mobile': m})[1]['data']['devOtp']
    return req('POST', '/auth/otp/verify', {'mobile': m, 'code': code}, mobile=True)[1]['data']['accessToken']
def psql(sql):
    return subprocess.run(['psql', '-tA', 'mess_management', '-c', sql], capture_output=True, text=True).stdout.strip()
def node(expr):
    return subprocess.run(['node', '-e', f"const s=require('./packages/shared/dist');console.log({expr})"], capture_output=True, text=True).stdout.strip()

today = node('s.businessToday()')
def add(d, n): return (datetime.date.fromisoformat(d) + datetime.timedelta(days=n)).isoformat()
u = str(uuid.uuid4().int)[:5]
owner, manager, staff, ownerB = login('9000000001'), login('9000000002'), login('9000000003'), login('9000000011')

def new_student(tok, first='S', mobile=None):
    mobile = mobile or ('8' + str(uuid.uuid4().int)[:9])
    s, b = req('POST', '/students', {'firstName': first, 'mobile': mobile, 'joiningDate': today}, tok)
    return b['data']['id'], mobile

# Flow A — plans
plan = lambda name, l, d, extra={}: {'name': name, 'price': 1800.5, 'lunchIncluded': l, 'dinnerIncluded': d, 'durationType': 'MONTHS', 'durationValue': 1, **extra}
s, lo = req('POST', '/meal-plans', plan(f'Lunch {u}', True, False), owner)
check('A create Lunch Only', s == 201 and lo['data']['lunchIncluded'] and not lo['data']['dinnerIncluded'] and lo['data']['price'] == 1800.5 and lo['data']['mealCredits'] is None, (s, lo))
s, do = req('POST', '/meal-plans', plan(f'Dinner {u}', False, True), manager)
check('A manager creates Dinner Only', s == 201, (s, do))
s, ld = req('POST', '/meal-plans', plan(f'LD {u}', True, True, {'durationType': 'DAYS', 'durationValue': 30}), owner)
check('A create Lunch + Dinner (30 days)', s == 201, (s, ld))
lo, do, ld = lo['data'], do['data'], ld['data']
s, b = req('POST', '/meal-plans', plan(f'lunch {u}'.upper(), True, False), owner)
check('A duplicate active name (case-insensitive) -> PLAN_NAME_TAKEN', s == 409 and b['error']['code'] == 'PLAN_NAME_TAKEN', (s, b))
s, b = req('POST', '/meal-plans', {'name': '', 'price': -1, 'lunchIncluded': False, 'dinnerIncluded': False, 'durationType': 'MONTHS', 'durationValue': 13, 'mealCredits': 0}, owner)
check('A validation (name, price, credits)', s == 400 and {'name', 'price', 'mealCredits'} <= set(b['error']['fields']), (s, b))
s, b = req('POST', '/meal-plans', {'name': f'X{u}', 'price': 1, 'lunchIncluded': False, 'dinnerIncluded': False, 'durationType': 'MONTHS', 'durationValue': 13}, owner)
check('A rules: no meal + >12 months', s == 400 and {'meals', 'durationValue'} <= set(b['error']['fields']), (s, b))
s, b = req('POST', '/meal-plans', plan(f'Y{u}', True, False, {'price': 10.555}), owner)
check('A price max 2 decimals', s == 400 and 'price' in b['error']['fields'], (s, b))
s, b = req('POST', '/meal-plans', plan(f'Z{u}', True, False), staff)
check('A staff cannot create plan', s == 403)
s, b = req('GET', '/meal-plans', token=staff)
check('A staff can view plans', s == 200 and any(p['id'] == lo['id'] for p in b['data']))

sid, smob = new_student(owner, 'Flow')
s, sub = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': lo['id'], 'startDate': today}, owner)
check('B assign: dates computed', s == 201 and sub['data']['startDate'] == today and sub['data']['endDate'] == node(f"s.calculateEndDate('{today}','MONTHS',1)") and sub['data']['status'] == 'ACTIVE' and sub['data']['daysRemaining'] >= 28, (s, sub))
sub = sub['data']
s, b = req('PATCH', f"/meal-plans/{lo['id']}", {'name': f'Lunch Renamed {u}', 'price': 2000}, owner)
check('A edit plan (name/price) keeps omitted fields', s == 200 and b['data']['price'] == 2000 and b['data']['mealCredits'] is None and b['data']['lunchIncluded'] and b['data']['currentSubscriptionCount'] == 1, (s, b))
s, b = req('GET', f"/subscriptions/{sub['id']}", token=owner)
check('A snapshot preserved after plan edit', b['data']['plan']['name'] == f'Lunch {u}' and b['data']['plan']['price'] == 1800.5 and b['data']['mealPlan']['name'] == f'Lunch Renamed {u}', b)
s, b = req('PATCH', f"/meal-plans/{lo['id']}/status", {'status': 'INACTIVE'}, owner)
check('A deactivate plan', s == 200 and b['data']['status'] == 'INACTIVE')
s, b = req('GET', f"/subscriptions/{sub['id']}", token=owner)
check('A existing subscription still active after deactivation', b['data']['status'] == 'ACTIVE')
sid2, _ = new_student(owner, 'Two')
s, b = req('POST', f'/students/{sid2}/subscriptions', {'mealPlanId': lo['id'], 'startDate': today}, owner)
check('A inactive plan cannot be assigned', s == 409 and b['error']['code'] == 'PLAN_INACTIVE', (s, b))
s, b = req('GET', '/meal-plans?status=INACTIVE', token=owner)
check('A inactive filter lists it', any(p['id'] == lo['id'] for p in b['data']))

# Flow B — overlap / one active
s, b = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': do['id'], 'startDate': add(today, 5)}, owner)
check('B overlapping assignment rejected', s == 409 and b['error']['code'] == 'SUBSCRIPTION_OVERLAP', (s, b))
s, b = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': do['id'], 'startDate': today, 'endDate': add(today, -1)}, owner)
check('B end before start rejected', s == 400 and 'endDate' in b['error']['fields'], (s, b))
s, b = req('POST', f'/students/{sid}/subscriptions', {'mealPlanId': do['id'], 'startDate': today}, staff)
check('B staff cannot assign', s == 403)

# Flow C — limited meals + mobile
s, pk = req('POST', '/meal-plans', plan(f'30 Meals {u}', True, True, {'mealCredits': 30}), owner)
pk = pk['data']
mob = '7' + str(uuid.uuid4().int)[:9]
sid3, _ = new_student(owner, 'Limited', mob)
s, b = req('POST', f'/students/{sid3}/subscriptions', {'mealPlanId': pk['id'], 'startDate': today}, owner)
check('C limited plan: total = remaining = 30', s == 201 and b['data']['totalMealCredits'] == 30 and b['data']['remainingMealCredits'] == 30, (s, b))
lim_sub = b['data']['id']
stu = otp_login(mob)
s, b = req('GET', '/students/me/subscription', token=stu)
check('C student sees current plan with 30/30', s == 200 and b['data']['linked'] and b['data']['current']['remainingMealCredits'] == 30 and b['data']['current']['plan']['name'] == f'30 Meals {u}' and b['data']['messName'], (s, b))
s, b = req('GET', f'/subscriptions?search={mob}', token=owner)
check('B owner sees active subscription in list', b['data'] and b['data'][0]['status'] == 'ACTIVE' and b['meta']['total'] == 1, b)

# Flow D — renewal
s, rn = req('POST', f'/subscriptions/{lim_sub}/renew', {}, owner)
check('D renew defaults: same plan, starts day after end', s == 201 and rn['data']['kind'] == 'RENEWAL' and rn['data']['startDate'] == add(node(f"s.calculateEndDate('{today}','MONTHS',1)"), 1) and rn['data']['status'] == 'UPCOMING', (s, rn))
s, b = req('POST', f'/subscriptions/{lim_sub}/renew', {}, owner)
check('D second renewal from same sub overlaps -> rejected', s == 409 and b['error']['code'] == 'SUBSCRIPTION_OVERLAP', (s, b))
s, b = req('GET', f'/students/{sid3}/subscriptions', token=owner)
check('D history keeps both records', s == 200 and len(b['data']) == 2 and {x['status'] for x in b['data']} == {'ACTIVE', 'UPCOMING'}, b)
s, b = req('GET', '/students/me/subscription', token=stu)
check('D student sees upcoming renewal', b['data']['upcoming'] and b['data']['upcoming']['id'] == rn['data']['id'], b)
s, b = req('GET', '/students/me/subscriptions', token=stu)
check('D student history paginated', s == 200 and b['meta']['total'] == 2, b)

# Change plan
s, b = req('POST', f"/subscriptions/{sub['id']}/change-plan", {'mealPlanId': ld['id'], 'mode': 'AFTER_CURRENT'}, manager)
check('Change AFTER_CURRENT (manager) -> upcoming', s == 201 and b['data']['kind'] == 'PLAN_CHANGE' and b['data']['status'] == 'UPCOMING' and b['data']['endDate'] == add(b['data']['startDate'], 29), (s, b))
after_id = b['data']['id']
s, b = req('POST', f"/subscriptions/{sub['id']}/change-plan", {'mealPlanId': do['id'], 'mode': 'IMMEDIATE'}, manager)
check('Change IMMEDIATE forbidden for manager', s == 403, (s, b))
s, b = req('POST', f"/subscriptions/{after_id}/cancel", token=manager)
check('Cancel forbidden for manager', s == 403)
s, b = req('POST', f"/subscriptions/{after_id}/cancel", token=owner)
check('Owner cancels upcoming', s == 201 and b['data']['status'] == 'CANCELLED' and b['data']['cancelledAt'], (s, b))
s, b = req('POST', f"/subscriptions/{after_id}/cancel", token=owner)
check('Cancel twice -> NOT_CHANGEABLE', s == 409 and b['error']['code'] == 'SUBSCRIPTION_NOT_CHANGEABLE')
s, b = req('POST', f"/subscriptions/{sub['id']}/change-plan", {'mealPlanId': do['id'], 'mode': 'IMMEDIATE'}, owner)
check('Change IMMEDIATE (owner): new starts today', s == 201 and b['data']['startDate'] == today and b['data']['status'] == 'ACTIVE' and b['data']['plan']['name'] == f'Dinner {u}', (s, b))
s, b = req('GET', f"/subscriptions/{sub['id']}", token=owner)
check('Change IMMEDIATE: old cancelled, kept in history', b['data']['status'] == 'CANCELLED')
s, b = req('GET', f'/subscriptions?studentId={sid}&status=ACTIVE', token=owner)
check('Exactly one active after immediate change', b['meta']['total'] == 1, b)

# Status derivation + expiring soon
sid4, _ = new_student(owner, 'Expiring')
s, b = req('POST', f'/students/{sid4}/subscriptions', {'mealPlanId': ld['id'], 'startDate': add(today, -27)}, owner)
exp_id = b['data']['id']
check('Backdated 30-day plan ends in 3 days (ACTIVE, 3 days left)', b['data']['status'] == 'ACTIVE' and b['data']['daysRemaining'] == 3, b)
s, b = req('GET', '/subscriptions?expiringSoon=true&pageSize=100', token=owner)
check('Expiring soon includes it', any(x['id'] == exp_id for x in b['data']), b)
req('POST', f'/subscriptions/{exp_id}/renew', {}, owner)
s, b = req('GET', '/subscriptions?expiringSoon=true&pageSize=100', token=owner)
check('Expiring soon excludes once renewal scheduled', not any(x['id'] == exp_id for x in b['data']), b)
sid5, _ = new_student(owner, 'Past')
s, b = req('POST', f'/students/{sid5}/subscriptions', {'mealPlanId': ld['id'], 'startDate': add(today, -60)}, owner)
check('Fully past subscription -> EXPIRED', b['data']['status'] == 'EXPIRED' and b['data']['daysRemaining'] is None, b)
s, b = req('GET', '/subscriptions?status=EXPIRED&pageSize=100', token=owner)
check('Expired filter', any(x['id'] == b2 for x in b['data'] for b2 in [x['id']]) and all(x['status'] == 'EXPIRED' for x in b['data']), b)
s, b = req('GET', '/subscriptions?status=UPCOMING&pageSize=100', token=owner)
check('Upcoming filter', all(x['status'] == 'UPCOMING' for x in b['data']) and b['data'], b)

# Inactive / archived students
req('PATCH', f'/students/{sid2}/status', {'status': 'INACTIVE'}, owner)
s, b = req('POST', f'/students/{sid2}/subscriptions', {'mealPlanId': ld['id'], 'startDate': today}, owner)
check('Inactive student cannot get plan', s == 409 and b['error']['code'] == 'STUDENT_NOT_ACTIVE', (s, b))
req('POST', f'/students/{sid2}/archive', token=owner)
s, b = req('POST', f'/students/{sid2}/subscriptions', {'mealPlanId': ld['id'], 'startDate': today}, owner)
check('Archived student cannot get plan', s == 409 and 'Archived' in b['error']['message'], (s, b))

# Flow E — tenant isolation
planB = psql("select p.id from meal_plans p join messes m on m.id=p.\"messId\" where m.name='Sai Tiffin Service' limit 1")
subB = psql("select s.id from student_subscriptions s join messes m on m.id=s.\"messId\" where m.name='Sai Tiffin Service' limit 1")
studB = psql("select id from mess_students where mobile='9100000099'")
s, b = req('GET', '/meal-plans', token=owner)
check('E Mess A list excludes Mess B plans', not any(p['id'] == planB for p in b['data']))
for name, (m, path, body) in {
    'get plan': ('GET', f'/meal-plans/{planB}', None),
    'edit plan': ('PATCH', f'/meal-plans/{planB}', {'name': 'Hacked'}),
    'plan status': ('PATCH', f'/meal-plans/{planB}/status', {'status': 'INACTIVE'}),
    'get sub': ('GET', f'/subscriptions/{subB}', None),
    'renew sub': ('POST', f'/subscriptions/{subB}/renew', {}),
    'cancel sub': ('POST', f'/subscriptions/{subB}/cancel', None),
    'change sub': ('POST', f'/subscriptions/{subB}/change-plan', {'mealPlanId': ld['id'], 'mode': 'AFTER_CURRENT'}),
    'student history': ('GET', f'/students/{studB}/subscriptions', None),
    'assign to Mess B student': ('POST', f'/students/{studB}/subscriptions', {'mealPlanId': ld['id'], 'startDate': today}),
}.items():
    s, b = req(m, path, body, owner)
    check(f'E Mess A {name} -> 404', s == 404, (s, b))
s, b = req('POST', f'/students/{sid4}/subscriptions', {'mealPlanId': planB, 'startDate': add(today, 200)}, owner)
check('E assign Mess B plan to Mess A student -> 404', s == 404, (s, b))
s, b = req('GET', f'/subscriptions?mealPlanId={planB}', token=owner)
check('E filtering by Mess B plan id returns nothing', b['data'] == [], b)
check('E Mess B data untouched', psql(f"select name||status from meal_plans where id='{planB}'") == 'Lunch OnlyACTIVE' and psql(f"select \"cancelledAt\" is null from student_subscriptions where id='{subB}'") == 't')

# Flow F — student security
s, b = req('GET', f'/subscriptions/{lim_sub}', token=stu)
check('F student blocked from owner subscription API', s == 403, (s, b))
s, b = req('GET', f'/students/{sid}/subscriptions', token=stu)
check('F student blocked from other student history', s == 403, (s, b))
s, b = req('POST', f'/students/{sid3}/subscriptions', {'mealPlanId': ld['id'], 'startDate': today}, stu)
check('F student cannot assign', s == 403)
s, b = req('POST', f'/subscriptions/{lim_sub}/cancel', token=stu)
check('F student cannot cancel', s == 403)
s, b = req('GET', '/meal-plans', token=stu)
check('F student blocked from plans API', s == 403)
other = otp_login('6' + str(uuid.uuid4().int)[:9])
s, b = req('GET', '/students/me/subscription', token=other)
check('F unlinked student -> linked:false', s == 200 and b['data'] == {'linked': False}, b)
s, b = req('GET', '/students/me/subscriptions', token=other)
check('F unlinked student history empty', s == 200 and b['data'] == [] and b['meta']['total'] == 0, b)

# No deductions happened
check('No meal credits deducted', psql(f"select \"remainingMealCredits\" from student_subscriptions where id='{lim_sub}'") == '30')
s, b = req('GET', f"/meal-plans/{ld['id']}", token=owner)
check('Plan detail has current subscription count', s == 200 and b['data']['currentSubscriptionCount'] >= 2, b)
print(f"\n{sum(results)}/{len(results)} checks passed")
