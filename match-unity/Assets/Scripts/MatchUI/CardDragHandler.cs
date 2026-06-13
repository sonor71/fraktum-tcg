using UnityEngine;
using UnityEngine.EventSystems;

[RequireComponent(typeof(CardView))]
public class CardDragHandler : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerClickHandler, IBeginDragHandler, IDragHandler, IEndDragHandler
{
    public HandFanController hand;
    public MatchUIController matchUI;
    private CardView card; private RectTransform rect; private Canvas canvas; private bool dragging;
    private void Awake(){ card=GetComponent<CardView>(); rect=transform as RectTransform; canvas=GetComponentInParent<Canvas>(); if(matchUI==null) matchUI=FindObjectOfType<MatchUIController>(); }
    public void OnPointerEnter(PointerEventData e){ if(!dragging){ hand?.SetHovered(card,true); hand?.BringToFront(card);} }
    public void OnPointerExit(PointerEventData e){ if(!dragging) hand?.SetHovered(card,false); }
    public void OnPointerClick(PointerEventData e){ hand?.Select(card); }
    public void OnBeginDrag(PointerEventData e){ dragging=true; hand?.BringToFront(card); card.SetState(CardViewState.Dragging); DropZone.SetAllHighlights(true, card); }
    public void OnDrag(PointerEventData e){ rect.anchoredPosition += e.delta / (canvas != null ? canvas.scaleFactor : 1f); rect.localRotation=Quaternion.identity; rect.localScale=Vector3.one*1.2f; }
    public void OnEndDrag(PointerEventData e){ dragging=false; DropZone zone=DropZone.Current; DropZone.SetAllHighlights(false, card); bool played=zone!=null && zone.Accepts(card) && (matchUI==null || matchUI.TryPlayPlayerCard(card, zone)); if(!played){ card.SetState(CardViewState.Normal); hand?.LayoutCards(true);} }
}
