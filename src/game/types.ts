export const CARD_RARITIES = [
  "common",
  "rare",
  "epic",
  "mythic",
  "legendary",
  "chromatic",
  "exotic",
  "divine",
  "forgotten",
  "archaic",
] as const;

export type CardRarity = (typeof CARD_RARITIES)[number];

export const CARD_EDITIONS = ["serial", "foil_serial"] as const;
export type CardEdition = (typeof CARD_EDITIONS)[number];

export type CardType =
  | "character"
  | "attack"
  | "tactic"
  | "effect"
  | "bonus"
  | "event";
  
export type CardKind = CardType;

export interface CardDefinition {
  id: string;
  title: string;
  name?: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  attack: number;
  health: number;
  description: string;
  text?: string;
  image: string;
  frontSrc?: string;
  effectKey: string;
  collection: string;
}

export interface OwnedCard {
  instanceId: string;
  baseId: string;
  title: string;
  rarity: CardRarity;
  type: CardType;
  image: string;
  frontSrc: string;
  packId?: string;
  obtainedAt: number;
  isNew?: boolean;
  edition: CardEdition;
  isFoil: boolean;
  foilColor?: CardRarity;
  marketValue: number;
  cost: number;
  attack: number;
  health: number;
  description: string;
  effectKey: string;
  collection: string;
}

export interface PlayerSettings {
  sound: boolean;
  music: boolean;
  reducedMotion: boolean;
}

export type FriendStatus = "online" | "offline" | "in_match";

export interface FriendEntry {
  id: string;
  nickname: string;
  status: FriendStatus;
}

export interface PendingPackPurchase {
  packId: string;
  createdAt: number;
}

export interface MatchResult {
  coins: number;
  xp: number;
  finishedAt: number;
  winner?: "player" | "ai" | string | null;
  result?: string;
  [key: string]: unknown;
}

export interface MatchHistoryEntry extends MatchResult {
  id: string;
  appliedAt: number;
}

export const AUCTION_STATUSES = ["active", "sold", "expired", "cancelled"] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export interface AuctionListing {
  id: string;
  sellerId: "player" | string;
  sellerName: string;
  card: OwnedCard;
  startingPrice: number;
  currentBid: number;
  buyoutPrice?: number;
  bidCount: number;
  listedAt: number;
  endsAt: number;
  status: AuctionStatus;
  highestBidder?: string;
  nextNpcBidAt?: number;
  salePrice?: number;
  claimedAt?: number;
}

export type AuctionClaimResult =
  | { kind: "sold"; gross: number; fee: number; net: number }
  | { kind: "returned"; card: OwnedCard };

export type MarketPurchaseResult =
  | { ok: true; card: OwnedCard; price: number }
  | { ok: false; reason: "unknown_card" | "insufficient_premium" | "invalid_price"; price?: number };
