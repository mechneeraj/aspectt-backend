import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { generateCustomId } from '../utils/idGenerator.js';
import { generateOtp, storeOtp, verifyOtp, sendOtpEmail } from '../utils/emailService.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'aspectt_dev_jwt_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// In-memory fallback cache for pending signups (if DB table is unavailable)
const pendingSignupsStore = new Map();

// Helper to format safe public user object
const formatUserSafe = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  avatar: user.avatar || null,
  avatarUrl: user.avatarUrl || null,
  appLanguage: user.appLanguage || 'en',
  subscriptionTier: user.subscriptionTier || 'free',
  createdAt: user.createdAt,
});

// ==============================================================================
// 1. Auth Step 1: POST /api/auth/send-otp
// Validates registration details, stores unverified user in PendingSignup,
// and sends a 6-digit OTP via Brevo's Transactional Email REST API.
// Also routes legacy /register and /signup requests here to prevent direct creation.
// ==============================================================================
  const sendOtpHandler = async (req, res, next) => {
    try {
      const { name, email, phone, password } = req.body || {};
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'Full name is required.',
        });
      }

      if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'A valid email address is required.',
        });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'Password must be at least 6 characters long.',
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();
      const cleanPhone = phone && typeof phone === 'string' ? phone.trim() : null;

        // 1. Check if email is already registered in permanent User table
        const existingUser = await prisma.user.findUnique({
          where: { email: cleanEmail },
        });

        if(existingUser) {
          return res.status(400).json({
            error: 'EmailAlreadyRegistered',
            message: 'An account with this email address already exists. Please sign in instead.',
          });
        }

    // 2. Hash password for pending storage
    const passwordHash = await bcrypt.hash(password, 10);

        // 3. Generate random 6-digit numeric OTP (100000 - 999999)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

        // 4. Upsert into PendingSignup model (with in-memory fallback)
        try {
          await prisma.pendingSignup.upsert({
            where: { email: cleanEmail },
            create: {
              email: cleanEmail,
              name: cleanName,
              phone: cleanPhone,
              passwordHash,
              otp,
              expiresAt,
            },
            update: {
              name: cleanName,
              phone: cleanPhone,
              passwordHash,
              otp,
              expiresAt,
            },
          });
        } catch(dbErr) {
          console.warn('PendingSignup DB note (persisting in memory):', dbErr.message);
        }

    pendingSignupsStore.set(cleanEmail, {
          email: cleanEmail,
          name: cleanName,
          phone: cleanPhone,
          passwordHash,
          otp,
          expiresAt,
        });

        // 5. Send OTP using Brevo REST API
        let emailResult;
        try {
          emailResult = await sendOtpEmail({
            toEmail: cleanEmail,
            toName: cleanName,
            otp,
          });
        } catch(brevoErr) {
          console.error('Brevo API send failure:', brevoErr);
          return res.status(500).json({
            error: 'EmailDeliveryFailed',
            message: `Failed to deliver verification code via Brevo: ${brevoErr.message}`,
          });
        }

    return res.json({
          success: true,
          message: `Verification code sent to ${cleanEmail}. Please enter the 6-digit code.`,
          expiresIn: '10 minutes',
          ...(emailResult?.simulated ? { devOtp: otp } : {}),
        });
      } catch (error) {
        next(error);
      }
};

router.post('/send-otp', sendOtpHandler);

// Disable direct unverified signup by routing /register and /signup to sendOtpHandler
router.post('/register', sendOtpHandler);
router.post('/signup', sendOtpHandler);

// ==============================================================================
// 2. Auth Step 2: POST /api/auth/verify-otp
// Verifies the 6-digit OTP against PendingSignup.
// ONLY upon matching: creates the permanent user in Supabase, deletes PendingSignup,
// and returns the JWT token + sanitized user object.
// ==============================================================================
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp, avatar } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Email and 6-digit OTP code are required.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

      // 1. Fetch pending signup record
      let pending = null;
      try {
        pending = await prisma.pendingSignup.findUnique({
          where: { email: cleanEmail },
        });
      } catch {
        pending = null;
      }

      if (!pending) {
        pending = pendingSignupsStore.get(cleanEmail);
      }

      if (!pending) {
        return res.status(400).json({
          error: 'InvalidOtp',
          message: 'No pending registration found for this email or it has expired. Please sign up again.',
        });
      }

        // 2. Validate OTP code
        if(pending.otp !== cleanOtp) {
        return res.status(400).json({
          error: 'InvalidOtp',
          message: 'Invalid 6-digit verification code. Please check your email and try again.',
        });
      }

      // 3. Validate expiration (10 minutes)
      if (new Date() > new Date(pending.expiresAt)) {
        try {
          await prisma.pendingSignup.delete({ where: { email: cleanEmail } });
        } catch { }
        pendingSignupsStore.delete(cleanEmail);

        return res.status(400).json({
          error: 'ExpiredOtp',
          message: 'Verification code has expired. Please request a new code.',
        });
      }

      // 4. Ensure user does not already exist
      const existing = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });
      if (existing) {
        return res.status(400).json({
          error: 'EmailAlreadyRegistered',
          message: 'An account with this email address already exists. Please sign in instead.',
        });
      }

      // 5. Create permanent record in User table
      const customId = await generateCustomId(prisma.user, 'USER');
      const avatarVal = typeof avatar === 'string' ? avatar : avatar?.id || null;
      const defaultAvatarUrl =
        avatar?.src ||
        `https://api.dicebear.com/10.x/micah/svg?seed=${encodeURIComponent(pending.name)}&backgroundColor=7E57C2`;

      const newUser = await prisma.user.create({
        data: {
          id: customId,
          name: pending.name,
          email: pending.email,
          phone: pending.phone || null,
          passwordHash: pending.passwordHash,
          avatar: avatarVal,
          avatarUrl: defaultAvatarUrl,
          appLanguage: 'en',
          subscriptionTier: 'free',
        },
      });

      // 6. Clean up pending record
      try {
        await prisma.pendingSignup.delete({ where: { email: cleanEmail } });
      } catch { }
      pendingSignupsStore.delete(cleanEmail);

      // 7. Generate JWT token and return session
      const token = generateToken(newUser.id);
      const userSafe = formatUserSafe(newUser);

      return res.status(201).json({
        success: true,
        message: 'Account verified and created successfully.',
        token,
        user: userSafe,
      });
    } catch (error) {
      next(error);
    }
  });

// ==============================================================================
// 3. Auth Login: POST /api/auth/login
// Authenticates verified user by email and password
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

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
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
    const userSafe = formatUserSafe(user);

    return res.json({
      message: 'Login successful',
      token,
      user: userSafe,
    });
  } catch (error) {
    next(error);
  }
});

  // ==============================================================================
  // 4. Avatar Endpoints: PATCH & PUT /api/auth/avatar
  // Protected route to update user avatar selection
  // ==============================================================================
  router.patch('/avatar', requireAuth, async (req, res, next) => {
    try {
      const { avatar } = req.body || {};
      const avatarVal = typeof avatar === 'string' ? avatar : avatar?.id || null;
      const avatarUrlVal = avatar?.src || (avatarVal ? `https://api.dicebear.com/10.x/micah/svg?seed=${encodeURIComponent(avatarVal)}&backgroundColor=7E57C2` : null);

      const updateData = {};
      if (avatarVal) updateData.avatar = avatarVal;
      if (avatarUrlVal) updateData.avatarUrl = avatarUrlVal;

        const updatedUser = await prisma.user.update({
          where: { id: req.user.id },
          data: updateData,
        });

    return res.json({
          success: true,
          message: 'Avatar updated successfully',
          user: formatUserSafe(updatedUser),
        });
      } catch (error) {
        next(error);
      }
    });

  router.put('/avatar', requireAuth, async (req, res, next) => {
    try {
      const { avatar } = req.body || {};
      const avatarVal = typeof avatar === 'string' ? avatar : avatar?.id || null;
      const avatarUrlVal = avatar?.src || null;

      const updateData = {};
      if (avatarVal) updateData.avatar = avatarVal;
      if (avatarUrlVal) updateData.avatarUrl = avatarUrlVal;

        const updatedUser = await prisma.user.update({
          where: { id: req.user.id },
          data: updateData,
        });

          return res.json({
            success: true,
            message: 'Avatar updated successfully',
            user: formatUserSafe(updatedUser),
          });
        } catch(error) {
          next(error);
        }
      });

      // ==============================================================================
      // 5. Profile Endpoints: GET & PATCH /api/user/profile
      // ==============================================================================
      router.get('/profile', requireAuth, async (req, res) => {
        return res.json(formatUserSafe(req.user));
      });

      router.patch('/profile', requireAuth, async (req, res, next) => {
        try {
          const { name, phone, avatar, avatarUrl, appLanguage, subscriptionTier } = req.body || {};
          const data = {};

          if (name && typeof name === 'string' && name.trim()) {
            data.name = name.trim();
          }
          if (phone && typeof phone === 'string') {
            data.phone = phone.trim();
          }
          if (avatar && typeof avatar === 'string') {
            data.avatar = avatar.trim();
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
          });

          return res.json({
            message: 'Profile updated successfully',
            user: formatUserSafe(updatedUser),
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

          // Return the sanitized movies array (videoStreamUrl omitted from public view)
          const movies = items.map((item) => {
            if (!item.movie) return null;
            const { videoStreamUrl, ...safeMovie } = item.movie;
            return safeMovie;
          }).filter(Boolean);
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

