using System.Runtime.InteropServices;
using UnityEngine;

public static class WebGLBridge
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern string GetMatchPayload();

    [DllImport("__Internal")]
    private static extern void SetMatchResult(string result);
#endif

    public static string LoadMatchPayload()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        return GetMatchPayload();
#else
        Debug.Log("WebGLBridge: LoadMatchPayload работает только в WebGL build. В Editor возвращаю тестовые данные.");

        return "{\"mode\":\"ai\",\"playerName\":\"Player\",\"enemyName\":\"AI\",\"deckIds\":[\"ENS-EDITOR-001\",\"DBL-EDITOR-002\",\"ICE-EDITOR-003\",\"DRE-EDITOR-004\",\"TOL-EDITOR-005\",\"CHA-EDITOR-006\",\"TMC-EDITOR-007\",\"TTE-EDITOR-008\",\"FIR-EDITOR-009\",\"THN-EDITOR-010\"],\"ownedCards\":[{\"instanceId\":\"ENS-EDITOR-001\",\"baseId\":\"energy_sword\",\"title\":\"Energy Sword\",\"type\":\"attack\",\"rarity\":\"rare\",\"cost\":2,\"attack\":4,\"health\":0,\"description\":\"Editor fallback attack card.\",\"effectKey\":\"damage\"},{\"instanceId\":\"DBL-EDITOR-002\",\"baseId\":\"double_speed\",\"title\":\"Double Speed\",\"type\":\"tactic\",\"rarity\":\"common\",\"cost\":1,\"attack\":0,\"health\":0,\"description\":\"Draw a card in the editor fallback deck.\",\"effectKey\":\"draw\"},{\"instanceId\":\"ICE-EDITOR-003\",\"baseId\":\"ice\",\"title\":\"Ice\",\"type\":\"effect\",\"rarity\":\"rare\",\"cost\":2,\"attack\":1,\"health\":0,\"description\":\"Slow the opponent.\",\"effectKey\":\"slow\"},{\"instanceId\":\"DRE-EDITOR-004\",\"baseId\":\"dragon_eye\",\"title\":\"Dragon Eye\",\"type\":\"bonus\",\"rarity\":\"epic\",\"cost\":3,\"attack\":0,\"health\":4,\"description\":\"Gain a shield.\",\"effectKey\":\"shield\"},{\"instanceId\":\"TOL-EDITOR-005\",\"baseId\":\"tree_of_life\",\"title\":\"Tree of Life\",\"type\":\"bonus\",\"rarity\":\"epic\",\"cost\":3,\"attack\":0,\"health\":5,\"description\":\"Heal yourself.\",\"effectKey\":\"heal\"},{\"instanceId\":\"CHA-EDITOR-006\",\"baseId\":\"armor_of_chaos\",\"title\":\"Armor of Chaos\",\"type\":\"tactic\",\"rarity\":\"mythic\",\"cost\":2,\"attack\":0,\"health\":3,\"description\":\"Protect yourself with chaotic armor.\",\"effectKey\":\"shield\"},{\"instanceId\":\"TMC-EDITOR-007\",\"baseId\":\"crystal_of_time\",\"title\":\"Crystal of Time\",\"type\":\"effect\",\"rarity\":\"legendary\",\"cost\":2,\"attack\":0,\"health\":0,\"description\":\"Gain one Will.\",\"effectKey\":\"resource\"},{\"instanceId\":\"TTE-EDITOR-008\",\"baseId\":\"titan_eye\",\"title\":\"Titan Eye\",\"type\":\"attack\",\"rarity\":\"rare\",\"cost\":3,\"attack\":5,\"health\":0,\"description\":\"A heavy editor fallback attack.\",\"effectKey\":\"damage\"},{\"instanceId\":\"FIR-EDITOR-009\",\"baseId\":\"fire\",\"title\":\"Fire\",\"type\":\"attack\",\"rarity\":\"common\",\"cost\":1,\"attack\":3,\"health\":0,\"description\":\"Deal quick damage.\",\"effectKey\":\"damage\"},{\"instanceId\":\"THN-EDITOR-010\",\"baseId\":\"thunderbolts\",\"title\":\"Thunderbolts\",\"type\":\"attack\",\"rarity\":\"rare\",\"cost\":2,\"attack\":4,\"health\":0,\"description\":\"Strike with lightning.\",\"effectKey\":\"damage\"}],\"startedAt\":0}";
#endif
    }

    public static void SaveMatchResult(string resultJson)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        SetMatchResult(resultJson);
#else
        Debug.Log("WebGLBridge: SaveMatchResult работает только в WebGL build. Result: " + resultJson);
#endif
    }
}