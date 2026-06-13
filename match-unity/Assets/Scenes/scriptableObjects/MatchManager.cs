using UnityEngine;

public class MatchManager : MonoBehaviour
{
    public const int HandLimit = 10;

    [Header("References")]
    public CardDatabase cardDatabase;

    [Header("State")]
    public PlayerState playerState;
    public PlayerState aiState;

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

            playerState.playerName = payload.playerName;
            aiState.playerName = payload.enemyName;

            BuildPlayerDeck(payload.deckIds);
            DrawUpToHandLimit(playerState);

            Debug.Log("Колода игрока собрана: " + (playerState.deck.Count + playerState.hand.Count));
            Debug.Log("В руке игрока: " + playerState.hand.Count);
            Debug.Log("В колоде осталось: " + playerState.deck.Count);
        }
        else
        {
            Debug.LogWarning("Payload пустой. Матч запущен без данных из React.");
        }
    }

    private void BuildPlayerDeck(string[] deckIds)
    {
        playerState.deck.Clear();

        if (deckIds == null || deckIds.Length == 0)
        {
            Debug.LogWarning("deckIds пустой. Колода игрока не собрана.");
            return;
        }

        foreach (string uniqueId in deckIds)
        {
            string baseId = CardIdentityResolver.GetBaseId(uniqueId);

            Debug.Log("Unique: " + uniqueId);
            Debug.Log("Base: " + baseId);

            if (string.IsNullOrEmpty(baseId))
            {
                Debug.LogWarning("Не удалось определить baseId для: " + uniqueId);
                continue;
            }

            CardDefinition definition = cardDatabase != null
                ? cardDatabase.Get(baseId)
                : null;

            if (definition == null)
            {
                Debug.LogWarning("CardDefinition не найдена для baseId: " + baseId);
                continue;
            }

            CardInstance instance = new CardInstance(uniqueId, baseId, definition);
            playerState.deck.Add(instance);
        }
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