import { Router } from 'express';
import prisma from '../prisma.js';
import { generateCustomId } from '../utils/idGenerator.js';

const router = Router();

// Strict Allowed Submission Statuses for Dropdown Selection
export const VALID_SUBMISSION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * Normalizes and validates submission status string against the strict enum
 */
export const normalizeStatus = (status) => {
  if (!status || typeof status !== 'string') return null;
  const upper = status.trim().toUpperCase();
  return VALID_SUBMISSION_STATUSES.includes(upper) ? upper : null;
};

// ==============================================================================
// 1. GET /api/submissions
// Returns all film submissions, optionally filtered by ?status=PENDING|APPROVED|REJECTED
// Ordered by createdAt desc (or submittedAt desc)
// ==============================================================================
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};

    if (status && typeof status === 'string' && status.trim().toUpperCase() !== 'ALL') {
      const normalized = normalizeStatus(status);
      if (!normalized) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Invalid status filter '${status}'. Allowed values are: ${VALID_SUBMISSION_STATUSES.join(', ')}`,
          validStatuses: VALID_SUBMISSION_STATUSES,
        });
      }
      where.status = normalized;
    }

    const submissions = await prisma.filmSubmission.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(submissions);
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 2. GET /api/submissions/:id
// Returns complete details for a single submission by custom ID (e.g., SUB2026001).
// ==============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid submission ID.',
      });
    }

    const cleanId = id.trim();
    const submission = await prisma.filmSubmission.findUnique({
      where: { id: cleanId },
    });

    if (!submission) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Film submission with id '${id}' was not found.`,
      });
    }

    return res.json(submission);
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 3. POST /api/submissions
// Validates (filmTitle, directorName, email, screenerLink, synopsis)
// and saves a new record in FilmSubmission model with default status 'PENDING'.
// ==============================================================================
router.post('/', async (req, res, next) => {
  try {
    const {
      filmTitle,
      directorName,
      email,
      screenerLink,
      synopsis,
      status,
      reason,
      reviewReason,
    } = req.body || {};

    const validationErrors = [];

    if (!filmTitle || typeof filmTitle !== 'string' || !filmTitle.trim()) {
      validationErrors.push('filmTitle is required and cannot be empty.');
    }

    if (!directorName || typeof directorName !== 'string' || !directorName.trim()) {
      validationErrors.push('directorName is required and cannot be empty.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      validationErrors.push('email is required and must be a valid email address.');
    }

    if (!screenerLink || typeof screenerLink !== 'string' || !screenerLink.trim()) {
      validationErrors.push('screenerLink is required and cannot be empty.');
    } else {
      try {
        const parsedUrl = new URL(screenerLink.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          validationErrors.push('screenerLink must use http or https protocol.');
        }
      } catch {
        validationErrors.push('screenerLink must be a valid URL.');
      }
    }

    if (!synopsis || typeof synopsis !== 'string' || !synopsis.trim()) {
      validationErrors.push('synopsis is required and cannot be empty.');
    }

    // Validate status if explicitly provided in body
    let finalStatus = 'PENDING';
    if (status) {
      const normalized = normalizeStatus(status);
      if (!normalized) {
        validationErrors.push(
          `Invalid status '${status}'. Must be one of: ${VALID_SUBMISSION_STATUSES.join(', ')}`
        );
      } else {
        finalStatus = normalized;
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Film submission validation failed.',
        details: validationErrors,
        validStatuses: VALID_SUBMISSION_STATUSES,
      });
    }

    const finalReason =
      reason !== undefined
        ? reason
        : reviewReason !== undefined
        ? reviewReason
        : null;

    const customId = await generateCustomId(prisma.filmSubmission, 'SUB2026');

    const submission = await prisma.filmSubmission.create({
      data: {
        id: customId,
        filmTitle: filmTitle.trim(),
        directorName: directorName.trim(),
        email: email.trim().toLowerCase(),
        screenerLink: screenerLink.trim(),
        synopsis: synopsis.trim(),
        status: finalStatus,
        reason: finalReason ? String(finalReason).trim() : null,
        reviewReason: finalReason ? String(finalReason).trim() : null,
      },
    });

    return res.status(201).json({
      message:
        'Film submission created successfully. Our curatorial committee will review your screener.',
      submission,
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// 4. PATCH /api/submissions/:id (and PUT /api/submissions/:id)
// Updates submission status (enforcing PENDING, APPROVED, REJECTED),
// records rejection or approval reason, and tracks timestamps automatically.
// ==============================================================================
const handleUpdateSubmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason, reviewReason, synopsis, filmTitle, directorName } =
      req.body || {};

    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid submission ID.',
      });
    }

    const cleanId = id.trim();
    const existing = await prisma.filmSubmission.findUnique({
      where: { id: cleanId },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Film submission with id '${id}' was not found.`,
      });
    }

    const updateData = {};

    // Enforce strict status dropdown validation
    if (status !== undefined) {
      const normalizedStatus = normalizeStatus(status);
      if (!normalizedStatus) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Invalid submission status '${status}'. Allowed dropdown values are: ${VALID_SUBMISSION_STATUSES.join(
            ', '
          )}.`,
          validStatuses: VALID_SUBMISSION_STATUSES,
        });
      }
      updateData.status = normalizedStatus;
    }

    // Update rejection/approval reason
    const incomingReason =
      reason !== undefined ? reason : reviewReason !== undefined ? reviewReason : undefined;

    if (incomingReason !== undefined) {
      const sanitizedReason = incomingReason ? String(incomingReason).trim() : null;
      updateData.reason = sanitizedReason;
      updateData.reviewReason = sanitizedReason;
    }

    if (synopsis && typeof synopsis === 'string' && synopsis.trim()) {
      updateData.synopsis = synopsis.trim();
    }
    if (filmTitle && typeof filmTitle === 'string' && filmTitle.trim()) {
      updateData.filmTitle = filmTitle.trim();
    }
    if (directorName && typeof directorName === 'string' && directorName.trim()) {
      updateData.directorName = directorName.trim();
    }

    // Prisma automatically sets updatedAt on update
    const updatedSubmission = await prisma.filmSubmission.update({
      where: { id: cleanId },
      data: updateData,
    });

    const statusMessage =
      updateData.status === 'APPROVED'
        ? `Film submission '${updatedSubmission.filmTitle}' has been APPROVED for Aspectt curation.`
        : updateData.status === 'REJECTED'
        ? `Film submission '${updatedSubmission.filmTitle}' has been REJECTED with feedback recorded.`
        : `Film submission status updated to ${updatedSubmission.status}.`;

    return res.json({
      message: statusMessage,
      submission: updatedSubmission,
    });
  } catch (error) {
    next(error);
  }
};

router.patch('/:id', handleUpdateSubmission);
router.put('/:id', handleUpdateSubmission);

// ==============================================================================
// 5. DELETE /api/submissions/:id
// Removes a submission from the review database.
// ==============================================================================
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid submission ID.',
      });
    }

    const cleanId = id.trim();
    const existing = await prisma.filmSubmission.findUnique({
      where: { id: cleanId },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Film submission with id '${id}' was not found.`,
      });
    }

    await prisma.filmSubmission.delete({
      where: { id: cleanId },
    });

    return res.json({
      message: `Film submission '${existing.filmTitle}' deleted successfully.`,
      id: cleanId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
