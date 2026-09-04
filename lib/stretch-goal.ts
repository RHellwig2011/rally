/**
 * Moving-goal math. Every amount is BigInt cents.
 *
 * Stretch is applied by the hourly campaign-automation cron via a
 * conditional updateMany keyed on the observed goalAmount, so two overlapping
 * ticks cannot double-stretch.
 */

export const STRETCH_GOAL_CAP_MULTIPLIER = BigInt(4);

/** Round cents up to the next whole dollar (100 cents). */
export function roundUpToWholeDollar(cents: bigint): bigint {
  if (cents <= BigInt(0)) return BigInt(0);
  const rem = cents % BigInt(100);
  return rem === BigInt(0) ? cents : cents + (BigInt(100) - rem);
}

/** Raise `goalAmount` by `stretchPercent`, rounding up to a whole dollar. */
export function computeStretchedGoalAmount(
  goalAmount: bigint,
  stretchPercent: number
): bigint {
  const stretched =
    (goalAmount * BigInt(100 + stretchPercent) + BigInt(99)) / BigInt(100);
  return roundUpToWholeDollar(stretched);
}

/**
 * True when currentAmount is at or past triggerPercent of goalAmount.
 * Multiplies both sides by 100 so the percent comparison stays in integer cents.
 */
export function isStretchTriggered(
  currentAmount: bigint,
  goalAmount: bigint,
  triggerPercent: number
): boolean {
  if (goalAmount <= BigInt(0)) return false;
  return currentAmount * BigInt(100) >= goalAmount * BigInt(triggerPercent);
}

export function originalGoalForCap(
  goalAmount: bigint,
  originalGoalAmount: bigint | null
): bigint {
  return originalGoalAmount ?? goalAmount;
}

export function isAtStretchCap(
  goalAmount: bigint,
  originalGoalAmount: bigint
): boolean {
  return goalAmount >= originalGoalAmount * STRETCH_GOAL_CAP_MULTIPLIER;
}

/**
 * Next goal after one stretch, or null if this campaign should not move
 * (not at trigger, already at/past 4x original, or stretch would not raise).
 */
export function nextStretchGoalAmount(params: {
  currentAmount: bigint;
  goalAmount: bigint;
  originalGoalAmount: bigint | null;
  stretchPercent: number;
  triggerPercent: number;
}): bigint | null {
  const original = originalGoalForCap(
    params.goalAmount,
    params.originalGoalAmount
  );
  if (isAtStretchCap(params.goalAmount, original)) return null;
  if (
    !isStretchTriggered(
      params.currentAmount,
      params.goalAmount,
      params.triggerPercent
    )
  ) {
    return null;
  }
  const stretched = computeStretchedGoalAmount(
    params.goalAmount,
    params.stretchPercent
  );
  const cap = original * STRETCH_GOAL_CAP_MULTIPLIER;
  const next = stretched > cap ? cap : stretched;
  if (next <= params.goalAmount) return null;
  return next;
}
