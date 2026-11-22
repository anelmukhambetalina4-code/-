import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tmp=await mkdtemp(path.join(tmpdir(),'feedback-test-'));
process.env.DATA_FILE=path.join(tmp,'rooms.json');
process.env.PORT='0';
const {httpServer}=await import('../server.js');
if(!httpServer.listening)await once(httpServer,'listening');
const url=`http://127.0.0.1:${httpServer.address().port}`;
const sockets=[];
function socket(){const s=connect(url,{transports:['websocket'],reconnection:true});sockets.push(s);return s;}
async function connected(s){if(!s.connected)await once(s,'connect');}
function call(s,event,data){return new Promise((resolve,reject)=>{s.timeout(5000).emit(event,data,(e,result)=>e?reject(e):resolve(result));});}
const delay=t=>new Promise(r=>setTimeout(r,t));
async function move(s,auth,point){let x=0,z=8,facing=0;for(const target of point){while(Math.hypot(x-target[0],z-target[1])>.25){const dx=target[0]-x,dz=target[1]-z,d=Math.hypot(dx,dz);x+=dx/d*Math.min(.42,d);z+=dz/d*Math.min(.42,d);s.emit('student:move',{...auth,x,z,facing});await delay(120);}}return {x,z};}

test('Екі оқушы, қауіпсіз рұқсаттар, қозғалыс, жауап жаңарту, қайта кіру және жабу', {timeout:40000},async()=>{
 const response=await fetch(url+'/api/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic:'Информатика',questions:['Не үйрендің?','Не қиын?']})});assert.equal(response.status,200);const {code,teacherToken}=await response.json();
 const t=socket(),a=socket(),b=socket();await Promise.all([connected(t),connected(a),connected(b)]);
 const tj=await call(t,'teacher:join',{code,token:teacherToken});assert.equal(tj.ok,true);
 const aa=await call(a,'student:join',{code,name:'Бірінші',color:0x298c82,head:'cap'});const bb=await call(b,'student:join',{code,name:'Екінші',color:0x7960b8,head:'bun'});assert.equal(aa.ok,true);assert.equal(bb.ok,true);
 const aAuth={code,studentId:aa.studentId,token:aa.token},bAuth={code,studentId:bb.studentId,token:bb.token};
 assert.equal((await call(a,'teacher:action',{code,token:aa.token,action:'start'})).ok,false);
 assert.equal((await call(a,'student:answer',{...aAuth,zone:1,texts:['Иә','Жоқ']})).ok,false);
 assert.equal((await call(t,'teacher:action',{code,token:teacherToken,action:'start'})).ok,true);
 let movementSeen=false;b.on('student:moved',p=>{if(p.id===aa.studentId)movementSeen=true;});
 await move(a,aAuth,[[0,-6]]);assert.equal(movementSeen,true);
 await move(b,bAuth,[[0,-6],[8,-6]]);
 assert.equal((await call(a,'student:answer',{...aAuth,zone:1,texts:['Алгоритм','Цикл']})).ok,true);
 assert.equal((await call(b,'student:answer',{...bAuth,zone:2,texts:['Шарт','Есеп']})).ok,true);
 await delay(100);let result=(await call(t,'teacher:join',{code,token:teacherToken})).room;
 assert.deepEqual(result.stats.counts,[0,1,1]);assert.equal(result.stats.answered,2);assert.equal(result.answers.length,2);
 assert.equal((await call(a,'student:answer',{...aAuth,zone:1,texts:['Жаңартылды','Түсіндім']})).ok,true);
 result=(await call(t,'teacher:join',{code,token:teacherToken})).room;assert.equal(result.stats.answered,2);assert.deepEqual(result.stats.counts,[0,1,1]);
 a.disconnect();await delay(100);const reconnect=socket();await connected(reconnect);const restored=await call(reconnect,'student:join',aAuth);assert.equal(restored.ok,true);assert.equal(restored.me.answer.texts[0],'Жаңартылды');
 const csv=await fetch(url+'/api/export/'+code,{headers:{'x-teacher-token':teacherToken}});assert.equal(csv.status,200);assert.match(await csv.text(),/Жаңартылды/);
 assert.equal((await fetch(url+'/api/export/'+code)).status,403);
 assert.equal((await call(t,'teacher:action',{code,token:teacherToken,action:'close'})).ok,true);
 assert.equal((await call(b,'student:answer',{...bAuth,zone:2,texts:['x','y']})).ok,false);
 const blocked=socket();await connected(blocked);assert.equal((await call(blocked,'student:join',{code,name:'Жаңа'})).ok,false);
});

test.after(async()=>{for(const s of sockets)s.disconnect();await new Promise(resolve=>httpServer.close(resolve));await rm(tmp,{recursive:true,force:true});});
