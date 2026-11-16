// Browser-only transport. Secrets are caller-owned ephemeral values, never stored.
export function validateDirectBase(value) {
 let u;try{u=new URL(value);}catch{throw Error('请填写完整的接口 Base URL。');}
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('接口需要 HTTPS；本机服务可使用 HTTP。');
 if(u.username||u.password||u.search||u.hash||/[?#]/.test(value))throw Error('接口地址不能包含凭据、查询参数或片段。');
 if(/\/(chat\/completions|responses|messages)$|:generateContent$/i.test(u.pathname.replace(/\/+$/,'')))throw Error('请填写 Base URL，不包含 chat/completions 等具体接口路径。');
 return u.href.replace(/\/+$/,'');
}
export async function requestDirect({action,provider,baseUrl,apiKey,model,input,system,maxOutputTokens=1024,signal}) {
 const base=validateDirectBase(baseUrl);
 if(!['openai','gemini','anthropic','compatible','deepseek','qwen','doubao','zhipu','moonshot'].includes(provider))throw Error('不支持此服务商。');
 if(typeof apiKey!=='string'||!apiKey.trim()||/\s/.test(apiKey))throw Error('请填写有效的 API Key，不能包含空白。');
 const headers=provider==='gemini'?{'x-goog-api-key':apiKey}:provider==='anthropic'?{'x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}:{Authorization:'Bearer '+apiKey};
 async function call(path,body){
  let r;try{r=await fetch(base+path,{method:body?'POST':'GET',headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});}catch(e){if(e.name==='AbortError'||e.name==='TimeoutError')throw e;throw Error('浏览器无法访问接口，可能是 CORS、网络或地址问题。请确认服务商允许此网页跨域访问；也可选择网关模式。');}
  if(!r.ok){const e=Error(r.status===401||r.status===403?'API Key 或模型权限验证失败（'+r.status+'）。':r.status===429?'服务商限流或额度不足（429）。':'服务商请求失败（'+r.status+'），请检查接口地址、模型与参数。');e.status=r.status;throw e;}
  try{return await r.json();}catch{throw Error('接口未返回有效 JSON。');}
 }
 if(action==='models'){
  if(['qwen','doubao','zhipu','moonshot'].includes(provider))return {provider,models:[],discovery:'manual',verified:false};
  let path='/models',models=[],pages=0;
  do{let r;try{r=await call(path);}catch(e){if([404,405,501].includes(e.status))return {provider,models:[],discovery:'manual',verified:false};throw e;}
   const list=provider==='gemini'?r.models:r.data;if(!Array.isArray(list))throw Error('接口返回的模型列表格式无效。');
   models.push(...list.filter(m=>m&&typeof(provider==='gemini'?m.name:m.id)==='string').filter(m=>provider!=='gemini'||m.supportedGenerationMethods?.includes('generateContent')).map(m=>({id:provider==='gemini'?m.name.replace(/^models\//,''):m.id,name:m.displayName||m.display_name||m.id||m.name})));
   path=provider==='gemini'&&r.nextPageToken?'/models?pageToken='+encodeURIComponent(r.nextPageToken):provider==='anthropic'&&r.has_more&&r.last_id?'/models?after_id='+encodeURIComponent(r.last_id):null;
   if(++pages>=20&&path)throw Error('模型列表分页过多。');
  }while(path);
  return {provider,models,discovery:'remote',verified:true};
 }
 if(action!=='prompt')throw Error('不支持此操作。');
 if(typeof model!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/@+-]{0,199}$/.test(model)||model.includes('..'))throw Error('请填写有效模型 ID。');
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>4096)throw Error('输出上限须为 1–4096。');
 if(typeof input!=='string'||!input.trim()||new TextEncoder().encode(input).length>60000)throw Error('请输入需求文字，长度不得超过 60KB。');
 let path,body;
 if(provider==='openai'){path='/responses';body={model,input,instructions:system,max_output_tokens:maxOutputTokens,store:false};}
 else if(provider==='gemini'){path='/models/'+encodeURIComponent(model.replace(/^models\//,''))+':generateContent';body={contents:[{role:'user',parts:[{text:input}]}],...(system?{systemInstruction:{parts:[{text:system}]}}:{}),generationConfig:{maxOutputTokens}};}
 else if(provider==='anthropic'){path='/messages';body={model,max_tokens:maxOutputTokens,...(system?{system}:{}),messages:[{role:'user',content:input}]};}
 else{path='/chat/completions';body={model,max_tokens:maxOutputTokens,stream:false,...(provider==='qwen'?{enable_thinking:false}:{}),messages:[...(system?[{role:'system',content:system}]:[]),{role:'user',content:input}]};}
 const r=await call(path,body);let text;
 try{text=provider==='openai'?r.output?.flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n'):provider==='gemini'?r.candidates?.[0]?.content?.parts?.filter(x=>!x.thought&&typeof x.text==='string').map(x=>x.text).join('\n'):provider==='anthropic'?r.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n'):r.choices?.[0]?.message?.content;}catch{throw Error('模型响应格式无效。');}
 if(typeof text!=='string'||!text.trim())throw Error('模型未返回最终文字，请调整模型或输出上限。');
 return {provider,model,text};
}
