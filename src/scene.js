import * as T from 'three'
import {mapFor,terraces} from './maps.js'

const colors={
  sky:0x0e1430,fog:0x1b2350,grass:0x2f5d50,sand:0xc9b48a,wood:0x6b4a2f,clouds:0x12384a,
  lit:0xffb347,core:0xffe9b0,off:0x5b5f6e,mote:0xfff6c2,halo:0xffe58a,
  ink:0x120a1a,rim:0x7a3cff,stun:0x3a3450,coat:0xe8e2d0,red:0xc8102e,gold:0xf2c14e,drifter:0x8fa3b8
}
const tau=Math.PI*2
const radians=degrees=>degrees*Math.PI/180
const ground=(color)=>new T.MeshStandardMaterial({color,roughness:.9})
const unlit=(color)=>new T.MeshBasicMaterial({color})
const mats=Object.fromEntries(Object.entries(colors).map(([name,c])=>[name,ground(c)]))
const core=unlit(colors.core), firefly=unlit(colors.mote), gilding=unlit(colors.gold)
const inkEdge=new T.MeshBasicMaterial({color:colors.rim,side:T.BackSide})
const inkEdgeAccessible=new T.MeshBasicMaterial({color:0x00b3ff,side:T.BackSide})
const inkEyes=new T.MeshBasicMaterial({color:colors.rim})
const inkEyesAccessible=new T.MeshBasicMaterial({color:0x00b3ff})
const haloMaterial=new T.MeshBasicMaterial({color:colors.halo,transparent:true,opacity:.17,depthWrite:false})
const paper=unlit(colors.lit),lightless=ground(colors.off)
const sphere=new T.SphereGeometry(1,20,14)
const rock=new T.IcosahedronGeometry(1,2)
const rod=new T.CylinderGeometry(1,1,1,24)
const cone=new T.ConeGeometry(1,1,40)
const plank=new T.BoxGeometry(1,1,1,3,2,3)
const ring=new T.TorusGeometry(1,.055,8,48)
const brush=ground(0x527969),stone=ground(0x344453),deepRock=ground(0x263141)
const skin=ground(0xdaaa86), hair=ground(0x292333), boots=ground(0x43382e)
const cloudMat=ground(colors.clouds)
const lightDirection=new T.Vector3(-.36,.83,.4).normalize()

function part(parent,geometry,material,pos,scale){
  const obj=new T.Mesh(geometry,material)
  parent.add(obj)
  obj.position.set(...pos)
  if(scale) obj.scale.set(...scale)
  return obj
}

// Batch fixed shapes with the same material to keep draw counts predictable.
function brushes(){
  const batches=new Map(), transform=new T.Object3D()
  return {
    stamp(geometry,material,pos,scale,rotation=[0,0,0]){
      let byMaterial=batches.get(geometry)
      if(!byMaterial){byMaterial=new Map();batches.set(geometry,byMaterial)}
      let list=byMaterial.get(material)
      if(!list){list=[];byMaterial.set(material,list)}
      transform.position.set(...pos)
      transform.scale.set(...scale)
      transform.rotation.set(...rotation)
      transform.updateMatrix()
      list.push(transform.matrix.clone())
    },
    finish(parent){
      for(const [geometry,byMaterial] of batches){
        for(const [material,list] of byMaterial){
          const mesh=new T.InstancedMesh(geometry,material,list.length)
          list.forEach((m,i)=>mesh.setMatrixAt(i,m))
          mesh.computeBoundingSphere()
          parent.add(mesh)
        }
      }
    }
  }
}

function terraceShell(){
  const shape=new T.Shape()
  shape.absarc(0,0,terraces.outer,0,Math.PI,false)
  shape.lineTo(-terraces.inner,0)
  shape.absarc(0,0,terraces.inner,Math.PI,0,true)
  shape.closePath()
  const g=new T.ExtrudeGeometry(shape,{depth:3,bevelEnabled:false,curveSegments:64})
  // Local +Y becomes +Z. Extrusion runs downwards from the upper terrace.
  g.rotateX(Math.PI/2)
  g.translate(0,3,0)
  return g
}
const terraceGeo=terraceShell()

function makeTerrain(night){
  const map=mapFor(night),root=new T.Group(), b=brushes()
  const ownGeo=[]
  for(const {x,radius:r} of map.islands){
    const crust=new T.CylinderGeometry(r,r-.7,1.4,128)
    const stoneBase=new T.CylinderGeometry(r-.7,r*.8,5,96)
    const tail=new T.CylinderGeometry(r*.8,r*.28,10,64)
    ownGeo.push(crust,stoneBase,tail)
    part(root,crust,[mats.sand,mats.grass,mats.sand],[x,-.7,0])
    part(root,stoneBase,stone,[x,-3.9,0])
    part(root,tail,deepRock,[x,-11.4,0])
    for(let i=0;i<29;i++){
      const angle=i*2.39996,radius=r-1.9-.65*Math.sin(i*2)
      const tx=x+radius*Math.cos(angle),tz=radius*Math.sin(angle)
      if(map.bridge && Math.abs(tz)<4) continue
      const h=2.1+.7*Math.cos(i*13)
      b.stamp(rod,mats.wood,[tx,h/2,tz],[.15,h,.16])
      for(let k=0;k<3;k++){
        b.stamp(rock,k===2?brush:mats.grass,[tx+.35*Math.sin(k*2+i),h+.75*k,tz+.28*Math.cos(k*2+i)],
          [1.55-k*.31,1.02-k*.13,1.25-k*.2],[.08,i+k,.05])
      }
      b.stamp(rock,stone,[tx+Math.cos(angle)*1.6,.2,tz+Math.sin(angle)*1.6],[1.1,.7,.85],[0,i,.25])
    }
    // Drifting clouds below the unguarded edge and distant sea-level haze.
    for(let i=0;i<57;i++){
      const a=i*2.39996,d=r+5+(i*13%56)
      b.stamp(rock,cloudMat,[x+d*Math.cos(a),-7-i%6,d*Math.sin(a)],
        [5+i%6,1.4+i%2,4+i%5],[0,i,0])
    }
  }
  if(map.bridge){
    const {left,right,halfWidth}=map.bridge
    const n=42
    const step=(right-left)/n
    for(let i=0;i<n;i++){
      b.stamp(rod,mats.wood,[left+(i+.5)*step,-.13,0],[.25,2*halfWidth,.16],[Math.PI/2,0,0])
    }
    for(const z of [-1.45,1.45]) b.stamp(rod,mats.sand,[(left+right)/2,-.26,z],[.19,right-left,.19],[0,0,Math.PI/2])
  }
  if(night===3){
    part(root,terraceGeo,[mats.grass,stone],[0,0,0])
    const top=new T.CylinderGeometry(terraces.top,terraces.top,6,96)
    ownGeo.push(top)
    part(root,top,[stone,mats.grass,stone],[0,3,0])
    for(const angle of terraces.angles){
      const a=radians(angle),delta=terraces.rampFoot-terraces.outer
      const ramp=part(root,plank,mats.sand,[27*Math.cos(a),1.42,27*Math.sin(a)],[Math.hypot(delta,3)+.1,.18,terraces.rampWidth])
      ramp.rotation.order='YXZ'
      ramp.rotation.y=-a
      ramp.rotation.z=-Math.atan2(3,delta)
    }
    b.stamp(rod,mats.wood,[0,9.4,0],[1.72,6.8,1.72])
    for(const h of [6.26,7.1,11.1,12.6]) b.stamp(rod,mats.gold,[0,h,0],[1.9,.18,1.9])
    b.stamp(cone,mats.wood,[0,13.22,0],[2,1.56,2])
    for(let k=0;k<4;k++){
      const a=k*Math.PI/2
      b.stamp(sphere,mats.gold,[1.74*Math.cos(a),11.87,1.74*Math.sin(a)],[.39,.53,.39])
    }
  }
  for(const pad of map.pads){
    const [x,y,z]=pad.pos
    b.stamp(rod,mats.wood,[x,y+.055,z],[1,.11,1])
    b.stamp(ring,gilding,[x,y+.118,z],[.86,.86,.86],[Math.PI/2,0,0])
    const angle=Math.atan2(pad.velocity[0],pad.velocity[2])
    for(const side of [-1,1]){
      b.stamp(plank,mats.coat,[x+side*.15*Math.cos(angle),y+.121,z-side*.15*Math.sin(angle)],
        [.075,.03,.59],[0,angle-side*.57,0])
    }
  }
  b.finish(root)
  root.userData.dispose=()=>{
    for(const mesh of root.children) if(mesh.isInstancedMesh) mesh.dispose()
    ownGeo.forEach(g=>g.dispose())
  }
  return root
}

function avatar(){
  const may=new T.Group(), legs=[]
  for(const side of [-1,1]){
    const leg=part(may,sphere,boots,[side*.18,.23,0],[.14,.24,.17])
    legs.push(leg)
    part(may,sphere,mats.coat,[side*.37,.92,.015],[.13,.29,.15]).rotation.z=side*.24
    part(may,sphere,skin,[side*.44,.70,.06],[.105,.135,.105])
  }
  part(may,new T.CylinderGeometry(.27,.42,.72,36,4),mats.coat,[0,.71,0])
  part(may,rod,mats.red,[0,.73,0],[.356,.08,.356])
  part(may,sphere,skin,[0,1.30,0],[.315,.36,.30])
  part(may,sphere,hair,[0,1.48,-.02],[.33,.19,.32])
  for(const side of [-1,1]) part(may,sphere,hair,[side*.12,1.32,.267],[.027,.036,.022])
  part(may,rod,mats.red,[0,1.06,0],[.26,.13,.25])
  part(may,plank,mats.red,[-.13,.89,-.24],[.13,.34,.04]).rotation.z=.22
  part(may,cone,mats.sand,[0,1.77,0],[.7,.42,.7])
  part(may,ring,mats.wood,[0,1.565,0],[.675,.675,.675]).rotation.x=Math.PI/2
  for(let i=0;i<3;i++) part(may,ring,mats.wood,[0,1.63+i*.075,0],Array(3).fill(.55-i*.13)).rotation.x=Math.PI/2
  part(may,rod,mats.wood,[.53,1.37,0],[.017,.36,.017])
  part(may,sphere,paper,[.53,1.14,0],[.14,.17,.14])
  part(may,rod,core,[.53,.97,0],[.06,.035,.06])
  return {may,legs}
}

function beacon(){
  const root=new T.Group()
  part(root,rod,mats.wood,[0,1.32,0],[.17,2.55,.17])
  part(root,rod,stone,[0,.13,0],[.76,.26,.76])
  const glass=part(root,sphere,lightless,[0,2.82,0],[.57,.75,.57])
  const center=part(root,sphere,core,[0,2.82,0],[.23,.56,.23])
  const fuelBack=part(root,plank,mats.ink,[.68,2.77,0],[.10,1,.10])
  const fuelBar=part(root,plank,mats.gold,[.68,2.77,0],[.12,1,.12])
  const tear=part(root,cone,mats.ink,[.28,2.66,.42],[.16,.34,.05])
  for(let i=0;i<6;i++){
    const a=i*tau/6
    part(root,rod,mats.wood,[.49*Math.cos(a),2.82,.49*Math.sin(a)],[.026,1.03,.026])
  }
  for(const y of [2.29,3.35]) part(root,rod,mats.wood,[0,y,0],[.52,.10,.52])
  part(root,cone,mats.wood,[0,3.59,0],[.83,.48,.83])
  part(root,sphere,mats.gold,[0,3.88,0],[.09,.13,.09])
  const pool=part(root,new T.CircleGeometry(1,64),new T.MeshBasicMaterial({
    color:colors.lit,transparent:true,opacity:.09,depthWrite:false
  }),[0,.025,0],[6,6,6])
  pool.rotation.x=-Math.PI/2
  return {root,glass,center,pool,fuelBack,fuelBar,tear}
}

function makeShade(){
  const root=new T.Group()
  const shell=part(root,sphere,inkEdge,[0,0,0],[.60,.68,.54])
  const body=part(root,sphere,mats.ink,[0,0,0],[.58,.66,.52])
  root.userData.body=body
  root.userData.rim=shell
  root.userData.eyes=[]
  for(const side of [-1,1]){
    root.userData.eyes.push(part(root,sphere,inkEyes,[side*.17,.08,.47],[.061,.058,.035]))
    part(root,cone,mats.ink,[side*.30,-.46,.04],[.18,.49,.18]).rotation.z=Math.PI+side*.27
  }
  shell.renderOrder=-1
  return root
}
function makeDrifter(){
  const root=new T.Group()
  for(let i=0;i<6;i++) part(root,sphere,mats.drifter,[0,0,-i*.22],
    [.22*(1-i*.12),.068,.23])
  return root
}
function makeCharm(){
  const root=new T.Group()
  part(root,plank,mats.gold,[0,0,0],[.42,.66,.09])
  part(root,plank,mats.red,[0,0,0],[.36,.59,.102])
  part(root,plank,gilding,[0,.02,.055],[.12,.12,.014]).rotation.z=Math.PI/4
  return root
}
function makeMote(){
  const root=new T.Group()
  part(root,sphere,firefly,[0,0,0],[.15,.17,.15])
  part(root,sphere,haloMaterial,[0,0,0],[.30,.32,.30])
  return root
}

export function createView(host){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))
  host.append(renderer.domElement)
  const scene=new T.Scene()
  scene.background=new T.Color(colors.sky)
  scene.fog=new T.FogExp2(colors.fog,.012)
  const camera=new T.PerspectiveCamera(55,1,.1,260)
  const ambient=new T.HemisphereLight(0xffedcf,0x596580,.15)
  const moon=new T.DirectionalLight(0xffe5ba,2)
  moon.position.copy(lightDirection)
  scene.add(ambient,moon)
  const stars=new T.BufferGeometry(),points=[]
  for(let i=1;i<620;i++){
    const a=i*2.39996,y=(i%99)/100,r=175*Math.sqrt(1-y*y)
    points.push(Math.sin(a)*r,y*175,Math.cos(a)*r)
  }
  stars.setAttribute('position',new T.Float32BufferAttribute(points,3))
  scene.add(new T.Points(stars,new T.PointsMaterial({color:colors.core,size:.18,fog:false})))
  const {may,legs}=avatar()
  scene.add(may)
  const avatarMaterials=[]
  may.traverse(obj=>{
    if(!obj.isMesh)return
    obj.material=obj.material.clone()
    obj.material.userData.baseColor=obj.material.color.clone()
    avatarMaterials.push(obj.material)
  })
  let tintUntil=-1,tintColor=0xff5a5f
  const shadow=part(scene,new T.CircleGeometry(.58,48),new T.MeshBasicMaterial({
    color:0x132537,transparent:true,opacity:.38,depthWrite:false
  }),[0,.024,0])
  shadow.rotation.x=-Math.PI/2
  const wave=part(scene,new T.RingGeometry(.96,1,96),new T.MeshBasicMaterial({
    color:colors.halo,side:T.DoubleSide,transparent:true,depthWrite:false
  }),[0,0,0])
  wave.rotation.x=-Math.PI/2
  const leaves=Array.from({length:14},()=>part(scene,rock,mats.sand,[0,0,0],[.23,.035,.08]))
  const posts=[],motemap=new Map(),shademap=new Map(),driftermap=new Map(),charmmap=new Map()
  let night=0,terrain,pulseAt=-100
  function sync(list,map,make,update){
    const ids=new Set()
    for(const e of list){
      ids.add(e.id)
      let o=map.get(e.id)
      if(!o){o=make();map.set(e.id,o);scene.add(o)}
      o.position.set(...e.pos)
      update(o,e)
    }
    for(const [id,obj] of map) if(!ids.has(id)){scene.remove(obj);map.delete(id)}
  }
  function resize(){
    renderer.setSize(innerWidth,innerHeight,false)
    camera.aspect=innerWidth/innerHeight
    camera.updateProjectionMatrix()
  }
  addEventListener('resize',resize)
  resize()
  const projected=new T.Vector3()
  return {
    canvas:renderer.domElement,
    pulse(game){
      pulseAt=game.sim_tick
      wave.position.set(game.player.pos[0],game.player.pos[1]+.15,game.player.pos[2])
    },
    impact(game,kind,amount){
      if(amount<=0 && kind==='stolen')return
      tintColor=kind==='damage'?0xff5a5f:0xffe58a
      tintUntil=game.sim_tick+30
    },
    reset(){pulseAt=-100},
    arrow(game){
      let nearest=null,best=Infinity
      const p=game.player.pos
      for(const l of game.lanterns){
        const d=Math.hypot(l.pos[0]-p[0],l.pos[2]-p[2])
        if(!l.lit && d<best){nearest=l;best=d}
      }
      if(!nearest) return null
      projected.set(...nearest.pos)
      projected.y+=2.8
      const local=camera.worldToLocal(projected.clone())
      projected.project(camera)
      if(local.z<0 && Math.abs(projected.x)<=1 && Math.abs(projected.y)<=1 && projected.z<=1) return null
      if(local.z>=0) return Math.atan2(local.x,-Math.max(.001,Math.abs(local.z)))*180/Math.PI
      return Math.atan2(projected.x*camera.aspect,projected.y)*180/Math.PI
    },
    draw(game,yaw,pitch=0,colorblind=false){
      if(night!==game.night){
        if(terrain){scene.remove(terrain);terrain.userData.dispose()}
        night=game.night
        terrain=makeTerrain(night)
        scene.add(terrain)
        pulseAt=-100
      }
      const [x,y,z]=game.player.pos,a=radians(yaw),ticks=game.sim_tick
      if(ticks<tintUntil){
        const strength=.35+.45*Math.abs(Math.sin(ticks*.65))
        for(const material of avatarMaterials)material.color.lerpColors(material.userData.baseColor??material.color,new T.Color(tintColor),strength)
      }else for(const material of avatarMaterials)material.color.copy(material.userData.baseColor??material.color)
      may.position.set(x,y,z)
      may.rotation.y=Math.atan2(...game.facing)
      const velocity=game.player.vel
      const stride=velocity && Math.hypot(velocity[0],velocity[2])>.1?Math.sin(ticks*.29)*.15:0
      legs[0].position.z=stride;legs[1].position.z=-stride
      const floor=mapFor(night).ground(x,z)
      shadow.visible=Number.isFinite(floor) && y>=floor-.01
      if(shadow.visible) shadow.position.set(x,floor+.024,z)
      camera.position.set(x+Math.sin(a)*10*Math.cos(pitch),y+6.8+10*Math.sin(pitch),z+Math.cos(a)*10*Math.cos(pitch))
      camera.lookAt(x,y+1.05,z)
      for(const [i,l] of game.lanterns.entries()){
        if(!posts[i]){posts[i]=beacon();scene.add(posts[i].root)}
        const {root,glass,center,pool,fuelBack,fuelBar,tear}=posts[i]
        root.visible=true
        root.position.set(...l.pos)
        glass.material=l.lit?paper:lightless
        glass.scale.y=l.lit?1:.8
        glass.rotation.z=l.lit?0:.12
        tear.visible=!l.lit
        const fill=l.fuelUnits/(game.t.fuel_max*60)
        center.scale.y=l.lit?Math.max(.08,fill):1
        fuelBack.visible=l.lit
        fuelBar.visible=l.lit && (fill>=.3 || Math.floor(ticks/30)%2===0)
        fuelBar.scale.y=Math.max(.01,fill)
        fuelBar.position.y=2.27+fill*.5
        glass.visible=!l.lit || fill>=.3 || Math.floor(ticks/30)%2===0
        center.visible=pool.visible=l.lit
      }
      for(let i=game.lanterns.length;i<posts.length;i++) posts[i].root.visible=false
      ambient.intensity=.15+.55*game.lanterns.filter(l=>l.lit).length/game.lanterns.length
      sync(game.motes,motemap,makeMote,(o,e)=>{
        o.position.y+=.62+.12*Math.sin(ticks/16+o.id)
        o.scale.setScalar(e.kind==='dropped'?.88:1)
      })
      sync(game.shades,shademap,makeShade,(o,e)=>{
        o.position.y+=.1*Math.sin(ticks/13)
        o.rotation.y=Math.atan2(x-o.position.x,z-o.position.z)
        o.userData.body.material=e.state==='stunned'?mats.stun:mats.ink
        o.userData.rim.material=colorblind?inkEdgeAccessible:inkEdge
        for(const eye of o.userData.eyes)eye.material=colorblind?inkEyesAccessible:inkEyes
      })
      sync(game.drifters,driftermap,makeDrifter,(o,e)=>{
        o.position.y+=.55
        o.rotation.y=Math.atan2(x-o.position.x,z-o.position.z)+(e.state==='flee'?Math.PI:0)
        o.children.forEach((segment,i)=>{segment.position.x=i*.045*Math.sin(ticks*.16-i*.6)})
      })
      sync(game.charms,charmmap,makeCharm,(o,e)=>{
        o.visible=e.available
        o.position.y+=.9+.12*Math.sin(ticks/18)
        o.rotation.y=ticks*.025
      })
      const windActive=game.wind.active || game.windWarning
      for(const [i,leaf] of leaves.entries()){
        leaf.visible=Boolean(windActive)
        if(!windActive) continue
        const speed=game.wind.active?.24:.13
        const along=(i*7+ticks*speed)%24-12,across=(i*31%17)-8
        const rad=radians(game.wind.dir_deg)
        leaf.position.set(x+along*Math.cos(rad)-across*Math.sin(rad),
          y+1.7+Math.sin(i+ticks*.035),z+along*Math.sin(rad)+across*Math.cos(rad))
        leaf.rotation.set(ticks*.06,i+rad,ticks*.04)
      }
      const progress=(ticks-pulseAt)/28
      wave.visible=progress>=0 && progress<1
      if(wave.visible){wave.scale.setScalar(.24+progress*game.t.pulse_radius);wave.material.opacity=1-progress}
      renderer.render(scene,camera)
    }
  }
}
