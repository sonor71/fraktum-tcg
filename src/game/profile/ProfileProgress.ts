export type MatchOutcome = "win" | "loss" | "draw";

export type PlayerProfileProgress = {
  level: number;
  xp: number;
  totalXp: number;
  coins: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: string;
};

export type MatchRewardResult = {
  outcome: MatchOutcome;
  xp: number;
  coins: number;
  levelBefore: number;
  levelAfter: number;
  xpBefore: number;
  xpAfter: number;
  xpForNextBefore: number;
  xpForNextAfter: number;
  coinsBefore: number;
  coinsAfter: number;
  leveledUp: boolean;
  profile: PlayerProfileProgress;
};

const STORAGE_KEY = "fraktum.profile.progress.v1";
export const PROFILE_PROGRESS_EVENT = "fraktum:profile-progress-updated";

const WIN_XP = 120;
const WIN_COINS = 50;
const LOSS_DIVISOR = 5;

function safeNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function makeDefaultProfile(): PlayerProfileProgress {
  return {
    level: 1,
    xp: 0,
    totalXp: 0,
    coins: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeProfile(raw: Partial<PlayerProfileProgress> | null | undefined): PlayerProfileProgress {
  const fallback = makeDefaultProfile();

  return {
    level: Math.max(1, Math.floor(safeNumber(raw?.level, fallback.level))),
    xp: Math.max(0, Math.floor(safeNumber(raw?.xp, fallback.xp))),
    totalXp: Math.max(0, Math.floor(safeNumber(raw?.totalXp, fallback.totalXp))),
    coins: Math.max(0, Math.floor(safeNumber(raw?.coins, fallback.coins))),
    matchesPlayed: Math.max(0, Math.floor(safeNumber(raw?.matchesPlayed, fallback.matchesPlayed))),
    wins: Math.max(0, Math.floor(safeNumber(raw?.wins, fallback.wins))),
    losses: Math.max(0, Math.floor(safeNumber(raw?.losses, fallback.losses))),
    draws: Math.max(0, Math.floor(safeNumber(raw?.draws, fallback.draws))),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : fallback.updatedAt,
  };
}

export function getXpRequiredForLevel(level: number) {
  const safeLevel = Math.max(1, Math.floor(safeNumber(level, 1)));
  const completedLevels = safeLevel - 1;

  // Beta curve: each next level is more expensive, but early levels still move fast.
  return Math.floor(100 + completedLevels * 65 + Math.pow(completedLevels, 1.65) * 32);
}

export function getMatchRewardValues(outcome: MatchOutcome) {
  if (outcome === "win") {
    return { xp: WIN_XP, coins: WIN_COINS };
  }

  if (outcome === "loss") {
    return {
      xp: Math.max(1, Math.floor(WIN_XP / LOSS_DIVISOR)),
      coins: Math.max(1, Math.floor(WIN_COINS / LOSS_DIVISOR)),
    };
  }

  return {
    xp: Math.max(1, Math.floor(WIN_XP / 2)),
    coins: Math.max(1, Math.floor(WIN_COINS / 2)),
  };
}

export function readProfileProgress(): PlayerProfileProgress {
  if (typeof window === "undefined") return makeDefaultProfile();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultProfile();
    return normalizeProfile(JSON.parse(raw) as Partial<PlayerProfileProgress>);
  } catch {
    return makeDefaultProfile();
  }
}

function saveProfileProgress(profile: PlayerProfileProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function applyXp(profile: PlayerProfileProgress, xpToAdd: number) {
  let level = profile.level;
  let xp = profile.xp + Math.max(0, Math.floor(xpToAdd));
  let leveledUp = false;

  while (xp >= getXpRequiredForLevel(level)) {
    xp -= getXpRequiredForLevel(level);
    level += 1;
    leveledUp = true;
  }

  return { level, xp, leveledUp };
}

export function awardMatchRewards(outcome: MatchOutcome): MatchRewardResult {
  const profileBefore = readProfileProgress();
  const reward = getMatchRewardValues(outcome);
  const xpForNextBefore = getXpRequiredForLevel(profileBefore.level);
  const xpBefore = profileBefore.xp;
  const coinsBefore = profileBefore.coins;
  const appliedXp = applyXp(profileBefore, reward.xp);

  const profileAfter: PlayerProfileProgress = {
    ...profileBefore,
    level: appliedXp.level,
    xp: appliedXp.xp,
    totalXp: profileBefore.totalXp + reward.xp,
    coins: profileBefore.coins + reward.coins,
    matchesPlayed: profileBefore.matchesPlayed + 1,
    wins: profileBefore.wins + (outcome === "win" ? 1 : 0),
    losses: profileBefore.losses + (outcome === "loss" ? 1 : 0),
    draws: profileBefore.draws + (outcome === "draw" ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };

  saveProfileProgress(profileAfter);

  const result: MatchRewardResult = {
    outcome,
    xp: reward.xp,
    coins: reward.coins,
    levelBefore: profileBefore.level,
    levelAfter: profileAfter.level,
    xpBefore,
    xpAfter: profileAfter.xp,
    xpForNextBefore,
    xpForNextAfter: getXpRequiredForLevel(profileAfter.level),
    coinsBefore,
    coinsAfter: profileAfter.coins,
    leveledUp: appliedXp.leveledUp,
    profile: profileAfter,
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_PROGRESS_EVENT, { detail: result }));
  }

  return result;
}
