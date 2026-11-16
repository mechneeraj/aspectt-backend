import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'url';

const prisma = new PrismaClient();

/**
 * Sync and clean up all users in the database:
 * 1. If a user has an active, unexpired subscription in the Subscription table:
 *    - Ensure user.subscriptionTier is set to "PRO".
 * 2. If a user does NOT have an active subscription:
 *    - Reset user.subscriptionTier to "FREE".
 *    - If no Subscription record exists for them, create a "NOT_ACTIVE" record.
 *    - If an expired record has status === "ACTIVE", update it to "EXPIRED".
 */
export async function syncAllUserSubscriptions() {
  console.log('🔄 Checking and syncing user subscriptions against Subscription table...');
  const now = new Date();

  try {
    const users = await prisma.user.findMany({
      include: {
        subscription: true,
      },
    });

    console.log(`   Found ${users.length} registered user(s) to inspect.`);

    let activeCount = 0;
    let freeCount = 0;
    let createdSubCount = 0;
    let expiredCount = 0;

    for (const user of users) {
      const sub = user.subscription;
      const isSubActive = Boolean(
        sub &&
        sub.status === 'ACTIVE' &&
        sub.expiryDate &&
        new Date(sub.expiryDate) > now
      );

      if (isSubActive) {
        // User has verified ACTIVE subscription
        activeCount++;
        if (user.subscriptionTier !== 'PRO') {
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionTier: 'PRO' },
          });
        }
      } else {
        // User does NOT have an active subscription -> MUST BE FREE
        freeCount++;

        // 1. Reset user tier to FREE if not already
        if (user.subscriptionTier !== 'FREE') {
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionTier: 'FREE' },
          });
        }

        // 2. If no Subscription record exists, automatically create a NOT_ACTIVE record
        if (!sub) {
          try {
            await prisma.subscription.create({
              data: {
                userId: user.id,
                planName: 'NONE',
                amount: 0,
                currency: 'INR',
                status: 'NOT_ACTIVE',
                startDate: null,
                expiryDate: null,
              },
            });
            createdSubCount++;
          } catch (err) {
            console.warn(`   Could not create NOT_ACTIVE subscription for user ${user.id}:`, err.message);
          }
        } else if (sub.status === 'ACTIVE' && sub.expiryDate && new Date(sub.expiryDate) <= now) {
          // 3. Mark expired active subscriptions as EXPIRED
          await prisma.subscription.update({
            where: { userId: user.id },
            data: { status: 'EXPIRED' },
          });
          await prisma.subscriptionHistory.updateMany({
            where: { userId: user.id, status: 'ACTIVE' },
            data: { status: 'EXPIRED' },
          });
          expiredCount++;
        }
      }
    }

    console.log(`   ✔ Sync complete:`);
    console.log(`     • ${activeCount} active PRO subscriber(s) verified`);
    console.log(`     • ${freeCount} FREE user(s) verified / reset`);
    if (createdSubCount > 0) {
      console.log(`     • ${createdSubCount} missing NOT_ACTIVE subscription row(s) created`);
    }
    if (expiredCount > 0) {
      console.log(`     • ${expiredCount} expired subscription(s) updated to EXPIRED`);
    }

    return {
      totalUsers: users.length,
      activeCount,
      freeCount,
      createdSubCount,
      expiredCount,
    };
  } catch (err) {
    console.warn('Subscription sync note (database may be unreachable or in-memory mode):', err.message);
    return null;
  }
}

// Allow direct execution: `node prisma/sync-subscriptions.js`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncAllUserSubscriptions()
    .catch((e) => {
      console.error('Subscription sync error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
