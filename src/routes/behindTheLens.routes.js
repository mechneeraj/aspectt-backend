import { Router } from 'express';
import prisma from '../prisma.js';

const router = Router();

// ==============================================================================
// GET /api/behind-the-lens
// Returns all independent behind-the-scenes clips ordered by createdAt desc.
// ==============================================================================
router.get('/', async (req, res, next) => {
  try {
    const clips = await prisma.behindTheLens.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(clips);
  } catch (error) {
    next(error);
  }
});

export default router;

