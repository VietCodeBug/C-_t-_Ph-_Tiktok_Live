const DEFAULT_TRACKS=['/runtime/music/pho-do-choi-01.m4a','/runtime/music/pho-do-choi-02.m4a'];
const volumeOf=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):.14;
const call=(fn,value)=>{try{fn?.(value);}catch{/* UI callbacks do not own playback. */}};
function tracksOf(values,origin){
  const found=new Map();
  for(const value of Array.isArray(values)?values:[]){
    let source=typeof value==='string'?value:value?.url||value?.src||'';
    if(source.startsWith('music/'))source='/runtime/'+source;
    let path=source;
    if(/^https?:\/\//.test(source)){
      try{const parsed=new URL(source);if(!origin||parsed.origin!==origin)continue;path=parsed.pathname;}catch{continue;}
    }
    if(!/^\/runtime\/music\/[\w.-]+\.(m4a|mp3|ogg|wav)$/i.test(path))continue;
    if(!found.has(source))found.set(source,{url:source,name:typeof value==='object'?String(value.name||'Nhạc khu phố'):path.split('/').at(-1)});
  }
  return [...found.values()];
}

// Local background music only. MC speech has its own media element and toggle.
export class LiveMusic {
  constructor({mode='live',playlist=DEFAULT_TRACKS,volume=.14,enabled=true,onState,env=globalThis,audio}={}){
    this.env=env;this.onState=onState;this.audio=audio||new env.Audio();this.volume=volumeOf(volume);this.enabled=!!enabled;
    this.unlocked=false;this.ownerClaimed=false;this.blockedByOtherTab=false;this.ducked=false;this.playing=false;this.blocked=false;this.error='';this.index=0;this.generation=0;this.disposed=false;this.failed=new Set();
    this.owner=env.crypto?.randomUUID?.()||`music-${Math.random().toString(36).slice(2)}`;
    if(env.window&&typeof env.BroadcastChannel==='function'){
      this.channel=new env.BroadcastChannel(`co-ty-phi-music-owner-v1-${mode}`);
      this.channel.onmessage=event=>{if(event.data?.owner&&event.data.owner!==this.owner){this.blockedByOtherTab=true;this.ownerClaimed=false;this.generation++;this.audio.pause();this.playing=false;this.error='Nhạc đang phát ở tab game khác.';this._emit();}};
    }
    this.tracks=tracksOf(playlist,env.location?.origin);this.audio.preload='none';this.audio.loop=false;
    this.audio.onended=()=>{if(!this.disposed)this._advance(true);};
    this.audio.onerror=()=>this._failed();this.audio.onplaying=()=>{this.playing=this.enabled;this.blocked=false;this.error='';this._emit();};
    this._source();this._volume();this._emit();
  }
  get status(){return {enabled:this.enabled,unlocked:this.unlocked,ownerClaimed:this.ownerClaimed,blockedByOtherTab:this.blockedByOtherTab,playing:this.playing,blocked:this.blocked,error:this.error,
    volume:this.volume,effectiveVolume:this.enabled?this.volume*(this.ducked?.25:1):0,ducked:this.ducked,index:this.index,track:this.tracks[this.index]?.url||'',trackName:this.tracks[this.index]?.name||'',trackCount:this.tracks.length};}
  snapshot(){return this.status;}
  _emit(){call(this.onState,this.status);}
  _volume(){this.audio.volume=this.enabled?this.volume*(this.ducked?.25:1):0;}
  _source(){const track=this.tracks[this.index];if(track)this.audio.src=track.url;}
  async unlock(){
    if(this.disposed)return false;
    const retry=!!this.error;this.unlocked=true;this.ownerClaimed=true;this.blockedByOtherTab=false;this.blocked=false;this.failed.clear();this.error='';if(retry){this._source();this.audio.load?.();}
    if(!this.tracks.length){this.error='Chưa có bài nhạc nền.';this._emit();return false;}
    // The call to play happens before the first await, sharing the original
    // click activation with MC.unlock(). Muted priming also unlocks music-off.
    this.channel?.postMessage({owner:this.owner});const primeOnly=!this.enabled;return this._play(primeOnly);
  }
  async _play(primeOnly=false){
    if(this.disposed||!this.unlocked||!this.ownerClaimed||this.blockedByOtherTab||(!this.enabled&&!primeOnly)||!this.tracks.length)return false;
    const ticket=++this.generation;this._volume();if(primeOnly)this.audio.volume=0;
    try{
      await this.audio.play();if(ticket!==this.generation||this.disposed)return false;
      if(primeOnly||!this.enabled){this.audio.pause();this.playing=false;}else this.playing=true;
      this.blocked=false;this.error='';this._volume();this._emit();return true;
    }catch(error){
      if(ticket!==this.generation||this.disposed)return false;
      if(error?.name==='NotAllowedError'){
        this.unlocked=false;this.blocked=true;this.playing=false;this.error='Bấm Bật âm thanh trong khung game để mở nhạc.';this._emit();return false;
      }
      this._failed();return false;
    }
  }
  _failed(){
    if(this.disposed)return;const track=this.tracks[this.index];if(track)this.failed.add(track.url);
    this.playing=false;
    const next=this.tracks.findIndex((item,index)=>index!==this.index&&!this.failed.has(item.url));
    if(next>=0&&this.enabled&&this.unlocked){this.index=next;this._source();void this._play();return;}
    this.audio.pause();this.error='Chưa tải được nhạc nền. Bấm mở âm thanh để thử lại.';this._emit();
  }
  _advance(automatic=false){
    if(this.disposed||!this.tracks.length)return false;
    if(!automatic)this.failed.clear();
    for(let step=1;step<=this.tracks.length;step++){
      const next=(this.index+step)%this.tracks.length;if(this.failed.has(this.tracks[next].url))continue;
      this.index=next;this._source();this.error='';this.playing=false;
      if(this.enabled&&this.unlocked)void this._play();this._emit();return true;
    }
    return false;
  }
  next(){return this._advance();}
  setDucking(value){this.ducked=typeof value==='number'?value<1:!!value;this._volume();this._emit();}
  configure(value={}){
    const old=this.tracks[this.index]?.url;
    if(value.playlist!==undefined){
      const tracks=tracksOf(value.playlist,this.env.location?.origin);
      if(tracks.length&&JSON.stringify(tracks)!==JSON.stringify(this.tracks)){
        this.tracks=tracks;this.index=Math.max(0,tracks.findIndex(track=>track.url===old));this.failed.clear();
        if(this.tracks[this.index].url!==old){this._source();this.playing=false;}
      }
    }
    if(value.musicVolume!==undefined||value.volume!==undefined)this.volume=volumeOf(value.musicVolume??value.volume);
    if(value.musicEnabled!==undefined||value.enabled!==undefined)this.enabled=!!(value.musicEnabled??value.enabled);
    this._volume();
    if(!this.enabled){this.generation++;this.audio.pause();this.playing=false;}
    else if(this.unlocked&&!this.playing)void this._play();this._emit();return this.status;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.generation++;this.channel?.close();this.audio.onended=this.audio.onerror=this.audio.onplaying=null;this.audio.pause();this.playing=false;this._emit();}
}
