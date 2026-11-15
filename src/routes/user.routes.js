import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { generateCustomId } from '../utils/idGenerator.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'aspectt_dev_jwt_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// ==============================================================================
// 1. Auth Endpoints: POST /api/user/login and POST /api/user/register
// ==============================================================================
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Email and password are required.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user.id);
    const userSafe = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      appLanguage: user.appLanguage,
      subscriptionTier: user.subscriptionTier,
      createdAt: user.createdAt,
    };

    return res.json({
      message: 'Login successful',
      token,
      user: userSafe,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, avatarUrl } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Name, email, and password are required.',
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultAvatar =
      avatarUrl ||
      `https://api.dicebear.com/10.x/micah/svg?seed=${encodeURIComponent(
        name.trim()
      )}&backgroundColor=7E57C2`;

    const customId = await generateCustomId(prisma.user, 'USER');

    const newUser = await prisma.user.create({
      data: {
        id: customId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        avatarUrl: defaultAvatar,
        appLanguage: 'en',
        subscriptionTier: 'pro',
      },
    });

    const token = generateToken(newUser.id);
    const userSafe = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatarUrl: newUser.avatarUrl,
      appLanguage: newUser.appLanguage,
      subscriptionTier: newUser.subscriptionTier,
      createdAt: newUser.createdAt,
    };

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: userSafe,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 2. Profile Endpoints: GET & PATCH /api/user/profile
// ==============================================================================
router.get('/profile', requireAuth, async (req, res) => {
  return res.json(req.user);
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, avatarUrl, appLanguage, subscriptionTier } = req.body || {};
    const data = {};

    if (name && typeof name === 'string' && name.trim()) {
      data.name = name.trim();
    }
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) {
      data.avatarUrl = avatarUrl.trim();
    }
    if (appLanguage && typeof appLanguage === 'string') {
      data.appLanguage = appLanguage.trim();
    }
    if (subscriptionTier && typeof subscriptionTier === 'string') {
      data.subscriptionTier = subscriptionTier.trim();
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        appLanguage: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });

    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 3. Watchlist Endpoints: GET, POST, DELETE /api/user/watchlist
// ==============================================================================
router.get('/watchlist', requireAuth, async (req, res, next) => {
  try {
    const items = await prisma.watchlist.findMany({
      where: { userId: req.user.id },
      include: {
        movie: true,
      },
      orderBy: { addedAt: 'desc' },
    });

    // Return the movies array
    const movies = items.map((item) => item.movie);
    return res.json(movies);
  } catch (error) {
    next(error);
  }
});

// Toggle or add movie to watchlist
router.post('/watchlist/:movieId', requireAuth, async (req, res, next) => {
  try {
    const { movieId } = req.params;
    if (!movieId || typeof movieId !== 'string' || !movieId.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid movie ID.',
      });
    }

    const cleanMovieId = movieId.trim();
    // Query directly by custom ID (e.g., MOV001), fallback to slug
    let movie = await prisma.movie.findUnique({ where: { id: cleanMovieId } });
    if (!movie) {
      movie = await prisma.movie.findUnique({ where: { slug: cleanMovieId } });
    }

    if (!movie) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Movie with id or slug '${movieId}' was not found.`,
      });
    }

    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_movieId: {
          userId: req.user.id,
          movieId: movie.id,
        },
      },
    });

    if (existing) {
      await prisma.watchlist.delete({
        where: {
          userId_movieId: {
            userId: req.user.id,
            movieId: movie.id,
          },
        },
      });
      return res.json({
        message: `Removed "${movie.title}" from watchlist`,
        isInWatchlist: false,
        movieId: movie.id,
      });
    } else {
      await prisma.watchlist.create({
        data: {
          userId: req.user.id,
          movieId: movie.id,
        },
      });
      return res.status(201).json({
        message: `Added "${movie.title}" to watchlist`,
        isInWatchlist: true,
        movieId: movie.id,
      });
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/watchlist/:movieId', requireAuth, async (req, res, next) => {
  try {
    const { movieId } = req.params;
    if (!movieId || typeof movieId !== 'string' || !movieId.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid movie ID.',
      });
    }

    const cleanMovieId = movieId.trim();
    // Query directly by custom ID (e.g., MOV001), fallback to slug
    let movie = await prisma.movie.findUnique({ where: { id: cleanMovieId } });
    if (!movie) {
      movie = await prisma.movie.findUnique({ where: { slug: cleanMovieId } });
    }

    if (!movie) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Movie with id or slug '${movieId}' was not found.`,
      });
    }

    await prisma.watchlist.deleteMany({
      where: {
        userId: req.user.id,
        movieId: movie.id,
      },
    });

    return res.json({
      message: `Removed "${movie.title}" from watchlist`,
      isInWatchlist: false,
      movieId: movie.id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

