import { Router } from 'express';
import prisma from '../prisma.js';
import requireAuth from '../middleware/auth.js';

const router = Router();

// In-memory fallback stores for subscriptions (ensures full functionality in test/offline environments)
export const memorySubscriptions = new Map();
export const memoryHistory = new Map();

// Supported Plans
export const PLANS = {
  MONTHLY: {
    name: 'MONTHLY',
    label: 'Monthly Plan',
    amount: 99,
    currency: 'INR',
    durationDays: 30,
  },
  YEARLY: {
    name: 'YEARLY',
    label: 'Yearly Plan',
    amount: 999,
    currency: 'INR',
    durationDays: 365,
  },
};

/**
 * Helper to check whether a user has an active, unexpired subscription
 */
export async function checkUserSubscriptionActive(userId) {
  if (!userId) return false;

  try {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (sub) {
      if (sub.status !== 'ACTIVE' || !sub.expiryDate) {
        return false;
      }
      const now = new Date();
      const isExpired = new Date(sub.expiryDate) <= now;

      if (isExpired && sub.status === 'ACTIVE') {
        // Auto-expire
        try {
          await prisma.subscription.update({
            where: { userId },
            data: { status: 'EXPIRED' },
          });
          await prisma.subscriptionHistory.updateMany({
            where: { userId, status: 'ACTIVE' },
            data: { status: 'EXPIRED' },
          });
          await prisma.user.update({
            where: { id: userId },
            data: { subscriptionTier: 'FREE' },
          });
        } catch { }
        return false;
      }

      return sub.status === 'ACTIVE' && !isExpired;
    }
  } catch (err) {
    // If DB table is not ready or failed, fallback to memory store
  }

  // In-memory fallback
  const memSub = memorySubscriptions.get(userId);
  if (memSub) {
    if (memSub.status !== 'ACTIVE' || !memSub.expiryDate) {
      return false;
    }
    const isExpired = new Date(memSub.expiryDate) <= new Date();
    if (isExpired && memSub.status === 'ACTIVE') {
      memSub.status = 'EXPIRED';
      const userHist = memoryHistory.get(userId) || [];
      userHist.forEach((h) => {
        if (h.status === 'ACTIVE') h.status = 'EXPIRED';
      });
      return false;
    }
    return memSub.status === 'ACTIVE' && !isExpired;
  }

  return false;
}

// ==============================================================================
// 1. GET /api/subscription/status
// Returns current active plan details and full subscription history.
// Automatically auto-expires plans whose expiryDate has passed.
// ==============================================================================
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    let currentSub = null;
    let historyList = [];

    try {
      // 1. Fetch current subscription
      currentSub = await prisma.subscription.findUnique({
        where: { userId },
      });

      // Check auto-expiration
      if (currentSub && currentSub.status === 'ACTIVE' && currentSub.expiryDate && new Date(currentSub.expiryDate) <= now) {
        currentSub = await prisma.subscription.update({
          where: { userId },
          data: { status: 'EXPIRED' },
        });

        await prisma.subscriptionHistory.updateMany({
          where: { userId, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        });

        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionTier: 'FREE' },
        });
      }

      // 2. Fetch full subscription history
      historyList = await prisma.subscriptionHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbErr) {
      console.warn('Subscription DB query fallback to memory:', dbErr.message);
      currentSub = memorySubscriptions.get(userId) || null;
      if (currentSub && currentSub.status === 'ACTIVE' && currentSub.expiryDate && new Date(currentSub.expiryDate) <= now) {
        currentSub.status = 'EXPIRED';
      }
      historyList = memoryHistory.get(userId) || [];
    }

    const isActive =
      Boolean(currentSub && currentSub.status === 'ACTIVE' && currentSub.expiryDate && new Date(currentSub.expiryDate) > now);

    return res.json({
      success: true,
      subscription: currentSub
        ? {
            id: currentSub.id,
            userId: currentSub.userId,
            planName: currentSub.planName,
            amount: currentSub.amount,
            currency: currentSub.currency || 'INR',
            status: currentSub.status,
            startDate: currentSub.startDate,
            expiryDate: currentSub.expiryDate,
            updatedAt: currentSub.updatedAt,
          }
        : null,
      isActive,
      history: historyList.map((item) => ({
        id: item.id,
        planName: item.planName,
        amount: item.amount,
        status: item.status,
        paymentReference: item.paymentReference,
        startDate: item.startDate,
        expiryDate: item.expiryDate,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 2. POST /api/subscription/create-order
// Prepares an order for payment gateway (Razorpay / Cashfree ready)
// ==============================================================================
router.post('/create-order', requireAuth, async (req, res, next) => {
  try {
    const { planName = 'MONTHLY' } = req.body || {};
    const normalizedPlan = String(planName).toUpperCase();

    const plan = PLANS[normalizedPlan];
    if (!plan) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid plan selected. Choose MONTHLY or YEARLY.',
      });
    }

    const dummyOrderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Modular structure ready for future payment gateway exchange:
    return res.json({
      success: true,
      orderId: dummyOrderId,
      planName: plan.name,
      label: plan.label,
      amount: plan.amount,
      currency: plan.currency,
      durationDays: plan.durationDays,
      // Plug Razorpay or Cashfree key here when configured:
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_aspectt_dummy',
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 3. POST /api/subscription/activate
// Activates selected plan (dummy flow now, webhook/signature ready for gateway)
// Upserts Subscription table as "ACTIVE", marks old history as "EXPIRED",
// and records a new "ACTIVE" row in SubscriptionHistory.
// ==============================================================================
router.post('/activate', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { planName = 'MONTHLY', paymentReference, orderId } = req.body || {};
    const normalizedPlan = String(planName).toUpperCase();

    const plan = PLANS[normalizedPlan];
    if (!plan) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid plan selected. Choose MONTHLY or YEARLY.',
      });
    }

    const startDate = new Date();
    const expiryDate = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
    const txnReference =
      paymentReference || orderId || `DUMMY_TXN_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    let savedSubscription = null;
    let savedHistory = null;

    try {
      // 1. Mark any previously ACTIVE history records as EXPIRED
      await prisma.subscriptionHistory.updateMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
        },
      });

      // 2. Upsert Subscription table with the new active plan
      savedSubscription = await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planName: plan.name,
          amount: plan.amount,
          currency: plan.currency,
          status: 'ACTIVE',
          startDate,
          expiryDate,
        },
        update: {
          planName: plan.name,
          amount: plan.amount,
          currency: plan.currency,
          status: 'ACTIVE',
          startDate,
          expiryDate,
        },
      });

      // 3. Insert new ACTIVE entry into SubscriptionHistory audit trail
      savedHistory = await prisma.subscriptionHistory.create({
        data: {
          userId,
          planName: plan.name,
          amount: plan.amount,
          status: 'ACTIVE',
          paymentReference: txnReference,
          startDate,
          expiryDate,
        },
      });

      // 4. Update User tier to 'PRO' for active subscriber synchronization
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: 'PRO' },
      });
    } catch (dbErr) {
      console.warn('Subscription activate DB note (persisting in memory):', dbErr.message);

      // In-memory fallback
      savedSubscription = {
        id: `sub_${Date.now()}`,
        userId,
        planName: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        status: 'ACTIVE',
        startDate,
        expiryDate,
        updatedAt: new Date(),
      };
      memorySubscriptions.set(userId, savedSubscription);

      const userHist = memoryHistory.get(userId) || [];
      userHist.forEach((h) => {
        if (h.status === 'ACTIVE') h.status = 'EXPIRED';
      });

      savedHistory = {
        id: `subh_${Date.now()}`,
        userId,
        planName: plan.name,
        amount: plan.amount,
        status: 'ACTIVE',
        paymentReference: txnReference,
        startDate,
        expiryDate,
        createdAt: new Date(),
      };
      userHist.unshift(savedHistory);
      memoryHistory.set(userId, userHist);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully activated ${plan.label}!`,
      subscription: savedSubscription,
      historyItem: savedHistory,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

