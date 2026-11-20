import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {Game,idle,distance} from '../dist-cli/game.js'

// Tạo lộ trình bằng các thao tác di chuyển và nạp đèn của người chơi.
const {tuning:t}=JSON.parse(readFileSync('game.contract.json','utf8'))
const game=new Game(t,7)
const frames=[]
let last=''
while(game.state==='playing'){
  const input=idle(),p=game.player
  const nearest=list=>list.reduce((best,e)=>!best || distance(e.pos,p.pos)<distance(best.pos,p.pos)?e:best,null)
  const lamp=nearest(game.lanterns.filter(l=>!l.lit))
  const target=p.carried>=t.lantern_cost-lamp.deposited?lamp:nearest(game.motes)
  if(target){
    const d=distance(target.pos,p.pos)
    if(d>0) input.move=[(target.pos[0]-p.pos[0])/d,(target.pos[2]-p.pos[2])/d]
    if(target===lamp && d<=t.interact_radius){input.interact=true;input.move=[0,0]}
  }
  const encoded=JSON.stringify(input)
  if(encoded!==last){frames.push({tick:game.tick,...input});last=encoded}
  game.step(input)
}
assert.equal(game.state,'won')
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify({frames}))
console.log('PASS default Night 1, seed 7: '+game.state+' at tick '+game.tick+', score '+game.score)
