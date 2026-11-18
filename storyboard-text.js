export const PROMPT_SYSTEM = [
  '你为视频制作工作台撰写中文视频提示词。将提供的项目简报汇总成一份可直接编辑的纯文字提示词。',
  '写清主体、产品外观、环境、动作、镜头语言、节奏和目标规格。图1是唯一产品身份来源，图2只参考环境；参考视频只借鉴镜头、动作与节奏。',
  '产品身份与外观约束优先于风格。你只收到了文字，不得声称看过素材，不得猜测素材细节、品牌、参数或质检结果。只输出提示词正文。'
].join('\n');

export const STORYBOARD_SYSTEM = [
  '把当前视频提示词拆解成文字分镜，保留用户编辑后的动作、顺序、约束和目标规格。',
  '只返回 JSON 对象，格式为 {"subject":"独立的主体段落","shots":[{"seconds":4,"title":"镜头标题","framing":"景别和机位或运镜","action":"本镜头的画面与动作"}]}。',
  '每镜 seconds 为正整数，逐镜连续。提供了目标时长时，各镜时长之和必须严格等于它。尚未指定时长时遵循提示词，给出合理的各镜时长。',
  '图1决定唯一主体身份和外观，图2只影响环境，参考视频只提供镜头动作与节奏方向。你只能依据已提供的文字，不得声称看过素材或已经验收。'
].join('\n');

function checkedText(value, max){
  if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('分镜文字缺失或太长，请重试。');
  return value.trim().replace(/\s+/g,' ');
}
export function parseStoryboard(text, expectedSeconds){
  const raw=text.trim().replace(/^\x60\x60\x60(?:json)?\s*([\s\S]+?)\s*\x60\x60\x60$/i,'$1');
  let value;
  try{value=JSON.parse(raw);}catch{throw Error('模型未返回可读取的分镜格式，请重试。');}
  if(!Array.isArray(value?.shots)||!value.shots.length||value.shots.length>30)throw Error('模型返回的镜头数量无效，请重试。');
  const subject=checkedText(value.subject,2000);
  const shots=value.shots.map(shot=>{
    if(!Number.isInteger(shot?.seconds)||shot.seconds<1||shot.seconds>360)throw Error('每个镜头的时长必须是整数秒，请重试。');
    return {seconds:shot.seconds,title:checkedText(shot.title,120),framing:checkedText(shot.framing,500),action:checkedText(shot.action,1800)};
  });
  const duration=shots.reduce((total,shot)=>total+shot.seconds,0);
  if(expectedSeconds&&duration!==expectedSeconds)throw Error(`分镜合计 ${duration} 秒，与项目的 ${expectedSeconds} 秒不符，请重试。`);
  if(duration>360)throw Error('生成的分镜总时长超过 360 秒，请重试。');
  return {subject,shots,duration};
}

const pad=n=>String(n).padStart(2,'0');
function timecode(seconds){return pad(Math.floor(seconds/60))+':'+pad(seconds%60);}
export function storyboardRows(storyboard){
  let start=0;
  return storyboard.shots.map(({seconds,title,action,framing},index)=>{
    const end=start+seconds;
    const time=`${timecode(start)}—${timecode(end)} · ${seconds}秒`;
    start=end;
    return [pad(index+1),time,title,action,framing];
  });
}
