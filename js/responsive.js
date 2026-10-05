import {clamp} from './config.js';
export function createLayout(width,height,topInset=0,bottomInset=0){
  const w=Math.max(240,width),h=Math.max(200,height),small=w<760;
  const top=topInset+(small?70:100),bottom=h-bottomInset-(small?(h<420?77:112):120);
  const scale=clamp(Math.min(small?w/780:1,Math.max(100,bottom-top)/480),.24,1);
  const cx=w/2,middle=(top+Math.max(top+70,bottom))/2,towerWidth=166*scale,towerHeight=300*scale,foot=middle+towerHeight*.44;
  // Corresponds to the original trimmed tower and platform at source (550,486).
  const archerBase={x:cx+4*scale,y:foot-214.81*scale};
  return {width:w,height:h,small,scale,top,bottom:Math.max(top+70,bottom),cx,cy:foot-33*scale,towerFoot:foot,towerWidth,towerHeight,archerBase,archerScale:90/132*scale};
}
export function installViewport(onResize){
  const root=document.documentElement;let lastWidth=0,maxHeight=0,wasOpen=false;
  const update=()=>{
    const v=window.visualViewport,width=window.innerWidth,height=v?.height??window.innerHeight;
    if(Math.abs(width-lastWidth)>70){maxHeight=height;wasOpen=false;}
    maxHeight=Math.max(maxHeight,height);lastWidth=width;
    root.style.setProperty('--view-height',`${Math.round(height)}px`);root.style.setProperty('--view-top',`${Math.round(v?.offsetTop??0)}px`);
    const open=document.activeElement?.id==='typingInput'&&maxHeight-height>110;
    document.body.classList.toggle('keyboard-open',open);
    onResize({width,height,keyboardClosed:wasOpen&&!open,keyboardOpen:open});wasOpen=open;
  };
  window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);update();
  return ()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);};
}
