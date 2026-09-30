
const FREQ_SORTED = BUNDLED_WORDS.map(w=>w.n).filter(n=>Number.isFinite(n)).sort((a,b)=>b-a);
function freqInfo(word){
  const n=word.n;
  if(!Number.isFinite(n)) return {stars:"☆☆☆☆☆",label:"暂无可靠词频",n:null};
  if(n===0) return {stars:"☆☆☆☆☆",label:"样本中未出现",n};
  let lo=0,hi=FREQ_SORTED.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(FREQ_SORTED[mid]>n)lo=mid+1;else hi=mid}
  const pct=lo/FREQ_SORTED.length;
  if(pct<0.05) return {stars:"★★★★★",label:"超高频",n};
  if(pct<0.15) return {stars:"★★★★½",label:"很高频",n};
  if(pct<0.30) return {stars:"★★★★☆",label:"高频",n};
  if(pct<0.50) return {stars:"★★★½☆",label:"中高频",n};
  if(pct<0.75) return {stars:"★★★☆☆",label:"常见",n};
  return {stars:"★★☆☆☆",label:"较低频",n};
}
function freqHTML(w, mini=false){
  const f=freqInfo(w);
  const title=f.n==null?f.label:`${f.label} · 样本出现 ${f.n} 次`;
  if(mini) return `<span class="freqMini" title="${escapeAttr(title)}">${f.stars} ${f.label}</span>`;
  return `<div class="freqBadge" title="${escapeAttr(title)}"><span class="freqStars">${f.stars}</span> ${f.label}${f.n===null?'':` · ${f.n} 次`}</div>`;
}

const STATE_KEY = "cet4_swipe_v3_state";
const BOOK_KEY = "cet4_swipe_v3_book";
const FALLBACK = [
  {w:"abandon",p:"əˈbændən",m:"vt. 丢弃；放弃，抛弃"},
  {w:"ability",p:"əˈbiliti",m:"n. 能力；能耐，本领"},
  {w:"absorb",p:"əbˈsɔːb",m:"vt. 吸收；使专心"},
  {w:"academic",p:"ˌækəˈdemik",m:"a. 学院的；学术的"},
  {w:"access",p:"ˈækses",m:"n. 接近；通道，入口"},
  {w:"accompany",p:"əˈkʌmpəni",m:"vt. 陪伴，陪同；伴随"},
  {w:"accurate",p:"ˈækjurit",m:"a. 准确的，正确无误的"},
  {w:"achieve",p:"əˈtʃiːv",m:"vt. 完成，实现；达到"},
  {w:"adapt",p:"əˈdæpt",m:"vt. 使适应；改编"},
  {w:"adequate",p:"ˈædikwit",m:"a. 足够的；可以胜任的"},
  {w:"advantage",p:"ədˈvɑːntidʒ",m:"n. 优点，优势；好处"},
  {w:"adventure",p:"ədˈventʃə",m:"n. 冒险；惊险活动"},
  {w:"alternative",p:"ɔːlˈtɜːnətiv",m:"n. 选择；替代物"},
  {w:"annual",p:"ˈænjuəl",m:"a. 每年的；年度的"},
  {w:"apparent",p:"əˈpærənt",m:"a. 表面上的；明显的"},
  {w:"appropriate",p:"əˈprəupriət",m:"a. 适当的，恰当的"},
  {w:"aspect",p:"ˈæspekt",m:"n. 方面；样子，外表"},
  {w:"assume",p:"əˈsjuːm",m:"vt. 假定；承担"},
  {w:"available",p:"əˈveiləbl",m:"a. 可利用的；可得到的"},
  {w:"benefit",p:"ˈbenifit",m:"n. 利益；恩惠；好处"},
  {w:"capacity",p:"kəˈpæsiti",m:"n. 容量；能力"},
  {w:"circumstance",p:"ˈsəːkəmstəns",m:"n. 情况；环境"},
  {w:"consequence",p:"ˈkɔnsikwəns",m:"n. 结果；后果"},
  {w:"considerable",p:"kənˈsidərəbl",m:"a. 相当大的；重要的"},
  {w:"consume",p:"kənˈsjuːm",m:"vt. 消耗；消费"},
  {w:"decline",p:"diˈklain",m:"vi. 下降；衰退；拒绝"},
  {w:"demonstrate",p:"ˈdemənstreit",m:"vt. 说明；证明；示范"},
  {w:"essential",p:"iˈsenʃəl",m:"a. 必要的；本质的"},
  {w:"establish",p:"iˈstæbliʃ",m:"vt. 建立；设立；确立"},
  {w:"feature",p:"ˈfiːtʃə",m:"n. 特征；特色"}
];

let WORDS = [];
let state = loadState();
let currentPage = "screen";
let currentScreenWord = null;
let screenListLimit = 100;
let screenStage=0;
let quiz = {queue:[], idx:0, phase:"en2zh", word:null, answered:false, cycleOK:true};

function todayKey(){
  const d = new Date();
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function defaultState(){
  return {schemaVersion:5,mastered:{}, pending:{}, screened:{}, todayAdded:{}, screenOrder:[], lastDay:todayKey(),review:null,_updatedAt:0};
}
function normalizeState(raw){
  const s={...defaultState(),...raw};
  for(const k of ['mastered','pending','screened','todayAdded'])s[k]=s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])?s[k]:{};
  s.screenOrder=Array.isArray(s.screenOrder)?s.screenOrder:[];
  if((raw?.schemaVersion||0)<5){
    for(const [k,v] of Object.entries(s.mastered))if(v&&v.via==='review'){delete s.mastered[k];delete s.screened[k]}
    s.review=null;s.schemaVersion=5;
  }
  return s;
}
function loadState(){
  const candidates=[];
  for(const key of [STATE_KEY,STATE_KEY+'_backup'])try{const x=JSON.parse(localStorage.getItem(key));if(x&&x.mastered&&x.pending)candidates.push(x)}catch(e){}
  candidates.sort((a,b)=>(b._updatedAt||0)-(a._updatedAt||0));
  return normalizeState(candidates[0]||defaultState());
}
let dbPromise,writeChain=Promise.resolve();
let storageOK=false;
function openProgressDB(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(Error('本地数据库不可用'));return}
    const req=indexedDB.open('cet4_progress',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('snapshots');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(Error('数据库暂时被占用'));
  });
  return dbPromise;
}
async function readDatabase(){
  const db=await openProgressDB();return new Promise((resolve,reject)=>{const req=db.transaction('snapshots').objectStore('snapshots').get('latest');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
}
async function writeDatabase(snapshot){
  const db=await openProgressDB();return new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(snapshot,'latest');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
}
function savedStatus(ok){
  const el=document.getElementById('saveStatus');if(!el)return;
  el.textContent=ok?'✓ 进度已保存 · 关闭浏览器后台后可继续':'⚠ 无法保存，请使用普通浏览模式并导出进度备份';
}
function saveState(){
  state._updatedAt=Math.max(Date.now(),(state._updatedAt||0)+1);
  const snapshot=JSON.parse(JSON.stringify(state)),text=JSON.stringify(snapshot);
  let localOK=false;
  for(const key of [STATE_KEY,STATE_KEY+'_backup'])try{localStorage.setItem(key,text);localOK=true}catch(e){}
  if(localOK){storageOK=true;savedStatus(true)}
  writeChain=writeChain.catch(()=>{}).then(()=>writeDatabase(snapshot)).then(()=>{storageOK=true;savedStatus(true)}).catch(()=>{if(!localOK)savedStatus(false)});
}
async function boot(){
  try{const dbState=await readDatabase();if(dbState&&(dbState._updatedAt||0)>(state._updatedAt||0))state=normalizeState(dbState)}catch(e){}
  saveState();loadBook();
  if(state.review&&state.review.word&&state.pending[state.review.word])resumeReview();
}
let requestedPersistence=false;
function protectStorage(){
  if(requestedPersistence)return;requestedPersistence=true;
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
}
document.addEventListener('pointerdown',protectStorage,{once:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveState();else if(currentPage==='screen'&&audioEnabled&&currentScreenWord)speakWord(currentScreenWord.w)});
window.addEventListener('pagehide',()=>saveState());
function dayRollover(){
  const t=todayKey();
  if(state.lastDay!==t){
    state.todayAdded={};
    state.lastDay=t;
    saveState();
  }
}
function keyOf(w){return w.w.toLowerCase()}
function isMastered(w){return !!state.mastered[keyOf(w)]}
function isPending(w){return !!state.pending[keyOf(w)]}
function isScreened(w){return !!state.screened[keyOf(w)]}
function availableToScreen(){return WORDS.filter(w=>!isMastered(w)&&!isPending(w))}
function ensureScreenOrder(){
  const remaining=availableToScreen().map(keyOf), valid=new Set(remaining), seen=new Set();
  const old=state.screenOrder||[];
  const kept=old.filter(k=>{if(!valid.has(k)||seen.has(k))return false;seen.add(k);return true});
  const added=shuffle(remaining.filter(k=>!seen.has(k)));
  if(kept.length!==old.length||added.length){state.screenOrder=kept.concat(added);saveState()}
  return state.screenOrder;
}
function pendingWords(){return WORDS.filter(w=>isPending(w))}
function masteredWords(){return WORDS.filter(w=>isMastered(w))}
function shuffle(a){
  a=[...a];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}

function parseWordbook(text){
  const map=new Map();
  const lines=text.replace(/\r/g,"").split("\n");
  for(let raw of lines){
    const line=raw.trim();
    if(!line || /^[A-Z]$/.test(line) || line.includes("大学英语四级大纲") || line.includes("共 4615")) continue;
    const m=line.match(/^([A-Za-z][A-Za-z'.-]*)\s*(?:\[([^\]]+)\])?\s+(.+)$/);
    if(!m) continue;
    const w=m[1].trim(), p=(m[2]||"").trim(), meaning=m[3].trim();
    if(meaning.length<2) continue;
    map.set(w.toLowerCase(),{w,p,m:meaning});
  }
  return [...map.values()];
}

async function loadBook(force=false){
  dayRollover();
  WORDS=BUNDLED_WORDS;
  document.getElementById("bookStatus").textContent=`CET-4 词库 ${WORDS.length} 词 · 词频已内置`;
  document.getElementById("screenNotice").classList.remove("warn");
  document.getElementById("screenNotice").textContent="先看单词，再点“看句子”帮助回忆。不会去待背，模糊稍后再筛，只有会了才进已掌握。";
  updateAll();renderScreen();
}
function afterBookLoad(source){
  document.getElementById("bookStatus").textContent=`CET-4 词库 ${WORDS.length} 词 · ${source}`;
  updateAll();renderScreen();
}

function updateAll(){
  if(!WORDS.length)return;
  const remain=availableToScreen().length, pending=pendingWords().length, mastered=masteredWords().length;
  document.getElementById("remainN").textContent=remain;
  document.getElementById("pendingN").textContent=pending;
  document.getElementById("masteredN").textContent=mastered;
  document.getElementById("screenProgress").textContent=`整套词库还剩 ${remain} 个待筛`;
  document.getElementById("todayAdded").textContent=`今日新增待背 ${Object.keys(state.todayAdded).length}`;
  document.getElementById("learnSummary").textContent=`待背 ${pending} 个 · 今日新增 ${Object.keys(state.todayAdded).length}`;
  document.getElementById("masteredSummary").textContent=`共 ${mastered} 个`;
  renderPendingList(); renderMastered(); renderScreenList();
  const stop=document.getElementById("stopTodayBtn");
  stop.disabled=pending===0;
  stop.style.opacity=pending===0?".45":"1";
}

function nextScreenWord(){
  const first=ensureScreenOrder()[0];
  return first ? WORDS.find(w=>keyOf(w)===first) : null;
}
function renderScreenList(){
  if(!WORDS.length)return;
  const byKey=new Map(WORDS.map(w=>[keyOf(w),w]));
  const q=(document.getElementById("screenSearch").value||"").trim().toLowerCase();
  const list=ensureScreenOrder().map(k=>byKey.get(k)).filter(Boolean)
    .filter(w=>!q||w.w.toLowerCase().includes(q)||w.m.includes(q));
  document.getElementById("screenListSummary").textContent=q?`匹配 ${list.length} 个`:`共 ${list.length} 个`;
  const box=document.getElementById("screenList"),more=document.getElementById("moreScreenBtn");
  box.innerHTML=list.length?list.slice(0,screenListLimit).map(w=>
    `<div class="row"><div class="left"><b>${wordButton(w.w)}</b>
    <div class="sub">${w.p?"/ "+escapeHTML(w.p)+" /　":""}${escapeHTML(w.m)} ${freqHTML(w,true)}</div></div></div>`
  ).join(""):`<div class="empty">${q?"没有匹配的待筛词。":"待筛词已全部处理。"}</div>`;
  more.classList.toggle("hidden",list.length<=screenListLimit);
  more.textContent=`展开全部 ${list.length} 个待筛词`;
}
function renderScreen(){
  if(!WORDS.length)return;
  currentScreenWord=nextScreenWord();screenStage=0;
  const deck=document.getElementById('deck'),ctr=document.getElementById('screenControls');deck.innerHTML='';
  document.getElementById('revealBtn').textContent='看句子';
  if(!currentScreenWord){
    ctr.classList.add('hidden');deck.innerHTML='<div class="cardBox empty"><b>待筛词已处理完 🎉</b><p>现在去背还没掌握的词。</p></div>';
    if(pendingWords().length)setTimeout(()=>showPage('learn'),350);return;
  }
  ctr.classList.remove('hidden');
  const card=document.createElement('div');card.className='wordCard';
  card.innerHTML=`<div class="badge bad">不会</div><div class="badge good">会了</div><div class="word">${wordButton(currentScreenWord.w)}</div><div class="phonetic">${currentScreenWord.p?'/ '+escapeHTML(currentScreenWord.p)+' /':''}</div>${freqHTML(currentScreenWord)}<div class="example" id="example"></div><div class="meaning" id="meaning">${escapeHTML(currentScreenWord.m)}</div><div class="swipeHint">点单词重播 · 左滑不会 · 右滑会了</div>`;
  deck.appendChild(card);bindSwipe(card);
  if(currentPage==='screen')autoSpeak(currentScreenWord.w);
}
function markUnknown(){
  if(!currentScreenWord)return;const k=keyOf(currentScreenWord);
  state.screened[k]=true;state.pending[k]={added:todayKey(),cycle:false};state.todayAdded[k]=true;
  currentScreenWord=null;saveState();updateAll();renderScreen();
}
function markKnown(){
  if(!currentScreenWord)return;const k=keyOf(currentScreenWord);
  state.screened[k]=true;state.mastered[k]={via:'screen',date:todayKey()};
  delete state.pending[k];delete state.todayAdded[k];currentScreenWord=null;saveState();updateAll();renderScreen();
}
function requeueWord(k){
  delete state.screened[k];
  const q=state.screenOrder.filter(x=>x!==k);
  const pos=Math.min(q.length,8+Math.floor(Math.random()*13));q.splice(pos,0,k);state.screenOrder=q;
}
function markFuzzy(){
  if(!currentScreenWord)return;requeueWord(keyOf(currentScreenWord));
  currentScreenWord=null;saveState();updateAll();renderScreen();
}
function exampleHTML(w){
  const ex=EXAMPLES[keyOf(w)];if(!ex)return '这份词库暂未收录例句。';
  const escaped=escapeHTML(ex.en);
  const key=escapeHTML(w.w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return escaped.replace(new RegExp('\\b('+key+')\\b','ig'),'<mark>$1</mark>');
}
function reveal(){
  if(!currentScreenWord)return;const ex=EXAMPLES[keyOf(currentScreenWord)],btn=document.getElementById('revealBtn');
  if(screenStage===0){document.getElementById('example').innerHTML=exampleHTML(currentScreenWord);document.getElementById('example').classList.add('show');btn.textContent='看释义';screenStage=1}
  else if(screenStage===1){const m=document.getElementById('meaning');m.innerHTML=escapeHTML(currentScreenWord.m)+(ex?.zh?'<div class="exampleTranslation">'+escapeHTML(ex.zh)+'</div>':'');m.classList.add('show');btn.textContent='收起提示';screenStage=2}
  else{document.getElementById('example').classList.remove('show');document.getElementById('meaning').classList.remove('show');btn.textContent='看句子';screenStage=0}
}
function bindSwipe(card){
  let sx=0,sy=0,dx=0,dy=0,drag=false,done=false;
  const bad=card.querySelector('.badge.bad'),good=card.querySelector('.badge.good');
  card.addEventListener('pointerdown',e=>{if(e.button!==0)return;sx=e.clientX;sy=e.clientY;dx=dy=0;drag=true;card.setPointerCapture(e.pointerId)});
  card.addEventListener('pointermove',e=>{if(!drag)return;dx=e.clientX-sx;dy=e.clientY-sy;if(Math.abs(dx)<Math.abs(dy))return;card.style.transform=`translateX(${dx}px) rotate(${dx/24}deg)`;bad.style.opacity=dx<0?Math.min(-dx/100,1):0;good.style.opacity=dx>0?Math.min(dx/100,1):0});
  const end=e=>{if(!drag)return;drag=false;if(done)return;if(Math.abs(dx)>90&&Math.abs(dx)>Math.abs(dy)){done=true;if(dx<0)markUnknown();else markKnown()}else{card.style.transform='';bad.style.opacity=good.style.opacity=0}};
  card.addEventListener('pointerup',end);card.addEventListener('pointercancel',()=>{drag=false;card.style.transform='';bad.style.opacity=good.style.opacity=0});
}
function renderPendingList(){
  if(!WORDS.length)return;
  const box=document.getElementById("pendingList"), list=pendingWords();
  if(!list.length){
    box.innerHTML=`<div class="empty">今天还没有待背词。先去筛词，遇到不会的左滑就行。</div>`;
    document.getElementById("startReviewBtn").classList.add("hidden"); return;
  }
  document.getElementById("startReviewBtn").classList.remove("hidden");
  box.innerHTML=list.slice(0,80).map(w=>{
    const k=keyOf(w), today=!!state.todayAdded[k];
    return `<div class="row"><div class="left"><b>${wordButton(w.w)}</b>
      <div class="sub">${w.p?"/ "+escapeHTML(w.p)+" /　":""}${escapeHTML(w.m)} ${freqHTML(w,true)}</div></div>
      <span class="tag">${today?"今日新增":"未完成"}</span></div>`;
  }).join("")+(list.length>80?`<div class="small">列表较长，这里先显示前 80 个；背诵模式会包含全部 ${list.length} 个。</div>`:"");
}

function startReview(){
  const list=pendingWords();
  if(!list.length)return;
  if(state.review?.word&&state.pending[state.review.word]){resumeReview();return}
  document.getElementById("quizDone").classList.add("hidden");
  quiz={queue:shuffle(list.map(keyOf)),idx:0,phase:"en2zh",word:null,answered:false,cycleOK:true};
  document.querySelector("#learn .cardBox").classList.add("hidden");
  document.getElementById("quizWrap").classList.remove("hidden");
  loadQuizWord();
}
function loadQuizWord(){
  if(!quiz.queue.length){
    state.review=null;saveState();document.getElementById('quizWrap').classList.add('hidden');document.getElementById('quizDone').classList.remove('hidden');updateAll();return;
  }
  const k=quiz.queue.shift(), w=WORDS.find(x=>keyOf(x)===k);
  if(!w){loadQuizWord();return}
  quiz.word=w; quiz.phase="en2zh"; quiz.answered=false; quiz.cycleOK=true;
  renderQuizQuestion();saveReview();
}
function renderQuizQuestion(){
  const w=quiz.word;
  document.getElementById("feedback").className="feedback";
  document.getElementById("feedback").textContent="";
  document.getElementById("nextQuizBtn").classList.add("hidden");
  quiz.answered=false;
  const remaining=quiz.queue.length+1;
  document.getElementById("quizProgress").textContent=`本轮剩余 ${remaining} 个`;
  const en2zh=quiz.phase==="en2zh";
  document.getElementById("quizDirection").textContent=en2zh?"英 → 中":"中 → 英";
  document.getElementById("promptLabel").textContent=en2zh?"请选择正确中文释义":"请选择正确英文单词";
  const p=document.getElementById("quizPrompt");
  p.className="prompt"+(en2zh?"":" zh");
  p.innerHTML=(en2zh?wordButton(w.w):escapeHTML(w.m)) + freqHTML(w);
  if(en2zh)autoSpeak(w.w);
  const opts=makeOptions(w,en2zh);
  document.getElementById("options").innerHTML=opts.map(o=>
    `<button class="option" data-key="${escapeAttr(o.key)}">${escapeHTML(o.label)}</button>`).join("");
  document.querySelectorAll(".option").forEach(btn=>btn.onclick=()=>answerOption(btn.dataset.key));
}
function makeOptions(w,en2zh){
  const correctKey=keyOf(w);
  const pool=shuffle(WORDS.filter(x=>keyOf(x)!==correctKey)).slice(0,3);
  const all=shuffle([w,...pool]);
  return all.map(x=>({key:keyOf(x),label:en2zh?x.m:x.w}));
}
function answerOption(chosen){
  if(quiz.answered)return;
  quiz.answered=true;
  const correct=keyOf(quiz.word), ok=chosen===correct;
  if(!ok)quiz.cycleOK=false;
  document.querySelectorAll(".option").forEach(btn=>{
    btn.disabled=true;
    if(btn.dataset.key===correct)btn.classList.add("correct");
    else if(btn.dataset.key===chosen&&!ok)btn.classList.add("wrong");
  });
  const fb=document.getElementById("feedback");
  fb.className="feedback show "+(ok?"good":"bad");
  fb.textContent=ok?"答对了。":`答错了。正确答案是：${quiz.phase==="en2zh"?quiz.word.m:quiz.word.w}`;
  const next=document.getElementById("nextQuizBtn");
  next.classList.remove("hidden");
  next.textContent=quiz.phase==="en2zh"?"下一关：中 → 英":"继续";
  fb.innerHTML=escapeHTML(fb.textContent)+"<br>"+wordButton(quiz.word.w);
  if(quiz.phase==='zh2en')autoSpeak(quiz.word.w);saveReview();
}
function nextQuiz(){
  if(!quiz.answered)return;
  if(quiz.phase==="en2zh"){
    quiz.phase="zh2en";renderQuizQuestion();saveReview();return;
  }
  const k=keyOf(quiz.word);
  if(quiz.cycleOK){
    delete state.pending[k]; delete state.todayAdded[k];
    requeueWord(k);
  }else{
    // 一轮中任一方向答错：稍后整词再来一次两关
    quiz.queue.push(k);
  }
  saveState(); updateAll(); loadQuizWord();
}

function renderMastered(){
  if(!WORDS.length)return;
  const q=(document.getElementById("masteredSearch")?.value||"").trim().toLowerCase();
  let list=masteredWords().sort((a,b)=>a.w.localeCompare(b.w));
  if(q)list=list.filter(w=>w.w.toLowerCase().includes(q)||w.m.includes(q));
  const box=document.getElementById("masteredList");
  if(!list.length){box.innerHTML=`<div class="empty">${q?"没有匹配结果。":"还没有已掌握单词。"}</div>`;return}
  box.innerHTML=list.map(w=>
    `<div class="row"><div class="left"><b>${wordButton(w.w)}</b>
    <div class="sub">${w.p?"/ "+escapeHTML(w.p)+" /　":""}${escapeHTML(w.m)} ${freqHTML(w,true)}</div></div></div>`
  ).join("");
}

function showPage(name){
  currentPage=name;
  document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id===name));
  document.querySelectorAll(".navBtn").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  document.getElementById("homeBtn").textContent=name==="screen"?"筛词":name==="learn"?"待背":"已掌握";
  if(name!=="screen")stopSpeaking();
  if(name==="screen"){renderScreen();}
  if(name==="learn"){
    document.getElementById("quizDone").classList.add("hidden");
    document.querySelector("#learn .cardBox").classList.remove("hidden");
    document.getElementById("quizWrap").classList.add("hidden");
    renderPendingList();
  }
  if(name==="mastered")renderMastered();
}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escapeAttr(s){return escapeHTML(s)}

document.querySelectorAll(".navBtn").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.getElementById("unknownBtn").onclick=markUnknown;
document.getElementById("knownBtn").onclick=markKnown;
document.getElementById("fuzzyBtn").onclick=markFuzzy;
document.getElementById("continueScreenBtn").onclick=()=>showPage("screen");
document.getElementById("revealBtn").onclick=reveal;
document.getElementById("stopTodayBtn").onclick=()=>showPage("learn");
document.getElementById("startReviewBtn").onclick=startReview;
document.getElementById("nextQuizBtn").onclick=nextQuiz;
document.getElementById("backToListBtn").onclick=()=>showPage("learn");
document.getElementById("masteredSearch").oninput=renderMastered;
document.getElementById("screenSearch").oninput=()=>{screenListLimit=100;renderScreenList()};
document.getElementById("moreScreenBtn").onclick=()=>{screenListLimit=Infinity;renderScreenList()};
document.getElementById("retryBookBtn").onclick=()=>loadBook(true);
document.getElementById("fileInput").onchange=async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  const text=await f.text(), parsed=parseWordbook(text).map(w=>({...w,n:BUNDLED_WORDS.find(x=>x.w.toLowerCase()===w.w.toLowerCase())?.n??null}));
  if(parsed.length<50){alert("没有识别到足够的单词，请确认 TXT 格式。");return}
  WORDS=parsed;
  try{localStorage.setItem(BOOK_KEY,JSON.stringify(WORDS))}catch(err){}
  afterBookLoad("手动导入");
  alert(`已导入 ${WORDS.length} 个词。`);
};
document.getElementById("exportProgressBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify({version:5,exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="四级滑词卡_背词进度.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.getElementById("progressFileInput").onchange=async e=>{
  try{
    const raw=JSON.parse(await e.target.files[0].text());const restored=raw.state;
    if(!restored||!restored.mastered||!restored.pending||!restored.screened)throw Error("格式不正确");
    state=normalizeState(restored);state.review=null;
    saveState();updateAll();renderScreen();alert("进度已恢复");
  }catch(err){alert("无法读取这份进度文件："+err.message)}
};

function saveReview(){
  if(!quiz.word)return;state.review={queue:[...quiz.queue],word:keyOf(quiz.word),phase:quiz.phase,cycleOK:quiz.cycleOK};saveState();
}
function resumeReview(){
  const r=state.review,w=WORDS.find(x=>keyOf(x)===r?.word);if(!w||!state.pending[r.word]){state.review=null;saveState();return}
  showPage('learn');quiz={queue:(r.queue||[]).filter(k=>state.pending[k]),word:w,phase:r.phase==='zh2en'?'zh2en':'en2zh',answered:false,cycleOK:r.cycleOK!==false};
  document.querySelector('#learn .cardBox').classList.add('hidden');document.getElementById('quizDone').classList.add('hidden');document.getElementById('quizWrap').classList.remove('hidden');renderQuizQuestion();
}
function wordButton(word){return `<button type="button" class="wordButton" data-speak="${escapeAttr(word)}" aria-label="播放 ${escapeAttr(word)} 的读音">${escapeHTML(word)}<span class="speakerMini" aria-hidden="true">🔊</span></button>`}
let audioEnabled=true,audioObject=null,currentUtterance=null,speechTimer=null;
try{audioEnabled=localStorage.getItem('cet4_audio_enabled')!=='false'}catch(e){}
function stopSpeaking(){clearTimeout(speechTimer);if(window.speechSynthesis)speechSynthesis.cancel();if(audioObject){audioObject.pause();audioObject=null}}
function audioLabel(){const b=document.getElementById('audioBtn');b.textContent=audioEnabled?(b.dataset.activated==='yes'?'🔊 自动读音已开':'🔊 点此开启读音'):'🔇 自动读音已关'}
function audioStatus(text){document.getElementById('audioStatus').textContent=text}
function speakWord(word,manual=false){
  if(!word)return;
  if(manual){audioEnabled=true;document.getElementById('audioBtn').dataset.activated='yes';try{localStorage.setItem('cet4_audio_enabled','true')}catch(e){}audioLabel()}
  stopSpeaking();
  if(window.speechSynthesis&&window.SpeechSynthesisUtterance){
    const utterance=new SpeechSynthesisUtterance(word);currentUtterance=utterance;utterance.lang='en-US';utterance.rate=.85;
    const voices=speechSynthesis.getVoices();const en=voices.find(v=>v.lang==='en-US')||voices.find(v=>/^en[-_]/.test(v.lang));if(en)utterance.voice=en;
    utterance.onstart=()=>{clearTimeout(speechTimer);audioStatus('正在读：'+word)};
    utterance.onend=()=>audioStatus('点单词可重播');
    utterance.onerror=e=>{clearTimeout(speechTimer);if(e.error!=='canceled'&&e.error!=='interrupted')playOnline(word)};
    speechSynthesis.speak(utterance);
    speechTimer=setTimeout(()=>{if(!speechSynthesis.speaking)audioStatus('首次使用请点一下单词开启读音')},1500);
  }else playOnline(word);
}
function playOnline(word){
  const a=new Audio('https://dict.youdao.com/dictvoice?audio='+encodeURIComponent(word)+'&type=2');audioObject=a;
  a.onended=()=>audioStatus('点单词可重播');a.onerror=()=>audioStatus('读音暂不可用，请检查网络或浏览器声音权限');
  const p=a.play();if(p)p.then(()=>audioStatus('正在读：'+word)).catch(()=>audioStatus('点一下单词播放读音'));
}
function autoSpeak(word){if(audioEnabled)speakWord(word)}
document.getElementById('audioBtn').onclick=()=>{
  if(audioEnabled&&document.getElementById('audioBtn').dataset.activated==='yes'){audioEnabled=false;stopSpeaking();audioStatus('点单词仍可单次播放')}
  else{audioEnabled=true;document.getElementById('audioBtn').dataset.activated='yes';speakWord(currentPage==='screen'?currentScreenWord?.w:quiz.word?.w,true)}
  try{localStorage.setItem('cet4_audio_enabled',String(audioEnabled))}catch(e){}audioLabel();
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-speak]');if(b){speakWord(b.dataset.speak,true);return}if(e.target.closest('.wordCard')&&currentScreenWord)speakWord(currentScreenWord.w,true)});
audioLabel();

boot();

