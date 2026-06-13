using System.Collections.Generic;
using UnityEngine;

public class CardDatabase : MonoBehaviour
{
    public List<CardDefinition> allCards = new List<CardDefinition>();

    private Dictionary<string, CardDefinition> map;

    private void Awake()
    {
        BuildMap();
    }

    private void BuildMap()
    {
        map = new Dictionary<string, CardDefinition>();

        foreach (CardDefinition card in allCards)
        {
            if (card == null) continue;

            if (string.IsNullOrEmpty(card.id))
            {
                Debug.LogWarning("CardDefinition без id: " + card.name);
                continue;
            }

            if (map.ContainsKey(card.id))
            {
                Debug.LogWarning("Дубликат card id в CardDatabase: " + card.id);
                continue;
            }

            map.Add(card.id, card);
        }

        Debug.Log("CardDatabase загружена. Карт: " + map.Count);
    }

    public CardDefinition Get(string baseId)
    {
        if (map == null)
        {
            BuildMap();
        }

        if (map.TryGetValue(baseId, out CardDefinition card))
        {
            return card;
        }

        Debug.LogWarning("Карта не найдена в CardDatabase: " + baseId);
        return null;
    }
}