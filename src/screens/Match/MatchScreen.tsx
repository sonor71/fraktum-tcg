import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MatchCard, UnitState } from "../../game/match/types";
import { useMatchController } from "./useMatchController";
import "./match.css";

const CARD_BACK = "/cards/card-back.png";

function getRollText(roll: number | null) {
  if (roll === null) return "Ожидается бросок D20";
  if (roll >= 1 && roll <= 10) return `Можно сыграть до ${roll} карт в этот ход.`;
  if (roll >= 11 && roll <= 14) return "Можно сыграть 1 карту из своего сброса.";
  if (roll >= 15 && roll <= 16) return "Активирована Рулетка Судьбы.";
  if (roll >= 17 && roll <= 18) return "Можно сыграть любое количество карт, но стоимость Воли удваивается.";
  if (roll === 19) return "Можно сыграть 1 случайную карту из колоды противника.";
  return "Пробуждение: сыграй 1 карту бесплатно или повторно активируй пассивку.";
}

function HeroPanel(props: {
  title: string;
  hp: number;
  will: number;
  deck: number;
  hand: number;
  graveyard: number;
  active?: boolean;
  selectable?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`matchHeroPanel ${props.active ? "isActive" : ""} ${props.selectable ? "isSelectable" : ""}`}
      onClick={props.onClick}
      disabled={!props.onClick}
    >
      <div className="matchHeroTitle">{props.title}</div>
      <div className="matchHeroStats">
        <div>HP: {props.hp}</div>
        <div>Воля: {props.will}/5</div>
        <div>Колода: {props.deck}</div>
        <div>Рука: {props.hand}</div>
        <div>Сброс: {props.graveyard}</div>
      </div>
    </button>
  );
}

function UnitCard(props: {
  unit: UnitState;
  selected?: boolean;
  attackable?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`matchUnitCard ${props.selected ? "isSelected" : ""} ${props.attackable ? "isAttackable" : ""}`}
      onClick={props.onClick}
      disabled={!props.onClick}
      title={props.unit.passive ? `Пассивка: ${props.unit.passive.name}` : props.unit.name}
    >
      <img src={props.unit.frontSrc || CARD_BACK} alt={props.unit.name} className="matchUnitArt" />
      <div className="matchUnitInfo">
        <div className="matchUnitName">{props.unit.name}</div>
        <div className="matchUnitMeta">
          <span>ATK {props.unit.attack}</span>
          <span>HP {props.unit.health}</span>
        </div>
        <div className="matchUnitMeta muted">
          <span>{props.unit.exhausted ? "Истощён" : "Готов атаковать"}</span>
          <span>{props.unit.passive ? props.unit.passive.name : "Без пассивки"}</span>
        </div>
      </div>
    </button>
  );
}

function CardButton(props: {
  card: MatchCard;
  mode?: "normal" | "graveyard" | "free";
  onClick: () => void;
  disabled?: boolean;
}) {
  const badge = props.mode === "graveyard" ? "СБРОС" : props.mode === "free" ? "БЕСПЛАТНО" : "РУКА";

  return (
    <button type="button" className="matchCardButton" onClick={props.onClick} disabled={props.disabled}>
      <img src={props.card.frontSrc || CARD_BACK} alt={props.card.name} className="matchCardArt" />
      <div className="matchCardOverlay">
        <div className="matchCardTopRow">
          <span className="matchCardBadge">{badge}</span>
          <span className="matchCardCost">Воля {props.card.willCost}</span>
        </div>
        <div className="matchCardName">{props.card.name}</div>
        <div className="matchCardText">{props.card.description}</div>
      </div>
    </button>
  );
}

export default function MatchScreen() {
  const nav = useNavigate();
  const { state, diceValue, diceRollingOwner, actions } = useMatchController();
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);

  const currentOwner = state.activePlayer;
  const isPlayerTurn = state.phase === "player_turn" && currentOwner === "player";
  const selectedAttacker = useMemo(
    () => state.player.board.find((unit) => unit.instanceId === selectedAttackerId) ?? null,
    [selectedAttackerId, state.player.board]
  );

  const paidHandCardsDisabled = !isPlayerTurn;

  return (
    <div className="matchRoot">
      <div className="matchMainColumn">
        <section className="matchHeaderPanel">
          <div>
            <div className="matchKicker">FRAKTUM MATCH / VS AI</div>
            <h1 className="matchTitle">Соревновательный матч против ИИ</h1>
            <div className="matchSubline">
              Раунд {state.round} • {currentOwner === "player" ? "Ход игрока" : state.phase === "turn_intro" ? "Подготовка хода ИИ" : "Ход ИИ"}
            </div>
          </div>

          <div className="matchDiceBox">
            <div className={`matchDice ${diceRollingOwner ? "isRolling" : ""}`}>
              <div className="matchDiceFace">{diceValue ?? "?"}</div>
              <div className="matchDiceLabel">D20</div>
            </div>
            <div className="matchDiceInfo">
              <div className="matchDiceOwner">
                {diceRollingOwner ? `Бросает: ${diceRollingOwner === "player" ? "Игрок" : "ИИ"}` : "Бросок завершён"}
              </div>
              <div className="matchDiceText">{getRollText(state.turn.roll)}</div>
            </div>
          </div>
        </section>

        <section className="matchBoardPanel">
          <HeroPanel
            title="ИИ"
            hp={state.ai.hp}
            will={state.ai.will}
            deck={state.ai.deck.length}
            hand={state.ai.hand.length}
            graveyard={state.ai.graveyard.length}
            active={currentOwner === "ai"}
            selectable={Boolean(selectedAttacker)}
            onClick={selectedAttacker ? () => {
              actions.attack(selectedAttacker.instanceId, { kind: "hero" });
              setSelectedAttackerId(null);
            } : undefined}
          />

          <div className="matchBoardRow enemyRow">
            {state.ai.board.length === 0 ? <div className="matchEmptyRow">У ИИ пока нет персонажей на поле.</div> : null}
            {state.ai.board.map((unit) => (
              <UnitCard
                key={unit.instanceId}
                unit={unit}
                attackable={Boolean(selectedAttacker)}
                onClick={selectedAttacker ? () => {
                  actions.attack(selectedAttacker.instanceId, { kind: "unit", unitId: unit.instanceId });
                  setSelectedAttackerId(null);
                } : undefined}
              />
            ))}
          </div>

          <div className="matchBoardMiddleLine">
            <div className="matchBoardHint">
              {selectedAttacker
                ? `Выбран атакующий: ${selectedAttacker.name}. Нажми на вражеского героя или персонажа.`
                : "Выбирай карты, используй эффекты броска и атакуй готовыми персонажами."}
            </div>
            {selectedAttacker ? (
              <button type="button" className="matchGhostButton" onClick={() => setSelectedAttackerId(null)}>
                Снять выбор атаки
              </button>
            ) : null}
          </div>

          <div className="matchBoardRow playerRow">
            {state.player.board.length === 0 ? <div className="matchEmptyRow">На твоём поле пока нет персонажей.</div> : null}
            {state.player.board.map((unit) => (
              <UnitCard
                key={unit.instanceId}
                unit={unit}
                selected={selectedAttackerId === unit.instanceId}
                onClick={isPlayerTurn && !unit.exhausted ? () => {
                  setSelectedAttackerId((prev) => (prev === unit.instanceId ? null : unit.instanceId));
                } : undefined}
              />
            ))}
          </div>

          <HeroPanel
            title="Игрок"
            hp={state.player.hp}
            will={state.player.will}
            deck={state.player.deck.length}
            hand={state.player.hand.length}
            graveyard={state.player.graveyard.length}
            active={currentOwner === "player"}
          />
        </section>

        <section className="matchSpecialPanelGrid">
          <div className="matchSidePanel">
            <div className="matchPanelTitle">Эффект текущего броска</div>
            <div className="matchRuleBox">
              <div className="matchRuleMain">{getRollText(state.turn.roll)}</div>
              <div className="matchRuleSub">
                Сыграно карт: {state.turn.playsMade}
                {state.turn.playLimit === null ? " / ∞" : ` / ${state.turn.playLimit}`}
              </div>
              <div className="matchRuleSub">Множитель Воли: x{state.turn.willMultiplier}</div>
              <div className="matchRuleSub">Истощение Воли сработает, если ход закончится без сыгранных карт.</div>
            </div>
          </div>

          <div className="matchSidePanel">
            <div className="matchPanelTitle">Специальные действия</div>

            <div className="matchSpecialActions">
              <button
                type="button"
                className="matchActionButton"
                disabled={!isPlayerTurn || !state.turn.enemyDeckPlayCardId}
                onClick={() => actions.playBlindEnemyCard()}
              >
                Сыграть слепую карту противника
              </button>

              <button
                type="button"
                className="matchActionButton"
                disabled={!isPlayerTurn || !state.turn.awakeningPassiveAvailable}
                onClick={() => actions.useAwakeningPassive()}
              >
                Пробудить пассивку
              </button>
            </div>

            <div className="matchMiniInfo">
              {state.turn.enemyDeckPlayCardId
                ? "D20 = 19: в колоде противника подготовлена случайная карта."
                : "Слепая карта противника сейчас недоступна."}
            </div>
            <div className="matchMiniInfo">
              {state.turn.awakeningFreePlayAvailable
                ? "D20 = 20: выбери карту из руки или сброса и сыграй её бесплатно."
                : "Бесплатное Пробуждение сейчас недоступно."}
            </div>
            <div className="matchMiniInfo">
              {state.turn.graveyardPlayAvailable
                ? "D20 = 11–14: можно сыграть одну карту из сброса."
                : "Розыгрыш из сброса сейчас недоступен."}
            </div>
          </div>
        </section>

        <section className="matchHandPanel">
          <div className="matchPanelTopRow">
            <div className="matchPanelTitle">Рука игрока</div>
            <div className="matchPanelActions">
              <button type="button" className="matchPrimaryButton" disabled={!isPlayerTurn} onClick={() => actions.endTurn()}>
                Завершить ход
              </button>
              <button type="button" className="matchGhostButton" onClick={() => nav("/play")}>Покинуть матч</button>
            </div>
          </div>

          <div className="matchCardsGrid">
            {state.player.hand.length === 0 ? <div className="matchEmptyRow">Рука пуста.</div> : null}
            {state.player.hand.map((card) => (
              <div key={card.instanceId} className="matchCardSlot">
                <CardButton
                  card={card}
                  onClick={() => actions.playHandCard(card.instanceId)}
                  disabled={paidHandCardsDisabled}
                />
                {isPlayerTurn && state.turn.awakeningFreePlayAvailable ? (
                  <button
                    type="button"
                    className="matchInlineSpecialButton"
                    onClick={() => actions.playAwakeningFreeCard("hand", card.instanceId)}
                  >
                    Сыграть бесплатно (Пробуждение)
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="matchHandPanel secondary">
          <div className="matchPanelTitle">Сброс игрока</div>
          <div className="matchCardsGrid compact">
            {state.player.graveyard.length === 0 ? <div className="matchEmptyRow">В сбросе пока нет карт.</div> : null}
            {state.player.graveyard.map((card) => (
              <div key={card.instanceId} className="matchCardSlot">
                <CardButton
                  card={card}
                  mode={state.turn.awakeningFreePlayAvailable ? "free" : "graveyard"}
                  onClick={() => {
                    if (state.turn.awakeningFreePlayAvailable) {
                      actions.playAwakeningFreeCard("graveyard", card.instanceId);
                      return;
                    }
                    actions.playGraveyardCard(card.instanceId);
                  }}
                  disabled={!isPlayerTurn || (!state.turn.graveyardPlayAvailable && !state.turn.awakeningFreePlayAvailable)}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="matchLogColumn">
        <div className="matchPanelTitle">Лог матча</div>
        <div className="matchLogList">
          {state.log.slice().reverse().map((entry) => (
            <div key={entry.id} className="matchLogEntry">{entry.text}</div>
          ))}
        </div>
      </aside>

      {state.phase === "finished" ? (
        <div className="matchOverlay">
          <div className="matchOverlayCard">
            <div className="matchOverlayKicker">Матч завершён</div>
            <h2>{state.winner === "player" ? "Победа" : "Поражение"}</h2>
            <p>
              {state.winner === "player"
                ? "Ты пережил ИИ и остался единственным выжившим."
                : "ИИ пережил тебя в этом матче. Попробуй изменить колоду и зайти ещё раз."}
            </p>
            <div className="matchOverlayActions">
              <button type="button" className="matchPrimaryButton" onClick={() => window.location.reload()}>
                Реванш
              </button>
              <button type="button" className="matchGhostButton" onClick={() => nav("/play")}>Назад к режимам</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
