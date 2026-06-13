using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class HandFanController : MonoBehaviour
{
    public RectTransform handRoot;
    public CardView cardPrefab;
    public float fanWidth = 720f;
    public float arcHeight = 80f;
    public float maxAngle = 24f;
    public float hoverLift = 92f;
    public float hoverScale = 1.18f;
    public float animationSpeed = 12f;
    public readonly List<CardView> Cards = new List<CardView>();
    public CardView Selected { get; private set; }
    private CardView hovered;

    private void Awake() { if (handRoot == null) handRoot = transform as RectTransform; }
    public void SetCards(IEnumerable<CardInstance> cards)
    {
        Clear();
        foreach (CardInstance c in cards) AddCard(c);
        LayoutCards(false);
    }
    public CardView AddCard(CardInstance instance)
    {
        CardView view = Instantiate(cardPrefab, handRoot != null ? handRoot : transform); view.Bind(instance);
        CardDragHandler drag = view.gameObject.GetComponent<CardDragHandler>() ?? view.gameObject.AddComponent<CardDragHandler>(); drag.hand = this;
        Cards.Add(view); LayoutCards(true); return view;
    }
    public void RemoveCard(CardView view) { if (view == null) return; Cards.Remove(view); if (Selected == view) Selected = null; Destroy(view.gameObject); LayoutCards(true); }
    public void Clear() { foreach (CardView c in Cards) if (c != null) Destroy(c.gameObject); Cards.Clear(); }
    public void Select(CardView view) { Selected = view; foreach (CardView c in Cards) c.SetState(c == view ? CardViewState.Selected : CardViewState.Normal); LayoutCards(true); }
    public void SetHovered(CardView view, bool isHover) { hovered = isHover ? view : (hovered == view ? null : hovered); if (view != null && view != Selected) view.SetState(isHover ? CardViewState.Hover : CardViewState.Normal); LayoutCards(true); }
    public void BringToFront(CardView view) { if (view != null) view.transform.SetAsLastSibling(); }
    public Vector3 GetHomePosition(CardView view) { int i = Cards.IndexOf(view); return CalculatePose(i, Cards.Count).position; }
    public Quaternion GetHomeRotation(CardView view) { int i = Cards.IndexOf(view); return Quaternion.Euler(0, 0, CalculatePose(i, Cards.Count).angle); }
    public void LayoutCards(bool animated)
    {
        for (int i = 0; i < Cards.Count; i++)
        {
            CardView card = Cards[i]; if (card == null) continue;
            Pose2D pose = CalculatePose(i, Cards.Count);
            bool focus = card == hovered || card == Selected;
            Vector3 pos = pose.position + (focus ? Vector3.up * hoverLift : Vector3.zero);
            Quaternion rot = focus ? Quaternion.identity : Quaternion.Euler(0, 0, pose.angle);
            Vector3 scale = Vector3.one * (focus ? hoverScale : 1f);
            if (animated) StartCoroutine(Animate(card.transform as RectTransform, pos, rot, scale)); else { card.transform.localPosition = pos; card.transform.localRotation = rot; card.transform.localScale = scale; }
            card.transform.SetSiblingIndex(focus ? Cards.Count - 1 : i);
        }
    }
    private Pose2D CalculatePose(int index, int count)
    {
        if (count <= 1) return new Pose2D(Vector3.zero, 0);
        float t = count == 1 ? .5f : index / (float)(count - 1);
        float x = Mathf.Lerp(-fanWidth * .5f, fanWidth * .5f, t);
        float y = -Mathf.Sin(t * Mathf.PI) * arcHeight;
        float angle = Mathf.Lerp(maxAngle, -maxAngle, t);
        return new Pose2D(new Vector3(x, y, 0), angle);
    }
    private IEnumerator Animate(RectTransform rt, Vector3 pos, Quaternion rot, Vector3 scale)
    {
        float t = 0; Vector3 sp = rt.localPosition; Quaternion sr = rt.localRotation; Vector3 ss = rt.localScale;
        while (t < 1f) { t += Time.deltaTime * animationSpeed; float e = Mathf.SmoothStep(0, 1, t); rt.localPosition = Vector3.Lerp(sp, pos, e); rt.localRotation = Quaternion.Slerp(sr, rot, e); rt.localScale = Vector3.Lerp(ss, scale, e); yield return null; }
    }
    private struct Pose2D { public Vector3 position; public float angle; public Pose2D(Vector3 p, float a){position=p;angle=a;} }
}
