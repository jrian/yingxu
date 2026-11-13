// Normalize old single-choice projects without writing on page load.
export function readStyleSelections(project,resolve=()=>null){
 const result={director:null,film:null};
 if(project.styleSelections&&typeof project.styleSelections==='object'){
  for(const group of ['director','film']){const value=project.styleSelections[group];if(value?.id&&value.group===group)result[group]=value;}
  return result;
 }
 const old=project.styleSnapshot?.id===project.styleId?project.styleSnapshot:resolve(project.styleId);
 if(old?.id&&['director','film'].includes(old.group))result[old.group]=old;
 return result;
}
export function caseStyleSelection(c,resolve,snapshot){
 const match=(c.styleIds||[]).map(resolve).find(x=>x?.group===c.group);
 if(match)return {...snapshot(match),selectionKind:'template',sourceCaseId:c.id,sourceCaseTitle:c.title,sourceCaseYear:c.year};
 const labels={lighting:'光线',palette:'配色',composition:'构图',camera:'镜头',rhythm:'节奏'},parameters={};
 for(const [key,label] of Object.entries(labels)){const point=(c.learningPoints||[]).find(x=>x.startsWith(label+'：')||x.startsWith(label+':'));parameters[key]=point?point.slice(label.length+1).trim():`此案例未单列${label}，待补充。`;}
 return {id:'selection-'+c.id,group:c.group,selectionKind:'case',sourceCaseId:c.id,name:c.title+' · 案例参考',title:c.title,year:c.year,director:c.director,tag:c.group==='film'?'电影案例':'导演案例',tone:c.kicker,description:c.summary,colors:[...c.palette],parameters,source:{repository:'FRAME 案例学习要点',path:'workbench/data/style-cases.json#'+c.id,url:c.officialTrailer.sourceUrl,scope:'case-learning-reference',extractedAt:'2026-11-10'},notes:'从当前案例已有学习要点整理；未提供的参数明确标为待补充，未新增或冒充电影库模板。'};
}
export function withStyleSelection(project,group,selection,resolve,{exclusive=false}={}){
 if(!['director','film'].includes(group)||selection&&selection.group!==group)throw Error('Style group mismatch');
 const next=structuredClone(project),selections=structuredClone(readStyleSelections(project,resolve));
 selections[group]=selection?structuredClone(selection):null;if(exclusive&&selection)selections[group==='director'?'film':'director']=null;
 next.styleSelections=selections;next.styleSelectionVersion=1;
 // Keep one legacy pointer for older consumers; current preview/export use both slots.
 const previous=Object.values(selections).find(x=>x?.id===project.styleId),last=selection||previous||selections.film||selections.director;
 if(last){next.styleId=last.id;next.styleSnapshot=structuredClone(last);}else{delete next.styleId;delete next.styleSnapshot;}
 next.localEdits=true;next.planReview={...(next.planReview||{}),status:'pending'};return next;
}
