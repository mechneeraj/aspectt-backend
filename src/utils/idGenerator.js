/**
 * ==============================================================================
 * Aspectt OTT Platform - Scalable Custom ID Generator Helper
 * ==============================================================================
 * Generates human-readable, hyphen-free IDs formatted with a prefix and zero-padded
 * numeric suffix (e.g., MOV001, USER001, SUB2026001, BTL001).
 *
 * Scales seamlessly beyond 999 (e.g. USER999 -> USER1000 -> USER999999+)
 * by computing the true numeric maximum with Math.max(...) in memory, avoiding
 * lexicographical string-sorting bugs that occur with database orderBy on strings.
 */

/**
 * Generates the next sequential custom ID for a given Prisma model delegate.
 *
 * @param {object} prismaModel - Prisma model delegate (e.g. prisma.user, prisma.filmSubmission)
 * @param {string} prefix - Hyphen-free prefix (e.g. 'MOV', 'SUB2026', 'USER', 'BTL')
 * @returns {Promise<string>} Next custom ID (e.g. 'MOV001', 'SUB2026001')
 */
export async function generateCustomId(prismaModel, prefix) {
  if (!prismaModel || typeof prismaModel.findMany !== 'function') {
    throw new Error('generateCustomId requires a valid Prisma model delegate with findMany.');
  }

  if (!prefix || typeof prefix !== 'string') {
    throw new Error('generateCustomId requires a valid non-empty prefix string.');
  }

  // 1. Fetch all existing IDs that begin with the prefix
  const records = await prismaModel.findMany({
    where: {
      id: {
        startsWith: prefix,
      },
    },
    select: {
      id: true,
    },
  });

  // 2. Extract numeric suffix: parseInt(id.replace(prefix, ''), 10)
  const numbers = records.map((record) => {
    if (!record || typeof record.id !== 'string') return 0;
    const rawNum = record.id.startsWith(prefix)
      ? record.id.slice(prefix.length)
      : record.id.replace(prefix, '');
    const parsed = parseInt(rawNum, 10);
    return isNaN(parsed) ? 0 : parsed;
  });

  // 3. Find true numeric maximum, defaulting to 0 if no matching records exist
  const maxNumber = Math.max(0, ...numbers);

  // 4. Increment by 1
  const nextNum = maxNumber + 1;

  // 5. Format with minimum 3-digit zero-padding (scales to 4+ digits naturally: 1000 -> "1000")
  const paddedSuffix = String(nextNum).padStart(3, '0');

  return `${prefix}${paddedSuffix}`;
}

export default generateCustomId;

