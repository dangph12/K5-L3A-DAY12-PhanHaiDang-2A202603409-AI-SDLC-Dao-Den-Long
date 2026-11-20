import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'dao-den-long-test-'))
process.on('exit', () => rmSync(dir, {recursive:true, force:true}))
export const quiet = {random_motes:false, random_shades:false, random_drifters:false, wind_enabled:false}
const out = join(dir, 'out.jsonl')
export const snapshots = rows => rows.filter(r => r.type === 'snapshot')
export const events = (rows, name) => rows.filter(r => r.type === 'event' && r.name === name)
export const test = (name, fn) => { fn(); console.log('PASS ' + name) }
function invoke(night, scenario, frames, ticks, every) {
  const args = ['dist-cli/headless.js','--seed','7','--night',String(night),'--ticks',String(ticks),'--out',out]
  if (every !== undefined) args.push('--snapshot-every', String(every))
  for (const [key,value] of [['scenario',scenario],['inputs',frames === undefined ? undefined : {frames}]]) {
    if (value === undefined) continue
    const path = join(dir,key+'.json')
    writeFileSync(path,JSON.stringify(value))
    args.push('--'+key,path)
  }
  return spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000})
}
export function run(night, scenario, frames=[], ticks=1, every=1) {
  const r = invoke(night,scenario,frames,ticks,every)
  assert.equal(r.status,0,r.stderr || r.error?.message)
  return readFileSync(out,'utf8').trim().split('\n').map(line=>JSON.parse(line))
}
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  test('tick zero, night_start, snapshot interval, end',()=>{
    const rows=run(1,quiet,[],0)
    assert.equal(snapshots(rows).length,1)
    assert.equal(snapshots(rows)[0].tick,0)
    assert.deepEqual(events(rows,'night_start').map(e=>[e.tick,e.data.night]),[[0,1]])
    assert.deepEqual(rows.at(-1),{type:'end',ticks:0,state:'playing',score:0})
    const result=invoke(1,quiet,undefined,21,undefined)
    assert.equal(result.status,0,result.stderr)
    const defaults=readFileSync(out,'utf8').trim().split('\n').map(line=>JSON.parse(line))
    assert.deepEqual(snapshots(defaults).map(r=>r.tick),[0,10,20])
  })
  test('camera, diagonal normalization, retained move and jump edge',()=>{
    const s=snapshots(run(1,quiet,[{tick:0,move:[1,1],cam_yaw_deg:90,jump:true}],60,1))
    assert.deepEqual(s.at(-1).player.pos,[4.243,0,-4.243])
    assert.ok(s[1].player.pos[1]>0 && s.at(-1).player.grounded)
  })
  test('capacity, pickup height, deposit distance, nearest/ID tie and edge',()=>{
    const scenario={...quiet,player:{carried:9},motes:[[1,0,0],[0,0,0],[1.001,0,0],[0,1.501,0]],
      lanterns:[{id:'L1',pos:[2,0,0],deposited:9},{id:'L2',pos:[-2,0,0]}]}
    const rows=run(1,scenario,[{tick:0,interact:true},{tick:2,interact:false},{tick:3,interact:true}],4)
    assert.deepEqual(events(rows,'deposit').map(e=>[e.tick,e.data.lantern_id,e.data.amount]),[[1,'L1',1]])
    assert.equal(events(rows,'refuel').length,1)
    assert.equal(events(rows,'mote_picked').length,2)
    assert.equal(snapshots(rows).at(-1).motes_active,2)
    assert.equal(rows.at(-1).score,110)
    const partial=run(1,{...quiet,player:{carried:2},lanterns:[{id:'L1',pos:[0,0,0]}]},[{tick:0,interact:true}])
    assert.equal(events(partial,'deposit')[0].data.deposited,2)
    assert.equal(events(partial,'lantern_lit').length,0)
    const far=run(1,{...quiet,player:{carried:2},lanterns:[{id:'L1',pos:[2.001,0,0]}]},[{tick:0,interact:true}])
    assert.equal(events(far,'deposit').length,0)
  })
  test('3D pulse selection, cost, cooldown, progressive push and stun',()=>{
    const scenario={...quiet,player:{carried:6},shades:[{id:'A',pos:[5,.8,0]},{id:'B',pos:[0,5.801,0]}]}
    const rows=run(1,scenario,[{tick:0,pulse:true},{tick:1,pulse:false},{tick:2,pulse:true},
      {tick:179,pulse:false},{tick:180,pulse:true}],181)
    assert.deepEqual(events(rows,'pulse').map(e=>e.tick),[1,181])
    assert.deepEqual(events(rows,'pulse')[0].data.stunned_ids,['A'])
    const s=snapshots(rows)
    assert.equal(s[1].player.carried,3)
    assert.equal(s[1].shades[0].state,'stunned')
    assert.deepEqual(s[15].shades[0].pos,[9,.8,0])
    assert.equal(s[120].shades[0].state,'stunned')
    assert.notEqual(s[121].shades[0].state,'stunned')
    assert.equal(events(run(1,quiet,[{tick:0,pulse:true}]),'pulse').length,0)
  })
  test('recoil, invulnerability, dropped motes and lit safe zone',()=>{
    const scenario={...quiet,player:{carried:5,flames:2},shades:[{pos:[0,0,0]}]}
    const rows=run(1,scenario,[],150)
    assert.deepEqual(events(rows,'player_hit').map(e=>[e.tick,e.data.dropped]),[[1,2],[91,1]])
    assert.equal(events(rows,'game_over')[0].data.reason,'no_flames')
    const after=snapshots(rows)[1]
    assert.equal(after.shades[0].state,'recoil')
    assert.equal(after.motes.length,2)
    for(const m of after.motes){
      const r=Math.hypot(m.pos[0],m.pos[2])
      assert.ok(r>=1.499 && r<=2.501 && m.kind==='dropped' && m.ttl_s===8)
    }
    const safe=run(1,{...scenario,lanterns:[{id:'L1',pos:[0,0,0],lit:true}]},[],150)
    assert.equal(events(safe,'player_hit').length,0)
    assert.ok(snapshots(safe)[30].shades[0].pos[0]>=5.999)
  })
  test('setup without scoring and dawn threshold',()=>{
    const scenario={...quiet,time_left_s:1/60,lanterns:[{id:'L1',lit:true},{id:'L2',lit:true},{id:'L3',lit:true}]}
    const rows=run(1,scenario,[],1)
    assert.equal(snapshots(rows)[0].score,0)
    assert.deepEqual(events(rows,'game_over')[0].data,{result:'won',reason:'dawn_survived'})
    assert.equal(rows.at(-1).score,597)
    const dawn=run(1,{...quiet,time_left_s:.05},[],60)
    assert.equal(events(dawn,'game_over')[0].data.reason,'dawn')
    assert.equal(dawn.at(-1).ticks,3)
  })
  test('deterministic bytes and stable generated IDs',()=>{
    const scenario={lanterns:[{id:'L1',lit:true,pos:[0,0,0]}],time_left_s:30}
    run(1,scenario,[],1210,100)
    const a=readFileSync(out)
    const rows=run(1,scenario,[],1210,100)
    assert.ok(readFileSync(out).equals(a))
    assert.deepEqual(events(rows,'shade_spawned').map(e=>[e.tick,e.data.id]),[[300,'S1'],[300,'S2'],[780,'S3']])
  })
  test('invalid scenario, inputs and CLI return errors',()=>{
    for(const [s,f] of [[{motes:[1]},[]],[quiet,[{tick:0},{tick:0}]],[quiet,[{tick:2},{tick:1}]],
      [quiet,[{tick:0,jump:1}]],[quiet,[{tick:0,pause:'false'}]],[{random_drifters:2},[]],
      [{player:{dash_cd_ticks:-1}},[]],[{shades:[{pos:[0,0,0],state:'asleep'}]},[]]]){
      const r=invoke(1,s,f,2,1)
      assert.equal(r.status,2,r.stderr); assert.ok(r.stderr.trim())
    }
    assert.notEqual(invoke(4,quiet,[],1,1).status,0)
  })
}
