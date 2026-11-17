import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { generateCustomId } from '../utils/idGenerator.js';
import { generateOtp, storeOtp, verifyOtp, sendOtpEmail } from '../utils/emailService.js';
import { memorySubscriptions, checkUserSubscriptionActive } from './subscription.routes.js';

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
  subscriptionTier: user.subscriptionTier || 'FREE',
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

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();
      const cleanPhone = phone && typeof phone === 'string' ? phone.trim() : null;
      const cleanPhoneDigits = cleanPhone ? cleanPhone.replace(/\D/g, '') : null;

      // Validate mobile number format if provided
      if (cleanPhone && cleanPhoneDigits.length !== 10) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'Please enter a valid 10-digit mobile number.',
        });
      }

      // Strong password validation: at least 6 chars, uppercase, lowercase, number, symbol
      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'Password is required.',
        });
      }

      const hasMinLength = password.length >= 6;
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSymbol = /[^A-Za-z0-9]/.test(password);

      if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'Password must be at least 6 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.',
        });
      }

      // 1. Check if email is already registered in permanent User table
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'EmailAlreadyRegistered',
          message: 'An account with this email address already exists. Please sign in instead.',
        });
      }

      // 2. Check if mobile number is already registered in permanent User table
      if (cleanPhone) {
        const existingPhoneUser = await prisma.user.findFirst({
          where: {
            OR: [
              { phone: cleanPhone },
              ...(cleanPhoneDigits
                ? [
                    { phone: cleanPhoneDigits },
                    { phone: `+91${cleanPhoneDigits}` },
                    { phone: `+91 ${cleanPhoneDigits}` },
                  ]
                : []),
            ],
          },
        });

        if (existingPhoneUser) {
          return res.status(400).json({
            error: 'PhoneAlreadyRegistered',
            message: 'An account with this mobile number already exists. Please sign in instead.',
          });
        }
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

      // 4. Ensure email and mobile number do not already exist
      const existing = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });
      if (existing) {
        return res.status(400).json({
          error: 'EmailAlreadyRegistered',
          message: 'An account with this email address already exists. Please sign in instead.',
        });
      }

      if (pending.phone) {
        const cleanPendingDigits = String(pending.phone).replace(/\D/g, '');
        const existingPhone = await prisma.user.findFirst({
          where: {
            OR: [
              { phone: pending.phone },
              ...(cleanPendingDigits
                ? [
                    { phone: cleanPendingDigits },
                    { phone: `+91${cleanPendingDigits}` },
                    { phone: `+91 ${cleanPendingDigits}` },
                  ]
                : []),
            ],
          },
        });
        if (existingPhone) {
          return res.status(400).json({
            error: 'PhoneAlreadyRegistered',
            message: 'An account with this mobile number already exists. Please sign in instead.',
          });
        }
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
          subscriptionTier: 'FREE',
        },
      });

      // 5b. Automatically create initial NOT_ACTIVE record in Subscription table
      try {
        await prisma.subscription.create({
          data: {
            userId: newUser.id,
            planName: 'NONE',
            amount: 0,
            currency: 'INR',
            status: 'NOT_ACTIVE',
            startDate: null,
            expiryDate: null,
          },
        });
      } catch (subErr) {
        console.warn('Subscription initial row DB note (persisting in memory):', subErr.message);
        memorySubscriptions.set(newUser.id, {
          id: `sub_${Date.now()}`,
          userId: newUser.id,
          planName: 'NONE',
          amount: 0,
          currency: 'INR',
          status: 'NOT_ACTIVE',
          startDate: null,
          expiryDate: null,
          updatedAt: new Date(),
        });
      }

      // 6. Clean up pending record
      try {
        await prisma.pendingSignup.delete({ where: { email: cleanEmail } });
      } catch { }
      pendingSignupsStore.delete(cleanEmail);

      // 7. Generate JWT token and return session (with isSubscribed: false)
      const token = generateToken(newUser.id);
      const userSafe = formatUserSafe(newUser);

      return res.status(201).json({
        success: true,
        message: 'Account verified and created successfully.',
        token,
        user: userSafe,
        isSubscribed: false,
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
      include: {
        subscription: true,
      },
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

    // Verify active subscription strictly against Subscription table
    const now = new Date();
    const hasActiveSub = Boolean(
      user.subscription &&
      user.subscription.status === 'ACTIVE' &&
      user.subscription.expiryDate &&
      new Date(user.subscription.expiryDate) > now
    );

    // If user has no Subscription record at all, automatically create NOT_ACTIVE record
    if (!user.subscription) {
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
      } catch (subErr) {
        memorySubscriptions.set(user.id, {
          id: `sub_${Date.now()}`,
          userId: user.id,
          planName: 'NONE',
          amount: 0,
          currency: 'INR',
          status: 'NOT_ACTIVE',
          startDate: null,
          expiryDate: null,
          updatedAt: new Date(),
        });
      }
    }

    // Strictly sync subscriptionTier: "PRO" only if active subscription exists, else "FREE"
    const targetTier = hasActiveSub ? 'PRO' : 'FREE';
    if (user.subscriptionTier !== targetTier) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionTier: targetTier },
        });
      } catch { }
      user.subscriptionTier = targetTier;
    }

    const token = generateToken(user.id);
    const userSafe = formatUserSafe(user);

    return res.json({
      message: 'Login successful',
      token,
      user: userSafe,
      isSubscribed: hasActiveSub,
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
        const isSubActive = await checkUserSubscriptionActive(req.user.id);
        const safeUser = formatUserSafe(req.user);
        if (!isSubActive && safeUser.subscriptionTier !== 'FREE' && safeUser.subscriptionTier !== 'free') {
          safeUser.subscriptionTier = 'FREE';
        }
        return res.json(safeUser);
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
            // Strictly guard tier: only set PRO if user has verified active subscription
            const isSubActive = await checkUserSubscriptionActive(req.user.id);
            data.subscriptionTier = isSubActive ? 'PRO' : 'FREE';
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

