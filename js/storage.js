export const STORAGE_KEY='typertowerdefense.endless.v2';
export const emptyHighScore=()=>({bestScore:0,highestWave:0,mostDefeated:0,bestWPM:0,bestAccuracy:0,longestTime:0});
export const freshSave=()=>({version:2,highScore:emptyHighScore(),muted:true});
const safe=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
export function readSave(storage){
  try{
    storage??=globalThis.localStorage;const value=JSON.parse(storage.getItem(STORAGE_KEY)),save=freshSave();
    if(value?.version===2){
      const h=value.highScore??{};
      for(const key of Object.keys(save.highScore))save.highScore[key]=safe(h[key],key==='bestAccuracy'?100:Number.MAX_SAFE_INTEGER);
      save.highScore.bestScore=Math.floor(save.highScore.bestScore);save.highScore.highestWave=Math.floor(save.highScore.highestWave);save.highScore.mostDefeated=Math.floor(save.highScore.mostDefeated);save.muted=value.muted!==false;
    }else{const old=JSON.parse(storage.getItem('typertowerdefense.v1'));if(old?.muted===false)save.muted=false;}
    return save;
  }catch{return freshSave();}
}
export function writeSave(save,storage){try{storage??=globalThis.localStorage;storage.setItem(STORAGE_KEY,JSON.stringify(save));return true;}catch{return false;}}
export function recordResult(save,result){
  const h=save.highScore,isNew=safe(result.score)>h.bestScore;
  h.bestScore=Math.max(h.bestScore,Math.floor(safe(result.score)));
  h.highestWave=Math.max(h.highestWave,safe(result.wave));h.mostDefeated=Math.max(h.mostDefeated,safe(result.kills));h.bestWPM=Math.max(h.bestWPM,safe(result.wpm));h.bestAccuracy=Math.max(h.bestAccuracy,safe(result.accuracy,100));h.longestTime=Math.max(h.longestTime,safe(result.seconds));return isNew;
}
