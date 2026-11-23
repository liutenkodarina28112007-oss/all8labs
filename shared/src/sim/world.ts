import {mulberry32} from './random.js';
export type InputState={turn:number;thrust:boolean;fire:boolean;seq:number};
export type EntityKind='ship'|'bullet'|'asteroid'|'pickup';
export type EntityState={id:number;kind:EntityKind;x:number;y:number;vx:number;vy:number;angle:number;radius:number;hp:number;owner:string;ttl:number;score:number};
export type Snapshot={type:'snapshot';v:1;tick:number;seed:number;lastProcessedSeq:number;entities:EntityState[];wave?:number;bestWave?:number;nextWaveCountdown?:number;nextWaveAnnouncement?:number};
let nextId=1;
export class Entity {alive=true;get id(){return this.state.id}constructor(public state:EntityState){} update(dt:number){this.state.x+=this.state.vx*dt;this.state.y+=this.state.vy*dt;}}
export class Ship extends Entity {constructor(owner:string,x:number,y:number){super({id:nextId++,kind:'ship',x,y,vx:0,vy:0,angle:0,radius:15,hp:100,owner,ttl:0,score:0});} }
export class Bullet extends Entity {constructor(owner:string,x:number,y:number,vx:number,vy:number,angle:number){super({id:nextId++,kind:'bullet',x,y,vx,vy,angle,radius:4,hp:1,owner,ttl:1.4,score:0})}}
export class Asteroid extends Entity {constructor(x:number,y:number,vx:number,vy:number,radius:number){super({id:nextId++,kind:'asteroid',x,y,vx,vy,angle:0,radius,hp:2,owner:'',ttl:0,score:0})}}
export class Pickup extends Entity {constructor(x:number,y:number){super({id:nextId++,kind:'pickup',x,y,vx:0,vy:0,angle:0,radius:11,hp:1,owner:'',ttl:0,score:0})}}
export class Explosion extends Entity {constructor(x:number,y:number){super({id:nextId++,kind:'pickup',x,y,vx:0,vy:0,angle:0,radius:22,hp:0,owner:'',ttl:.35,score:0})}}
export class World {
  #entities=new Map<number,Entity>(); #nextEntityId=1; tick=0; #fireCooldown=new Map<string,number>();
  wave=1; bestWave=1; nextWaveCountdown=0; nextWaveAnnouncement=0;
  spawn(e:Entity){e.state.id=this.#nextEntityId++;this.#entities.set(e.state.id,e);return e}
  get(id:number){return this.#entities.get(id)}
  *[Symbol.iterator](){yield* this.#entities.values()}
  *ofKind(kind:EntityKind){for(const e of this.#entities.values())if(e.state.kind===kind)yield e}
  addPlayer(owner:string,seed:number){const r=mulberry32(seed);const ship=this.spawn(new Ship(owner,100+r()*600,100+r()*400));if(![...this.ofKind('asteroid')].length){this.spawnWave(seed)}for(let i=0;i<2;i++)this.spawn(new Pickup(120+r()*660,100+r()*400));return ship}
  spawnWave(seed:number){const r=mulberry32(seed+this.wave*7919+this.tick);const count=6+(this.wave-1)*2;const speedScale=1+(this.wave-1)*.12;for(let i=0;i<count;i++){const angle=r()*Math.PI*2,speed=(55+r()*25)*speedScale,radius=Math.max(12,21-r()*8);this.spawn(new Asteroid(70+r()*760,60+r()*480,Math.cos(angle)*speed,Math.sin(angle)*speed,radius));const asteroid=[...this.ofKind('asteroid')].at(-1);if(asteroid&&this.wave>=4)asteroid.state.hp=2+Math.floor((this.wave-1)/3);} }
  step(dt:number,inputs:Map<string,InputState>,seed=1){this.tick++;const r=mulberry32(seed+this.tick);
    if(this.nextWaveCountdown>0){
      this.nextWaveCountdown=Math.max(0,this.nextWaveCountdown-dt);
      if(this.nextWaveCountdown===0){
        this.wave++;
        this.bestWave=Math.max(this.bestWave,this.wave);
        this.nextWaveAnnouncement=1.5;
        this.spawnWave(seed);
      }
    }
    this.nextWaveAnnouncement=Math.max(0,this.nextWaveAnnouncement-dt);
    for(const e of this.#entities.values()) {const s=e.state;if(s.kind==='ship'){const i=inputs.get(s.owner);if(i){s.angle+=i.turn*3.2*dt;if(i.thrust){s.vx+=Math.cos(s.angle)*260*dt;s.vy+=Math.sin(s.angle)*260*dt;}const speed=Math.hypot(s.vx,s.vy),max=360;if(speed>max){s.vx=s.vx/speed*max;s.vy=s.vy/speed*max;}s.vx*=Math.pow(.985,dt*60);s.vy*=Math.pow(.985,dt*60);
      const cd=this.#fireCooldown.get(s.owner)??0;if(i.fire&&cd<=0){const x=s.x+Math.cos(s.angle)*22,y=s.y+Math.sin(s.angle)*22;const b=new Bullet(s.owner,x,y,s.vx+Math.cos(s.angle)*520,s.vy+Math.sin(s.angle)*520,s.angle);this.spawn(b);this.#fireCooldown.set(s.owner,.22);}else this.#fireCooldown.set(s.owner,Math.max(0,cd-dt));}
      s.x=(s.x+s.vx*dt+900)%900;s.y=(s.y+s.vy*dt+600)%600;
    } else {e.update(dt);if(s.kind==='asteroid'){if(s.x<s.radius||s.x>900-s.radius)s.vx*=-1;if(s.y<s.radius||s.y>600-s.radius)s.vy*=-1;s.x=Math.max(s.radius,Math.min(900-s.radius,s.x));s.y=Math.max(s.radius,Math.min(600-s.radius,s.y));}if(s.kind==='bullet'){s.ttl-=dt;if(s.ttl<=0)e.alive=false;if(s.x<0||s.x>900||s.y<0||s.y>600)e.alive=false;}}
    }
    const ships=[...this.ofKind('ship')],bullets=[...this.ofKind('bullet')],asteroids=[...this.ofKind('asteroid')],pickups=[...this.ofKind('pickup')];
    for(const b of bullets){for(const sh of ships){const a=b.state,c=sh.state;if(a.owner!==c.owner&&Math.hypot(a.x-c.x,a.y-c.y)<a.radius+c.radius){c.hp-=25;b.alive=false;if(c.hp<=0){c.hp=100;c.score-=1;c.x=100+r()*700;c.y=80+r()*440;c.vx=c.vy=0;}}}for(const rock of asteroids){if(b.alive&&Math.hypot(b.state.x-rock.state.x,b.state.y-rock.state.y)<b.state.radius+rock.state.radius){b.alive=false;rock.state.hp-=1;if(rock.state.hp<=0){rock.alive=false;const shooter=ships.find(x=>x.state.owner===b.state.owner);if(shooter)shooter.state.score+=10;}}}}
    for(const ship of ships)for(const pickup of pickups){if(pickup.alive&&Math.hypot(ship.state.x-pickup.state.x,ship.state.y-pickup.state.y)<ship.state.radius+pickup.state.radius){ship.state.hp=Math.min(100,ship.state.hp+20);pickup.alive=false;}}
    for(const e of this.#entities.values())if(!e.alive)this.#entities.delete(e.state.id);
    if(![...this.ofKind('asteroid')].length&&this.nextWaveCountdown===0&&this.nextWaveAnnouncement===0){
      this.nextWaveCountdown=3;
    }
  }
  snapshot(lastProcessedSeq=0,seed=1):Snapshot{return{type:'snapshot',v:1,tick:this.tick,seed,lastProcessedSeq,entities:[...this.#entities.values()].map(e=>({...e.state})),wave:this.wave,bestWave:this.bestWave,nextWaveCountdown:this.nextWaveCountdown,nextWaveAnnouncement:this.nextWaveAnnouncement}}
  restore(snapshot:Snapshot){this.#entities.clear();this.#nextEntityId=1;for(const state of snapshot.entities){this.#entities.set(state.id,new Entity({...state}));this.#nextEntityId=Math.max(this.#nextEntityId,state.id+1)}this.tick=snapshot.tick;this.wave=snapshot.wave??1;this.bestWave=snapshot.bestWave??this.wave;this.nextWaveCountdown=snapshot.nextWaveCountdown??0;this.nextWaveAnnouncement=snapshot.nextWaveAnnouncement??0;}
}
export function reconcile(authoritative:EntityState,pending:InputState[],dt=1/60){const s={...authoritative};for(const i of pending){s.angle+=i.turn*3.2*dt;if(i.thrust){s.vx+=Math.cos(s.angle)*260*dt;s.vy+=Math.sin(s.angle)*260*dt;}s.x=(s.x+s.vx*dt+900)%900;s.y=(s.y+s.vy*dt+600)%600;}return s;}
export function circlesOverlap(a:EntityState,b:EntityState){return Math.hypot(a.x-b.x,a.y-b.y)<=a.radius+b.radius}
