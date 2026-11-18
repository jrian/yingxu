// Explicit content fields only: model connection settings and credentials are never read.
const plain=v=>String(v??'').replace(/\r\n?/g,'\n');
const inline=v=>plain(v).replace(/\n/g,' ').replace(/[\\`*_{}\[\]<>#|]/g,'\\$&');
function block(v,lang='text'){const text=plain(v);const longest=Math.max(2,...[...text.matchAll(/`+/g)].map(m=>m[0].length));const f='`'.repeat(longest+1);return `${f}${lang}\n${text}\n${f}`;}
function record(v){return block(JSON.stringify(v??null,null,2),'json');}
export function buildProductionMarkdown(p,{shots=[],exportedAt=new Date().toISOString()}={}){
 const lines=[`# ${inline(p.title||'未命名项目')} · 制作包`,'',`导出时间：${inline(exportedAt)}`,'','> 当前项目的文字与参考快照。导出不代表方案获批、视频已生成或独立质检通过。','','## 创意简报','',plain(p.goal||'待补充'),'','## 制作规格','',`- 类别：${inline(p.category||'待定')}`,`- 时长：${inline(p.duration||'待定')} 秒`,`- 画幅：${inline(p.ratio||'待定')}`,`- 目标制作平台 / 模型：${inline(p.model||'待定')}`,'','## 双图参考与职责',''];
 const images=[];
 for(const role of ['product','scene']){
  const product=role==='product',label=product?'图1 · 产品身份':'图2 · 场景环境';
  lines.push(`### ${label}`,'',`文件：${inline(p[role+'Name']||'未提供')}`,'',product?'唯一产品身份来源：轮廓、结构、比例、颜色与辨识部件。':'仅控制空间、光线、环境材质与配色；不继承另一主体。','');
  const src=p[role];if(src&&/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(src)){images.push(`[ref-${role}]: ${src}`);lines.push(`![${label}][ref-${role}]`,'','图像数据嵌入本文件末尾，文件体积会随参考图增大。','');}
  else if(src&&/^https?:\/\//i.test(src)){try{const u=new URL(src);if(u.username||u.password)throw Error();lines.push(`参考图片：<${u.href.replace(/>/g,'%3E').replace(/</g,'%3C')}>`,'','此参考保留在线链接，查看时需要网络及源站可用。','');}catch{lines.push('图片链接无效，未嵌入。','');}}
  else lines.push(src?'图片未嵌入，请另存原始素材。':'尚未提供图片。','');
  if(p.referenceSources?.[role])lines.push('素材来源记录：','',record(p.referenceSources[role]),'');
 }
 lines.push('## 外观约束','',...(p.identity?.length?p.identity.map(v=>'- '+inline(v)):['待定义']),'','## 场景视觉方向','',plain(p.sceneText||'待补充'),'','## 双风格选择','','产品身份与外观约束优先；两类风格分别保留，冲突需方案复核。','');
 const labels={lighting:'光线',palette:'配色',composition:'构图',camera:'镜头',rhythm:'节奏'};
 for(const group of ['director','film']){const look=p.styleSelections?.[group];lines.push('### '+(group==='director'?'导演风格':'电影风格'),'');if(!look){lines.push('未选择。','');continue;}lines.push(inline(look.name||look.title||look.id),'');if(look.description)lines.push(plain(look.description),'');for(const [k,label]of Object.entries(labels))lines.push(`- ${label}：${inline(look.parameters?.[k]||'来源未提供，待补充')}`);lines.push('');if(look.source)lines.push('来源与版本：','',record(look.source),'');}
 lines.push('## 分镜设计','');
 if(shots.length){lines.push('R02 · 历史已确认文字方案。若参考或简报已变更，当前方案仍需复核。参考图不等于新生成分镜图。','');for(const shot of shots)lines.push(`### SHOT ${inline(shot[0])} · ${inline(shot[2])}`,'',`- 时间：${inline(shot[1])}`,`- 景别与运动：${inline(shot[5])}`,'',plain(shot[3]),'');}
 else lines.push('当前项目尚无已整理的正式分镜。','');
 lines.push('## 提示词','',p.prompt?block(p.prompt):'当前项目提示词为空。API 助手中尚未转入项目的草稿不包含在此制作包中。','','## 检查与独立质检','',`- 平台引用：${inline(p.checks?.connection||'未验证')}`,`- 参考职责：${inline(({conflict:'存在竞争主体，需处理',clear:'已记录人工检查', 'needs-review':'待人工核对'})[p.refReview]||'待检查')}`,`- 方案审查：${inline(p.checks?.plan||'待独立审查')}`,`- 实际产物：${inline(p.checks?.artifact||'未生成 · 未验收')}`,'','外观检查记录：','',record(p.identityReview),'','方案审查记录：','',record(p.planReview),'','独立质检请求：','',record(p.reviewRequest),'','参考变更历史：','',record(p.referenceReviewHistory||[]),'','## 素材打包说明','','本文件为 Markdown 交付快照，不是项目导入文件。未包含 API Key、访问令牌或模型接入设置。嵌入图片以 Markdown 引用定义保存在末尾；在线图片不会自动下载。','');
 if(images.length)lines.push('<!-- 嵌入参考图数据 -->','',...images,'');return lines.join('\n');
}
