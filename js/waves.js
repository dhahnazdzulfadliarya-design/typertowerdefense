import {clamp,NAME_POOLS} from './config.js';
const WEIGHTS=[[1,[.70,.25,.05]],[7,[.40,.40,.20]],[15,[.20,.40,.40]],[25,[.10,.35,.55]]];
export function wordWeights(wave){
  for(let i=1;i<WEIGHTS.length;i++){
    if(wave<=WEIGHTS[i][0]){
      const [a,wa]=WEIGHTS[i-1],[b,wb]=WEIGHTS[i],t=clamp((wave-a)/(b-a),0,1);
      return wa.map((n,j)=>n+(wb[j]-n)*t);
    }
  }
  return [...WEIGHTS.at(-1)[1]];
}
export function calculateDifficulty(wave){
  const w=Math.max(1,Math.floor(wave));
  return {enemyCount:Math.floor(5+w*1.35+Math.pow(w,.72)),maxActive:Math.min(12,3+Math.floor((w-1)/2)),spawnDelay:Math.max(.60,2.15-(w-1)*.065),travelTime:Math.max(4.3,13-(w-1)*.22),breakTime:Math.max(.5,2-(w-1)*.055),weights:wordWeights(w)};
}
export class NameDeck{
  constructor(names,rng=Math.random){this.names=names;this.rng=rng;this.bag=[];}
  refill(){this.bag=[...this.names];for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}
  next(active=[]){
    if(!this.bag.length)this.refill();
    const i=this.bag.findIndex(n=>!active.includes(n));
    if(i<0){const available=this.names.filter(n=>!active.includes(n));return available.length?available[Math.floor(this.rng()*available.length)]:null;}
    return this.bag.splice(i,1)[0];
  }
}
export class WeightedNames{
  constructor(rng=Math.random){this.rng=rng;this.decks=Object.values(NAME_POOLS).map(pool=>new NameDeck(pool,rng));}
  next(wave,active){
    const weights=wordWeights(wave),roll=this.rng(),index=roll<weights[0]?0:roll<weights[0]+weights[1]?1:2;
    for(let n=0;n<3;n++){const name=this.decks[(index+n)%3].next(active);if(name)return name;}
    return null;
  }
}
