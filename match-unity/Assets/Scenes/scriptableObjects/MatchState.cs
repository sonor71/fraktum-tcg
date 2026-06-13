using UnityEngine;

public class MatchState : MonoBehaviour
{
    public PlayerState playerState;
    public PlayerState aiState;

    public void StartMatch()
    {
        // Инициализация начала матча
        playerState = new PlayerState();
        aiState = new PlayerState();
    }

    public void EndMatch()
    {
        // Завершение матча, определение победителя
    }
}