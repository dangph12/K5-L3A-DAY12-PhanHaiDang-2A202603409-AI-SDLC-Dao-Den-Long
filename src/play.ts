import { Game, idle } from './game.js'
import contract from '../game.contract.json' with {type:'json'}
import { createView } from './scene.js'
import './style.css'

const islands = ['Đảo Bến', 'Đảo Cau', 'Đảo Chuông']
const stories = [
  '“Khi bến còn một ngọn đèn, thuyền vẫn tìm được đường về. Con hãy thắp sáng năm đèn trên đảo nhé.”',
  '“Qua cầu tre là rặng cau bên kia. Hãy giữ chặt túi đom đóm, Gió Lạc đang lượn ngoài bờ.”',
  '“Hãy đi theo dốc đá và tìm bục nhảy lên tháp chuông. Đợi con thắp chiếc đèn cuối, ta sẽ đón bình minh.”'
]

document.title = 'Đảo Đèn Lồng · Ba hòn đảo'
document.body.innerHTML = `
<main id="world" aria-label="Đảo Đèn Lồng"></main>
<div id="hud" hidden>
  <header>
    <div class="vitals"><small id="island"></small><span>Ngọn Lửa <b id="flames"></b></span></div>
    <div class="clock"><small>Bình minh</small><b id="time"></b></div>
    <div class="totals"><span>Đèn <b id="lit"></b></span><span>Điểm <b id="score"></b></span></div>
  </header>
  <div id="arrow" hidden aria-label="Hướng tới đèn chưa sáng"><i></i></div>
  <div id="wind" hidden><span></span></div>
  <div class="inventory"><div id="hint"></div><div id="charm"></div><div id="bag"></div><small id="bag-count"></small></div>
  <div class="skills"><span><kbd>Shift</kbd> Lướt <b id="dash-status"></b></span><span><kbd>Q</kbd> Tỏa sáng <b id="pulse-status"></b></span></div>
</div>
<dialog aria-labelledby="panel-title"><section id="panel"></section></dialog>`

const element = (id:string) => document.getElementById(id)!
const dialog = document.querySelector('dialog')!
const panel = element('panel')
const hud = element('hud')
const view = createView(element('world'))
const bag = element('bag')
for(let i = 0; i < contract.tuning.carry_capacity; i++) bag.append(document.createElement('i'))

type Page = 'menu'|'intro'|'play'|'pause'|'settings'|'result'|'dawn'
let page:Page = 'menu'
let settingsReturn:'menu'|'pause' = 'menu'
let night = 1
let scores:number[] = []
let game = new Game(contract.tuning, Date.now(), {}, night)
let yaw = 0
let pitch = 0
let accessibleColors = preference('accessible-colors',0,0,1)===1
let previousTime = 0
let accumulator = 0
let captured = false
let releasingForMenu = false
let lastPauseInput = false
const keys = new Set<string>()
const pressed = new Set<string>()
const keyCodes = new Set(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','KeyQ','KeyE'])

function preference(key:string, fallback:number, min:number, max:number) {
  try {
    const value = localStorage.getItem('dao-den-long.' + key)
    const parsed = Number(value)
    if(value !== null && Number.isFinite(parsed)) return Math.min(max, Math.max(min, parsed))
  } catch { /* Private browsing can disable local storage. */ }
  return fallback
}
let volume = preference('volume', 65, 0, 100)
let sensitivity = preference('sensitivity', 1, .25, 2)
function save(key:string, value:number) {
  try {localStorage.setItem('dao-den-long.' + key, String(value))} catch { /* Keep session settings. */ }
}

let context:AudioContext | undefined
let master:GainNode | undefined
function enableAudio() {
  if(typeof AudioContext === 'undefined') return
  if(!context) {
    context = new AudioContext()
    master = context.createGain()
    master.connect(context.destination)
    master.gain.value = volume / 100
  }
  if(context.state === 'suspended') void context.resume().catch(() => {})
}
function note(hz:number, duration:number, type:OscillatorType='sine', loudness=.15, delay=0, endHz=hz) {
  if(!context || !master || context.state !== 'running' || !volume) return
  const start = context.currentTime + delay
  const osc = context.createOscillator()
  const envelope = context.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(hz, start)
  osc.frequency.exponentialRampToValueAtTime(endHz, start + duration)
  envelope.gain.setValueAtTime(.0001, start)
  envelope.gain.exponentialRampToValueAtTime(loudness, start + Math.min(.035, duration / 4))
  envelope.gain.exponentialRampToValueAtTime(.0001, start + duration)
  osc.connect(envelope)
  envelope.connect(master)
  osc.onended = () => {osc.disconnect(); envelope.disconnect()}
  osc.start(start)
  osc.stop(start + duration)
}
const motifs:Record<string,number[]> = {
  mote_picked:[880,1320], lantern_lit:[392,494,587,784], pulse:[523,784,1047],
  player_hit:[185,130], jump:[294,392], dash:[494,659], won:[392,494,587,784,988],
  lost:[440,349,294,220], shade_spawned:[130,123], countdown:[988], wind:[370,494,740],
  charm_picked:[659,880,988], drifter_steal:[440,330], drifter_drop:[523,659]
}
function sound(name:string) {
  const notes = motifs[name]
  if(!notes) return
  const timbre = ['player_hit','shade_spawned','dash','lost'].includes(name) ? 'triangle' : 'sine'
  notes.forEach((hz,i) => note(hz, name === 'lantern_lit' || name === 'won' ? .55 : .22, timbre, .14, i * .09))
}
const nightMelody = [0,7,12,9,7,4,2,7,0,4,7,14,12,9,4,2]
function music() {
  const tick = game.sim_tick
  if(tick % 40 !== 1) return
  const beat = Math.floor(tick / 40)
  const root = [196,174.61,220][night-1]
  note(root * 2 ** (nightMelody[beat % nightMelody.length] / 12), .62, 'sine', .055)
  if(beat % 4 === 0) note(root / 2 * (beat % 8 === 0 ? 1 : 1.5), 2.1, 'triangle', .052)
}

const controls = `<details><summary>Điều khiển</summary><dl>
<dt>W A S D</dt><dd>Di chuyển</dd><dt>Chuột</dt><dd>Nhìn quanh</dd><dt>Space / Shift</dt><dd>Nhảy / Lướt</dd>
<dt>E / Q</dt><dd>Nạp ánh sáng / Tỏa sáng</dd><dt>Esc / P</dt><dd>Tạm dừng</dd></dl></details>`
const button = (action:string, text:string, primary=false) =>
  '<button type="button" data-action="'+action+'" class="'+(primary?'primary':'secondary')+'">'+text+'</button>'

function show(next:Exclude<Page,'play'>, eyebrow:string, title:string, content:string, actions:string) {
  page = next
  keys.clear()
  pressed.clear()
  hud.hidden = next !== 'pause' && !(next === 'settings' && settingsReturn === 'pause')
  if(document.pointerLockElement) {
    releasingForMenu = true
    document.exitPointerLock()
  }
  panel.innerHTML = '<small>'+eyebrow+'</small><h1 id="panel-title">'+title+'</h1>'+content+'<div class="buttons">'+actions+'</div>'
  if(!dialog.open) dialog.showModal()
  panel.querySelector<HTMLButtonElement>('button.primary, button')?.focus()
}
function menu() {
  scores = []
  night = 1
  game = new Game(contract.tuning, Date.now(), {}, night)
  view.reset()
  yaw = 0
  show('menu','Ba hòn đảo','Đảo Đèn Lồng','<p>Thu thập đom đóm và thắp sáng ba hòn đảo trước bình minh.</p>'+controls,
    button('new','Bắt đầu',true)+button('settings','Cài đặt'))
}
function intro() {
  game = new Game(contract.tuning, Date.now(), {}, night)
  lastPauseInput = false
  yaw = 0
  view.reset()
  show('intro','Đêm '+night+' / 3',islands[night-1],'<blockquote>'+stories[night-1]+'<cite>Ông Đăng</cite></blockquote>',
    button('enter','Vào đảo',true)+button('menu','Về menu'))
}
function togglePause() {
  if(lastPauseInput) game.step(idle())
  game.step({...idle(),pause:true})
  lastPauseInput = true
}
function pausePanel() {
  show('pause','Đêm '+night+' · '+islands[night-1],'Tạm dừng','',
    button('resume','Tiếp tục',true)+button('retry','Chơi lại Đêm')+button('settings','Cài đặt')+button('menu','Về menu'))
}
function pause() {
  if(page !== 'play' || game.state !== 'playing') return
  togglePause()
  pausePanel()
}
function settings() {
  settingsReturn = page === 'pause' ? 'pause' : 'menu'
  show('settings','Đảo Đèn Lồng','Cài đặt',`
  <label for="volume">Âm lượng <output id="volume-label">${volume}%</output></label>
  <input id="volume" type="range" min="0" max="100" value="${volume}">
  <label for="sensitivity">Độ nhạy chuột <output id="sensitivity-label">${sensitivity.toFixed(2)}×</output></label>
  <input id="sensitivity" type="range" min=".25" max="2" step=".05" value="${sensitivity}">
  <label for="accessible-colors">Bảng màu dễ phân biệt</label>
  <input id="accessible-colors" type="checkbox" ${accessibleColors?'checked':''}>`,button('back','Quay lại',true))
}
function back() {
  if(settingsReturn === 'menu') {menu(); return}
  pausePanel()
}
function requestMouse() {
  if(document.pointerLockElement || !view.canvas.requestPointerLock) return
  try {
    const result = view.canvas.requestPointerLock()
    result?.catch(() => {}) // Mouse movement over the canvas works when browser policy denies lock.
  } catch { /* The player can click the canvas to retry. */ }
}
function play() {
  if(page === 'pause') togglePause()
  keys.clear()
  pressed.clear()
  page = 'play'
  hud.hidden = false
  dialog.close()
  accumulator = 0
  previousTime = performance.now()
  requestMouse()
}
function result() {
  const won = game.state === 'won'
  if(won) scores[night-1] = game.score
  sound(won?'won':'lost')
  const reason = won?'Tất cả đèn trên đảo đã sáng.':game.player.flames?'Bình minh đã đến.':'Mây đã hết Ngọn Lửa.'
  show('result','Đêm '+night+' · '+islands[night-1],won?'Đảo đã sáng':'Đêm đã khép lại',
    '<p>'+reason+'</p><p class="result-score">'+game.score+' điểm</p>',
    won ? button('next',night === 3?'Đón bình minh':'Đêm kế tiếp',true) : button('retry','Chơi lại Đêm',true))
}
function dawn() {
  const breakdown = scores.map((score,i)=>'<li><span>'+islands[i]+'</span><b>'+score+'</b></li>').join('')
  show('dawn','Ba đêm đã qua','Bình Minh','<p>Ánh đèn trên ba hòn đảo dẫn lối về nhà.</p><ol>'+breakdown+'</ol><p class="result-score">Tổng điểm '+scores.reduce((a,b)=>a+b,0)+'</p>',button('menu','Về menu',true))
}
panel.addEventListener('click',e=>{
  const action = (e.target as HTMLElement).closest('button')?.dataset.action
  if(!action) return
  enableAudio()
  switch(action) {
    case 'new': scores=[]; night=1; intro(); break
    case 'enter': case 'resume': play(); break
    case 'retry': intro(); break
    case 'next': if(night===3) dawn(); else {night++; intro()} break
    case 'settings': settings(); break
    case 'back': back(); break
    case 'menu': menu(); break
  }
})
panel.addEventListener('input',e=>{
  const input = e.target as HTMLInputElement
  if(input.id==='volume') {
    volume = input.valueAsNumber
    if(master && context) master.gain.setTargetAtTime(volume/100,context.currentTime,.025)
    element('volume-label').textContent=volume+'%'
    save('volume',volume)
  } else if(input.id==='sensitivity') {
    sensitivity = input.valueAsNumber
    element('sensitivity-label').textContent=sensitivity.toFixed(2)+'×'
    save('sensitivity',sensitivity)
  } else if(input.id==='accessible-colors') {
    accessibleColors=input.checked
    save('accessible-colors',Number(accessibleColors))
  }
})
dialog.addEventListener('cancel',e=>{e.preventDefault()})
let pressWasEscape=false
addEventListener('keydown',e=>{
  if(e.code==='Escape' || e.code==='KeyP') {
    if(e.repeat) return
    if(page==='play') {e.preventDefault(); pressWasEscape = e.code==='Escape'; pause()}
    else if(page==='pause' && e.code==='KeyP') {e.preventDefault(); play()}
    else if(page==='settings' && e.code==='Escape') {e.preventDefault(); back()}
    return
  }
  if(page!=='play' || !keyCodes.has(e.code)) return
  e.preventDefault()
  if(!e.repeat) pressed.add(e.code)
  keys.add(e.code)
})
addEventListener('keyup',e=>{keys.delete(e.code); if(e.code==='Escape') pressWasEscape=false})
function leaveGame() {if(page==='play') pause()}
addEventListener('blur',leaveGame)
document.addEventListener('visibilitychange',()=>{if(document.hidden) leaveGame()})
document.addEventListener('pointerlockchange',()=>{
  const previouslyCaptured = captured
  captured = document.pointerLockElement === view.canvas
  if(!captured) {
    if(previouslyCaptured && !releasingForMenu && !pressWasEscape) leaveGame()
    releasingForMenu = false
  }
})
view.canvas.addEventListener('click',()=>{if(page==='play') requestMouse()})
document.addEventListener('mousemove',e=>{
  if(page==='play' && (captured || e.target === view.canvas)){
    yaw-=e.movementX*.23*sensitivity
    pitch=Math.max(-.65,Math.min(.85,pitch-e.movementY*.003*sensitivity))
  }
})

const setText = (node:HTMLElement,value:string) => {if(node.textContent!==value) node.textContent=value}
const nodes = Object.fromEntries(['flames','lit','time','score','island','bag-count','hint','charm','dash-status','pulse-status','arrow','wind'].map(id=>[id,element(id)]))
function renderHud() {
  const seconds = Math.ceil(game.left)
  setText(nodes.island,'Đêm '+night+' · '+islands[night-1])
  setText(nodes.time,String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'))
  nodes.time.classList.toggle('danger',game.left<=30)
  setText(nodes.flames,String(game.player.flames)+' / '+game.t.flames)
  setText(nodes.lit,game.lanterns.filter(l=>l.lit).length+' / '+game.lanterns.length)
  setText(nodes.score,String(game.score))
  setText(nodes['bag-count'],'Đom đóm '+game.player.carried+' / '+game.capacity)
  while(bag.children.length<game.capacity)bag.append(document.createElement('i'))
  while(bag.children.length>game.capacity)bag.lastElementChild?.remove()
  for(let i=0; i<bag.children.length; i++) bag.children[i].classList.toggle('filled',i<game.player.carried)
  const lantern=game.nearest()
  setText(nodes.hint,lantern?(lantern.lit?'E — Châm dầu ('+(lantern.fuelUnits/60).toFixed(1)+'/100)':'E — Nạp ánh sáng ('+lantern.deposited+'/'+(lantern.ever_lit?game.t.relight_cost:game.t.lantern_cost)+')'):'')
  setText(nodes.charm,game.charmTicks>0?'Bùa Gió · '+Math.ceil(game.charmTicks/60)+' s':'')
  setText(nodes['dash-status'],game.dashCd>0?(game.dashCd/60).toFixed(1)+' s':'Sẵn sàng')
  setText(nodes['pulse-status'],game.pulseCd>0?(game.pulseCd/60).toFixed(1)+' s':'Sẵn sàng')
  const angle=view.arrow(game)
  nodes.arrow.hidden=angle===null
  if(angle!==null) nodes.arrow.style.setProperty('--angle',angle+'deg')
  const warning=game.windWarning
  nodes.wind.hidden=!warning && !game.wind.active
  if(!nodes.wind.hidden) setText(nodes.wind.querySelector('span')!,warning?'Gió sắp nổi':'Gió mạnh')
}

function advance() {
  const input=idle()
  const down=(code:string)=>keys.has(code) || pressed.has(code)
  input.move=[Number(down('KeyD'))-Number(down('KeyA')),Number(down('KeyS'))-Number(down('KeyW'))]
  input.cam_yaw_deg=yaw
  input.jump=down('Space')
  input.dash=down('ShiftLeft') || down('ShiftRight')
  input.interact=down('KeyE')
  input.pulse=down('KeyQ')
  const wantJump=pressed.has('Space')
  const beforeY=game.player.pos[1]
  const seconds=Math.ceil(game.left)
  pressed.clear()
  game.step(input)
  lastPauseInput = false
  if(wantJump && game.player.pos[1]>beforeY && game.player.vel[1]>=6.6 && game.player.vel[1]<=7) sound('jump')
  for(const event of game.events) {
    if(event.name==='pulse') view.pulse(game)
    sound(event.name)
  }
  if(game.left>0 && Math.ceil(game.left)<seconds && Math.ceil(game.left)<=10) sound('countdown')
  if(night===3 && game.sim_tick%1800===1680) sound('wind')
  if(game.state==='won' || game.state==='lost') result()
  else music()
}
function draw(now:number) {
  accumulator+=previousTime?Math.min((now-previousTime)/1000,.20):0
  previousTime=now
  while(accumulator>=1/60) {
    if(page==='play') advance()
    else if(game.state==='paused') {
      game.step(idle())
      lastPauseInput = false
    }
    accumulator-=1/60
  }
  document.body.classList.toggle('accessible-colors',accessibleColors)
  view.draw(game,yaw,pitch,accessibleColors)
  if(!hud.hidden) renderHud()
  requestAnimationFrame(draw)
}
menu()
requestAnimationFrame(draw)
