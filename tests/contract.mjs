import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const dir=mkdtempSync(join(tmpdir(),'dao-ben-'))
const quiet={random_motes:false,random_shades:false}
const out=join(dir,'out.jsonl')
function invoke(s,frames=[],ticks=1,every=1){
  const args=['dist-cli/headless.js','--seed','7','--night','1','--ticks',String(ticks),'--snapshot-every',String(every),'--out',out]
  for(const [key,value] of [['scenario',s],['inputs',{frames}]]){
    if(value===undefined) continue
    const path=join(dir,key+'.json')
    writeFileSync(path,JSON.stringify(value))
    args.push('--'+key,path)
  }
  return spawnSync(process.execPath,args,{encoding:'utf8'})
}
function run(...args){
  const r=invoke(...args)
  assert.equal(r.status,0,r.stderr)
  return readFileSync(out,'utf8').trim().split('\n').map(line=>JSON.parse(line))
}
const snaps=rows=>rows.filter(r=>r.type==='snapshot')
const events=(rows,name)=>rows.filter(r=>r.name===name)
function test(name,fn){fn();console.log('PASS '+name)}
test('tick zero, interval, end',()=>{
  const rows=run(quiet,[],0)
  assert.deepEqual(rows.map(r=>r.type),['snapshot','end'])
  assert.equal(rows[1].ticks,0)
  assert.deepEqual(snaps(run(quiet,[],21,10)).map(r=>r.tick),[0,10,20])
})
test('camera, diagonal normalization, retained move, jump edge',()=>{
  const rows=snaps(run(quiet,[{tick:0,move:[1,1],cam_yaw_deg:90,jump:true}],60,60))
  assert.deepEqual(rows[1].player.pos,[4.243,0,-4.243])
  assert.ok(snaps(run(quiet,[{tick:0,jump:true}],1))[1].player.pos[1]>0)
})
test('pickup, partial deposit, boundaries, held interact',()=>{
  const rows=run({...quiet,player:{carried:7},motes:[[1.2,12,0],[0,0,0],[1.201,0,0]],
    lanterns:[{id:'L1',pos:[2,0,0],deposited:4},{id:'L2',pos:[0,0,0]}]},
    [{tick:0,interact:true},{tick:2,interact:false},{tick:3,interact:true}],4)
  assert.deepEqual(events(rows,'deposit').map(e=>e.data.amount),[5,1])
  assert.equal(events(rows,'mote_picked').length,2)
  assert.equal(snaps(rows).at(-1).motes_active,1)
  const partial=run({...quiet,player:{carried:2},lanterns:[{id:'L1',pos:[0,0,0]}]},[{tick:0,interact:true}])
  assert.equal(events(partial,'deposit')[0].data.deposited,2)
  assert.equal(events(partial,'lantern_lit').length,0)
  const far=run({...quiet,player:{carried:2},lanterns:[{id:'L1',pos:[2.001,0,0]}]},[{tick:0,interact:true}])
  assert.equal(events(far,'deposit').length,0)
})
test('pulse radius, cost, cooldown, push and stun',()=>{
  const outside=run({...quiet,player:{carried:2},shades:[{id:'B',pos:[5.001,0,0]}]},[{tick:0,pulse:true}])
  assert.deepEqual(events(outside,'pulse')[0].data.stunned_ids,[])
  const rows=run({...quiet,player:{carried:4},shades:[{id:'A',pos:[5,0,0]}]},
    [{tick:0,pulse:true},{tick:1,pulse:false},{tick:2,pulse:true},{tick:119,pulse:false},{tick:120,pulse:true}],121)
  assert.deepEqual(events(rows,'pulse').map(e=>e.tick),[1,121])
  assert.deepEqual(events(rows,'pulse')[0].data.stunned_ids,['A'])
  const first=snaps(rows)[1]
  assert.equal(first.player.carried,2)
  assert.deepEqual(first.shades[0],{id:'A',pos:[8,0,0],state:'stunned'})
  assert.equal(events(run(quiet,[{tick:0,pulse:true}]),'pulse').length,0)
})
test('safe zone, hit loss, invulnerability and no_flames',()=>{
  const s={...quiet,player:{carried:5,flames:2},shades:[{pos:[0,0,0]}]}
  const rows=run(s,[],150)
  assert.deepEqual(events(rows,'player_hit').map(e=>[e.tick,e.data.dropped]),[[1,2],[91,1]])
  assert.equal(events(rows,'game_over')[0].data.reason,'no_flames')
  const safe=run({...s,lanterns:[{id:'L1',pos:[0,0,0],lit:true}]},[],150)
  assert.equal(events(safe,'player_hit').length,0)
  assert.ok(snaps(safe).at(-1).shades[0].pos[0]>=4)
})
test('win, scoring, setup without events, dawn',()=>{
  const s=JSON.parse(readFileSync('tests/win.json'))
  const input=JSON.parse(readFileSync('tests/interact.json'))
  const rows=run(s,input.frames,60)
  assert.equal(rows[0].score,0)
  assert.deepEqual(rows.at(-1),{type:'end',ticks:1,state:'won',score:484})
  assert.deepEqual(events(rows,'game_over')[0].data,{result:'won',reason:'all_lit'})
  const dawn=run({...quiet,time_left_s:.05},[],60)
  assert.equal(events(dawn,'game_over')[0].data.reason,'dawn')
  assert.equal(dawn.at(-1).ticks,3)
})
test('deterministic bytes, default seed and generated IDs',()=>{
  const s={lanterns:[{id:'L1',lit:true,pos:[0,0,0]}]}
  run(s,[],1210,100)
  const a=readFileSync(out)
  const rows=run(s,[],1210,100)
  assert.ok(readFileSync(out).equals(a))
  assert.deepEqual(events(rows,'shade_spawned')[0].data,{id:'S3'})
})
test('invalid scenario and inputs exit 2 with stderr',()=>{
  for(const [s,f] of [[{motes:[1]},[]],[quiet,[{tick:0},{tick:0}]],[quiet,[{tick:2},{tick:1}]],[quiet,[{tick:0,jump:1}]]]){
    const r=invoke(s,f)
    assert.equal(r.status,2)
    assert.ok(r.stderr.trim())
  }
})
