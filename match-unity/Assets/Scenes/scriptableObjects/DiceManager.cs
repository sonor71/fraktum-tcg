using UnityEngine;

public class DiceManager : MonoBehaviour
{
    public void RollDice()
    {
        int diceResult = Random.Range(1, 21); // Бросок D20
        Debug.Log($"Результат броска кубика: {diceResult}");

        // Вызываем эффект на основе результата кубика
        ApplyDiceEffect(diceResult);
    }

    void ApplyDiceEffect(int result)
    {
        if (result <= 10)
        {
            Debug.Log("Игрок может сыграть столько карт, сколько выпало.");
        }
        else if (result <= 14)
        {
            Debug.Log("Игрок может сыграть одну карту из сброса.");
        }
        else if (result <= 16)
        {
            Debug.Log("Активирована Рулетка Судьбы!");
            // Логика рулетки
        }
        // Добавь остальные эффекты для кубика
    }
}