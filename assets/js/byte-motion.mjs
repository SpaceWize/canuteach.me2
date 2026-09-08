// Feet travel in document coordinates: scrolling never changes the trajectory.
export function jumpHeight(a,b){return Math.max(75,Math.min(160,Math.abs(b.x-a.x)*.18),(b.y-a.y)/4+45);}
export function jumpPoint(a,b,t,height=95){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-4*height*t*(1-t)};}
export function landingPoint(surface,fraction=.5){return {x:surface.left+24+(surface.width-48)*Math.max(0,Math.min(1,fraction)),y:surface.top};}
export class ByteMotion{
 constructor(x,y){this.position={x,y};this.state='idle';this.elapsed=0;this.duration=1;this.surface=null;this.fraction=.5;this.direction=1;this.stride=0;this.wait=1.1;this.destination=null;this.progress=0;this.jumps=0;}
 setState(state,duration){this.state=state;this.elapsed=0;this.duration=duration;this.progress=0;}
 jump(surface,fraction=.5){this.destination={surface,fraction};const end=landingPoint(surface,fraction);this.direction=Math.sign(end.x-this.position.x)||this.direction;this.setState('crouch',.25);}
 run(surface,fraction){this.surface=surface;this.fromFraction=this.fraction;this.toFraction=fraction;this.direction=Math.sign(fraction-this.fraction)||this.direction;const distance=Math.abs(landingPoint(surface,fraction).x-this.position.x);this.setState('run',Math.max(.4,distance/100));}
 update(dt,refresh){
 dt=Math.min(Math.max(dt,0),.05);this.elapsed+=dt;this.progress=Math.min(1,this.elapsed/this.duration);
 if(this.surface&&this.state!=='jump'){
  const current=refresh(this.surface);if(current)this.surface=current;
  if(this.state==='run'){this.fraction=this.fromFraction+(this.toFraction-this.fromFraction)*this.progress;this.stride+=dt*11;}
  this.position=landingPoint(this.surface,this.fraction);
 }
 if(this.state==='crouch'&&this.progress===1){this.start={...this.position};this.surface=null;const dest=refresh(this.destination.surface)||this.destination.surface;this.destination.surface=dest;const end=landingPoint(dest,this.destination.fraction);this.height=jumpHeight(this.start,end);this.setState('jump',Math.min(1.35,Math.max(.65,Math.hypot(end.x-this.start.x,end.y-this.start.y)/480)));}
 else if(this.state==='jump'){
  const dest=refresh(this.destination.surface)||this.destination.surface;this.destination.surface=dest;
  this.position=jumpPoint(this.start,landingPoint(dest,this.destination.fraction),this.progress,this.height);
  if(this.progress===1){this.surface=dest;this.fraction=this.destination.fraction;this.jumps++;this.setState('land',.28);}
 }else if(this.state==='land'&&this.progress===1){this.wait=.25;this.setState('idle',.25);}
 else if(this.state==='run'&&this.progress===1){this.wait=.7;this.setState('idle',.7);}
 }
}
