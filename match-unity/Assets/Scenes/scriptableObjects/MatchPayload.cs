using System;

[Serializable]
public class MatchPayload
{
    public string mode;
    public string playerName;
    public string enemyName;
    public string enemyId;
    public string[] deckIds;
    public OwnedCardPayload[] ownedCards;
    public long startedAt;
}

[Serializable]
public class OwnedCardPayload
{
    public string instanceId;
    public string baseId;
    public string title;
    public string rarity;
    public string type;
    public string image;
    public string frontSrc;
    public string packId;
    public long obtainedAt;
    public string edition;
    public bool isFoil;
    public string foilColor;
    public int marketValue;
    public int cost;
    public int attack;
    public int health;
    public string description;
    public string effectKey;
    public string collection;
}
