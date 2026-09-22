import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeProfile,readProfile} from '../src/storage.ts';
test('IndexedDB serializes concurrent purchases and preserves save after reload',async()=>{
 await changeProfile({type:'reset'});
 const results=await Promise.allSettled([changeProfile({type:'buy',id:'ball-lime'}),changeProfile({type:'buy',id:'ball-lime'})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const p=await readProfile();assert.equal(p.balance,9500);assert.equal(p.owned.filter(x=>x==='ball-lime').length,1);
 await changeProfile({type:'drop',id:'lost',bet:500});await changeProfile({type:'recover'});await changeProfile({type:'recover'});assert.equal((await readProfile()).balance,9500);
});
