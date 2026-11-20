import * as T from 'three'

export function createView(host){
  const renderer=new T.WebGLRenderer({antialias:true})
  renderer.setPixelRatio(Math.min(devicePixelRatio,2))
  renderer.setClearColor(0x423957)
  host.append(renderer.domElement)
  const scene=new T.Scene()
  scene.fog=new T.FogExp2(0x5c5075,.014)
  const camera=new T.PerspectiveCamera(53,1,.1,230)
  const ambient=new T.HemisphereLight(0xf9ddcb,0x52486e,1.55)
  scene.add(ambient)
  const moon=new T.DirectionalLight(0xffddad,2.2)
  moon.position.set(-25,42,-10)
  scene.add(moon)
  const material=(color,glow=false)=>glow?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial({color,flatShading:true})
  const mesh=(parent,geo,mat,x=0,y=0,z=0)=>{
    const obj=new T.Mesh(geo,mat)
    parent.add(obj)
    obj.position.set(x,y,z)
    return obj
  }
  const cylinder=(a,b,h,s=12)=>new T.CylinderGeometry(a,b,h,s)
  const sphere=new T.IcosahedronGeometry(1,1)
  const wood=material(0x684958),gold=material(0xffc566,true),grass=material(0x66817d)
  mesh(scene,cylinder(32,29,3,64),grass,0,-1.5)
  mesh(scene,cylinder(29,16,10,40),material(0x594e65),0,-8)
  mesh(scene,cylinder(16,3,10,32),material(0x443e58),0,-17)
  // Tán cây nhỏ quanh rìa đảo giữ đường đến năm đèn thông thoáng.
  for(let i=0;i<32;i++){
    const a=i*2.4,r=28+2*Math.sin(i*7),x=Math.sin(a)*r,z=Math.cos(a)*r
    mesh(scene,cylinder(.17,.28,1.6),wood,x,.8,z)
    const leaves=mesh(scene,sphere,material(i%2?0x426961:0x50796e),x,2.3,z)
    leaves.scale.set(1.3,1.7,1.2)
  }
  const mist=material(0xbfa9c7)
  for(let i=0;i<120;i++){
    const a=i*2.4,r=38+((i*23)%75)
    mesh(scene,sphere,mist,r*Math.cos(a),-7-i%5,r*Math.sin(a)).scale.set(8+i%8,2+i%4,6+i%6)
  }
  const stars=new T.BufferGeometry(),points=[]
  for(let i=1;i<480;i++){
    const a=i*2.39996,y=(i%99)/100,r=135*Math.sqrt(1-y*y)
    points.push(Math.sin(a)*r,y*135,Math.cos(a)*r)
  }
  stars.setAttribute('position',new T.Float32BufferAttribute(points,3))
  scene.add(new T.Points(stars,new T.PointsMaterial({color:0xffe6c6,size:.19,fog:false})))
  const may=new T.Group()
  scene.add(may)
  mesh(may,cylinder(.32,.45,.85),material(0xd87a51),0,.62)
  mesh(may,sphere,material(0xd9a580),0,1.24).scale.setScalar(.32)
  mesh(may,new T.ConeGeometry(.68,.37,18),material(0xe3bb83),0,1.65)
  mesh(may,cylinder(.025,.025,.36),wood,.47,1.31)
  mesh(may,sphere,gold,.47,1.06).scale.set(.14,.18,.14)
  const posts=[],motes=new Map(),shades=new Map()
  const lanternGeo=cylinder(.53,.48,1.05,8),dark=material(0x93716b),ink=material(0x392445),stunned=material(0x8c719a)
  const band=material(0x654751)
  const shadowMat=new T.MeshBasicMaterial({color:0x453a51,transparent:true,opacity:.32,depthWrite:false})
  const shadow=mesh(scene,new T.CircleGeometry(.68,20),shadowMat)
  shadow.rotation.x=-Math.PI/2
  const wave=mesh(scene,new T.RingGeometry(.94,1,64),new T.MeshBasicMaterial({color:0xffda85,side:T.DoubleSide,transparent:true}))
  wave.rotation.x=-Math.PI/2
  let pulseAt=-100
  function sync(list,map,make,update){
    const active=new Set(list.map(e=>e.id))
    for(const [id,o] of map) if(!active.has(id)){scene.remove(o);map.delete(id)}
    for(const e of list){
      if(!map.has(e.id)) map.set(e.id,make())
      const o=map.get(e.id)
      o.position.set(...e.pos)
      update(o,e)
    }
  }
  function resize(){
    renderer.setSize(innerWidth,innerHeight,false)
    camera.aspect=innerWidth/innerHeight
    camera.updateProjectionMatrix()
  }
  addEventListener('resize',resize)
  resize()
  return {canvas:renderer.domElement,pulse(game){
    pulseAt=game.tick
    wave.position.set(game.player.pos[0],.08,game.player.pos[2])
  },reset(){pulseAt=-100},draw(game,yaw){
    const [x,y,z]=game.player.pos, a=yaw*Math.PI/180
    may.position.set(x,y,z)
    shadow.position.set(x,.025,z)
    may.rotation.y=a
    camera.position.set(x+Math.sin(a)*10,y+7.8,z+Math.cos(a)*10)
    camera.lookAt(x,y+.9,z)
    for(const [i,l] of game.lanterns.entries()){
      if(!posts[i]){
        const g=new T.Group()
        scene.add(g)
        mesh(g,cylinder(.19,.32,2.5),wood,0,1.25)
        mesh(g,cylinder(.8,.94,.28),band,0,.14)
        const lamp=mesh(g,lanternGeo,dark,0,2.75)
        mesh(g,new T.ConeGeometry(.84,.52,8),band,0,3.52)
        mesh(g,cylinder(.61,.49,.17,8),band,0,2.18)
        const light=new T.PointLight(0xffaa46,0,12)
        light.position.y=2.8
        g.add(light)
        posts[i]={g,lamp,light}
      }
      const {g,lamp,light}=posts[i]
      g.position.set(...l.pos)
      lamp.material=l.lit?gold:dark
      light.intensity=l.lit?28:0
    }
    ambient.intensity=1.55+game.lanterns.filter(l=>l.lit).length*.2
    sync(game.motes,motes,()=>mesh(scene,sphere,gold),(o,e)=>{
      o.scale.setScalar(.16)
      o.position.y+=.66+.17*Math.sin(game.tick/16+Number(e.id.slice(1)))
    })
    sync(game.shades,shades,()=>mesh(scene,sphere,ink),(o,e)=>{
      o.position.y+=.65+.11*Math.sin(game.tick/12)
      o.scale.set(.59,.77,.55)
      o.material=e.state==='stunned'?stunned:ink
    })
    const progress=(game.tick-pulseAt)/28
    wave.visible=progress>=0 && progress<1
    if(wave.visible){wave.scale.setScalar(.25+progress*game.t.pulse_radius);wave.material.opacity=1-progress}
    renderer.render(scene,camera)
  }}
}
