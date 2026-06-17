const MAP_502_FIX_OSM_DIRECT = true;
const DEFAULT_WORK_PROXY_URL = 'http://192.168.227.254:3128';
process.env.MAP_PROXY_URL = process.env.MAP_PROXY_URL || DEFAULT_WORK_PROXY_URL;
process.env.HTTP_PROXY = process.env.HTTP_PROXY || DEFAULT_WORK_PROXY_URL;
process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || DEFAULT_WORK_PROXY_URL;
process.env.NO_PROXY = process.env.NO_PROXY || 'localhost,127.0.0.1';

const { app, BrowserWindow, shell } = require('electron');
const crypto = require('crypto');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { ProxyAgent } = require('proxy-agent');
const { handleApiRequest, ensureSchema } = require('../server/sqliteApi.cjs');

let mainWindow = null;
let localServer = null;
let dbPath = null;
let logPath = null;

const CORPORATE_PROXY_URL = process.env.MAP_PROXY_URL || 'http://192.168.227.254:3128';
const corporateProxyAgent = CORPORATE_PROXY_URL ? new ProxyAgent(CORPORATE_PROXY_URL) : undefined;

const MIME_TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
const PROXIES = [
  { prefix:'/nspd-api', target:'https://nspd.gov.ru/api', headers:{ Host:'nspd.gov.ru', Referer:'https://nspd.gov.ru/map', Origin:'https://nspd.gov.ru' } },
  { prefix:'/nspd', target:'https://nspd.gov.ru', headers:{ Host:'nspd.gov.ru', Referer:'https://nspd.gov.ru/map', Origin:'https://nspd.gov.ru' } },
  { prefix:'/fg', target:'https://fg.avto-spory.ru', headers:{ Origin:'https://rosreestor-russia.ru', Referer:'https://rosreestor-russia.ru/' } },
  { prefix:'/pkkros', target:'https://pkk.rosreestr.ru', headers:{} },
  { prefix:'/pkk', target:'https://pkk5.rosreestr.ru', headers:{} },
  { prefix:'/nominatim', target:'https://nominatim.openstreetmap.org', headers:{ Host:'nominatim.openstreetmap.org', Referer:'http://localhost/', Accept:'application/json,text/plain,*/*' } },
  { prefix:'/osm-a', target:'https://a.tile.openstreetmap.org', headers:{ Host:'a.tile.openstreetmap.org', Referer:'http://localhost/' } },
  { prefix:'/osm-b', target:'https://b.tile.openstreetmap.org', headers:{ Host:'b.tile.openstreetmap.org', Referer:'http://localhost/' } },
  { prefix:'/osm-c', target:'https://c.tile.openstreetmap.org', headers:{ Host:'c.tile.openstreetmap.org', Referer:'http://localhost/' } }
];

function writeLog(message, details = '') {
  const line = `[${new Date().toISOString()}] ${message}${details ? ` ${details}` : ''}\n`;
  try {
    if (!logPath && app?.isReady?.()) {
      const dir = path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(dir, { recursive: true });
      logPath = path.join(dir, 'main.log');
    }
    if (logPath) fs.appendFileSync(logPath, line, 'utf8');
  } catch {}
  try { console.log(line.trim()); } catch {}
}

process.on('uncaughtException', error => {
  writeLog('uncaughtException', error?.stack || error?.message || String(error));
});

process.on('unhandledRejection', reason => {
  writeLog('unhandledRejection', reason?.stack || reason?.message || String(reason));
});

async function prepareDb() {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dir, { recursive: true });
  dbPath = path.join(dir, 'app.db');
  writeLog('prepareDb', `userData="${app.getPath('userData')}" db="${dbPath}"`);
  if (!fs.existsSync(dbPath)) {
    const source1 = path.join(process.resourcesPath || '', 'data', 'app.db');
    const source2 = path.join(__dirname, '..', 'data', 'app.db');
    const source = fs.existsSync(source1) ? source1 : source2;
    if (fs.existsSync(source)) {
      writeLog('copyInitialDb', `source="${source}"`);
      fs.copyFileSync(source, dbPath);
    } else {
      writeLog('createEmptyDb', 'initial database seed not found; schema will be created');
    }
  }
  await ensureSchema(dbPath);
}
function safeEnd(res, text) {
  if (res.writableEnded || res.destroyed) return;
  try { res.end(text); } catch { try { res.destroy(); } catch {} }
}
function sendText(res, code, text){
  if (res.writableEnded || res.destroyed) return;
  try {
    if (!res.headersSent) {
      res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8','Access-Control-Allow-Origin':'*'});
    }
    safeEnd(res, text);
  } catch {
    try { res.destroy(); } catch {}
  }
}
function sendFile(res, filePath){fs.readFile(filePath,(e,d)=>{if(e){sendText(res,404,'File not found');return} const ext=path.extname(filePath).toLowerCase();try{if(!res.headersSent)res.writeHead(200,{'Content-Type':MIME_TYPES[ext]||'application/octet-stream','Cache-Control':'no-cache'});safeEnd(res,d)}catch{try{res.destroy()}catch{}}})}
function openLocalFile(res,url){const requested=String(url.searchParams.get('path')||'').trim(); if(!requested){sendText(res,400,'Файл не прикреплен. Сначала прикрепите документ.');return} let filePath=requested; try{if(filePath.startsWith('file://')){const parsed=new URL(filePath);filePath=decodeURIComponent(parsed.pathname).replace(/^\/([a-zA-Z]:\/)/,'$1')}}catch{} filePath=path.normalize(filePath); if(!path.isAbsolute(filePath)){sendText(res,400,'Локальный путь файла недоступен. Прикрепите документ заново в desktop-приложении.');return} fs.stat(filePath,(e,s)=>{if(e||!s.isFile()){sendText(res,404,'Файл не найден. Проверьте, что документ не был перемещён или удалён.');return} shell.openPath(filePath).then(result=>{if(result)sendText(res,500,'Не удалось открыть документ: '+result);else sendText(res,200,'OK')}).catch(err=>sendText(res,500,'Не удалось открыть документ: '+err.message))})}
function normalizeLocalPath(requested){
  let filePath=String(requested||'').trim();
  try{if(filePath.startsWith('file://')){const parsed=new URL(filePath);filePath=decodeURIComponent(parsed.pathname).replace(/^\/([a-zA-Z]:\/)/,'$1')}}catch{}
  return path.normalize(filePath);
}
function sendInlineFile(res,filePath,mimeType){
  fs.stat(filePath,(e,stat)=>{
    if(e||!stat.isFile()){sendText(res,404,'Файл не найден.');return}
    try{
      if(!res.headersSent)res.writeHead(200,{
        'Content-Type':mimeType||MIME_TYPES[path.extname(filePath).toLowerCase()]||'application/octet-stream',
        'Content-Length':stat.size,
        'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`,
        'Cache-Control':'no-store',
        'Access-Control-Allow-Origin':'*'
      });
      fs.createReadStream(filePath).pipe(res);
    }catch{try{res.destroy()}catch{}}
  });
}
function convertWordToPdf(inputPath,outputPath){
  return new Promise((resolve,reject)=>{
    if(process.platform!=='win32'){reject(new Error('Предпросмотр Word доступен в Windows desktop-приложении.'));return}
    const q=value=>String(value).replace(/'/g,"''");
    const script=`$ErrorActionPreference='Stop';$word=New-Object -ComObject Word.Application;$word.Visible=$false;try{$doc=$word.Documents.Open('${q(inputPath)}',$false,$true);$doc.ExportAsFixedFormat('${q(outputPath)}',17);$doc.Close($false)}finally{$word.Quit()}`;
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true});
    let error='';
    child.stderr.on('data',chunk=>{error+=chunk.toString()});
    child.on('error',reject);
    child.on('close',code=>code===0&&fs.existsSync(outputPath)?resolve(outputPath):reject(new Error(error.trim()||`Word завершил работу с кодом ${code}`)));
  });
}
async function previewLocalFile(res,url){
  const filePath=normalizeLocalPath(url.searchParams.get('path'));
  if(!filePath||!path.isAbsolute(filePath)){sendText(res,400,'Локальный путь файла недоступен. Прикрепите документ заново в desktop-приложении.');return}
  let stat;
  try{stat=fs.statSync(filePath)}catch{sendText(res,404,'Файл не найден. Проверьте, что документ не был перемещён или удалён.');return}
  if(!stat.isFile()){sendText(res,404,'Файл не найден.');return}
  const ext=path.extname(filePath).toLowerCase();
  if(ext==='.pdf'){sendInlineFile(res,filePath,'application/pdf');return}
  if(ext==='.doc'||ext==='.docx'){
    const cacheDir=path.join(app.getPath('userData'),'document-preview-cache');
    fs.mkdirSync(cacheDir,{recursive:true});
    const key=crypto.createHash('sha256').update(`${filePath}|${stat.mtimeMs}|${stat.size}`).digest('hex');
    const pdfPath=path.join(cacheDir,`${key}.pdf`);
    try{if(!fs.existsSync(pdfPath))await convertWordToPdf(filePath,pdfPath);sendInlineFile(res,pdfPath,'application/pdf')}catch(err){sendText(res,501,`Не удалось подготовить предпросмотр Word. ${err.message}`)}
    return;
  }
  sendText(res,415,'Предпросмотр доступен только для PDF, DOC и DOCX.');
}
function serveStatic(req,res,url){let p=decodeURIComponent(url.pathname); if(p==='/') p='/index.html'; const root=path.join(__dirname,'..','dist'); let fp=path.join(root,path.normalize(p).replace(/^(\.\.[/\\])+/,'')); if(!fp.startsWith(root)){sendText(res,403,'Forbidden');return} fs.stat(fp,(e,s)=>{ if(!e&&s.isDirectory()) fp=path.join(fp,'index.html'); fs.stat(fp,(e2,s2)=>{ if(!e2&&s2.isFile()) sendFile(res,fp); else if(path.extname(p)) sendText(res,404,'File not found'); else sendFile(res,path.join(root,'index.html')); }) }) }
function findProxy(pathname){return PROXIES.find(p=>pathname===p.prefix||pathname.startsWith(p.prefix+'/'))}
function proxyRequest(req,res,url,proxy){
  if(req.method==='OPTIONS'){
    sendText(res,204,'');
    return;
  }
  const targetBase=new URL(proxy.target);
  const targetUrl=new URL((url.pathname.replace(proxy.prefix,'')||'/')+url.search, proxy.target);
  const headers={...req.headers,...proxy.headers,host:proxy.headers.Host||targetBase.host,'user-agent':'Mozilla/5.0 Windows Chrome','accept':req.headers.accept||'application/json,image/png,text/plain,*/*'};
  delete headers.connection;
  delete headers['content-length'];
  const client=targetUrl.protocol==='https:'?https:http;
  let responseStarted=false;
  const pr=client.request({protocol:targetUrl.protocol,hostname:targetUrl.hostname,port:targetUrl.port||(targetUrl.protocol==='https:'?443:80),path:targetUrl.pathname+targetUrl.search,method:req.method,headers,rejectUnauthorized:false,agent:corporateProxyAgent,timeout:60000},pres=>{
    if(res.writableEnded || res.destroyed) { pres.resume(); return; }
    responseStarted=true;
    const h={...pres.headers,'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','access-control-allow-headers':'*'};
    if(req.url.includes('/wms')&&!h['content-type']) h['content-type']='image/png';
    try {
      if(!res.headersSent) res.writeHead(pres.statusCode||200,h);
      pres.pipe(res);
    } catch {
      pres.resume();
      try { res.destroy(); } catch {}
    }
  });
  pr.on('timeout',()=>pr.destroy(new Error('Proxy timeout')));
  pr.on('error',e=>{
    if(res.writableEnded || res.destroyed) return;
    if(responseStarted || res.headersSent) {
      try { res.end(); } catch { try { res.destroy(); } catch {} }
      return;
    }
    sendText(res,502,'Proxy error via '+CORPORATE_PROXY_URL+': '+e.message);
  });
  req.on('aborted',()=>{ try { pr.destroy(); } catch {} });
  req.pipe(pr);
}
function startLocalServer(){return new Promise((resolve,reject)=>{localServer=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'); if(url.pathname==='/meetings/open-local-file'){openLocalFile(res,url);return} if(url.pathname==='/files/preview'){await previewLocalFile(res,url);return} if(url.pathname.startsWith('/api/')){const ok=await handleApiRequest(req,res,url,dbPath); if(ok)return} const proxy=findProxy(url.pathname); if(proxy){proxyRequest(req,res,url,proxy);return} serveStatic(req,res,url)}catch(error){writeLog('Local server error',error?.stack||error?.message||String(error));sendText(res,500,error?.message||'Ошибка локального сервера')}}); localServer.on('error',error=>{writeLog('localServerError',error?.stack||error?.message||String(error));reject(error)}); localServer.listen(0,'127.0.0.1',()=>{const appUrl=`http://127.0.0.1:${localServer.address().port}/`;writeLog('localServerReady',`url="${appUrl}"`);resolve(appUrl)})})}
async function createWindow(){writeLog('appStart',`version="${app.getVersion()}" resources="${process.resourcesPath||''}"`);await prepareDb(); const appUrl=await startLocalServer(); mainWindow=new BrowserWindow({width:1440,height:920,minWidth:1180,minHeight:760,title:'Legal Dashboard',backgroundColor:'#eef3fb',autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:false}}); mainWindow.webContents.on('did-finish-load',()=>writeLog('frontendLoaded',`url="${appUrl}"`)); mainWindow.webContents.on('did-fail-load',(_event,code,description,url)=>writeLog('frontendLoadFailed',`code=${code} description="${description}" url="${url}"`)); mainWindow.loadURL(appUrl); mainWindow.webContents.setWindowOpenHandler(({url})=>{ if(url.startsWith(appUrl)) return {action:'allow'}; shell.openExternal(url); return {action:'deny'};});}
app.whenReady().then(createWindow).catch(error=>{writeLog('createWindowFailed',error?.stack||error?.message||String(error));app.quit()}); app.on('window-all-closed',()=>{if(localServer)localServer.close(()=>writeLog('localServerClosed')); if(process.platform!=='darwin')app.quit()}); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
