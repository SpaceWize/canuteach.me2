// Feet travel in document coordinates: scrolling never changes the trajectory.
export function jumpHeight(a,b){return Math.max(75,Math.min(160,Math.abs(b.x-a.x)*.18),(b.y-a.y)/4+45);}
export function jumpPoint(a,b,t,height=95){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-4*height*t*(1-t)};}
export function landingPoint(surface,fraction=.5){return {x:surface.left+24+(surface.width-48)*Math.max(0,Math.min(1,fraction)),y:surface.top};}

// Gravity for the scroll-driven fall. Tuned so a ~600px drop takes about 0.8s:
// fast enough to feel like falling, slow enough to read as deliberate.
const GRAVITY=1900;      // px/s^2, document space
const TERMINAL=1700;     // px/s cap, so a long page never turns into a blur

// Line breaks inside a paragraph sit ~28px apart. Without a minimum drop he
// would touch down on every one of them, spend the landing + idle beat
// stationary, and get left behind while the page scrolls on. Requiring a
// little clearance lets him pass through dense text and land on the next
// meaningful line instead of stuttering down every one.
const MIN_DROP=30;

export class ByteMotion{
 constructor(x,y){this.position={x,y};this.state='idle';this.elapsed=0;this.duration=1;this.surface=null;this.fraction=.5;this.direction=1;this.stride=0;this.wait=1.1;this.destination=null;this.progress=0;this.jumps=0;this.velocityY=0;this.airTime=0;this.impact=0;this.hasRun=false;}
 setState(state,duration){this.state=state;this.elapsed=0;this.duration=duration;this.progress=0;}

 jump(surface,fraction=.5){this.destination={surface,fraction};const end=landingPoint(surface,fraction);this.direction=Math.sign(end.x-this.position.x)||this.direction;this.setState('crouch',.25);}
 // Duration is capped at 2.2s. Uncapped, a run the full width of the viewport
 // floor took nine seconds, during which he never returned to idle — so he
 // never re-checked for real ledges scrolling into view and just trudged.
 run(surface,fraction){this.surface=surface;this.fromFraction=this.fraction;this.toFraction=fraction;this.direction=Math.sign(fraction-this.fraction)||this.direction;const distance=Math.abs(landingPoint(surface,fraction).x-this.position.x);this.setState('run',Math.max(.4,Math.min(2.2,distance/100)));}

 // Step off whatever he is standing on and let gravity take over. Called when
 // the ledge under him scrolls out of view, so scrolling drops him onto the
 // next section top / image / line rather than teleporting him to a corner.
 fall(){
  if(this.state==='fall')return;
  this.surface=null;this.destination=null;
  this.velocityY=0;this.airTime=0;this.fallFromY=this.position.y;
  this.setState('fall',1);
 }

 // Scrolling has outrun him and he is about to leave the top of the screen.
 // Drag him back to the edge and keep him falling, so a fast scroll reads as
 // Byte tumbling down the page rather than simply vanishing upward.
 catchUp(y){
  // Deliberately does NOT reset fallFromY. Resetting it meant the minimum-drop
  // test measured from the ceiling every frame, so while a fast scroll kept
  // dragging him down he could never satisfy it and never landed at all.
  if(this.state!=='fall'){this.velocityY=Math.max(this.velocityY,260);this.surface=null;this.destination=null;this.fallFromY=this.position.y;this.setState('fall',1);}
  this.position.y=y;
 }

 land(surface){
  // Keep the x he fell down at; derive the fraction from where he touched down
  // so a later run along the ledge starts from the right place.
  const span=Math.max(1,surface.width-48);
  this.fraction=Math.max(0,Math.min(1,(this.position.x-surface.left-24)/span));
  this.position={x:this.position.x,y:surface.top};
  this.surface=surface;this.velocityY=0;this.airTime=0;this.hasRun=false;this.jumps++;
  // Heavier landings get a deeper squash.
  this.setState('land',Math.min(.42,.22+this.impact*.00012));
 }

 update(dt,refresh,findGround){
  dt=Math.min(Math.max(dt,0),.05);this.elapsed+=dt;this.progress=Math.min(1,this.elapsed/this.duration);

  if(this.surface&&this.state!=='jump'&&this.state!=='fall'){
   const current=refresh(this.surface);if(current)this.surface=current;
   if(this.state==='run'){this.fraction=this.fromFraction+(this.toFraction-this.fromFraction)*this.progress;this.stride+=dt*11;}
   this.position=landingPoint(this.surface,this.fraction);
  }

  if(this.state==='fall'){
   this.airTime+=dt;
   this.velocityY=Math.min(TERMINAL,this.velocityY+GRAVITY*dt);
   const from=this.position.y;
   const to=from+this.velocityY*dt;
   // Sweep the segment travelled this frame rather than testing a point, so a
   // fast fall cannot tunnel straight through a thin ledge between frames.
   const ground=findGround?findGround(this.position.x,from,to):null;
   if(ground&&ground.top-this.fallFromY>=MIN_DROP){this.impact=this.velocityY;this.land(ground);}
   else this.position={x:this.position.x,y:to};
  }
  else if(this.state==='crouch'&&this.progress===1){this.start={...this.position};this.surface=null;const dest=refresh(this.destination.surface)||this.destination.surface;this.destination.surface=dest;const end=landingPoint(dest,this.destination.fraction);this.height=jumpHeight(this.start,end);this.setState('jump',Math.min(1.35,Math.max(.65,Math.hypot(end.x-this.start.x,end.y-this.start.y)/480)));}
  else if(this.state==='jump'){
   const dest=refresh(this.destination.surface)||this.destination.surface;this.destination.surface=dest;
   this.position=jumpPoint(this.start,landingPoint(dest,this.destination.fraction),this.progress,this.height);
   if(this.progress===1){this.surface=dest;this.fraction=this.destination.fraction;this.jumps++;this.impact=0;this.setState('land',.28);}
  }
  else if(this.state==='land'&&this.progress===1){this.wait=.25;this.setState('idle',.25);}
  else if(this.state==='run'&&this.progress===1){this.wait=.7;this.setState('idle',.7);}
 }
}
