// Film/director still viewing is independent of project state and style selection.
export function createCoverLightbox({escape,modal,getCover,onFrameChange=()=>{}}){
 let view=null;
 const dialog=document.querySelector('#modal');
 const active=()=>Boolean(view&&dialog.open&&document.querySelector('.cover-lightbox'));
 const link=(url,text)=>`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(text)} ↗</a>`;
 function close(){const previous=view;view=null;if(!previous)return;queueMicrotask(()=>{if(view||dialog.open)return;document.querySelector(`[data-director-zoom="${CSS.escape(previous.id)}"],[data-film-zoom="${CSS.escape(previous.id)}"]`)?.focus({preventScroll:true});});}
 dialog.addEventListener('close',()=>{if(!dialog.open)close();});
 function draw(){
  if(!view)return;const v=view,requestedIndex=v.index,c=v.cover,f=v.frames[v.index],allFailed=v.failed.size===v.frames.length;
  modal('代表作剧照 · '+c.title,`<section class="cover-lightbox"><div class="cover-lightbox-heading"><div><span class="ref-eyebrow">${escape(c.director)}</span><h3>《${escape(c.title)}》 <span>${escape(c.year)}</span></h3></div><span class="cover-lightbox-counter" aria-live="polite">${v.index+1} / ${v.frames.length}</span></div><div class="cover-lightbox-stage">${allFailed?`<div class="cover-lightbox-empty" role="status">《${escape(c.title)}》剧照暂不可用<br>请通过下方来源查看。</div>`:`<img class="cover-lightbox-image" src="${escape(f.src)}" alt="${escape(c.director)}《${escape(c.title)}》（${escape(c.year)}）第${v.index+1}张剧照">`}</div><div class="cover-lightbox-toolbar"><button class="button small" data-cover-lightbox="prev" ${allFailed||v.frames.length<2?'disabled':''} aria-label="上一张剧照">← 上一张</button><span>${f.width} × ${f.height} px</span><button class="button small" data-cover-lightbox="next" ${allFailed||v.frames.length<2?'disabled':''} aria-label="下一张剧照">下一张 →</button></div><p class="cover-lightbox-source">来源：${link(f.sourceUrl||c.sourceUrl,c.source)}${f.imageUrl?' · '+link(f.imageUrl,'当前剧照原始链接'):''}</p><p class="cover-lightbox-note">同一代表作的独立剧照，并非连续镜头。左右方向键切换，Esc 关闭；查看不会选用风格或更改项目参考。</p></section>`);
  if(!allFailed){const img=document.querySelector('.cover-lightbox-image');img.onerror=()=>{if(view!==v||v.index!==requestedIndex||!active())return;v.failed.add(requestedIndex);if(v.failed.size===v.frames.length)draw();else move(1);};}
 }
 function move(delta){if(!active())return;const v=view;if(v.failed.size===v.frames.length)return;let next=v.index;do{next=(next+delta+v.frames.length)%v.frames.length;}while(v.failed.has(next));v.index=next;onFrameChange(v.id,next);draw();}
 function open(id,index=0){const c=getCover(id);if(!c)return;const frames=c.frames?.length?c.frames:c.src?[c]:[];if(!frames.length)return;view={id,cover:structuredClone(c),frames:structuredClone(frames),index:Math.max(0,Math.min(index,frames.length-1)),failed:new Set()};draw();document.querySelector('[data-cover-lightbox="next"]')?.focus({preventScroll:true});}
 function handleClick(button){const action=button?.dataset?.coverLightbox;if(!action)return false;if(action==='prev')move(-1);else if(action==='next')move(1);document.querySelector(`[data-cover-lightbox="${action}"]`)?.focus({preventScroll:true});return true;}
 dialog.addEventListener('keydown',e=>{if(!active()||!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.matches('input,textarea,select'))return;e.preventDefault();e.stopPropagation();const action=e.key==='ArrowLeft'?'prev':'next';move(e.key==='ArrowLeft'?-1:1);document.querySelector(`[data-cover-lightbox="${action}"]`)?.focus({preventScroll:true});});
 // Reusing the shared dialog for another task must stop this viewer's state.
 new MutationObserver(()=>{if(view&&!document.querySelector('.cover-lightbox'))view=null;}).observe(document.querySelector('#modal-body'),{childList:true});
 return {open,handleClick,isOpen:active};
}
