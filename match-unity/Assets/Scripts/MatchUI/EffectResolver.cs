using UnityEngine;
public class EffectResolver : MonoBehaviour
{
    public MatchUIController ui; public CombatResolver combat;
    public string Resolve(CardInstance card, bool playedByPlayer)
    {
        if(card?.definition==null) return "Пустой эффект";
        string key=(card.definition.effectKey ?? card.definition.type ?? "").ToLowerInvariant(); int value=Mathf.Max(1, card.definition.baseAttack); PlayerState self=playedByPlayer?ui.Manager.playerState:ui.Manager.aiState; PlayerState enemy=playedByPlayer?ui.Manager.aiState:ui.Manager.playerState;
        if(key.Contains("heal") || card.definition.type=="bonus" && card.definition.baseHealth>0){ combat.Heal(self, Mathf.Max(3, card.definition.baseHealth)); return $"{self.playerName} лечится"; }
        if(key.Contains("shield") || key.Contains("protect")){ combat.Shield(playedByPlayer, Mathf.Max(3, card.definition.baseHealth)); return "Щит активирован"; }
        if(key.Contains("draw")){ ui.DrawCard(self, playedByPlayer); return "Добор карты"; }
        if(key.Contains("resource") || key.Contains("will")){ if(playedByPlayer) ui.playerResource.Gain(1); else ui.enemyResource.Gain(1); return "Ресурс +1"; }
        if(key.Contains("discard")){ ui.DiscardRandom(enemy, !playedByPlayer); return "Сброс карты противника"; }
        if(key.Contains("boost")){ if(playedByPlayer) combat.playerAttackBonus += 2; else combat.enemyAttackBonus += 2; return "Следующая атака усилена"; }
        if(key.Contains("slow") || key.Contains("skip")){ ui.enemyWeakened = playedByPlayer; return "Ход противника ослаблен"; }
        if(card.definition.type=="effect"){ self.board.Add(card); return "Длительный эффект остался на поле"; }
        int damage=value + combat.ConsumeAttackBonus(playedByPlayer); combat.Damage(enemy,!playedByPlayer,damage); return $"{enemy.playerName} получает {damage} урона";
    }
}
