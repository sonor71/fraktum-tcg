using UnityEngine;

public static class UIFontUtility
{
    private static Font defaultFont;

    public static Font GetDefaultFont()
    {
        if (defaultFont == null)
        {
            defaultFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        }

        return defaultFont;
    }
}
