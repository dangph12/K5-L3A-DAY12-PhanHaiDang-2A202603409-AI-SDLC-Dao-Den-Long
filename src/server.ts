import {createServer} from 'node:http'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {parseArgs} from 'node:util'
import {decodeLeaderboard,submitEntry,type LeaderboardEntry} from './leaderboard.js'

const root=process.cwd(),staticRoot=path.resolve(root,'dist')
const storeFile=path.resolve(process.env.LEADERBOARD_PATH??path.join(root,'data','leaderboard.json'))
function readEntries(){
  try{return decodeLeaderboard(JSON.parse(readFileSync(storeFile,'utf8')))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error}
}
const args=parseArgs({options:{'export-leaderboard':{type:'string'}}}).values
if(args['export-leaderboard']){
  writeFileSync(args['export-leaderboard'],JSON.stringify({entries:readEntries()},null,2)+'\n')
  console.log('Đã xuất leaderboard: '+args['export-leaderboard'])
}else{
  const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`)
    if(url.pathname==='/api/leaderboard' && req.method==='GET'){
      try{res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({entries:readEntries()}))}
      catch(error){res.writeHead(500,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:(error as Error).message}))}
      return
    }
    if(url.pathname==='/api/leaderboard' && req.method==='POST'){
      try{
        const chunks:Buffer[]=[];let size=0
        for await(const part of req){size+=part.length;if(size>65536)throw new Error('Request quá lớn');chunks.push(Buffer.from(part))}
        const body=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {entry?:LeaderboardEntry}
        const entries=submitEntry(readEntries(),body.entry as LeaderboardEntry)
        mkdirSync(path.dirname(storeFile),{recursive:true})
        writeFileSync(storeFile,JSON.stringify({entries},null,2)+'\n')
        res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'})
        res.end(JSON.stringify({entries}));return
      }catch(error){res.writeHead(400,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:(error as Error).message}));return}
    }
    if(req.method!=='GET'){res.writeHead(405);res.end();return}
    let requested:string
    try{requested=decodeURIComponent(url.pathname)}catch{res.writeHead(400);res.end();return}
    if(requested==='/')requested='/index.html'
    const file=path.resolve(staticRoot,'.'+requested)
    if(file!==staticRoot&&!file.startsWith(staticRoot+path.sep)){res.writeHead(403);res.end();return}
    try{const body=readFileSync(file);res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream','cache-control':file.endsWith('.html')?'no-cache':'public, max-age=31536000, immutable'});res.end(body)}
    catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Không tìm thấy tệp')}
  })
  const port=Number(process.env.PORT??4173),host=process.env.HOST??'127.0.0.1'
  server.listen(port,host,()=>console.log(`Đảo Đèn Lồng: http://${host}:${port}`))
}
