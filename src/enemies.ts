import type { Game, Pos } from './game.js'

export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain'
export type DrifterState = 'idle' | 'chase' | 'flee'
export interface ShadeSpec { id?: string; pos: Pos; state?: ShadeState; state_ticks_left?: number; target_lantern_id?: string }
export interface DrifterSpec { id?: string; pos: Pos; state?: DrifterState; stolen?: number; state_ticks_left?: number }
type Direction = [number, number]
interface Shade {
  id: string; pos: Pos; state: ShadeState; ticks: number
  direction: Direction; pushLeft: number; ejecting: boolean; heading: number
  target_lantern_id?:string
}
interface Drifter {
  id: string; pos: Pos; state: DrifterState; stolen: number; ticks: number; heading: number
}

const horizontal = (a: Pos, b: Pos) => Math.hypot(a[0] - b[0], a[2] - b[2])
function away(pos: Pos, source: Pos): Direction {
  const d = horizontal(pos, source)
  return d > 0 ? [(pos[0] - source[0]) / d, (pos[2] - source[2]) / d] : [1, 0]
}
const inIdOrder = (a: {id: string}, b: {id: string}) =>
  a.id.localeCompare(b.id, 'en', { numeric: true })

export class Enemies {
  readonly shades: Shade[] = []
  drifters: Drifter[] = []
  private readonly game: Game
  private nextShade = 1
  private nextDrifter = 1
  private reserved = new Set<string>()

  constructor(game: Game) {
    this.game = game
    for (const entity of [...game.scenario.shades ?? [], ...game.scenario.drifters ?? []]) {
      if (entity.id) this.reserved.add(entity.id)
    }
    for (const s of game.scenario.shades ?? []) this.addShade(s)
    for (const d of game.scenario.drifters ?? []) this.addDrifter(d)
  }
  private id(prefix: 'S'|'D') {
    let id: string
    do {
      id = prefix + (prefix === 'S' ? this.nextShade++ : this.nextDrifter++)
    } while (this.reserved.has(id))
    this.reserved.add(id)
    return id
  }
  private addShade(spec: ShadeSpec) {
    const state = spec.state ?? 'wander'
    const defaults = { spawning: 1, wander: 0, chase: 0, recoil: 60, stunned: 120, drain: 0 }
    const shade: Shade = {
      id: spec.id ?? this.id('S'), pos: [...spec.pos], state,
      ticks: spec.state_ticks_left ?? defaults[state], heading: this.game.random() * 2 * Math.PI,
      direction: away(spec.pos, this.game.player.pos), pushLeft: 0, ejecting: false,target_lantern_id:spec.target_lantern_id
    }
    this.shades.push(shade)
    this.shades.sort(inIdOrder)
    return shade
  }
  private addDrifter(spec: DrifterSpec) {
    this.drifters.push({
      id: spec.id ?? this.id('D'), pos: [...spec.pos], state: spec.state ?? 'idle',
      stolen: spec.stolen ?? 0, ticks: spec.state_ticks_left ?? (spec.state === 'flee' ? 240 : 0),
      heading: this.game.random() * 2 * Math.PI
    })
    this.drifters.sort(inIdOrder)
  }
  timers() {
    for (const s of this.shades) {
      if (s.state === 'wander' || s.state === 'chase' || s.state === 'drain') continue
      if (--s.ticks <= 0) {
        s.state = 'wander'
        s.pushLeft = 0
      }
    }
    this.drifters = this.drifters.filter(d => d.state !== 'flee' || --d.ticks > 0)
  }
  drainFuel(){
    const g=this.game
    for(const s of this.shades){
      if(s.state!=='drain')continue
      const l=g.lanterns.find(l=>l.id===s.target_lantern_id)
      if(!l?.lit || l.fuelUnits/60>=g.t.low_fuel_threshold || horizontal(s.pos,l.pos)>2){s.state='wander';continue}
      l.fuelUnits=Math.max(0,l.fuelUnits-g.t.drain_per_s)
      if(g.sim_tick%60===0)g.emit('fuel_drain',{lantern_id:l.id,shade_id:s.id,fuel:Number((l.fuelUnits/60).toFixed(1))})
      if(l.fuelUnits===0){l.lit=false;l.deposited=0;g.emit('lantern_out',{lantern_id:l.id});s.state='wander'}
    }
  }
  safe() {
    const g = this.game
    for (const s of this.shades) {
      s.ejecting = false
      for (const l of g.lanterns) {
        if (!l.lit || l.fuelUnits/60<g.t.low_fuel_threshold) continue
        const d = horizontal(s.pos, l.pos)
        if (d >= g.t.safe_radius - 1e-9) continue
        if(s.state==='drain')s.state='wander'
        const dir = away(s.pos, l.pos)
        const step = Math.min(g.t.safe_radius / 30, g.t.safe_radius - d)
        this.translate(s, dir, step, false)
        s.ejecting = true
      }
    }
  }
  pulse() {
    const g = this.game
    const [x, y, z] = g.player.pos
    const reaches = (p: Pos) => Math.hypot(p[0] - x, p[1] - (y + 0.8), p[2] - z) <= g.t.pulse_radius
    const ids: string[] = []
    let pulsePoints=0
    for (const s of this.shades) {
      if (!reaches(s.pos)) continue
      pulsePoints+=s.state==='drain'?15:g.t.score.per_stun
      s.state = 'stunned'
      s.ticks = Math.round(60 * g.t.pulse_stun_s)
      s.pushLeft = 15
      s.direction = away(s.pos, g.player.pos)
      ids.push(s.id)
    }
    g.score += pulsePoints
    g.emit('pulse', {stunned_ids: ids})
    for (const d of this.drifters) {
      if (!reaches(d.pos)) continue
      if (d.state === 'chase') {
        d.state = 'flee'
        d.ticks = 240
      } else if (d.state === 'flee' && d.stolen > 0) {
        g.drop(d.pos, d.stolen, false)
        g.emit('drifter_drop', {drifter_id: d.id, amount: d.stolen})
        d.stolen = 0
        d.ticks = 120
      }
    }
  }
  // Clip a shade's step against walkable terrain, tower and sanctuary boundaries.
  // The final fraction also places an approaching shade exactly on the boundary.
  private translate(s: Shade, dir: Direction, step: number, checkZones = true) {
    if (step <= 0) return
    const g = this.game, [x, y, z] = s.pos
    const ground = g.map.ground(x, z)
    const allowed = (fraction: number) => {
      const nx = x + dir[0] * step * fraction, nz = z + dir[1] * step * fraction
      const height = g.map.ground(nx, nz)
      if (!Number.isFinite(height) || height > Math.max(ground, y) + step + 0.001) return false
      if (g.night === 3 && Math.hypot(nx, nz) < 2 && y < 14) return false
      if (checkZones) {
        for (const l of g.lanterns) {
          if (!l.lit || l.fuelUnits/60<g.t.low_fuel_threshold) continue
          const limit = Math.min(g.t.safe_radius, horizontal(s.pos, l.pos))
          if (Math.hypot(nx - l.pos[0], nz - l.pos[2]) < limit - 1e-10) return false
        }
      }
      return true
    }
    let fraction = 1
    if (!allowed(1)) {
      let lo = 0, hi = 1
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2
        if (allowed(mid)) lo = mid
        else hi = mid
      }
      fraction = lo
    }
    s.pos[0] += dir[0] * step * fraction
    s.pos[2] += dir[1] * step * fraction
    if (Number.isFinite(ground)) s.pos[1] += g.map.ground(s.pos[0], s.pos[2]) - ground
  }
  move() {
    const g = this.game, p = g.player.pos
    for (const s of this.shades) {
      if(g.scenario.bench_mode){
        s.state='wander';s.heading+=.016
        this.translate(s,[Math.cos(s.heading),Math.sin(s.heading)],g.t.shade_speed/60,false)
        continue
      }
      if (s.ejecting || s.state === 'spawning') continue
      if (s.state === 'stunned') {
        if (s.pushLeft > 0) {
          this.translate(s, s.direction, g.t.pulse_push_m / 15)
          s.pushLeft--
        }
        continue
      }
      if (s.state === 'recoil') {
        this.translate(s, s.direction, 2 / 60)
        continue
      }
      if(s.state==='drain'){
        const l=g.lanterns.find(l=>l.id===s.target_lantern_id)
        if(horizontal(s.pos,p)<=6){s.state='chase'}
        else if(l?.lit && l.fuelUnits/60<g.t.low_fuel_threshold && horizontal(s.pos,l.pos)<=2)continue
        else s.state='wander'
      }
      const d = horizontal(s.pos, p)
      if (!g.respawn && (d <= 12 || (s.state === 'chase' && d <= 18))) {
        s.state = 'chase'
        this.translate(s, away(p, s.pos), Math.min(d, (g.night === 3 ? 4.5 : g.t.shade_speed) / 60))
      } else {
        s.state = 'wander'
        const targets=g.lanterns.filter(l=>l.lit && l.fuelUnits/60<g.t.low_fuel_threshold)
        const pool=targets.length?targets:g.lanterns.filter(l=>!l.lit)
        const target=pool.sort((a,b)=>horizontal(a.pos,s.pos)-horizontal(b.pos,s.pos)||a.id.localeCompare(b.id))[0]
        if(target){
          s.target_lantern_id=target.id
          if(target.lit && horizontal(s.pos,target.pos)<=2){s.state='drain';continue}
          this.translate(s,away(target.pos,s.pos),(g.night===3?4.5:g.t.shade_speed)/60)
        }else{
          s.heading += 0.016
          this.translate(s,[Math.cos(s.heading),Math.sin(s.heading)],(g.night===3?4.5:g.t.shade_speed)/60)
        }
      }
    }
    for (const d of this.drifters) {
      const distance = horizontal(d.pos, p)
      if (d.state !== 'flee') {
        d.state = !g.respawn && g.player.carried >= 5 && distance <= 15 ? 'chase' : 'idle'
      }
      let dir: Direction, step: number
      if (d.state === 'idle') {
        d.heading += 0.025
        dir = [Math.cos(d.heading), Math.sin(d.heading)]
        step = 2 / 60
      } else if (d.state === 'chase') {
        dir = away(p, d.pos)
        step = Math.min(distance, 7 / 60)
      } else {
        dir = away(d.pos, p)
        step = 7 / 60
      }
      const oldGround = g.map.ground(d.pos[0], d.pos[2])
      d.pos[0] += dir[0] * step
      d.pos[2] += dir[1] * step
      const newGround = g.map.ground(d.pos[0], d.pos[2])
      if (Number.isFinite(oldGround) && Number.isFinite(newGround)) d.pos[1] += newGround - oldGround
    }
  }
  contacts() {
    const g = this.game, p = g.player
    if (g.respawn || p.flames <= 0) return
    for (const d of this.drifters) {
      if (d.state !== 'chase' || horizontal(d.pos, p.pos) > 1.2) continue
      d.stolen = Math.min(3, p.carried)
      p.carried -= d.stolen
      d.state = 'flee'
      d.ticks = 240
      g.emit('drifter_steal', {drifter_id: d.id, amount: d.stolen, carried: p.carried})
    }
    if (g.invuln || g.lanterns.some(l => l.lit && l.fuelUnits/60>=g.t.low_fuel_threshold && horizontal(l.pos, p.pos) <= g.t.safe_radius)) return
    for (const s of this.shades) {
      if (s.ejecting || (s.state !== 'chase' && s.state !== 'wander')) continue
      if (horizontal(s.pos, p.pos) > g.t.shade_hit_radius || Math.abs(s.pos[1] - p.pos[1]) > 1.5) continue
      const dropped = Math.floor(p.carried * g.t.hit_drop_ratio)
      p.carried -= dropped
      p.flames--
      g.drop(p.pos, dropped, true)
      g.invuln = Math.round(g.t.invuln_s * 60)
      s.state = 'recoil'
      s.ticks = 60
      s.direction = away(s.pos, p.pos)
      this.translate(s, s.direction, 2 / 60)
      g.emit('player_hit', {by: 'shade', flames: p.flames, dropped})
      break
    }
  }
  spawn() {
    const g = this.game, k = g.sim_tick
    const interval = [480, 420, 360][g.night - 1]
    if (g.scenario.random_shades !== false && k >= 300 && (k - 300) % interval === 0) {
      const limit = [6, 8, 10][g.night - 1]
      const sites = g.map.spawns.filter(pos => horizontal(pos, g.player.pos) >= 15 &&
        !g.lanterns.some(l => l.lit && l.fuelUnits/60>=g.t.low_fuel_threshold && horizontal(l.pos, pos) <= g.t.safe_radius) &&
        !this.shades.some(s => horizontal(pos, s.pos) < 0.01))
      const count = Math.min(k === 300 ? 2 : 1, limit - this.shades.length, sites.length)
      for (let i = 0; i < count; i++) {
        const [pos] = sites.splice(Math.floor(g.random() * sites.length), 1)
        const shade = this.addShade({pos: [pos[0], pos[1] + 0.8, pos[2]], state: 'spawning'})
        g.emit('shade_spawned', {id: shade.id})
      }
    }
    if (g.night >= 2 && g.scenario.random_drifters !== false && k > 0 && k % 1200 === 0 && this.drifters.length < 2) {
      const pos = g.map.spawns[Math.floor(g.random() * g.map.spawns.length)]
      if (pos) this.addDrifter({pos: [pos[0], pos[1] + 0.8, pos[2]]})
    }
  }
}
