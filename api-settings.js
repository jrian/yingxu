import {MODEL_PRESETS} from './model-presets.js';
import {requestDirect} from './model-client.js';
// API keys and gateway tokens are page-memory only. Never persist or export secrets.
export function createApiSettings({getBrief}) {
 const KEY='frame-api-settings-v1';
 const providers=[
 {id:'deepseek',name:'DeepSeek',base:'https://api.deepseek.com',env:'DEEPSEEK_API_KEY',group:'国内服务商'},
 {id:'qwen',name:'通义千问',base:'https://dashscope.aliyuncs.com/compatible-mode/v1',env:'QWEN_API_KEY',group:'国内服务商',note:'网关可通过 QWEN_BASE_URL 配置地域或业务空间对应的专属地址。'},
 {id:'doubao',name:'豆包',base:'https://ark.cn-beijing.volces.com/api/v3',env:'DOUBAO_API_KEY',group:'国内服务商',note:'模型 ID 按火山方舟的模型或推理接入点配置填写。'},
 {id:'zhipu',name:'智谱 GLM',base:'https://open.bigmodel.cn/api/paas/v4',env:'ZHIPU_API_KEY',group:'国内服务商'},
 {id:'moonshot',name:'Kimi',base:'https://api.moonshot.cn/v1',env:'MOONSHOT_API_KEY',group:'国内服务商'},
 {id:'openai',name:'OpenAI',base:'https://api.openai.com/v1',env:'OPENAI_API_KEY',group:'其他服务商'},
 {id:'gemini',name:'Gemini',base:'https://generativelanguage.googleapis.com/v1beta',env:'GEMINI_API_KEY',group:'其他服务商'},
 {id:'anthropic',name:'Claude',base:'https://api.anthropic.com/v1',env:'ANTHROPIC_API_KEY',group:'其他服务商'},
 {id:'compatible',name:'自定义兼容',base:'',env:'COMPATIBLE_API_KEY',group:'自定义服务'}
 ];
 let saved={};try{saved=JSON.parse(localStorage.getItem(KEY))||{};}catch{}
 const selectedProvider=providers.some(p=>p.id===saved.provider)?saved.provider:'deepseek';
 const models=Object.fromEntries(providers.map(p=>[p.id,typeof saved.models?.[p.id]==='string'?saved.models[p.id]:'']));
 if(typeof saved.model==='string'&&!models[selectedProvider])models[selectedProvider]=saved.model;
 const directUrls=Object.fromEntries(providers.map(p=>[p.id,typeof saved.directUrls?.[p.id]==='string'?saved.directUrls[p.id]:p.base]));
 const config={mode:saved.mode==='gateway'?'gateway':'direct',directUrls,provider:selectedProvider,url:typeof saved.url==='string'?saved.url:'',model:models[selectedProvider],models,maxOutputTokens:Number.isInteger(saved.maxOutputTokens)&&saved.maxOutputTokens>=1&&saved.maxOutputTokens<=4096?saved.maxOutputTokens:1024};
 let simple=true;
 let presetId;try{presetId=localStorage.getItem('frame-api-simple-preset-v1');}catch{}
 let preset=MODEL_PRESETS.find(p=>p.provider+':'+p.model===presetId)||MODEL_PRESETS[0];
 function target(){return simple?{mode:'direct',provider:preset.provider,model:preset.model,baseUrl:preset.base,maxOutputTokens:1024}:{mode:config.mode,provider:config.provider,model:config.model,baseUrl:config.directUrls[config.provider],maxOutputTokens:config.maxOutputTokens};}
 let readiness=false,discovery='remote';
 let apiKey='',token='',status='unconfigured',active=null,serial=0,returnFocus=null;
 const dialog=document.createElement('dialog');dialog.id='api-dialog';dialog.setAttribute('aria-labelledby','api-title');dialog.setAttribute('aria-describedby','api-description');
 dialog.innerHTML=`<header class="api-heading"><div><h2 id="api-title">大模型接入中心</h2><p id="api-description">选择模型，填入 API Key，即可开始。</p></div><button class="icon-button" type="button" id="api-close" aria-label="关闭大模型接入中心">×</button></header>
 <div class="api-tabs" role="tablist" aria-label="大模型接入功能"><button type="button" role="tab" id="api-settings-tab" aria-controls="api-settings-panel" aria-selected="true">连接设置</button><button type="button" role="tab" id="api-assistant-tab" aria-controls="api-assistant-panel" aria-selected="false" tabindex="-1">提示词助手</button></div>
 <div class="api-body"><p class="api-status" id="api-status" role="status" aria-live="polite">未验证 · 填写接入信息即可尝试生成</p>
 <section role="tabpanel" id="api-settings-panel" aria-labelledby="api-settings-tab">
 <div class="api-field"><label for="api-mode">接入方式</label><select id="api-mode"><option value="direct">直接连接 API（无需部署网关）</option><option value="gateway">高级：通过独立网关</option></select></div>
 <select id="api-provider" hidden aria-hidden="true" tabindex="-1">${providers.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select>
 <div class="api-provider-groups" aria-label="选择文字大模型服务商">${['国内服务商','其他服务商','自定义服务'].map(group=>`<section class="api-provider-group"><h3>${group}</h3><div class="api-provider-grid">${providers.filter(p=>p.group===group).map(p=>`<button type="button" class="api-provider-card" data-provider="${p.id}" aria-pressed="false">${p.name}</button>`).join('')}</div></section>`).join('')}</div>
 <div id="api-direct-fields">
 <div class="api-field"><label for="api-base-url">接口地址 · Base URL</label><input id="api-base-url" type="url" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false" aria-describedby="api-base-help"><small id="api-base-help">填写服务商 Base URL，可带版本路径；不要填 /chat/completions 等具体端点。不会自动添加 /v1。</small></div>
 <div class="api-field"><label for="api-key">API Key</label><div class="api-token-row"><input id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="粘贴该服务商的 API Key" aria-describedby="api-key-help"><button class="button" type="button" id="api-clear-key">清除 Key</button></div><small id="api-key-help">仅当前页面内存使用，刷新或切换服务商后清除；不会保存到项目或浏览器存储。</small></div>
 </div><div id="api-gateway-fields" hidden>
 <div class="api-field"><label for="api-url">网关地址</label><input id="api-url" type="url" placeholder="https://your-gateway.example" autocomplete="off" spellcheck="false" aria-describedby="api-url-help"><small id="api-url-help">这是你部署的独立网关根地址，与上方服务商 API 地址不同。浏览器只访问网关；远程用 HTTPS，本机可用 HTTP。</small></div>
 <div class="api-field"><label for="api-token">网关访问令牌</label><div class="api-token-row"><input id="api-token" type="password" autocomplete="off" spellcheck="false" placeholder="输入网关访问令牌" aria-describedby="api-token-help"><button class="button" type="button" id="api-clear-token">清除令牌</button></div><small id="api-token-help">仅当前页面内存使用，刷新后清除。供应商 API Key 请放在网关环境变量中，勿填在这里。</small></div>
 </div>
 <div class="api-field api-model"><label for="api-model">模型名称 / ID</label><input id="api-model" list="api-model-options" placeholder="填写模型名称 / ID，或读取候选模型" autocomplete="off" spellcheck="false"><datalist id="api-model-options"></datalist><small id="api-model-help">模型名称由服务商定义；可以手填，直接生成无需先检查连接。</small></div>
 <div class="api-actions"><button class="button primary" type="button" id="api-connect">检查连接并读取模型</button><button class="button" type="button" id="api-save">保存配置</button></div>

 <p id="api-save-status" class="api-helper" role="status">只保存服务商、接口地址、模型和输出上限。密钥不保存；保存不代表验证成功。</p><details class="api-provider-guide"><summary>服务商接口与高级配置说明</summary><h3 id="api-provider-name"></h3><p>服务商 API 地址 <span class="api-guide-tag">只读说明</span></p><code id="api-official-base"></code><p>网关模式密钥变量：<code id="api-key-env"></code></p><p id="api-provider-note"></p><p>直接模式将请求发送至你填写的接口地址，需要该服务支持浏览器跨域访问。网关模式才需要在服务器配置密钥。</p></details>
 </section>
 <section role="tabpanel" id="api-assistant-panel" aria-labelledby="api-assistant-tab" hidden>
 <div class="api-inline api-assistant-model"><p id="api-active-model" class="api-helper">尚未指定模型</p><button class="button small" type="button" id="api-edit-connection">修改连接与模型</button></div>
 <div class="api-field"><label for="api-input">创作需求</label><textarea id="api-input" rows="5" maxlength="24000" placeholder="描述你需要的提示词、镜头动作和必须保留的特征"></textarea><div class="api-inline"><small>只发送你在此处确认的文字，不上传参考图片。</small><button class="button small" type="button" id="api-load-brief">载入当前简报</button></div></div>
 <div class="api-field"><label for="api-limit">最大输出 tokens</label><input id="api-limit" type="number" min="1" max="4096" step="1"><small>默认 1024，上限 4096；实际费用由供应商计费规则决定。</small></div>
 <p class="api-helper">点击生成后才会请求模型，可能产生供应商费用。草稿不代表独立质检通过。</p>
 <div class="api-actions"><button class="button primary" type="button" id="api-generate">生成提示词草稿</button></div>
 <div class="api-field api-result"><label for="api-output">草稿预览</label><textarea id="api-output" rows="7" readonly placeholder="生成后的文字在这里预览"></textarea><div class="api-inline"><small id="api-result-note">草稿不会自动覆盖项目提示词；复制后可到提示词工作区编辑。</small><button class="button small" type="button" id="api-copy" disabled>复制草稿</button></div></div>
 </section>

 <p class="api-feedback" id="api-feedback" role="status" aria-live="polite"></p></div>
 <footer class="api-footer"><span>文字生成 · 不生成图片或视频</span><button class="button" type="button" id="api-cancel" hidden>取消请求</button><button class="button" type="button" id="api-done">完成</button></footer>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#api-'+id);
 const settings=$('settings-panel'),advanced=document.createElement('div');advanced.id='api-advanced-panel';
 const keyField=$('key').closest('.api-field');keyField.remove();
 while(settings.firstChild)advanced.append(settings.firstChild);
 const limitField=$('limit').closest('.api-field');advanced.append(limitField);
 const simpleControls=document.createElement('div');simpleControls.id='api-simple-controls';
 const presetField=document.createElement('div');presetField.className='api-field';
 const presetLabel=document.createElement('label');presetLabel.htmlFor='api-preset';presetLabel.textContent='模型';
 const presetSelect=document.createElement('select');presetSelect.id='api-preset';
 for(const p of MODEL_PRESETS){const option=document.createElement('option');option.value=p.provider+':'+p.model;option.textContent=p.label;presetSelect.append(option);}
 presetSelect.value=preset.provider+':'+preset.model;
 const presetHelp=document.createElement('small');presetHelp.id='api-preset-help';presetSelect.setAttribute('aria-describedby',presetHelp.id);
 presetField.append(presetLabel,presetSelect,presetHelp);simpleControls.append(presetField);
 const advancedToggle=document.createElement('button');advancedToggle.id='api-advanced-toggle';advancedToggle.type='button';advancedToggle.className='button api-advanced-toggle';advancedToggle.setAttribute('aria-controls',advanced.id);advancedToggle.setAttribute('aria-expanded','false');advancedToggle.textContent='高级设置';
 const simpleHint=document.createElement('p');simpleHint.className='api-helper';simpleHint.id='api-simple-hint';simpleHint.textContent='模型选择会记住；API Key 仅当前页面使用。自定义接口与网关可在高级设置中使用。';
 settings.append(simpleControls,keyField,simpleHint,advancedToggle,advanced);advanced.hidden=true;
 function clearSecrets(){token='';apiKey='';$('key').value='';$('token').value='';}
 function renderSimple(){simpleControls.hidden=!simple;simpleHint.hidden=!simple;advanced.hidden=simple;advancedToggle.setAttribute('aria-expanded',String(!simple));advancedToggle.textContent=simple?'高级设置':'返回简易模式';keyField.hidden=!simple&&config.mode==='gateway';presetHelp.textContent=providers.find(p=>p.id===preset.provider).name+' 官方接口 · '+preset.base;$('key-help').textContent='仅当前页面使用，刷新或切换接入目标后清除；不会保存或导出。';}
 advancedToggle.addEventListener('click',()=>{if(active)return;sync();simple=!simple;clearSecrets();invalidate();renderSimple();renderProvider();announce(simple?'已切回简易模式，使用所选模型的官方接口。':'高级配置已恢复，API Key 与令牌已清除。高级修改只在高级模式生效。');(simple?$('preset'):$('mode')).focus();});
 presetSelect.addEventListener('change',()=>{const previous=preset;preset=MODEL_PRESETS.find(p=>p.provider+':'+p.model===presetSelect.value)||MODEL_PRESETS[0];if(previous.provider!==preset.provider||previous.base!==preset.base)clearSecrets();invalidate();renderSimple();try{localStorage.setItem('frame-api-simple-preset-v1',preset.provider+':'+preset.model);}catch{announce('模型已选择，但浏览器未能记住本次选择。');}});
 renderSimple();

 $('mode').value=config.mode;$('base-url').value=config.directUrls[config.provider]||'';$('provider').value=config.provider;$('url').value=config.url;$('model').value=config.model;$('limit').value=config.maxOutputTokens;
 function announce(message,error=false){$('feedback').textContent=message;$('feedback').classList.toggle('is-error',error);}
 function setStatus(next,message){status=next;$('status').dataset.state=next;$('status').textContent=message;}
 function busy(value){for(const el of dialog.querySelectorAll('[data-provider],#api-preset,#api-advanced-toggle,#api-provider,#api-mode,#api-key,#api-clear-key,#api-base-url,#api-model,#api-limit,#api-url,#api-token,#api-clear-token,#api-save'))el.disabled=value;$('connect').disabled=value;$('generate').disabled=value;$('cancel').hidden=!value;dialog.setAttribute('aria-busy',String(value));}
 function invalidate(){readiness=false;serial++;if(active)clearTimeout(active.timeout);active?.controller.abort();active=null;busy(false);$('model-options').replaceChildren();$('model-help').textContent=config.mode==='direct'?'可以手填模型名称后直接生成；检查连接与读取模型为可选。':'连接信息已变化，请重新检查连接并读取模型。';setStatus('unconfigured',target().mode==='direct'?'未验证 · 可填写信息后尝试生成':'未配置 · 等待检查连接');announce('');}
 function sync(){config.provider=$('provider').value;config.url=$('url').value.trim();config.model=$('model').value.trim();config.models[config.provider]=config.model;config.maxOutputTokens=Number($('limit').value);token=$('token').value;apiKey=$('key').value;config.directUrls[config.provider]=$('base-url').value.trim();}
 function validatedGatewayUrl(requireToken=true){sync();if(!config.url)throw Error('请填写你部署的网关地址，再检查连接。');let url;try{url=new URL(config.url);}catch{throw Error('网关地址无效，请填写完整的 HTTPS 地址。');}const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))throw Error('远程网关需要 HTTPS；只有本机 localhost、127.0.0.1 或 ::1 可使用 HTTP。');if(url.username||url.password||url.search||url.hash||config.url.includes('?')||config.url.includes('#'))throw Error('网关地址不能包含凭据、查询参数或片段。');if(url.pathname!=='/'&&url.pathname!=='')throw Error('请填写网关根地址，不包含 /api 等路径。');if(requireToken&&!token)throw Error('请填写网关访问令牌；供应商 API Key 请配置在网关服务端。');if(/[\r\n]/.test(token))throw Error('访问令牌不能包含换行。');return url.origin;}
 function validatedUrl(requireSecret=true){sync();const current=target();if(current.mode==='gateway')return validatedGatewayUrl(requireSecret);const raw=current.baseUrl;let url;try{url=new URL(raw);}catch{throw Error('请填写完整的接口 Base URL，例如 https://api.example.com/v1。');}if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('远程接口需要 HTTPS；本机接口可使用 HTTP。');if(url.username||url.password||raw.includes('?')||raw.includes('#'))throw Error('接口地址不能包含凭据、查询参数或片段。');if(/\/(chat\/completions|messages|models)(\/|$)/.test(url.pathname))throw Error('请填写 Base URL，不要包含 /chat/completions、/messages 或 /models 等端点。');if(requireSecret&&!apiKey.trim())throw Error('请填写当前服务商的 API Key。');if(/[\r\n]/.test(apiKey))throw Error('API Key 不能包含换行。');return url.href.replace(/\/$/,'');}
 function begin(kind){const current=target();const op={id:++serial,controller:new AbortController(),kind,timedOut:false,provider:current.provider,model:current.model,token,apiKey,baseUrl:current.baseUrl,mode:current.mode,maxOutputTokens:current.maxOutputTokens,previousStatus:status};active=op;busy(true);op.timeout=setTimeout(()=>{op.timedOut=true;op.controller.abort();},kind==='generation'?90000:20000);return op;}
 async function request(base,path,op,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+op.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:op.controller.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});if(!response.ok){if(response.status===401||response.status===403)throw Error('访问被拒绝（'+response.status+'），请核对网关令牌与访问权限。');if(response.status===429)throw Error('请求过于频繁或额度不足（429），请稍后重试并核对供应商额度。');const error=Error('网关请求失败（'+response.status+'），请检查服务日志后重试。');error.status=response.status;throw error;}try{return await response.json();}catch{throw Error('网关返回格式无效，需要 JSON 响应。');}}
 function failure(error,op){if(op.id!==serial)return;const message=op.timedOut?'请求超时，请检查接口网络后重试。':error.name==='AbortError'?'请求已取消，可重新发起。':error instanceof TypeError?(op.mode==='direct'?'无法直接访问接口：请检查网络、地址及服务商是否允许浏览器跨域（CORS）。可核对后再次显式尝试生成。':'无法连接网关，请检查地址、服务状态及 CORS 允许来源后重试。'):error.message;announce(message,true);if(op.kind==='connection'||error.name!=='AbortError')setStatus('failed','失败 · '+message);}
 function finish(op){clearTimeout(op.timeout);if(active===op){active=null;busy(false);}}
 function applyModels(result,provider,op){
 if(result.provider!==op.provider||!Array.isArray(result.models))throw Error('模型列表格式无效，请检查网关版本。');
 const models=result.models.filter(m=>typeof m.id==='string'&&m.id.length>0);$('model-options').replaceChildren(...models.map(m=>{const option=document.createElement('option');option.value=m.id;option.label=typeof m.name==='string'?m.name:m.id;return option;}));
 discovery=result.discovery||'remote';readiness=true;
 const manual=discovery==='manual'||result.verified===false;
 if(manual){discovery='manual';setStatus('configured',op.mode==='direct'?'未验证 · 请手填模型后尝试调用':'已配置 · 待首次调用验证');$('model-help').textContent=op.mode==='direct'?'当前未验证 API Key。请手填模型 ID，显式生成成功后才显示已连接。':'网关确认已设置服务端密钥，但尚未验证供应商凭据。请手填模型 ID，首次成功生成后才显示已连接。';announce('当前使用手动模型 ID。本次没有验证供应商密钥；点击生成会发起实际请求，可能计费。');}
 else{$('model-help').textContent=models.length?`已读取 ${models.length} 个模型，可选择或手动填写模型 ID。`:'未返回可列举模型，请手动填写模型 ID。';setStatus('connected','已连接 · '+provider.name+'（模型列表已验证）');announce('连接检查完成。填写模型 ID 后，可进入提示词助手。');}
 }
 async function connect(){let base;try{base=validatedUrl();}catch(e){announce(e.message,true);return;}const op=begin('connection');readiness=false;setStatus('checking','检测中 · 正在读取模型');announce('');try{if(op.mode==='direct'){const result=await requestDirect({action:'models',provider:op.provider,baseUrl:base,apiKey:op.apiKey,signal:op.controller.signal});if(op.id===serial)applyModels(result,providers.find(p=>p.id===op.provider),op);return;}const data=await request(base,'/api/providers',op);if(op.id!==serial)return;const provider=data.providers?.find(p=>p.id===op.provider);if(!provider?.configured)throw Error('该供应商尚未配置。请在网关环境变量中设置供应商 API Key 后重试。');let result;try{result=await request(base,'/api/models?provider='+encodeURIComponent(op.provider),op);}catch(e){if([404,405,501].includes(e.status))result={provider:op.provider,models:[],discovery:'manual',verified:false};else throw e;}if(op.id!==serial)return;applyModels(result,provider,op);}catch(e){failure(e,op);}finally{finish(op);}}
 async function generate(){let base;try{base=validatedUrl();if(!simple&&config.mode==='gateway'&&!readiness)throw Error('请先在连接设置中检查配置并读取模型。');if(!target().model)throw Error('请填写模型 ID 后再生成。');if(!Number.isInteger(target().maxOutputTokens)||target().maxOutputTokens<1||target().maxOutputTokens>4096)throw Error('最大输出 tokens 必须是 1–4096 的整数。');if(!$('input').value.trim())throw Error('请填写创作需求，或载入当前简报。');}catch(e){announce(e.message,true);return;}const op=begin('generation');announce('正在生成提示词草稿，可取消请求。取消后供应商仍可能对已处理的内容计费。');try{const payload={provider:op.provider,model:op.model,input:$('input').value.trim(),maxOutputTokens:op.maxOutputTokens,system:'你是视频提示词撰写助手。依据用户提供的文字生成清晰可编辑的提示词草稿，不声称看过未提供的图片，不编造产品事实，不声称通过独立质检。'};const result=op.mode==='direct'?await requestDirect({...payload,action:'prompt',baseUrl:base,apiKey:op.apiKey,signal:op.controller.signal}):await request(base,'/api/prompt',op,payload);if(op.id!==serial)return;if(result.provider!==op.provider||result.model!==op.model||typeof result.text!=='string'||!result.text.trim())throw Error('模型返回与请求不符或未返回有效文字，请核对模型 ID 后重试。');$('output').value=result.text;$('copy').disabled=false;setStatus('connected','已连接 · '+providers.find(p=>p.id===op.provider).name+' / '+op.model+'（调用已验证）');$('result-note').textContent='草稿来源：'+providers.find(p=>p.id===op.provider).name+' / '+op.model+'。未覆盖项目提示词；独立质检待执行。';announce('草稿已生成。请核对产品事实与镜头要求后使用；独立质检待执行。');}catch(e){failure(e,op);}finally{finish(op);}}
 function cancel(){if(!active)return;const kind=active.kind;serial++;clearTimeout(active.timeout);active.controller.abort();active=null;busy(false);if(kind==='connection'){readiness=false;setStatus('unconfigured','未配置 · 连接检查已取消');}announce('请求已取消，可重新发起。供应商仍可能对已处理的内容计费。');}
 function switchTab(name){sync();$('active-model').textContent=target().model?'当前模型：'+(simple?preset.label:target().model):'尚未指定模型，请到连接设置填写。';for(const key of ['settings','assistant']){const selected=key===name;$(key+'-tab').setAttribute('aria-selected',String(selected));$(key+'-tab').tabIndex=selected?0:-1;$(key+'-panel').hidden=!selected;}}
 function renderProvider(){const provider=providers.find(p=>p.id===config.provider);keyField.hidden=!simple&&config.mode==='gateway';$('direct-fields').hidden=config.mode!=='direct';$('gateway-fields').hidden=config.mode!=='gateway';$('connect').textContent=config.mode==='direct'?'读取模型（可选）':'检查连接并读取模型';$('provider-name').textContent=provider.name;$('official-base').textContent=provider.base||'填写你的 OpenAI 兼容服务 Base URL';$('key-env').textContent=provider.env;$('provider-note').textContent=provider.note||'实际模型与权限以服务商及网关部署配置为准。';dialog.querySelectorAll('[data-provider]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.provider===config.provider)));}
 function changeProvider(id){if(active||id===config.provider)return;config.models[config.provider]=$('model').value.trim();config.directUrls[config.provider]=$('base-url').value.trim();config.provider=id;$('base-url').value=config.directUrls[id]||'';$('provider').value=id;$('model').value=config.models[id]||'';config.model=$('model').value;token='';apiKey='';$('token').value='';$('key').value='';invalidate();renderProvider();announce('已切换服务商，模型与接口地址分别记忆。请重新填写当前服务商的密钥。');}
 dialog.querySelectorAll('[data-provider]').forEach(el=>el.addEventListener('click',()=>changeProvider(el.dataset.provider)));
 $('provider').addEventListener('change',()=>changeProvider($('provider').value));
 for(const name of ['url','token','base-url','key'])$(name).addEventListener('input',()=>{if(name==='url'||name==='base-url')clearSecrets();sync();invalidate();});
 $('model').addEventListener('input',()=>{sync();if(config.mode==='direct')setStatus('unconfigured','未验证 · 当前模型待调用验证');else if(readiness&&discovery==='manual')setStatus('configured','已配置 · 当前模型待调用验证');});
 renderProvider();
 $('mode').addEventListener('change',()=>{sync();config.mode=$('mode').value;token='';apiKey='';$('token').value='';$('key').value='';invalidate();renderProvider();announce('已切换接入方式，密钥和令牌已清除。');});
 $('clear-key').addEventListener('click',()=>{$('key').value='';apiKey='';invalidate();announce('API Key 已从当前页面清除。');});
 $('edit-connection').addEventListener('click',()=>{switchTab('settings');(simple?$('preset'):$('model')).focus();});
 $('clear-token').addEventListener('click',()=>{$('token').value='';token='';invalidate();announce('访问令牌已从当前页面清除。');});
 $('connect').addEventListener('click',connect);$('generate').addEventListener('click',generate);$('cancel').addEventListener('click',cancel);
 $('save').addEventListener('click',()=>{sync();try{if(config.mode==='gateway'&&config.url)validatedGatewayUrl(false);if(!Number.isInteger(config.maxOutputTokens)||config.maxOutputTokens<1||config.maxOutputTokens>4096)throw Error('最大输出 tokens 必须是 1–4096 的整数。');for(const [id,raw] of Object.entries({...config.directUrls,gateway:config.url})){if(!raw)continue;let url;try{url=new URL(raw);}catch{throw Error((providers.find(p=>p.id===id)?.name||'网关')+' 的地址无效，请修正或清空后保存。');}if(url.username||url.password||raw.includes('?')||raw.includes('#'))throw Error((providers.find(p=>p.id===id)?.name||'网关')+' 的地址含凭据、查询参数或片段，不能保存。请切换到该配置修正或清空。');if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error((providers.find(p=>p.id===id)?.name||'网关')+' 的远程地址需要 HTTPS，请修正后保存。');}localStorage.setItem(KEY,JSON.stringify(config));$('save-status').textContent='配置已保存。API Key 与令牌未保存；验证状态以实际请求为准。';}catch(e){announce(e.name==='QuotaExceededError'?'浏览器存储空间不足，配置未保存。':e.message,true);}});
 $('load-brief').addEventListener('click',()=>{$('input').value=getBrief();announce('已载入简报、双图职责、已选风格和审查边界文字。请检查后再点击生成。');});
 $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('output').value);announce('草稿已复制，可到提示词工作区编辑。');}catch{$('output').focus();$('output').select();announce('请使用系统复制快捷键复制已选中的草稿。');}});
 for(const name of ['settings','assistant'])$(name+'-tab').addEventListener('click',()=>switchTab(name));
 dialog.querySelector('[role="tablist"]').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const name=e.key==='Home'?'settings':e.key==='End'?'assistant':document.activeElement===$('settings-tab')?'assistant':'settings';switchTab(name);$(name+'-tab').focus();}});
 function close(){cancel();dialog.close();returnFocus?.focus();}
 $('close').addEventListener('click',close);$('done').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 return {open(){returnFocus=document.activeElement;if(!dialog.open)dialog.showModal();(simple?$('preset'):$('mode')).focus();}};
}
