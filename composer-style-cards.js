// Pure presentation: selection, clearing, navigation, and persistence belong to the host.
function imageSource(value){
 if(typeof value!=='string')return '';
 const src=value.trim();
 if(/^(?:\.?\/)?assets\/[\w%./() -]+$/i.test(src))return src;
 try{const url=new URL(src);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function renderComposerStyleCards({escape,icon,selections={},covers={},status={}}){
 return `<div class="composer-style-slots">${['director','film'].map(group=>{
  const selection=selections[group],selected=Boolean(selection),label=group==='director'?'导演风格':'电影风格';
  const cover=selection?covers[group]?.[selection.id]:null;
  const frame=cover?.frames?.[0]||cover;
  const src=imageSource(selection?.coverSrc||selection?.thumbData?.src||((!cover?.status||cover.status==='available')?frame?.src:''));
  const coverTitle=selection?.coverTitle||selection?.thumbData?.title||cover?.title||'';
  const coverYear=selection?.coverYear||selection?.thumbData?.year||cover?.year||'';
  const name=selected?(selection.name||selection.title||'已选择参考'):(group==='director'?'选择导演方法':'选择电影画面');
  const kind=selection?.selectionKind==='case'?'案例参考':'风格模板';
  const loadStatus=typeof status==='string'?status:status[group];
  const subline=selected?`${kind}${coverTitle?' · '+coverTitle:''}${coverYear?' ('+coverYear+')':''}`:loadStatus==='error'?'资料暂未载入 · 点击重试浏览':loadStatus==='loading'||loadStatus==='fetching'?'资料载入中 · 可先浏览':'点击浏览案例与风格库';
  return `<div class="composer-style-slot ${selected?'has-selection':'is-empty'}" data-composer-style-slot="${group}"><button type="button" class="composer-style-card" aria-haspopup="dialog" aria-controls="style-browser" data-style-slot="${group}" aria-label="${escape(label+'：'+name+'，'+(selected?'点击更换':'点击浏览对应素材库'))}" title="${escape(label+' · '+name+' · '+subline)}"><span class="composer-style-art ${src?'has-image':''}" aria-hidden="true"><span class="composer-style-art-symbol">${icon(group==='director'?'settings':'film')}</span>${src?`<img src="${escape(src)}" alt="" loading="lazy" decoding="async">`:''}</span><span class="composer-style-copy"><span class="composer-style-label">${label}</span><strong>${escape(name)}</strong><small>${escape(subline)}</small></span><span class="composer-style-change" aria-hidden="true">${selected?'更换 ›':'›'}</span></button>${selected?`<button type="button" class="composer-style-clear" data-clear-style-slot="${group}" aria-label="清除${label}：${escape(name)}" title="清除${label}">×</button>`:''}</div>`;
 }).join('')}</div>`;
}
