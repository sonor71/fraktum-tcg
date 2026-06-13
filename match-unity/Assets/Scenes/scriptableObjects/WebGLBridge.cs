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

        return "{\"mode\":\"ai\",\"playerName\":\"Player\",\"enemyName\":\"AI\",\"deckIds\":[\"card_001\",\"card_002\",\"card_003\"],\"startedAt\":0}";
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