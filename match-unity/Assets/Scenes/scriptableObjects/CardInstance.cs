[System.Serializable]
public class CardInstance
{
    public string uniqueId;
    public string baseId;

    public CardDefinition definition;

    public int currentAttack;
    public int currentHealth;

    public CardInstance(string uniqueId, string baseId, CardDefinition definition)
    {
        this.uniqueId = uniqueId;
        this.baseId = baseId;
        this.definition = definition;

        currentAttack = definition != null ? definition.baseAttack : 0;
        currentHealth = definition != null ? definition.baseHealth : 0;
    }
}