import { Router } from 'express';
import prisma from '../prisma.js';
import requireAuth from '../middleware/auth.js';

const router = Router();

/**
 * Strips sensitive video stream URL fields from public movie payloads
 * Ensures .m3u8 URLs cannot be inspected or scraped by unauthenticated users.
 */
export const sanitizeMovie = (movie) => {
  if (!movie) return null;
  const { videoStreamUrl, ...safeMovie } = movie;
  return safeMovie;
};

// ==============================================================================
// 1. GET /api/movies/hero
// Must be registered BEFORE /:id so 'hero' is not captured as an id parameter.
// Returns only the movies where isHeroFeatured is true (limit 4).
// Public metadata only (videoStreamUrl omitted).
// ==============================================================================
router.get('/hero', async (req, res, next) => {
  try {
    const heroMovies = await prisma.movie.findMany({
      where: {
        isHeroFeatured: true,
      },
      take: 4,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(heroMovies.map(sanitizeMovie));
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 2. GET /api/movies
// Returns all movies ordered by createdAt desc with optional query filters:
// - search: case-insensitive partial match on title or director
// - genre: filters movies whose genres array contains the requested genre
// - year: filters by releaseYear
// - curated: when req.query.curated === 'true', filters movies by isCurated: true
// ==============================================================================
router.get('/', async (req, res, next) => {
  try {
    const { search, genre, year, curated } = req.query;
    const where = {};

    // Filter: curated (when req.query.curated === 'true', filters by isCurated: true)
    if (curated === 'true') {
      where.isCurated = true;
    }

    // Filter: search (case-insensitive partial match on title or director)
    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { director: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Filter: genre (genres array contains requested genre)
    if (
      genre &&
      typeof genre === 'string' &&
      genre.trim() !== '' &&
      genre.trim().toLowerCase() !== 'all'
    ) {
      const rawGenre = genre.trim();
      // Support both raw format and title-cased format (e.g. 'sci-fi' -> 'Sci-Fi')
      const normalizedGenre =
        rawGenre.toLowerCase() === 'sci-fi'
          ? 'Sci-Fi'
          : rawGenre.charAt(0).toUpperCase() + rawGenre.slice(1).toLowerCase();

      const genreOptions = Array.from(new Set([rawGenre, normalizedGenre]));
      where.genres = {
        hasSome: genreOptions,
      };
    }

    // Filter: year (filters by releaseYear)
    if (
      year &&
      typeof year === 'string' &&
      year.trim() !== '' &&
      year.trim().toLowerCase() !== 'all'
    ) {
      const parsedYear = parseInt(year.trim(), 10);
      if (!isNaN(parsedYear)) {
        where.releaseYear = parsedYear;
      }
    }

    const movies = await prisma.movie.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(movies.map(sanitizeMovie));
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 3. GET /api/movies/:id/stream
// Protected playback endpoint: requires valid JWT Bearer token via requireAuth.
// Returns the protected videoStreamUrl (.m3u8) for authenticated playback only.
// Returns 401 if unauthenticated, 404 if movie not found.
// Must be registered BEFORE /:id so Express resolves /stream correctly.
// ==============================================================================
router.get('/:id/stream', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid movie ID or slug.',
      });
    }

    const cleanId = id.trim();

    // 1. Match by custom ID (e.g. MOV001)
    let movie = await prisma.movie.findUnique({
      where: { id: cleanId },
      select: {
        id: true,
        title: true,
        videoStreamUrl: true,
      },
    });

    // 2. Fallback: match by slug
    if (!movie) {
      movie = await prisma.movie.findUnique({
        where: { slug: cleanId },
        select: {
          id: true,
          title: true,
          videoStreamUrl: true,
        },
      });
    }

    if (!movie) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Movie with id or slug '${id}' was not found.`,
      });
    }

    return res.json({
      movieId: movie.id,
      title: movie.title,
      streamUrl: movie.videoStreamUrl,
      videoStreamUrl: movie.videoStreamUrl,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 4. GET /api/movies/:id
// Returns complete details for a single movie by custom id (e.g. MOV001) or slug.
// Public metadata only (videoStreamUrl omitted).
// Returns 404 if not found.
// ==============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid movie ID or slug.',
      });
    }

    const cleanId = id.trim();

    // 1. Direct match by ID (e.g. MOV001)
    let movie = await prisma.movie.findUnique({
      where: { id: cleanId },
    });

    // 2. Fallback: check by slug for slug-friendly URLs
    if (!movie) {
      movie = await prisma.movie.findUnique({
        where: { slug: cleanId },
      });
    }

    if (!movie) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Movie with id or slug '${id}' was not found.`,
      });
    }

    return res.json(sanitizeMovie(movie));
  } catch (error) {
    next(error);
  }
});

export default router;

