const STORE = 'videos';
export const REFERENCE_VIDEO_ROLE = '仅参考镜头、动作与节奏。产品身份由图1决定，场景环境由图2决定。';

export function createReferenceVideoStore(){
  let connection;
  function open(){
    if(!connection){
      connection = new Promise((resolve,reject)=>{
        const request=indexedDB.open('frame-reference-videos',1);
        request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
        request.onblocked=()=>reject(new Error('素材库连接被另一个页面阻塞'));
      }).catch(error=>{connection=undefined;throw error;});
    }
    return connection;
  }
  async function transact(mode,operation){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,mode);
      const request=operation(transaction.objectStore(STORE));
      transaction.oncomplete=()=>resolve(request.result);
      transaction.onabort=()=>reject(transaction.error || request.error);
    });
  }
  return {
    list:()=>transact('readonly',store=>store.getAll()),
    put:asset=>transact('readwrite',store=>store.put(asset)),
    remove:id=>transact('readwrite',store=>store.delete(id))
  };
}

export function isReferenceVideo(file){
  if(!file?.size)return false;
  if(file.type.startsWith('video/'))return true;
  const generic=!file.type||['application/octet-stream','application/x-matroska'].includes(file.type);
  return generic && /\.(mp4|webm|mov|m4v|mkv|ogv|avi)$/i.test(file.name);
}
