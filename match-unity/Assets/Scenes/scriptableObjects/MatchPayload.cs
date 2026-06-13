using System;

[Serializable]
public class MatchPayload
{
    public string mode;
    public string playerName;
    public string enemyName;
    public string[] deckIds;
    public long startedAt;
}