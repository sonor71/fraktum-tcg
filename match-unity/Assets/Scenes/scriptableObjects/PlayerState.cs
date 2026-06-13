using System.Collections.Generic;

[System.Serializable]
public class PlayerState
{
    public string playerName;

    public int HP = 30;
    public int Will = 0;
    public int MaxWill = 5;

    public List<CardInstance> deck = new List<CardInstance>();
    public List<CardInstance> hand = new List<CardInstance>();
    public List<CardInstance> graveyard = new List<CardInstance>();
    public List<CardInstance> board = new List<CardInstance>();

    public bool playedCardThisTurn = false;

    public PlayerState(string name)
    {
        playerName = name;
    }

    public PlayerState()
    {
        playerName = "Player";
    }
}