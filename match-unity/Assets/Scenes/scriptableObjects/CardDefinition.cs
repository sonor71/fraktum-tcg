using UnityEngine;

[CreateAssetMenu(fileName = "Card", menuName = "Fraktum/Card")]
public class CardDefinition : ScriptableObject
{
    public string id; // 🔥 ВОТ ЭТО ДОБАВИТЬ

    public string cardName;
    public string type;
    public string rarity;

    public int willCost;
    public int baseAttack;
    public int baseHealth;

    public string effectKey;
    public string passiveKey;

    [TextArea]
    public string description;
}