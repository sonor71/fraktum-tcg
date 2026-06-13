using UnityEngine;

public class TurnManager : MonoBehaviour
{
    public MatchManager matchManager;

    public bool isPlayerTurn = true;

    public void StartPlayerTurn()
    {
        isPlayerTurn = true;
        Debug.Log("Ход игрока");
    }

    public void StartAITurn()
    {
        isPlayerTurn = false;
        Debug.Log("Ход ИИ");
    }

    public void EndCurrentTurn()
    {
        if (isPlayerTurn)
        {
            StartAITurn();
        }
        else
        {
            StartPlayerTurn();
        }
    }
}