using UnityEngine;
using UnityEngine.UI;

public enum CardViewState { Normal, Hover, Selected, Dragging, Disabled, Playable, NotEnoughResource, EnemyHidden }

[RequireComponent(typeof(RectTransform))]
[RequireComponent(typeof(CanvasGroup))]
public class CardView : MonoBehaviour
{
    public CardInstance Instance { get; private set; }
    public CardDefinition Definition => Instance != null ? Instance.definition : null;
    public bool IsEnemyHidden { get; private set; }

    [Header("Generated UI")]
    public Image frame;
    public Image art;
    public Text titleText;
    public Text typeText;
    public Text rarityText;
    public Text costText;
    public Text statsText;
    public Text descriptionText;
    public Text foilText;
    public Image highlight;

    private CanvasGroup canvasGroup;
    private CardViewState state;

    private void Awake()
    {
        canvasGroup = GetComponent<CanvasGroup>();
        EnsureVisuals();
    }

    public void Bind(CardInstance instance, bool enemyHidden = false)
    {
        Instance = instance;
        IsEnemyHidden = enemyHidden;
        EnsureVisuals();
        Refresh();
    }

    public void SetState(CardViewState newState)
    {
        state = newState;
        EnsureVisuals();
        bool hidden = state == CardViewState.EnemyHidden || IsEnemyHidden;
        canvasGroup.alpha = state == CardViewState.Disabled ? 0.55f : 1f;
        canvasGroup.blocksRaycasts = state != CardViewState.Dragging;
        highlight.enabled = state == CardViewState.Hover || state == CardViewState.Selected || state == CardViewState.Playable || state == CardViewState.NotEnoughResource;
        highlight.color = state == CardViewState.Selected ? new Color(1f, .72f, .12f, .55f) :
            state == CardViewState.NotEnoughResource ? new Color(.95f, .1f, .1f, .45f) : new Color(.5f, .2f, 1f, .35f);
        if (hidden) ApplyBackSide();
    }

    public void SetPlayable(bool playable, bool enoughResource)
    {
        if (!playable) SetState(CardViewState.Disabled);
        else SetState(enoughResource ? CardViewState.Playable : CardViewState.NotEnoughResource);
    }

    public void Refresh()
    {
        if (IsEnemyHidden)
        {
            ApplyBackSide();
            return;
        }

        CardDefinition d = Definition;
        titleText.text = d != null ? d.cardName : "Unknown";
        typeText.text = d != null ? d.type : "action";
        rarityText.text = d != null ? d.rarity : "common";
        costText.text = d != null ? d.willCost.ToString() : "0";
        statsText.text = d != null && (d.baseAttack > 0 || d.baseHealth > 0) ? $"{d.baseAttack}/{d.baseHealth}" : "—";
        descriptionText.text = d != null ? d.description : "No data";
        string foil = d != null && d.isFoil ? " • Foil " + d.foilColor : string.Empty;
        string edition = d != null && !string.IsNullOrEmpty(d.edition) ? " • " + d.edition : string.Empty;
        foilText.text = Instance != null ? Instance.uniqueId + edition + foil : "Serial —";
        frame.color = RarityColor(d != null ? d.rarity : "common");
        art.color = !string.IsNullOrEmpty(d != null ? d.frontSrc : string.Empty)
            ? new Color(.22f, .14f, .32f, 1f)
            : new Color(.18f, .11f, .25f, 1f);
        SetState(state == CardViewState.EnemyHidden ? CardViewState.Normal : state);
    }

    private void ApplyBackSide()
    {
        titleText.text = "FRAKTUM";
        typeText.text = "hidden";
        rarityText.text = "enemy hand";
        costText.text = "?";
        statsText.text = "◆";
        descriptionText.text = "✦ ✧ ✦\nCard back";
        foilText.text = "";
        frame.color = new Color(.12f, .07f, .18f, 1f);
        art.color = new Color(.42f, .22f, .75f, 1f);
    }

    private Color RarityColor(string rarity)
    {
        switch ((rarity ?? "").ToLowerInvariant())
        {
            case "rare": return new Color(.2f, .42f, 1f, 1f);
            case "epic": return new Color(.62f, .24f, 1f, 1f);
            case "mythic": return new Color(1f, .25f, .12f, 1f);
            case "legendary": return new Color(1f, .66f, .08f, 1f);
            case "chromatic": return new Color(.1f, .95f, .85f, 1f);
            case "divine": return new Color(1f, .94f, .45f, 1f);
            default: return new Color(.62f, .54f, .42f, 1f);
        }
    }

    private void EnsureVisuals()
    {
        if (frame != null) return;
        RectTransform rt = GetComponent<RectTransform>();
        rt.sizeDelta = rt.sizeDelta == Vector2.zero ? new Vector2(150, 215) : rt.sizeDelta;
        frame = AddImage("Frame", transform, Color.black, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
        highlight = AddImage("Highlight", transform, new Color(1, .7f, .1f, .4f), Vector2.zero, Vector2.one, new Vector2(-6, -6), new Vector2(6, 6));
        highlight.enabled = false;
        art = AddImage("Art", transform, new Color(.16f, .1f, .22f, 1), new Vector2(.08f, .48f), new Vector2(.92f, .88f), Vector2.zero, Vector2.zero);
        titleText = AddText("Title", 15, FontStyle.Bold, TextAnchor.MiddleCenter, new Vector2(.08f, .86f), new Vector2(.92f, .98f));
        typeText = AddText("Type", 10, FontStyle.Italic, TextAnchor.MiddleLeft, new Vector2(.08f, .39f), new Vector2(.55f, .48f));
        rarityText = AddText("Rarity", 9, FontStyle.Normal, TextAnchor.MiddleRight, new Vector2(.45f, .39f), new Vector2(.92f, .48f));
        costText = AddText("Cost", 22, FontStyle.Bold, TextAnchor.MiddleCenter, new Vector2(.02f, .83f), new Vector2(.2f, .99f));
        statsText = AddText("Stats", 14, FontStyle.Bold, TextAnchor.MiddleCenter, new Vector2(.68f, .02f), new Vector2(.98f, .16f));
        descriptionText = AddText("Description", 10, FontStyle.Normal, TextAnchor.UpperLeft, new Vector2(.08f, .16f), new Vector2(.92f, .39f));
        foilText = AddText("Serial", 7, FontStyle.Normal, TextAnchor.LowerLeft, new Vector2(.06f, .01f), new Vector2(.68f, .1f));
    }

    private Text AddText(string name, int size, FontStyle style, TextAnchor anchor, Vector2 min, Vector2 max)
    {
        GameObject go = new GameObject(name, typeof(RectTransform), typeof(Text));
        go.transform.SetParent(transform, false);
        RectTransform rt = go.GetComponent<RectTransform>(); rt.anchorMin = min; rt.anchorMax = max; rt.offsetMin = rt.offsetMax = Vector2.zero;
        Text t = go.GetComponent<Text>(); t.font = UIFontUtility.GetDefaultFont(); t.fontSize = size; t.fontStyle = style; t.alignment = anchor; t.color = new Color(.96f, .88f, .72f, 1); return t;
    }

    private Image AddImage(string name, Transform parent, Color color, Vector2 min, Vector2 max, Vector2 offMin, Vector2 offMax)
    {
        GameObject go = new GameObject(name, typeof(RectTransform), typeof(Image)); go.transform.SetParent(parent, false);
        RectTransform rt = go.GetComponent<RectTransform>(); rt.anchorMin = min; rt.anchorMax = max; rt.offsetMin = offMin; rt.offsetMax = offMax;
        Image img = go.GetComponent<Image>(); img.color = color; return img;
    }
}
