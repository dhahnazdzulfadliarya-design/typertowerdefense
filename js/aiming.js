export const DIRECTIONS=['right','down-right','down','down-left','left','up-left','up','up-right'];
export const DIRECTION_ROWS={'up':0,'up-right':1,'right':2,'down-right':3,'down':4,'down-left':5,'left':6,'up-left':7};
const SECTOR=Math.PI/4;
export const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
// Canvas coordinates: +Y means DOWN. Eight sectors, each centred 45 degrees apart.
export function angleToDirection(angle,previous=null,hysteresis=0){
  if(!Number.isFinite(angle))return previous??'right';
  const index=DIRECTIONS.indexOf(previous);
  if(index>=0&&Math.abs(angleDifference(angle,index*SECTOR))<=SECTOR/2+hysteresis)return previous;
  return DIRECTIONS[((Math.floor((angle+SECTOR/2)/SECTOR)%8)+8)%8];
}
export function getAimDirection(archer,target,previous=null){
  return target?angleToDirection(Math.atan2(target.y-archer.y,target.x-archer.x),previous,4*Math.PI/180):previous??'right';
}
// Bow-grip offsets measured from the common boot anchor in the 132px reference body.
export const ARROW_ORIGIN={right:{x:68,y:-93},'down-right':{x:58,y:-65},down:{x:6,y:-51},'down-left':{x:-50,y:-59},left:{x:-62,y:-81},'up-left':{x:-25,y:-122},up:{x:12,y:-102},'up-right':{x:33,y:-112}};
export function getArrowOrigin(base,direction,scale=1){const o=ARROW_ORIGIN[direction]??ARROW_ORIGIN.right;return {x:base.x+o.x*scale,y:base.y+o.y*scale};}
// Straight predictive interception; the enemy continues moving during flight.
export function interceptTime(origin,target,velocity,speed){
  const dx=target.x-origin.x,dy=target.y-origin.y,a=velocity.x**2+velocity.y**2-speed**2,b=2*(dx*velocity.x+dy*velocity.y),c=dx**2+dy**2;
  if(c<.01)return 0;
  const d=b*b-4*a*c;
  if(Math.abs(a)<.0001||d<0)return Math.sqrt(c)/speed;
  const root=Math.sqrt(d),options=[(-b+root)/(2*a),(-b-root)/(2*a)].filter(n=>n>0&&Number.isFinite(n));
  return options.length?Math.min(...options):Math.sqrt(c)/speed;
}
