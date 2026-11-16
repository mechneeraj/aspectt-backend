import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'url';

const prisma = new PrismaClient();

export async function seedSubscriptions() {
  console.log('💳 Seeding realistic Subscription & Subscription History dummy data...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Ensure User A: Alex Vance (alex@aspectt.com) exists
  const userA = await prisma.user.upsert({
    where: { email: 'alex@aspectt.com' },
    update: {
      name: 'Alex Vance',
      subscriptionTier: 'PRO',
    },
    create: {
      id: 'USER001',
      name: 'Alex Vance',
      email: 'alex@aspectt.com',
      passwordHash,
      avatarUrl:
        'https://api.dicebear.com/10.x/micah/svg?seed=Alex&backgroundColor=7E57C2',
      appLanguage: 'en',
      subscriptionTier: 'PRO',
    },
  });

  // 2. Ensure User B: Maya Lin (maya@aspectt.com) exists
  const userB = await prisma.user.upsert({
    where: { email: 'maya@aspectt.com' },
    update: {
      name: 'Maya Lin',
      subscriptionTier: 'FREE',
    },
    create: {
      id: 'USER002',
      name: 'Maya Lin',
      email: 'maya@aspectt.com',
      passwordHash,
      avatarUrl:
        'https://api.dicebear.com/10.x/micah/svg?seed=Maya&backgroundColor=7E57C2',
      appLanguage: 'en',
      subscriptionTier: 'FREE',
    },
  });

  // 3. Ensure User C: Samira Khan (samira@aspectt.com) - Brand new registered user without any plan
  const userC = await prisma.user.upsert({
    where: { email: 'samira@aspectt.com' },
    update: {
      name: 'Samira Khan',
      subscriptionTier: 'FREE',
    },
    create: {
      id: 'USER003',
      name: 'Samira Khan',
      email: 'samira@aspectt.com',
      passwordHash,
      avatarUrl:
        'https://api.dicebear.com/10.x/micah/svg?seed=Samira&backgroundColor=7E57C2',
      appLanguage: 'en',
      subscriptionTier: 'FREE',
    },
  });

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // ----------------------------------------------------------------------------
  // User A (Alex Vance): 1 Current ACTIVE Plan + 3 Expired History Rows
  // ----------------------------------------------------------------------------
  console.log(`   👤 Seeding User A (${userA.email}): 1 ACTIVE + 3 EXPIRED records...`);

  // Clear previous test subscriptions for User A
  try {
    await prisma.subscription.deleteMany({ where: { userId: userA.id } });
    await prisma.subscriptionHistory.deleteMany({ where: { userId: userA.id } });
  } catch { }

  // User A History 1: Expired (95 days ago to 65 days ago)
  await prisma.subscriptionHistory.create({
    data: {
      userId: userA.id,
      planName: 'MONTHLY',
      amount: 99,
      status: 'EXPIRED',
      paymentReference: 'DUMMY_TXN_AUG26_01',
      startDate: new Date(now - 95 * dayMs),
      expiryDate: new Date(now - 65 * dayMs),
      createdAt: new Date(now - 95 * dayMs),
    },
  });

  // User A History 2: Expired (65 days ago to 35 days ago)
  await prisma.subscriptionHistory.create({
    data: {
      userId: userA.id,
      planName: 'MONTHLY',
      amount: 99,
      status: 'EXPIRED',
      paymentReference: 'DUMMY_TXN_SEP26_02',
      startDate: new Date(now - 65 * dayMs),
      expiryDate: new Date(now - 35 * dayMs),
      createdAt: new Date(now - 65 * dayMs),
    },
  });

  // User A History 3: Expired (35 days ago to 5 days ago)
  await prisma.subscriptionHistory.create({
    data: {
      userId: userA.id,
      planName: 'MONTHLY',
      amount: 99,
      status: 'EXPIRED',
      paymentReference: 'DUMMY_TXN_OCT26_03',
      startDate: new Date(now - 35 * dayMs),
      expiryDate: new Date(now - 5 * dayMs),
      createdAt: new Date(now - 35 * dayMs),
    },
  });

  // User A History 4: Current ACTIVE (started 5 days ago, expires in 25 days)
  const userAActiveStart = new Date(now - 5 * dayMs);
  const userAActiveExpiry = new Date(now + 25 * dayMs);

  await prisma.subscriptionHistory.create({
    data: {
      userId: userA.id,
      planName: 'MONTHLY',
      amount: 99,
      status: 'ACTIVE',
      paymentReference: 'DUMMY_TXN_NOV26_ACTIVE',
      startDate: userAActiveStart,
      expiryDate: userAActiveExpiry,
      createdAt: userAActiveStart,
    },
  });

  // User A Current Active Subscription
  await prisma.subscription.create({
    data: {
      userId: userA.id,
      planName: 'MONTHLY',
      amount: 99,
      currency: 'INR',
      status: 'ACTIVE',
      startDate: userAActiveStart,
      expiryDate: userAActiveExpiry,
    },
  });

  // ----------------------------------------------------------------------------
  // User B (Maya Lin): 2 Expired History Rows + Current NOT_ACTIVE / EXPIRED Status
  // ----------------------------------------------------------------------------
  console.log(`   👤 Seeding User B (${userB.email}): NOT_ACTIVE + 2 EXPIRED records...`);

  // Clear previous test subscriptions for User B
  try {
    await prisma.subscription.deleteMany({ where: { userId: userB.id } });
    await prisma.subscriptionHistory.deleteMany({ where: { userId: userB.id } });
  } catch { }

  // User B History 1: Expired (75 days ago to 45 days ago)
  await prisma.subscriptionHistory.create({
    data: {
      userId: userB.id,
      planName: 'MONTHLY',
      amount: 99,
      status: 'EXPIRED',
      paymentReference: 'DUMMY_TXN_EXP_01',
      startDate: new Date(now - 75 * dayMs),
      expiryDate: new Date(now - 45 * dayMs),
      createdAt: new Date(now - 75 * dayMs),
    },
  });

  // User B History 2: Expired (45 days ago to 15 days ago)
  const userBExpiredStart = new Date(now - 45 * dayMs);
  const userBExpiredExpiry = new Date(now - 15 * dayMs);

  await prisma.subscriptionHistory.create({
    data: {
      userId: userB.id,
      planName: 'MONTHLY',
      amount: 99,
      status: 'EXPIRED',
      paymentReference: 'DUMMY_TXN_EXP_02',
      startDate: userBExpiredStart,
      expiryDate: userBExpiredExpiry,
      createdAt: userBExpiredStart,
    },
  });

  // User B Current Expired Subscription (NOT_ACTIVE)
  await prisma.subscription.create({
    data: {
      userId: userB.id,
      planName: 'MONTHLY',
      amount: 99,
      currency: 'INR',
      status: 'EXPIRED',
      startDate: userBExpiredStart,
      expiryDate: userBExpiredExpiry,
    },
  });

  // ----------------------------------------------------------------------------
  // User C (Samira Khan): Newly Registered User — Initial NOT_ACTIVE Subscription
  // ----------------------------------------------------------------------------
  console.log(`   👤 Seeding User C (${userC.email}): Initial NOT_ACTIVE (No Plan)...`);

  try {
    await prisma.subscription.deleteMany({ where: { userId: userC.id } });
    await prisma.subscriptionHistory.deleteMany({ where: { userId: userC.id } });
  } catch { }

  await prisma.subscription.create({
    data: {
      userId: userC.id,
      planName: 'NONE',
      amount: 0,
      currency: 'INR',
      status: 'NOT_ACTIVE',
      startDate: null,
      expiryDate: null,
    },
  });

  console.log('   ✔ Subscriptions and audit history seeded successfully!\n');
}

// Allow direct execution: `node prisma/seed-subscriptions.js`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedSubscriptions()
    .catch((e) => {
      console.error('Seed subscriptions error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

