export interface LeaderboardEntry {
  name:string
  score:number
  nights_won:number
  achieved_at:string
  seed:number
}

export function validName(name:string):boolean{return /^[A-Za-z0-9_]{3,12}$/.test(name)}

export function validEntry(value:unknown):value is LeaderboardEntry {
  if(!value || typeof value!=='object')return false
  const entry=value as Partial<LeaderboardEntry>
  return typeof entry.name==='string' && validName(entry.name) && Number.isSafeInteger(entry.score) && entry.score!>=0 &&
    Number.isInteger(entry.nights_won) && entry.nights_won!>=0 && entry.nights_won!<=3 &&
    typeof entry.achieved_at==='string' && Number.isFinite(Date.parse(entry.achieved_at)) &&
    /(?:Z|[+-]\d\d:\d\d)$/.test(entry.achieved_at) && Number.isSafeInteger(entry.seed)
}

export function rank(entries:LeaderboardEntry[]):LeaderboardEntry[] {
  return entries.slice().sort((a,b)=>b.score-a.score || Date.parse(a.achieved_at)-Date.parse(b.achieved_at)).slice(0,10)
}

export function decodeLeaderboard(value:unknown):LeaderboardEntry[] {
  if(!value || typeof value!=='object' || !Array.isArray((value as {entries?:unknown}).entries))return []
  return rank(((value as {entries:unknown[]}).entries).filter(validEntry))
}

export function submitEntry(entries:LeaderboardEntry[],entry:LeaderboardEntry):LeaderboardEntry[] {
  if(!validEntry(entry))throw new Error('Bản ghi leaderboard không hợp lệ')
  return rank([...entries,entry])
}
