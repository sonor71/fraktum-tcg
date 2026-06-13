using System.Collections;
using UnityEngine;
using UnityEngine.UI;
public class DiceView : MonoBehaviour
{
    public Text resultText; public Button rollButton; public int LastResult { get; private set; }
    public System.Action<int> Rolled;
    private void Awake(){ if(rollButton) rollButton.onClick.AddListener(()=>StartCoroutine(RollRoutine())); }
    public void Roll(){ StartCoroutine(RollRoutine()); }
    private IEnumerator RollRoutine(){ for(int i=0;i<12;i++){ LastResult=Random.Range(1,21); if(resultText) resultText.text="d20\n"+LastResult; transform.localRotation=Quaternion.Euler(0,0,Random.Range(-18,18)); yield return new WaitForSeconds(.035f);} transform.localRotation=Quaternion.identity; Rolled?.Invoke(LastResult); }
}
