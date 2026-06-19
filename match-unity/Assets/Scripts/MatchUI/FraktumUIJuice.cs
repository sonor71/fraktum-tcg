using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// Phase 2 visual juice layer for FRAKTUM match UI.
/// Additive and safe: it decorates existing runtime UI without changing gameplay logic.
/// </summary>
public class FraktumJuiceController : MonoBehaviour
{
    public MatchUIController ui;
    public RectTransform overlayRoot;

    private Canvas canvas;
    private float scanTimer;
    private readonly List<Image> reusableSparks = new List<Image>();

    public static FraktumJuiceController Install(MatchUIController target)
    {
        if (target == null)
            return null;

        FraktumJuiceController existing = target.GetComponent<FraktumJuiceController>();
        if (existing != null)
        {
            existing.ui = target;
            return existing;
        }

        FraktumJuiceController controller = target.gameObject.AddComponent<FraktumJuiceController>();
        controller.ui = target;
        return controller;
    }

    private void Start()
    {
        if (ui == null)
            ui = FindObjectOfType<MatchUIController>();

        canvas = ui != null ? ui.GetComponentInChildren<Canvas>() : FindObjectOfType<Canvas>();
        if (canvas == null)
            canvas = FindObjectOfType<Canvas>();

        BuildOverlay();
        ApplyEffectsPass();
    }

    private void Update()
    {
        scanTimer -= Time.unscaledDeltaTime;
        if (scanTimer <= 0f)
        {
            scanTimer = .45f;
            ApplyEffectsPass();
        }
    }

    private void BuildOverlay()
    {
        if (canvas == null || overlayRoot != null)
            return;

        GameObject root = new GameObject("FRAKTUM Phase 2 FX Overlay", typeof(RectTransform));
        root.transform.SetParent(canvas.transform, false);
        overlayRoot = root.GetComponent<RectTransform>();
        Stretch(overlayRoot, Vector2.zero, Vector2.one);
        root.transform.SetAsLastSibling();

        // Non-interactive atmospheric layer. It must never block card drag.
        CanvasGroup group = root.AddComponent<CanvasGroup>();
        group.blocksRaycasts = false;
        group.interactable = false;

        AddEdgeShade("Top shade", new Vector2(0f, .86f), new Vector2(1f, 1f), new Color(0f, 0f, 0f, .18f));
        AddEdgeShade("Bottom shade", new Vector2(0f, 0f), new Vector2(1f, .17f), new Color(0f, 0f, 0f, .22f));
        AddEdgeShade("Left shade", new Vector2(0f, 0f), new Vector2(.09f, 1f), new Color(0f, 0f, 0f, .18f));
        AddEdgeShade("Right shade", new Vector2(.91f, 0f), new Vector2(1f, 1f), new Color(0f, 0f, 0f, .18f));

        GameObject motes = new GameObject("Dust Mote Field", typeof(RectTransform));
        motes.transform.SetParent(root.transform, false);
        RectTransform mrt = motes.GetComponent<RectTransform>();
        Stretch(mrt, Vector2.zero, Vector2.one);
        FraktumMoteField field = motes.AddComponent<FraktumMoteField>();
        field.root = mrt;
    }

    private void AddEdgeShade(string name, Vector2 min, Vector2 max, Color color)
    {
        GameObject go = new GameObject(name, typeof(RectTransform), typeof(Image));
        go.transform.SetParent(overlayRoot, false);
        Image img = go.GetComponent<Image>();
        img.color = color;
        img.raycastTarget = false;
        Stretch(img.rectTransform, min, max);
    }

    private void ApplyEffectsPass()
    {
        if (canvas == null)
            return;

        CardView[] cards = canvas.GetComponentsInChildren<CardView>(true);
        for (int i = 0; i < cards.Length; i++)
        {
            if (cards[i] == null) continue;
            if (cards[i].GetComponent<FraktumCardMicroJuice>() == null)
                cards[i].gameObject.AddComponent<FraktumCardMicroJuice>();
        }

        Button[] buttons = canvas.GetComponentsInChildren<Button>(true);
        for (int i = 0; i < buttons.Length; i++)
        {
            if (buttons[i] == null) continue;
            if (buttons[i].GetComponent<FraktumButtonMicroJuice>() == null)
                buttons[i].gameObject.AddComponent<FraktumButtonMicroJuice>();
        }

        Text[] texts = canvas.GetComponentsInChildren<Text>(true);
        for (int i = 0; i < texts.Length; i++)
        {
            if (texts[i] == null) continue;

            string n = texts[i].gameObject.name.ToLowerInvariant();
            bool important = n.Contains("count") || n.Contains("value") || n.Contains("phase") || n.Contains("timer") || n.Contains("result") || n.Contains("deck") || n.Contains("discard");
            if (important && texts[i].GetComponent<FraktumTextPulseOnChange>() == null)
                texts[i].gameObject.AddComponent<FraktumTextPulseOnChange>();
        }

        Image[] images = canvas.GetComponentsInChildren<Image>(true);
        int decorated = 0;
        for (int i = 0; i < images.Length; i++)
        {
            if (images[i] == null || !images[i].gameObject.activeInHierarchy)
                continue;

            if (decorated > 22)
                break;

            string n = images[i].gameObject.name.ToLowerInvariant();
            bool target = n.Contains("pile") || n.Contains("slot") || n.Contains("hero") || n.Contains("banner") || n.Contains("will back");
            if (target && images[i].GetComponent<FraktumSoftPanelPulse>() == null)
            {
                FraktumSoftPanelPulse pulse = images[i].gameObject.AddComponent<FraktumSoftPanelPulse>();
                pulse.target = images[i];
                decorated++;
            }
        }
    }

    public void BurstAt(RectTransform target, Color color, int count, float radius)
    {
        if (target == null || overlayRoot == null)
            return;

        Vector3 world = target.TransformPoint(target.rect.center);
        Vector2 local;
        RectTransformUtility.ScreenPointToLocalPointInRectangle(
            overlayRoot,
            RectTransformUtility.WorldToScreenPoint(canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay ? canvas.worldCamera : null, world),
            canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay ? canvas.worldCamera : null,
            out local
        );

        StartCoroutine(BurstRoutine(local, color, count, radius));
    }

    private IEnumerator BurstRoutine(Vector2 center, Color color, int count, float radius)
    {
        for (int i = 0; i < count; i++)
        {
            Image spark = GetSpark();
            RectTransform rt = spark.rectTransform;
            rt.SetParent(overlayRoot, false);
            rt.anchoredPosition = center;
            rt.sizeDelta = Vector2.one * Random.Range(3f, 8f);
            rt.localScale = Vector3.one;
            spark.color = color;
            spark.gameObject.SetActive(true);

            Vector2 dir = Random.insideUnitCircle.normalized;
            if (dir == Vector2.zero) dir = Vector2.up;
            StartCoroutine(SparkRoutine(spark, center, center + dir * Random.Range(radius * .35f, radius), Random.Range(.32f, .58f)));
        }

        yield return null;
    }

    private Image GetSpark()
    {
        for (int i = 0; i < reusableSparks.Count; i++)
        {
            if (reusableSparks[i] != null && !reusableSparks[i].gameObject.activeSelf)
                return reusableSparks[i];
        }

        GameObject go = new GameObject("FX Spark", typeof(RectTransform), typeof(Image));
        go.transform.SetParent(overlayRoot, false);
        Image img = go.GetComponent<Image>();
        img.raycastTarget = false;
        reusableSparks.Add(img);
        return img;
    }

    private IEnumerator SparkRoutine(Image spark, Vector2 from, Vector2 to, float duration)
    {
        RectTransform rt = spark.rectTransform;
        Color start = spark.color;
        for (float t = 0f; t < 1f; t += Time.unscaledDeltaTime / Mathf.Max(.01f, duration))
        {
            float e = 1f - Mathf.Pow(1f - t, 3f);
            rt.anchoredPosition = Vector2.LerpUnclamped(from, to, e);
            rt.localScale = Vector3.one * Mathf.Lerp(1.05f, .20f, t);
            Color c = start;
            c.a = Mathf.Lerp(start.a, 0f, t);
            spark.color = c;
            yield return null;
        }
        spark.gameObject.SetActive(false);
    }

    private static void Stretch(RectTransform rt, Vector2 min, Vector2 max)
    {
        if (rt == null) return;
        rt.anchorMin = min;
        rt.anchorMax = max;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }
}

public class FraktumCardMicroJuice : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
{
    private RectTransform rt;
    private CardView view;
    private Image sweep;
    private Image edgeGlow;
    private bool over;
    private float sweepClock;
    private float idleSeed;
    private FraktumJuiceController juice;

    private void Awake()
    {
        rt = transform as RectTransform;
        view = GetComponent<CardView>();
        idleSeed = Random.value * 7f;
        juice = FindObjectOfType<FraktumJuiceController>();
        BuildChildren();
    }

    private void BuildChildren()
    {
        if (rt == null)
            return;

        if (edgeGlow == null)
        {
            GameObject go = new GameObject("Phase2 Edge Heat", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(transform, false);
            edgeGlow = go.GetComponent<Image>();
            edgeGlow.color = new Color(1f, .68f, .18f, 0f);
            edgeGlow.raycastTarget = false;
            Stretch(edgeGlow.rectTransform, new Vector2(-.015f, -.015f), new Vector2(1.015f, 1.015f));
        }

        if (sweep == null)
        {
            GameObject go = new GameObject("Phase2 Diagonal Shine", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(transform, false);
            sweep = go.GetComponent<Image>();
            sweep.color = new Color(1f, .92f, .62f, 0f);
            sweep.raycastTarget = false;
            RectTransform srt = sweep.rectTransform;
            srt.anchorMin = new Vector2(0f, 0f);
            srt.anchorMax = new Vector2(0f, 1f);
            srt.sizeDelta = new Vector2(26f, 0f);
            srt.anchoredPosition = new Vector2(-55f, 0f);
            srt.localRotation = Quaternion.Euler(0f, 0f, -18f);
            go.transform.SetAsLastSibling();
        }
    }

    private void Update()
    {
        if (rt == null || sweep == null || edgeGlow == null)
            return;

        bool active = over || (view != null && view.highlight != null && view.highlight.enabled);
        float targetA = active ? .16f : .035f;
        Color ec = edgeGlow.color;
        ec.a = Mathf.Lerp(ec.a, targetA + Mathf.Sin(Time.unscaledTime * 2.2f + idleSeed) * .025f, Time.unscaledDeltaTime * 8f);
        edgeGlow.color = ec;

        if (active)
        {
            sweepClock += Time.unscaledDeltaTime * (over ? 1.75f : .85f);
            float p = sweepClock % 1.6f;
            RectTransform srt = sweep.rectTransform;
            float width = rt.rect.width <= 1f ? 132f : rt.rect.width;
            srt.anchoredPosition = new Vector2(Mathf.Lerp(-width * .62f, width * 1.04f, p / 1.6f), 0f);

            Color sc = sweep.color;
            float band = Mathf.Sin(Mathf.Clamp01(p / 1.6f) * Mathf.PI);
            sc.a = band * (over ? .28f : .13f);
            sweep.color = sc;
        }
        else
        {
            Color sc = sweep.color;
            sc.a = Mathf.Lerp(sc.a, 0f, Time.unscaledDeltaTime * 8f);
            sweep.color = sc;
        }
    }

    public void OnPointerEnter(PointerEventData eventData)
    {
        over = true;
        if (juice == null) juice = FindObjectOfType<FraktumJuiceController>();
        if (juice != null) juice.BurstAt(rt, new Color(1f, .78f, .32f, .60f), 7, 42f);
    }

    public void OnPointerExit(PointerEventData eventData)
    {
        over = false;
    }

    private static void Stretch(RectTransform rt, Vector2 min, Vector2 max)
    {
        if (rt == null) return;
        rt.anchorMin = min;
        rt.anchorMax = max;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }
}

public class FraktumButtonMicroJuice : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerDownHandler, IPointerUpHandler
{
    private RectTransform rt;
    private Vector3 baseScale;
    private Image image;
    private bool over;
    private bool down;
    private FraktumJuiceController juice;

    private void Awake()
    {
        rt = transform as RectTransform;
        baseScale = rt != null ? rt.localScale : Vector3.one;
        image = GetComponent<Image>();
        juice = FindObjectOfType<FraktumJuiceController>();
    }

    private void Update()
    {
        if (rt != null)
        {
            Vector3 target = baseScale * (down ? .965f : over ? 1.055f : 1f);
            rt.localScale = Vector3.Lerp(rt.localScale, target, Time.unscaledDeltaTime * 13f);
        }

        if (image != null && over)
        {
            Color c = image.color;
            c.a = Mathf.Clamp01(c.a + Mathf.Sin(Time.unscaledTime * 8f) * .002f);
            image.color = c;
        }
    }

    public void OnPointerEnter(PointerEventData eventData)
    {
        over = true;
        if (juice == null) juice = FindObjectOfType<FraktumJuiceController>();
        if (juice != null) juice.BurstAt(rt, new Color(1f, .67f, .18f, .45f), 5, 35f);
    }

    public void OnPointerExit(PointerEventData eventData) { over = false; down = false; }
    public void OnPointerDown(PointerEventData eventData) { down = true; }
    public void OnPointerUp(PointerEventData eventData) { down = false; }
}

public class FraktumTextPulseOnChange : MonoBehaviour
{
    private Text text;
    private RectTransform rt;
    private string last;
    private float pulse;

    private void Awake()
    {
        text = GetComponent<Text>();
        rt = transform as RectTransform;
        last = text != null ? text.text : string.Empty;
    }

    private void Update()
    {
        if (text == null || rt == null)
            return;

        if (text.text != last)
        {
            last = text.text;
            pulse = 1f;
        }

        if (pulse > 0f)
        {
            pulse = Mathf.Max(0f, pulse - Time.unscaledDeltaTime * 4.8f);
            float k = Mathf.Sin(pulse * Mathf.PI);
            rt.localScale = Vector3.one * (1f + k * .145f);
        }
        else
        {
            rt.localScale = Vector3.Lerp(rt.localScale, Vector3.one, Time.unscaledDeltaTime * 10f);
        }
    }
}

public class FraktumSoftPanelPulse : MonoBehaviour
{
    public Image target;
    public float amount = .025f;
    public float speed = .85f;

    private Color baseColor;
    private float seed;

    private void Awake()
    {
        if (target == null)
            target = GetComponent<Image>();

        if (target != null)
            baseColor = target.color;

        seed = Random.value * 20f;
    }

    private void Update()
    {
        if (target == null)
            return;

        Color c = baseColor;
        c.r = Mathf.Clamp01(c.r + Mathf.Sin(Time.unscaledTime * speed + seed) * amount);
        c.g = Mathf.Clamp01(c.g + Mathf.Sin(Time.unscaledTime * speed + seed + 1.1f) * amount * .55f);
        c.b = Mathf.Clamp01(c.b + Mathf.Sin(Time.unscaledTime * speed + seed + 2.2f) * amount);
        target.color = c;
    }
}

public class FraktumMoteField : MonoBehaviour
{
    public RectTransform root;
    public int count = 34;

    private readonly List<Mote> motes = new List<Mote>();

    private void Start()
    {
        if (root == null)
            root = transform as RectTransform;

        for (int i = 0; i < count; i++)
            CreateMote();
    }

    private void Update()
    {
        if (root == null)
            return;

        Rect rect = root.rect;
        for (int i = 0; i < motes.Count; i++)
        {
            Mote m = motes[i];
            if (m.rt == null) continue;

            m.pos += m.velocity * Time.unscaledDeltaTime;
            m.pos.x += Mathf.Sin(Time.unscaledTime * m.waveSpeed + m.seed) * Time.unscaledDeltaTime * 6f;

            if (m.pos.y > rect.yMax + 20f)
                m.pos = new Vector2(Random.Range(rect.xMin, rect.xMax), rect.yMin - 20f);

            m.rt.anchoredPosition = m.pos;
            Color c = m.image.color;
            c.a = m.alpha + Mathf.Sin(Time.unscaledTime * m.waveSpeed + m.seed) * .025f;
            m.image.color = c;
        }
    }

    private void CreateMote()
    {
        GameObject go = new GameObject("ambient mote", typeof(RectTransform), typeof(Image));
        go.transform.SetParent(transform, false);

        Image img = go.GetComponent<Image>();
        img.raycastTarget = false;
        img.color = new Color(1f, .72f, .24f, Random.Range(.025f, .090f));

        RectTransform rt = go.GetComponent<RectTransform>();
        float size = Random.Range(2f, 6f);
        rt.sizeDelta = new Vector2(size, size);

        Rect rect = root != null ? root.rect : new Rect(-960, -540, 1920, 1080);
        Mote mote = new Mote();
        mote.rt = rt;
        mote.image = img;
        mote.pos = new Vector2(Random.Range(rect.xMin, rect.xMax), Random.Range(rect.yMin, rect.yMax));
        mote.velocity = new Vector2(Random.Range(-4f, 4f), Random.Range(7f, 22f));
        mote.alpha = img.color.a;
        mote.waveSpeed = Random.Range(.4f, 1.2f);
        mote.seed = Random.value * 30f;
        rt.anchoredPosition = mote.pos;
        motes.Add(mote);
    }

    private class Mote
    {
        public RectTransform rt;
        public Image image;
        public Vector2 pos;
        public Vector2 velocity;
        public float alpha;
        public float waveSpeed;
        public float seed;
    }
}
