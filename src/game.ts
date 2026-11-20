export type Pos = [number, number, number]
export interface Entity { id: string; pos: Pos }
export interface Lantern extends Entity { lit: boolean; deposited: number }
export interface Player { pos: Pos; carried: number; flames: number }
export interface Scenario {
  player?: Partial<Player>; random_motes?: boolean; random_shades?: boolean
  motes?: Pos[]; shades?: {id?: string; pos: Pos}[]
  lanterns?: (Partial<Lantern> & {id: string})[]; time_left_s?: number
}
export interface Input { move: number[]; cam_yaw_deg: number; jump: boolean; interact: boolean; pulse: boolean }
export const idle = (): Input => ({move:[0,0],cam_yaw_deg:0,jump:false,interact:false,pulse:false})
export const distance = (a:Pos,b:Pos) => Math.hypot(a[0]-b[0],a[2]-b[2])
import type contract from '../game.contract.json'
type Tuning = typeof contract.tuning
interface Shade extends Entity { until: number; state: 'chase'|'stunned' }
export class Game {
  tick = 0
  state: 'playing'|'won'|'lost' = 'playing'
  score = 0
  player: Player
  lanterns: Lantern[]
  motes: Entity[] = []
  shades: Shade[] = []
  events: {type:'event'; tick:number; name:string; data:object}[] = []
  private prev = idle()
  private vertical = 0
  private nextHit = 0
  private nextPulse = 0
  private moteId = 0
  private shadeId = 0
  private duration: number
  readonly t: Tuning
  private seed: number
  private scenario: Scenario

  constructor(t:Tuning, seed:number, scenario:Scenario = {}) {
    this.t=t
    this.seed=seed
    this.scenario=structuredClone(scenario)
    const s=this.scenario
    this.duration=s.time_left_s ?? t.night1_duration_s
    this.player={pos:[0,0,0],carried:0,flames:t.flames,...s.player}
    this.lanterns=Array.from({length:t.lantern_count_night1},(_,i)=>{
      const angle=i*2*Math.PI/t.lantern_count_night1
      const id='L'+(i+1)
      const l:Lantern={id,pos:[20*Math.sin(angle),0,20*Math.cos(angle)],deposited:0,lit:false,...s.lanterns?.find(l=>l.id===id)}
      if(l.lit) l.deposited=t.lantern_cost
      l.lit=l.deposited>=t.lantern_cost
      return l
    })
    const positions=s.motes ?? Array.from({length:s.random_motes===false?0:35},()=>this.randomPos())
    for(const pos of positions) this.addMote(pos)
    const shades=s.shades ?? Array.from({length:s.random_shades===false?0:2},()=>({pos:this.randomPos(22)}))
    for(const shade of shades) this.addShade(shade)
  }
  get left(){return Math.max(0,this.duration-this.tick/60)}
  private random(){
    this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0
    return this.seed/4294967296
  }
  private randomPos(inner=0):Pos {
    const a=this.random()*2*Math.PI, r=Math.sqrt(inner**2+this.random()*(30**2-inner**2))
    return [r*Math.cos(a),0,r*Math.sin(a)]
  }
  private addMote(pos:Pos){this.motes.push({id:'M'+ ++this.moteId,pos})}
  private addShade(shade:{pos:Pos;id?:string}){
    let id=shade.id
    while(!id || this.shades.some(s=>s.id===id)){
      id='S'+ ++this.shadeId
      if(this.scenario.shades?.some(s=>s.id===id)) id=undefined
    }
    this.shades.push({id,pos:shade.pos,state:'chase',until:0})
    return id
  }
  private emit(name:string,data:object){this.events.push({type:'event',tick:this.tick,name,data})}
  private move(input:Input){
    const p=this.player.pos, [x,z]=input.move, a=input.cam_yaw_deg*Math.PI/180
    const step=this.t.player_speed/60/Math.max(1,Math.hypot(x,z))
    p[0]+=(x*Math.cos(a)+z*Math.sin(a))*step
    p[2]+=(-x*Math.sin(a)+z*Math.cos(a))*step
    const r=Math.hypot(p[0],p[2])
    if(r>32){p[0]*=32/r; p[2]*=32/r}
    if(input.jump && !this.prev.jump && p[1]===0) this.vertical=6
    this.vertical-=18/60
    p[1]=Math.max(0,p[1]+this.vertical/60)
    if(p[1]===0) this.vertical=0
  }
  nearest(){
    return this.lanterns.filter(l=>!l.lit && distance(l.pos,this.player.pos)<=this.t.interact_radius)
      .sort((a,b)=>distance(a.pos,this.player.pos)-distance(b.pos,this.player.pos))[0]
  }
  private deposit(){
    const l=this.nearest()
    if(!l || !this.player.carried) return
    const amount=Math.min(this.player.carried,this.t.lantern_cost-l.deposited)
    this.player.carried-=amount
    l.deposited+=amount
    this.emit('deposit',{lantern_id:l.id,amount,deposited:l.deposited})
    if(l.deposited===this.t.lantern_cost){
      l.lit=true
      this.score+=this.t.score.per_lantern
      this.emit('lantern_lit',{lantern_id:l.id})
    }
  }
  private pulse(){
    const t=this.t,p=this.player
    if(this.tick<this.nextPulse || p.carried<t.pulse_cost) return
    p.carried-=t.pulse_cost
    this.nextPulse=this.tick+60*t.pulse_cooldown_s
    const ids:string[]=[]
    for(const s of this.shades){
      const d=distance(s.pos,p.pos)
      if(d>t.pulse_radius) continue
      s.pos[0]+=(d?(s.pos[0]-p.pos[0])/d:1)*t.pulse_push_m
      s.pos[2]+=(d?(s.pos[2]-p.pos[2])/d:0)*t.pulse_push_m
      s.until=this.tick+60*t.pulse_stun_s
      ids.push(s.id)
    }
    this.score+=ids.length*t.score.per_stun
    this.emit('pulse',{stunned_ids:ids})
  }
  private updateShades(){
    const p=this.player,t=this.t
    const safe=this.lanterns.filter(l=>l.lit)
    for(const s of this.shades){
      s.state=this.tick<s.until?'stunned':'chase'
      const d=distance(s.pos,p.pos)
      if(s.state==='chase' && d>0){
        const f=Math.min(1,t.shade_speed/60/d)
        s.pos[0]+=(p.pos[0]-s.pos[0])*f
        s.pos[2]+=(p.pos[2]-s.pos[2])*f
      }
      for(const l of safe){
        const r=distance(l.pos,s.pos)
        if(r>t.safe_radius) continue
        s.pos[0]=l.pos[0]+(r?(s.pos[0]-l.pos[0])/r:1)*(t.safe_radius+1e-8)
        s.pos[2]=l.pos[2]+(r?(s.pos[2]-l.pos[2])/r:0)*(t.safe_radius+1e-8)
      }
      if(s.state==='chase' && this.tick>=this.nextHit && distance(p.pos,s.pos)<=t.shade_hit_radius && !safe.some(l=>distance(l.pos,p.pos)<=t.safe_radius)){
        const dropped=Math.floor(p.carried*t.hit_drop_ratio)
        p.carried-=dropped
        p.flames=Math.max(0,p.flames-1)
        this.nextHit=this.tick+60*t.invuln_s
        this.emit('player_hit',{by:'shade',flames:p.flames,dropped})
      }
    }
  }
  step(input:Input){
    if(this.state!=='playing') return
    this.tick++
    this.events=[]
    this.move(input)
    this.motes=this.motes.filter(m=>{
      if(this.player.carried>=this.t.carry_capacity || distance(m.pos,this.player.pos)>this.t.pickup_radius) return true
      this.score+=this.t.score.per_mote
      this.emit('mote_picked',{carried:++this.player.carried})
      return false
    })
    if(input.interact && !this.prev.interact) this.deposit()
    if(input.pulse && !this.prev.pulse) this.pulse()
    this.updateShades()
    if(this.scenario.random_motes!==false && this.tick%180===0 && this.motes.length<35) this.addMote(this.randomPos())
    if(this.scenario.random_shades!==false && this.tick%1200===0 && this.shades.length<5)
      this.emit('shade_spawned',{id:this.addShade({pos:this.randomPos(22)})})
    const reason=this.lanterns.every(l=>l.lit)?'all_lit':this.player.flames===0?'no_flames':this.left===0?'dawn':null
    if(reason){
      this.state=reason==='all_lit'?'won':'lost'
      if(this.state==='won') this.score+=Math.floor(this.left)*this.t.score.per_second_left+this.player.flames*this.t.score.per_flame_left
      this.emit('game_over',{result:this.state,reason})
    }
    this.prev={...input}
  }
  snapshot(){
    const rounded=<T extends {pos:Pos}>(e:T)=>({...e,pos:e.pos.map(v=>Number(v.toFixed(3)))})
    return {type:'snapshot',tick:this.tick,sim_tick:this.tick,state:this.state,time_left_s:this.left,score:this.score,
      player:rounded(this.player),lanterns:this.lanterns.map(rounded),shades:this.shades.map(({until,...s})=>rounded(s)),
      motes_active:this.motes.length,motes:this.motes.map(rounded)}
  }
}
