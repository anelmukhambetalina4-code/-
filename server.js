import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_FILE || path.join(ROOT, 'data', 'rooms.json');
const PORT = Number(process.env.PORT || 3000);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; frame-ancestors 'none'");
  next();
});
app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules', 'three')));
app.use(express.static(path.join(ROOT, 'public')));

const httpServer = createServer(app);
const io = new Server(httpServer, { maxHttpBufferSize: 12000, cors: { origin: false }, pingTimeout: 18000 });
const rooms = new Map();
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const code = () => randomBytes(4).toString('hex').toUpperCase();
const clean = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '';
const validName = value => clean(value, 24).length >= 1;
const zones = [ { x: -8, z: -6 }, { x: 0, z: -6 }, { x: 8, z: -6 } ];
const furniture = [];
for (const z of [1.5, 5]) for (const x of [-8, -4, 4, 8]) furniture.push({x,z,w:2.4,d:1.5});
const finite = n => Number.isFinite(n);
function walkable(x,z) {
  if (!finite(x) || !finite(z) || x < -11.65 || x > 11.65 || z < -8.65 || z > 8.65) return false;
  return !furniture.some(f => Math.abs(x-f.x) < f.w/2 + .36 && Math.abs(z-f.z) < f.d/2 + .36);
}
const counts = r => [0,1,2].map(i => [...r.students.values()].filter(s => s.answer?.zone === i).length);
const publicStudents = r => [...r.students.values()].filter(s => s.online).map(s => ({ id:s.id, name:s.name, color:s.color, head:s.head, x:s.x, z:s.z, facing:s.facing }));
const stats = r => ({ online:publicStudents(r).length, total:r.students.size, answered:[...r.students.values()].filter(s=>s.answer).length, counts:counts(r), state:r.state, accepting:r.accepting });
const publicRoom = r => ({ code:r.code, topic:r.topic, questions:r.questions, state:r.state, accepting:r.accepting, stats:stats(r), students:publicStudents(r) });
const teacherRoom = r => ({ ...publicRoom(r), answers:[...r.students.values()].filter(s=>s.answer).map(s=>({id:s.id,name:s.name,zone:s.answer.zone,texts:s.answer.texts,at:s.answer.at})) });
function verify(raw, digest) { if (typeof raw !== 'string' || !digest || raw.length>180) return false; const a=Buffer.from(hash(raw)); const b=Buffer.from(digest); return a.length===b.length && timingSafeEqual(a,b); }
function serializable(r) { return {code:r.code,teacherHash:r.teacherHash,topic:r.topic,questions:r.questions,state:r.state,accepting:r.accepting,students:[...r.students.values()].map(({online,...s})=>s)}; }
let saveQueue=Promise.resolve();
function persist() {
  const snapshot=JSON.stringify([...rooms.values()].map(serializable),null,2);
  saveQueue=saveQueue.then(async()=>{await fs.mkdir(path.dirname(DATA),{recursive:true});const temp=DATA+'.tmp';await fs.writeFile(temp,snapshot);await fs.rename(temp,DATA);}).catch(err=>console.error('Сақтау қатесі:',err));
  return saveQueue;
}
async function load() {try {const saved=JSON.parse(await fs.readFile(DATA,'utf8'));for(const x of saved){if(x.state==='closed')continue;rooms.set(x.code,{...x,students:new Map(x.students.map(s=>[s.id,{...s,online:false}]))});}}catch(e){if(e.code!=='ENOENT')console.error('Оқу қатесі:',e);}}
const buckets=new Map();
function limited(key, count, ms) {const now=Date.now(), b=buckets.get(key)||[];const fresh=b.filter(v=>now-v<ms);if(fresh.length>=count){buckets.set(key,fresh);return true;}fresh.push(now);buckets.set(key,fresh);return false;}
setInterval(()=>{if(buckets.size>3000)buckets.clear();},60000).unref();
function roomByCode(value) {return rooms.get(String(value||'').toUpperCase());}
function requireTeacher(r, t) {return r && verify(t,r.teacherHash);}
const errMessage = (ack, message) => {if(typeof ack==='function')ack({ok:false,error:message});};
const success = (ack, data={}) => {if(typeof ack==='function')ack({ok:true,...data});};

app.post('/api/rooms',async(req,res)=>{
  if(limited('create:'+req.ip,6,60000))return res.status(429).json({error:'Тым көп сұрау'});
  const topic=clean(req.body?.topic,100);
  const questions=Array.isArray(req.body?.questions)?req.body.questions.map(q=>clean(q,180)).filter(Boolean).slice(0,3):[];
  if(!topic || questions.length<1)return res.status(400).json({error:'Тақырып пен кемінде бір сұрақ енгізіңіз'});
  let c=code();while(rooms.has(c))c=code();const secret=token();
  const r={code:c,teacherHash:hash(secret),topic,questions,state:'waiting',accepting:true,students:new Map()};rooms.set(c,r);await persist();
  res.json({code:c,teacherToken:secret});
});
app.get('/api/qr',async(req,res)=>{
  const r=roomByCode(req.query.code);if(!r)return res.status(404).end();
  const origin=process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const url=`${origin.replace(/\/$/,'')}/?room=${encodeURIComponent(r.code)}`;
  try{res.type('png').send(await QRCode.toBuffer(url,{width:520,margin:4,errorCorrectionLevel:'H'}));}catch{res.status(500).end();}
});
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.get('/api/export/:code',(req,res)=>{
  const r=roomByCode(req.params.code);if(!requireTeacher(r,req.get('x-teacher-token')))return res.status(403).json({error:'Рұқсат жоқ'});
  const csvCell=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+\-@\t\r]/,'\'$&')+'"';
  const rows=[['Оқушы','Аймақ','Уақыт',...r.questions],...[...r.students.values()].filter(s=>s.answer).map(s=>[s.name,['Түсіндім','Жаттығу қажет','Көмек керек'][s.answer.zone],s.answer.at,...s.answer.texts])];
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="reflections-${r.code}.csv"`);
  res.end('\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n'));
});

io.on('connection',socket=>{
  let membership=null;
  const deliverStats=r=>{io.to('room:'+r.code).emit('room:stats',stats(r));io.to('teacher:'+r.code).emit('teacher:data',teacherRoom(r));};
  function authorizeTeacher(data,ack) {
    const r=roomByCode(data?.code);
    if(!requireTeacher(r,data?.token)){errMessage(ack,'Мұғалім токені жарамсыз');return null;}
    return r;
  }
  function authorizeStudent(data,ack) {
    const r=roomByCode(data?.code), s=r?.students.get(data?.studentId);
    if(!r || !s || !verify(data?.token,s.secretHash) || r.state==='closed'){errMessage(ack,'Оқушы сессиясы жарамсыз');return null;}
    if(!membership || membership.type!=='student'|| membership.code!==r.code||membership.id!==s.id){errMessage(ack,'Алдымен бөлмеге қосылыңыз');return null;}
    return {r,s};
  }
  socket.on('teacher:join',(data,ack)=>{
    const r=authorizeTeacher(data,ack);if(!r)return;
    if(membership)leave();membership={type:'teacher',code:r.code};socket.join('teacher:'+r.code);
    success(ack,{room:teacherRoom(r)});
  });
  socket.on('student:join',(data,ack)=>{
    if(limited('join:'+socket.handshake.address,20,60000))return errMessage(ack,'Қосылу жиілігі шектелді');
    const r=roomByCode(data?.code);if(!r||r.state==='closed')return errMessage(ack,'Бөлме табылмады немесе жабық');
    let s=null, newSecret=null;
    if(data?.studentId && data?.token){const candidate=r.students.get(data.studentId);if(candidate&&verify(data.token,candidate.secretHash))s=candidate;else return errMessage(ack,'Сақталған сессия жарамсыз');}
    if(!s){if(r.students.size>=30)return errMessage(ack,'Бөлмеде орын жоқ (30 оқушы)');if(!validName(data?.name))return errMessage(ack,'Лақап ат енгізіңіз');
      const id=randomBytes(12).toString('hex');newSecret=token();s={id,secretHash:hash(newSecret),name:clean(data.name,24),color:[0x298c82,0x7960b8,0xe78c54,0x5276b1,0xcc647e].includes(data.color)?data.color:0x298c82,head:['hair','cap','bun'].includes(data.head)?data.head:'hair',x:0,z:8,facing:Math.PI,answer:null,online:false};r.students.set(id,s);persist();}
    if(membership)leave();
    // A second tab with the same credentials takes over the participant session.
    for(const other of io.sockets.sockets.values())if(other!==socket&&other.data.studentKey===r.code+':'+s.id){other.emit('session:replaced');other.disconnect(true);}
    s.online=true;membership={type:'student',code:r.code,id:s.id};socket.data.studentKey=r.code+':'+s.id;socket.join('room:'+r.code);
    success(ack,{studentId:s.id,token:newSecret||data.token,room:publicRoom(r),me:{id:s.id,name:s.name,color:s.color,head:s.head,x:s.x,z:s.z,facing:s.facing,answer:s.answer}});
    socket.to('room:'+r.code).emit('student:joined',{id:s.id,name:s.name,color:s.color,head:s.head,x:s.x,z:s.z,facing:s.facing});deliverStats(r);
  });
  socket.on('teacher:action',(data,ack)=>{
    const r=authorizeTeacher(data,ack);if(!r)return;
    if(!membership||membership.type!=='teacher'||membership.code!==r.code)return errMessage(ack,'Мұғалім панеліне қосылыңыз');
    if(limited('action:'+r.code,15,10000))return errMessage(ack,'Әрекеттер тым жиі орындалды');
    if(data.action==='start'&&r.state==='waiting')r.state='running';
    else if(data.action==='toggle'&&r.state==='running')r.accepting=!r.accepting;
    else if(data.action==='close'&&r.state!=='closed'){r.state='closed';r.accepting=false;}
    else return errMessage(ack,'Бұл әрекетке рұқсат жоқ');
    persist();io.to('room:'+r.code).emit('room:state',{state:r.state,accepting:r.accepting});deliverStats(r);success(ack);
  });
  socket.on('student:move',(data,ack)=>{
    const auth=authorizeStudent(data,ack);if(!auth)return;const {r,s}=auth;
    if(r.state!=='running')return;
    if(limited('move:'+r.code+':'+s.id,25,1000))return;
    const x=Number(data.x),z=Number(data.z),facing=Number(data.facing);
    if(!walkable(x,z)||!finite(facing))return socket.emit('student:correction',{x:s.x,z:s.z});
    const now=Date.now(),dt=Math.min(.25, Math.max(.04,(now-(s.lastMove||now-100))/1000));
    if(Math.hypot(x-s.x,z-s.z)>5.4*dt+.22)return socket.emit('student:correction',{x:s.x,z:s.z});
    s.x=x;s.z=z;s.facing=facing;s.lastMove=now;
    socket.to('room:'+r.code).emit('student:moved',{id:s.id,x,z,facing});
  });
  socket.on('student:answer',(data,ack)=>{
    const auth=authorizeStudent(data,ack);if(!auth)return;const {r,s}=auth;
    if(r.state!=='running'||!r.accepting)return errMessage(ack,'Жауап қабылдау жабық');
    if(limited('answer:'+r.code+':'+s.id,4,10000))return errMessage(ack,'Бірнеше секундтан кейін қайталаңыз');
    const zone=Number(data.zone);if(!Number.isInteger(zone)||zone<0||zone>2)return errMessage(ack,'Аймақ дұрыс емес');
    if(Math.hypot(s.x-zones[zone].x,s.z-zones[zone].z)>3.2)return errMessage(ack,'Алдымен таңдаған аймаққа жақындаңыз');
    if(!Array.isArray(data.texts)||data.texts.length!==r.questions.length)return errMessage(ack,'Барлық сұраққа жауап беріңіз');
    const texts=data.texts.map(v=>clean(v,500));if(texts.some(v=>!v))return errMessage(ack,'Бос жауап жіберуге болмайды');
    s.answer={zone,texts,at:new Date().toISOString()};persist();deliverStats(r);success(ack,{answer:s.answer});
  });
  function leave(){if(!membership)return;const m=membership;membership=null;
    if(m.type==='student'){const r=rooms.get(m.code),s=r?.students.get(m.id);if(s){s.online=false;s.lastMove=null;socket.to('room:'+r.code).emit('student:left',{id:s.id});deliverStats(r);}}
    socket.leave(m.type==='student'?'room:'+m.code:'teacher:'+m.code);
  }
  socket.on('disconnect',leave);
});

await load();
httpServer.listen(PORT,'0.0.0.0',()=>console.log(`Кері байланыс әлемі: http://localhost:${PORT}`));
export {httpServer};
