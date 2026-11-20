import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Game,idle,distance} from '../dist-cli/game.js'

const {tuning}=JSON.parse(readFileSync('game.contract.json','utf8'))
const offsets=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[-1,1],[1,-1]]
const key=(x,z)=>x+128+(z+128)*256

// Plan across ground actually reachable by foot, including the launch pads.
function walkable(game,p,q) {
  const d=distance(p,q), n=Math.max(1,Math.ceil(d/.08))
  let h=p[1]
  for(let i=1;i<=n;i++){
    const x=p[0]+(q[0]-p[0])*i/n,z=p[2]+(q[2]-p[2])*i/n
    const next=game.map.ground(x,z)
    if(!Number.isFinite(next)||next-h>.5*d/n+.001)return false
    if(game.night===3 && Math.hypot(x,z)<2.15)return false
    h=next
  }
  return true
}
function graph(game) {
  const nodes=new Map()
  for(let x=-46;x<=100;x++)for(let z=-46;z<=46;z++){
    const y=game.map.ground(x,z)
    if(Number.isFinite(y) && (game.night!==3 || Math.hypot(x,z)>=2.15))
      nodes.set(key(x,z),{pos:[x,y,z],links:[]})
  }
  for(const node of nodes.values()){
    const [x,,z]=node.pos
    const pad=game.map.pads.find(p=>distance(p.pos,node.pos)<=1)
    if(pad){
      const duration=game.night===3?.85:1.38
      const entry=nodes.get(key(Math.round(x+pad.velocity[0]*duration),Math.round(z+pad.velocity[2]*duration)))
      if(entry)node.links.push(entry)
      continue
    }
    for(const [dx,dz] of offsets){
      const other=nodes.get(key(x+dx,z+dz))
      if(other && walkable(game,node.pos,other.pos))node.links.push(other)
    }
  }
  return nodes
}
function route(game,nodes,targets,isLamp,avoid) {
  const goals=new Map(),p=game.player.pos
  const range=isLamp?1.45:.75
  for(const t of targets){
    const [x,y,z]=t.pos
    for(let i=Math.floor(x-range);i<=Math.ceil(x+range);i++){
      for(let j=Math.floor(z-range);j<=Math.ceil(z+range);j++){
        const node=nodes.get(key(i,j))
        if(node && distance(node.pos,t.pos)<=range && (isLamp || Math.abs(node.pos[1]-y)<=1.5))goals.set(node,t)
      }
    }
  }
  const roots=[]
  for(let i=Math.floor(p[0])-1;i<=Math.ceil(p[0])+1;i++)for(let j=Math.floor(p[2])-1;j<=Math.ceil(p[2])+1;j++){
    const n=nodes.get(key(i,j))
    if(n && walkable(game,p,n.pos))roots.push(n)
  }
  roots.sort((a,b)=>distance(p,a.pos)-distance(p,b.pos))
  const queue=roots.slice(0,1),from=new Map(queue.map(n=>[n,null]))
  const blocked=new Set()
  if(avoid){
    for(const shade of game.shades){
      if(shade.state==='stunned'||shade.state==='recoil')continue
      const [x,,z]=shade.pos
      const radius=Math.min(4,distance(shade.pos,p)-.4)
      for(let i=Math.floor(x-radius);i<=x+radius;i++)for(let j=Math.floor(z-radius);j<=z+radius;j++){
        if(Math.hypot(i-x,j-z)<radius)blocked.add(nodes.get(key(i,j)))
      }
    }
  }
  for(let head=0;head<queue.length;head++){
    const n=queue[head],target=goals.get(n)
    if(target){
      const path=[]
      for(let step=n;step;step=from.get(step))path.push(step.pos)
      return {path:path.reverse(),target}
    }
    for(const neighbor of n.links){
      if(from.has(neighbor)||blocked.has(neighbor))continue
      from.set(neighbor,n);queue.push(neighbor)
    }
  }
}
function steer(game,waypoint,hostiles){
  const p=game.player.pos,angle=Math.atan2(waypoint[2]-p[2],waypoint[0]-p[0])
  let best= -Infinity, direction=[0,0],clear=false
  for(const turn of [0,.35,-.35,.75,-.75,1.15,-1.15,1.57,-1.57,2,-2,Math.PI]){
    const dx=Math.cos(angle+turn), dz=Math.sin(angle+turn)
    const dest=[p[0]+dx*2.8,p[1],p[2]+dz*2.8]
    const immediate=[p[0]+dx*.22,p[1],p[2]+dz*.22]
    if(!walkable(game,p,immediate))continue
    const free=walkable(game,p,dest)
    let cost=turn*turn*.72
    for(const h of hostiles){
      const vx=h.pos[0]-p[0],vz=h.pos[2]-p[2],d=Math.hypot(vx,vz)
      // A closing shade can cover 2.25 m in this half-second window.
      for(const t of [.16,.33,.5]){
        const gap=Math.hypot(vx-dx*6*t,vz-dz*6*t)-4.5*t
        cost+=Math.max(0,2.5-gap)**2
      }
      if(d<1.1 && game.invuln)cost*=.5
    }
    if(!free && hostiles.length)cost+=1.5
    if(-cost>best){best=-cost;direction=[dx,dz];clear=free && Math.abs(game.map.ground(dest[0],dest[2])-p[1])<.05}
  }
  return {direction,clear}
}
export function playNight(night,seed,save){
  const game=new Game(tuning,seed,{},night),nodes=graph(game),frames=[]
  let target,path=[],lastInput='',lastPlan=-100,prevDash=false,previousInteract=false
  let stalled=0,airMove=[0,0]
  while(game.state==='playing'){
    const input=idle(),p=game.player
    const lamps=game.lanterns.filter(l=>!l.lit)
    const near=game.nearest()
    const deposit=p.carried>=Math.min(...lamps.map(l=>tuning.lantern_cost-l.deposited))
    const targets=deposit?lamps.filter(l=>p.carried>=tuning.lantern_cost-l.deposited):game.motes
    if(near && p.carried && !previousInteract)input.interact=true
    if(p.grounded){
      if(!targets.includes(target) || !path.length || game.tick-lastPlan>=75){
        const plan=route(game,nodes,targets,deposit,true)??route(game,nodes,targets,deposit,false)
        target=plan?.target;path=plan?.path??[];lastPlan=game.tick
      }
      while(path.length && distance(p.pos,path[0])<.3)path.shift()
      // Look a few metres ahead on the current connected walkable segment.
      while(path.length>=2 && distance(p.pos,path[1])<=3 && walkable(game,p.pos,path[1]) &&
        !game.map.pads.some(pad=>distance(pad.pos,path[0])<=1))path.shift()
      const waypoint=path[0]??target?.pos
      if(waypoint){
        const danger=game.shades.filter(s=>s.state!=='stunned' && s.state!=='recoil' && distance(s.pos,p.pos)<9 && Math.abs(s.pos[1]-p.pos[1])<1.6)
        const {direction,clear}=steer(game,waypoint,danger)
        input.move=direction
        if(stalled>=8){input.jump=true;airMove=direction;stalled=0}
        input.dash=!prevDash && clear && (danger.length>0 || distance(p.pos,waypoint)>2.4) && game.dashCd===0
        if(!game.invuln && danger.some(s=>distance(s.pos,p.pos)<2.0) && p.carried>=3 && !game.pulseCd)input.pulse=true
      }
    }else{input.move=airMove;target=undefined;path=[]}
    const encoded=JSON.stringify(input)
    if(save && lastInput!==encoded){frames.push({tick:game.tick,...input});lastInput=encoded}
    prevDash=input.dash;previousInteract=input.interact
    const previousPos=[...p.pos]
    game.step(input)
    stalled=p.grounded && distance(previousPos,p.pos)<.005 ? stalled+1 : 0
    if(p.grounded)airMove=[0,0]
  }
  if(save)writeFileSync(save,JSON.stringify({frames}))
  return {night,seed,state:game.state,ticks:game.tick,score:game.score,lit:game.lanterns.filter(l=>l.lit).length}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const nights=process.argv[2]?[Number(process.argv[2])]:[2,3]
  for(const night of nights){
    const result=playNight(night,Number(process.argv[3]??(night===3?1:7)),process.argv[4])
    console.log(JSON.stringify(result))
    assert.equal(result.state,'won')
  }
}
