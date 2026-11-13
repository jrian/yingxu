// Only the currently mounted opaque-origin Pinterest preview may offer a reference.
// This module never writes project state. onApply owns the guarded storage transaction.
function pinUrl(value){return typeof value==='string'&&/^https:\/\/www\.pinterest\.com\/pin\/\d+\/?$/.test(value)?value:null;}
function imageUrl(value){if(typeof value!=='string'||!/^https:\/\/i\.pinimg\.com\//.test(value))return null;try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='i.pinimg.com'&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}}
export function createReferencePicker({escape,modal,toast=()=>{},getProject,onApply}){
 let session=null,serial=0,pendingCloseFocus=null;
 const dialog=()=>document.querySelector('#modal');
 function reset(restoreFocus=false){
  const old=session;old?.controller?.abort();session=null;serial++;pendingCloseFocus=null;
  if(!restoreFocus||!old?.sourceFrame)return;
  const revision=serial;
  const restore=()=>{
   const frame=old.sourceFrame;
   if(serial!==revision||session||dialog()?.open||!document.querySelector('#modal-body .reference-picker')||!frame.isConnected||![...document.querySelectorAll('.ref-preview-frame iframe')].includes(frame))return;
   try{frame.focus({preventScroll:true});}catch{}
   // Window.focus is one of the operations permitted across the opaque iframe boundary.
   try{frame.contentWindow?.focus();}catch{}
   try{const nonce=new URL(frame.getAttribute('src'),location.href).searchParams.get('session');if(nonce&&pinUrl(old.source.pinUrl))frame.contentWindow?.postMessage({type:'frame:restore-pin-focus',session:nonce,pinUrl:old.source.pinUrl},'*');}catch{}
  };
  pendingCloseFocus={revision:serial,restore};
  queueMicrotask(restore);
  // Escape's default dialog close can run after the first microtask checkpoint.
  requestAnimationFrame(restore);
 }
 document.querySelector('#modal')?.addEventListener('close',()=>{if(dialog()?.open){pendingCloseFocus=null;return;}if(session)reset(true);else if(pendingCloseFocus?.revision===serial){const pending=pendingCloseFocus;pendingCloseFocus=null;pending.restore();}});
 document.querySelector('#modal')?.addEventListener('cancel',()=>{if(session)reset(true);});
 function alive(s){return session===s&&s.token===serial&&Boolean(dialog()?.open)&&Boolean(document.querySelector('.reference-picker'));}
 function current(s,role){const p=getProject();return p?.id===s.project.id&&(!role||(p[role]||'')===s.expected[role]);}
 const roleName=role=>role==='product'?'产品身份 · 图1':'场景环境 · 图2';
 const sourceLink=(url,label)=>`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;
 function status(s,text,error=false){if(!alive(s))return;const el=document.querySelector('#ref-picker-status');if(el){if(el.textContent!==text)el.textContent=text;el.classList.toggle('is-error',error);}}
 function dimensions(s){const img=document.querySelector('.reference-picker .ref-picker-new-image'),label=document.querySelector('#ref-picker-dimensions');if(!img||!label)return;const update=()=>{if(!alive(s))return;label.textContent=img.naturalWidth?`${img.naturalWidth} × ${img.naturalHeight} px · 组件实际图片尺寸${Math.min(img.naturalWidth,img.naturalHeight)<400?' · 小尺寸预览，细节有限':''}`:'图片尺寸未能读取';};img.onload=update;img.onerror=()=>{update();status(s,'图片预览未能显示。可打开 Pinterest 来源查看，或稍后重试。',true);};if(img.complete)update();}
 function show(s,stage='view'){
  if(session!==s)return;s.stage=stage;
  const name=escape(s.project.title||'未命名项目'),confirmation=stage==='confirm',role=s.role;
  const newImage=`<img class="ref-picker-new-image" src="${escape(s.source.imageUrl)}" alt="${escape(s.source.title||'Pinterest 参考图片')}" referrerpolicy="no-referrer">`;
  const content=confirmation?`<p class="ref-picker-eyebrow">确认替换 / ${escape(roleName(role))}</p><h3>将这张图用于「${name}」？</h3><p class="ref-picker-description">${role==='product'?'产品图决定主体身份。替换后需重新检查主体结构、外观约束和完整提示词。':'场景图只控制环境方向。请检查图中是否含其他产品、人物或标识，并在使用前处理竞争主体。'}</p><div class="ref-picker-comparison"><figure><div class="ref-picker-imagebox">${s.expected[role]?`<img src="${escape(s.expected[role])}" alt="当前${escape(roleName(role))}">`:'<span>当前未设置参考图</span>'}</div><figcaption>当前参考 · ${escape(roleName(role))}</figcaption></figure><figure><div class="ref-picker-imagebox">${newImage}</div><figcaption>即将设为 · ${escape(roleName(role))}</figcaption></figure></div><div class="ref-picker-review-note">确认后将标记参考、外观约束与独立复核需要重新检查；现有提示词和历史验收记录由项目保留，不能视为已适配新图。</div>`:`<div class="ref-picker-full-image">${newImage}</div><h3>${escape(s.source.title||'Pinterest 图片参考')}</h3><p class="ref-picker-description">目标项目：${name}。选择用途后可预览新旧参考，再确认替换。</p>`;
  modal(confirmation?'确认参考图替换':'Pinterest 图片预览',`<section class="reference-picker">${content}${confirmation?'<div class="ref-picker-online-note"><strong>保存在线图片引用，未下载到本地</strong><span>显示依赖 Pinterest 和网络，导出保留来源链接。</span></div>':''}<p id="ref-picker-dimensions" class="ref-picker-dimensions">正在读取实际图片尺寸…</p><div class="ref-picker-provenance"><span>Pinterest 官方组件实际返回的预览图，可能为 236px 等小尺寸；未推测或请求原图。</span><div>${sourceLink(s.source.pinUrl,'查看 Pin 来源')}${sourceLink(s.source.boardUrl,'打开收藏夹')}</div></div><p id="ref-picker-status" role="status" aria-live="polite"></p><div class="ref-picker-actions">${confirmation?`<button class="button" data-picker-action="back">返回预览</button><button class="button" data-picker-action="cancel">取消</button><button class="button primary" data-picker-action="confirm">${s.expected[role]?'确认替换':'确认设为'}${role==='product'?'产品图':'场景图'}</button>`:'<button class="button" data-picker-action="cancel">关闭</button><button class="button" data-picker-action="role" data-ref-role="product">设为产品图</button><button class="button primary" data-picker-action="role" data-ref-role="scene">设为场景图</button>'}</div></section>`);
  dimensions(s);document.querySelector(`[data-picker-action="${confirmation?'back':'role'}"]`)?.focus({preventScroll:true});
 }
 function accept(event){
  const m=event.data;if(event.origin!=='null'||!m||m.type!=='frame:pinterest-pin'||!pinUrl(m.pinUrl)||!imageUrl(m.imageUrl)||typeof m.boardUrl!=='string')return;
  const frame=[...document.querySelectorAll('.ref-preview-frame iframe')].find(el=>el.contentWindow===event.source);if(!frame)return;
  try{const src=new URL(frame.getAttribute('src'),location.href);if(src.searchParams.get('board')!==m.boardUrl||!src.searchParams.get('session')||src.searchParams.get('session')!==m.session)return;}catch{return;}
  const p=getProject();if(!p?.id){toast('请先选择目标项目');return;}if(session?.busy)return;
  reset();const s={token:serial,sourceFrame:frame,source:{provider:'Pinterest',boardUrl:m.boardUrl,pinUrl:m.pinUrl,imageUrl:imageUrl(m.imageUrl),title:typeof m.title==='string'?m.title.slice(0,300):''},project:structuredClone(p),expected:{product:p.product||'',scene:p.scene||''},role:null,stage:'view',busy:false};session=s;show(s);
 }
 window.addEventListener('message',accept);
 // Chromium can target the outer iframe for the first native click after layout/focus changes.
 // Relay only that trusted physical click, never a synthetic event or a role/application command.
 document.addEventListener('click',event=>{
  const frame=event.target;
  if(!event.isTrusted||event.button!==0||dialog()?.open||!(frame instanceof HTMLIFrameElement)||!frame.matches('.ref-preview-frame iframe'))return;
  const rect=frame.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const x=(event.clientX-rect.left)*frame.offsetWidth/rect.width-frame.clientLeft,y=(event.clientY-rect.top)*frame.offsetHeight/rect.height-frame.clientTop;
  if(x<0||y<0||x>=frame.clientWidth||y>=frame.clientHeight)return;
  const key=new URL(frame.src,location.href).searchParams.get('session');if(!key)return;
  frame.contentWindow?.postMessage({type:'frame:preview-pointer',session:key,x,y},'*');
 },true);

 // Closing or replacing the shared modal invalidates pending image reads immediately.
 const observer=new MutationObserver(()=>{if(session&&(!document.querySelector('.reference-picker')||!dialog()?.open)){reset(!dialog()?.open);return;}if(session&&!current(session)){session.controller?.abort();status(session,'当前项目已切换。请关闭预览，在目标项目中重新选择参考图。',true);}});
 const body=document.querySelector('#modal-body');if(body)observer.observe(body,{childList:true,subtree:true});
 // An online reference can be displayed and decoded without reading CORS-protected bytes.
 async function validateOnlineImage(s){
  const signal=s.controller.signal;
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const image=new Image();image.referrerPolicy='no-referrer';image.decoding='async';
  try{
   await new Promise((resolve,reject)=>{
    let settled=false,timer;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);image.onload=null;image.onerror=null;error?reject(error):resolve();};
    const abort=()=>finish(new DOMException('Aborted','AbortError'));
    const decoded=()=>finish(image.naturalWidth>0&&image.naturalHeight>0?null:Error('图片尺寸无效，未保存在线引用。'));
    signal.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>finish(Error('图片加载超时，当前参考未修改。请检查网络后重试。')),15000);
    image.onerror=()=>finish(Error('在线图片未能加载，当前参考未修改。可重试或在 Pinterest 查看来源。'));
    image.onload=()=>{if(typeof image.decode!=='function')decoded();};
    image.src=s.source.imageUrl;
    if(typeof image.decode==='function')image.decode().then(decoded,()=>finish(Error('在线图片无法正常解码，当前参考未修改。请换一张图片或重试。')));
   });
  }finally{image.onload=null;image.onerror=null;image.src='';}
 }
 async function confirm(s){
  if(s.busy||s.stage!=='confirm'||!['product','scene'].includes(s.role))return;
  if(!current(s,s.role)){status(s,'目标项目或当前参考图已改变，请关闭后重新选择。',true);return;}
  s.busy=true;s.controller=new AbortController();document.querySelectorAll('.reference-picker [data-picker-action]').forEach(b=>b.disabled=true);status(s,'正在检查在线图片是否可显示；尚未保存引用…');
  try{await validateOnlineImage(s);if(!alive(s))return;if(!current(s,s.role)){status(s,'目标项目或当前参考图已改变，请关闭后重新选择。',true);return;}
   const ok=await onApply({projectId:s.project.id,role:s.role,expectedSource:s.expected[s.role],referenceUrl:s.source.imageUrl,source:{...s.source,savedAs:'remote-url'}});
   if(!alive(s))return;if(ok){dialog()?.close();reset(true);}else status(s,'参考图未能保存。当前参考保持不变，请检查项目状态后重试。',true);
  }catch(error){if(alive(s))status(s,error.name==='AbortError'?'操作已取消，项目未修改。':error instanceof TypeError?'在线图片无法显示；当前参考未修改，可重试或在 Pinterest 打开来源。':error.message||'图片读取失败，请重试。',true);
  }finally{if(alive(s)){s.busy=false;document.querySelectorAll('.reference-picker [data-picker-action]').forEach(b=>b.disabled=false);}}
 }
 function handleClick(button){const action=button?.dataset?.pickerAction;if(!action)return false;const s=session;if(!s||!alive(s))return true;if(s.busy)return true;
  if(action==='cancel'){dialog()?.close();reset(true);}else if(action==='back')show(s,'view');else if(action==='role'){const role=button.dataset.refRole;if(!['product','scene'].includes(role))return true;if(!current(s,role)){status(s,'目标项目或当前参考图已改变，请关闭后重新选择。',true);return true;}s.role=role;show(s,'confirm');}else if(action==='confirm')void confirm(s);return true;
 }
 return {handleClick};
}
