import * as THREE from 'three';
import {giftIconFor} from './live-gift-guide.js';
import {GiftEffectState,giftDonorPosition} from './live-gift-effects-rules.js';
import './live-gift-effects.css';

const SYMBOLS={priority:'✦',pulse:'♥',trail:'♥',pet:'•'};
const COLORS=['#f1c868','#ed7b82','#a6c3a6','#e7d5a2','#da9ec1'];
const money=value=>Number(value).toLocaleString('vi-VN');
const node=(name,className,text)=>{const element=document.createElement(name);element.className=className;if(text!==undefined)element.textContent=text;return element;};

export class LiveGiftEffects {
  constructor(world,container,{base='/runtime/',onGain=()=>{}}={}){
    this.world=world;this.container=container;this.base=base;this.onGain=onGain;this.model=new GiftEffectState();this.items=new Map();this.disposed=false;
    this.point=new THREE.Vector3();
    this.root=node('div','live-gift-effects');this.root.dataset.testid='live-gift-effects';this.root.setAttribute('aria-live','polite');this.root.setAttribute('aria-atomic','false');
    container.append(this.root);
  }
  create(effect){
    const element=node('div',`gift-fx-item gift-fx-${effect.effect}`);element.dataset.effectId=effect.id;element.dataset.giftKey=effect.giftKey;element.dataset.effect=effect.effect;
    if(effect.isPayout)element.classList.add('gift-envelope-banner');
    element.style.setProperty('--gift-life',`${effect.duration}s`);
    const core=node('div','gift-fx-core');
    const image=node('img','gift-fx-icon');image.src=giftIconFor(effect,{base:this.base});image.alt='';image.decoding='async';image.width=image.height=96;
    image.onerror=()=>{if(!image.dataset.fallback){image.dataset.fallback='true';image.src=`${this.base.replace(/\/?$/,'/')}gifts/${effect.giftKey}.webp`;}else image.hidden=true;};
    core.append(image);
    if(effect.isPayout){
      core.append(node('strong','gift-fx-envelope-title','LÌ XÌ CẢ PHỐ'),node('b','gift-fx-envelope-money',`${money(effect.pot)} MONEY`),node('span','gift-fx-envelope-count',`${money(effect.participants)} người cùng nhận`));
      element.setAttribute('role','status');element.setAttribute('aria-label',`Lì xì cả phố ${money(effect.pot)} MONEY cho ${money(effect.participants)} người`);
    }else{
      core.append(node('span','gift-fx-tag',`${effect.name}${effect.count>1?` ×${money(effect.count)}`:''}`));
      if(effect.effect==='priority')core.append(node('small','gift-fx-note','Ưu tiên lượt lắc'));
    }
    element.append(core);
    for(let index=0;index<effect.particles;index++){
      const particle=node('span','gift-fx-particle',SYMBOLS[effect.effect]||'');particle.setAttribute('aria-hidden','true');
      const angle=index*Math.PI*2/Math.max(1,effect.particles)+.35;
      const x=Math.cos(angle)*(9+index%3*3),y=Math.sin(angle)*(7+index%4*2)-9;
      particle.style.setProperty('--gift-dx',`${x}cqw`);particle.style.setProperty('--gift-dy',`${y}cqw`);
      particle.style.setProperty('--gift-spin',`${(index%2?1:-1)*(100+index*37)}deg`);particle.style.setProperty('--gift-delay',`${index*.025}s`);
      particle.style.setProperty('--gift-color',effect.isPayout?(index%2?'#e4bb57':'#cb554d'):COLORS[index%COLORS.length]);
      element.append(particle);
    }
    this.root.append(element);this.items.set(effect.id,{element,effect,anchor:{x:50,y:46}});
    if(effect.isPayout){try{this.onGain({...effect});}catch{/* A sound callback never owns a payout. */}}
  }
  update(dt,state={},people={}){
    if(this.disposed)return;
    state??={};people??={};
    const added=this.model.update(dt,state);
    const activeIds=new Set(this.model.active.map(effect=>effect.id));
    for(const[id,item]of this.items)if(!activeIds.has(id)){item.element.remove();this.items.delete(id);}
    for(const effect of added)this.create(effect);
    for(const effect of this.model.active){
      const item=this.items.get(effect.id);if(!item)continue;
      let x=50,y=effect.isPayout?34:46;
      const position=effect.isPayout?null:giftDonorPosition(effect,people);
      if(position&&this.world.camera){
        this.point.fromArray(position);this.point.y+=1.05;this.point.project(this.world.camera);
        if(this.point.z>=-1&&this.point.z<=1&&Math.abs(this.point.x)<=1.2&&Math.abs(this.point.y)<=1.2){x=Math.max(8,Math.min(92,(this.point.x+1)*50));y=Math.max(20,Math.min(78,(1-this.point.y)*50));}
      }
      item.anchor={x,y};item.element.style.left=`${x}%`;item.element.style.top=`${y}%`;
    }
  }
  snapshot(){const snapshot=this.model.snapshot();return{...snapshot,disposed:this.disposed,active:snapshot.active.map(effect=>({...effect,anchor:this.items.get(effect.id)?.anchor??null}))};}
  dispose(){if(this.disposed)return;this.disposed=true;this.model.clear();this.items.clear();this.root.remove();}
}
