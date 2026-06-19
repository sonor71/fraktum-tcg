using System.Collections.Generic;
using System.IO;
using UnityEngine;

public static class FraktumCardArtRegistry
{
    private static readonly Dictionary<string, string> keyToImage = new Dictionary<string, string>();

    private static readonly Dictionary<string, Sprite> runtimeSprites = new Dictionary<string, Sprite>();
    private static bool runtimeSpritesBuilt;


    static FraktumCardArtRegistry()
    {
        Add("/cards/energy-sword.png", "energy_sword", "Energy Sword", "Энергетический меч", "/cards/energy-sword.png", "energy-sword.png", "energy-sword");
        Add("/cards/sandstorm.png", "sandstorm", "Sandstorm", "Песчаная буря", "/cards/sandstorm.png", "sandstorm.png");
        Add("/cards/shadow-sword.png", "shadow_sword", "Shadow Sword", "Теневой меч", "/cards/shadow-sword.png", "shadow-sword.png", "shadow-sword");
        Add("/cards/the magician.png", "magician", "Magician", "Маг", "/cards/the magician.png", "the magician.png", "the magician");
        Add("/cards/The Elven Sword.png", "elven_sword", "Elven Sword", "Эльфийский меч", "/cards/The Elven Sword.png", "The Elven Sword.png", "The Elven Sword");
        Add("/cards/hunter.png", "hunter", "Hunter", "Охотник", "/cards/hunter.png", "hunter.png");
        Add("/cards/Spherical Lightning.png", "spherical_lightning", "Spherical Lightning", "Шаровая молния", "/cards/Spherical Lightning.png", "Spherical Lightning.png");
        Add("/cards/Valkyrie.png", "valkyrie", "Valkyrie", "Валькирия", "/cards/Valkyrie.png", "Valkyrie.png");
        Add("/cards/Thunderer.png", "thunderer", "Thunderer", "Громовержец", "/cards/Thunderer.png", "Thunderer.png");
        Add("/cards/thunderbolts.png", "thunderbolts", "Thunderbolts", "Раскаты молний", "/cards/thunderbolts.png", "thunderbolts.png");
        Add("/cards/WARLOCK.png", "warlock", "Warlock", "Варлок", "/cards/WARLOCK.png", "WARLOCK.png", "WARLOCK");
        Add("/cards/Excalibur.png", "excalibur", "Excalibur", "Экскалибур", "/cards/Excalibur.png", "Excalibur.png");
        Add("/cards/fire.png", "fire", "Fire", "Огонь", "/cards/fire.png", "fire.png");
        Add("/cards/ice.png", "ice", "Ice", "Лёд", "/cards/ice.png", "ice.png");
        Add("/cards/Brian.png", "brian", "Brian", "Брайан", "/cards/Brian.png", "Brian.png");
        Add("/cards/SAM.png", "sam", "Sam", "Сэм", "/cards/SAM.png", "SAM.png", "SAM");
        Add("/cards/Felix.png", "felix", "Felix", "Феликс", "/cards/Felix.png", "Felix.png");
        Add("/cards/The Hand of God.png", "hand_of_god", "Hand of God", "Рука Бога", "/cards/The Hand of God.png", "The Hand of God.png", "The Hand of God");
        Add("/cards/seventy-one.png", "seventy_one", "Seventy One", "71", "/cards/seventy-one.png", "seventy-one.png", "seventy-one");
        Add("/cards/time-of-reckoning.png", "time_of_reckoning", "Time of Reckoning", "Время расплаты", "/cards/time-of-reckoning.png", "time-of-reckoning.png", "time-of-reckoning");
        Add("/cards/dragon-eye.png", "dragon_eye", "Dragon Eye", "Драконий глаз", "/cards/dragon-eye.png", "dragon-eye.png", "dragon-eye");
        Add("/cards/wood-vines.png", "wood_vines", "Wood Vines", "Древесные лозы", "/cards/wood-vines.png", "wood-vines.png", "wood-vines");
        Add("/cards/tree-of-life.png", "tree_of_life", "Tree of Life", "Древо жизни", "/cards/tree-of-life.png", "tree-of-life.png", "tree-of-life");
        Add("/cards/Caduceus.png", "caduceus", "Caduceus", "Кадуцей", "/cards/Caduceus.png", "Caduceus.png");
        Add("/cards/book-knowledge.png", "book_knowledge", "Book Knowledge", "Книга знаний", "/cards/book-knowledge.png", "book-knowledge.png", "book-knowledge");
        Add("/cards/oracle.png", "oracle", "Oracle", "Оракул", "/cards/oracle.png", "oracle.png");
        Add("/cards/reverse-heart.png", "reverse_heart", "Reverse Heart", "Реверсивное сердце", "/cards/reverse-heart.png", "reverse-heart.png", "reverse-heart");
        Add("/cards/double-speed.png", "double_speed", "2X", "/cards/double-speed.png", "double-speed.png", "double-speed");
        Add("/cards/REVERSE.png", "reverse", "Reverse", "Реверс", "/cards/REVERSE.png", "REVERSE.png", "REVERSE");
        Add("/cards/roulette of fate.png", "fifteen_sixteen", "15-16", "/cards/roulette of fate.png", "roulette of fate.png", "roulette of fate");
        Add("/cards/THE CRYSTAL OF TIME.png", "crystal_of_time", "Crystal of Time", "Кристалл времени", "/cards/THE CRYSTAL OF TIME.png", "THE CRYSTAL OF TIME.png", "THE CRYSTAL OF TIME");
        Add("/cards/Phoenix feather.png", "phoenix_feather", "Phoenix Feather", "Перо Феникса", "/cards/Phoenix feather.png", "Phoenix feather.png", "Phoenix feather");
        Add("/cards/amulet-of-old-sage.png", "amulet_of_old_sage", "Amulet of Old Sage", "Амулет Старого Мудреца", "/cards/amulet-of-old-sage.png", "amulet-of-old-sage.png", "amulet-of-old-sage");
        Add("/cards/hyper-night.png", "hyper_night", "Hyper Night", "Гиперночь", "/cards/hyper-night.png", "hyper-night.png", "hyper-night");
        Add("/cards/shield-hope.png", "shield_hope", "Shield of Hope", "Щит Надежды", "/cards/shield-hope.png", "shield-hope.png", "shield-hope");
        Add("/cards/Legendary Messenger.png", "legendary_messenger", "Legendary Messenger", "Легендарный Вестник", "/cards/Legendary Messenger.png", "Legendary Messenger.png");
        Add("/cards/Seal of the Forgotten Souls.png", "seal_of_forgotten_souls", "Seal of the Forgotten Souls", "Печать Забытых Душ", "/cards/Seal of the Forgotten Souls.png", "Seal of the Forgotten Souls.png");
        Add("/cards/psychological disorder.png", "psychological_disorder", "Psychological Disorder", "Психологическое расстройство", "/cards/psychological disorder.png", "psychological disorder.png", "psychological disorder");
        Add("/cards/INREQUITED LOVE.png", "unrequited_love", "Unrequited Love", "Безответная любовь", "/cards/INREQUITED LOVE.png", "INREQUITED LOVE.png", "INREQUITED LOVE");
        Add("/cards/Armor of chaos.png", "armor_of_chaos", "Armor of Chaos", "Броня Хаоса", "/cards/Armor of chaos.png", "Armor of chaos.png", "Armor of chaos");
        Add("/cards/eye titan.png", "titan_eye", "Titan Eye", "Глаз Титана", "/cards/eye titan.png", "eye titan.png", "eye titan");
        Add("/cards/Stun Gun.png", "Stun_Gun", "Stun Gun", "Электрошокер", "/cards/Stun Gun.png", "Stun Gun.png");

        AddAlias("BRN", "brian");
        AddAlias("BRI", "brian");
        AddAlias("FLX", "felix");
        AddAlias("FEL", "felix");
        AddAlias("SAM", "sam");
        AddAlias("EGS", "energy_sword");
        AddAlias("ENS", "energy_sword");
        AddAlias("SND", "sandstorm");
        AddAlias("SHS", "shadow_sword");
        AddAlias("SSW", "shadow_sword");
        AddAlias("MAG", "magician");
        AddAlias("MGN", "magician");
        AddAlias("EFS", "elven_sword");
        AddAlias("ELS", "elven_sword");
        AddAlias("HTR", "hunter");
        AddAlias("HUN", "hunter");
        AddAlias("SPL", "spherical_lightning");
        AddAlias("SLG", "spherical_lightning");
        AddAlias("VLK", "valkyrie");
        AddAlias("VAL", "valkyrie");
        AddAlias("THD", "thunderer");
        AddAlias("TDR", "thunderer");
        AddAlias("THB", "thunderbolts");
        AddAlias("THN", "thunderbolts");
        AddAlias("TBT", "thunderbolts");
        AddAlias("WRL", "warlock");
        AddAlias("WAR", "warlock");
        AddAlias("EXC", "excalibur");
        AddAlias("FIR", "fire");
        AddAlias("ICE", "ice");
        AddAlias("HOG", "hand_of_god");
        AddAlias("THG", "hand_of_god");
        AddAlias("SVN", "seventy_one");
        AddAlias("SVO", "seventy_one");
        AddAlias("071", "seventy_one");
        AddAlias("TOR", "time_of_reckoning");
        AddAlias("TMR", "time_of_reckoning");
        AddAlias("DRE", "dragon_eye");
        AddAlias("DGE", "dragon_eye");
        AddAlias("WLV", "wood_vines");
        AddAlias("WVN", "wood_vines");
        AddAlias("TOL", "tree_of_life");
        AddAlias("CAD", "caduceus");
        AddAlias("BOK", "book_knowledge");
        AddAlias("ORC", "oracle");
        AddAlias("RVH", "reverse_heart");
        AddAlias("DBL", "double_speed");
        AddAlias("RVS", "reverse");
        AddAlias("REV", "reverse");
        AddAlias("ROF", "fifteen_sixteen");
        AddAlias("RLT", "fifteen_sixteen");
        AddAlias("FTS", "fifteen_sixteen");
        AddAlias("TMC", "crystal_of_time");
        AddAlias("COT", "crystal_of_time");
        AddAlias("PHF", "phoenix_feather");
        AddAlias("PNX", "phoenix_feather");
        AddAlias("AOS", "amulet_of_old_sage");
        AddAlias("HYN", "hyper_night");
        AddAlias("HNT", "hyper_night");
        AddAlias("SOH", "shield_hope");
        AddAlias("SHO", "shield_hope");
        AddAlias("LGM", "legendary_messenger");
        AddAlias("LMS", "legendary_messenger");
        AddAlias("SFS", "seal_of_forgotten_souls");
        AddAlias("PSD", "psychological_disorder");
        AddAlias("PDS", "psychological_disorder");
        AddAlias("UNL", "unrequited_love");
        AddAlias("URL", "unrequited_love");
        AddAlias("AOC", "armor_of_chaos");
        AddAlias("CHA", "armor_of_chaos");
        AddAlias("TTE", "titan_eye");
        AddAlias("TIE", "titan_eye");
        AddAlias("STG", "Stun_Gun");
        AddAlias("STN", "Stun_Gun");
    }

    public static Sprite ResolveSprite(CardDefinition definition, CardInstance instance)
    {
        BuildRuntimeSpriteCache();

        Sprite sprite;

        sprite = GetSpriteByAnyKey(ResolveImagePath(definition, instance));
        if (sprite != null) return sprite;

        sprite = GetSpriteByAnyKey(definition != null ? definition.frontSrc : null);
        if (sprite != null) return sprite;

        sprite = GetSpriteByAnyKey(definition != null ? definition.image : null);
        if (sprite != null) return sprite;

        sprite = GetSpriteByAnyKey(instance != null ? instance.baseId : null);
        if (sprite != null) return sprite;

        sprite = GetSpriteByAnyKey(definition != null ? definition.id : null);
        if (sprite != null) return sprite;

        sprite = GetSpriteByAnyKey(definition != null ? definition.cardName : null);
        if (sprite != null) return sprite;

        sprite = GetSpriteByAnyKey(instance != null ? CardIdentityResolver.GetBaseId(instance.uniqueId) : null);
        if (sprite != null) return sprite;

        sprite = GetSpriteByAnyKey(instance != null ? instance.uniqueId : null);
        if (sprite != null) return sprite;

        return null;
    }

    private static Sprite GetSpriteByAnyKey(string rawKey)
    {
        if (string.IsNullOrWhiteSpace(rawKey)) return null;

        string mapped = GetImagePathByKey(rawKey);
        string[] attempts = new string[]
        {
            rawKey,
            mapped,
            Path.GetFileNameWithoutExtension(rawKey.Replace('\\', '/')),
            Path.GetFileNameWithoutExtension((mapped ?? "").Replace('\\', '/')),
            CardIdentityResolver.GetBaseId(rawKey)
        };

        for (int i = 0; i < attempts.Length; i++)
        {
            string key = NormalizeKey(attempts[i]);
            if (string.IsNullOrEmpty(key)) continue;

            Sprite sprite;
            if (runtimeSprites.TryGetValue(key, out sprite) && sprite != null)
                return sprite;
        }

        return null;
    }

    private static void BuildRuntimeSpriteCache()
    {
        if (runtimeSpritesBuilt) return;
        runtimeSpritesBuilt = true;
        runtimeSprites.Clear();

        AddRuntimeAssetsFromFolder("cards");
        AddRuntimeAssetsFromFolder("Cards");
    }

    private static void AddRuntimeAssetsFromFolder(string folder)
    {
        UnityEngine.Object[] assets = Resources.LoadAll(folder);
        if (assets == null) return;

        for (int i = 0; i < assets.Length; i++)
        {
            UnityEngine.Object asset = assets[i];
            if (asset == null) continue;

            Sprite sprite = asset as Sprite;
            if (sprite == null)
            {
                Texture2D texture = asset as Texture2D;
                if (texture != null)
                {
                    texture.filterMode = FilterMode.Point;
                    texture.wrapMode = TextureWrapMode.Clamp;
                    sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(.5f, .5f), 100f);
                    sprite.name = texture.name;
                }
            }

            if (sprite == null) continue;

            AddRuntimeSpriteAlias(asset.name, sprite);
            AddRuntimeSpriteAlias(sprite.name, sprite);
            AddRuntimeSpriteAlias(folder + "/" + asset.name, sprite);
            AddRuntimeSpriteAlias("/cards/" + asset.name + ".png", sprite);
        }
    }

    private static void AddRuntimeSpriteAlias(string alias, Sprite sprite)
    {
        if (sprite == null || string.IsNullOrWhiteSpace(alias)) return;

        string key = NormalizeKey(alias);
        if (string.IsNullOrEmpty(key)) return;

        if (!runtimeSprites.ContainsKey(key))
            runtimeSprites.Add(key, sprite);
    }

    public static string ResolveImagePath(CardDefinition definition, CardInstance instance)
    {
        string direct;

        direct = GetDirectOrMapped(definition != null ? definition.frontSrc : null);
        if (!string.IsNullOrEmpty(direct)) return direct;

        direct = GetDirectOrMapped(definition != null ? definition.image : null);
        if (!string.IsNullOrEmpty(direct)) return direct;

        direct = GetImagePathByKey(instance != null ? instance.baseId : null);
        if (!string.IsNullOrEmpty(direct)) return direct;

        direct = GetImagePathByKey(definition != null ? definition.id : null);
        if (!string.IsNullOrEmpty(direct)) return direct;

        string resolvedBaseId = instance != null ? CardIdentityResolver.GetBaseId(instance.uniqueId) : null;
        direct = GetImagePathByKey(resolvedBaseId);
        if (!string.IsNullOrEmpty(direct)) return direct;

        direct = GetImagePathByKey(definition != null ? definition.cardName : null);
        if (!string.IsNullOrEmpty(direct)) return direct;

        direct = GetImagePathByKey(instance != null ? instance.uniqueId : null);
        if (!string.IsNullOrEmpty(direct)) return direct;

        return null;
    }

    public static string GetImagePathByKey(string rawKey)
    {
        string key = NormalizeKey(rawKey);
        if (string.IsNullOrEmpty(key)) return null;

        string image;
        if (keyToImage.TryGetValue(key, out image)) return image;

        string baseId = CardIdentityResolver.GetBaseId(rawKey);
        string baseKey = NormalizeKey(baseId);
        if (!string.IsNullOrEmpty(baseKey) && keyToImage.TryGetValue(baseKey, out image)) return image;

        return null;
    }

    private static string GetDirectOrMapped(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        string cleaned = raw.Trim().Replace('\\', '/');
        if (LooksLikeImagePath(cleaned)) return cleaned;

        return GetImagePathByKey(raw);
    }

    private static bool LooksLikeImagePath(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return false;
        string lower = raw.ToLowerInvariant();
        return lower.EndsWith(".png") || lower.EndsWith(".jpg") || lower.EndsWith(".jpeg") || lower.Contains("/cards/") || lower.StartsWith("cards/") || lower.StartsWith("/cards/");
    }

    private static void Add(string imagePath, params string[] aliases)
    {
        if (string.IsNullOrWhiteSpace(imagePath)) return;

        for (int i = 0; i < aliases.Length; i++)
            AddAlias(aliases[i], imagePath);
    }

    private static void AddAlias(string alias, string imageOrBaseKey)
    {
        string key = NormalizeKey(alias);
        if (string.IsNullOrEmpty(key)) return;

        string image = imageOrBaseKey;
        if (!LooksLikeImagePath(imageOrBaseKey))
        {
            string mapped = GetImagePathByKey(imageOrBaseKey);
            if (!string.IsNullOrEmpty(mapped)) image = mapped;
        }

        if (!keyToImage.ContainsKey(key))
            keyToImage.Add(key, image);
    }

    public static string NormalizeKey(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        string key = raw.Trim().Replace('\\', '/').ToLowerInvariant();

        int query = key.IndexOf('?');
        if (query >= 0) key = key.Substring(0, query);

        if (key.StartsWith("http://") || key.StartsWith("https://"))
        {
            int slash = key.LastIndexOf('/');
            key = slash >= 0 ? key.Substring(slash + 1) : key;
        }

        if (key.StartsWith("/")) key = key.Substring(1);
        if (key.StartsWith("public/")) key = key.Substring("public/".Length);
        if (key.StartsWith("assets/")) key = key.Substring("assets/".Length);
        if (key.StartsWith("resources/")) key = key.Substring("resources/".Length);
        if (key.StartsWith("cards/")) key = key.Substring("cards/".Length);

        key = Path.GetFileName(key);
        int dot = key.LastIndexOf('.');
        if (dot > 0) key = key.Substring(0, dot);

        key = key.Replace('-', '_').Replace(' ', '_');
        while (key.Contains("__")) key = key.Replace("__", "_");
        return key.Trim('_');
    }
}