using System.Collections.Generic;

public static class CardIdentityResolver
{
    private static readonly Dictionary<string, string> codeToBaseId = new Dictionary<string, string>()
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
        { "HYN", "hyper_night" },
        { "TMC", "crystal_of_time" },
        { "TTE", "titan_eye" },
        { "CHA", "armor_of_chaos" },
        { "ICE", "ice" },
        { "EFS", "elven_sword" },
        { "FIR", "fire" },
        { "THN", "thunderbolts" },
        { "WRL", "warlock" },
        { "EXC", "excalibur" },
        { "ELS", "stun_gun" }
    };

    public static string GetBaseId(string uniqueId)
    {
        if (string.IsNullOrEmpty(uniqueId))
        {
            return null;
        }

        if (codeToBaseId.ContainsValue(uniqueId))
        {
            return uniqueId;
        }

        string[] parts = uniqueId.Split('-');

        if (parts.Length < 1)
        {
            return null;
        }

        string code = parts[0];

        if (codeToBaseId.TryGetValue(code, out string baseId))
        {
            return baseId;
        }

        return null;
    }
}
