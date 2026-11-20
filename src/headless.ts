import {readFileSync,openSync,writeSync,closeSync} from 'node:fs'
import {parseArgs} from 'node:util'
import {Game,idle,type Scenario,type Input} from './game.js'

type Dict=Record<string,unknown>
function check(ok:unknown,message:string):asserts ok {
  if(!ok) throw new Error(message)
}
const dict=(x:unknown):x is Dict=>x!==null && typeof x==='object' && !Array.isArray(x)
const num=(x:unknown):x is number=>typeof x==='number' && Number.isFinite(x)
const nat=(x:unknown):x is number=>num(x) && Number.isSafeInteger(x) && x>=0
const pos=(x:unknown)=>Array.isArray(x) && x.length===3 && x.every(num)
function optional(obj:Dict,key:string,test:(x:unknown)=>boolean){
  if(key in obj) check(test(obj[key]),'Giá trị sai: '+key)
}
function scenario(x:unknown):Scenario {
  check(dict(x),'Scenario phải là object')
  for(const key of ['random_motes','random_shades']) optional(x,key,v=>typeof v==='boolean')
  optional(x,'time_left_s',v=>num(v) && v>=0)
  if('player' in x){
    check(dict(x.player),'player không hợp lệ')
    optional(x.player,'pos',pos)
    for(const key of ['flames','carried']) optional(x.player,key,nat)
  }
  optional(x,'motes',v=>Array.isArray(v) && v.every(pos))
  for(const key of ['shades','lanterns']){
    if(!(key in x)) continue
    const list=x[key]
    check(Array.isArray(list),key+' phải là mảng')
    const ids=new Set<string>()
    for(const item of list){
      check(dict(item),key+' sai định dạng')
      if(key==='shades') check(pos(item.pos),'shade.pos sai định dạng')
      else {
        check(typeof item.id==='string' && /^L[1-5]$/.test(item.id),'ID đèn sai')
        optional(item,'pos',pos)
        optional(item,'lit',v=>typeof v==='boolean')
        optional(item,'deposited',nat)
      }
      if('id' in item){
        check(typeof item.id==='string' && item.id.length && !ids.has(item.id),'ID thiếu hoặc trùng')
        ids.add(item.id)
      }
    }
  }
  return x as Scenario
}
type Frame=Partial<Input> & {tick:number}
function inputs(x:unknown):Frame[]{
  check(dict(x) && Array.isArray(x.frames),'Thiếu frames')
  let previous=-1
  for(const frame of x.frames){
    check(dict(frame) && nat(frame.tick) && frame.tick>previous,'tick phải tăng nghiêm ngặt')
    previous=frame.tick
    optional(frame,'move',v=>Array.isArray(v) && v.length===2 && v.every(n=>num(n) && Math.abs(n)<=1))
    optional(frame,'cam_yaw_deg',num)
    for(const key of ['jump','interact','pulse','dash']) optional(frame,key,v=>typeof v==='boolean')
  }
  return x.frames as Frame[]
}
function load<T>(file:string,validate:(value:unknown)=>T){
  try{return validate(JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,'')))}
  catch(e){process.exitCode=2;throw e}
}
function main(){
  const keys=['seed','night','ticks','out','scenario','inputs','snapshot-every']
  const args=parseArgs({options:Object.fromEntries(keys.map(k=>[k,{type:'string' as const}]))}).values as Record<string,string>
  function integer(key:string){
    check(/^-?\d+$/.test(args[key]) && Number.isSafeInteger(Number(args[key])),'Tham số sai: '+key)
    return Number(args[key])
  }
  const ticks=integer('ticks'),seed=integer('seed'),every=args['snapshot-every']===undefined?10:integer('snapshot-every')
  check(integer('night')===1 && ticks>=0 && every>0 && args.out,'Cần --night 1 --ticks N --out file')
  const s=args.scenario?load(args.scenario,scenario):{}
  const frames=args.inputs?load(args.inputs,inputs):[]
  const contract=JSON.parse(readFileSync(new URL('../game.contract.json',import.meta.url),'utf8'))
  const game=new Game(contract.tuning,seed,s)
  const file=openSync(args.out,'w')
  const write=(o:object)=>writeSync(file,JSON.stringify(o)+'\n')
  try{
    write(game.snapshot())
    let i=0
    const input=idle()
    while(game.tick<ticks && game.state==='playing'){
      if(frames[i]?.tick===game.tick) Object.assign(input,frames[i++])
      game.step(input)
      for(const event of game.events) write(event)
      if(game.tick%every===0) write(game.snapshot())
    }
    write({type:'end',ticks:game.tick,state:game.state,score:game.score})
  } finally {closeSync(file)}
}
try{main()}catch(error){console.error((error as Error).message);process.exitCode??=1}
