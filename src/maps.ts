export type Pos = [number, number, number]
export interface NightMap {
  start: Pos
  islands: {x:number; radius:number}[]
  bridge?: {left:number; right:number; halfWidth:number}
  lanterns: Pos[]
  motes: Pos[]
  spawns: Pos[]
  pads: {pos:Pos; velocity:Pos}[]
  charms: Pos[]
  ground(x:number,z:number):number
}

function ring(radius:number, count:number, start=0, y=0, centerX=0, arc=360):Pos[] {
  return Array.from({length:count},(_,i)=>{
    const a=(start+i*arc/count)*Math.PI/180
    return [centerX+radius*Math.cos(a),y,radius*Math.sin(a)]
  })
}

export const terraces={inner:12,outer:24,top:8,tower:2,rampFoot:30,rampWidth:3,angles:[30,150]}
function bellGround(x:number,z:number){
  const r=Math.hypot(x,z)
  if(r>45) return -Infinity
  if(r<=terraces.top) return 6
  if(z>0 && r>=terraces.inner && r<=terraces.outer) return 3
  for(const deg of terraces.angles){
    const a=deg*Math.PI/180
    const along=x*Math.cos(a)+z*Math.sin(a)
    const across=z*Math.cos(a)-x*Math.sin(a)
    if(Math.abs(across)<=terraces.rampWidth/2 && along>=terraces.outer-.06 && along<=terraces.rampFoot)
      return Math.min(3,(terraces.rampFoot-along)/2)
  }
  return 0
}

function pad(pos:Pos,targetX:number){
  const dx=targetX-pos[0], dz=-pos[2], length=Math.hypot(dx,dz)
  const velocity:Pos=[24*dx/length,14,24*dz/length]
  return {pos,velocity}
}

const bridge={left:26,right:44,halfWidth:2}
const maps:NightMap[]=[
  {
    start:[0,0,0], islands:[{x:0,radius:40}],
    lanterns:[[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]],
    motes:[...ring(12,8),...ring(33,16)], spawns:ring(37,12,15),
    pads:[], charms:[], ground:(x,z)=>Math.hypot(x,z)<=40?0:-Infinity
  },
  {
    start:[0,0,0], islands:[{x:0,radius:28},{x:70,radius:28}],bridge,
    lanterns:[[0,0,20],[17,0,-10],[-17,0,-10],[70,0,20],[87,0,-10],[53,0,-10]],
    motes:[0,70].flatMap(x=>[...ring(10,4,0,0,x),...ring(22,8,0,0,x)]),
    spawns:[0,70].flatMap(x=>ring(26,8,22.5,0,x)),
    pads:[pad([20,0,18],70),pad([50,0,-18],0)],charms:[[35,0,0]],
    ground:(x,z)=>Math.min(Math.hypot(x,z),Math.hypot(x-70,z))<=28 ||
      (x>=bridge.left && x<=bridge.right && Math.abs(z)<=bridge.halfWidth)?0:-Infinity
  },
  {
    start:[0,0,-26], islands:[{x:0,radius:45}],
    lanterns:[[0,6,6],[18,3,10],[-18,3,10],[35,0,-10],[-35,0,-10],[20,0,-35],[-20,0,-35]],
    motes:[...ring(34,18),...ring(18,8,20,3,0,160),...ring(5,4,45,6)],
    spawns:ring(43,16),pads:[{pos:[0,3,13],velocity:[0,12,-8]}],
    charms:[[30,0,25],[-30,0,25]],ground:bellGround
  }
]

export function mapFor(night:number):NightMap {
  const map=maps[night-1]
  if(!map) throw new RangeError('Đêm phải là 1, 2 hoặc 3')
  return map
}
