/**
 * Development seed: a demo mess with an owner, a manager, a staff member and a few students,
 * plus a second mess (for tenant-isolation checks).
 * All accounts use the password "Password123". Do not run against production.
 */
import { PlanDurationType, PrismaClient, Role, type Mess, type MessStudent } from '@prisma/client';
import { addDays, businessToday, calculateEndDate } from '@mess/shared';
import { hashPassword } from '../src/modules/auth/crypto.util';

const prisma = new PrismaClient();
const PASSWORD = 'Password123';

async function upsertUser(mobile: string, email: string, firstName: string, lastName: string, role: Role) {
  const passwordHash = await hashPassword(PASSWORD);
  return prisma.user.upsert({
    where: { mobile },
    update: {},
    create: { mobile, email, firstName, lastName, role, passwordHash, mobileVerified: true },
  });
}

const PLANS = [
  { name: 'Lunch Only', pricePaise: 180000, lunchIncluded: true, dinnerIncluded: false, mealCredits: null },
  { name: 'Dinner Only', pricePaise: 180000, lunchIncluded: false, dinnerIncluded: true, mealCredits: null },
  { name: 'Lunch + Dinner', pricePaise: 330000, lunchIncluded: true, dinnerIncluded: true, mealCredits: null },
  { name: '30 Meals Pack', pricePaise: 210000, lunchIncluded: true, dinnerIncluded: true, mealCredits: 30 },
];

async function seedPlan(mess: Mess, plan: (typeof PLANS)[number]) {
  return (
    (await prisma.mealPlan.findFirst({ where: { messId: mess.id, name: plan.name } })) ??
    (await prisma.mealPlan.create({
      data: { ...plan, messId: mess.id, durationType: PlanDurationType.MONTHS, durationValue: 1 },
    }))
  );
}

/** Gives the student a plan starting today unless they already have one. */
async function seedSubscription(mess: Mess, student: MessStudent | null, plan: Awaited<ReturnType<typeof seedPlan>>) {
  if (!student || (await prisma.studentSubscription.count({ where: { studentId: student.id } }))) return;
  const start = businessToday();
  await prisma.studentSubscription.create({
    data: {
      messId: mess.id,
      studentId: student.id,
      mealPlanId: plan.id,
      planName: plan.name,
      planPricePaise: plan.pricePaise,
      breakfastIncluded: plan.breakfastIncluded,
      lunchIncluded: plan.lunchIncluded,
      dinnerIncluded: plan.dinnerIncluded,
      startDate: new Date(`${start}T00:00:00Z`),
      endDate: new Date(`${calculateEndDate(start, plan.durationType, plan.durationValue)}T00:00:00Z`),
      totalMealCredits: plan.mealCredits,
      remainingMealCredits: plan.mealCredits,
    },
  });
}

/** Published menus for today and tomorrow, unless the mess already has them. */
async function seedMenus(mess: Mess) {
  const menus = [
    {
      breakfastItems: ['Poha', 'Tea'],
      lunchItems: ['Chapati', 'Dal Tadka', 'Jeera Rice', 'Cabbage Sabji', 'Salad'],
      dinnerItems: ['Chapati', 'Paneer Butter Masala', 'Rice', 'Dal'],
    },
    {
      breakfastItems: ['Upma', 'Tea'],
      lunchItems: ['Chapati', 'Rajma', 'Rice', 'Salad'],
      dinnerItems: ['Chapati', 'Mix Veg', 'Dal Khichdi'],
      generalNote: 'Sunday special dinner at 8 PM',
    },
  ];
  for (const [i, menu] of menus.entries()) {
    const menuDate = new Date(`${addDays(businessToday(), i)}T00:00:00Z`);
    await prisma.dailyMenu.upsert({
      where: { messId_menuDate: { messId: mess.id, menuDate } },
      update: {},
      create: { ...menu, messId: mess.id, menuDate, isPublished: true, publishedAt: new Date() },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed production');

  // Platform admin: no mess membership. Development credentials only (seed refuses production).
  await upsertUser('9000000000', 'admin@demo.mess', 'Platform', 'Admin', Role.PLATFORM_ADMIN);
  const owner = await upsertUser('9000000001', 'owner@demo.mess', 'Ravi', 'Patil', Role.MESS_OWNER);
  const manager = await upsertUser('9000000002', 'manager@demo.mess', 'Sunita', 'Joshi', Role.MESS_MANAGER);
  const staff = await upsertUser('9000000003', 'staff@demo.mess', 'Amit', 'Kale', Role.MESS_STAFF);

  const mess =
    (await prisma.mess.findFirst({ where: { ownerId: owner.id } })) ??
    (await prisma.mess.create({
      data: {
        ownerId: owner.id,
        name: 'Annapurna Student Mess',
        mobile: owner.mobile,
        email: owner.email,
        address: '12, Near College Road',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        breakfastAvailable: true,
        openingTime: '07:30',
        closingTime: '22:00',
      },
    }));

  for (const [user, role] of [
    [owner, Role.MESS_OWNER],
    [manager, Role.MESS_MANAGER],
    [staff, Role.MESS_STAFF],
  ] as const) {
    await prisma.messMembership.upsert({
      where: { userId_messId: { userId: user.id, messId: mess.id } },
      update: {},
      create: { userId: user.id, messId: mess.id, role },
    });
  }

  const students = [
    { firstName: 'Raj', lastName: 'Kumar', mobile: '9100000001', collegeName: 'COEP', hostelOrPg: 'Shivaji Hostel' },
    { firstName: 'Priya', lastName: 'Sharma', mobile: '9100000002', collegeName: 'Fergusson College', hostelOrPg: 'Sai PG' },
    { firstName: 'Arjun', lastName: 'Mehta', mobile: '9100000003', collegeName: 'COEP', hostelOrPg: null },
  ];
  for (const student of students) {
    await prisma.messStudent.upsert({
      where: { messId_mobile: { messId: mess.id, mobile: student.mobile } },
      update: {},
      create: { ...student, messId: mess.id, joiningDate: new Date('2026-07-01T00:00:00Z') },
    });
  }

  const otherOwner = await upsertUser('9000000011', 'owner@other.mess', 'Kiran', 'Desai', Role.MESS_OWNER);
  const otherMess =
    (await prisma.mess.findFirst({ where: { ownerId: otherOwner.id } })) ??
    (await prisma.mess.create({
      data: {
        ownerId: otherOwner.id,
        name: 'Sai Tiffin Service',
        mobile: otherOwner.mobile,
        address: '4, Station Road',
        city: 'Nagpur',
        state: 'Maharashtra',
        pincode: '440001',
      },
    }));
  await prisma.messMembership.upsert({
    where: { userId_messId: { userId: otherOwner.id, messId: otherMess.id } },
    update: {},
    create: { userId: otherOwner.id, messId: otherMess.id, role: Role.MESS_OWNER },
  });
  await prisma.messStudent.upsert({
    where: { messId_mobile: { messId: otherMess.id, mobile: '9100000099' } },
    update: {},
    create: { messId: otherMess.id, firstName: 'Neha', lastName: 'Rao', mobile: '9100000099', joiningDate: new Date('2026-08-01T00:00:00Z') },
  });

  const plans = [];
  for (const plan of PLANS) plans.push(await seedPlan(mess, plan));
  await seedSubscription(mess, await prisma.messStudent.findFirst({ where: { messId: mess.id, mobile: '9100000001' } }), plans[2]);
  const otherPlan = await seedPlan(otherMess, PLANS[0]);
  await seedSubscription(otherMess, await prisma.messStudent.findFirst({ where: { messId: otherMess.id, mobile: '9100000099' } }), otherPlan);

  await seedMenus(mess);
  await seedMenus(otherMess);

  console.log(`Seeded "${mess.name}" and "${otherMess.name}". Logins (password ${PASSWORD}):`);
  console.log('  9000000000 platform admin (/admin)');
  console.log('  9000000001 owner, 9000000002 manager, 9000000003 staff, 9000000011 owner of second mess');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
