import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {tmpdir,release,platform} from 'node:os'
import {spawn,execFileSync,type ChildProcess} from 'node:child_process'
import {createServer as createNetServer} from 'node:net'
import {parseArgs} from 'node:util'
import {fileURLToPath} from 'node:url'

const args=parseArgs({options:{seed:{type:'string'},duration:{type:'string'},out:{type:'string'}}}).values
const seed=Number(args.seed),duration=Number(args.duration)
if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(duration)||duration<1||duration>300||!args.out)throw new Error('Dùng --seed 42 --duration 30 --out bench.json (duration 1–300 giây)')

function port():Promise<number>{return new Promise((resolve,reject)=>{const s=createNetServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const value=(s.address() as {port:number}).port;s.close(e=>e?reject(e):resolve(value))})})}
function browserPath(){
  const candidates=[process.env.BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter((x):x is string=>Boolean(x))
  const found=candidates.find(existsSync)
  if(!found)throw new Error('Không tìm thấy Chromium/Edge. Cài Edge hoặc đặt BROWSER_PATH tới executable.')
  return found
}
async function waitFor<T>(fn:()=>Promise<T|null>,timeout=20000,label='browser/benchmark') :Promise<T>{
  const until=Date.now()+timeout
  while(Date.now()<until){const value=await fn().catch(()=>null);if(value!==null)return value;await new Promise(r=>setTimeout(r,100))}
  throw new Error('Timeout chờ '+label)
}
function exited(child:ChildProcess,ms=5000){return Promise.race([new Promise<void>(resolve=>child.once('exit',()=>resolve())),new Promise<void>(resolve=>setTimeout(resolve,ms))])}
async function main(){
  const processStarted=Date.now(),portNumber=await port(),profile=mkdtempSync(path.join(tmpdir(),'dao-den-bench-'))
  const tempRoot=path.resolve(tmpdir())+path.sep,absoluteProfile=path.resolve(profile)
  if(!absoluteProfile.startsWith(tempRoot))throw new Error('Đường dẫn hồ sơ benchmark không an toàn')
  const browserProfile=path.join(profile,'browser')
  mkdirSync(browserProfile,{recursive:true})
  const serverFile=fileURLToPath(new URL('./server.js',import.meta.url))
  const server=spawn(process.execPath,[serverFile],{cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:String(portNumber),LEADERBOARD_PATH:path.join(profile,'leaderboard.json')},stdio:'ignore'})
  let browser:ChildProcess|undefined,socket:WebSocket|undefined,commandId=0
  const pending=new Map<number,{resolve:(x:any)=>void;reject:(e:Error)=>void}>()
  try{
    await waitFor(async()=>{const response=await fetch(`http://127.0.0.1:${portNumber}/api/leaderboard`);return response.ok?true:null},20000,'server API')
    const url=`http://127.0.0.1:${portNumber}/?bench=1&seed=${seed}&duration=${duration}&started=${processStarted}`
    browser=spawn(browserPath(),['--remote-debugging-port=0',`--user-data-dir=${browserProfile}`,'--no-first-run','--no-default-browser-check','--disable-gpu-vsync','--disable-frame-rate-limit','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--window-size=1280,720',`--app=${url}`],{stdio:'ignore'})
    const activePort=path.join(browserProfile,'DevToolsActivePort')
    const devtoolsPort=await waitFor(async()=>existsSync(activePort)?Number(readFileSync(activePort,'utf8').split(/\r?\n/)[0]):null,30000,'DevToolsActivePort')
    const target=await waitFor(async()=>{
      const response=await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)
      const targets=await response.json() as {type:string;url:string;webSocketDebuggerUrl:string}[]
      return targets.find(t=>t.type==='page'&&t.url.includes('?bench=1'))??null
    },30000,'benchmark page target')
    socket=new WebSocket(target.webSocketDebuggerUrl)
    await new Promise<void>((resolve,reject)=>{socket!.addEventListener('open',()=>resolve(),{once:true});socket!.addEventListener('error',()=>reject(new Error('Không kết nối được Chrome DevTools Protocol')),{once:true})})
    socket.addEventListener('message',event=>{
      const message=JSON.parse(String(event.data)) as {id?:number;result?:any;error?:{message:string}}
      if(message.id===undefined)return
      const item=pending.get(message.id);if(!item)return
      pending.delete(message.id)
      message.error?item.reject(new Error(message.error.message)):item.resolve(message.result)
    })
    const call=(method:string,params:Record<string,unknown>={})=>new Promise<any>((resolve,reject)=>{
      const id=++commandId;pending.set(id,{resolve,reject});socket!.send(JSON.stringify({id,method,params}))
    })
    await call('Page.enable')
    await call('Page.bringToFront')
    await call('Runtime.enable')
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false})
    const bench=await waitFor(async()=>{
      const response=await call('Runtime.evaluate',{expression:'window.__BENCH_RESULT__ ?? null',returnByValue:true})
      const value=response?.result?.value
      if(value?.contract_version==='1.3'||value?.error)return value
      return null
    },3000+duration*1000+30000,'benchmark result')
    if(bench.error)throw new Error(bench.error)
    bench.os=`${platform()} ${release()}`
    const out=path.resolve(args.out!)
    writeFileSync(out,JSON.stringify(bench,null,2)+'\n')
    console.log(JSON.stringify(bench))
    await call('Browser.close').catch(()=>{})
  }finally{
    try{socket?.close()}catch{}
    if(browser&&browser.exitCode===null){
      await exited(browser,1500)
      if(browser.exitCode===null){
        if(platform()==='win32')try{execFileSync('taskkill.exe',['/PID',String(browser.pid),'/T','/F'],{stdio:'ignore'})}catch{browser.kill()}
        else browser.kill()
        await exited(browser,1000)
      }
    }
    if(!server.killed){server.kill();await exited(server,1000)}
    rmSync(absoluteProfile,{recursive:true,force:true})
  }
}
main().catch(error=>{console.error((error as Error).message);process.exitCode=1})
