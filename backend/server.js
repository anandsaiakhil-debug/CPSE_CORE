const http = require('http'); const fs = require('fs'); const path = require('path'); const store = require('./data/store');
const root=path.join(__dirname,'..','public');
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const read=req=>new Promise(resolve=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{resolve(JSON.parse(b||'{}'))}catch{resolve({})}})});
function api(req,res,url){
 const materials=store.materialRecords();
 if(req.method==='GET'&&url.pathname==='/api/materials') return json(res,200,materials);
 if(req.method==='POST'&&url.pathname==='/api/materials/validate') return read(req).then(b=>json(res,200,{valid:b.records||1214,invalid:0,missing:0,duplicates:b.duplicates!==undefined?b.duplicates:8,quality:b.quality||94,issues:[]}));
 if(req.method==='POST'&&url.pathname==='/api/materials/normalize') return json(res,200,{normalized:11572,preserved:true,examples:[{original:'MS Bolt',normalized:'Mild Steel Bolt'},{original:'M.S. Bolt',normalized:'Mild Steel Bolt'},{original:'2-IN',normalized:'2 inch'}]});
 if(req.method==='POST'&&url.pathname==='/api/analysis/run') return json(res,200,{analyzed:11572,matches:1964,duplicates:842,recommendations:1426,progress:96,engine:'Demo AI Matching Engine'});
 if(req.method==='GET'&&url.pathname==='/api/matches') return json(res,200,store.groups);
 if(req.method==='GET'&&url.pathname==='/api/duplicates') return json(res,200,store.groups.filter(g=>g.status!=='Approved'));
 if(req.method==='GET'&&url.pathname==='/api/unified-materials') return json(res,200,store.groups);
 if(req.method==='GET'&&url.pathname==='/api/cpse') return json(res,200,store.cpses);
 if(req.method==='GET'&&url.pathname==='/api/audit') return json(res,200,store.audit);
 if(req.method==='GET'&&url.pathname==='/api/mappings') return json(res,200,materials.map(m=>({cpse:m.cpse,legacyCode:m.materialCode,nationalCode:m.nationalCode,standardName:store.groups.find(g=>g.id===m.groupId).name,status:m.status==='Approved'?'Mapped':'Pending Approval'})));
 if(req.method==='POST'&&url.pathname==='/api/standardization/approve') return read(req).then(b=>{const g=store.groups.find(x=>x.id===b.groupId);if(!g)return json(res,404,{error:'Group not found'});g.status='Approved';store.addAudit({action:'Standardization Approved',material:g.name,oldValue:g.records.map(r=>r[1]).join(', '),newValue:g.code,actor:b.actor||'Material Master Admin',status:'Approved'});json(res,200,{message:`${g.records.length} original CPSE codes are now traceably mapped to ${g.code}.`,group:g})});
 if(req.method==='POST'&&url.pathname==='/api/standardization/reject') return read(req).then(b=>{const g=store.groups.find(x=>x.id===b.groupId);if(!g)return json(res,404,{error:'Group not found'});g.status='Rejected';store.addAudit({action:'Recommendation Rejected',material:g.name,oldValue:g.records.map(r=>r[1]).join(', '),newValue:'Original records retained',actor:b.actor||'Material Master Admin',status:'Rejected'});json(res,200,{message:'Recommendation rejected. Original CPSE records remain unchanged.',group:g})});
 if(req.method==='POST'&&url.pathname==='/api/materials/upload') return json(res,200,{received:1250,valid:1218,missing:21,duplicates:11,message:'Demo import completed. Source records are preserved.'});
 if(req.method==='GET'&&url.pathname==='/api/reports') return json(res,200,{groups:store.groups,mappings:materials});
 return false;
}
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){const handled=api(req,res,url);if(handled!==false)return}let file=url.pathname==='/'?'index.html':url.pathname.replace(/^\//,'');file=path.join(root,file);if(!file.startsWith(root)||!fs.existsSync(file))file=path.join(root,'index.html');const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'application/javascript'})[ext]||'text/plain'});fs.createReadStream(file).pipe(res)}).listen(process.env.PORT||3000,()=>console.log('MaterialCode AI running locally at http://localhost:3000'));
