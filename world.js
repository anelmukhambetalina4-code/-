import * as THREE from '/vendor/three/build/three.module.js';
const zoneNames=['ТҮСІНДІМ','ЖАТТЫҒУ КЕРЕК','КӨМЕК КЕРЕК'];
const spots=[{x:-8,z:-6,color:0x6ac796},{x:0,z:-6,color:0xf5cf6d},{x:8,z:-6,color:0xe18f88}];
const furniture=[];for(const z of [1.5,5])for(const x of [-8,-4,4,8])furniture.push({x,z,w:2.4,d:1.5});
const blocked=(x,z)=>x< -11.65||x>11.65||z< -8.65||z>8.65||furniture.some(f=>Math.abs(x-f.x)<f.w/2+.36&&Math.abs(z-f.z)<f.d/2+.36);
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.88,...extra});
function cube(scene,w,h,d,color,x,y,z,extra={}){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,extra));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
function capsuleLabel(text,width=4,height=.64,color='#ffffff',bg='#365b4b'){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(0,0,768,128,27);ctx.fill();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 45px system-ui';ctx.fillText(text,384,67,725);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));return {mesh:m,canvas,ctx,texture};
}
function ball(parent,r,color,x,y,z){const a=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat(color));a.position.set(x,y,z);a.castShadow=true;parent.add(a);return a;}
function makeAvatar(student){const root=new THREE.Group();root.position.set(student.x,0,student.z);root.rotation.y=student.facing||0;
 const torso=new THREE.Mesh(new THREE.BoxGeometry(.7,.88,.36),mat(student.color));torso.position.y=1.17;torso.castShadow=true;root.add(torso);
 ball(root,.29,0xf5c9a9,0,1.9,0);cube(root,.35,.1,.35,0x4e3530,0,2.13,0);
 if(student.head==='cap'){const brim=new THREE.Mesh(new THREE.BoxGeometry(.57,.1,.43),mat(0x3b5c71));brim.position.set(0,2.15,-.16);root.add(brim);}if(student.head==='bun')ball(root,.16,0x49352d,0,2.12,.21);
 const limbs=[];for(let i=0;i<4;i++){const leg=i>=2,part=new THREE.Group();const side=i%2===0?-1:1;part.position.set(leg?side*.2:side*.48,leg?.81:1.48,0);const shape=new THREE.Mesh(new THREE.BoxGeometry(leg?.22:.22,leg?.74:.73,leg?.24:.25),mat(leg?0x344b62:student.color));shape.position.y=leg?-.34:-.32;part.add(shape);root.add(part);limbs.push(part);}
 const label=capsuleLabel(student.name,1.7,.35);label.mesh.position.set(0,2.65,0);root.add(label.mesh);return {root,limbs,label:label.mesh,target:new THREE.Vector3(student.x,0,student.z),facing:student.facing||0,phase:0,walking:false};}
function plants(scene,x,z){cube(scene,.63,.65,.63,0xc29b74,x,.32,z);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.055,.065,.85),mat(0x537b4a));stem.position.set(x,1.07,z);scene.add(stem);for(let i=0;i<5;i++)ball(scene,.36,0x598d62,x+Math.sin(i*2.5)*.25,1.45+Math.sin(i)*.2,z+Math.cos(i*2.5)*.25);}
function createClassroom(scene){scene.background=new THREE.Color(0xcadfda);scene.fog=new THREE.Fog(0xcadfda,26,56);cube(scene,25,.4,19,0xe5d7b7,0,-.25,0);cube(scene,25,5,.35,0xf0e8d7,0,2.35,-9.55);cube(scene,.35,5,19,0xf0e8d7,-12.5,2.35,0);cube(scene,.35,5,19,0xf0e8d7,12.5,2.35,0);cube(scene,25,5,.3,0xece5d7,0,2.35,9.55);
 // Windows (non-interactive architectural set dressing)
 for(const x of [-9,-4.6,4.6,9]){cube(scene,2.9,2.3,.045,0xa9dbdf,x,2.9,-9.33,{emissive:0x193c39,emissiveIntensity:.07});cube(scene,.08,2.4,.15,0xfff6e9,x,2.9,-9.26);cube(scene,3,.08,.15,0xfff6e9,x,2.9,-9.26);}
 cube(scene,8.8,2.65,.16,0x315449,0,3,-9.3);cube(scene,9.1,.16,.27,0xc99d68,0,1.6,-9.18);
 for(const s of spots){const pad=cube(scene,6,.036,4.65,s.color,s.x,.007,s.z);pad.material.transparent=true;pad.material.opacity=.76;const sign=capsuleLabel(zoneNames[spots.indexOf(s)],3.9,.55,'#223b33','#ffffff');sign.mesh.position.set(s.x,1.5,s.z-2.05);scene.add(sign.mesh);}
 for(const f of furniture){cube(scene,2.4,.13,1.5,0xb7895d,f.x,1.13,f.z);for(const dx of [-.95,.95])for(const dz of [-.51,.51])cube(scene,.11,1.04,.11,0x86765c,f.x+dx,.54,f.z+dz);cube(scene,.85,.1,.6,0x8faaa1,f.x,.57,f.z+1.15);cube(scene,.13,.86,.13,0x72887d,f.x,.4,f.z+1.15);cube(scene,.88,.75,.1,0x8faaa1,f.x,.96,f.z+1.46);}
 plants(scene,-11,7.6);plants(scene,11,7.6);plants(scene,-11,-7.6);plants(scene,11,-7.6);
 const hemi=new THREE.HemisphereLight(0xffffff,0xa9a28c,2.5);scene.add(hemi);const sun=new THREE.DirectionalLight(0xffefca,2.8);sun.position.set(1,12,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-17;sun.shadow.camera.right=17;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-17;scene.add(sun);
 const board=document.createElement('canvas');board.width=1000;board.height=320;const texture=new THREE.CanvasTexture(board);texture.colorSpace=THREE.SRGBColorSpace;const screen=new THREE.Mesh(new THREE.PlaneGeometry(7.8,2.1),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));screen.position.set(0,3,-9.165);scene.add(screen);
 return counts=>{const ctx=board.getContext('2d');ctx.fillStyle='#315449';ctx.fillRect(0,0,1000,320);ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.font='bold 37px system-ui';ctx.fillText('СЫНЫП НӘТИЖЕСІ',500,56);['#80df9c','#f6d67a','#ef9c91'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.roundRect(45+i*325,91,280,188,18);ctx.fill();ctx.fillStyle='#273d36';ctx.font='bold 84px system-ui';ctx.fillText(String(counts[i]),185+i*325,208);ctx.font='bold 24px system-ui';ctx.fillText(['Түсіндім','Жаттығу','Көмек'][i],185+i*325,250);});texture.needsUpdate=true;};
}
export function startWorld(canvas,{onMove,onZone}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,70),renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const redrawBoard=createClassroom(scene);redrawBoard([0,0,0]);const students=new Map();let meId=null,active=false,paused=false,myAnswer=null,zone=-1;
 const indicator=document.getElementById('moveIndicator');const keys=new Set(),joy={x:0,y:0};let cameraAngle=0,cameraPitch=.43,dragging=false,previousX=0,previousY=0,lastSend=0;
 const isEditing=()=>document.activeElement?.matches('input,textarea,select,[contenteditable]');
 window.addEventListener('keydown',e=>{if(isEditing()||e.ctrlKey||e.altKey||e.metaKey)return;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys.add(e.key);e.preventDefault();}});
 window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
 canvas.addEventListener('pointerdown',e=>{dragging=true;previousX=e.clientX;previousY=e.clientY;});window.addEventListener('pointerup',()=>dragging=false);window.addEventListener('pointermove',e=>{if(!dragging)return;cameraAngle-=(e.clientX-previousX)*.006;cameraPitch=THREE.MathUtils.clamp(cameraPitch+(e.clientY-previousY)*.004,.22,.85);previousX=e.clientX;previousY=e.clientY;});
 const joystick=document.getElementById('joystick'),stick=document.getElementById('stick');function joyUpdate(e){const r=joystick.getBoundingClientRect();let x=(e.clientX-(r.left+r.width/2))/45,y=(e.clientY-(r.top+r.height/2))/45;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}joy.x=x;joy.y=y;stick.style.transform=`translate(${x*37}px,${y*37}px)`;}
 joystick.addEventListener('pointerdown',e=>{joystick.setPointerCapture(e.pointerId);joyUpdate(e);});joystick.addEventListener('pointermove',e=>{if(joystick.hasPointerCapture(e.pointerId))joyUpdate(e);});function release(){joy.x=0;joy.y=0;stick.style.transform='';}joystick.addEventListener('pointerup',release);joystick.addEventListener('pointercancel',release);joystick.addEventListener('lostpointercapture',release);
 function addStudent(s){if(students.has(s.id))return;const a=makeAvatar(s);scene.add(a.root);students.set(s.id,a);}
 function removeStudent(id){const avatar=students.get(id);if(!avatar)return;scene.remove(avatar.root);avatar.root.traverse(node=>{if(node.geometry)node.geometry.dispose();if(node.material){if(node.material.map)node.material.map.dispose();node.material.dispose();}});students.delete(id);}
 function initialize(list,me){for(const id of [...students.keys()])removeStudent(id);meId=me.id;for(const s of list)addStudent(s);if(!students.has(meId))addStudent(me);myAnswer=me.answer||null;camera.position.set(me.x,5.5,me.z+7);}
 function moveStudent(s){const a=students.get(s.id);if(a){a.target.set(s.x,0,s.z);a.facing=s.facing;a.walking=true;}}
 function correct(s){const a=students.get(meId);if(a){a.root.position.set(s.x,0,s.z);a.target.copy(a.root.position);}}
 let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;const me=students.get(meId);
 if(me){let x=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0)+joy.x;let y=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0)+joy.y;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
 if(indicator) indicator.textContent=!active?'Мұғалімнің бастауын күтіңіз':paused?'Қозғалыс тоқтатылды':length>.1?'Кейіпкер қозғалып жатыр':'Джойстикті ұстап жылжытыңыз';
 if(active&&!paused&&length>.1){const dx=(Math.cos(cameraAngle)*x+Math.sin(cameraAngle)*y)*4*dt;const dz=(-Math.sin(cameraAngle)*x+Math.cos(cameraAngle)*y)*4*dt;const p=me.root.position;if(!blocked(p.x+dx,p.z))p.x+=dx;if(!blocked(p.x,p.z+dz))p.z+=dz;me.root.rotation.y=Math.atan2(-dx,-dz);me.facing=me.root.rotation.y;me.walking=true;if(now-lastSend>=85){onMove({x:p.x,z:p.z,facing:me.facing});lastSend=now;}}
 else me.walking=false;
 const p=me.root.position;const nearest=spots.findIndex(s=>Math.hypot(p.x-s.x,p.z-s.z)<2.95);if(zone!==nearest){zone=nearest;onZone(zone);}
 // Third-person chase: camera bounded to interior and kept above furniture.
 const distance=5.8,h=3.1+cameraPitch*2.9;const desired=new THREE.Vector3(THREE.MathUtils.clamp(p.x+Math.sin(cameraAngle)*distance,-11.1,11.1),h,THREE.MathUtils.clamp(p.z+Math.cos(cameraAngle)*distance,-8.9,8.9));camera.position.lerp(desired,Math.min(1,dt*6));camera.lookAt(p.x,1.4,p.z);}
 for(const [id,a] of students){if(id!==meId){const d=a.root.position.distanceTo(a.target);a.root.position.lerp(a.target,Math.min(1,dt*12));a.root.rotation.y=a.facing;a.walking=d>.035;}a.label.lookAt(camera.position);a.phase+=dt*(a.walking?11:2);a.limbs.forEach((part,i)=>part.rotation.x=a.walking?Math.sin(a.phase+(i%2===0?0:Math.PI))*.4:0);}
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}renderer.render(scene,camera);
 }requestAnimationFrame(frame);
 return {initialize,addStudent,removeStudent,moveStudent,correct,setStats:redrawBoard,setActive:v=>active=v,setPaused:v=>{paused=v;if(v)keys.clear();},get myAnswer(){return myAnswer;},set myAnswer(v){myAnswer=v;}};
}
