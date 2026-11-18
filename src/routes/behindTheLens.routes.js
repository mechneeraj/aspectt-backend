import { Router } from 'express';
import prisma from '../prisma.js';
import { generateCustomId } from '../utils/idGenerator.js';

const router = Router();

/**
 * Normalizes BehindTheLens database records for consistent API output
 * using personName and role as the single source of truth.
 */
export const normalizeClipRecord = (clip) => {
  if (!clip) return null;
  const person = clip.personName || 'Artist';
  const role = clip.role || 'Filmmaker';
  const video = clip.videoUrl || clip.clipUrl || '';
  const details = clip.details || clip.cameraNote || '';
  const filmography = clip.filmography || '';
  const title = clip.title || '';
  const thumb = clip.thumbnailUrl || '';

  return {
    id: clip.id,
    personName: person,
    role: role,
    title: title,
    details: details,
    filmography: filmography,
    videoUrl: video,
    thumbnailUrl: thumb,
    duration: clip.duration || '3m 00s',
    createdAt: clip.createdAt,
    // Backward compatibility aliases for UI components expecting these fields
    director: person,
    cameraNote: details,
    clipUrl: video,
    image: thumb,
  };
};

// ==============================================================================
// 1. GET /api/behind-the-lens
// Returns all behind-the-scenes clips ordered by createdAt desc.
// ==============================================================================
router.get('/', async (req, res, next) => {
  try {
    const clips = await prisma.behindTheLens.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(clips.map(normalizeClipRecord));
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 2. GET /api/behind-the-lens/:id
// Returns a single clip by its ID.
// ==============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const clip = await prisma.behindTheLens.findUnique({
      where: { id },
    });

    if (!clip) {
      return res.status(404).json({ error: 'NotFound', message: 'Clip not found' });
    }

    return res.json(normalizeClipRecord(clip));
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 3. POST /api/behind-the-lens
// Create a new Behind the Lens clip (Filmmaker, Actor, Crew, etc.)
// ==============================================================================
router.post('/', async (req, res, next) => {
  try {
    const {
      personName,
      role = 'Filmmaker',
      title,
      details,
      filmography,
      videoUrl,
      thumbnailUrl,
      duration = '3m 00s',
    } = req.body;

    if (!personName || typeof personName !== 'string' || !personName.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Person / Team Name is required.',
      });
    }

    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Video or YouTube URL is required.',
      });
    }

    const trimmedPerson = personName.trim();
    const trimmedRole = role && typeof role === 'string' && role.trim() ? role.trim() : 'Filmmaker';
    const trimmedVideo = videoUrl.trim();
    const trimmedTitle = title && typeof title === 'string' && title.trim() ? title.trim() : null;
    const trimmedDetails = details && typeof details === 'string' && details.trim() ? details.trim() : null;
    const trimmedFilmography =
      filmography && typeof filmography === 'string' && filmography.trim() ? filmography.trim() : null;
    const trimmedThumb =
      thumbnailUrl && typeof thumbnailUrl === 'string' && thumbnailUrl.trim()
        ? thumbnailUrl.trim()
        : 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80';

    const id = await generateCustomId(prisma.behindTheLens, 'BTL');

    const created = await prisma.behindTheLens.create({
      data: {
        id,
        personName: trimmedPerson,
        role: trimmedRole,
        title: trimmedTitle,
        details: trimmedDetails,
        filmography: trimmedFilmography,
        videoUrl: trimmedVideo,
        thumbnailUrl: trimmedThumb,
        duration: duration ? duration.trim() : '3m 00s',
        // Legacy fallback sync
        cameraNote: trimmedDetails || '',
        clipUrl: trimmedVideo,
      },
    });

    return res.status(201).json(normalizeClipRecord(created));
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 4. PUT /api/behind-the-lens/:id
// Update an existing Behind the Lens clip
// ==============================================================================
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      personName,
      role,
      title,
      details,
      filmography,
      videoUrl,
      thumbnailUrl,
      duration,
    } = req.body;

    const existing = await prisma.behindTheLens.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'NotFound', message: 'Clip not found' });
    }

    const updateData = {};
    if (personName !== undefined) {
      updateData.personName = personName ? personName.trim() : existing.personName;
    }
    if (role !== undefined) {
      updateData.role = role && role.trim() ? role.trim() : 'Filmmaker';
    }
    if (title !== undefined) {
      updateData.title = title && title.trim() ? title.trim() : null;
    }
    if (details !== undefined) {
      updateData.details = details && details.trim() ? details.trim() : null;
      updateData.cameraNote = updateData.details || '';
    }
    if (filmography !== undefined) {
      updateData.filmography = filmography && filmography.trim() ? filmography.trim() : null;
    }
    if (videoUrl !== undefined) {
      updateData.videoUrl = videoUrl ? videoUrl.trim() : existing.videoUrl;
      updateData.clipUrl = updateData.videoUrl;
    }
    if (thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = thumbnailUrl && thumbnailUrl.trim() ? thumbnailUrl.trim() : null;
    }
    if (duration !== undefined) {
      updateData.duration = duration ? duration.trim() : '3m 00s';
    }

    const updated = await prisma.behindTheLens.update({
      where: { id },
      data: updateData,
    });

    return res.json(normalizeClipRecord(updated));
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 5. DELETE /api/behind-the-lens/:id
// Delete a Behind the Lens clip
// ==============================================================================
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.behindTheLens.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'NotFound', message: 'Clip not found' });
    }

    await prisma.behindTheLens.delete({ where: { id } });
    return res.json({ success: true, message: 'Clip deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
