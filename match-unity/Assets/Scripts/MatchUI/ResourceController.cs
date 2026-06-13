using UnityEngine;
using UnityEngine.UI;
public class ResourceController : MonoBehaviour
{
    public string resourceName = "Will"; public int current; public int maximum = 5; public Text label; public Image fill;
    public void Set(int value, int max){ maximum=Mathf.Max(0,max); current=Mathf.Clamp(value,0,maximum); Refresh(); }
    public void StartTurn(int turn){ maximum=Mathf.Clamp(turn,1,10); current=maximum; Refresh(); }
    public bool CanPay(int cost)=> current>=cost;
    public bool Spend(int cost){ if(!CanPay(cost)) return false; current-=cost; Refresh(); return true; }
    public void Gain(int amount){ current=Mathf.Clamp(current+amount,0,maximum); Refresh(); }
    public void Refresh(){ if(label) label.text=$"{resourceName}\n{current}/{maximum}"; if(fill) fill.fillAmount=maximum>0?current/(float)maximum:0; }
}
