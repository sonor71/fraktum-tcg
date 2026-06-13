using System.Collections.Generic;

public static class CardIdentityResolver
{
    private static Dictionary<string, string> codeToBaseId = new Dictionary<string, string>()
    {
        { "ORC", "oracle" },
        { "DRE", "dragon_eye" },
        { "WLV", "wood_vines" },
        { "TOL", "tree_of_life" },
        { "CAD", "caduceus" },
        { "BOK", "book_knowledge" },
        { "SND", "sandstorm" },
        { "RVH", "reverse_heart" },
        { "SHS", "shadow_sword" },
        { "SOH", "shield_hope" },
        { "DBL", "double_speed" },
        { "ENS", "energy_sword" },
        { "SVN", "seventy_one" },
        { "AOS", "amulet_of_old_sage" },
        { "TOR", "time_of_reckoning" },
        { "HYN", "hyper_night" }
    };

    public static string GetBaseId(string uniqueId)
    {
        if (string.IsNullOrEmpty(uniqueId))
            return null;

        string[] parts = uniqueId.Split('-');

        if (parts.Length < 1)
            return null;

        string code = parts[0];

        if (codeToBaseId.ContainsKey(code))
            return codeToBaseId[code];

        return null;
    }
}