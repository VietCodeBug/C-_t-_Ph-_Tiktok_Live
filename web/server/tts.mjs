import {cleanSpeechText,speechAllowed,MAX_SPEECH_TEXT} from '../src/live-speech-policy.js';

const VOICES=Object.freeze({female:'vi-VN-HoaiMyNeural',male:'vi-VN-NamMinhNeural'});
const MAX_AUDIO=1_000_000;
let lastProvider=null;
export class TTSError extends Error {constructor(message,status=503,code='TTS_UNAVAILABLE'){super(message);this.name='TTSError';this.status=status;this.statusCode=status;this.code=code;}}
export const escapeSpeechXml=value=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
export function validateTTS(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TTSError('Yêu cầu giọng không hợp lệ.',400,'INVALID_REQUEST');
  if(typeof input.text!=='string'||input.text.length>2000)throw new TTSError('Nội dung MC không hợp lệ.',400,'INVALID_TEXT');
  const text=cleanSpeechText(input.text);
  if(!text||text.length>MAX_SPEECH_TEXT)throw new TTSError(`Lời MC cần từ 1 đến ${MAX_SPEECH_TEXT} ký tự.`,400,'INVALID_TEXT');
  if(!speechAllowed(input.text)||/https?:\/\//i.test(text))throw new TTSError('Nội dung không được đọc thành tiếng.',422,'SPEECH_BLOCKED');
  const alias=input.voice??'female';
  const voice=Object.hasOwn(VOICES,alias)?VOICES[alias]:Object.values(VOICES).find(value=>value===input.voice);
  if(!voice)throw new TTSError('Chọn giọng tiếng Việt nữ hoặc nam.',400,'INVALID_VOICE');
  const rate=input.rate===undefined?1.06:Number(input.rate);
  if(!Number.isFinite(rate)||rate<.8||rate>1.25)throw new TTSError('Tốc độ giọng cần từ 0.8 đến 1.25.',400,'INVALID_RATE');
  return {text,voice,rate:Math.round(rate*100)/100};
}

async function edgeSpeech({text,voice,rate}){
  const {MsEdgeTTS,OUTPUT_FORMAT}=await import('msedge-tts');
  const tts=new MsEdgeTTS({connectionTimeoutMs:4500,synthesisTimeoutMs:10000});let timer;
  try{
    const work=(async()=>{
      await tts.setMetadata(voice,OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const percent=Math.round((rate-1)*100);
      const {audioStream}=tts.toStream(escapeSpeechXml(text),{rate:`${percent>=0?'+':''}${percent}%`});
      const chunks=[];let size=0;
      for await(const chunk of audioStream){size+=chunk.byteLength;if(size>MAX_AUDIO)throw new Error('Audio limit');chunks.push(Buffer.from(chunk));}
      if(!size)throw new Error('Empty audio');return Buffer.concat(chunks);
    })();
    return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{tts.close();reject(new Error('Speech timeout'));},6500);})]);
  }finally{clearTimeout(timer);tts.close();}
}
export function splitSpeechText(text,limit=175){
  const parts=[];let part='';
  for(const word of text.split(/\s+/)){
    if(word.length>limit){if(part){parts.push(part);part='';}let fragment='';for(const char of word){if(fragment.length+char.length>limit){parts.push(fragment);fragment='';}fragment+=char;}part=fragment;continue;}
    if(part&&part.length+word.length+1>limit){parts.push(part);part='';}part+=(part?' ':'')+word;
  }
  if(part)parts.push(part);return parts;
}
async function googleSpeech({text}){
  const parts=splitSpeechText(text),chunks=[];let size=0;
  const fetchPart=async part=>{
    const url='https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q='+encodeURIComponent(part);
    const response=await fetch(url,{signal:AbortSignal.timeout(3500),headers:{'User-Agent':'Mozilla/5.0',Referer:'https://translate.google.com/'}});
    if(!response.ok||!response.headers.get('content-type')?.startsWith('audio/')){await response.body?.cancel();throw new Error('Speech fallback unavailable');}
    const buffers=[];let bytes=0;
    for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>MAX_AUDIO)throw new Error('Audio limit');buffers.push(Buffer.from(chunk));}
    return Buffer.concat(buffers);
  };
  for(let i=0;i<parts.length;i+=2){
    const batch=await Promise.all(parts.slice(i,i+2).map(fetchPart));
    for(const buffer of batch){size+=buffer.length;if(size>MAX_AUDIO)throw new Error('Audio limit');chunks.push(buffer);}
  }
  if(!size)throw new Error('Empty speech');return Buffer.concat(chunks);
}
export function createOnlineSpeechProvider({edge=edgeSpeech,fallback=googleSpeech,now=Date.now}={}){
  let retryAt=0;
  const provider=async settings=>{
    if(now()>=retryAt){try{return {buffer:await edge(settings),provider:'edge'};}catch{retryAt=now()+120000;}}
    return {buffer:await fallback(settings),provider:'google'};
  };
  provider.status=()=>({edgeRetryAt:retryAt});return provider;
}
const onlineSpeech=createOnlineSpeechProvider();
function withAbort(promise,signal){
  if(!signal)return promise;
  if(signal.aborted)return Promise.reject(new TTSError('Yêu cầu giọng đã dừng.',499,'ABORTED'));
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(new TTSError('Yêu cầu giọng đã dừng.',499,'ABORTED'));};
    signal.addEventListener('abort',abort,{once:true});
    promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}
export function createTTSService({provider=onlineSpeech,now=Date.now,maxConcurrent=2,maxWaiting=6,maxStarts=12,windowMs=10000,cacheTTL=300000,cacheBytes=6_000_000}={}){
  const cache=new Map(),inFlight=new Map(),waiting=[],starts=[];let active=0,bytes=0;
  const remove=key=>{const entry=cache.get(key);if(entry){bytes-=entry.buffer.length;cache.delete(key);}};
  async function limited(work){
    if(active>=maxConcurrent){if(waiting.length>=maxWaiting)throw new TTSError('MC đang bận, đợi một nhịp nhé.',429,'TTS_BUSY');await new Promise(resolve=>waiting.push(resolve));}
    else active++;
    try{return await work();}finally{if(waiting.length)waiting.shift()();else active--;}
  }
  async function synthesizeTTS(input){
    const settings=validateTTS(input);if(input.signal?.aborted)throw new TTSError('Yêu cầu giọng đã dừng.',499,'ABORTED');
    const key=JSON.stringify([settings.voice,settings.rate,settings.text]),stamp=now();
    const old=cache.get(key);
    if(old&&stamp-old.at<cacheTTL){cache.delete(key);cache.set(key,old);return {buffer:old.buffer,contentType:'audio/mpeg',voice:settings.voice,provider:old.provider,cacheHit:true};}
    remove(key);let pending=inFlight.get(key);
    if(!pending){
      while(starts.length&&starts[0]<=stamp-windowMs)starts.shift();
      if(starts.length>=maxStarts)throw new TTSError('MC đang đọc nhiều câu. Đợi vài giây rồi thử lại.',429,'TTS_RATE_LIMIT');
      starts.push(stamp);
      pending=limited(async()=>{
        try{
          const result=await provider(settings),buffer=Buffer.isBuffer(result)?result:result?.buffer;
          const providerName=Buffer.isBuffer(result)?'edge':result?.provider||'edge';
          if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>MAX_AUDIO)throw new Error('Invalid audio');
          while(cache.size>=48||bytes+buffer.length>cacheBytes){const oldest=cache.keys().next().value;if(oldest===undefined)break;remove(oldest);}
          if(buffer.length<=cacheBytes){cache.set(key,{buffer,provider:providerName,at:now()});bytes+=buffer.length;}
          lastProvider=providerName;
          return {buffer,contentType:'audio/mpeg',voice:settings.voice,provider:providerName,cacheHit:false};
        }catch(error){if(error instanceof TTSError)throw error;throw new TTSError('Chưa kết nối được giọng tiếng Việt. Có thể dùng giọng tiếng Việt đã cài trong trình duyệt.');}
      });
      inFlight.set(key,pending);
      pending.then(()=>inFlight.delete(key),()=>inFlight.delete(key));
    }
    return withAbort(pending,input.signal);
  }
  return {synthesizeTTS,status:()=>({provider:'msedge-tts',voices:VOICES,active,waiting:waiting.length,cacheEntries:cache.size,cacheBytes:bytes})};
}
const service=createTTSService();
export const synthesizeTTS=input=>service.synthesizeTTS(input);
export const ttsStatus=()=>({...service.status(),...onlineSpeech.status(),lastProvider});
