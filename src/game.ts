import type contract from '../game.contract.json'
import {mapFor} from './maps.js'
import {Enemies,type ShadeSpec,type DrifterSpec} from './enemies.js'

export type Pos=[number,number,number]
export interface Entity {id:string;pos:Pos}
export interface Lantern extends Entity {lit:boolean;deposited:number;fuelUnits:number;ever_lit:boolean;relit_count:number}
export interface Player {pos:Pos;vel:Pos;grounded:boolean;carried:number;flames:number}
export interface CharmSpec {id:string;pos?:Pos;available?:boolean;respawn_ticks?:number;respawn_s?:number}
export interface Scenario {
  player?:Partial<Player>&{invuln_ticks?:number;dash_cd_ticks?:number;pulse_cd_ticks?:number;charm_ticks?:number;successful_lights?:number}
  random_motes?:boolean;random_shades?:boolean;random_drifters?:boolean;wind_enabled?:boolean;bench_mode?:boolean
  motes?:Pos[];shades?:ShadeSpec[];drifters?:DrifterSpec[];charms?:CharmSpec[]
  lanterns?:(Partial<Lantern>&{id:string;fuel?:number})[];time_left_s?:number
}
export interface Input {move:number[];cam_yaw_deg:number;jump:boolean;interact:boolean;pulse:boolean;dash:boolean;pause:boolean}
export const idle=():Input=>({move:[0,0],cam_yaw_deg:0,jump:false,interact:false,pulse:false,dash:false,pause:false})
export const distance=(a:Pos,b:Pos)=>Math.hypot(a[0]-b[0],a[2]-b[2])
const copy=(p:Pos):Pos=>[...p]
const round=(p:Pos)=>p.map(n=>Number(n.toFixed(3)))
type Tuning=typeof contract.tuning
export class Game {
  tick=0
  sim_tick=0
  state:'playing'|'paused'|'won'|'lost'='playing'
  score=0
  successful_lights=0
  get capacity(){return Math.min(this.t.capacity_max,this.t.carry_capacity+2*this.successful_lights)}
  map:ReturnType<typeof mapFor>
  player:Player
  lanterns:Lantern[]
  motes:(Entity&{kind:'random'|'dropped';ttl:number;born:number})[]=[]
  charms:(Entity&{available:boolean;respawn:number})[]
  enemies:Enemies
  get shades(){return this.enemies.shades}
  get drifters(){return this.enemies.drifters}
  events:{type:'event';tick:number;name:string;data:object}[]=[]
  wind={active:false,dir_deg:0}
  get windWarning(){return this.night===3 && this.scenario.wind_enabled!==false && this.sim_tick%1800>=1680}
  invuln:number
  dashCd:number
  pulseCd:number
  charmTicks:number
  respawn=0
  facing:[number,number]=[0,1]
  private dashDir=[0,1]
  private dashLeft=0
  private glideVelocity=0
  private jumpBuffer=0
  private launch:Pos|null=null
  private nextMote=1
  private previous=idle()
  private duration:number
  readonly t:Tuning
  readonly night:number
  readonly scenario:Scenario
  private seed:number

  constructor(t:Tuning,seed:number,s:Scenario={},night=1){
    this.t=t;this.seed=seed;this.night=night
    this.map=mapFor(night)
    this.scenario=structuredClone(s)
    const p=this.scenario.player??{}
    const pos=copy(p.pos??this.map.start)
    this.player={pos,vel:copy(p.vel??[0,0,0]),grounded:p.grounded??Math.abs(pos[1]-this.map.ground(pos[0],pos[2]))<1e-6,flames:p.flames??t.flames,carried:p.carried??0}
    this.invuln=p.invuln_ticks??0;this.dashCd=p.dash_cd_ticks??0
    this.successful_lights=p.successful_lights??0
    this.pulseCd=p.pulse_cd_ticks??0;this.charmTicks=p.charm_ticks??0
    this.duration=s.time_left_s??[t.night1_duration_s,t.night2_duration_s,t.night3_duration_s][night-1]
    this.lanterns=this.map.lanterns.map((pos,i)=>{
      const id='L'+(i+1),l=s.lanterns?.find(o=>o.id===id)
      const fuelUnits=Math.round((l?.fuel??(l?.lit?100:0))*60)
      const lit=(l?.lit??false) && fuelUnits>0
      const deposited=lit?t.lantern_cost:l?.deposited??0
      return {id,pos:copy(l?.pos??pos),deposited,lit,fuelUnits:lit?fuelUnits:0,ever_lit:l?.ever_lit??Boolean(l?.lit),relit_count:l?.relit_count??0}
    })
    const specs:CharmSpec[]=s.charms??this.map.charms.map((pos,i)=>({id:'C'+(i+1),pos}))
    this.charms=specs.map(c=>({id:c.id,pos:copy(c.pos??this.map.charms[Number(c.id.slice(1))-1]??[0,0,0]),available:c.available??true,respawn:c.respawn_ticks??Math.round((c.respawn_s??45)*60)}))
    if(s.motes) for(const pos of s.motes)this.addMote(pos)
    else if(s.random_motes!==false) for(let i=0;i<20;i++)this.spawnMote()
    this.enemies=new Enemies(this)
  }
  get left(){return Math.max(0,this.duration-this.sim_tick/60)}
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296}
  emit(name:string,data:object){this.events.push({type:'event',tick:this.tick,name,data})}
  private addMote(pos:Pos,dropped=false){
    this.motes.push({id:'M'+this.nextMote++,pos:copy(pos),kind:dropped?'dropped':'random',ttl:dropped?480:0,born:this.sim_tick})
  }
  private spawnMote(){
    if(this.motes.length>=30)return
    const free=this.map.motes.filter(p=>!this.motes.some(m=>distance(m.pos,p)<1e-6))
    if(free.length)this.addMote(free[Math.floor(this.random()*free.length)])
  }
  drop(pos:Pos,count:number,ring:boolean){
    for(let i=0;i<count;i++){
      const a=this.random()*2*Math.PI,r=ring?1.5+this.random():0
      const x=pos[0]+r*Math.cos(a),z=pos[2]+r*Math.sin(a),ground=this.map.ground(x,z)
      this.addMote([x,Number.isFinite(ground)?ground:pos[1],z],true)
    }
  }
  nearest(){
    const p=this.player.pos
    return this.lanterns.filter(l=>(!l.lit || l.fuelUnits<this.t.fuel_max*60) && distance(l.pos,p)<=this.t.interact_radius)
      .sort((a,b)=>distance(a.pos,p)-distance(b.pos,p)||a.id.localeCompare(b.id))[0]
  }
  private deposit(){
    const l=this.nearest()
    if(!l || !this.player.carried)return
    if(l.lit){
      const amount=Math.min(this.player.carried,Math.ceil((this.t.fuel_max*60-l.fuelUnits)/(this.t.fuel_per_mote*60)))
      if(!amount)return
      this.player.carried-=amount;this.score+=amount*this.t.score.per_mote
      l.fuelUnits=Math.min(this.t.fuel_max*60,l.fuelUnits+amount*this.t.fuel_per_mote*60)
      this.emit('refuel',{lantern_id:l.id,amount,fuel:Number((l.fuelUnits/60).toFixed(1))})
      return
    }
    const cost=l.ever_lit?this.t.relight_cost:this.t.lantern_cost
    const amount=Math.min(this.player.carried,cost-l.deposited)
    this.player.carried-=amount;l.deposited+=amount;this.score+=amount*this.t.score.per_mote
    this.emit('deposit',{lantern_id:l.id,amount,deposited:l.deposited})
    if(l.deposited===cost){
      const relight=l.ever_lit
      l.lit=true;l.ever_lit=true;l.fuelUnits=this.t.fuel_max*60
      if(relight)l.relit_count++
      this.successful_lights++
      this.score+=relight?40:this.t.score.per_lantern
      this.emit('lantern_lit',{lantern_id:l.id,relight})
    }
  }
  private collect(){
    const p=this.player
    const near=(pos:Pos)=>distance(p.pos,pos)<=this.t.pickup_radius && Math.abs(p.pos[1]-pos[1])<=1.5
    this.motes=this.motes.filter(m=>{
      if(!near(m.pos)||p.carried>=this.capacity||m.born===this.sim_tick)return true
      this.emit('mote_picked',{carried:++p.carried})
      return false
    })
    for(const c of this.charms)if(c.available && near(c.pos)){
      this.charmTicks=600;this.dashCd=0;c.available=false;c.respawn=2700
      this.emit('charm_picked',{charm_id:c.id,charm_ticks:600})
    }
  }
  private timers(){
    this.dashCd=Math.max(0,this.dashCd-1);this.pulseCd=Math.max(0,this.pulseCd-1)
    this.invuln=Math.max(0,this.invuln-1);this.charmTicks=Math.max(0,this.charmTicks-1)
    this.motes=this.motes.filter(m=>m.kind==='random'||--m.ttl>0)
    for(const c of this.charms)if(!c.available && --c.respawn<=0)c.available=true
    this.enemies.timers()
    for(const l of this.lanterns){
      if(!l.lit||this.scenario.bench_mode)continue
      l.fuelUnits-=this.t.fuel_decay_per_s
      if(l.fuelUnits<=0){
        l.fuelUnits=0;l.lit=false;l.deposited=0
        this.emit('lantern_out',{lantern_id:l.id})
      }
    }
    const phase=this.sim_tick%1800
    this.wind.active=this.night===3 && this.scenario.wind_enabled!==false && this.sim_tick>=1800 && phase<300
    if(this.windWarning && phase===1680)this.wind.dir_deg=this.random()*360
  }
  private move(input:Input){
    const p=this.player,[x,y,z]=p.pos
    const [mx,mz]=input.move,a=input.cam_yaw_deg*Math.PI/180
    const length=Math.hypot(mx,mz),speed=this.charmTicks?7.2:this.t.player_speed
    const dx=(mx*Math.cos(a)+mz*Math.sin(a))/Math.max(1,length)
    const dz=(-mx*Math.sin(a)+mz*Math.cos(a))/Math.max(1,length)
    if(length)this.facing=[dx/Math.hypot(dx,dz),dz/Math.hypot(dx,dz)]
    const pad=p.grounded?this.map.pads.find(b=>distance(b.pos,p.pos)<=1 && Math.abs(b.pos[1]-y)<.15):null
    if(pad){this.launch=copy(pad.velocity);p.vel[1]=pad.velocity[1];p.grounded=false}
    if(input.jump && !this.previous.jump)this.jumpBuffer=6
    else this.jumpBuffer=Math.max(0,this.jumpBuffer-1)
    if(this.jumpBuffer>0 && p.grounded){p.vel[1]=7;p.grounded=false;this.jumpBuffer=0}
    if(input.dash && !this.previous.dash && !this.dashLeft && (!this.dashCd||this.charmTicks)){
      this.dashDir=[...this.facing];this.dashLeft=Math.round(this.t.dash_duration_s*60)
      this.glideVelocity=p.vel[1]
      this.dashCd=this.charmTicks?0:Math.round(this.t.dash_cooldown_s*60);this.emit('dash',{})
    }
    const dashing=this.dashLeft>0
    let vx=dashing?this.dashDir[0]*this.t.dash_speed:this.launch?.[0]??dx*speed
    let vz=dashing?this.dashDir[1]*this.t.dash_speed:this.launch?.[2]??dz*speed
    if(this.wind.active){
      const dir=this.wind.dir_deg*Math.PI/180
      vx+=2*Math.cos(dir);vz+=2*Math.sin(dir)
    }
    let nx=x+vx/60,nz=z+vz/60,ground=this.map.ground(nx,nz)
    const current=this.map.ground(x,z)
    const slopeRise=Math.hypot(nx-x,nz-z)*.5+1e-6
    if((ground>y+slopeRise && ground>current+slopeRise) || (this.night===3 && Math.hypot(nx,nz)<2 && y<14 && Math.hypot(nx,nz)<Math.hypot(x,z))){
      nx=x;nz=z;vx=0;vz=0;ground=current
    }
    p.vel[0]=vx;p.vel[2]=vz;p.pos[0]=nx;p.pos[2]=nz
    if(dashing)this.dashLeft--
    if(p.grounded && Number.isFinite(ground) && Math.abs(ground-y)<=.25){
      p.pos[1]=ground;p.vel[1]=0
    }else{
      p.grounded=false
      if(!dashing){
        p.vel[1]-=20/60
        p.pos[1]+=p.vel[1]/60
      }else p.vel[1]=0
      if(p.vel[1]<=0 && y>=ground-.06 && p.pos[1]<=ground){
        p.pos[1]=ground;p.vel[1]=0;p.grounded=true;this.launch=null
      }
    }
    if(dashing && this.dashLeft===0 && !p.grounded)p.vel[1]=this.glideVelocity
    if(p.pos[1]<-10){
      const lost=p.carried;p.flames=Math.max(0,p.flames-1);p.carried=0
      this.respawn=60;this.launch=null;this.dashLeft=0;p.vel=[0,0,0]
      this.emit('player_hit',{by:'fall',flames:p.flames,dropped:0,lost})
    }
  }
  step(input:Input){
    if(this.state==='won'||this.state==='lost')return
    this.tick++;this.events=[]
    if(input.pause && !this.previous.pause){
      this.state=this.state==='paused'?'playing':'paused'
      this.emit(this.state==='paused'?'paused':'resumed',{})
    }
    if(this.state==='paused'){this.previous={...input};return}
    this.sim_tick++;this.timers();this.enemies.drainFuel()
    if(this.scenario.bench_mode){
      this.player.pos=[0,0,0];this.player.vel=[0,0,0];this.player.grounded=true
    }else if(this.respawn){
      if(--this.respawn===0){
        this.player.pos=copy(this.map.start);this.player.vel=[0,0,0];this.player.grounded=true;this.invuln=90;this.facing=[0,1]
      }
    }else this.move(input)
    if(!this.scenario.bench_mode&&!this.respawn){this.collect();if(input.interact && !this.previous.interact)this.deposit()}
    if(!this.scenario.bench_mode)this.enemies.safe()
    if(!this.scenario.bench_mode&&!this.respawn && input.pulse && !this.previous.pulse && !this.pulseCd && this.player.carried>=this.t.pulse_cost){
      this.player.carried-=this.t.pulse_cost;this.pulseCd=Math.round(this.t.pulse_cooldown_s*60);this.enemies.pulse()
    }
    this.enemies.move()
    if(!this.scenario.bench_mode&&!this.respawn)this.enemies.contacts()
    if(!this.scenario.bench_mode&&this.scenario.random_motes!==false && this.sim_tick%240===0)this.spawnMote()
    if(!this.scenario.bench_mode)this.enemies.spawn()
    const litCount=this.lanterns.filter(l=>l.lit).length
    const reason=this.scenario.bench_mode?null:this.player.flames===0?'no_flames':this.left===0?(litCount>=Math.ceil(this.t.win_ratio*this.lanterns.length)?'dawn_survived':'dawn'):null
    if(reason){
      this.state=reason==='dawn_survived'?'won':'lost'
      if(this.state==='won')this.score+=this.lanterns.filter(l=>l.lit).reduce((total,l)=>total+50+Math.floor(l.fuelUnits/60),0)+this.player.flames*50
      this.emit('game_over',{result:this.state,reason})
    }
    this.previous={...input}
  }
  snapshot(){
    const p=this.player
    return {type:'snapshot',tick:this.tick,sim_tick:this.sim_tick,night:this.night,wind:{...this.wind},state:this.state,time_left_s:this.left,score:this.score,
      player:{...p,pos:round(p.pos),vel:round(p.vel),invuln:this.invuln>0,dash_cd_s:this.dashCd/60,pulse_cd_s:this.pulseCd/60,charm_s:this.charmTicks/60,capacity:this.capacity},
      lanterns:this.lanterns.map(({fuelUnits,...l})=>({...l,pos:round(l.pos),fuel:Number((fuelUnits/60).toFixed(1))})),motes_active:this.motes.length,
      motes:this.motes.map(m=>({id:m.id,pos:round(m.pos),kind:m.kind,ttl_s:m.ttl/60})),
      shades:this.shades.map(s=>({id:s.id,pos:round(s.pos),state:s.state})),
      drifters:this.drifters.map(d=>({id:d.id,pos:round(d.pos),state:d.state,stolen:d.stolen})),
      charms:this.charms.map(c=>({id:c.id,available:c.available,respawn_s:c.available?0:c.respawn/60}))}
  }
}
