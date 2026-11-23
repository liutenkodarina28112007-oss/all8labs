import {EventEmitter} from 'node:events';import {World,type InputState} from '@dogfight/shared';
export type Player={id:number;name:string;input:InputState;lastProcessedSeq:number;socket:any};
export class Room extends EventEmitter {players=new Map<number,Player>();world=new World();tick=0;constructor(public readonly id:string,private readonly seed:number){super()}
join(player:Player){if(this.players.size>=8)throw new Error('Room is full');this.players.set(player.id,player);this.world.addPlayer(player.name,this.seed+player.id);this.emit('event',{t:Date.now(),type:'player.joined',playerId:player.id,name:player.name});this.emit('roster',this.roster());}
leave(id:number){const p=this.players.get(id);if(!p)return;this.players.delete(id);for(const e of this.world.ofKind('ship'))if(e.state.owner===p.name)e.alive=false;this.emit('event',{t:Date.now(),type:'player.left',playerId:id});this.emit('roster',this.roster());if(!this.players.size)this.emit('empty');}
roster(){return [...this.players.values()].map(p=>({id:p.id,name:p.name}))}
step(dt:number){const inputs=new Map<string,InputState>();for(const p of this.players.values())inputs.set(p.name,p.input);this.world.step(dt,inputs,this.seed);this.tick++;}
snapshot(lastProcessedSeq=0){return this.world.snapshot(lastProcessedSeq,this.seed)}}
export class RoomManager {rooms=new Map<string,Room>();create(id:string){let r=this.rooms.get(id);if(!r){r=new Room(id,Math.floor(Math.random()*0xffffffff));r.on('empty',()=>this.rooms.delete(id));this.rooms.set(id,r)}return r}list(){return [...this.rooms.values()].map(r=>({id:r.id,players:r.players.size}))}}
