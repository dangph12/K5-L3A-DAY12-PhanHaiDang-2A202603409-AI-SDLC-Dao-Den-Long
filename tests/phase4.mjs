import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {decodeLeaderboard,rank,submitEntry,validEntry,validName} from '../dist-cli/leaderboard.js'
import {Game,idle} from '../dist-cli/game.js'
import contract from '../game.contract.json' with {type:'json'}

function test(name,fn){try{fn();console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}
test('contract 1.3 publishes benchmark and soak commands without changing the game tuning schema',()=>{
  assert.equal(contract.contract_version,'1.3')
  assert.match(contract.bench_cmd,/bench-runner/)
  assert.match(contract.soak_cmd,/soak/)
  assert.equal(contract.tuning.night1_duration_s,240)
})
function entry(name,score,achieved_at,seed=1){return {name,score,nights_won:2,achieved_at,seed}}
test('leaderboard name, timestamp and numeric validation',()=>{
  assert.equal(validName('May_2042'),true);assert.equal(validName('ab'),false);assert.equal(validName('invalid-name'),false)
  assert.equal(validEntry(entry('Lantern',100,'2026-11-20T09:00:00Z')),true)
  assert.equal(validEntry(entry('Lantern',100,'2026-11-20T09:00:00')),false)
})
test('leaderboard score ordering, stable tie order and top ten cap',()=>{
  const earlier=entry('First',50,'2026-11-20T09:00:00Z'),later=entry('Second',50,'2026-11-20T11:00:00+01:00')
  assert.equal(rank([later,earlier])[0].name,'First')
  const values=Array.from({length:12},(_,i)=>entry('User'+String(i).padStart(2,'0'),i,'2026-11-20T09:00:00Z'))
  assert.deepEqual(rank(values).map(e=>e.score),[11,10,9,8,7,6,5,4,3,2])
  assert.equal(decodeLeaderboard({entries:[...values,{}]}).length,10)
  assert.equal(submitEntry([],earlier)[0].name,'First')
})
test('benchmark simulation holds player and lantern fuel while shades wander',()=>{
  const g=new Game(contract.tuning,42,{bench_mode:true,random_shades:false,random_motes:false,player:{pos:[0,0,0]},time_left_s:0,lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:100}],shades:[{id:'S1',pos:[10,0,0],state:'wander'}],motes:[[2,0,0]]},1)
  for(let i=0;i<120;i++)g.step(idle())
  assert.equal(g.state,'playing');assert.deepEqual(g.player.pos,[0,0,0]);assert.equal(g.lanterns[0].fuelUnits,6000)
  assert.equal(g.shades.length,1);assert.equal(g.motes.length,1);assert.equal(g.shades[0].state,'wander')
})

const tmp=mkdtempSync(path.join(os.tmpdir(),'dao-den-phase4-test-'))
const tmpRoot=path.resolve(os.tmpdir())+path.sep
try{
  const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve))
  const dataFile=path.join(tmp,'scores.json'),outFile=path.join(tmp,'out.json')
  const startServer=()=>spawn(process.execPath,['dist-server/server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),LEADERBOARD_PATH:dataFile},stdio:'ignore'})
  let server=startServer()
  const base='http://127.0.0.1:'+port
  try{
    let response
    for(let i=0;i<100;i++){try{response=await fetch(base+'/api/leaderboard');if(response.ok)break}catch{};await new Promise(r=>setTimeout(r,50))}
    assert.equal(response?.status,200)
    const saved=entry('May',320,'2026-11-20T09:00:00Z',42)
    response=await fetch(base+'/api/leaderboard',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entry:saved})})
    assert.equal(response.status,200)
    assert.deepEqual((await response.json()).entries,[saved])
    assert.deepEqual(JSON.parse(readFileSync(dataFile,'utf8')).entries,[saved])
    server.kill();await new Promise(resolve=>server.once('exit',resolve))
    server=startServer()
    response=undefined
    for(let i=0;i<100;i++){try{response=await fetch(base+'/api/leaderboard');if(response.ok)break}catch{};await new Promise(r=>setTimeout(r,50))}
    assert.deepEqual((await response.json()).entries,[saved])
    const exported=spawn(process.execPath,['dist-server/server.js','--export-leaderboard',outFile],{env:{...process.env,LEADERBOARD_PATH:dataFile},stdio:'ignore'})
    await new Promise((resolve,reject)=>{exported.once('error',reject);exported.once('exit',code=>code===0?resolve():reject(new Error('Leaderboard export failed: '+code)))})
    assert.deepEqual(JSON.parse(readFileSync(outFile,'utf8')),{entries:[saved]})
    console.log('PASS leaderboard persistence across restart and CLI export')
  }finally{server.kill();await new Promise(resolve=>server.once('exit',resolve))}
}finally{
  if(!path.resolve(tmp).startsWith(tmpRoot))throw new Error('Test temp path escaped temp root')
  rmSync(tmp,{recursive:true,force:true})
}
