export class TypingInput{
  constructor(element,{session,onChange=()=>{},onBlur=()=>{},onBlocked=()=>{}}){
    this.element=element;this.getSession=session;this.onChange=onChange;this.onBlur=onBlur;this.onBlocked=onBlocked;
    this.composing=false;this.processing=false;this.committed=null;this.compositionText='';this.lastSession=session();this.life=new AbortController();
    const listen=(name,fn)=>element.addEventListener(name,fn,{signal:this.life.signal});
    listen('paste',e=>{e.preventDefault();this.block();this.sync();});
    listen('drop',e=>{e.preventDefault();this.block();this.sync();});
    listen('keydown',e=>{
      if(e.key==='Enter')e.preventDefault();
      if(e.key==='Backspace'&&!this.composing){e.preventDefault();this.getSession()?.backspace();this.commit();}
    });
    listen('beforeinput',e=>this.before(e));listen('input',e=>this.after(e));
    listen('compositionstart',()=>{this.composing=true;this.committed=null;this.compositionText='';});
    listen('compositionend',e=>{
      const text=(e.data||this.compositionText).normalize('NFC').toUpperCase();
      if(this.composing)this.updateComposition(text);
      this.composing=false;this.committed=text;this.commit();
    });
    listen('blur',()=>{this.composing=false;this.compositionText='';this.committed=null;this.sync();this.onBlur();});
    listen('click',()=>this.end());listen('select',()=>{if(!this.composing)this.end();});
  }
  block(){this.onBlocked('Type one letter at a time. Paste and suggestions are disabled.');}
  isReplacement(type=''){return /Paste|Drop|Replacement/.test(type);}
  updateComposition(fragment,actual=null){
    const next=fragment.toUpperCase(),previous=this.compositionText,s=this.getSession();
    this.compositionText=next;
    if(s?.state!=='Playing'){this.commit();return;}
    const prior=s.input;
    let action=null;
    // A keyboard may restart its composing span after a word is cleared,
    // without sending compositionstart again. Prefer the live field delta.
    if(actual!==null&&actual!==prior){
      if(actual.startsWith(prior)&&actual.length===prior.length+1)action=actual.at(-1);
      else if(prior&&actual===prior.slice(0,-1))action='Backspace';
    }
    // Some keyboards retain earlier words in the IME payload. Consume only
    // the new letter; never append that complete payload to another target.
    if(action===null&&next!==previous){
      if(next.startsWith(previous)&&next.length===previous.length+1)action=next.at(-1);
      else if(previous&&next===previous.slice(0,-1))action='Backspace';
      else this.block();
    }
    this.processing=true;
    try{if(action==='Backspace')s.backspace();else if(action!==null)s.type(action);}
    finally{this.processing=false;}
    this.commit();
  }
  before(e){
    const type=e.inputType??'';
    if(this.isReplacement(type)){if(e.cancelable){e.preventDefault();this.block();this.sync();}return;}
    if(this.composing||e.isComposing||type==='insertCompositionText')return;
    if(!e.cancelable)return;
    const s=this.getSession();if(!s||s.state!=='Playing'){e.preventDefault();this.sync();return;}
    if(type.startsWith('delete')){e.preventDefault();s.backspace();this.commit();return;}
    if(type.startsWith('insert')){
      e.preventDefault();
      if(this.isCompositionCommit(e)){this.committed=null;this.sync();return;}
      this.committed=null;
      if(type==='insertText'&&[...(e.data??'')].length===1)s.type(e.data);else this.block();
      this.commit();
    }
  }
  isCompositionCommit(e){
    if(this.committed===null)return false;
    return e.inputType==='insertFromComposition'||e.inputType==='insertCompositionText'||
      (this.committed.length>1&&(e.data??'').toUpperCase()===this.committed);
  }
  after(e){
    if(this.isReplacement(e.inputType)){this.block();this.sync();return;}
    if(!this.composing&&!e.isComposing&&this.isCompositionCommit(e)){this.committed=null;this.sync();return;}
    if(this.composing||e.isComposing||e.inputType==='insertCompositionText'){
      this.composing=true;
      const actual=this.element.value.normalize('NFC').toUpperCase();
      const fragment=(e.data??actual).normalize('NFC');
      this.updateComposition(fragment,actual);return;
    }
    const s=this.getSession();if(!s||s.state!=='Playing'){this.sync();return;}
    const actual=this.element.value.toUpperCase(),prior=s.input;if(actual===prior)return;
    if(e.inputType?.startsWith('delete')&&actual===prior.slice(0,-1))s.backspace();
    else if((e.inputType==='insertText'||!e.inputType)&&actual.startsWith(prior)&&actual.length===prior.length+1)s.type(actual.at(-1));
    else this.block();
    this.commit();
  }
  commit(){this.sync();this.onChange();}
  sync(){
    if(this.processing)return;
    const s=this.getSession();
    if(s!==this.lastSession){this.lastSession=s;this.composing=false;this.committed=null;this.compositionText='';}
    const value=s?.input??'';
    // Clear a completed word immediately, even while the mobile IME is open.
    // Preserve matching native text/caret during ordinary composition updates.
    if(this.element.value.toUpperCase()!==value||(!this.composing&&this.element.value!==value))this.element.value=value;
    if(!this.composing)this.end();
  }
  end(){try{const length=this.element.value.length;if(this.element.selectionStart!==length||this.element.selectionEnd!==length)this.element.setSelectionRange(length,length);}catch{}}
  focus(){this.element.focus({preventScroll:true});this.end();}
  dispose(){this.life.abort();}
}
