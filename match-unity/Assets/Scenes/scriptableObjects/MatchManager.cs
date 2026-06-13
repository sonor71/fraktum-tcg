using System.Collections.Generic;
using System.Text;
using UnityEngine;

public class MatchManager : MonoBehaviour
{
    public const int HandLimit = 10;

    [Header("References")]
    public CardDatabase cardDatabase;

    [Header("State")]
    public PlayerState playerState;
    public PlayerState aiState;

    [Header("Deck Build Diagnostics")]
    public bool deckBuildFailed;
    public string deckBuildDiagnostic;

    private readonly List<string> missingInstanceIds = new List<string>();
    private readonly List<string> missingBaseIds = new List<string>();
    private readonly List<string> payloadFallbackCards = new List<string>();

    private void Start()
    {
        Debug.Log("MATCH MANAGER STARTED");

        playerState = new PlayerState("Player");
        aiState = new PlayerState("AI");

        string payloadJson = WebGLBridge.LoadMatchPayload();
        Debug.Log("RAW PAYLOAD: " + payloadJson);

        if (!string.IsNullOrEmpty(payloadJson))
        {
            MatchPayload payload = JsonUtility.FromJson<MatchPayload>(payloadJson);

            Debug.Log("Игрок: " + payload.playerName);
            Debug.Log("Противник: " + payload.enemyName);

            playerState.playerName = string.IsNullOrEmpty(payload.playerName) ? "Player" : payload.playerName;
            aiState.playerName = string.IsNullOrEmpty(payload.enemyName) ? "AI" : payload.enemyName;

            BuildPlayerDeck(payload);
            DrawUpToHandLimit(playerState);
        }
        else
        {
            Debug.LogWarning("Payload пустой. Создаю тестовую колоду Unity fallback.");
            BuildFallbackDeck(playerState, "player_fallback");
            DrawUpToHandLimit(playerState);
        }

        if (playerState.deck.Count + playerState.hand.Count == 0)
        {
            deckBuildFailed = true;
            deckBuildDiagnostic = "Deck build failed: 0 cards created. Check payload/CardDatabase.";
            Debug.LogError(deckBuildDiagnostic);
            BuildFallbackDeck(playerState, "player_recovery");
            DrawUpToHandLimit(playerState);
        }

        if (aiState.deck.Count + aiState.hand.Count == 0)
        {
            BuildFallbackDeck(aiState, "ai_fallback");
            DrawUpToHandLimit(aiState);
        }

        Debug.Log("Колода игрока собрана: " + (playerState.deck.Count + playerState.hand.Count));
        Debug.Log("В руке игрока: " + playerState.hand.Count);
        Debug.Log("В колоде осталось: " + playerState.deck.Count);
    }

    private void BuildPlayerDeck(MatchPayload payload)
    {
        playerState.deck.Clear();
        missingInstanceIds.Clear();
        missingBaseIds.Clear();
        payloadFallbackCards.Clear();

        string[] deckIds = payload != null ? payload.deckIds : null;
        OwnedCardPayload[] ownedCards = payload != null ? payload.ownedCards : null;
        Dictionary<string, OwnedCardPayload> ownedByInstanceId = BuildOwnedCardMap(ownedCards, true);
        Dictionary<string, OwnedCardPayload> ownedByBaseId = BuildOwnedCardMap(ownedCards, false);

        if (deckIds == null || deckIds.Length == 0)
        {
            Debug.LogWarning("deckIds пустой. Создаю тестовую колоду Unity fallback.");
            BuildFallbackDeck(playerState, "player_empty_deckIds");
            LogDeckBuildDiagnostics(0, ownedCards != null ? ownedCards.Length : 0, playerState.deck.Count);
            return;
        }

        foreach (string instanceId in deckIds)
        {
            CardInstance instance = null;

            if (!string.IsNullOrEmpty(instanceId) && ownedByInstanceId.TryGetValue(instanceId, out OwnedCardPayload owned))
            {
                instance = CreateCardFromPayload(owned);
            }
            else if (!string.IsNullOrEmpty(instanceId) && ownedByBaseId.TryGetValue(instanceId, out owned))
            {
                Debug.LogWarning("deckId matched ownedCards.baseId instead of instanceId: " + instanceId);
                instance = CreateCardFromPayload(owned);
            }
            else
            {
                missingInstanceIds.Add(instanceId);
                instance = CreateCardFromIdentity(instanceId);
            }

            if (instance != null)
            {
                playerState.deck.Add(instance);
            }
        }

        LogDeckBuildDiagnostics(deckIds.Length, ownedCards != null ? ownedCards.Length : 0, playerState.deck.Count);
    }

    private Dictionary<string, OwnedCardPayload> BuildOwnedCardMap(OwnedCardPayload[] ownedCards, bool byInstanceId)
    {
        Dictionary<string, OwnedCardPayload> result = new Dictionary<string, OwnedCardPayload>();

        if (ownedCards == null)
        {
            return result;
        }

        foreach (OwnedCardPayload owned in ownedCards)
        {
            string key = owned == null ? null : (byInstanceId ? owned.instanceId : owned.baseId);

            if (owned == null || string.IsNullOrEmpty(key))
            {
                continue;
            }

            if (!result.ContainsKey(key))
            {
                result.Add(key, owned);
            }
        }

        return result;
    }

    private CardInstance CreateCardFromPayload(OwnedCardPayload owned)
    {
        if (owned == null)
        {
            return null;
        }

        string instanceId = string.IsNullOrEmpty(owned.instanceId) ? owned.baseId : owned.instanceId;
        string baseId = !string.IsNullOrEmpty(owned.baseId)
            ? owned.baseId
            : CardIdentityResolver.GetBaseId(instanceId);

        if (string.IsNullOrEmpty(baseId))
        {
            baseId = instanceId;
            missingBaseIds.Add(instanceId + " -> runtime baseId fallback");
        }

        CardDefinition databaseDefinition = cardDatabase != null ? cardDatabase.Get(baseId) : null;
        CardDefinition definition = databaseDefinition != null
            ? Instantiate(databaseDefinition)
            : ScriptableObject.CreateInstance<CardDefinition>();

        if (databaseDefinition == null)
        {
            missingBaseIds.Add(baseId);
            payloadFallbackCards.Add(instanceId + " -> " + baseId);
        }

        MergePayloadIntoDefinition(definition, owned, baseId);
        return new CardInstance(instanceId, baseId, definition);
    }

    private CardInstance CreateCardFromIdentity(string instanceId)
    {
        string baseId = CardIdentityResolver.GetBaseId(instanceId);

        Debug.Log("Unique: " + instanceId);
        Debug.Log("Base: " + baseId);

        if (string.IsNullOrEmpty(baseId))
        {
            Debug.LogWarning("Не удалось определить baseId для: " + instanceId);
            return null;
        }

        CardDefinition definition = cardDatabase != null ? cardDatabase.Get(baseId) : null;

        if (definition == null)
        {
            missingBaseIds.Add(baseId);
            Debug.LogWarning("CardDefinition не найдена для baseId: " + baseId);
            return CreatePlaceholderCard(instanceId, baseId, baseId);
        }

        return new CardInstance(instanceId, baseId, definition);
    }

    private void MergePayloadIntoDefinition(CardDefinition definition, OwnedCardPayload owned, string baseId)
    {
        definition.id = baseId;
        definition.cardName = FirstNonEmpty(owned.title, definition.cardName, baseId);
        definition.type = FirstNonEmpty(owned.type, definition.type, "attack");
        definition.rarity = FirstNonEmpty(owned.rarity, definition.rarity, "common");
        definition.willCost = owned.cost > 0 ? owned.cost : definition.willCost;
        definition.baseAttack = owned.attack > 0 ? owned.attack : definition.baseAttack;
        definition.baseHealth = owned.health > 0 ? owned.health : definition.baseHealth;
        definition.description = FirstNonEmpty(owned.description, definition.description, "Runtime card from React payload.");
        definition.effectKey = FirstNonEmpty(owned.effectKey, definition.effectKey, definition.type);
        definition.image = FirstNonEmpty(owned.image, definition.image, string.Empty);
        definition.frontSrc = FirstNonEmpty(owned.frontSrc, definition.frontSrc, definition.image);
        definition.edition = FirstNonEmpty(owned.edition, definition.edition, string.Empty);
        definition.isFoil = owned.isFoil || definition.isFoil;
        definition.foilColor = FirstNonEmpty(owned.foilColor, definition.foilColor, string.Empty);
        definition.collection = FirstNonEmpty(owned.collection, definition.collection, string.Empty);
    }

    private CardInstance CreatePlaceholderCard(string instanceId, string baseId, string title)
    {
        CardDefinition definition = ScriptableObject.CreateInstance<CardDefinition>();
        definition.id = baseId;
        definition.cardName = HumanizeTitle(title);
        definition.type = "attack";
        definition.rarity = "common";
        definition.willCost = 1;
        definition.baseAttack = 2;
        definition.baseHealth = 0;
        definition.effectKey = "damage";
        definition.description = "Runtime placeholder: CardDatabase entry is missing.";
        payloadFallbackCards.Add(instanceId + " -> placeholder " + baseId);
        return new CardInstance(instanceId, baseId, definition);
    }

    private void BuildFallbackDeck(PlayerState state, string prefix)
    {
        string[] fallbackBaseIds =
        {
            "energy_sword", "double_speed", "ice", "dragon_eye", "tree_of_life",
            "armor_of_chaos", "crystal_of_time", "titan_eye", "fire", "thunderbolts"
        };

        state.deck.Clear();

        for (int i = 0; i < fallbackBaseIds.Length; i++)
        {
            string baseId = fallbackBaseIds[i];
            CardDefinition definition = cardDatabase != null ? cardDatabase.Get(baseId) : null;
            CardInstance instance = definition != null
                ? new CardInstance(prefix + "-" + i + "-" + baseId, baseId, definition)
                : CreatePlaceholderCard(prefix + "-" + i + "-" + baseId, baseId, baseId);
            state.deck.Add(instance);
        }
    }

    private void LogDeckBuildDiagnostics(int deckIdCount, int ownedCardCount, int createdCount)
    {
        StringBuilder builder = new StringBuilder();
        builder.AppendLine("Deck build diagnostics:");
        builder.AppendLine("deckIds received: " + deckIdCount);
        builder.AppendLine("ownedCards received: " + ownedCardCount);
        builder.AppendLine("cards created: " + createdCount);
        builder.AppendLine("instanceId not found in ownedCards: " + missingInstanceIds.Count);
        foreach (string id in missingInstanceIds)
        {
            builder.AppendLine("  missing instanceId: " + id);
        }
        builder.AppendLine("baseId not found in CardDatabase / fallback used: " + missingBaseIds.Count);
        foreach (string id in missingBaseIds)
        {
            builder.AppendLine("  missing baseId: " + id);
        }
        builder.AppendLine("created from payload/runtime fallback: " + payloadFallbackCards.Count);
        foreach (string id in payloadFallbackCards)
        {
            builder.AppendLine("  payload/runtime fallback: " + id);
        }

        deckBuildDiagnostic = builder.ToString();
        Debug.Log(deckBuildDiagnostic);
    }

    private void DrawUpToHandLimit(PlayerState state)
    {
        while (state.hand.Count < HandLimit && state.deck.Count > 0)
        {
            CardInstance card = state.deck[0];
            state.deck.RemoveAt(0);
            state.hand.Add(card);

            Debug.Log(state.playerName + " добрал карту: " + card.definition.cardName + " / " + card.uniqueId);
        }

        if (state.hand.Count < HandLimit && state.deck.Count == 0)
        {
            Debug.LogWarning(state.playerName + ": колода закончилась, добор невозможен.");
        }
    }

    private string FirstNonEmpty(params string[] values)
    {
        foreach (string value in values)
        {
            if (!string.IsNullOrEmpty(value))
            {
                return value;
            }
        }
        return string.Empty;
    }

    private string HumanizeTitle(string id)
    {
        if (string.IsNullOrEmpty(id))
        {
            return "Runtime Card";
        }

        return char.ToUpperInvariant(id[0]) + id.Substring(1).Replace('_', ' ');
    }

    public void EndMatch(bool playerWon)
    {
        MatchResultData result = new MatchResultData
        {
            winner = playerWon ? "player" : "ai",
            playerHp = playerState.HP,
            aiHp = aiState.HP,
            rewardGranted = playerWon
        };

        string json = JsonUtility.ToJson(result);

        WebGLBridge.SaveMatchResult(json);

        Debug.Log("RESULT SENT: " + json);
    }
}

[System.Serializable]
public class MatchResultData
{
    public string winner;
    public int playerHp;
    public int aiHp;
    public bool rewardGranted;
}
