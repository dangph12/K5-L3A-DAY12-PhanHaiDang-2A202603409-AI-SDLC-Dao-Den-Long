import assert from 'node:assert/strict'
import {test,run,quiet,snapshots,events} from './contract.mjs'

const last=rows=>snapshots(rows).at(-1)
const near=(actual,expected,tolerance=.002)=>assert.ok(Math.abs(actual-expected)<=tolerance,
  'expected '+actual+' within '+tolerance+' of '+expected)
const magnitudeXZ=pos=>Math.hypot(pos[0],pos[2])

test('three maps, initial contract and spawn schedules',()=>{
  for(const night of [1,2,3]){
    const rows=run(night,{wind_enabled:false,lanterns:[{id:'L1',pos:night===3?[0,0,-26]:[0,0,0],lit:true}]},[],1200,240)
    const start=snapshots(rows)[0]
    assert.equal(start.night,night)
    assert.equal(start.time_left_s,[300,330,360][night-1])
    assert.equal(start.lanterns.length,night+4)
    assert.equal(start.charms.length,night-1)
    assert.equal(start.motes.length,20)
    assert.equal(new Set(start.motes.map(m=>JSON.stringify(m.pos))).size,20)
    assert.ok(start.motes.every(m=>m.kind==='random' && 'ttl_s' in m))
    assert.equal(start.shades.length,0)
    assert.equal(snapshots(rows)[1].motes.length,21)
    const schedule=events(rows,'shade_spawned').map(e=>[e.tick,e.data.id])
    const interval=[480,420,360][night-1]
    assert.deepEqual(schedule.slice(0,3),[[300,'S1'],[300,'S2'],[300+interval,'S3']])
    assert.deepEqual(last(rows).drifters.map(d=>[d.id,d.state]),night===1?[]:[['D1','idle']])
  }
})
test('dash at rest and midair, facing, 12 ticks and cooldown',()=>{
  const rows=run(1,quiet,[{tick:0,dash:true},{tick:2,dash:false},{tick:12,dash:true},
    {tick:89,dash:false},{tick:90,dash:true}],91)
  assert.deepEqual(events(rows,'dash').map(e=>e.tick),[1,91])
  assert.deepEqual(snapshots(rows)[12].player.pos,[0,0,2.8])
  assert.equal(snapshots(rows)[13].player.vel[2],0)
  const air=snapshots(run(1,quiet,[{tick:0,move:[-1,0],jump:true},{tick:2,move:[0,0],dash:true}],15))
  assert.equal(air[2].player.pos[1],air[14].player.pos[1])
  assert.ok(air[14].player.pos[0]<-2.9 && !air[14].player.grounded)
  assert.notEqual(air[15].player.pos[1],air[14].player.pos[1])
  const hit=run(1,{...quiet,shades:[{pos:[0,0,0]}]},[{tick:0,dash:true}])
  assert.equal(events(hit,'player_hit').length,1)
})
test('pause freezes gameplay, timers, spawn and wind while tick advances',()=>{
  const rows=run(2,{...quiet,random_motes:true,player:{charm_ticks:600}},
    [{tick:239,dash:true},{tick:240,pause:true},{tick:251,pause:false},{tick:260,pause:true}],261)
  const s=snapshots(rows)
  assert.deepEqual(events(rows,'paused').map(e=>e.tick),[241])
  assert.deepEqual(events(rows,'resumed').map(e=>e.tick),[261])
  assert.equal(s[260].state,'paused')
  for(const k of ['sim_tick','time_left_s','player','motes','shades','wind','charms']) assert.deepEqual(s[260][k],s[240][k])
  assert.equal(s[261].sim_tick,241)
  assert.equal(s[261].state,'playing')
})
test('fall bypasses invulnerability, charges once, respawns after 60 ticks',()=>{
  const player={pos:[43,-11,0],carried:8,flames:2,invuln_ticks:110}
  const rows=run(1,{...quiet,player,motes:[[43,-11,0]],shades:[{pos:[43,-11,0]}]},[],61)
  const hits=events(rows,'player_hit')
  assert.equal(hits.length,1)
  assert.deepEqual([hits[0].tick,hits[0].data.by,hits[0].data.lost],[1,'fall',8])
  assert.equal(snapshots(rows)[60].player.flames,1)
  assert.equal(events(rows,'mote_picked').length,0)
  assert.deepEqual(last(rows).player.pos,[0,0,0])
  assert.deepEqual(last(rows).player.vel,[0,0,0])
  assert.equal(last(rows).player.invuln,true)
  const dead=run(1,{...quiet,player:{...player,flames:1}},[],61)
  assert.equal(dead.at(-1).ticks,1)
  assert.equal(events(dead,'game_over')[0].data.reason,'no_flames')
})
test('bridge, both bamboo launch trajectories and terrace route',()=>{
  const bridge=run(2,{...quiet,charms:[],player:{pos:[26,0,0]}},[{tick:0,move:[1,0]}],180,180)
  assert.deepEqual(last(bridge).player.pos,[44,0,0])
  for(const [start,target] of [[[20,0,18],70],[[50,0,-18],0]]){
    const rows=run(2,{...quiet,player:{pos:start}},[{tick:2,move:[0,1]},{tick:70,move:[0,0]}],100)
    assert.ok(snapshots(rows)[40].player.pos[1]>4)
    const end=last(rows).player
    assert.ok(end.grounded && Math.hypot(end.pos[0]-target,end.pos[2])<=28)
  }
  for(const deg of [30,150]){
    const angle=deg*Math.PI/180, dx=Math.cos(angle), dz=Math.sin(angle)
    const ramp=run(3,{...quiet,player:{pos:[30*dx,0,30*dz]}},[{tick:0,move:[-dx,-dz]}],70)
    assert.equal(last(ramp).player.pos[1],3)
    assert.ok(last(ramp).player.grounded)
  }
  const wall=run(3,{...quiet,player:{pos:[0,0,25]}},[{tick:0,move:[0,-1]}],40)
  assert.ok(last(wall).player.pos[2]>=24 && last(wall).player.pos[1]===0)
  const top=run(3,{...quiet,player:{pos:[0,3,13]}},[],90)
  assert.equal(last(top).player.pos[1],6)
  assert.ok(last(top).player.grounded && Math.hypot(last(top).player.pos[0],last(top).player.pos[2])<=8)
  const tower=run(3,{...quiet,player:{pos:[0,6,6]}},[{tick:0,move:[0,-1]}],80)
  assert.ok(last(tower).player.pos[2]>=1.999)
})
test('charm pickup, repeated dash edges, expiry, respawn and replacement',()=>{
  const rows=run(2,{...quiet,player:{pos:[35,0,0]}},[{tick:1,move:[1,0],dash:true},{tick:3,dash:false},
    {tick:4,dash:true},{tick:5,dash:false},{tick:13,dash:true},{tick:30,move:[0,0]}],2701,1)
  const s=snapshots(rows)
  assert.deepEqual(events(rows,'charm_picked')[0].data,{charm_id:'C1',charm_ticks:600})
  assert.deepEqual(events(rows,'dash').map(e=>e.tick),[2,14])
  near(s[26].player.vel[0],7.2)
  assert.equal(s[600].player.charm_s,1/60)
  assert.equal(s[601].player.charm_s,0)
  assert.deepEqual(s[2701].charms,[{id:'C1',available:true,respawn_s:0}])
  assert.deepEqual(last(run(2,{...quiet,charms:[]},[],1)).charms,[])
})
test('drifter chase, steal before hit, invulnerability and pulse recovery',()=>{
  const scenario={...quiet,player:{carried:8},drifters:[{id:'D1',pos:[0,.8,0]}],shades:[{pos:[0,.8,0]}]}
  const rows=run(2,scenario,[],1)
  const contact=rows.filter(e=>e.name==='drifter_steal'||e.name==='player_hit')
  assert.deepEqual(contact.map(e=>e.name),['drifter_steal','player_hit'])
  assert.deepEqual(contact[0].data,{drifter_id:'D1',amount:3,carried:5})
  assert.equal(contact[1].data.dropped,2)
  const protectedRows=run(2,{...scenario,player:{carried:8,invuln_ticks:90},lanterns:[{id:'L1',lit:true,pos:[0,0,0]}]},[],2)
  assert.equal(events(protectedRows,'drifter_steal').length,1)
  assert.equal(events(protectedRows,'player_hit').length,0)
  const fleeing=run(2,{...quiet,player:{carried:4},drifters:[{id:'D1',state:'flee',stolen:3,pos:[4,.8,0]}]},
    [{tick:0,pulse:true}],481)
  assert.deepEqual(events(fleeing,'drifter_drop')[0].data,{drifter_id:'D1',amount:3})
  assert.equal(snapshots(fleeing)[1].motes.filter(m=>m.kind==='dropped').length,3)
  assert.equal(snapshots(fleeing)[121].drifters.length,0)
  assert.equal(snapshots(fleeing)[480].motes.length,3)
  assert.equal(snapshots(fleeing)[481].motes.length,0)
  const retreat=run(2,{...quiet,player:{carried:8},drifters:[{id:'D1',state:'chase',pos:[0,.8,0]}]},[{tick:0,pulse:true}],240)
  assert.equal(events(retreat,'drifter_steal').length,0)
  assert.equal(last(retreat).drifters[0].state,'flee')
})
test('night three wind acts for 300 ticks and can be disabled',()=>{
  const scenario={...quiet,wind_enabled:true,player:{pos:[0,0,-26]}}
  const s=snapshots(run(3,scenario,[],2100))
  assert.equal(s[1799].wind.active,false)
  assert.equal(s[1800].wind.active,true)
  assert.equal(s[2099].wind.active,true)
  assert.equal(s[2100].wind.active,false)
  const delta=[s[2099].player.pos[0],0,s[2099].player.pos[2]+26]
  near(magnitudeXZ(delta),10)
  assert.deepEqual(last(run(3,{...scenario,wind_enabled:false},[],2100,2100)).player.pos,[0,0,-26])
})
test('terminal precedence on last tick',()=>{
  const lit=Array.from({length:5},(_,i)=>({id:'L'+(i+1),lit:true}))
  const scenario={...quiet,lanterns:lit,time_left_s:1/60}
  assert.equal(events(run(1,scenario),'game_over')[0].data.reason,'all_lit')
  assert.equal(events(run(1,{...scenario,player:{pos:[42,-11,0],flames:1}}),'game_over')[0].data.reason,'no_flames')
})
test('full night three, 21600 ticks in at most 30 s',()=>{
  const start=performance.now()
  const rows=run(3,{wind_enabled:false,lanterns:[{id:'L1',lit:true,pos:[0,0,-26]}]},[],21600,10)
  const elapsed=performance.now()-start
  assert.equal(rows.at(-1).ticks,21600)
  assert.equal(events(rows,'game_over')[0].data.reason,'dawn')
  assert.ok(elapsed<=30000,'elapsed '+elapsed+' ms')
  console.log('BENCH Night 3 '+elapsed.toFixed(0)+' ms including CLI and JSONL read')
})

