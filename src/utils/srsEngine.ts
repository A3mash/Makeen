export interface SRSData {
  interval: number; // in days
  easeFactor: number;
  repetitions: number;
}

export interface SRSResult extends SRSData {
  nextReviewDate: number; // timestamp
}

/**
 * Simplified SM-2 Algorithm
 * @param currentData Current SRS data for the card
 * @param quality Quality of response (0 to 5, where 0=Complete blackout, 5=Perfect response)
 *                If boolean is provided: true = 4, false = 0
 */
export function calculateNextReview(currentData: SRSData, quality: number | boolean): SRSResult {
  let { interval, easeFactor, repetitions } = currentData;
  
  const numericQuality = typeof quality === 'boolean' ? (quality ? 4 : 0) : quality;

  if (numericQuality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect response
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor (SM-2 formula)
  easeFactor = easeFactor + (0.1 - (5 - numericQuality) * (0.08 + (5 - numericQuality) * 0.02));
  
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // Calculate next review date by adding 'interval' days to current date
  const now = new Date();
  const nextReviewDate = now.getTime() + interval * 24 * 60 * 60 * 1000;

  return {
    interval,
    easeFactor,
    repetitions,
    nextReviewDate
  };
}
