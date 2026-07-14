import { useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGameStore } from "../useGameStore";
import type { OwnedCard } from "../game/types";
import { CloudAutoSync } from "../cloud/CloudAutoSync";
import { createHubRoomSearch, getHubRoomFromSearch, HUB_QUICK_ROOMS, type HubQuickRoomId } from "../screens/Hub/hubNavigation";

type UtilityPanel = "friends" | "battlePass" | "dailyQuests" | "leaderboard";

const TOP_NAV = [
  { label: "Hub", path: "/" },
  { label: "Collection", path: "/collection" },
  { label: "Deck", path: "/deck" },
  { label: "Market", path: "/market" },
  { label: "Shop", path: "/shop" },
  { label: "Profile", path: "/profile" },
  { label: "Settings", path: "/settings" },
];

const BATTLE_PASS_REWARDS = [
  { level: 1, title: "100 Coins", kind: "coins" },
  { level: 2, title: "200 Coins", kind: "coins" },
  { level: 3, title: "25 Premium", kind: "premium" },
  { level: 4, title: "Rare Card", kind: "card" },
  { level: 5, title: "500 Coins", kind: "coins" },
  { level: 6, title: "50 Premium", kind: "premium" },
  { level: 7, title: "Epic Card", kind: "card" },
  { level: 8, title: "750 Coins", kind: "coins" },
  { level: 9, title: "75 Premium", kind: "premium" },
  { level: 10, title: "Mythic Card", kind: "card" },
];

const RARITY_VALUE: Record<string, number> = {
  common: 1,
  rare: 2,
  epic: 4,
  mythic: 7,
  legendary: 11,
  chromatic: 18,
  exotic: 26,
  divine: 40,
  forgotten: 70,
  archaic: 120,
};

const MOCK_LEADERBOARD = [
  { nickname: "Astra", wins: 42, deckValue: 860 },
  { nickname: "NullHunter", wins: 39, deckValue: 940 },
  { nickname: "Orion", wins: 31, deckValue: 610 },
  { nickname: "Valkyrie", wins: 24, deckValue: 720 },
  { nickname: "Echo-17", wins: 18, deckValue: 510 },
];

function statusLabel(status: string) {
  if (status === "online") return "online";
  if (status === "in_match") return "in match";
  return "offline";
}

function getDeckValue(deckIds: string[], ownedCards: OwnedCard[]) {
  const ownedById = new Map(ownedCards.map((card) => [card.instanceId, card]));
  return deckIds.reduce((sum, id) => {
    const card = ownedById.get(id);
    return sum + (card ? RARITY_VALUE[String(card.rarity)] ?? 0 : 0);
  }, 0);
}


function HubRoomIcon({ roomId }: { roomId: HubQuickRoomId }) {
  if (roomId === "market") {
    return (
      <svg className="hubRoomIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.2h16v9.3H4z" />
        <path d="M3.2 9.9 5.4 4.5h13.2l2.2 5.4c-.45 1.35-1.35 2.03-2.7 2.03-1.23 0-2.13-.53-2.7-1.58-.57 1.05-1.47 1.58-2.7 1.58-1.22 0-2.12-.53-2.7-1.58-.57 1.05-1.47 1.58-2.7 1.58-1.35 0-2.25-.68-2.7-2.03Z" />
        <path className="hubRoomIconCut" d="M8 19.5v-5.2h4v5.2M14.5 14.3h2.8v2.8h-2.8z" />
      </svg>
    );
  }

  if (roomId === "arena") {
    return (
      <svg className="hubRoomIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7.2 3.2 2.3 2.3-5.2 8.8-1.7.8.8-1.7 8.8-5.2-2.3-2.3Z" />
        <path d="m16.8 3.2-2.3 2.3 5.2 8.8 1.7.8-.8-1.7-8.8-5.2 2.3-2.3Z" />
        <path d="M8.8 15.2 12 12l3.2 3.2-3.2 5.6-3.2-5.6Z" />
      </svg>
    );
  }

  return (
    <svg className="hubRoomIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.2 4.2h6.6c1.1 0 1.9.35 2.4 1.05.5-.7 1.3-1.05 2.4-1.05h4.2v14.5h-4.6c-.9 0-1.57.3-2 .9-.43-.6-1.1-.9-2-.9h-7V4.2Z" />
      <path className="hubRoomIconCut" d="M12 5.8v12.8M6.8 8h3.2M6.8 11h3.2M14.2 8h3M14.2 11h3" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.5C5 4.57 6.57 3 8.5 3h7C17.43 3 19 4.57 19 6.5v5C19 13.43 17.43 15 15.5 15H11l-4.5 4v-4.4A3.5 3.5 0 0 1 5 11.5v-5Z" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2.67 5.41 5.97.87-4.32 4.21 1.02 5.95L12 16.63l-5.34 2.81 1.02-5.95-4.32-4.21 5.97-.87L12 3Z" />
    </svg>
  );
}

function IconHexStar() {
  return (
    <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8 15 8l6 .2-3.2 5.1 2.7 5.4-6-.3L12 21.2l-2.5-2.8-6 .3 2.7-5.4L3 8.2 9 8l3-5.2Z" />
    </svg>
  );
}

function IconCompass() {
  return (
    <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 15.2 9l6.3 3-6.3 3L12 21.5 8.8 15l-6.3-3 6.3-3L12 2.5Z" />
      <circle className="iconFill" cx="12" cy="12" r="1.6" />
    </svg>
  );
}

function FriendsPanel({ onClose, onNavigateToMatch }: { onClose: () => void; onNavigateToMatch: () => void }) {
  const friends = useGameStore((state) => state.friends);
  const addFriendByNickname = useGameStore((state) => state.addFriendByNickname);
  const [nickname, setNickname] = useState("");
  const [notice, setNotice] = useState("");

  const handleAddFriend = () => {
    const added = addFriendByNickname(nickname);
    setNotice(added ? `Игрок ${nickname.trim()} добавлен в друзья.` : "Ник слишком короткий или уже есть в списке.");
    if (added) setNickname("");
  };

  return (
    <div className="utilityPanel">
      <p className="utilityKicker">Social</p>
      <h2>Друзья</h2>
      <p className="utilityText">Локальная заготовка под друзей, матч и обмен. Настоящий онлайн потом подключается через сервер.</p>

      <div className="utilityInputRow">
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Ник игрока"
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAddFriend();
          }}
        />
        <button type="button" onClick={handleAddFriend}>Добавить</button>
      </div>

      {notice ? <div className="utilityNotice">{notice}</div> : null}

      <div className="friendList">
        {friends.map((friend) => (
          <article className="friendCard" key={friend.id}>
            <div>
              <strong>{friend.nickname}</strong>
              <span className={`friendStatus is-${friend.status}`}>{statusLabel(friend.status)}</span>
            </div>

            <div className="friendActions">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToMatch();
                }}
              >
                Матч
              </button>
              <button type="button" onClick={() => setNotice(`Предложение обмена для ${friend.nickname} подготовлено. Серверная логика будет позже.`)}>
                Обмен
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function BattlePassPanel() {
  const battlePassXp = useGameStore((state) => state.battlePassXp);
  const claimed = useGameStore((state) => state.claimedBattlePassRewards);
  const claimBattlePassReward = useGameStore((state) => state.claimBattlePassReward);
  const [notice, setNotice] = useState("");

  const currentLevel = Math.min(10, Math.floor(battlePassXp / 100) + 1);
  const progressIntoLevel = battlePassXp % 100;

  return (
    <div className="utilityPanel">
      <p className="utilityKicker">Season Track</p>
      <h2>Батл-пасс</h2>
      <p className="utilityText">Получай опыт за задания дня и матчи. Награды можно забрать, когда уровень достигнут.</p>

      <div className="bpSummary">
        <strong>Уровень {currentLevel}</strong>
        <span>{battlePassXp} XP</span>
      </div>

      <div className="bpProgress">
        <div style={{ width: `${currentLevel >= 10 ? 100 : progressIntoLevel}%` }} />
      </div>

      {notice ? <div className="utilityNotice">{notice}</div> : null}

      <div className="bpTrack">
        {BATTLE_PASS_REWARDS.map((reward) => {
          const isUnlocked = reward.level <= currentLevel;
          const isClaimed = claimed.includes(reward.level);

          return (
            <article className={`bpReward ${isUnlocked ? "is-unlocked" : ""}`} key={reward.level}>
              <div className="bpNode">{reward.level}</div>
              <div>
                <strong>{reward.title}</strong>
                <span>{isClaimed ? "получено" : isUnlocked ? "доступно" : "закрыто"}</span>
              </div>
              <button
                type="button"
                disabled={!isUnlocked || isClaimed}
                onClick={() => {
                  const ok = claimBattlePassReward(reward.level);
                  setNotice(ok ? `Награда уровня ${reward.level} получена.` : "Эту награду пока нельзя забрать.");
                }}
              >
                Забрать
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DailyQuestsPanel() {
  const openedPacksCount = useGameStore((state) => state.openedPacksCount);
  const deckIds = useGameStore((state) => state.deckIds);
  const ownedCards = useGameStore((state) => state.ownedCards);
  const craftedCardsCount = useGameStore((state) => state.craftedCardsCount);
  const wins = useGameStore((state) => state.wins);
  const claimedDailyQuestIds = useGameStore((state) => state.claimedDailyQuestIds);
  const claimDailyQuestReward = useGameStore((state) => state.claimDailyQuestReward);
  const [notice, setNotice] = useState("");

  const rarePlusCount = ownedCards.filter((card) => (RARITY_VALUE[String(card.rarity)] ?? 0) >= RARITY_VALUE.rare).length;

  const quests = [
    { id: "open-pack", title: "Открой 1 пак", progress: openedPacksCount, target: 1, xp: 40, coins: 50 },
    { id: "build-deck", title: "Собери колоду из 10+ карт", progress: deckIds.length, target: 10, xp: 35, coins: 40 },
    { id: "rare-card", title: "Получи карту редкости Rare+", progress: rarePlusCount, target: 1, xp: 45, coins: 60 },
    { id: "craft-card", title: "Скрафти 1 карту", progress: craftedCardsCount, target: 1, xp: 50, coins: 75 },
    { id: "win-match", title: "Победи в 1 матче", progress: wins, target: 1, xp: 60, coins: 100 },
  ];

  return (
    <div className="utilityPanel">
      <p className="utilityKicker">Daily Tasks</p>
      <h2>Задания дня</h2>
      <p className="utilityText">Простые цели на день. За них даётся опыт батл-пасса и немного монет.</p>

      {notice ? <div className="utilityNotice">{notice}</div> : null}

      <div className="questList">
        {quests.map((quest) => {
          const progress = Math.min(quest.progress, quest.target);
          const completed = quest.progress >= quest.target;
          const claimed = claimedDailyQuestIds.includes(quest.id);

          return (
            <article className={`questCard ${completed ? "is-complete" : ""}`} key={quest.id}>
              <div>
                <strong>{quest.title}</strong>
                <span>{progress}/{quest.target} · +{quest.xp} BP XP · +{quest.coins} coins</span>
              </div>

              <div className="questProgress">
                <div style={{ width: `${(progress / quest.target) * 100}%` }} />
              </div>

              <button
                type="button"
                disabled={!completed || claimed}
                onClick={() => {
                  const ok = claimDailyQuestReward(quest.id, quest.xp, quest.coins);
                  setNotice(ok ? `Задание выполнено: ${quest.title}` : "Эту награду уже забрали.");
                }}
              >
                {claimed ? "Получено" : "Забрать"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardPanel() {
  const playerName = useGameStore((state) => state.playerName);
  const wins = useGameStore((state) => state.wins);
  const deckIds = useGameStore((state) => state.deckIds);
  const ownedCards = useGameStore((state) => state.ownedCards);
  const [sortBy, setSortBy] = useState<"wins" | "deckValue">("wins");

  const playerDeckValue = getDeckValue(deckIds, ownedCards);

  const rows = useMemo(() => {
    const playerRow = { nickname: playerName, wins, deckValue: playerDeckValue, isPlayer: true };
    const leaderboardRows: Array<{
      nickname: string;
      wins: number;
      deckValue: number;
      isPlayer?: boolean;
    }> = [playerRow, ...MOCK_LEADERBOARD];

    return leaderboardRows
      .sort((a, b) => (sortBy === "wins" ? b.wins - a.wins : b.deckValue - a.deckValue))
      .map((row, index) => ({ ...row, place: index + 1 }));
  }, [playerDeckValue, playerName, sortBy, wins]);

  return (
    <div className="utilityPanel">
      <p className="utilityKicker">Leaderboard</p>
      <h2>Топ игроков</h2>
      <p className="utilityText">Пока это локальная таблица с тестовыми игроками. Потом она будет брать данные с сервера.</p>

      <div className="leaderTabs">
        <button className={sortBy === "wins" ? "is-active" : ""} type="button" onClick={() => setSortBy("wins")}>По победам</button>
        <button className={sortBy === "deckValue" ? "is-active" : ""} type="button" onClick={() => setSortBy("deckValue")}>По цене колоды</button>
      </div>

      <div className="leaderList">
        {rows.map((row) => (
          <article className={`leaderRow ${row.isPlayer ? "is-player" : ""}`} key={row.nickname}>
            <strong>#{row.place}</strong>
            <span>{row.nickname}</span>
            <small>{sortBy === "wins" ? `${row.wins} побед` : `${row.deckValue} value`}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function UtilityDrawer({
  activePanel,
  onClose,
  onNavigateToMatch,
}: {
  activePanel: UtilityPanel | null;
  onClose: () => void;
  onNavigateToMatch: () => void;
}) {
  const isOpen = activePanel !== null;

  return (
    <>
      <button
        className={`utilityScrim ${isOpen ? "is-open" : ""}`}
        aria-label="Close utility panel"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        type="button"
        onClick={onClose}
      />

      <aside className={`utilityDrawer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        <div className="utilityDrawerHead">
          <span>FRAKTUM PANEL</span>
          <button type="button" tabIndex={isOpen ? 0 : -1} onClick={onClose} aria-label="Закрыть панель">×</button>
        </div>

        {activePanel === "friends" ? <FriendsPanel onClose={onClose} onNavigateToMatch={onNavigateToMatch} /> : null}
        {activePanel === "battlePass" ? <BattlePassPanel /> : null}
        {activePanel === "dailyQuests" ? <DailyQuestsPanel /> : null}
        {activePanel === "leaderboard" ? <LeaderboardPanel /> : null}
      </aside>
    </>
  );
}

export default function Shell({ children }: PropsWithChildren) {
  const location = useLocation();
  const nav = useNavigate();
  const coins = useGameStore((state) => state.coins);
  const premium = useGameStore((state) => state.premium);
  const level = useGameStore((state) => state.level);
  const reducedMotion = useGameStore((state) => state.settings.reducedMotion);
  const isMatchRoute = location.pathname.startsWith("/match/");
  const isHubRoute = location.pathname === "/";
  const activeHubRoom = getHubRoomFromSearch(location.search);
  const [activePanel, setActivePanel] = useState<UtilityPanel | null>(null);

  const openPanel = (panel: UtilityPanel) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  useEffect(() => {
    const closePanelTimeout = window.setTimeout(() => setActivePanel(null), 0);
    return () => window.clearTimeout(closePanelTimeout);
  }, [location.pathname]);

  useEffect(() => {
    if (activePanel === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePanel(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel]);

  return (
    <div className={`shell ${reducedMotion ? "is-reduced-motion" : ""}`}>
      <CloudAutoSync />
      <div className="shellFx shellFxGrid" />
      <div className="shellFx shellFxGlow shellFxGlowA" />
      <div className="shellFx shellFxGlow shellFxGlowB" />
      <div className="shellNoise" />

      {!isMatchRoute ? (
        <>
          <div className="topbar">
            <button className="brand" onClick={() => nav("/")} type="button">
              <span className="brandDot" />
              FRAKTUM
            </button>

            <nav className="mainNav" aria-label="Main navigation">
              {TOP_NAV.map((item) => {
                const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);

                return (
                  <button
                    className={`mainNavBtn ${isActive ? "is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    key={item.path}
                    onClick={() => nav(item.path)}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {isHubRoute ? (
              <nav className="hubRoomNav" aria-label="Hub rooms">
                <span className="hubRoomNavLabel">Rooms</span>
                {HUB_QUICK_ROOMS.map((room) => {
                  const isActive = activeHubRoom === room.id;

                  return (
                    <button
                      className={`hubRoomBtn is-${room.id} ${isActive ? "is-active" : ""}`}
                      aria-current={isActive ? "location" : undefined}
                      key={room.id}
                      onClick={() => nav({ pathname: "/", search: createHubRoomSearch(room.id) })}
                      title={room.title}
                      type="button"
                    >
                      <HubRoomIcon roomId={room.id} />
                      <span>{room.label}</span>
                    </button>
                  );
                })}
              </nav>
            ) : null}

            <div className="topbarSpacer" />

            <div className="currencyRow">
              <div className="pill interactive">
                <div className="pillIcon" />
                <div>
                  <div className="pillLabel">Coins</div>
                  <div className="pillValue">{coins}</div>
                </div>
              </div>

              <div className="pill interactive">
                <div className="pillIcon pillIconPremium" />
                <div>
                  <div className="pillLabel">Premium</div>
                  <div className="pillValue">{premium}</div>
                </div>
              </div>

              <div className="pill interactive">
                <div className="pillIcon" />
                <div>
                  <div className="pillLabel">Level</div>
                  <div className="pillValue">{level}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rightbar utilityRail">
            <button className={`rbtn ${activePanel === "friends" ? "is-active" : ""}`} aria-pressed={activePanel === "friends"} onClick={() => openPanel("friends")} title="Friends" type="button">
              <IconMessage />
              <span className="rbtnLabel">Friends</span>
            </button>

            <button className={`rbtn ${activePanel === "battlePass" ? "is-active" : ""}`} aria-pressed={activePanel === "battlePass"} onClick={() => openPanel("battlePass")} title="Battle Pass" type="button">
              <IconStar />
              <span className="rbtnLabel">Pass</span>
            </button>

            <button className={`rbtn ${activePanel === "dailyQuests" ? "is-active" : ""}`} aria-pressed={activePanel === "dailyQuests"} onClick={() => openPanel("dailyQuests")} title="Daily Quests" type="button">
              <IconHexStar />
              <span className="rbtnLabel">Daily</span>
            </button>

            <button className={`rbtn ${activePanel === "leaderboard" ? "is-active" : ""}`} aria-pressed={activePanel === "leaderboard"} onClick={() => openPanel("leaderboard")} title="Leaderboard" type="button">
              <IconCompass />
              <span className="rbtnLabel">Top</span>
            </button>
          </div>

          <UtilityDrawer
            activePanel={activePanel}
            onClose={() => setActivePanel(null)}
            onNavigateToMatch={() => nav("/play")}
          />
        </>
      ) : null}

      <div
        key={location.pathname}
        className="content pageEnter"
        style={isMatchRoute ? { top: 0, left: 0, right: 0, bottom: 0, padding: 0 } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
