import {PROMPT_SYSTEM,STORYBOARD_SYSTEM,parseStoryboard,storyboardRows} from './storyboard-text.js';
import {createReferenceVideoUI} from './reference-video-ui.js';
import {createReferenceVideoStore,isReferenceVideo,REFERENCE_VIDEO_ROLE} from './reference-video-store.js';
import {buildProductionMarkdown, describeSubject} from './production-markdown.js';
import {createApiSettings} from './api-settings.js';
import {createCaseGallery} from './case-gallery.js';
import {createReferenceLibrary} from './reference-library.js';
import {createReferencePicker} from './reference-picker.js';
import {createCoverLightbox} from './cover-lightbox.js';
import {renderComposerStyleCards} from './composer-style-cards.js';
import {readStyleSelections,caseStyleSelection,withStyleSelection} from './style-selection.js';
const icons={workspace:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',projects:'<path d="M3 7h6l2 2h10v11H3z"/><path d="M3 7V4h7l2 3h7v2"/>',assets:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',agents:'<rect x="7" y="7" width="10" height="10" rx="3"/><path d="M12 3v4m0 10v4M3 12h4m10 0h4"/><path d="M10 11h.01M14 11h.01M10 14h4"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',warn:'<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',check:'<path d="m5 12 4 4L19 6"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',film:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4"/>'};
const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]||icons.workspace}</svg>`;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='frame-workbench-v1';
const seed={id:'coast',title:'海岸，从容而行',category:'汽车展示短片',duration:'15',ratio:'9:16',model:'即梦 Seedance 2.5',goal:'突出青绿车身造型与从容巡航的氛围，严格保留产品图的硬顶与外观。',sceneText:'暖光海岸公路 · 金褐岩草 · 青蓝灰海天',identity:['固定深色硬顶','青绿车身本色','原图灯组与格栅','深色多辐轮毂'],product:'assets/product.jpg',scene:'assets/scene.jpg',productName:'产品身份参考.jpg',sceneName:'场景风格参考.jpg',refReview:'conflict',prompt:'',sampleFailed:true,created:'2026.11.03'};
let data;try{data=JSON.parse(localStorage.getItem(KEY));if(!data?.projects?.length)throw Error();}catch{data={projects:[structuredClone(seed)],active:'coast'};}
let route=['workspace','projects','assets'].includes(location.hash.slice(1))?location.hash.slice(1):'workspace';let tab='refs',styleFilter='director',styleQuery='',stylePage=1,inspectedStyleId=null,paramsExpanded=true,uploadRole='product',timer,saveError=false;
const project=()=>data.projects.find(p=>p.id===data.active)||data.projects[0];
function creativeBrief(p=project()){
 const selections=styleSelections(p),labels={lighting:'光线',palette:'配色',composition:'构图',camera:'镜头',rhythm:'节奏'};
 const styles=['director','film'].map(group=>{const look=selections[group],label=group==='director'?'导演风格':'电影风格';if(!look)return label+'：未选择';return [label+'：'+(look.name||look.title||look.id),...Object.entries(labels).filter(([key])=>look.parameters?.[key]).map(([key,label])=>'  '+label+'：'+look.parameters[key])].join('\n');});
 return ['创作目标：'+(p.goal||'待补充'),'场景方向：'+(p.sceneText||'待补充'),'外观约束：'+(p.identity?.join('；')||'待补充'),'制作规格：'+(p.duration?p.duration+' 秒':'时长待定')+' · '+(p.ratio||'比例待定'),'目标制作平台：'+(p.model||'待定'),'参考职责：图1只决定唯一产品身份、轮廓、结构与外观；图2只控制空间、光线、环境材质与配色，不继承另一主体。','素材状态：产品参考'+(p.product?'已选':'缺失')+'；场景参考'+(p.scene?'已选':'缺失')+'。本次仅载入文字，不发送图片或视频。',...styles,...referenceVideoBrief(p),'引用检查：'+({conflict:'存在竞争主体，需处理',clear:'已记录人工职责检查，仍需核对', 'needs-review':'待人工检查'}[p.refReview]||'待检查'),'历史产物：'+(p.sampleFailed?'历史样片产品身份未通过，失败记录继续保留。':'未提供已验收产物。'),'审查边界：本次为提示词草稿，方案审查及实际产物独立质检未因生成而通过；产品身份与外观约束优先于风格。'].join('\n');
}
const apiSettings=createApiSettings({getBrief:creativeBrief});
document.querySelector('#open-api-settings').addEventListener('click',()=>apiSettings.open());
document.querySelector('#api-dialog').addEventListener('close',()=>{
  if(route==='workspace'&&['prompt','story'].includes(tab)){
    const tools=document.querySelector('.stage-generation-tools');
    if(tools)tools.outerHTML=generationControls(project(),tab);
  }
});
const referenceLibrary=createReferenceLibrary({escape,icon,modal,toast,onChange:()=>{if(route==='assets')render();}});
const referencePicker=createReferencePicker({escape,modal,toast,getProject:()=>structuredClone(project()),onApply:applyReferenceSelection});
const referenceVideoStore = createReferenceVideoStore();
const referenceVideos = new Map();
const referenceVideoInput = document.querySelector('#reference-video-input');
let referenceVideoPickingFor = null;
let referenceVideoImportFor = null;
let referenceVideoBusy = false;
const referenceVideoUI = createReferenceVideoUI({
  escape,
  onImport: openReferenceVideoImport,
  onSelect: selectReferenceVideo,
  onRemove: confirmRemoveReferenceVideo,
  onClear: clearReferenceVideo
});

function referenceVideoMetadata(p){
  const asset=referenceVideos.get(p.referenceVideoId);
  if(!asset)return null;
  const {name,type,size,createdAt}=asset;
  return {name,type,size,createdAt};
}
function referenceVideoBrief(p){
  const video=referenceVideoMetadata(p);
  if(!video)return [];
  return [`参考视频名称：${video.name}。职责：${REFERENCE_VIDEO_ROLE} 视频内容未传给模型，请勿推测其镜头。`];
}
function renderProjectReferenceVideo(){
  return referenceVideoUI.composer({asset:referenceVideos.get(project().referenceVideoId)});
}
function renderLibraryReferenceVideos({includeBack=true}={}){
  const assets=[...referenceVideos.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const picker=referenceVideoPickingFor===project().id;
  const back=includeBack&&picker?'<button type="button" class="button small" data-action="back-reference-video">返回创意工作台</button>':'';
  return back+referenceVideoUI.library({assets,selectedId:project().referenceVideoId});
}
function refreshReferenceVideoSections(){
  const composer=document.querySelector('#project-reference-video');
  const library=document.querySelector('#reference-video-library');
  if(composer)composer.outerHTML=renderProjectReferenceVideo();
  if(library)library.outerHTML=renderLibraryReferenceVideos({includeBack:false});
}
async function loadReferenceVideos(){
  try{
    const assets=await referenceVideoStore.list();
    for(const asset of assets){
      if(!referenceVideos.has(asset.id))addReferenceVideoPreview(asset);
    }
    refreshReferenceVideoSections();
  }catch{
    // Other workbench functions remain available if local media storage is disabled.
  }
}
function addReferenceVideoPreview({blob,...asset}){
  referenceVideos.set(asset.id,{...asset,url:URL.createObjectURL(blob)});
}
function saveReferenceVideoAssociation(projectId, assetId){
  const next=structuredClone(data);
  const p=next.projects.find(item=>item.id===projectId);
  if(!p)return false;
  if(assetId)p.referenceVideoId=assetId;
  else delete p.referenceVideoId;
  p.localEdits=true;
  p.planReview={...p.planReview,status:'pending'};
  return commitProjectData(next,'浏览器存储空间不足，未保存参考视频关联');
}
function openReferenceVideoLibrary(){
  referenceVideoPickingFor=project().id;
  route='assets';
  location.hash='assets';
  referenceLibrary.handleClick({dataset:{refAction:'tab',refTab:'videos'}});
  const section=document.querySelector('#reference-video-library');
  section?.focus();
}
function openReferenceVideoImport(){
  if(referenceVideoBusy){toast('视频正在导入，请稍候');return;}
  referenceVideoImportFor=route==='workspace'?project().id:referenceVideoPickingFor;
  referenceVideoInput.value='';
  referenceVideoInput.click();
}
referenceVideoInput.addEventListener('change',async()=>{
  const file=referenceVideoInput.files[0];
  const targetId=referenceVideoImportFor;
  if(!file||referenceVideoBusy)return;
  if(!isReferenceVideo(file)){toast('请选择有效的本地视频文件');return;}
  referenceVideoBusy=true;
  toast('正在保存参考视频');
  try{
    const asset={id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,createdAt:new Date().toISOString(),blob:file};
    await referenceVideoStore.put(asset);
    addReferenceVideoPreview(asset);
    const applied=targetId&&saveReferenceVideoAssociation(targetId,asset.id);
    if(applied&&referenceVideoPickingFor===targetId&&route==='assets'&&project().id===targetId){
      returnToVideoComposer();
    } else {
      refreshReferenceVideoSections();
      syncSummary();
    }
    toast(applied?'视频已入库并关联项目':'视频已存入参考素材库');
  }catch{
    toast('参考视频未能保存，请检查浏览器存储空间，或选用较小的文件');
  }finally{
    referenceVideoBusy=false;
    referenceVideoImportFor=null;
  }
});
function returnToVideoComposer(){
  referenceVideoPickingFor=null;
  route='workspace';
  tab='refs';
  location.hash='workspace';
  render();
  document.querySelector('#project-reference-video [data-action="choose-reference-video"]')?.focus();
}
function selectReferenceVideo(id){
  if(!referenceVideos.has(id)){toast('素材已不可用，请重新导入');return;}
  const projectId=project().id;
  if(!saveReferenceVideoAssociation(projectId,id))return;
  if(referenceVideoPickingFor===projectId)returnToVideoComposer();
  else refreshReferenceVideoSections();
  toast('已设为当前项目参考视频');
}
function clearReferenceVideo(){
  if(!saveReferenceVideoAssociation(project().id,null))return;
  refreshReferenceVideoSections();
  syncSummary();
  toast('已取消项目关联，视频仍在参考素材库');
}
function confirmRemoveReferenceVideo(id){
  const asset=referenceVideos.get(id);
  if(!asset||referenceVideoBusy)return;
  const projectsUsing=data.projects.filter(p=>p.referenceVideoId===id).length;
  modal('从参考素材库删除视频',`<p class="dialog-copy">删除「${escape(asset.name)}」的浏览器副本。${projectsUsing?`这会取消 ${projectsUsing} 个项目的关联。`:''}</p><div class="dialog-actions"><button class="button" data-action="close-modal">取消</button><button class="button primary" data-action="remove-reference-video" data-video-id="${escape(id)}">删除视频</button></div>`);
}
async function removeReferenceVideo(id){
  const asset=referenceVideos.get(id);
  if(!asset||referenceVideoBusy)return;
  referenceVideoBusy=true;
  try{
    await referenceVideoStore.remove(id);
    referenceVideos.delete(id);
    URL.revokeObjectURL(asset.url);
    const next=structuredClone(data);
    let changed=false;
    for(const p of next.projects){
      if(p.referenceVideoId!==id)continue;
      delete p.referenceVideoId;
      p.localEdits=true;
      p.planReview={...p.planReview,status:'pending'};
      changed=true;
    }
    const saved=!changed||commitProjectData(next,'视频已删除，但未能保存项目关联更新');
    closeModal();
    refreshReferenceVideoSections();
    syncSummary();
    if(saved)toast('参考视频已从素材库删除');
  }catch{
    toast('无法删除参考视频，请重试');
  }finally{
    referenceVideoBusy=false;
  }
}

function commitProjectData(next,errorText='存储空间不足，参考图未替换；请先导出备份再重试'){
 try{localStorage.setItem(KEY,JSON.stringify(next));}catch{toast(errorText);return false;}
 data=next;saveError=false;document.querySelector('#save-state').textContent='已保存到此浏览器';document.querySelector('#save-state').dataset.state='saved';return true;
}
function invalidateReferenceChecks(p,role){
 const now=new Date().toISOString(),revision=(p.referenceRevision||0)+1;
 p.referenceReviewHistory=[...(p.referenceReviewHistory||[]),{referenceRevision:p.referenceRevision||0,refReview:p.refReview,identityReview:p.identityReview,planReview:p.planReview,reviewRequest:p.reviewRequest,changedRole:role,changedAt:now}].slice(-20);
 p.referenceRevision=revision;p.refReview='needs-review';p.referenceChanged=true;p.localEdits=true;
 p.identityReview={status:'pending',referenceRevision:revision,reason:role==='product'?'产品身份参考已替换，原约束需逐项重核':'场景参考已替换，需重核环境是否干扰产品外观',requestedAt:now};
 p.planReview={...(p.planReview||{}),status:'pending',referenceRevision:revision,requestedAt:now};
 p.reviewRequest={id:crypto.randomUUID(),status:'pending',execution:'not-connected',scopes:['reference','identity','plan'],referenceRevision:revision,changedRole:role,requestedAt:now};
}
async function applyReferenceSelection({projectId,role,expectedSource,referenceUrl,source}){
 const current=project();if(current.id!==projectId||!['product','scene'].includes(role)||(current[role]||'')!==expectedSource){toast('项目或目标参考已变化，请重新选择并确认');return false;}
 try{const u=new URL(referenceUrl);if(u.protocol!=='https:'||u.hostname!=='i.pinimg.com'||u.username||u.password||u.port||source?.provider!=='Pinterest'||source.imageUrl!==referenceUrl||!/^https:\/\/www\.pinterest\.com\/pin\/\d+\/?$/.test(source.pinUrl))throw Error();}catch{toast('图片来源无效，未替换参考');return false;}
 const next=structuredClone(data),p=next.projects.find(x=>x.id===projectId);
 p[role]=referenceUrl;p[role+'Name']='Pinterest · '+(source.title||new URL(source.pinUrl).pathname.split('/').filter(Boolean).pop());
 p.referenceSources={...(p.referenceSources||{}),[role]:{...source,selectedAt:new Date().toISOString(),savedAs:'remote-url'}};
 invalidateReferenceChecks(p,role);if(!commitProjectData(next))return false;
 render();toast((role==='product'?'产品':'场景')+'参考已替换；外观约束与独立质检已转待复核');return true;
}
function referenceRecheckView(){const p=project();if(!p.reviewRequest)return '';return `<section class="reference-recheck callout" aria-label="参考替换后的复核任务"><strong>参考已更新 · 第 ${p.referenceRevision} 版待复核</strong><p>输入职责：${p.refReview==='clear'?'人工已记录':'待核对'} · 外观约束：${p.identityReview?.status==='checked'?'人工已记录':'待重新核对'} · 方案：待独立审查</p><p>独立质检任务已在本地登记，未连接智能体调度，尚未执行。历史分镜、提示词及样片退回结论保留。</p><div class="ref-actions"><button class="button small" data-action="review-identity">核对外观约束</button><button class="button small" data-action="open-reference-review">查看独立质检</button></div></section>`;}
function reviewIdentity(){const p=project();modal('重新核对外观约束',`<p class="dialog-copy">请对照当前双图检查旧约束是否仍然适用；需要改动时先返回工作台编辑。记录仅代表人工外观核对，不代替独立方案审查。</p><div class="review-grid">${['product','scene'].map(role=>`<article class="review-image">${p[role]?`<img src="${escape(p[role])}" alt="当前${role==='product'?'产品':'场景'}参考">`:''}<div>${role==='product'?'产品身份':'仅场景环境'}</div></article>`).join('')}</div><p class="dialog-copy">${escape(p.identity.join('、')||'尚未定义约束，请先添加')}</p><label class="check-chip"><input id="identity-reviewed" type="checkbox">我已逐项对照当前参考核对外观约束</label><div class="dialog-actions"><button class="button" data-action="close-modal">返回编辑</button><button class="button primary" data-action="save-identity-review" data-project-id="${escape(p.id)}" data-reference-revision="${p.referenceRevision||0}">记录人工核对</button></div>`);}

function save(){try{localStorage.setItem(KEY,JSON.stringify(data));document.querySelector('#save-state').textContent='已保存到此浏览器';document.querySelector('#save-state').dataset.state='saved';saveError=false;}catch{document.querySelector('#save-state').textContent='本次修改未保存 · 请导出备份';document.querySelector('#save-state').dataset.state='error';if(!saveError)toast('浏览器存储已满，请导出制作包备份');saveError=true;}}
function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),3000);}
const navs=[['workspace','创作工作台'],['projects','全部项目'],['assets','参考素材']];
const agents=[['设','视觉设计总监','video_design','产品 · 场景 · 色彩','锁定产品事实和参考职责，整合场景、色彩，以及按需启用的角色服装与 UI 设计。','对产品身份与参考冲突负责','green'],['导','导演与镜头','video_director','创意 · 摄影 · 剪辑','将设计约束转为分镜、机位、动作、剪辑节奏和平台提示词，按需设计视效与二维包装。','对镜头组织与提示词转译负责','blue'],['制','制作执行','video_producer','配置 · 报价 · 归档','在授权范围内准备素材关联、参数与报价，执行制作、恢复和后期交付，记录真实状态。','对配置、引用与运行事实负责','gold'],['检','独立质检','video_reviewer','参考 · 关键词 · 画面','独立检查输入冲突、关键词和实际画面。看得到的给结论，看不清的记录为未验证。','对审阅证据与验收结论负责',''],['界','UI设计师','ui_designer','Taste Skill · Impeccable','结合视觉方向与交互评审，完成界面设计、前端实现和作者自检；独立审阅另行执行。','对界面实现与自检证据负责','blue']];
const looks=[
 {id:'coast',name:'暖光海岸',group:'live',tag:'实拍展示',tone:'琥珀暖光 / 青蓝海天',description:'低角度暖阳勾勒主体，金褐岩草与青蓝海天形成层次。节奏平稳，留出完整认形时间。',colors:['#e8bc82','#72b2b2','#315b63']},
 {id:'architecture',name:'冷调建筑',group:'live',tag:'实拍展示',tone:'冷灰空间 / 硬质光影',description:'以建筑线条组织空间，冷灰背景衬托产品本色，运镜保持克制。',colors:['#c0d2d9','#8399a7','#3d5366']},
 {id:'soft',name:'自然柔光',group:'live',tag:'实拍展示',tone:'漫射日光 / 低饱和绿',description:'用柔和日光表现材质与曲面，背景简洁，避免环境色覆盖产品本色。',colors:['#e5ddc5','#aab8a2','#4e7060']},
 {id:'type',name:'弹性字体',group:'graphic',tag:'图形叙事',tone:'大字构图 / 弹性节奏',description:'文字以弹性入场和清晰停顿建立节拍。作为包装提案，不改变产品身份或既有分镜。',colors:['#d4d0ed','#8c80c0','#5c4c87']},
 {id:'geometry',name:'几何节拍',group:'graphic',tag:'图形叙事',tone:'几何图形 / 秩序切换',description:'用圆、线和色块建立构图，通过错位与对齐产生节奏。产品展示段仍保留真实外观。',colors:['#f4ca95','#de9062','#704d5c']},
 {id:'editorial',name:'图解叙事',group:'graphic',tag:'图形叙事',tone:'信息分层 / 渐次揭示',description:'标题、图示和说明按阅读顺序出现，一次表达一个重点；不补造产品数据。',colors:['#d6dfd7','#78a49b','#2c6263']}
];
const paramLabels={lighting:'光线',palette:'配色',composition:'构图',camera:'镜头',rhythm:'节奏'};
const localParameters={
 coast:{lighting:'低角度暖阳勾勒车身曲面，保留暗面细节。',palette:'环境以金褐与青蓝为主，产品本色继续由图1控制。',composition:'完整车身与硬顶优先可读，以道路纵深组织环境。',camera:'前侧三分之四稳定随行；避免视角突变遮住辨识结构。',rhythm:'从容巡航，留出完整认形和结尾稳定时间；沿用已确认项目时长。'},
 architecture:{lighting:'以建筑遮挡形成明确侧光，控制硬质表面的反射。',palette:'环境冷灰、蓝灰，保留产品原有颜色。',composition:'建筑线条与留白组织空间，主体结构优先可读。',camera:'稳定机位或克制平移，用视差表现空间。',rhythm:'以清晰停顿和缓慢变化组织展示，不自动改变镜头数。'},
 soft:{lighting:'漫射日光呈现材质，避免硬阴影遮住细节。',palette:'低饱和自然环境色，保持产品本色。',composition:'简洁背景与适量留白，主体轮廓清晰。',camera:'平稳接近或固定观察，焦点落在关键材质。',rhythm:'舒缓、可读，以材质细节的出现决定停留。'},
 type:{lighting:'文字与底色保持可辨对比，产品段光线独立处理。',palette:'文字包装使用紫灰与浅底，不改变产品本色。',composition:'大字形成层级，避免遮住产品辨识结构。',camera:'包装层以二维位移与缩放为主，不自动改变产品机位。',rhythm:'弹性入场后清晰停顿；只是包装提案，不改写已有分镜。'},
 geometry:{lighting:'平面图形使用清晰明暗层级。',palette:'橙、米黄与深灰紫作为包装示意色。',composition:'圆、线、色块通过对齐与错位组织画面。',camera:'二维图形运动为主，产品段保持其真实结构。',rhythm:'按图形变化形成节拍，不默认替换当前剪辑。'},
 editorial:{lighting:'以可读性为主，说明图和产品受光分别处理。',palette:'浅底、青绿与深色文字建立信息主次。',composition:'标题、图示与说明分层，避免同屏堆叠。',camera:'固定阅读视角，必要时局部推近。',rhythm:'一次揭示一个重点，停留时间服从阅读。'}
};
for(const look of looks){look.parameters=localParameters[look.id];look.source={repository:'FRAME 本地提案',path:'workbench/app.js',license:'local-project'};look.notes='本地界面提案，色块是方向示意；不代表新生成画面或成片验收。';}
const catalogStatus={director:'loading',film:'loading'};
const catalogFiles={director:'data/director-styles.json',film:'data/film-styles.json'};
const catalogSources={};
const filmCovers={},directorCovers={};
const coverPositions=new Map();
const coverLightbox=createCoverLightbox({escape,modal,getCover:id=>directorCovers[id]||(filmCovers[id]?{...filmCovers[id],director:findLook(id)?.director||findLook(id)?.directorEn||'电影画面参考'}:null),onFrameChange:setCoverFrame});
const coverMotionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
let coverPaused=coverMotionPreference.matches;
function coverFrames(cover){return cover?.frames?.length?cover.frames:cover?.src?[cover]:[];}
function setCoverFrame(id,index){
 const box=document.querySelector(`[data-cover-id="${CSS.escape(id)}"]`);if(!box)return;
 const imgs=[...box.querySelectorAll('.film-cover-image')];if(!imgs.length)return;
 let next=(index+imgs.length)%imgs.length;for(let n=0;n<imgs.length&&imgs[next].dataset.failed;n++)next=(next+1)%imgs.length;
 if(imgs[next].dataset.failed){box.classList.add('unavailable');return;}
 coverPositions.set(id,next);imgs.forEach((img,i)=>{img.classList.toggle('active',i===next);img.setAttribute('aria-hidden',String(i!==next));});
 box.classList.toggle('loaded',imgs[next].complete&&imgs[next].naturalWidth>0);box.classList.remove('unavailable');
 box.querySelector('.film-cover-label').textContent=`${box.dataset.coverCaption||'剧照轮播'} · ${next+1}/${imgs.length}`;
 box.closest('.look-card')?.querySelectorAll('[data-cover-goto]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.coverFrame)===next)));
}
function coverControls(look){const frames=coverFrames((look.group==='director'?directorCovers:filmCovers)[look.id]);if(!['director','film'].includes(look.group)||frames.length<2)return '';const index=coverPositions.get(look.id)||0;return `<div class="cover-controls" role="group" aria-label="${escape(look.name)}剧照轮播"><button data-cover-step="${escape(look.id)}" data-delta="-1" aria-label="上一张${escape(look.name)}剧照">‹</button><span>${frames.map((_,i)=>`<button data-cover-goto="${escape(look.id)}" data-cover-frame="${i}" aria-label="查看${escape(look.name)}第${i+1}张剧照" aria-pressed="${index===i}"></button>`).join('')}</span><button data-cover-step="${escape(look.id)}" data-delta="1" aria-label="下一张${escape(look.name)}剧照">›</button></div>`;}
function syncCoverPause(){document.querySelectorAll('[data-action="toggle-cover-playback"]').forEach(b=>{b.textContent=coverMotionPreference.matches?'已减少动态':coverPaused?'播放轮播':'暂停轮播';b.disabled=coverMotionPreference.matches;b.setAttribute('aria-pressed',String(coverPaused));});}
coverMotionPreference.addEventListener('change',()=>{if(coverMotionPreference.matches)coverPaused=true;syncCoverPause();});

async function loadDirectorCovers(){try{const r=await fetch('data/director-covers.json');if(!r.ok)throw Error();const d=await r.json();if(d.version!==1||!d.covers)throw Error();Object.assign(directorCovers,d.covers);refreshStyles();}catch{refreshStyles();}}
function directorCover(look){const c=directorCovers[look.id],available=c?.status==='available',frames=coverFrames(c),index=Math.min(coverPositions.get(look.id)||0,Math.max(0,frames.length-1)),caption=`代表作 · ${c?.title||''} ${c?.year||''}`;return `<span class="film-cover-visual director-cover-visual ${available?'':'unavailable'}" data-cover-id="${escape(look.id)}" data-cover-caption="${escape(caption)}"><span class="film-cover-placeholder">${available?'封面载入中':'暂无可用剧照'}<small>${escape(c?.title||look.director||look.name)}</small></span>${available?frames.map((f,i)=>`<img class="film-cover-image ${i===index?'active':''}" data-frame-index="${i}" aria-hidden="${i!==index}" src="${escape(f.src)}" alt="${escape(look.director)}代表作《${escape(c.title)}》（${c.year}）第${i+1}张剧照" loading="lazy" decoding="async">`).join(''):''}<span class="film-cover-label">${escape(caption)} · ${index+1}/${frames.length}</span></span>`;}
function styleCard(look,p){const director=look.group==='director',body=`<span class="look-card-body"><span class="look-category">${escape(look.tag)}</span><strong>${escape(look.name)}<span class="look-check">${isStyleSelected(look,p)?'✓':'↗'}</span></strong><small>${escape(look.tone)}</small></span>`,inspect=`<button class="look-inspect" data-inspect-look="${escape(look.id)}" aria-label="展开${escape(look.name)}的风格参数">展开参数 <span>＋</span></button>`;return `<article class="look-card ${isStyleSelected(look,p)?'selected':''}"><button class="look-select director-cover-button" ${director?'data-director-zoom':'data-film-zoom'}="${escape(look.id)}" aria-haspopup="dialog" aria-label="放大查看${escape(director?directorCovers[look.id]?.title||look.name:look.name)}剧照">${lookArt(look)}<span class="director-zoom-hint">放大 ↗</span></button><button class="director-method-choice" data-apply-look="${escape(look.id)}" aria-pressed="${isStyleSelected(look,p)}" aria-label="将${escape(look.name)}加入${director?'导演':'电影'}风格">${body}</button>${coverControls(look)}<div class="director-card-actions">${inspect}<button class="director-use" data-look="${escape(look.id)}" aria-pressed="${isStyleSelected(look,p)}">${isStyleSelected(look,p)?'已选用':'选用风格'}</button></div>${coverSource(look)}</article>`;}

function coverSource(look){const c=(look.group==='director'?directorCovers:filmCovers)[look.id];return c?.sourceUrl?`<a class="film-cover-source" href="${escape(c.sourceUrl)}" target="_blank" rel="noopener noreferrer">${look.group==='director'?'《'+escape(c.title)+'》 · ':''}剧照来源 · ${escape(c.source||'Film-Grab')} ↗</a>`:'';}
async function loadFilmCovers(){try{const r=await fetch('data/film-covers.json');if(!r.ok)throw Error();const d=await r.json();if(d.version!==1||!d.covers)throw Error();Object.assign(filmCovers,d.covers);refreshStyles();}catch{refreshStyles();}}
const styleViews={director:{query:'',page:1,mode:'cases',inspected:null,scroll:0},film:{query:'',page:1,mode:'cases',inspected:null,scroll:0}};
let styleBrowserMode='cases',styleBrowserTrigger='director';
const styleBrowser=()=>document.querySelector('#style-browser');
function rememberStyleView(){Object.assign(styleViews[styleFilter],{query:styleQuery,page:stylePage,mode:styleBrowserMode,inspected:inspectedStyleId,scroll:document.querySelector('#style-browser-content')?.scrollTop||0});}
function closeStyleBrowser(){if(!styleBrowser().open)return;rememberStyleView();styleBrowser().close();}
function finishStyleChoice(group){styleBrowserTrigger=group;closeStyleBrowser();revealStyleChoice(group);}
const gallery=createCaseGallery({escape,icon,onChange:reason=>{refreshStyles();if(reason==='case')document.querySelector('.case-hero')?.classList.add('case-enter');}});
const selectedLook=(p=project())=>p.styleSnapshot?.id===p.styleId?p.styleSnapshot:looks.find(x=>x.id===p.styleId);
const findLook=id=>looks.find(x=>x.id===id)||Object.values(styleSelections()).find(x=>x?.id===id)||(selectedLook()?.id===id?selectedLook():null);
function snapshotLook(look){if(!look)return null;const snapshot=structuredClone(look),upstream=catalogSources[look.group];if(upstream?.licenseText&&look.selectionKind!=='case')snapshot.source={...snapshot.source,licenseText:upstream.licenseText};return snapshot;}
function styleSelections(p=project()){return readStyleSelections(p,id=>looks.find(x=>x.id===id));}
function selectedFor(group,p=project()){return styleSelections(p)[group];}
function isStyleSelected(look,p=project()){return selectedFor(look.group,p)?.id===look.id;}
function selectedStyleList(p=project()){const items=Object.values(styleSelections(p)).filter(Boolean);return items.length?items:selectedLook(p)?[selectedLook(p)]:[];}
function composerStyleCards(){const selections={};for(const [group,value] of Object.entries(styleSelections())){if(!value){selections[group]=null;continue;}let cover=(group==='director'?directorCovers:filmCovers)[value.id];if(!cover&&value.selectionKind==='case')cover=[...Object.values(filmCovers),...Object.values(directorCovers)].find(x=>x.title===value.title&&String(x.year)===String(value.year));selections[group]={...value,coverSrc:cover?.frames?.[0]?.src||cover?.src,coverTitle:value.selectionKind==='case'?value.title:cover?.title,coverYear:value.selectionKind==='case'?value.year:cover?.year};}return renderComposerStyleCards({escape,icon,selections,covers:{director:directorCovers,film:filmCovers},status:catalogStatus});}
function refreshComposerStyles(){const old=document.querySelector('.composer-style-slots');if(old)old.outerHTML=composerStyleCards();}
function saveStyleChoice(group,selection){const next=structuredClone(data),index=next.projects.findIndex(x=>x.id===data.active);next.projects[index]=withStyleSelection(next.projects[index],group,selection,id=>looks.find(x=>x.id===id));if(!commitProjectData(next,'存储空间不足，风格未更新；请先导出备份再重试')){const feedback=document.querySelector('#style-browser-feedback');feedback.textContent='存储空间不足，未选用成功。请先导出备份后重试。';feedback.classList.add('is-error');return false;}inspectedStyleId=selection?.id||null;paramsExpanded=true;refreshStyles();syncSummary();return true;}
function revealStyleChoice(group){const card=document.querySelector(`[data-style-slot="${group}"]`);card?.scrollIntoView({behavior:coverMotionPreference.matches?'auto':'smooth',block:'center'});card?.focus({preventScroll:true});}
function applyCaseChoice(id){const c=gallery.find(id);if(!c)return false;if(c.styleIds?.some(x=>x.startsWith(c.group+'-'))&&catalogStatus[c.group]!=='ready'){toast('参数资料尚未载入，请重试载入后再选择');return false;}const selection=caseStyleSelection(c,findLook,snapshotLook);if(!saveStyleChoice(c.group,selection))return false;gallery.select(c.id);finishStyleChoice(c.group);toast('已加入顶部'+(c.group==='director'?'导演风格':'电影风格')+'卡片，方案待复核');return true;}
function browseStyleSlot(group){
 if(!['director','film'].includes(group))return;
 if(styleBrowser().open)rememberStyleView();
 styleBrowserTrigger=group;styleFilter=group;
 const view=styleViews[group];styleQuery=view.query;stylePage=view.page;styleBrowserMode=view.mode;inspectedStyleId=view.inspected||null;
 document.querySelector('#style-browser-feedback').textContent='浏览不会保存 · 明确选用后回填';document.querySelector('#style-browser-feedback').classList.remove('is-error');refreshStyles();styleBrowser().showModal();document.body.classList.add('style-browser-open');
 document.querySelector('#style-browser-content').scrollTop=view.scroll;
 document.querySelector(`#style-tab-${group}`)?.focus({preventScroll:true});
}
function refreshStyles(animate=false,previous=styleFilter){
 refreshComposerStyles();
 const host=document.querySelector('#style-browser-content');if(!host)return;
 // Keep the secondary page, cursor and browsing position while asynchronous catalogs arrive.
 const active=document.activeElement,inside=host.contains(active),search=active?.id==='style-search';
 const selection=search?active.selectionStart:0,scroll=host.scrollTop;
 const focusKey=inside&&!search?[...active.attributes].find(x=>x.name.startsWith('data-')&&x.value):null;
 host.innerHTML=looksView();host.scrollTop=scroll;
 if(animate){document.querySelector('.cinema-tabs')?.classList.add('switching');}
 if(search){const input=document.querySelector('#style-search');input?.focus({preventScroll:true});input?.setSelectionRange(selection,selection);}
 else if(focusKey&&styleBrowser().open&&!document.querySelector('#modal').open)host.querySelector(`[${focusKey.name}="${CSS.escape(focusKey.value)}"]`)?.focus({preventScroll:true});
}
async function loadStyleCatalogs(){
 const pending=Object.keys(catalogFiles).filter(k=>catalogStatus[k]!=='ready'&&catalogStatus[k]!=='fetching');
 await Promise.allSettled(pending.map(async group=>{
  catalogStatus[group]='fetching';refreshStyles();
  try{
   const response=await fetch(catalogFiles[group]);if(!response.ok)throw Error('HTTP '+response.status);
   const body=await response.json();if(body.version!==1||!Array.isArray(body.styles)||!body.styles.length)throw Error('Invalid catalog');
   const ids=new Set();for(const style of body.styles){if(typeof style.id!=='string'||ids.has(style.id)||style.group!==group||!style.source?.url||!style.parameters||!Object.keys(paramLabels).every(k=>typeof style.parameters[k]==='string'&&style.parameters[k])||!Array.isArray(style.colors)||!style.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw Error('Invalid style');ids.add(style.id);}
   for(const style of body.styles){const existing=looks.findIndex(x=>x.id===style.id);if(existing>=0)looks[existing]=style;else looks.push(style);}
   catalogSources[group]=body.source;catalogStatus[group]='ready';
  }catch(error){catalogStatus[group]='error';}
  refreshStyles();
 }));
}
function styleParametersView(look,compact=false){
 if(!look?.parameters)return '<p class="rail-copy">这份风格记录没有参数快照，请重新选择已载入的风格。</p>';
 return `<dl class="style-parameters ${compact?'compact':''}">${Object.entries(paramLabels).map(([key,label],i)=>`<div><dt><span>0${i+1}</span>${label}</dt><dd>${escape(look.parameters[key]||'来源未提供')}</dd></div>`).join('')}</dl>`;
}
function styleSourceView(look){const source=look.source||{};return `<div class="style-provenance"><span>${escape(source.repository||'本地提案')}${source.skillVersion?' · '+escape(source.skillVersion):''}${source.revision?' · '+escape(source.revision.slice(0,8)):''}</span>${source.url?.startsWith('https://')?`<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a>`:'<span>本地设计提案</span>'}</div><p class="style-source-note">${escape(look.notes||'风格资料仅作设计提案，不代表生成效果。')}</p>`;}
function styleInspector(look){if(!look)return '';return `<section class="style-inspector" aria-label="风格参数详情"><div class="inspector-heading"><div><span class="inspector-kicker">${isStyleSelected(look)?'当前视觉提案':'浏览风格 · 尚未选用'}</span><h3 id="style-detail-title" tabindex="-1">${escape(look.name)}</h3></div><div><button class="text-button" data-action="toggle-parameters" aria-expanded="${paramsExpanded}" aria-controls="style-parameter-body">${paramsExpanded?'收起参数 −':'展开参数 ＋'}</button>${!isStyleSelected(look)?`<button class="button primary small" data-look="${escape(look.id)}">选用此风格</button>`:''}</div></div><p class="inspector-description">${escape(look.description)}</p><div id="style-parameter-body" ${paramsExpanded?'':'hidden'}>${styleParametersView(look)}<div class="palette-strip" aria-label="风格参考配色">${(look.paletteSwatches||look.colors.map((hex,i)=>({hex,name:'示意色 '+(i+1)}))).map(c=>`<span><i style="background:${escape(c.hex)}"></i><small>${escape(c.name)} ${escape(c.hex)}</small></span>`).join('')}</div>${styleSourceView(look)}<div class="style-preservation">${icon('lock')} 风格仅影响视觉提案。图1身份、图2环境、外观约束和已确认分镜继续保留。</div></div></section>`;}

function markChanged(){const p=project();p.localEdits=true;if(p.planReview)p.planReview={...p.planReview,status:'pending'};save();}
function lookArt(look){if(look.group==='director')return directorCover(look);if(look.group==='film'){const cover=filmCovers[look.id],frames=coverFrames(cover),available=cover?.status==='available',index=Math.min(coverPositions.get(look.id)||0,Math.max(0,frames.length-1));return `<span class="film-cover-visual ${available?'':'unavailable'}" data-cover-id="${escape(look.id)}" data-cover-caption="${escape(look.name)} ${escape(look.year)}"><span class="film-cover-placeholder">${available?'封面载入中':'暂无可用封面'}<small>${escape(look.name)}</small></span>${available?frames.map((frame,i)=>`<img class="film-cover-image ${i===index?'active':''}" data-frame-index="${i}" aria-hidden="${i!==index}" src="${escape(frame.src)}" alt="${escape(look.name)}（${escape(look.year)}）第${i+1}张影片剧照" loading="lazy" decoding="async">`).join(''):''}<span class="film-cover-label">${escape(look.name)} ${escape(look.year)} · ${index+1}/${frames.length}</span></span>`;}return `<span class="look-art art-${look.id}" style="--look-a:${look.colors[0]};--look-b:${look.colors[1]};--look-c:${look.colors[2]}" aria-hidden="true"><i></i><b></b><em></em><span>${look.id==='type'?'Aa':look.id==='editorial'?'01':look.id==='geometry'?'◒':' '}</span></span>`;}

function identityView(){const p=project(),options=[...new Set([...(p.id==='coast'?seed.identity:['主体轮廓','产品本色','辨识结构','材质特征']),...p.identity])];return `<div class="panel context-panel identity-panel"><div class="panel-head"><h3>${icon('lock')} 外观约束</h3><span class="rail-kicker">产品图控制</span></div><p class="rail-copy">${p.identityReview?.status==='pending'?'参考已变化，以下旧约束暂作待核对条目。':'风格与场景变化时，以下特征继续保留。'}</p>${p.identityReview?.status==='pending'?'<span class="badge warn">外观约束待复核</span>':''}<div class="identity-options">${options.map(v=>`<label class="check-chip"><input type="checkbox" data-lock="${escape(v)}" ${p.identity.includes(v)?'checked':''}>${escape(v)}</label>`).join('')}</div>${p.identityReview?.status==='pending'?'<button class="text-button" data-action="review-identity">对照新参考核对 →</button>':''}<button class="text-button add-constraint" data-action="add-constraint">＋ 添加外观约束</button></div>`;}
function switchStyleTab(group){
 if(!['director','film'].includes(group)||group===styleFilter)return;
 const previous=styleFilter;rememberStyleView();styleFilter=group;
 const view=styleViews[group];styleQuery=view.query;stylePage=view.page;styleBrowserMode=view.mode;inspectedStyleId=view.inspected||null;
 refreshStyles(true,previous);document.querySelector('#style-browser-content').scrollTop=view.scroll;
 document.querySelector(`#style-tab-${group}`)?.focus({preventScroll:true});
}
function looksView(){
 const p=project(),legacyLook=selectedLook(),selected=selectedFor(styleFilter)||(!p.styleSelections&&legacyLook&&!['director','film'].includes(legacyLook.group)?legacyLook:null);
 const requested=findLook(inspectedStyleId),candidate=requested?.group===styleFilter?requested:selected;
 const inspected=candidate?.group===styleFilter?candidate:null;
 const legacy=selected&&!['director','film'].includes(selected.group);
 const ordered=looks.filter(x=>x.group===styleFilter);
 const query=styleQuery.trim().toLocaleLowerCase();
 const pool=ordered.filter(x=>!query||[x.name,x.director,x.directorEn,x.titleEn,x.tone,x.description,...Object.values(x.parameters||{})].join(' ').toLocaleLowerCase().includes(query));
 const pages=Math.max(1,Math.ceil(pool.length/6));stylePage=Math.min(stylePage,pages);
 const entries=pool.slice((stylePage-1)*6,stylePage*6),failed=Object.entries(catalogStatus).filter(([,v])=>v==='error').map(([k])=>k==='director'?'导演风格':'电影风格');
 return `<section class="style-section film-library" aria-label="影视风格选择"><div class="cinema-tabs ${styleFilter==='film'?'on-film':''}" role="tablist" aria-label="影视风格类型"><span class="cinema-tab-indicator" aria-hidden="true"></span>${[['director','导演风格','20','从摄影、布光到剪辑语法'],['film','电影风格','100','从具体作品拆解视觉方法']].map(([id,label,count,hint])=>`<button role="tab" id="style-tab-${id}" data-style-tab="${id}" data-filter="${id}" aria-selected="${styleFilter===id}" aria-controls="style-library-panel" tabindex="${styleFilter===id?0:-1}" class="${styleFilter===id?'active':''}"><span><strong>${label}</strong><i>${looks.filter(x=>x.group===id).length}</i></span><small>${hint}</small></button>`).join('')}</div><div class="style-tab-page" id="style-library-panel" role="tabpanel" aria-labelledby="style-tab-${styleFilter}"><div class="style-browser-pages" role="group" aria-label="浏览内容"><button data-browser-page="cases" aria-pressed="${styleBrowserMode==='cases'}">精选案例</button><button data-browser-page="library" aria-pressed="${styleBrowserMode==='library'}">完整风格库</button></div><div class="browser-current">${selected?`当前${styleFilter==='director'?'导演':'电影'}风格：<strong>${escape(selected.name)}</strong>`:'本类尚未选择 · 浏览后可选用一个方向'}</div>${styleBrowserMode==='cases'?`${Object.values(catalogStatus).some(x=>x==='error')?'<div class="catalog-status" role="status">风格参数读取失败，选用前请重试。<button class="text-button" data-action="retry-catalog">重试载入</button></div>':''}${gallery.render(styleFilter)}`:`<div class="catalog-divider"><h3>${styleFilter==='director'?'导演方法库':'电影风格库'}</h3><span>可查看与选用的参数提案</span></div><div class="library-toolbar"><div class="catalog-current">${styleFilter==='director'?'DIRECTOR METHODS':'FILM LOOKS'} <span>/ ${pool.length}</span></div>${['director','film'].includes(styleFilter)?`<button class="button small cover-play-toggle" data-action="toggle-cover-playback" aria-pressed="${coverPaused}" ${coverMotionPreference.matches?'disabled':''}>${coverMotionPreference.matches?'已减少动态':coverPaused?'播放轮播':'暂停轮播'}</button>`:''}<label class="style-search"><span class="sr-only">搜索风格、导演、电影或参数</span><input id="style-search" type="search" value="${escape(styleQuery)}" placeholder="搜索导演、电影或关键词…" autocomplete="off"></label></div><div class="catalog-status" role="status">${failed.length?`<span class="catalog-error">${failed.join('、')}资料读取失败</span><button class="text-button" data-action="retry-catalog">重试载入</button>`:Object.values(catalogStatus).some(v=>v!=='ready')?'正在载入本地技能资料…':'本地参数快照 · 保留来源与版本'}<span>未接入生成服务</span></div>${legacy?`<div class="legacy-style-note">当前项目保留旧版提案“${escape(selected.name)}”。该提案已从浏览分类移除，不会自动替换你的历史选择。</div>`:''}${inspected?styleInspector(inspected):'<div class="style-empty-selection">展开参数只浏览，选用后才保存为当前视觉提案。</div>'}<div class="look-grid">${entries.map(x=>styleCard(x,p)).join('')}</div>${!entries.length?'<div class="style-no-results"><p>没有匹配的风格，换一个导演名、片名或关键词试试。</p><button class="button small" data-action="reset-style-search">重置筛选</button></div>':''}<div class="style-pagination"><span>${pool.length} 个方向 · ${stylePage} / ${pages} 页</span><div><button class="button small" data-action="style-prev" ${stylePage<=1?'disabled':''} aria-label="上一页风格">←</button><button class="button small" data-action="style-next" ${stylePage>=pages?'disabled':''} aria-label="下一页风格">→</button></div></div>`}${styleBrowserMode==='cases'&&inspected?styleInspector(inspected):''}<div class="look-selection"><span>${selected?`<strong>当前提案 · ${escape(selected.name)}</strong> 选择已保存在此浏览器。`:(p.styleId&&!p.styleSelections&&!legacyLook?'已保存风格标识，参数资料尚未载入；不会自动替换为其他风格。':'本类尚未选择。点击案例或选用风格会回填顶部卡片；搜索和切换分类不改变选择。')}</span>${selected?`<button class="text-button" data-action="clear-look" data-style-group="${styleFilter}">清除此类选择</button>`:''}</div><p class="section-footnote">${styleFilter==='film'?'电影封面为对应影片剧照，版权归原权利人，仅供浏览参考。':'导演封面为所标代表作的真实剧照，作为方法浏览示例，版权归原权利人。'} 封面不关联产品或场景参考，不改变外观约束及质检结论。</p></div></section>`;
}
function specIssue(p){if(p.duration!==''&&p.duration!=null&&(!Number.isInteger(Number(p.duration))||Number(p.duration)<1||Number(p.duration)>360))return '规划时长请输入1–360之间的整数秒，或留空待定';return '';}
function creativePreview(){const p=project(),selected=selectedStyleList(p),issue=specIssue(p);if(issue){toast(issue);document.querySelector('#duration')?.focus();return;}modal('创作方案预览',`<div class="preview-banner">本地整理 · 未生成新媒体</div><h3>${escape(p.title)}</h3><p class="dialog-copy">${escape(p.goal||'核心表达待补充')}</p><div class="preview-specs"><span>${escape(p.duration||'待定')}${p.duration?'秒':''}</span><span>${escape(p.ratio)}</span><span>${escape(p.model)}</span></div><div class="preview-mapping"><div><strong>产品身份 ← 图1</strong><p>${escape(p.productName||'未上传')}</p></div><div><strong>场景环境 ← 图2</strong><p>${escape(p.sceneName||'未上传')}</p></div></div><p class="dialog-copy"><strong>场景：</strong>${escape(p.sceneText||'待补充')}<br><strong>视觉提案：</strong>${selected.length?selected.map(look=>escape((look.group==='director'?'导演：':look.group==='film'?'电影：':'')+look.name)).join('<br>'):'未选择；沿用简报'}<br><strong>外观保留：</strong>${escape(p.identity.join('、')||'待定义')}</p>${selected.map(look=>`<section class="plan-style-parameters"><h3>${look.group==='director'?'导演风格':look.group==='film'?'电影风格':'历史视觉提案'} · ${escape(look.name)}${look.selectionKind==='case'?'（案例参考）':''}</h3>${styleParametersView(look,true)}${styleSourceView(look)}</section>`).join('')}${selected.length>1?'<p class="dialog-copy">两类参数分别保留，合并前需方案复核；产品身份与外观约束优先。</p>':''}${referenceWarning()}<div class="callout">这是当前简报的结构预览，不是新编译的生成提示词。${p.localEdits?'本地修改仍待方案复核。':''}实际产物：${p.sampleFailed?'历史样片车型身份未通过。':'尚未生成。'}</div><div class="dialog-actions creative-preview-actions"><button class="button" data-action="close-modal">继续编辑</button><button class="button" data-action="preview-export">导出制作包</button><button class="button primary" data-action="preview-prompt">下一步 · 提示词 ${icon('arrow')}</button></div>`);}
function openProductionStage(stage){
  if(document.querySelector('#modal').open)closeModal();
  route='workspace';
  tab=stage;
  location.hash='workspace';
  render();
  document.querySelector(stage==='prompt'?'#prompt-title':stage==='story'?'#story-title':'#workspace-panel')?.focus({preventScroll:true});
  window.scrollTo(0,0);
}
function render(){const p=project();document.querySelector('#main-nav').innerHTML=navs.map(([id,name])=>`<button class="nav-link ${route===id?'active':''}" data-view="${id}" aria-label="${name}" title="${name}" ${route===id?'aria-current="page"':''}>${icon(id)}<span class="nav-label">${name}</span></button>`).join('');document.querySelector('#sidebar-project').textContent=p.title;document.querySelector('.project-nav').title=p.title;document.querySelector('#current-project-title').textContent=p.title;document.querySelector('#current-project-title').title=p.title;document.querySelector('#breadcrumb').textContent=navs.find(x=>x[0]===route)[1];const app=document.querySelector('#app');app.innerHTML=`<div class="route-fade">${route==='workspace'?workspace():route==='agents'?agentsView():route==='projects'?projectsView():assetsView()}</div>`;applyNavigationLayout();}
function workspace(){const p=project(),tag='h1';return `<div class="project-heading project-heading-compact"><div><div class="title-line"><${tag}>${escape(p.title)}</${tag}><span class="badge ${p.sampleFailed?'warn':'gray'}">${p.sampleFailed?'历史样片待修正':'创作草稿'}</span></div><p>${escape(p.category)} · ${escape(p.duration||'时长待定')}${p.duration?'秒':''} · ${escape(p.ratio)} · ${escape(p.model)}</p></div><button class="button subtle" data-action="new">＋ 新建创作</button></div><div class="workspace-layout"><section class="workspace-content"><div class="tab-bar" role="tablist" aria-label="项目内容">${[['refs','创意工作台','01'],['prompt','提示词','02'],['story','分镜设计','03'],['review','独立质检','04']].map(([id,name,count])=>`<button role="tab" id="tab-${id}" aria-controls="workspace-panel" tabindex="${tab===id?0:-1}" aria-selected="${tab===id}" class="tab ${tab===id?'active':''}" data-tab="${id}"><span class="tab-number">${count}</span>${name}${id==='review'&&p.sampleFailed?'<i class="tab-alert"></i>':''}</button>`).join('')}</div>${tab!=='refs'?guardSummary():''}<div role="tabpanel" id="workspace-panel" aria-labelledby="tab-${tab}">${tab==='refs'?refsView():tab==='story'?storyView():tab==='prompt'?promptView():reviewView()}</div><div class="footer-note"><span>产品身份有来源，创作决定可追溯。</span><span>本地工作台 · 未接入生成</span></div></section></div>`;}
function workflow(){const p=project();const steps=[['refs','任务简报'],['refs','参考素材'],['prompt','提示词'],['story','分镜设计'],['review','独立质检'],['export','交付']];return `<div class="workflow" aria-label="工作流阶段">${steps.map(([id,title],i)=>`${i?'<span class="step-line"></span>':''}<button class="step ${tab===id&&i!==0?'current':(i===0&&p.goal)||(i===1&&p.product&&p.scene)?'done':''}" ${id==='export'?'data-action="export"':`data-tab="${id}"`}><i>${(i===0&&p.goal)||(i===1&&p.product&&p.scene)?'✓':i+1}</i>${title}</button>`).join('')}</div>`;}
function referenceCard(role){const p=project(),isProduct=role==='product',src=p[role];return `<article class="reference-card ${isProduct?'':'scene'}"><div class="reference-image">${src?`<img src="${escape(src)}" alt="${isProduct?'产品身份参考':'场景环境参考'}">`:'<div class="reference-empty">＋<span>上传参考图片</span></div>'}<span class="image-tag">REF ${isProduct?'01':'02'}</span><button class="image-action" data-upload="${role}">${src?'替换素材':'上传图片'}</button></div><div class="ref-body"><div class="ref-title"><span>${isProduct?'产品身份':'场景环境'}</span><span class="badge ${isProduct?'green':'gray'}">${isProduct?'唯一身份来源':'仅控制环境'}</span></div><p>${isProduct?'轮廓、结构、颜色与辨识部件':'空间、光线、环境材质与配色'}</p>${p.referenceSources?.[role]?.provider==='Pinterest'?`<p><a href="${escape(p.referenceSources[role].pinUrl)}" target="_blank" rel="noopener noreferrer">来源 · Pinterest Pin ↗</a> · 在线引用</p>`:''}<div class="ref-footer"><span class="role-label">${icon(isProduct?'lock':'assets')}${isProduct?'保留产品外观':'不继承其他主体'}</span><span>${src?'已载入':'待补齐'}</span></div></div></article>`;}
function refsView(){const p=project(),look=selectedLook();return `<section class="workspace-hero"><span class="page-eyebrow">FRAME / CREATIVE STUDIO</span><h2>把灵感，推进下一镜。</h2><p>先明确产品身份，再寻找场景与镜头语言。</p></section><section class="composer" aria-label="创意输入台"><div class="composer-heading"><span class="composer-symbol">${icon('film')}</span><div><h2>创意简报</h2><p>把核心表达写在这里</p></div><span id="brief-status" class="badge gray">${p.localEdits?'本地修改待复核':p.id==='coast'?'沿用已确认简报':'可编辑草稿'}</span></div><label class="sr-only" for="goal">核心表达</label><textarea id="goal" data-field="goal" placeholder="描述产品、动作和你希望观众感受到的氛围…">${escape(p.goal)}</textarea><div class="composer-refs"><button class="reference-token" data-upload="product">${p.product?`<img src="${escape(p.product)}" alt="">`:'<span>＋</span>'}<span><strong>产品参考</strong><small>图1 · 唯一身份</small></span><span class="token-status">${p.product?'✓':'＋'}</span></button><button class="reference-token" data-upload="scene">${p.scene?`<img src="${escape(p.scene)}" alt="">`:'<span>＋</span>'}<span><strong>场景参考</strong><small>图2 · 仅环境</small></span><span class="token-status">${p.scene?'✓':'＋'}</span></button>${composerStyleCards()}</div>${renderProjectReferenceVideo()}<div class="composer-toolbar"><div class="composer-controls"><label for="duration"><span>时长</span><input id="duration" data-field="duration" type="number" min="1" max="360" value="${escape(p.duration)}" placeholder="待定"><span>秒</span></label><label for="ratio"><span class="sr-only">画幅比例</span><select id="ratio" data-field="ratio">${['待定','21:9','16:9','4:3','1:1','3:4','9:16'].map(x=>`<option ${x===p.ratio?'selected':''}>${x}</option>`).join('')}</select></label><button class="model-control" data-action="model-settings">${escape(p.model==='待选择'?'平台待选择':p.model)} ⌄</button></div><button class="button primary" data-action="creative-preview">预览创作方案 ${icon('arrow')}</button></div><div class="composer-caption"><span>自动保存到此浏览器</span><span>参数用于规划，平台能力另行核实</span></div></section>${guardSummary()}<details class="reference-details"><summary>双图职责与场景方向 <span>查看完整参考与检查记录</span></summary><section class="reference-section"><div class="section-head"><div><h2>参考素材，各司其职</h2><p>两张图独立关联，不作为首尾帧。</p></div><button class="text-button" data-action="reference-help">关联说明 ↗</button></div><div class="reference-grid">${referenceCard('product')}${referenceCard('scene')}</div>${referenceRecheckView()}${referenceWarning()}<div class="field scene-field"><label for="sceneText">场景与视觉方向</label><input id="sceneText" data-field="sceneText" value="${escape(p.sceneText)}" placeholder="描述环境、空间、光线与配色"></div></section></details>`;}

function guardSummary(){const p=project(),input=!p.product||!p.scene?'双图待补齐':p.refReview==='clear'?'人工已核对':p.refReview==='conflict'?'存在竞争主体':'待人工核对',identity=!p.identity.length?'未定义':p.identityReview?.status==='pending'?'待重新核对':p.identityReview?.status==='checked'?'人工已记录':`已列 ${p.identity.length} 项`,plan=p.planReview?.status==='revise'?'需修订':'待独立审查',artifact=artifactSummary(p),artifactTone=p.artifactReview?(artifact==='退回修订'?'danger':artifact==='人工验收通过'?'':'warn'):(p.sampleFailed?'danger':'');return `<section class="guard-summary" aria-label="创作护栏状态"><div class="guard-status ${p.refReview==='conflict'||!p.product||!p.scene?'warn':''}"><span>输入职责</span><strong>${input}</strong></div><div class="guard-status ${p.identityReview?.status==='pending'?'warn':''}"><span>外观约束</span><strong>${identity}</strong></div><div class="guard-status warn"><span>方案审查</span><strong>${plan}</strong></div><div class="guard-status ${artifactTone}"><span>实际产物</span><strong>${artifact}</strong></div><button class="button subtle" data-action="open-guardrails" aria-haspopup="dialog">查看护栏 ${icon('arrow')}</button></section>`;}
function openGuardrails(){modal('创作护栏',context(),'guard');}
let navigationPreference=null;
function setMobileNavigation(open,{restoreFocus=false}={}){document.querySelector('.sidebar').classList.toggle('open',open);document.body.classList.toggle('nav-open',open);document.querySelector('.nav-scrim').hidden=!open;document.querySelector('.mobile-menu').setAttribute('aria-expanded',String(open));if(open)document.querySelector('.sidebar .nav-link')?.focus({preventScroll:true});else if(restoreFocus)document.querySelector('.mobile-menu')?.focus({preventScroll:true});}
function applyNavigationLayout(){const mobile=innerWidth<768,collapsed=!mobile&&(navigationPreference??innerWidth<1100);document.body.classList.toggle('nav-collapsed',collapsed);const button=document.querySelector('.sidebar-toggle');button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'展开侧栏':'收起侧栏');button.title=collapsed?'展开侧栏':'收起侧栏';button.textContent=collapsed?'›':'‹';if(!mobile&&document.body.classList.contains('nav-open'))setMobileNavigation(false);}
window.matchMedia('(min-width:768px)').addEventListener('change',applyNavigationLayout);window.matchMedia('(min-width:1100px)').addEventListener('change',applyNavigationLayout);
function referenceWarning(){const p=project(),historicConflict=p.id==='coast'&&!p.referenceChanged;if(!p.product||!p.scene)return `<div class="warning-strip">${icon('warn')}<div><strong>参考素材尚未齐备</strong><p>请补齐产品图和场景风格图，再进入正式分镜与提示词。</p></div></div>`;if(p.refReview==='clear')return `<div class="warning-strip" data-status="checked">${icon('check')}<div><strong>输入已完成人工核对</strong><p>这一记录仅代表参考检查，不代表生成结果已通过验收。</p></div><button class="text-button" data-action="inspect-reference">重新检查</button></div>`;return `<div class="warning-strip">${icon('warn')}<div><strong>${p.refReview==='conflict'?(historicConflict?'场景参考中存在竞争车型':'场景参考中存在竞争主体'):'参考职责待人工核对'}</strong><p>${p.refReview==='conflict'?(historicConflict?'整张图仍包含敞篷车，仅写“参考环境”不能消除车型干扰。':'请根据实际参考处理竞争主体；仅用文字限定用途，不代表视觉冲突已消除。'):'请查看实际素材，核对是否存在其他产品、人物或标识。'}</p></div><button class="text-button" data-action="inspect-reference">检查参考 →</button></div>`;}
function context(){const p=project();return `<aside class="context-column" aria-label="约束与独立质检"><div class="rail-heading"><span>身份与环境分别核对</span>${icon('lock')}</div><div class="guard-reference-cards">${['product','scene'].map(role=>`<figure class="guard-ref-image">${p[role]?`<img src="${escape(p[role])}" alt="当前${role==='product'?'产品身份':'场景环境'}参考">`:'<div class="guard-ref-empty">待补齐参考</div>'}<figcaption><strong>${role==='product'?'图1 · 产品身份':'图2 · 仅环境'}</strong><small>${role==='product'?'唯一身份来源':'不继承其他主体'}</small></figcaption></figure>`).join('')}</div><button class="button rail-button" data-action="project-references">管理双图参考 ${icon('arrow')}</button>${identityView()}<div class="panel context-panel quality-panel"><div class="panel-head"><h3>独立质检</h3><span class="quality-dot"></span></div><p class="rail-copy">检查输入、审查方案、验收产物，分别记录。</p><div class="quality-step"><span class="quality-index">01</span><div><strong>引用接入</strong><span class="badge gray">${p.referenceChanged?'本地变更未关联':p.id==='coast'?'历史接入已核对':'未接入平台'}</span><small>${p.refReview==='clear'?'参考职责：人工已检查':p.refReview==='conflict'?'参考职责：存在竞争主体':'参考职责：待人工核对'}</small></div></div><div class="quality-step"><span class="quality-index">02</span><div><strong>方案审查</strong><span class="badge warn">${p.planReview?.status==='revise'?'需修订':'待独立审查'}</span><small>${p.localEdits?'简报或约束已有本地变更':'需核对关键词、分镜与素材'}</small></div></div><div class="quality-step"><span class="quality-index">03</span><div><strong>实际产物</strong><span class="badge ${p.sampleFailed?'red':'gray'}">${p.sampleFailed?'车型身份未通过':'未生成 · 未验收'}</span><small>${p.sampleFailed?'保留历史样片 R05 退回结论':'没有产物，不报告验收通过'}</small></div></div><button class="button rail-button" data-tab="review">打开独立质检 ${icon('arrow')}</button><p class="rail-footnote">当前展示已有记录，不会自动运行质检智能体。</p></div><div class="rail-note"><span>建议下一步</span><strong>${!p.product||!p.scene?'补齐产品与场景双图':p.refReview==='conflict'?'隔离场景中的竞争主体':p.refReview==='clear'?'复核外观约束与提示词':'检查参考职责'}</strong><button class="text-button" data-action="${p.refReview==='conflict'?'fix-plan':'inspect-reference'}">${p.refReview==='conflict'?'查看修正路线':'人工检查参考'} ↗</button></div></aside>`;}
const COAST_SHOTS=[['01','00:00—00:04 · 4秒','完整认形','前侧三分之四整车随行。完整硬顶与前脸可读，缓慢接近，先建立产品身份。','整车 / 同侧随行'],['02','00:04—00:07 · 3秒','机盖曲面','同侧前方更近、略高取景。前灯与轮拱前缘承接，暖高光勾出机盖起伏。','中近景 / 形态承接'],['03','00:07—00:10 · 3秒','轮拱与翼子板','青绿轮拱漆面为主，前轮自然滚动。保持固定前侧取景与轮胎接地。','局部 / 恒速巡航'],['04','00:10—00:15 · 5秒','回到完整巡航','回到完整硬顶全车，小幅增加前侧观看距离。最后1秒构图稳定，车辆继续前行。','整车 / 稳定收束']];
let generationJob=null;
const generationNotices=new Map();

function stageNotice(p,stage){
  return generationNotices.get(p.id+':'+stage);
}
function generationControls(p,stage){
  const promptStage=stage==='prompt';
  const running=generationJob?.projectId===p.id&&generationJob.stage===stage;
  const notice=stageNotice(p,stage);
  const model=apiSettings.getGenerationTarget();
  const label=promptStage?'生成提示词':'生成文字分镜';
  return `<div class="stage-generation-tools">
    <p class="page-intro">${escape(model.label)} · ${model.ready?'已填写接入信息':'待配置模型接入'}</p>
    <div class="stage-actions">
      <button type="button" class="button primary" data-action="${promptStage?'generate-prompt':'generate-storyboard'}" ${generationJob?'disabled':''}>${running?'正在生成…':label}</button>
      ${running?'<button type="button" class="button" data-action="cancel-stage-generation">取消生成</button>':
      '<button type="button" class="button subtle" data-action="open-generation-settings">配置模型</button>'}
    </div>
    <p class="page-intro stage-generation-status" role="status">${escape(notice||'点击生成会调用所选文字模型，可能产生 API 费用。')}</p>
  </div>`;
}
function getStoryboardRows(p){
  if(p.storyboard)return storyboardRows(p.storyboard);
  return p.id==='coast'?COAST_SHOTS:[];
}
function storyboardIsOutdated(p){
  return !!p.storyboard&&((p.promptRevision||0)!==p.storyboard.promptRevision||
    creativeBrief(p)!==p.storyboard.brief);
}
function storyView(){
 const p=project(), legacy=p.id==='coast'&&!p.storyboard;
 const shots=getStoryboardRows(p);
 return `${referenceRecheckView()}
   <div class="section-head"><div>
     <h2 id="story-title" tabindex="-1">${legacy?'R02 · 分镜设计':'分镜设计'}</h2>
     <p>${shots.length?`${shots.length} 镜 · ${p.storyboard?.duration??15} 秒`:'依据提示词生成主体和逐镜文字。'}</p>
   </div>${legacy?'<span class="badge gray">历史文字方案</span>':''}</div>
   ${generationControls(p,'story')}
   ${storyboardIsOutdated(p)?'<p class="callout">提示词或简报已更新。当前分镜仍对应上一版，请按现有提示词重新生成。</p>':''}
   ${!p.prompt?.trim()?'<p class="page-intro">先在提示词阶段生成或填写提示词。</p>':''}
   <div class="story-list">
     <article class="panel storyboard-paragraph"><h3>主体</h3><p>${escape(p.storyboard?.subject||describeSubject(p))}</p></article>
     ${shots.map(([number,time,title,action,framing])=>`<article class="panel storyboard-paragraph">
       <h3>第 ${escape(number)} 镜 · ${escape(title)}</h3>
       <p><strong>${escape(time)}</strong> · ${escape(framing)}。 ${escape(action)}</p>
     </article>`).join('')}
   </div>
   <div class="stage-actions stage-next">
     <button class="button" data-action="preview-prompt">返回提示词</button>
     ${shots.length?'<button class="button primary" data-action="story-to-review">下一步 · 独立质检</button>':''}
   </div>`;
}

function promptHeading(p){
  if(p.promptEdited)return p.id==='coast'?'提示词衍生草稿 · 待复核':'提示词草稿 · 待复核';
  if(p.promptGeneration)return '提示词草稿 · 待复核';
  return p.id==='coast'?'R04 · 历史提示词':'提示词';
}
function promptView(){
  const p=project();
  return `${referenceRecheckView()}
    <div class="section-head"><div>
      <h2 id="prompt-title" tabindex="-1">${promptHeading(p)}</h2>
      <p>把创意简报汇总为提示词。编辑完成后，可用当前文字生成分镜。</p>
    </div></div>
    ${generationControls(p,'prompt')}
    ${p.promptGeneration&&p.promptGeneration.brief!==creativeBrief(p)?'<p class="callout">创意工作台内容已更新，请复核当前提示词，或重新生成。</p>':''}
    ${p.sampleFailed&&!p.promptGeneration&&!p.promptEdited?'<div class="callout"><strong>历史版本 · 车型验收未通过</strong><br>这版提示词曾用于样片，实际输出采用了场景图中的敞篷特征。</div>':''}
    <label class="sr-only" for="prompt-editor">提示词编辑区</label>
    <textarea id="prompt-editor" class="prompt-editor" placeholder="生成后可在这里编辑，也可以直接填写提示词。">${escape(p.prompt||'')}</textarea>
    <div class="editor-meta"><span id="char-count">${(p.prompt||'').length.toLocaleString()} 字符</span><span>编辑自动保存到此浏览器</span></div>
    <div class="stage-actions stage-next">
      <button class="button" data-action="copy">${icon('copy')} 复制全文</button>
      <button class="button" data-action="prompt-export">导出 TXT</button>
      <button class="button primary" data-action="prompt-to-story">下一步 · 分镜设计</button>
    </div>`;
}

function refreshGenerationStage(projectId,stage){
  if(route==='workspace'&&tab===stage&&project().id===projectId)render();
}
async function generateProductionStage(stage){
  if(generationJob)return;
  const original=project(),key=original.id+':'+stage;
  const notice=message=>{generationNotices.set(key,message);refreshGenerationStage(original.id,stage);};
  if(!original.product||!original.scene){notice('请先在创意工作台补齐产品图和场景风格图。');return;}
  const issue=specIssue(original);
  if(issue){notice(issue);return;}
  if(stage==='prompt'&&!original.goal?.trim()){notice('请先在创意工作台填写核心表达。');return;}
  if(stage==='story'&&!original.prompt?.trim()){notice('请先在提示词阶段生成或填写提示词。');return;}
  if(!apiSettings.getGenerationTarget().ready){notice('请先配置大模型及 API Key，再点击生成。');return;}
  const job={projectId:original.id,stage,controller:new AbortController()};
  generationJob=job;
  notice(stage==='prompt'?'正在汇总简报并生成提示词…':'正在按当前提示词生成文字分镜…');
  try{
    if(original.referenceVideoId)await referenceVideosReady;
    const p=data.projects.find(item=>item.id===job.projectId);
    if(!p||job.controller.signal.aborted)return;
    const brief=creativeBrief(p),promptBefore=p.prompt||'';
    const context=JSON.stringify([brief,p.referenceRevision,p.referenceVideoId,promptBefore]);
    const result=await apiSettings.generateText({
      input:stage==='prompt'?brief:`当前提示词（以此版本为准）
${promptBefore}

当前项目约束（供核对）
${brief}`,
      system:stage==='prompt'?PROMPT_SYSTEM:STORYBOARD_SYSTEM,
      signal:job.controller.signal
    });
    const next=structuredClone(data),current=next.projects.find(item=>item.id===job.projectId);
    if(job.controller.signal.aborted)return;
    if(!current||JSON.stringify([creativeBrief(current),current.referenceRevision,current.referenceVideoId,current.prompt||''])!==context){
      notice('生成期间简报或提示词已更新。请以当前版本重新生成。');return;
    }
    const metadata={model:result.model,provider:result.provider,generatedAt:new Date().toISOString(),brief};
    if(stage==='prompt'){
      current.prompt=result.text.trim();
      current.promptEdited=false;
      current.promptRevision=(current.promptRevision||0)+1;
      current.promptGeneration=metadata;
    }else{
      current.storyboard={...parseStoryboard(result.text,Number(current.duration)||0),...metadata,promptRevision:current.promptRevision||0};
    }
    current.localEdits=true;
    current.planReview={...current.planReview,status:'pending'};
    const stored=commitProjectData(next,'浏览器存储空间不足，生成结果未保存');
    notice(stored
      ?stage==='prompt'?'提示词已生成并保存。可编辑后进入分镜设计。':'文字分镜已生成并保存，待独立质检。'
      :'浏览器存储空间不足，原有内容已保留。');
  }catch(error){
    notice(error.name==='AbortError'?'已取消生成，原有内容已保留。':error.message);
  }finally{
    if(job.controller.signal.aborted)generationNotices.set(key,'已取消生成，原有内容已保留。');
    if(generationJob===job)generationJob=null;
    if(route==='workspace'&&['prompt','story'].includes(tab)){
      if(tab===stage&&project().id===original.id)render();
      else {
        const tools=document.querySelector('.stage-generation-tools');
        if(tools)tools.outerHTML=generationControls(project(),tab);
      }
    }
  }
}
const reviewVideoPreviews = new Map();
const artifactStatuses = {pending:'待验收', passed:'人工验收通过', revise:'退回修订'};

function artifactSummary(p){
 const review=p.artifactReview;
 if(review){
   if(review.referenceRevision!==(p.referenceRevision||0))return '参考已变化 · 视频待复核';
   return artifactStatuses[review.status]||'待验收';
 }
 return p.sampleFailed?'历史 R05 身份未通过':'未生成 · 未验收';
}

function artifactReviewView(p){
 const preview=reviewVideoPreviews.get(p.id);
 const review=p.artifactReview;
 const stale=review && review.referenceRevision!==(p.referenceRevision||0);
 return `<section class="panel artifact-review" aria-labelledby="artifact-review-title">
   <div class="section-head">
     <div><h2 id="artifact-review-title">视频验收</h2><p>导入本地视频，播放后记录人工质检结论。视频预览仅在当前页面保留。</p></div>
     ${review?`<span class="badge ${stale?'warn':'gray'}">${stale?'参考已变化 · 待复核':escape(artifactStatuses[review.status]||'待验收')}</span>`:''}
   </div>
   <label for="review-video-input">导入视频</label>
   <input id="review-video-input" type="file" accept="video/*,.mkv,.m4v">
   ${review?`<p class="dialog-copy">验收文件：${escape(review.fileName)}</p>`:''}
   ${preview?`<video id="review-video" controls playsinline preload="metadata" src="${escape(preview)}" aria-label="导入的视频预览"></video>`:''}
   <p id="review-video-status" class="dialog-copy" role="status">${review&&!preview?'此前的检查记录已保留。重新导入视频可在此播放。':''}</p>
   ${preview&&review?`<form id="artifact-review-form">
     <div class="field"><label for="artifact-result">验收结论</label><select id="artifact-result" name="status">${Object.entries(artifactStatuses).map(([value,label])=>`<option value="${value}" ${(stale?'pending':review.status)===value?'selected':''}>${label}</option>`).join('')}</select></div>
     <div class="field"><label for="artifact-notes">审片备注</label><textarea id="artifact-notes" name="notes" rows="3" maxlength="2000" placeholder="记录镜号、时间点与需要修改的地方">${escape(stale?'':review.notes)}</textarea></div>
     <button class="button" type="submit">保存验收记录</button>
   </form>`:''}
 </section>`;
}

function importReviewVideo(file){
 if(!file)return;
 if(!isReferenceVideo(file)){
   toast('请选择有效的本地视频文件');return;
 }
 const id=project().id, next=structuredClone(data);
 const current=next.projects.find(p=>p.id===id);
 const previous=current.artifactReview;
 if(previous)current.artifactReviewHistory=[...(current.artifactReviewHistory||[]),previous].slice(-20);
 current.artifactReview={fileName:file.name,status:'pending',notes:'',importedAt:new Date().toISOString(),referenceRevision:current.referenceRevision||0};
 if(!commitProjectData(next,'存储空间不足，视频未导入'))return;
 const old=reviewVideoPreviews.get(id);
 if(old)URL.revokeObjectURL(old);
 reviewVideoPreviews.set(id,URL.createObjectURL(file));
 render();
 toast('视频已导入 · 待验收');
}

function saveArtifactReview(form){
 const fields=new FormData(form),status=fields.get('status');
 const id=project().id;
 const video=document.querySelector('#review-video');
 if(!Object.hasOwn(artifactStatuses,status)||!video||!reviewVideoPreviews.has(id))return;
 if(status!=='pending'&&(video.error||video.readyState<1)){
   toast('请确认视频能播放，再保存验收结论');return;
 }
 const next=structuredClone(data),p=next.projects.find(item=>item.id===id);
 p.artifactReview={...p.artifactReview,status,notes:String(fields.get('notes')||'').trim().slice(0,2000),referenceRevision:p.referenceRevision||0,reviewedAt:new Date().toISOString()};
 if(commitProjectData(next,'存储空间不足，验收记录未保存')){
   const badge=document.querySelector('.artifact-review .badge');
   badge.textContent=artifactStatuses[status];
   badge.className='badge gray';
   document.querySelector('.guard-summary')?.replaceWith(document.createRange().createContextualFragment(guardSummary()));
   toast('已保存人工视频验收记录');
 }
}

function reviewView(){const p=project();const inputReview=referenceRecheckView()+`<div class="panel input-review-panel"><div><h3>输入职责检查</h3><p class="dialog-copy">本地人工记录，与方案审查和实际产物验收分开。</p></div><button class="button" data-action="inspect-reference">记录参考检查</button></div>`;if(!p.sampleFailed)return inputReview+artifactReviewView(p);return inputReview+artifactReviewView(p)+`<div class="review-title"><div><h2>R05 · 样片审查</h2><p class="page-intro" style="margin:5px 0 0">基于现有样片的时间抽帧，产品身份未通过。</p></div><span class="badge red">退回修订</span></div><div class="review-grid"><article class="review-image"><img src="assets/product.jpg" alt="要求保留的青绿固定硬顶产品图"><div><span>目标产品</span><span class="badge green">固定硬顶</span></div></article><article class="review-image"><img src="assets/sample-opening.jpg" alt="实际样片开场，车辆呈现敞篷结构"><div><span>实际样片 · 约0秒</span><span class="badge red">开放座舱</span></div></article></div><div class="panel" style="margin-top:18px"><div class="finding"><h3>固定硬顶没有保留 <span class="timecode">00:00—00:03.5 / 00:10.5—00:14.5</span></h3><p>首尾整车抽帧呈现敞篷结构，违反图1的核心身份要求。画质与节奏不能抵消这一问题。</p></div><div class="finding"><h3>前脸与机盖混入图2特征 <span class="timecode">约00:04—00:06.5</span></h3><p>细亮横向格栅及长条黑色机盖开口更接近场景图中的车辆。</p></div><div class="finding" style="border:0"><h3>引用正确，不代表身份保留</h3><p>原始场景图仍包含另一辆完整汽车。下一步优先处理输入竞争，再复核具体结构描述。</p></div><button class="button primary" data-action="fix-plan">查看修正方案 ${icon('arrow')}</button></div><p class="page-intro">审查范围：每秒2帧的时间采样；没有宣称逐帧动态或音频验收。</p>`;}
function agentsView(){return `<div class="page-eyebrow">YOUR CREATIVE TEAM</div><h1>协作有分工，交付有依据</h1><p class="page-intro">合并相近职责，让创意、执行与验收各有负责人。当前展示角色配置，不代表智能体正在运行。</p><div class="agent-grid">${agents.map(a=>`<article class="agent-card"><span class="agent-avatar ${a[6]}">${a[0]}</span><h2>${a[1]}</h2><div class="agent-code">${a[2]}</div><p>${a[4]}</p><span class="badge gray">${a[3]}</span><footer>${a[5]}</footer></article>`).join('')}</div><div class="panel" style="margin-top:22px"><h3>协作规则</h3><p class="dialog-copy">设计总监与导演平级。按本轮任务启用角色；制作执行与独立质检分离。文字完成、引用核对、生成完成和画面验收，分别记录。</p></div>`;}
function projectsView(){return `<div class="page-eyebrow">PROJECT LIBRARY</div><div class="project-heading"><div><h1>让每个想法，有据可续</h1><p>${data.projects.length} 个本地项目 · 独立素材、简报与版本</p></div><button class="button primary" data-action="new">＋ 新建项目</button></div><div class="project-grid">${data.projects.map(p=>`<article class="library-project">${p.product?`<img src="${escape(p.product)}" alt="${escape(p.title)}产品参考">`:'<div class="empty-state" style="border:0"><p>待上传参考</p></div>'}<div><span class="badge ${p.sampleFailed?'warn':'green'}">${p.sampleFailed?'待修正':'创作草稿'}</span><h2 style="margin-top:14px">${escape(p.title)}</h2><p>${escape(p.category)} · ${escape(p.duration||'待定')}${p.duration?'秒':''} · ${escape(p.ratio)}</p><p class="project-created">创建于 ${escape(p.created||'未记录')}</p><button class="button" data-project="${escape(p.id)}">进入工作台 ${icon('arrow')}</button></div></article>`).join('')}</div>`;}
function assetsView(){return referenceLibrary.render(`${referenceRecheckView()}<h2>当前项目的双图参考</h2><p class="page-intro">产品图控制身份，场景图控制环境。上传仅保存在此浏览器。</p><div class="reference-grid asset-wide">${referenceCard('product')}${referenceCard('scene')}</div>${referenceWarning()}`,renderLibraryReferenceVideos());}
let modalBrowserReturn=null;
function modal(title,body,variant=''){const d=document.querySelector('#modal');if(!d.open){const active=document.activeElement;modalBrowserReturn=styleBrowser().open&&styleBrowser().contains(active)?{element:active,key:[...active.attributes].find(x=>x.name.startsWith('data-')&&x.value)}:null;}d.classList.toggle('guard-drawer',variant==='guard');document.querySelector('#modal-title').textContent=title;document.querySelector('#modal-body').innerHTML=body;d.showModal();}
function closeModal(){document.querySelector('#modal').close();}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function fixPlan(){const existing=project().id==='coast',changed=project().referenceChanged;modal('先修正参考输入，再测试动态',`<p class="dialog-copy">${existing?(changed?'保留已确认的海岸方向和四镜结构。本地参考已有替换，需要重新核对；历史样片退回结论继续保留。':'保留已确认的海岸方向和四镜结构。历史样片的关键问题，是原始环境参考含另一辆清晰可辨的车。'):'本项目尚未确认场景或分镜。先补齐并查看双图，明确产品身份与环境职责；以下是按实际风险选择的处理路线。'}</p><ol class="help-list">${existing?'<li>准备不含竞争车辆的环境参考。</li><li>若裁切只保留天空、岩草，要说明路面信息缺失。</li><li>需要去车并补全道路时，作为新的图像编辑工作单独处理。</li><li>按需先检查图1车辆进入海岸环境的静帧，再验收动态。</li>':'<li>实际查看双图，分别确认产品身份与环境职责。</li><li>检查参考中是否存在其他产品、人物或标识。</li><li>若需裁切、替换或编辑参考，记录保留范围与信息损失。</li><li>在授权范围内按需验证身份与构图，再检查实际产物。</li>'}</ol><div class="callout">此处仅展示修正路线，不会去车、生成静帧或重跑视频。</div><div class="dialog-actions"><button class="button primary" data-action="close-modal">明白了</button></div>`);}
function newProject(){modal('开始一个新项目',`<p class="dialog-copy">新项目独立保存，不继承旧项目的产品、素材或授权。</p><form id="new-project-form"><div class="field"><label for="new-title">项目名称</label><input id="new-title" name="title" required maxlength="60" placeholder="例如：新品耳机展示短片" autofocus></div><div class="field" style="margin-top:15px"><label for="new-category">交付目标</label><select id="new-category" name="category"><option>产品展示短片</option><option>视频提示词</option><option>创意与分镜</option></select></div><div id="new-error" class="form-error"></div><div class="dialog-actions"><button type="button" class="button" data-action="close-modal">取消</button><button class="button primary" type="submit">创建项目</button></div></form>`);}
document.addEventListener('click',async e=>{const b=e.target.closest('button,a');if(!b)return;if(document.body.classList.contains('nav-open')&&b.closest('.sidebar')&&['new','help'].includes(b.dataset.action))setMobileNavigation(false);if(b.dataset.action==='close-style-browser'){closeStyleBrowser();return;}if(b.dataset.browserPage){styleBrowserMode=b.dataset.browserPage;inspectedStyleId=null;refreshStyles();document.querySelector('#style-browser-content').scrollTop=0;document.querySelector(`[data-browser-page="${styleBrowserMode}"]`)?.focus({preventScroll:true});return;}if(b.dataset.casePage){gallery.page(b.dataset.casePage,Number(b.dataset.delta));document.querySelector('#style-browser-content').scrollTop=0;document.querySelector('[data-case-page]:not(:disabled)')?.focus({preventScroll:true});return;}if(b.dataset.styleSlot){browseStyleSlot(b.dataset.styleSlot);return;}if(b.dataset.clearStyleSlot){if(saveStyleChoice(b.dataset.clearStyleSlot,null)){revealStyleChoice(b.dataset.clearStyleSlot);toast('已清除此类风格');}return;}if(coverLightbox.handleClick(b))return;if(b.dataset.directorZoom||b.dataset.filmZoom){const id=b.dataset.directorZoom||b.dataset.filmZoom;coverLightbox.open(id,coverPositions.get(id)||0);return;}if(referencePicker.handleClick(b))return;if(referenceVideoUI.handleClick(b))return;if(referenceLibrary.handleClick(b))return;if(b.dataset.coverStep){setCoverFrame(b.dataset.coverStep,(coverPositions.get(b.dataset.coverStep)||0)+Number(b.dataset.delta));return;}if(b.dataset.coverGoto){setCoverFrame(b.dataset.coverGoto,Number(b.dataset.coverFrame));return;}if(b.dataset.styleTab){switchStyleTab(b.dataset.styleTab);return;}if(b.dataset.case){applyCaseChoice(b.dataset.case);return;}if(b.dataset.applyCase){applyCaseChoice(b.dataset.applyCase);return;}if(b.dataset.caseTrailer){const preview=gallery.trailer(b.dataset.caseTrailer);if(preview)modal(preview.title,preview.body);return;}if(b.dataset.inspectLook){inspectedStyleId=b.dataset.inspectLook;const inspected=findLook(inspectedStyleId);if(!inspected){toast('参数资料尚未载入，请稍后重试');return;}if((inspected.group==='director'||inspected.group==='film')&&styleFilter!==inspected.group){rememberStyleView();styleFilter=inspected.group;styleQuery='';stylePage=1;}paramsExpanded=true;refreshStyles();document.querySelector('#style-detail-title')?.focus({preventScroll:true});document.querySelector('.style-inspector')?.scrollIntoView({block:'nearest',behavior:'smooth'});return;}if(b.dataset.look||b.dataset.applyLook){const look=findLook(b.dataset.look||b.dataset.applyLook);if(!look){toast('风格资料尚未载入，请重试');return;}if(saveStyleChoice(look.group,{...snapshotLook(look),selectionKind:look.selectionKind||'template'})){finishStyleChoice(look.group);toast('已加入顶部'+(look.group==='director'?'导演风格':'电影风格')+'卡片，方案待复核');}return;}if(b.dataset.filter){styleFilter=b.dataset.filter;stylePage=1;refreshStyles();document.querySelector(`[data-filter="${styleFilter}"]`)?.focus({preventScroll:true});return;}if(b.dataset.view){referenceVideoPickingFor=null;if(document.querySelector('#modal').classList.contains('guard-drawer'))closeModal();route=b.dataset.view;location.hash=route;setMobileNavigation(false);render();return;}if(b.dataset.project){referenceVideoPickingFor=null;inspectedStyleId=null;styleQuery='';stylePage=1;data.active=b.dataset.project;save();route='workspace';tab='refs';location.hash=route;render();return;}if(b.dataset.tab){if(document.querySelector('#modal').classList.contains('guard-drawer'))closeModal();route='workspace';tab=b.dataset.tab;location.hash=route;render();return;}if(b.dataset.upload){uploadRole=b.dataset.upload;document.querySelector('#image-input').click();return;}switch(b.dataset.action){case'choose-reference-video':openReferenceVideoLibrary();break;case'back-reference-video':returnToVideoComposer();break;case'remove-reference-video':await removeReferenceVideo(b.dataset.videoId);break;case'open-guardrails':openGuardrails();break;case'project-references':closeModal();route='assets';location.hash='assets';referenceLibrary.handleClick({dataset:{refAction:'tab',refTab:'project'}});render();break;case'toggle-sidebar':navigationPreference=!document.body.classList.contains('nav-collapsed');applyNavigationLayout();break;case'close-navigation':setMobileNavigation(false,{restoreFocus:true});break;case'review-identity':reviewIdentity();break;case'open-reference-review':route='workspace';tab='review';location.hash='workspace';render();break;case'save-identity-review':{const p=project();if(!document.querySelector('#identity-reviewed')?.checked||!p.identity.length){toast('请先定义外观约束并逐项确认');break;}if(p.id!==b.dataset.projectId||String(p.referenceRevision||0)!==b.dataset.referenceRevision){toast('参考已变化，请重新核对');break;}const next=structuredClone(data);next.projects.find(x=>x.id===p.id).identityReview={status:'checked',referenceRevision:p.referenceRevision||0,checkedAt:new Date().toISOString(),method:'manual'};if(commitProjectData(next)){closeModal();render();toast('已记录人工外观核对，独立审查仍待执行');}break;}case'toggle-cover-playback':if(!coverMotionPreference.matches)coverPaused=!coverPaused;syncCoverPause();break;case'retry-cases':gallery.load();break;case'toggle-demo':gallery.toggle();document.querySelector('[data-action="toggle-demo"]')?.focus({preventScroll:true});break;case'retry-catalog':loadStyleCatalogs();break;case'toggle-parameters':paramsExpanded=!paramsExpanded;refreshStyles();document.querySelector('[data-action="toggle-parameters"]')?.focus({preventScroll:true});break;case'style-prev':stylePage=Math.max(1,stylePage-1);refreshStyles();document.querySelector('[data-action="style-prev"]:not(:disabled),[data-action="style-next"]:not(:disabled)')?.focus({preventScroll:true});break;case'style-next':stylePage++;refreshStyles();document.querySelector('[data-action="style-next"]:not(:disabled),[data-action="style-prev"]:not(:disabled)')?.focus({preventScroll:true});break;case'reset-style-search':styleQuery='';stylePage=1;refreshStyles();document.querySelector('#style-search')?.focus({preventScroll:true});break;case'creative-preview':creativePreview();break;case'choose-look':browseStyleSlot('director');break;case'clear-look':{const group=b.dataset.styleGroup||styleFilter;if(!project().styleSelections&&selectedLook()&&!['director','film'].includes(selectedLook().group)){const next=structuredClone(data),p=next.projects.find(x=>x.id===data.active);delete p.styleId;delete p.styleSnapshot;p.localEdits=true;p.planReview={...(p.planReview||{}),status:'pending'};if(commitProjectData(next,'风格清除未能保存')){inspectedStyleId=null;refreshStyles();syncSummary();}}else saveStyleChoice(group,null);break;}case'preview-prompt':openProductionStage('prompt');break;case'prompt-to-story':openProductionStage('story');break;case'story-to-review':openProductionStage('review');break;case'open-generation-settings':apiSettings.open({settings:true});break;case'generate-prompt':await generateProductionStage('prompt');break;case'generate-storyboard':await generateProductionStage('story');break;case'cancel-stage-generation':generationJob?.controller.abort();break;case'preview-export':closeModal();document.querySelector('[data-action="export"]').click();break;case'model-settings':modal('制作平台与模型',`<p class="dialog-copy">这里只保存目标平台名称，不连接模型、不查询积分。</p><div class="field"><label for="model-name">目标平台 / 模型</label><input id="model-name" value="${escape(project().model==='待选择'?'':project().model)}" placeholder="例如：即梦 Seedance 2.5" maxlength="80"></div><div class="dialog-actions"><button class="button" data-action="close-modal">取消</button><button class="button primary" data-action="save-model">保存</button></div>`);break;case'save-model':project().model=document.querySelector('#model-name').value.trim()||'待选择';markChanged();closeModal();render();break;case'add-constraint':modal('添加外观约束',`<p class="dialog-copy">填写实际参考图中必须保留的结构或辨识特征。</p><form id="constraint-form"><div class="field"><label for="constraint-text">必须保留的特征</label><input id="constraint-text" required maxlength="60" placeholder="例如：固定硬顶、原图灯组结构"></div><div class="dialog-actions"><button type="button" class="button" data-action="close-modal">取消</button><button class="button primary" type="submit">添加约束</button></div></form>`);break;case'menu':setMobileNavigation(!document.body.classList.contains('nav-open'));break;case'new':newProject();break;case'close-modal':closeModal();break;case'fix-plan':fixPlan();break;case'help':modal('关于映序工作台','<p class="dialog-copy">一个围绕视频提示词规范设计的本地交互原型。可编辑简报、替换参考图、修改与复制提示词、导出制作包。数据保存在当前浏览器；未连接智能体调度、即梦生成、云端项目或积分系统。</p><div class="dialog-actions"><button class="button primary" data-action="close-modal">继续创作</button></div>');break;case'edit-project':modal('项目设置',`<div class="field"><label for="edit-title">项目名称</label><input id="edit-title" maxlength="60" value="${escape(project().title)}"></div><div class="dialog-actions"><button class="button" data-action="close-modal">取消</button><button class="button primary" data-action="save-title">保存名称</button></div>`);break;case'save-title':{const v=document.querySelector('#edit-title').value.trim();if(!v){toast('请输入项目名称');break;}project().title=v;save();closeModal();render();break;}case'reference-help':modal('两张图，两个控制维度',`<p class="dialog-copy"><strong>图1 · 产品身份：</strong>定义是什么产品，保留结构、比例、颜色与辨识部件。<br><br><strong>图2 · 场景风格：</strong>定义在哪里呈现，以及环境光、材质与配色。若含另一明显主体，需要先处理参考竞争。<br><br>两图不是首帧和尾帧。实际平台中的素材关联需另行核对，本地原型不建立平台引用。</p><div class="dialog-actions"><button class="button primary" data-action="close-modal">明白了</button></div>`);break;case'inspect-reference':modal('人工核对参考素材',`<p class="dialog-copy">检查实际上传内容后记录结论。这里不会自动识别、删除或生成图像。输入检查也不等于实际视频验收。</p><div class="field"><label for="ref-review">参考职责检查结果</label><select id="ref-review"><option value="needs-review">待人工检查</option><option value="conflict" ${project().refReview==='conflict'?'selected':''}>存在竞争主体，需处理</option><option value="clear" ${project().refReview==='clear'?'selected':''}>我已检查，无竞争主体</option></select></div><div class="dialog-actions"><button class="button" data-action="close-modal">取消</button><button class="button primary" data-action="save-review">保存检查记录</button></div>`);break;case'save-review':if(!project().product||!project().scene){toast('请先补齐两张参考图，再记录职责检查');break;}project().refReview=document.querySelector('#ref-review').value;save();closeModal();render();toast('已记录输入检查，产物验收状态独立保留');break;case'copy':try{await navigator.clipboard.writeText(project().prompt);toast(project().prompt?'提示词已复制':'当前提示词为空');}catch{document.querySelector('#prompt-editor')?.select();toast('请使用系统复制快捷键复制已选文本');}break;case'prompt-export':download(project().prompt,`${project().title}-提示词.txt`,'text/plain;charset=utf-8');toast('已导出提示词文本');break;case'export':if(specIssue(project())){toast(specIssue(project()));break;}try{const portable=structuredClone(project());if(portable.referenceVideoId)await referenceVideosReady;portable.referenceVideo=referenceVideoMetadata(portable);portable.visualProposal=snapshotLook(selectedLook(portable));portable.styleSelections=structuredClone(styleSelections(portable));portable.visualProposals=Object.fromEntries(Object.entries(styleSelections(portable)).map(([group,value])=>[group,snapshotLook(value)]));portable.styleRoles={director:'导演方法与镜头组织参考',film:'影片画面与氛围参考',priority:'产品身份与外观约束优先，风格冲突待方案复核'};portable.referenceRoles={product:'唯一产品身份来源：轮廓、结构、颜色与辨识部件',scene:'仅环境：空间、光线、环境材质与配色，不继承其他主体'};portable.checks={connection:portable.referenceChanged?'本地变更未关联':portable.id==='coast'?'历史接入已核对':'未接入平台',referenceResponsibility:portable.refReview,identity:portable.identityReview||null,reviewRequest:portable.reviewRequest||null,plan:portable.planReview?.status==='revise'?'需修订':'待独立审查',artifact:portable.sampleFailed?'历史样片车型身份未通过':'未生成 · 未验收'};portable.referencePackaging={};for(const role of ['product','scene']){if(portable.referenceSources?.[role]?.savedAs==='remote-url'&&portable.referenceSources[role].imageUrl===portable[role]){portable.referencePackaging[role]={mode:'remote-url',note:'Pinterest在线图片引用，未嵌入图片，显示依赖网络和源站'};continue;}if(portable[role]&&!portable[role].startsWith('data:')){const r=await fetch(portable[role]);if(!r.ok)throw Error();const blob=await r.blob();portable[role]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}}download(buildProductionMarkdown(portable,{shots:getStoryboardRows(portable),storyboardOutdated:storyboardIsOutdated(portable),exportedAt:new Date().toISOString()}),`${project().title.replace(/[\\/:*?"<>|]/g,'-')}-制作包.md`,'text/markdown;charset=utf-8');toast('已导出 Markdown 制作包；包含参考、分镜、提示词与审查记录');}catch{toast('参考图读取失败，制作包未导出，请刷新后重试');}break;}});
document.addEventListener('submit',e=>{if(e.target.id==='artifact-review-form'){e.preventDefault();saveArtifactReview(e.target);return;}if(e.target.id==='constraint-form'){e.preventDefault();const v=document.querySelector('#constraint-text').value.trim();if(!v)return;project().identity=[...new Set([...project().identity,v])];markChanged();closeModal();render();toast('外观约束已保存，方案待复核');return;}if(e.target.id!=='new-project-form')return;e.preventDefault();const values=new FormData(e.target),title=String(values.get('title')).trim();if(!title){document.querySelector('#new-error').textContent='请输入项目名称';return;}const p={id:crypto.randomUUID(),title,category:values.get('category'),duration:'',ratio:'待定',model:'待选择',goal:'',sceneText:'',identity:[],product:null,scene:null,refReview:'needs-review',prompt:'',sampleFailed:false,created:new Date().toISOString().slice(0,10)};data.projects.push(p);inspectedStyleId=null;styleQuery='';stylePage=1;data.active=p.id;save();closeModal();route='workspace';tab='refs';location.hash=route;render();toast('项目已创建，先上传两张参考图');});
function syncSummary(){const p=project();const h=document.querySelector('.project-heading p');if(route==='workspace'&&h)h.textContent=`${p.category} · ${p.duration||'时长待定'}${p.duration?'秒':''} · ${p.ratio} · ${p.model}`;document.querySelectorAll('.guard-summary').forEach(el=>el.outerHTML=guardSummary());const aside=document.querySelector('.guard-drawer .context-column'),activeLock=aside?.contains(document.activeElement)?document.activeElement.dataset.lock:null;if(aside){aside.outerHTML=context();if(activeLock)document.querySelector(`.guard-drawer [data-lock="${CSS.escape(activeLock)}"]`)?.focus({preventScroll:true});}const badge=document.querySelector('#brief-status');if(badge&&p.localEdits)badge.textContent='本地修改待复核';}
document.addEventListener('keydown',e=>{
 if(document.body.classList.contains('nav-open')&&!document.querySelector('#modal').open){if(e.key==='Escape'){e.preventDefault();setMobileNavigation(false,{restoreFocus:true});return;}if(e.key==='Tab'){const nodes=[...document.querySelectorAll('.sidebar a,.sidebar button')].filter(x=>x.getClientRects().length&&!x.disabled);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}}
 if(!e.target.matches('[role="tab"]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();const list=e.target.closest('[role="tablist"]');const buttons=[...list.querySelectorAll('[role="tab"]')];
 let i=buttons.indexOf(e.target);i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
 const next=buttons[i];if(next.dataset.styleTab){next.click();document.querySelector(`#style-tab-${next.dataset.styleTab}`)?.focus({preventScroll:true});}
 else{next.click();document.querySelector(`#tab-${next.dataset.tab}`)?.focus();}
});
document.addEventListener('input',e=>{if(referenceLibrary.handleInput(e))return;if(e.target.id==='style-search'){styleQuery=e.target.value;stylePage=1;refreshStyles();return;}if(e.target.dataset.field){project()[e.target.dataset.field]=e.target.value;markChanged();syncSummary();}if(e.target.id==='prompt-editor'){project().prompt=e.target.value;project().promptEdited=true;project().promptRevision=(project().promptRevision||0)+1;markChanged();syncSummary();document.querySelector('#prompt-title').textContent=promptHeading(project());document.querySelector('#char-count').textContent=`${e.target.value.length.toLocaleString()} 字符`;}});
document.addEventListener('change',e=>{if(e.target.id==='review-video-input'){importReviewVideo(e.target.files[0]);return;}if(e.target.dataset.lock){const p=project();p.localEdits=true;if(p.identityReview)p.identityReview.status='pending';p.identity=e.target.checked?[...new Set([...p.identity,e.target.dataset.lock])]:p.identity.filter(x=>x!==e.target.dataset.lock);markChanged();syncSummary();}if(e.target.dataset.field&&e.target.tagName==='SELECT'){project()[e.target.dataset.field]=e.target.value;markChanged();syncSummary();}});
document.querySelector('#image-input').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;if(!file.type.startsWith('image/')){toast('请选择有效图片文件');return;}if(file.size>6*1024*1024){toast('图片超过6MB，请压缩后重试');return;}const role=uploadRole,targetId=project().id;const reader=new FileReader();reader.onload=()=>{const next=structuredClone(data),p=next.projects.find(p=>p.id===targetId);if(!p)return;p[role]=reader.result;p[`${role}Name`]=file.name;if(p.referenceSources)delete p.referenceSources[role];invalidateReferenceChecks(p,role);if(commitProjectData(next)){render();toast('参考图已替换，外观约束和独立质检待复核');}};reader.onerror=()=>toast('图片读取失败，请重试');reader.readAsDataURL(file);e.target.value='';});
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(v==='agents'){route='workspace';history.replaceState(null,'','#workspace');render();}else if(v!==route&&navs.some(x=>x[0]===v)){referenceVideoPickingFor=null;route=v;render();}});
if(['director','film'].includes(project().styleSnapshot?.group))styleFilter=project().styleSnapshot.group;
const requestedStyleTab=new URLSearchParams(location.search).get('style');if(['director','film'].includes(requestedStyleTab))styleFilter=requestedStyleTab;
render();
referenceLibrary.load();
const referenceVideosReady=loadReferenceVideos();
if(!project().prompt&&project().id==='coast'){fetch('assets/prompt-r04.txt').then(r=>{if(!r.ok)throw Error();return r.text();}).then(t=>{const p=data.projects.find(x=>x.id==='coast');if(p&&!p.prompt&&!p.promptEdited&&!p.promptGeneration){p.prompt=t;save();if(route==='workspace'&&tab==='prompt')render();}}).catch(()=>toast('历史提示词读取失败，请通过本地HTTP预览打开'));}

loadStyleCatalogs();

styleBrowser().addEventListener('close',()=>{if(styleBrowser().open)return;document.body.classList.remove('style-browser-open');document.querySelector(`[data-style-slot="${styleBrowserTrigger}"]`)?.focus({preventScroll:true});});
styleBrowser().addEventListener('keydown',e=>{if(e.key!=='Tab'||document.querySelector('#modal').open)return;const nodes=[...styleBrowser().querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(x=>x.getClientRects().length&&x.tabIndex>=0);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
styleBrowser().addEventListener('cancel',e=>{e.preventDefault();closeStyleBrowser();});
document.querySelector('#modal').addEventListener('close',()=>{const d=document.querySelector('#modal');if(d.open)return;if(modalBrowserReturn&&styleBrowser().open){const back=modalBrowserReturn;queueMicrotask(()=>{if(d.open||!styleBrowser().open)return;const target=back.element.isConnected?back.element:back.key?styleBrowser().querySelector(`[${back.key.name}="${CSS.escape(back.key.value)}"]`):null;target?.focus({preventScroll:true});});}modalBrowserReturn=null;d.querySelectorAll('iframe').forEach(frame=>frame.remove());if(d.classList.contains('guard-drawer')){d.classList.remove('guard-drawer');document.querySelector('[data-action="open-guardrails"]')?.focus({preventScroll:true});}});
gallery.load();

document.addEventListener('error',e=>{if(e.target.matches?.('.ref-video-player')){if(!e.target.nextElementSibling?.classList.contains('ref-video-playback-error')){const note=document.createElement('p');note.className='dialog-copy ref-video-playback-error';note.setAttribute('role','status');note.textContent='浏览器无法播放此编码。可导入 H.264 编码的 MP4 版本。';e.target.after(note);}return;}if(e.target.id==='review-video'){document.querySelector('#review-video-status').textContent='浏览器无法播放此视频，请尝试导入 H.264 编码的 MP4 文件。';return;}if(e.target.matches?.('.composer-style-art img')){e.target.hidden=true;return;}if(e.target.matches?.('.film-cover-image')){const img=e.target,box=img.closest('.film-cover-visual');img.dataset.failed='true';img.hidden=true;const usable=[...box.querySelectorAll('.film-cover-image')].filter(i=>!i.dataset.failed);if(!usable.length){box.classList.add('unavailable');box.querySelector('.film-cover-placeholder').firstChild.textContent='封面暂不可用';}else if(img.classList.contains('active'))setCoverFrame(box.dataset.coverId,Number(img.dataset.frameIndex)+1);}},true);
document.addEventListener('load',e=>{if(e.target.matches?.('.film-cover-image.active'))e.target.closest('.film-cover-visual').classList.add('loaded');},true);
loadFilmCovers();
loadDirectorCovers();
// One scheduler per page; rebuilding a tab or search result never creates another timer.
setInterval(()=>{if(coverPaused||coverMotionPreference.matches||document.hidden||document.querySelector('#modal').open||!styleBrowser().open)return;document.querySelectorAll('.film-cover-visual').forEach(box=>{const rect=box.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight+150)return;const imgs=box.querySelectorAll('.film-cover-image');if(imgs.length>1)setCoverFrame(box.dataset.coverId,(coverPositions.get(box.dataset.coverId)||0)+1);});},3000);
