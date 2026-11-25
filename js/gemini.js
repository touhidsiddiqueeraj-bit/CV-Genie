/* Shared Gemini client (user's own key, straight from the browser):
 * runtime model discovery with a curated fallback list and exponential
 * backoff on 408/429/5xx. Used by CV import, ATS coach and letter AI. */

/* ── Gemini AI fallback (user's own key, direct browser → Google) ── */
export const CVI_GEMINI_DEFAULT='gemini-flash-latest';
export const CVI_GEMINI_BASE='https://generativelanguage.googleapis.com/v1beta';
export const CVI_GEMINI_FALLBACKS=['gemini-flash-latest','gemini-flash-lite-latest','gemini-3.5-flash-lite','gemini-3.6-flash','gemini-3.8-flash','gemini-3.1-flash-lite'];
export const CVI_RETRYABLE=new Set([408,429,500,503]);
let cviModelCache={ts:0,list:null}; /* 24h model-list cache — module-private */
export function cviSleep(ms){return new Promise(r=>setTimeout(r,ms));}
export async function cviDiscoverModels(key){
  const now=Date.now();
  if(cviModelCache.list&&now-cviModelCache.ts<86400000)return cviModelCache.list;
  const ctl=new AbortController();
  const to=setTimeout(()=>ctl.abort(),15000);
  try{
    const res=await fetch(CVI_GEMINI_BASE+'/models?pageSize=200&key='+encodeURIComponent(key),{signal:ctl.signal});
    const j=await res.json().catch(()=>null);
    if(!res.ok||!j||!Array.isArray(j.models))return [];
    const list=j.models.filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent'))
      .map(m=>(m.name||'').replace(/^models\//,''))
      .filter(n=>/^(gemini|gemma)/i.test(n)&&!/embedding|aqa|imagen|tts|image|veo|live|learnlm|robotics|computer-use|native-audio|thinking|transcribe|decision|lyria|genie|omni|banana|deep-research|antigravity/i.test(n));
    cviModelCache={ts:now,list};
    try{
      const dl=document.getElementById('cviModelList');
      if(dl)list.slice(0,12).forEach(n=>{if(![...dl.options].some(o=>o.value===n)){const o=document.createElement('option');o.value=n;dl.appendChild(o);}});
    }catch(e){}
    return list;
  }catch(e){return [];}
  finally{clearTimeout(to);}
}
export function cviModelScore(n){ /* lower = try first; Nov 2026 lineup: 4-series frontier, 3.8/3.6 flash, 3.5/3.1 flash-lite */
  const l=String(n||'').toLowerCase();
  if(l==='gemini-flash-latest')return 0;
  if(l==='gemini-flash-lite-latest')return 1;
  if(l==='gemini-3.5-flash-lite')return 2;
  if(/^gemini-3\.\d+-flash$/.test(l))return 3;
  if(/^gemini-3\.\d+-flash-lite$/.test(l))return 4;
  if(/flash/.test(l)&&!/lite/.test(l))return 5;
  if(/flash/.test(l))return 6;
  if(/^gemini-4/.test(l))return 7;
  if(/pro/.test(l))return 8;
  return 9;
}
export function cviGetKey(){try{return localStorage.getItem('cvGenieGeminiKey')||''}catch(e){return''}}
export function cviSetKey(k){try{k?localStorage.setItem('cvGenieGeminiKey',k):localStorage.removeItem('cvGenieGeminiKey')}catch(e){}}
export function cviGetModel(){try{return localStorage.getItem('cvGenieGeminiModel')||CVI_GEMINI_DEFAULT}catch(e){return CVI_GEMINI_DEFAULT}}
export function cviSetModel(m){try{m&&m!==CVI_GEMINI_DEFAULT?localStorage.setItem('cvGenieGeminiModel',m):localStorage.removeItem('cvGenieGeminiModel')}catch(e){}}
export async function cviGeminiOnce(key,model,parts,opts){ /* opts: {schema, maxOutputTokens, temperature, timeout} — no schema = plain-text mode */
  opts=opts||{};
  const ctl=new AbortController();
  const to=setTimeout(()=>ctl.abort(),opts.timeout||90000);
  try{
    const gc={temperature:opts.temperature!=null?opts.temperature:0.1};
    if(opts.maxOutputTokens)gc.maxOutputTokens=opts.maxOutputTokens;
    if(opts.schema){gc.responseMimeType='application/json';gc.responseSchema=opts.schema;}
    const res=await fetch(CVI_GEMINI_BASE+'/models/'+encodeURIComponent(model)+':generateContent',{
      method:'POST',signal:ctl.signal,
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:gc})
    });
    const j=await res.json().catch(()=>null);
    if(res.ok){
      if(j&&j.promptFeedback&&j.promptFeedback.blockReason)throw new Error('Gemini blocked this request ('+j.promptFeedback.blockReason+').');
      const cand=j&&j.candidates&&j.candidates[0];
      const txt=(((cand||{}).content||{}).parts||[]).map(p=>p.text||'').join('');
      if(!txt)throw new Error('Gemini returned an empty response.');
      if(!opts.schema)return {data:txt,model};
      let data;
      try{data=JSON.parse(txt);}catch(e){throw new Error('Gemini returned malformed JSON — try again.');}
      return {data,model};
    }
    const msg=(j&&j.error&&j.error.message)||'';
    const err=new Error(msg||('Gemini error '+res.status));
    err.status=res.status;
    if(res.status===400&&/api\s*key/i.test(msg))err.fatal='key';
    else if(res.status===400&&/location/i.test(msg))err.fatal='location';
    else if(res.status===403)err.fatal='access';
    throw err;
  }finally{clearTimeout(to);}
}
export function cviBackoff(a){return Math.round(Math.pow(2,a)*1000*(0.8+Math.random()*0.4));} /* ~1s, 2s, 4s with jitter, per Google's retry guidance */
export async function cviCallGemini(key,preferred,parts,onStatus,opts){ /* preferred → fallbacks → discovered models; exponential backoff on 408/429/5xx; one patient second pass if Google looks congested */
  const queue=[...(preferred?[preferred]:[]),...CVI_GEMINI_FALLBACKS];
  let discovered=[];
  try{discovered=await cviDiscoverModels(key);}catch(e){}
  discovered.sort((a,b)=>cviModelScore(a)-cviModelScore(b));
  discovered.forEach(d=>{if(!queue.includes(d))queue.push(d);});
  const models=[...new Set(queue.filter(Boolean))].slice(0,8);
  const failures=[];
  const tryModel=async(model,attempts)=>{
    for(let a=0;a<attempts;a++){
      if(onStatus)onStatus('Asking '+model+(a?' — retry '+(a+1):'')+'…');
      try{
        return await cviGeminiOnce(key,model,parts,opts);
      }catch(err){
        if(err&&err.fatal==='key')throw new Error('That API key was rejected. Double-check it in Google AI Studio.');
        if(err&&err.fatal==='location')throw new Error('The Gemini API is not available in your region (Google restriction).');
        if(err&&err.fatal==='access')throw new Error('The key has no access to this model (or the Generative Language API is disabled for it).');
        failures.push(model+' ('+(err&&err.status?err.status:'network')+')');
        if(err&&err.status&&CVI_RETRYABLE.has(err.status)&&a<attempts-1){await cviSleep(cviBackoff(a));continue;}
        break;
      }
    }
    return null;
  };
  for(const model of models){const r=await tryModel(model,2);if(r)return r;}
  const allBusy=failures.length>0&&failures.every(f=>/\((408|429|500|503|network)\)$/.test(f));
  if(allBusy){ /* 503-everywhere = free-tier congestion; cool down, then try the best models once more */
    if(onStatus)onStatus('Google\u2019s servers look busy — waiting a few seconds before a final retry…');
    await cviSleep(6000+Math.random()*3000);
    for(const model of models.slice(0,3)){const r=await tryModel(model,1);if(r)return r;}
  }
  throw new Error('Gemini could not answer right now — tried '+failures.slice(0,4).join(', ')+'. Google\u2019s free tier gets congested at peak times; wait a minute and try again.');
}
