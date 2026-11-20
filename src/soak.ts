import {writeFileSync} from 'node:fs'
import {parseArgs} from 'node:util'
import contract from '../game.contract.json' with {type:'json'}
import {Game,idle} from './game.js'

const args=parseArgs({options:{seed:{type:'string'},nights:{type:'string'},out:{type:'string'}}}).values
const seed=Number(args.seed),nights=Number(args.nights)
if(!Number.isSafeInteger(seed)||!Number.isInteger(nights)||nights<1||!args.out)throw new Error('Dùng --seed N --nights N --out soak.json')
function random(seed:number){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
function rss(){return Math.round(process.memoryUsage().rss/1048576)}
const started=Date.now(),results:string[]=[]
let memStart=0,memEnd=0
for(let i=0;i<nights;i++){
  const night=i%3+1,nightSeed=seed+i+1,rng=random(nightSeed)
  let result:string
  {
    const game=new Game(contract.tuning,nightSeed,{},night)
    if(i===0)memStart=rss()
    let direction:[number,number]=[0,0]
    const input=idle()
    while(game.state==='playing'||game.state==='paused'){
      if(game.tick%30===0){const a=rng()*Math.PI*2;direction=[Math.cos(a),Math.sin(a)]}
      input.move=direction
      input.jump=rng()<.05
      input.dash=rng()<.03
      input.pulse=rng()<.02
      input.interact=rng()<.1
      game.step(input)
    }
    result=game.state
  }
  results.push(result!)
  memEnd=rss()
}
const output={nights,crashes:0,results,mem_start_mb:memStart,mem_end_mb:memEnd,duration_s:Number(((Date.now()-started)/1000).toFixed(1))}
writeFileSync(args.out,JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify(output))
