import {initialProfile,reduceProfile,validateProfile,syncDailyAndWeekly,type Action,type Profile} from './economy.ts';
let database:Promise<IDBDatabase>|null=null;
export function openDatabase(){
 return database??=new Promise<IDBDatabase>((resolve,reject)=>{
  const req=indexedDB.open('orbit-arcade',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('save');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('이 브라우저에서 저장소를 열 수 없습니다.'));
  req.onblocked=()=>reject(new Error('다른 게임 탭을 닫고 다시 열어 주세요.'));
 });
}
export async function readProfile():Promise<Profile>{
 const db=await openDatabase();return new Promise((resolve,reject)=>{const req=db.transaction('save').objectStore('save').get('profile');req.onsuccess=()=>{try{if(!req.result){resolve(initialProfile());return;}const profile=validateProfile(req.result);syncDailyAndWeekly(profile,Date.now());resolve(profile);}catch(e){reject(e);}};req.onerror=()=>reject(req.error);});
}
export async function changeProfile(action:Action|{type:'import';profile:Profile}):Promise<Profile>{
 const db=await openDatabase();return new Promise((resolve,reject)=>{
  const tx=db.transaction('save','readwrite'),store=tx.objectStore('save'),req=store.get('profile');let result:Profile;let failure:unknown;
  req.onsuccess=()=>{try{const old=req.result?validateProfile(req.result):initialProfile();if(action.type==='import'){if(old.pending.length)throw new Error('진행 중인 게임이 모두 끝난 뒤 복원해 주세요.');result=validateProfile(action.profile,true);result.savedAt=Date.now();}else result=reduceProfile(old,action);store.put(result,'profile');}catch(e){failure=e;tx.abort();}};
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(failure??new Error('저장에 실패했습니다. 저장 공간을 확인해 주세요.'));tx.onabort=()=>reject(failure??new Error('저장에 실패했습니다. 변경 내용은 적용되지 않았습니다.'));
 });
}
