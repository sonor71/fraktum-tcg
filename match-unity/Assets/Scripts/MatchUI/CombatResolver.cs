using UnityEngine;
public class CombatResolver : MonoBehaviour
{
    public int playerShield; public int enemyShield; public int playerAttackBonus; public int enemyAttackBonus;
    public void Damage(PlayerState target, bool targetIsPlayer, int amount){ int shield=targetIsPlayer?playerShield:enemyShield; int blocked=Mathf.Min(shield,amount); amount-=blocked; if(targetIsPlayer) playerShield-=blocked; else enemyShield-=blocked; target.HP=Mathf.Max(0,target.HP-amount); }
    public void Heal(PlayerState target, int amount){ target.HP=Mathf.Min(30,target.HP+amount); }
    public void Shield(bool player, int amount){ if(player) playerShield+=amount; else enemyShield+=amount; }
    public int ConsumeAttackBonus(bool player){ int b=player?playerAttackBonus:enemyAttackBonus; if(player) playerAttackBonus=0; else enemyAttackBonus=0; return b; }
}
