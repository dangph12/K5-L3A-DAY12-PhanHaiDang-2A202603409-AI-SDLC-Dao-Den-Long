import {Game,idle} from './game.js'
import contract from '../game.contract.json' with {type:'json'}
import {createView} from './scene.js'
import './style.css'
const element=(id:string)=>document.getElementById(id)!
const dialog=document.querySelector('dialog')!
const start=()=>new Game(contract.tuning,Date.now())
let game=start(),yaw=0,last=0,accumulator=0
const view=createView(element('world'))
const keys=new Set<string>()
const actions=new Set<string>()
addEventListener('keydown',e=>{
  if(e.code==='Space') e.preventDefault()
  if(!e.repeat && !dialog.open) actions.add(e.code)
  keys.add(e.code)
})
addEventListener('keyup',e=>keys.delete(e.code))
function clear(){keys.clear();actions.clear();accumulator=0;last=0}
addEventListener('blur',clear)
document.addEventListener('visibilitychange',clear)
view.canvas.addEventListener('pointerdown',(e:PointerEvent)=>view.canvas.setPointerCapture(e.pointerId))
view.canvas.addEventListener('pointermove',(e:PointerEvent)=>{
  if(e.buttons===1) yaw-=e.movementX*.35
})
function hud(){
  const lit=game.lanterns.filter(l=>l.lit).length
  const seconds=Math.ceil(game.left)
  element('time').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')
  element('lit').textContent=lit+' / '+game.lanterns.length
  element('score').textContent=String(game.score)
  element('flames').textContent='◆'.repeat(game.player.flames)
  element('bag').textContent=game.player.carried+' / '+game.t.carry_capacity
  const l=game.nearest()
  element('hint').textContent=l?'E · Nạp đèn　'+l.deposited+' / '+game.t.lantern_cost:''
}
document.querySelector('button')!.onclick=()=>{
  game=start();yaw=0;clear();view.reset();dialog.close()
}
function draw(now:number){
  accumulator+=last?Math.min((now-last)/1000,.2):0
  last=now
  while(accumulator>=1/60 && game.state==='playing'){
    const input=idle()
    input.move=[Number(keys.has('KeyD'))-Number(keys.has('KeyA')),Number(keys.has('KeyS'))-Number(keys.has('KeyW'))]
    input.cam_yaw_deg=yaw
    input.jump=keys.has('Space')||actions.has('Space')
    input.interact=keys.has('KeyE')||actions.has('KeyE')
    input.pulse=keys.has('KeyQ')||actions.has('KeyQ')
    actions.clear()
    game.step(input)
    if(game.events.some(e=>e.name==='pulse')) view.pulse(game)
    accumulator-=1/60
  }
  if(game.state!=='playing' && !dialog.open){
    dialog.querySelector('h2')!.textContent=game.state==='won'?'Đảo Bến bừng sáng':'Đêm đã khép lại'
    dialog.querySelector('p')!.textContent=(game.state==='won'?'Năm đèn lớn đã sáng.':game.player.flames?'Bình minh đã đến.':'Mây đã hết lửa.')+' Điểm: '+game.score
    dialog.showModal()
  }
  hud();view.draw(game,yaw);requestAnimationFrame(draw)
}
dialog.addEventListener('cancel',e=>e.preventDefault())
requestAnimationFrame(draw)
