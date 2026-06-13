using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public enum DropZoneKind { PlayerApply, EnemyApply, ActiveEffect, Resolution, PlayerTarget, EnemyTarget }
public class DropZone : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
{
    public static DropZone Current { get; private set; }
    private static readonly List<DropZone> zones = new List<DropZone>();
    public DropZoneKind kind = DropZoneKind.EnemyApply;
    public Image highlightImage;
    public bool playerCardsAllowed = true;
    private void OnEnable(){ if(!zones.Contains(this)) zones.Add(this); }
    private void OnDisable(){ zones.Remove(this); if(Current==this) Current=null; }
    public bool Accepts(CardView card){ return playerCardsAllowed && card != null && !card.IsEnemyHidden; }
    public void OnPointerEnter(PointerEventData e){ Current=this; SetHighlight(true); }
    public void OnPointerExit(PointerEventData e){ if(Current==this) Current=null; SetHighlight(false); }
    public void SetHighlight(bool on){ if(highlightImage!=null) highlightImage.color = on ? new Color(.75f,.45f,1f,.35f) : new Color(.12f,.08f,.16f,.28f); }
    public static void SetAllHighlights(bool on, CardView card){ foreach(var z in zones) if(z!=null && z.Accepts(card)) z.SetHighlight(on); }
}
