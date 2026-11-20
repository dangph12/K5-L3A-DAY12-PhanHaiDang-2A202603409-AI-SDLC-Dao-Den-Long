import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {tmpdir} from 'node:os'
import path from 'node:path'

const root=path.resolve(process.argv[2]??'')
assert.ok(existsSync(path.join(root,'dist','index.html')),'Missing static web build')
assert.ok(existsSync(path.join(root,'dist-server','server.js')),'Missing Node server')
assert.ok(existsSync(path.join(root,'dist-cli','headless.js')),'Missing headless CLI')
const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
const server=spawn(process.execPath,['dist-server/server.js'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),LEADERBOARD_PATH:path.join(tmpdir(),'dao-den-release-smoke.json')},stdio:'ignore'})
try{
  let page
  for(let i=0;i<100;i++){try{page=await fetch(`http://127.0.0.1:${port}/`);if(page.ok)break}catch{};await new Promise(r=>setTimeout(r,50))}
  assert.equal(page?.status,200)
  assert.match(await page.text(),/Dao Den Long|Đảo Đèn Lồng|assets\/index/)
  const api=await fetch(`http://127.0.0.1:${port}/api/leaderboard`)
  assert.deepEqual(await api.json(),{entries:[]})
  console.log('PASS extracted release serves the web game and leaderboard API')
}finally{
  server.kill()
  await new Promise(resolve=>server.once('exit',resolve))
}
