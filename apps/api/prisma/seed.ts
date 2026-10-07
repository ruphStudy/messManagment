/**
 * Development seed: one demo mess with an owner, a manager and a staff member.
 * All accounts use the password "Password123". Do not run against production.
 */
import { PrismaClient, Role } from '@prisma/client';
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

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed production');

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

  console.log(`Seeded "${mess.name}". Logins (password ${PASSWORD}): 9000000001 owner, 9000000002 manager, 9000000003 staff`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
