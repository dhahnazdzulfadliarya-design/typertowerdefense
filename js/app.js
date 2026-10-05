import {DEBUG_ARCHER} from './config.js';
import {GameSession} from './engine.js';
import {readSave,writeSave,recordResult} from './storage.js';
import {Renderer,loadAssets} from './renderer.js';
import {TypingInput} from './input.js';
import {Soundscape} from './audio.js';
import {createLayout,installViewport} from './responsive.js';
import {DIRECTIONS} from './aiming.js';
const $=id=>document.getElementById(id);
const svg=body=>`<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const icons={muted:svg('<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>'),sound:svg('<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'),fullscreen:svg('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'),pause:svg('<path d="M8 5v14M16 5v14"/>')};
const heart=lost=>`<svg class="heart${lost?' lost':''}" viewBox="0 0 32 30" aria-hidden="true"><path d="M16 28 3 15C-5 6 7-5 16 5c9-10 21 1 13 10Z" fill="${lost?'#858478':'#eb443e'}" stroke="${lost?'#65685d':'#a3352b'}" stroke-width="1.4"/><path d="M6 8q4-5 8 0" stroke="#fff" opacity=".7" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>`;
let save=readSave(),state='Menu',session=null,layout=createLayout(innerWidth,innerHeight),loadToken=0,counting=false,countdownTime=0,lastFrame=performance.now(),lastHud='',lastHearts=-1,toastTimer=0,storageNotice=false;
let runBaseline=save.highScore.bestScore,debugDirection=null;
const audio=new Soundscape(save.muted),renderer=new Renderer($('gameCanvas'),$('enemyLabels'));
const life=new AbortController(),on=(id,fn)=>$(id).addEventListener('click',fn,{signal:life.signal});
const typing=new TypingInput($('typingInput'),{session:()=>session,onChange:syncTyping,onBlur:()=>{
  queueMicrotask(()=>{if((state==='Playing'||(state==='Ready'&&counting))&&document.activeElement!==$('typingInput'))pause('Tap Resume to continue typing.');});
},onBlocked:toast});
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function persist(){if(!writeSave(save)&&!storageNotice){storageNotice=true;toast('Scores cannot be saved on this device. You can still keep playing.');}}
function checkpoint(final=false){if(session&&session.elapsed>0){const r=session.snapshot();if(final)recordResult(save,r);else{save.highScore.bestScore=Math.max(save.highScore.bestScore,r.score);save.highScore.highestWave=Math.max(save.highScore.highestWave,r.wave);save.highScore.mostDefeated=Math.max(save.highScore.mostDefeated,r.kills);save.highScore.longestTime=Math.max(save.highScore.longestTime,r.seconds);}persist();}}
function setState(next){
  state=next;document.body.dataset.state=next;
  const visible=next==='Menu'?'menu':next==='Loading'?'loading':next==='GameOver'?'result':'game';
  for(const id of ['menu','loading','game','result'])$(id).hidden=id!==visible;
  $('readyOverlay').hidden=next!=='Ready';$('pauseOverlay').hidden=next!=='Paused';
  $('typingDock').style.visibility=['Ready','Playing'].includes(next)?'visible':'hidden';
  $('typingInput').disabled=!['Ready','Playing','Paused'].includes(next);
  if(!['Ready','Playing'].includes(next))$('typingInput').blur();
  audio.music(!document.hidden&&(next==='Menu'||next==='Playing'));lastFrame=performance.now();
}
function updateMenu(){$('menuHighScore').textContent=String(save.highScore.bestScore);}
function updateAudio(){for(const id of ['audioButton','pauseAudio']){const b=$(id);b.innerHTML=save.muted?icons.muted:icons.sound;b.setAttribute('aria-label',save.muted?'Unmute audio':'Mute audio');b.setAttribute('aria-pressed',String(!save.muted));b.title=save.muted?'Unmute audio':'Mute audio';}}
function showMenu(){checkpoint(true);loadToken++;counting=false;document.body.dataset.counting='false';session=null;renderer.reset();typing.sync();setState('Menu');updateMenu();$('playButton').focus({preventScroll:true});}
function isTouch(){return matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;}
async function startGame(){
  checkpoint(true);runBaseline=save.highScore.bestScore;const token=++loadToken;
  audio.unlock();counting=false;document.body.dataset.counting='false';session=null;renderer.reset();typing.sync();setState('Loading');
  $('loadingProgress').value=0;$('loadingPercent').textContent='0%';$('loadingStatus').textContent='Preparing the battlefield…';$('retryLoading').hidden=true;
  try{
    const assets=await loadAssets(percent=>{if(token!==loadToken)return;$('loadingProgress').value=percent;$('loadingPercent').textContent=percent+'%';});
    if(token!==loadToken)return;
    if(!renderer.assets)renderer.setAssets(assets);
    renderer.resize(layout);session=new GameSession({layout,onEvent:gameEvent});lastHud='';lastHearts=-1;
    $('waveBanner').hidden=true;syncHud();syncTyping();setState('Ready');
    $('readyTitle').textContent='Ready, archer?';$('readyDescription').innerHTML='Type the names above the monsters.<br>Backspace fixes mistakes. No Enter needed.';
    $('startButton').hidden=false;$('countdown').hidden=true;
    if(isTouch())$('startButton').focus({preventScroll:true});else startCountdown();
  }catch(error){if(token!==loadToken)return;$('loadingStatus').textContent=error.message;$('retryLoading').hidden=false;}
}
function startCountdown(){
  if(state!=='Ready'||!session||counting)return;
  audio.unlock();countdownTime=0;counting=true;document.body.dataset.counting='true';
  $('readyTitle').textContent='GET READY';$('readyDescription').textContent='Five hearts. Every letter counts.';$('startButton').hidden=true;$('countdown').hidden=false;$('countdown').textContent='';
  // Synchronous focus inside the touch/click handler is essential for mobile keyboards.
  typing.focus();lastFrame=performance.now();
}
function pause(reason='Your tower is safe while you’re away.'){
  if(!session||!['Playing','Ready'].includes(state))return;
  counting=false;document.body.dataset.counting='false';session.pause();checkpoint();setState('Paused');$('pauseReason').textContent=reason;
  $('resumeButton').focus({preventScroll:true});
}
function resume(){
  if(state!=='Paused'||!session)return;
  audio.unlock();counting=false;document.body.dataset.counting='false';session.start();setState('Playing');typing.focus();syncTyping();
}
function syncTyping(){
  typing.sync();if(!session)return;
  const target=session.target,invalid=!!session.input&&(!target||session.prefix!==session.input.length);
  $('inputFrame').classList.toggle('error',invalid);$('inputFrame').classList.toggle('correct',!!session.input&&!invalid);$('typingInput').setAttribute('aria-invalid',String(invalid));
  $('targetHint').textContent=invalid?'Backspace to fix the red text':target?target.name:'Type a monster’s name';$('typingFeedback').textContent=invalid?'×':target?'⌁':'✦';
}
function syncHud(){
  if(!session)return;
  if(lastHearts!==session.hearts){$('hearts').innerHTML=Array.from({length:5},(_,i)=>heart(i>=session.hearts)).join('');$('hearts').setAttribute('aria-label',`${session.hearts} of 5 hearts`);lastHearts=session.hearts;}
  const key=[session.score,session.wave,session.resolved,session.kills,Math.round(session.wpm),Math.round(session.accuracy??-1)].join(':');if(lastHud===key)return;lastHud=key;
  $('waveTitle').textContent=`WAVE ${session.wave}`;$('waveProgress').style.width=`${session.resolved/session.config.enemyCount*100}%`;
  $('liveScore').textContent=session.score;$('liveWpm').textContent=Math.round(session.wpm);$('liveAccuracy').textContent=session.accuracy===null?'—':Math.round(session.accuracy)+'%';$('liveKills').textContent=session.kills;
}
function gameEvent(event){
  if(['target','correct','wrong','shoot','impact','damage','waveClear'].includes(event.type))audio.play(event.type);
  if(event.type==='input')syncTyping();
  if(event.type==='damage'){$('hearts').classList.remove('hit');void $('hearts').offsetWidth;$('hearts').classList.add('hit');syncHud();}
  if(event.type==='wave')checkpoint();
  if(event.type==='finish')gameOver(event.result);
}
const formatTime=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
function gameOver(result){
  counting=false;document.body.dataset.counting='false';recordResult(save,result);persist();syncHud();setState('GameOver');audio.play('defeat');
  $('personalBest').hidden=result.score<=runBaseline;$('resultHighScore').textContent=String(save.highScore.bestScore);
  const stats=[['SCORE',result.score],['WAVE REACHED',result.wave],['DEFEATED',result.kills],['WPM',result.wpm],['ACCURACY',result.accuracy===null?'—':result.accuracy+'%'],['SURVIVAL TIME',formatTime(result.seconds)]];
  $('resultStats').replaceChildren();
  for(const [label,value] of stats){const item=document.createElement('div');item.className='stat';const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;item.append(dt,dd);$('resultStats').append(item);}
  $('resultAction').focus({preventScroll:true});
}
function frame(now){
  const dt=Math.min(.2,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if(!document.hidden&&session&&['Ready','Playing','Paused'].includes(state)){
    if(state==='Ready'&&counting){
      countdownTime+=dt;
      $('countdown').textContent=countdownTime<.35?'':countdownTime<1.35?'3':countdownTime<2.35?'2':countdownTime<3.35?'1':'GO';
      if(countdownTime>=3.68){counting=false;document.body.dataset.counting='false';session.start();setState('Playing');syncTyping();}
    }else if(state==='Playing'){
      const steps=Math.max(1,Math.ceil(dt/(1/30))),step=dt/steps;
      for(let i=0;i<steps&&state==='Playing';i++)session.tick(step);
      syncHud();
    }
    $('waveBanner').hidden=!session.gap;if(session.gap)$('nextWaveText').textContent=`Wave ${session.wave+1} approaches`;
    $('damageOverlay').style.opacity=String(session.damageFlash);
    if(DEBUG_ARCHER&&debugDirection){session.archer.direction=debugDirection;session.archer.shotTime=Infinity;}
    renderer.draw(session,state==='Playing'?dt:0);
  }
  requestAnimationFrame(frame);
}
const stopViewport=installViewport(({width,height})=>{
  const css=globalThis.getComputedStyle?.(document.documentElement);
  layout=createLayout(width,height,parseFloat(css?.getPropertyValue('--safe-top'))||0,parseFloat(css?.getPropertyValue('--safe-bottom'))||0);renderer.resize(layout);session?.setLayout(layout);
});
function toggleAudio(){save.muted=!save.muted;audio.setMuted(save.muted);persist();updateAudio();}
async function toggleFullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Fullscreen is unavailable in this browser.');}
  catch{toast('Fullscreen is unavailable in this browser.');}
}
on('playButton',()=>void startGame());on('retryLoading',()=>void startGame());on('loadingMenu',showMenu);on('startButton',startCountdown);on('resumeButton',resume);on('pauseButton',()=>pause());on('restartButton',()=>void startGame());on('pauseMenu',showMenu);on('resultAction',()=>void startGame());on('resultMenu',showMenu);
for(const id of ['audioButton','pauseAudio'])on(id,toggleAudio);
for(const id of ['fullscreenButton','pauseFullscreen']){$(id).innerHTML=icons.fullscreen;on(id,toggleFullscreen);}
$('pauseButton').innerHTML=icons.pause;
document.addEventListener('fullscreenchange',()=>{for(const id of ['fullscreenButton','pauseFullscreen'])$(id).setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');},{signal:life.signal});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&['Playing','Ready'].includes(state)){event.preventDefault();pause();}
  else if(event.key==='Escape'&&state==='Paused'){event.preventDefault();resume();}
  if(DEBUG_ARCHER&&/^[1-8]$/.test(event.key)){debugDirection=DIRECTIONS[Number(event.key)-1];event.preventDefault();}
  if(event.key==='Tab'&&state==='Paused'){
    const buttons=[...$('pauseOverlay').querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
},{signal:life.signal});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause('The game paused while this tab was away.');audio.music(false);}else{lastFrame=performance.now();audio.music(state==='Menu');}},{signal:life.signal});
window.addEventListener('blur',()=>{if(!document.hidden)pause('Tap Resume when you’re ready.');},{signal:life.signal});
window.addEventListener('pagehide',()=>{checkpoint();audio.music(false);},{signal:life.signal});
window.addEventListener('pageshow',()=>{lastFrame=performance.now();audio.music(state==='Menu');},{signal:life.signal});
window.addEventListener('pointerdown',()=>audio.unlock(),{once:true,signal:life.signal});
setState('Menu');updateAudio();updateMenu();requestAnimationFrame(frame);
// Preserve optional WebMCP read/pause capabilities from the original project.
if(document.modelContext?.registerTool){
  const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{}};
  register({name:'read_training_progress',title:'Read typing progress',description:'Read personal endless-wave records and the current run.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({state,highScore:{...save.highScore},current:session?.snapshot()??null})});
  register({name:'pause_typing_practice',title:'Pause typing practice',description:'Pause the current run. Resume requires the visible Resume button.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(input&&Object.keys(input).length)throw Error('No arguments expected');if(!['Ready','Playing'].includes(state))throw Error('No active run');pause();return {state};}});
}
// Module export for integration tests and the optional developer inspector; no global debug UI.
export const inspectGame=()=>({state,session,renderer,save,counting,layout});
export function dispose(){life.abort();typing.dispose();stopViewport();audio.dispose();}
