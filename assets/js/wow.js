import {answerFor} from './guide-answers.mjs';
import {ByteMotion} from './byte-motion.mjs';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches;
try{paused=paused||localStorage.getItem('uteach-motion')==='paused';}catch{}
const motion=document.createElement('button');motion.className='motion-toggle';motion.type='button';
function syncMotion(){document.documentElement.classList.toggle('motion-paused',paused);motion.textContent=paused?'Motion: paused':'Pause motion';motion.setAttribute('aria-pressed',String(paused));}
syncMotion();document.body.append(motion);
motion.onclick=()=>{paused=!paused;syncMotion();try{localStorage.setItem('uteach-motion',paused?'paused':'on');}catch{}};
reduced.addEventListener('change',e=>{paused=e.matches;syncMotion();});
const targets=document.querySelectorAll('.heading-row h2,.approach h2,.approach-items article,.path-card,.reviews .quote,.repair-layout>div,.closing h2');
if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('entered');io.unobserve(e.target);}}),{threshold:.12});targets.forEach((e,i)=>{e.classList.add('arrival');e.style.setProperty('--delay',`${i%3*90}ms`);io.observe(e);});}
document.querySelectorAll('.btn,.path-card').forEach(el=>{
 el.addEventListener('pointermove',e=>{if(paused||e.pointerType==='touch')return;const r=el.getBoundingClientRect();el.style.setProperty('--px',`${(e.clientX-r.left)/r.width*100}%`);el.style.setProperty('--py',`${(e.clientY-r.top)/r.height*100}%`);});
});
const bot=document.createElement('button');bot.type='button';bot.className='byte-pet';bot.setAttribute('aria-label','Chat with Byte, your site guide');bot.setAttribute('aria-expanded','false');bot.setAttribute('aria-controls','byte-chat');bot.innerHTML='<span class="byte-fallback" aria-hidden="true">🤖</span><span class="byte-label">Ask Byte</span>';document.body.append(bot);
const chat=document.createElement('section');chat.id='byte-chat';chat.className='byte-chat';chat.hidden=true;chat.setAttribute('role','dialog');chat.setAttribute('aria-labelledby','byte-title');
chat.innerHTML='<header><div><strong id="byte-title">Byte, your site guide</strong><span>A little help finding your way.</span></div><button type="button" class="byte-close" aria-label="Close chat">×</button></header><div class="byte-log" role="log" aria-live="polite" aria-relevant="additions"></div><div class="byte-choices"><button>Kids’ courses</button><button>Senior lessons</button><button>Repair help</button><button>Book a visit</button></div><form class="byte-form"><label class="sr-only" for="byte-input">Ask Byte a navigation question</label><input id="byte-input" placeholder="What can I help you find?" maxlength="400" autocomplete="off" required><button type="submit" aria-label="Send question">↗</button></form>';
document.body.append(chat);const log=chat.querySelector('.byte-log');const input=chat.querySelector('input');
function message(text,user=false,links=[]){const bubble=document.createElement('div');bubble.className=user?'byte-message user':'byte-message';const p=document.createElement('p');p.textContent=text;bubble.append(p);links.forEach(([label,url])=>{const a=document.createElement('a');a.textContent=label+' ↗';a.href=url;bubble.append(a);});log.append(bubble);log.scrollTop=log.scrollHeight;}
message('Hi, I’m Byte! I can help you find courses, repair services, booking, and contact details. What are you looking for?');
function ask(q){if(!q.trim())return;message(q,true);const a=answerFor(q);message(a.text,false,a.links);input.value='';}
chat.querySelector('form').addEventListener('submit',e=>{e.preventDefault();ask(input.value);});chat.querySelectorAll('.byte-choices button').forEach(b=>b.onclick=()=>ask(b.textContent));
let open=false,hover=false;
const walker=new ByteMotion(innerWidth-78,innerHeight-65+scrollY);
let footPixel=88,walkingReady=false,movementTime=0;
let lastScrollAt=-1e9;   // when the page last actually moved, for the catch-up gate
function place(){bot.style.transform=`translate3d(${walker.position.x-48}px,${walker.position.y-scrollY-footPixel}px,0)`;bot.dataset.movement=walker.state;bot.style.setProperty('--air-shadow',walker.state==='jump'?'.12':'.3');}
place();
function toggleChat(value){open=value;chat.hidden=!value;bot.setAttribute('aria-expanded',String(value));if(value)input.focus();else bot.focus();}
bot.onclick=()=>toggleChat(!open);chat.querySelector('.byte-close').onclick=()=>toggleChat(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open)toggleChat(false);});
bot.addEventListener('pointerenter',()=>hover=true);bot.addEventListener('pointerleave',()=>hover=false);
// Every horizontal edge Byte can stand on: section tops (the band boundaries),
// every image, every line break, and the interactive blocks. A <br> is included
// because it marks a real visual line in the copy even though it draws nothing.
const platforms=[...document.querySelectorAll(
 'main section,main img,main hr,main br,main .btn,main .card,main .quote,main .path-card,main .path-image,main .hero-stage,main .magnetic'
)];

// A <br> has no box of its own — its rect is a zero-width sliver at the end of
// the line. Borrow the parent block's horizontal extent so the line break
// becomes a proper ledge spanning the text column.
function ledgeRect(element){
 const r=element.getBoundingClientRect();
 if(element.tagName!=='BR')return r;
 const host=element.parentElement;
 if(!host)return r;
 const h=host.getBoundingClientRect();
 return {left:h.left,width:h.width,top:r.top||h.top,height:0};
}

function measure(surface){
 if(surface.dock)return {...surface,left:innerWidth-160,top:innerHeight-55+scrollY,width:140};
 const r=ledgeRect(surface.element);
 return {...surface,left:r.left+scrollX,top:r.top+scrollY,width:r.width};
}

// Rects are cached rather than remeasured per frame: the fall does a collision
// test every tick, and calling getBoundingClientRect on ~40 nodes at 60fps
// would force a layout flush each time.
let ledges=[],ledgesStale=true;
function refreshLedges(){
 const found=platforms.map(element=>measure({element})).filter(r=>r.width>90&&Number.isFinite(r.top));
 // An image inside a card produces three ledges on identical coordinates — the
 // <img>, its .path-image wrapper and the <a> around both. They are the same
 // physical line, so keep one and let the innermost element win, which makes
 // "he landed on the image" true in the obvious sense as well as the visual one.
 const rank=el=>el&&el.tagName==='IMG'?0:1;
 const seen=new Map();
 for(const r of found){
  const key=`${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}`;
  const prev=seen.get(key);
  if(!prev||rank(r.element)<rank(prev.element))seen.set(key,r);
 }
 ledges=[...seen.values()];
 ledgesStale=false;
}
function allLedges(){if(ledgesStale)refreshLedges();return ledges;}
addEventListener('resize',()=>{ledgesStale=true;},{passive:true});

// The lower bound is innerHeight-96, not -25: his feet sit 88px below the top
// of his sprite, so a ledge 25px off the bottom left him hanging half off the
// screen once he deliberately started heading downward.
function visiblePlatforms(){return allLedges().filter(r=>r.width>110&&r.top-scrollY>190&&r.top-scrollY<innerHeight-96&&r.left>=0&&r.left+r.width<=innerWidth+2);}

// Highest ledge crossed while falling from `from` to `to` at horizontal x.
// Sweeping the segment (rather than testing the end point) stops a fast fall
// from tunnelling through a thin ledge between two frames.
function findGround(x,from,to){
 let best=null;
 for(const r of allLedges()){
  if(r.top<=from||r.top>to)continue;           // not crossed this frame
  if(x<r.left+6||x>r.left+r.width-6)continue;  // not above this ledge
  if(!best||r.top<best.top)best=r;             // land on the first one met
 }
 return best;
}

// Nothing below him at all — settle on the bottom of the document so he can
// never fall out of the page and vanish.
function floorLedge(){
 const bottom=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
 return {floor:true,left:0,width:innerWidth,top:bottom-90};
}
// Where he prefers to sit when the page is still: low in the viewport. Resting
// high up meant almost any scroll immediately pushed his ledge past the
// step-off line and dropped him, so he was falling constantly. Descending on
// his own while nothing is moving buys that headroom back, and makes the fall
// something the reader causes rather than something that just keeps happening.
const SETTLE_ZONE=.62;          // fraction of the viewport height to aim for
const MAX_HOP_DOWN=520;         // px; keeps a deliberate hop readable, not a plunge

function nextAction(){
 const options=visiblePlatforms();if(!options.length){if(!walker.surface?.dock){walker.hasRun=true;walker.jump(measure({dock:true}),.5);}return;}
 const current=walker.surface;
 const restLine=scrollY+innerHeight*SETTLE_ZONE;

 // Still sitting above the resting line: deliberately work downward, taking
 // the lowest ledge within one comfortable hop each time.
 if(walker.position.y<restLine){
  const down=options.filter(o=>o.element!==current?.element&&o.top>walker.position.y+30&&o.top-walker.position.y<MAX_HOP_DOWN);
  if(down.length){
   down.sort((a,b)=>b.top-a.top);       // lowest first
   walker.hasRun=false;
   walker.jump(down[0],walker.direction>0?.35:.65);
   return;
  }
 }

 // Settled low enough — resume wandering. Traverse the current ledge before
 // launching to another; favour lower ledges.
 if(current&&!walker.hasRun&&current.width>150){walker.hasRun=true;walker.run(current,walker.fraction>.5?.15:.85);return;}
 const other=options.filter(o=>o.element!==current?.element);
 const below=other.filter(o=>o.top>walker.position.y+35&&o.top-walker.position.y<650);
 const pool=below.length?below:other.length?other:options;
 pool.sort((a,b)=>Math.hypot(a.left+a.width/2-walker.position.x,a.top-walker.position.y)-Math.hypot(b.left+b.width/2-walker.position.x,b.top-walker.position.y));
 const next=pool[0];if(next){walker.hasRun=false;walker.jump(next,walker.direction>0?.2:.8);}
}
function moveByte(now){
 const dt=movementTime?Math.min((now-movementTime)/1000,.05):0;movementTime=now;
 const stopped=paused||open||hover||document.activeElement===bot||document.hidden||innerWidth<700;
 if(!stopped&&walkingReady){
  walker.update(dt,measure,findGround);
  // Scrolling can outrun gravity, so he gets dragged down to the top edge to
  // stay on screen. That drag is a teleport, so it has to be collision-tested
  // like the fall itself — otherwise he is silently moved past every ledge in
  // the gap and only ever lands once he out-accelerates the scroll, hundreds
  // of pixels further down.
  // Scrolling back up leaves him standing on a ledge far below the fold, where
  // he is simply invisible until you scroll down again. Drop him in from the
  // top of the viewport instead so he rejoins you under his own steam.
  if(walker.position.y>scrollY+innerHeight+220){
   walker.position.y=scrollY+STEP_OFF;
   walker.fall();
  }

  // The catch-up exists purely to stop scrolling from outrunning gravity, so
  // it only applies while the page is actually moving or he is already in the
  // air. Running it on a still page fought the deliberate descent below and
  // livelocked him: it re-landed him every frame, so he never reached idle and
  // never got to choose a next move.
  const scrolling=now-lastScrollAt<400;
  const ceiling=scrollY+STEP_OFF;
  if((scrolling||walker.state==='fall')&&walker.position.y<ceiling){
   const dragged=findGround(walker.position.x,walker.position.y,ceiling);
   // Sweep whatever state he is in. Restricting this to the fall state meant a
   // ledge he was standing on could scroll past the ceiling and drag him
   // straight through the images below it without ever touching down.
   if(dragged){walker.impact=Math.max(walker.velocityY,420);walker.land(dragged);}
   else walker.catchUp(ceiling);
  }
  // Ran out of page beneath him — plant him on the document floor rather than
  // letting him accelerate away forever.
  if(walker.state==='fall'){const floor=floorLedge();if(walker.position.y>=floor.top){walker.impact=walker.velocityY;walker.land(floor);}}
  if(walker.state==='idle'&&walker.elapsed>=walker.wait)nextAction();
 }
 else if(walker.surface&&walker.state!=='jump'){
  const r=measure(walker.surface);walker.position.x=r.left+24+(r.width-48)*walker.fraction;walker.position.y=r.top;
 }
 // Small screens keep a predictable launcher. Desktop motion resumes from there.
 if(innerWidth<700){walker.position={x:innerWidth-70,y:innerHeight-65+scrollY};walker.surface=null;walker.state='idle';walker.elapsed=0;}
 place();
}
// Scrolling down drags his ledge up and off the top of the screen; once it
// reaches the header he steps off and gravity takes him to the next line down.
// Keep scrolling and he cascades from section top to image to line break.
const STEP_OFF=140;               // px below the viewport top where he lets go
let lastScrollY=scrollY;
window.addEventListener('scroll',()=>{
 ledgesStale=true;                // layout moved under us; rects need remeasuring
 lastScrollAt=performance.now();
 const goingDown=scrollY>lastScrollY;lastScrollY=scrollY;
 if(goingDown&&!paused&&innerWidth>=700&&walkingReady&&walker.surface&&
    !walker.surface.dock&&!walker.surface.floor&&
    (walker.state==='idle'||walker.state==='run'||walker.state==='land')&&
    walker.surface.top-scrollY<STEP_OFF){
  walker.fall();
 }
 place();
},{passive:true});
let mouse={x:0,y:0};window.addEventListener('pointermove',e=>{mouse={x:e.clientX/innerWidth*2-1,y:e.clientY/innerHeight*2-1};},{passive:true});
// Both characters are real 3D models, lit and rendered locally with WebGL.
try{
 const THREE=await import('../vendor/three.module.js');
 function rounded(w,h,d,r,material){const shape=new THREE.Shape(),x=-w/2,y=-h/2;shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.07,bevelThickness:.07,curveSegments:10});g.translate(0,0,-d/2);return new THREE.Mesh(g,material);}
 function robot(){const root=new THREE.Group();const white=new THREE.MeshStandardMaterial({color:0xf4f3e9,roughness:.3,metalness:.22});const blue=new THREE.MeshStandardMaterial({color:0x294cff,roughness:.28,metalness:.3});const black=new THREE.MeshStandardMaterial({color:0x10172a,roughness:.2,metalness:.5});const lime=new THREE.MeshStandardMaterial({color:0xdaff65,emissive:0xb5ff38,emissiveIntensity:.8,roughness:.25});
 const head=new THREE.Group();head.position.y=.85;root.add(head);head.add(rounded(1.5,1.08,.78,.23,white));const face=rounded(1.23,.7,.07,.2,black);face.position.set(0,-.02,.47);head.add(face);
 const eyes=[];[-.3,.3].forEach(x=>{const eye=rounded(.18,.29,.03,.07,lime);eye.position.set(x,.03,.55);head.add(eye);eyes.push(eye);});const smile=new THREE.Mesh(new THREE.TorusGeometry(.14,.027,8,24,Math.PI),lime);smile.rotation.z=Math.PI;smile.position.set(0,-.14,.55);head.add(smile);
 const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.33,12),blue);antenna.position.y=.75;head.add(antenna);const tip=new THREE.Mesh(new THREE.SphereGeometry(.11,16,12),lime);tip.position.y=.94;head.add(tip);
 [-.85,.85].forEach(x=>{const ear=new THREE.Mesh(new THREE.SphereGeometry(.16,16,12),blue);ear.scale.set(.7,1,1);ear.position.set(x,0,0);head.add(ear);});
 const torso=rounded(.96,.74,.64,.18,blue);torso.position.y=-.28;root.add(torso);const badge=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),lime);badge.scale.z=.3;badge.position.set(0,-.23,.4);root.add(badge);
 const arms=[],elbows=[],legs=[],knees=[],feet=[];
 [-1,1].forEach(side=>{
  const shoulder=new THREE.Group();shoulder.position.set(side*.64,-.06,0);root.add(shoulder);arms.push(shoulder);
  const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.2,4,12),white);upper.position.y=-.15;shoulder.add(upper);
  const elbow=new THREE.Group();elbow.position.y=-.31;shoulder.add(elbow);elbows.push(elbow);
  const lower=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.13,4,12),white);lower.position.y=-.1;elbow.add(lower);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(.135,16,12),white);hand.position.y=-.23;elbow.add(hand);
  const hip=new THREE.Group();hip.position.set(side*.28,-.65,0);root.add(hip);legs.push(hip);
  const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.19,4,12),blue);thigh.position.y=-.13;hip.add(thigh);
  const knee=new THREE.Group();knee.position.y=-.28;hip.add(knee);knees.push(knee);
  const shin=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.15,4,12),white);shin.position.y=-.11;knee.add(shin);
  const ankle=new THREE.Group();ankle.position.y=-.25;knee.add(ankle);
  const foot=rounded(.34,.19,.46,.08,white);foot.position.set(0,-.045,.08);ankle.add(foot);feet.push(ankle);
 });return {root,head,eyes,arms,elbows,legs,knees,feet};}
 function poseRig(m,state,phase,progress,face,t){
  m.root.rotation.set(0,face,0);m.root.position.y=0;m.root.scale.set(1,1,1);
  m.legs.forEach((leg,i)=>{leg.rotation.set(0,0,0);m.knees[i].rotation.x=0;m.feet[i].rotation.x=0;m.arms[i].rotation.set(0,0,i===0?-.12:.12);m.elbows[i].rotation.x=-.2;});
  if(state==='run'){
   m.legs.forEach((leg,i)=>{const cycle=phase+i*Math.PI;leg.rotation.x=Math.sin(cycle)*.72;m.knees[i].rotation.x=-Math.max(0,Math.cos(cycle))*.95;m.feet[i].rotation.x=-leg.rotation.x-m.knees[i].rotation.x;m.arms[i].rotation.x=-Math.sin(cycle)*.68;m.elbows[i].rotation.x=-.55;});
   m.root.rotation.x=.1;m.head.rotation.z=Math.sin(phase)*.035;
  }else if(state==='crouch'||state==='land'){
   const c=state==='crouch'?Math.sin(progress*Math.PI/2):Math.sin(progress*Math.PI);
   m.legs.forEach((leg,i)=>{leg.rotation.x=.65*c;m.knees[i].rotation.x=-1.3*c;m.feet[i].rotation.x=.65*c;m.arms[i].rotation.x=.5*c;});m.head.rotation.x=-.12*c;
  }else if(state==='jump'){
   m.legs.forEach((leg,i)=>{leg.rotation.x=(i===0?.7:.35)*Math.sin(Math.PI*progress);m.knees[i].rotation.x=-.95*Math.sin(Math.PI*progress);m.arms[i].rotation.z=(i===0?-1:1)*(.5+.5*Math.sin(Math.PI*progress));m.elbows[i].rotation.x=-.5;});
   m.root.rotation.x=progress<.5?-.1:.13;
  }else if(state==='fall'){
   // Flailing: arms windmilling overhead, legs cycling, body wobbling. Each
   // limb runs on its own frequency and is offset half a cycle from its pair,
   // so nothing beats in unison and it reads as panic rather than a march.
   // Eases in over the first third of a second so a short drop between close
   // ledges does not snap straight into full pantomime.
   const s=Math.min(1,progress*3);
   const f=t*15;
   m.legs.forEach((leg,i)=>{
    const o=i*Math.PI;                                   // opposite phase per side
    leg.rotation.x=(.3+.62*Math.sin(f+o))*s;
    m.knees[i].rotation.x=(-.5-.5*Math.abs(Math.sin(f*1.27+o)))*s;
    m.feet[i].rotation.x=(.2+.25*Math.sin(f*1.1+o))*s;
    m.arms[i].rotation.z=(i===0?-1:1)*(1.05+.5*Math.sin(f*1.13+o))*s;
    m.arms[i].rotation.x=(-.2+.6*Math.sin(f*.87+o))*s;
    m.elbows[i].rotation.x=(-.3-.45*Math.abs(Math.sin(f*1.41+o)))*s;
   });
   m.root.rotation.x=(-.16+.06*Math.sin(f*.63))*s;
   m.root.rotation.z=.08*Math.sin(f*.52)*s;
   m.head.rotation.x=-.1*s;
   m.head.rotation.z=.12*Math.sin(f*.79)*s;
  }
  // Plant the lowest sole on the surface; hip and knee bends lower the body.
  m.root.updateMatrixWorld(true);
  if(state!=='jump'){
   const y=Math.min(...m.feet.map(foot=>foot.localToWorld(new THREE.Vector3(0,-.21,0)).y));
   m.root.position.y=-1.4-y;
  }
 }

 function setup(canvas,alpha=true){const renderer=new THREE.WebGLRenderer({canvas,alpha,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x5663a4,2.6));const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(-3,5,5);scene.add(light);const rim=new THREE.DirectionalLight(0x88aaff,3);rim.position.set(4,1,-2);scene.add(rim);const camera=new THREE.PerspectiveCamera(34,1,.1,100);return {renderer,scene,camera};}
 const petCanvas=document.createElement('canvas');petCanvas.setAttribute('aria-hidden','true');bot.prepend(petCanvas);let pet;
 try{pet=setup(petCanvas);pet.renderer.setSize(96,96);pet.camera=new THREE.OrthographicCamera(-1.75,1.75,2,-1.65,.1,30);pet.camera.position.set(0,0,8);pet.camera.lookAt(0,0,0);footPixel=(2+1.4)/3.65*96;pet.model=robot();pet.scene.add(pet.model.root);bot.classList.add('has-model');walkingReady=true;}catch{petCanvas.remove();}
 const stage=document.querySelector('.hero-stage');let hero,drag=false,lastX=0,rotation=-.2,spin=0,wave=0,party=0,visible=true;
 if(stage){try{const canvas=document.createElement('canvas');canvas.className='hero-webgl';canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Interactive 3D robot Byte. Drag left or right, or use arrow keys to rotate. Use the buttons to wave or spin.');stage.prepend(canvas);hero=setup(canvas);hero.model=robot();hero.scene.add(hero.model.root);hero.camera.position.set(0,1.1,7.8);hero.camera.lookAt(0,.2,0);
 const orbit=new THREE.Group();hero.scene.add(orbit);const shapes=[];for(let i=0;i<10;i++){const mat=new THREE.MeshStandardMaterial({color:[0xdaff65,0x9babff,0xffffff][i%3],metalness:.25,roughness:.3});const mesh=new THREE.Mesh(i%2?new THREE.TorusGeometry(.12,.045,8,20):new THREE.BoxGeometry(.2,.2,.2),mat);const angle=i/10*Math.PI*2;mesh.position.set(Math.cos(angle)*2.2,Math.sin(angle)*1.5,Math.sin(angle*2)*.6-.5);orbit.add(mesh);shapes.push(mesh);}hero.orbit=orbit;hero.shapes=shapes;
 const disk=new THREE.Mesh(new THREE.CylinderGeometry(1.18,1.3,.13,64),new THREE.MeshStandardMaterial({color:0x15289f,metalness:.3,roughness:.4}));disk.position.y=-1.58;hero.scene.add(disk);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.32,.018,8,80),new THREE.MeshBasicMaterial({color:0xdaff65}));ring.rotation.x=Math.PI/2;ring.position.y=-1.49;hero.scene.add(ring);
 const resize=()=>{hero.renderer.setSize(stage.clientWidth,stage.clientHeight,false);hero.camera.aspect=stage.clientWidth/stage.clientHeight;hero.camera.position.z=innerWidth<600?10.7:7.8;hero.camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(stage);resize();stage.classList.add('webgl-ready');
 canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(drag){rotation+=(e.clientX-lastX)*.012;lastX=e.clientX;}});['pointerup','pointercancel','lostpointercapture'].forEach(event=>canvas.addEventListener(event,()=>drag=false));canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();rotation+=e.key==='ArrowLeft'?-.25:.25;}});
 document.querySelector('[data-byte="wave"]').onclick=()=>{wave=performance.now();};document.querySelector('[data-byte="spin"]').onclick=()=>{spin=performance.now();};document.querySelector('[data-byte="color"]').onclick=()=>{party++;hero.model.root.children.find(o=>o.isMesh&&o.position.y===-.28)?.material.color.set([0x294cff,0xff734f,0x7957ff,0x149b83][party%4]);};
 const io=new IntersectionObserver(es=>{visible=es[0].isIntersecting;});io.observe(stage);
 }catch(e){stage.classList.remove('webgl-ready');stage.querySelector('.hero-webgl')?.remove();stage.querySelector('.play-controls')?.setAttribute('hidden','');}}
 let last=0,petFacing=0;function tick(now){requestAnimationFrame(tick);if(document.hidden){movementTime=now;return;}if(now-last<25)return;last=now;const t=now/1000;
 moveByte(now);
 if(pet){const m=pet.model;const moving=['run','crouch','jump','land','fall'].includes(walker.state);
 const desired=moving?walker.direction*1.05:0;petFacing+=(desired-petFacing)*.15;
 poseRig(m,moving?walker.state:'idle',walker.stride,walker.progress,petFacing,t);
 m.head.rotation.y=paused?0:moving?walker.direction*.05:Math.sin(t*.45)>.1?mouse.x*.4:Math.sin(t*.6)*.12;
 if(!moving)m.head.rotation.x=paused?0:mouse.y*.13;
 const blink=!paused&&t%4.7<.13?.12:1;m.eyes.forEach(e=>e.scale.y=blink);
 if(hover&&!paused&&!moving)m.arms[1].rotation.z=-1.7+Math.sin(t*10)*.15;
 pet.renderer.render(pet.scene,pet.camera);}

 if(hero&&visible){const m=hero.model;let angle=rotation;if(spin){const u=Math.min((now-spin)/1100,1);angle+=Math.PI*2*(1-Math.pow(1-u,3));if(u===1){rotation+=Math.PI*2;spin=0;}}m.root.rotation.y=angle;m.root.position.y=paused?0:Math.sin(t*1.8)*.065;m.head.rotation.y=drag||paused?0:mouse.x*.24;m.head.rotation.x=paused?0:mouse.y*.08;m.eyes.forEach(e=>e.scale.y=!paused&&t%5<.12?.12:1);m.arms[1].rotation.z=wave&&now-wave<1800?-2.2+Math.sin((now-wave)/90)*.3:.18;if(!paused){hero.orbit.rotation.z=Math.sin(t*.2)*.1;hero.shapes.forEach((s,i)=>{s.rotation.x=t*.35+i;s.rotation.y=t*.3;});}hero.renderer.render(hero.scene,hero.camera);}}
 requestAnimationFrame(tick);
}catch{document.querySelector('.play-controls')?.setAttribute('hidden','');}
