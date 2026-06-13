using UnityEngine;

public class AIManager : MonoBehaviour
{
    public MatchManager matchManager;

    public void RunAITurn()
    {
        Debug.Log("AIManager: ход ИИ пока в заглушке.");
    }

    public CardInstance ChooseCardToPlay(PlayerState aiState)
    {
        if (aiState == null || aiState.hand == null || aiState.hand.Count == 0)
        {
            Debug.Log("AIManager: у ИИ нет карт в руке.");
            return null;
        }

        return aiState.hand[0];
    }
}