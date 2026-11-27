// Node.js 20+. Запуск: node server.js. Сторонние библиотеки не требуются.
// Демо-данные создаются при первом запуске. Отключить: DEMO_SEED=0 node server.js
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PORT=Number(process.env.PORT||3000),HOST=process.env.HOST||'127.0.0.1';
const FILE=path.resolve(process.env.DATA_FILE||path.join(__dirname,'data.json'));
const html=fs.readFileSync(path.join(__dirname,'index.html'));
const uid=()=>crypto.randomUUID(),hash=(p,s)=>crypto.scryptSync(p,s,64).toString('hex');
const roles=['admin','dispatcher','teacher','student'],kinds=['groups','rooms','teachers','subjects'];

// ---- загрузка базы ----
const existed=fs.existsSync(FILE);
let db=existed?JSON.parse(fs.readFileSync(FILE,'utf8')):{version:1,users:[],lessons:[],audit:[],refs:{groups:[],rooms:[],teachers:[],subjects:[]}};
if(db.version!==1||!db.refs||!Array.isArray(db.users))throw Error('Неверный формат data.json');
for(const k of kinds)if(!Array.isArray(db.refs[k]))db.refs[k]=[];
if(!Array.isArray(db.lessons))db.lessons=[];
if(!Array.isArray(db.audit))db.audit=[];

function save(){fs.mkdirSync(path.dirname(FILE),{recursive:true});fs.writeFileSync(FILE+'.tmp',JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(FILE+'.tmp',FILE)}

// ---- демонстрационные данные ----
function seedDemo(){
  const groups=[{id:uid(),name:'ИС-21'},{id:uid(),name:'ИС-22'},{id:uid(),name:'ПИ-21'},{id:uid(),name:'ПИ-22'},{id:uid(),name:'ЭК-21'}];
  const rooms=[{id:uid(),name:'101'},{id:uid(),name:'202'},{id:uid(),name:'303'},{id:uid(),name:'Лаб-1'},{id:uid(),name:'Лаб-2'}];
  const teachers=[{id:uid(),name:'Иванова А. В.'},{id:uid(),name:'Петров С. Н.'},{id:uid(),name:'Сидорова Е. М.'},{id:uid(),name:'Козлов Д. А.'},{id:uid(),name:'Морозова Н. П.'}];
  const subjects=[{id:uid(),name:'Математика'},{id:uid(),name:'Информатика'},{id:uid(),name:'Физика'},{id:uid(),name:'Программирование'},{id:uid(),name:'Базы данных'},{id:uid(),name:'Английский язык'}];
  const mk=(name,login,password,role,extra={})=>{const salt=crypto.randomBytes(16).toString('hex');return {id:uid(),login,name,role,salt,hash:hash(password,salt),groupId:'',teacherId:'',...extra}};
  const users=[
    mk('Администратор','admin','admin12345','admin'),
    mk('Диспетчер Ольга','dispatcher','dispatcher1','dispatcher'),
    mk('Иванова Анна Викторовна','teacher1','teacher12345','teacher',{teacherId:teachers[0].id}),
    mk('Петров Сергей Николаевич','teacher2','teacher12345','teacher',{teacherId:teachers[1].id}),
    mk('Студент ИС-21','student1','student12345','student',{groupId:groups[0].id}),
    mk('Студент ПИ-21','student2','student12345','student',{groupId:groups[2].id}),
  ];
  const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const monday=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const mon=monday();
  const lessons=[];
  const A=['09:00','10:30'],B=['11:00','12:30'],C=['13:00','14:30'];
  const L=(w,day,slot,si,gi,ri,ti,status='planned',note='')=>lessons.push({
    id:uid(),date:localDate(addDays(mon,w*7+day)),start:slot[0],end:slot[1],
    subjectId:subjects[si].id,groupId:groups[gi].id,roomId:rooms[ri].id,teacherId:teachers[ti].id,status,note
  });
  for(const w of [0,1]){
    // Пн
    L(w,0,A,0,0,0,0); L(w,0,A,3,2,3,1); L(w,0,A,5,4,1,4);
    L(w,0,B,1,1,2,2); L(w,0,B,2,3,0,3);
    L(w,0,C,3,0,4,1); L(w,0,C,0,2,1,0); L(w,0,C,1,4,2,2);
    // Вт
    L(w,1,A,4,0,3,1); L(w,1,A,0,1,0,0); L(w,1,A,5,3,1,4);
    L(w,1,B,2,2,2,3); L(w,1,B,0,4,0,0);
    L(w,1,C,4,1,4,1); L(w,1,C,1,3,1,2);
    // Ср
    L(w,2,A,1,0,4,2); L(w,2,A,5,2,0,4); L(w,2,A,2,4,2,3);
    L(w,2,B,3,1,3,1); L(w,2,B,0,3,1,0);
    L(w,2,C,2,0,0,3); L(w,2,C,4,4,4,1);
    // Чт
    L(w,3,A,0,0,1,0); L(w,3,A,3,2,3,1); L(w,3,A,5,4,2,4);
    L(w,3,B,2,1,0,3); L(w,3,B,4,3,4,1);
    L(w,3,C,3,0,3,1); L(w,3,C,5,1,1,4);
    // Пт
    L(w,4,A,1,0,0,2); L(w,4,A,3,3,3,1); L(w,4,A,0,4,2,0);
    L(w,4,B,0,1,1,0); L(w,4,B,4,2,4,1);
    L(w,4,C,5,0,0,4);
  }
  // пара отменённых занятий — чтобы был виден статус
  lessons[lessons.length-1].status='cancelled';
  lessons[lessons.length-1].note='Перенос по заявлению преподавателя';
  lessons[lessons.length-3].status='cancelled';
  lessons[lessons.length-3].note='Отменено из-за болезни преподавателя';
  db.refs={groups,rooms,teachers,subjects};
  db.users=users;
  db.lessons=lessons;
  db.audit.push({at:new Date().toISOString(),user:'system',action:'Сгенерированы демонстрационные данные'});
}

// ---- первичное заполнение (только на чистой базе) ----
const SEED=process.env.DEMO_SEED!=='0';
let seeded=false;
if(SEED && db.users.length===0 && db.lessons.length===0){seedDemo();seeded=true}
if(!existed||seeded)save();
if(seeded){
  console.log('\n=== Демонстрационные данные созданы ===');
  console.log('  admin      / admin12345      — администратор');
  console.log('  dispatcher / dispatcher1     — диспетчер');
  console.log('  teacher1   / teacher12345    — преподаватель Иванова А. В.');
  console.log('  teacher2   / teacher12345    — преподаватель Петров С. Н.');
  console.log('  student1   / student12345    — студент группы ИС-21');
  console.log('  student2   / student12345    — студент группы ПИ-21\n');
}

const sessions=new Map(),attempts=new Map();
function fail(status,message){const e=Error(message);e.status=status;throw e}
function text(v,name,max=120){if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,`${name}: требуется текст длиной до ${max} символов`);return v.trim()}
function password(p){if(typeof p!=='string'||p.length<10||p.length>128)fail(400,'Пароль: от 10 до 128 символов');return p}
function log(u,action){db.audit.push({at:new Date().toISOString(),user:u.login,action});db.audit=db.audit.slice(-1000);save()}
function editor(u){if(!['admin','dispatcher'].includes(u.role))fail(403,'Недостаточно прав')}
function admin(u){if(u.role!=='admin')fail(403,'Только для администратора')}
function visible(u){return db.lessons.filter(l=>u.role==='student'?l.groupId===u.groupId:u.role==='teacher'?l.teacherId===u.teacherId:true)}
function safe(u){const {salt,hash:secret,...rest}=u;return rest}
function ref(kind,id){if(!db.refs[kind].some(r=>r.id===id))fail(400,'Не найден элемент справочника: '+kind);return id}
function lesson(b,id){const date=text(b.date,'Дата',10),start=text(b.start,'Начало',5),end=text(b.end,'Окончание',5);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'2000-01-01'||date>'2100-12-31'||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)fail(400,'Некорректная дата');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start>=end)fail(400,'Окончание должно быть позже начала');
 const l={id:id||uid(),date,start,end,groupId:ref('groups',b.groupId),roomId:ref('rooms',b.roomId),teacherId:ref('teachers',b.teacherId),subjectId:ref('subjects',b.subjectId),status:b.status==='cancelled'?'cancelled':'planned',note:typeof b.note==='string'?b.note.trim().slice(0,500):''};
 if(l.status!=='cancelled')for(const x of db.lessons){if(x.id===id||x.status==='cancelled'||x.date!==date||!(start<x.end&&end>x.start))continue;for(const [key,label]of [['roomId','Аудитория'],['teacherId','Преподаватель'],['groupId','Группа']])if(l[key]===x[key])fail(409,`${label} уже занят(а) ${x.start}–${x.end}. Сохранение запрещено.`)}
 return l;
}
function makeUser(b,old){const login=text(b.login,'Логин',40).toLowerCase();if(!/^[a-z0-9_.-]{3,40}$/.test(login))fail(400,'Логин: 3–40 латинских букв, цифр, _, . или -');if(db.users.some(u=>u.login===login&&u.id!==old?.id))fail(409,'Логин уже существует');if(!roles.includes(b.role))fail(400,'Неизвестная роль');
 const u={id:old?.id||uid(),login,name:text(b.name,'Имя'),role:b.role,groupId:b.role==='student'?ref('groups',b.groupId):'',teacherId:b.role==='teacher'?ref('teachers',b.teacherId):''};
 if(old&&!b.password){u.salt=old.salt;u.hash=old.hash}else{u.salt=crypto.randomBytes(16).toString('hex');u.hash=hash(password(b.password),u.salt)}return u;
}
function body(req){return new Promise((resolve,reject)=>{let raw='',n=0;req.on('data',c=>{n+=c.length;if(n>1048576){reject(Object.assign(Error('Слишком большой запрос'),{status:413}));req.destroy()}else raw+=c});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Object.assign(Error('Некорректный JSON'),{status:400}))}});req.on('error',reject)})}
function session(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4),s=sessions.get(token);if(!s||s.expires<Date.now()){if(token)sessions.delete(token);fail(401,'Войдите в систему')}const u=db.users.find(x=>x.id===s.userId);if(!u)fail(401,'Учетная запись удалена');return {u,s,token}}
function newSession(res,u){for(const [k,v]of sessions)if(v.expires<Date.now())sessions.delete(k);const token=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(24).toString('hex');sessions.set(token,{userId:u.id,csrf,expires:Date.now()+8*3600000});res.setHeader('Set-Cookie',`sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);return {user:safe(u),csrf}}
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))};
 try{const url=new URL(req.url,'http://localhost'),p=url.pathname,m=req.method;
 if(m==='GET'&&(p==='/'||p==='/index.html')){res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html)}
 if(p==='/favicon.ico'){res.writeHead(204);return res.end()}
 if(!p.startsWith('/api/'))fail(404,'Не найдено');
 let b={};if(['POST','PUT','DELETE'].includes(m)){if(!(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Требуется application/json');if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host)fail(403,'Чужой источник запроса')}b=await body(req)}
 if(p==='/api/bootstrap'&&m==='GET')return send(200,{setup:db.users.length===0});
 if(p==='/api/setup'&&m==='POST'){if(db.users.length)fail(409,'Администратор уже создан');const u=makeUser({...b,role:'admin'});db.users.push(u);log(u,'Первичная настройка');return send(201,newSession(res,u))}
 if(p==='/api/login'&&m==='POST'){const ip=req.socket.remoteAddress;let a=attempts.get(ip);if(a&&Date.now()>a.until){attempts.delete(ip);a=null}if(a&&a.count>=10)fail(429,'Слишком много попыток. Повторите через 15 минут.');if(attempts.size>10000)for(const[k,v]of attempts)if(v.until<Date.now())attempts.delete(k);
 const u=db.users.find(x=>x.login===String(b.login).toLowerCase().trim());const candidate=typeof b.password==='string'&&b.password.length<=128?b.password:'';const check=hash(candidate,u?.salt||'not-a-user');if(!u||!crypto.timingSafeEqual(Buffer.from(check,'hex'),Buffer.from(u.hash,'hex'))){attempts.set(ip,{count:(a?.count||0)+1,until:a?.until||Date.now()+900000});fail(401,'Неверный логин или пароль')}attempts.delete(ip);return send(200,newSession(res,u))}
 const {u,s,token}=session(req);if(m!=='GET'&&req.headers['x-csrf-token']!==s.csrf)fail(403,'Обновите страницу: неверный токен запроса');
 if(p==='/api/state'&&m==='GET')return send(200,{user:safe(u),csrf:s.csrf,refs:db.refs,lessons:visible(u),users:u.role==='admin'?db.users.map(safe):[],audit:['admin','dispatcher'].includes(u.role)?db.audit.slice(-100).reverse():[]});
 if(p==='/api/logout'&&m==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(200,{ok:true})}
 if(p==='/api/password'&&m==='POST'){if(typeof b.old!=='string'||b.old.length>128||hash(b.old,u.salt)!==u.hash)fail(400,'Старый пароль неверен');u.salt=crypto.randomBytes(16).toString('hex');u.hash=hash(password(b.password),u.salt);for(const[k,v]of sessions)if(v.userId===u.id&&k!==token)sessions.delete(k);log(u,'Смена пароля');return send(200,{ok:true})}
 const parts=p.split('/').filter(Boolean),id=parts[2];
 if(parts[1]==='lessons'){editor(u);if(m==='POST'&&!id){const l=lesson(b);db.lessons.push(l);log(u,'Добавлено занятие '+l.date+' '+l.start);return send(201,l)}const idx=db.lessons.findIndex(l=>l.id===id);if(idx<0)fail(404,'Занятие не найдено');if(m==='PUT'){db.lessons[idx]=lesson(b,id);log(u,'Изменено занятие '+id);return send(200,db.lessons[idx])}if(m==='DELETE'){db.lessons.splice(idx,1);log(u,'Удалено занятие '+id);return send(200,{ok:true})}}
 if(parts[1]==='refs'){editor(u);const kind=id,rid=parts[3];if(!kinds.includes(kind))fail(404,'Справочник не найден');const list=db.refs[kind];if(m==='POST'||m==='PUT'){const name=text(b.name,'Название');if(list.some(r=>r.name.toLowerCase()===name.toLowerCase()&&r.id!==rid))fail(409,'Название уже существует');if(m==='PUT'){const r=list.find(r=>r.id===rid);if(!r)fail(404,'Запись не найдена');r.name=name}else list.push({id:uid(),name});log(u,'Изменён справочник '+kind);return send(200,{ok:true})}if(m==='DELETE'){const key={groups:'groupId',rooms:'roomId',teachers:'teacherId',subjects:'subjectId'}[kind];if(db.lessons.some(l=>l[key]===rid)||db.users.some(x=>x[key]===rid))fail(409,'Запись используется в расписании или учетной записи');if(!list.some(r=>r.id===rid))fail(404,'Запись не найдена');db.refs[kind]=list.filter(r=>r.id!==rid);log(u,'Удалена запись '+kind);return send(200,{ok:true})}}
 if(parts[1]==='users'){admin(u);if(m==='POST'){const v=makeUser(b);db.users.push(v);log(u,'Создан пользователь '+v.login);return send(201,safe(v))}const idx=db.users.findIndex(x=>x.id===id);if(idx<0)fail(404,'Пользователь не найден');if(m==='PUT'){const v=makeUser(b,db.users[idx]);if(id===u.id&&v.role!=='admin')fail(400,'Нельзя понизить собственную роль');db.users[idx]=v;for(const[k,x]of sessions)if(x.userId===id&&k!==token)sessions.delete(k);log(u,'Изменён пользователь '+v.login);return send(200,safe(v))}if(m==='DELETE'){if(id===u.id)fail(400,'Нельзя удалить собственную учетную запись');db.users.splice(idx,1);for(const[k,v]of sessions)if(v.userId===id)sessions.delete(k);log(u,'Удалён пользователь '+id);return send(200,{ok:true})}}
 if(p==='/api/backup'&&m==='GET'){admin(u);res.setHeader('Content-Disposition','attachment; filename="backup.json"');return send(200,db)}
 fail(404,'Маршрут не найден');
 }catch(e){if(!res.headersSent){if(!e.status)console.error(e);send(e.status||500,{error:e.status?e.message:'Ошибка сервера. Проверьте консоль и доступ к файлу данных.'})}}});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(PORT,HOST,()=>console.log(`Учебный ритм: http://${HOST}:${server.address().port}\nДанные: ${FILE}\nОстановка: Ctrl+C`));