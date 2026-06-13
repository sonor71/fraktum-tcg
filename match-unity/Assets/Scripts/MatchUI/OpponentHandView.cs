using System.Collections.Generic;
using UnityEngine;
public class OpponentHandView : MonoBehaviour
{
    public RectTransform handRoot; public CardView cardBackPrefab; public float width=520f; public float arcHeight=45f; public float maxAngle=16f; private readonly List<CardView> backs=new List<CardView>();
    private void Awake(){ if(handRoot==null) handRoot=transform as RectTransform; }
    public void SetCardCount(int count){ while(backs.Count<count){ CardView v=Instantiate(cardBackPrefab,handRoot); v.Bind(null,true); v.SetState(CardViewState.EnemyHidden); backs.Add(v);} while(backs.Count>count){ CardView v=backs[backs.Count-1]; backs.RemoveAt(backs.Count-1); Destroy(v.gameObject);} Layout(); }
    public void Layout(){ int count=backs.Count; for(int i=0;i<count;i++){ float t=count<=1?.5f:i/(float)(count-1); float x=Mathf.Lerp(-width*.5f,width*.5f,t); float y=Mathf.Sin(t*Mathf.PI)*arcHeight; float a=Mathf.Lerp(-maxAngle,maxAngle,t); RectTransform rt=backs[i].transform as RectTransform; rt.localPosition=new Vector3(x,y,0); rt.localRotation=Quaternion.Euler(0,0,a); rt.localScale=Vector3.one*.72f; } }
}
