/* ===========================================================================
   edit-layer.js — sửa / xoá phần chữ giải thích trên cả 3 dashboard
   ---------------------------------------------------------------------------
   Chỉ áp dụng cho chữ tĩnh: tiêu đề, mô tả, chú thích, nhãn bộ lọc.
   Không đụng tới con số, bảng, biểu đồ.

   Nội dung hiển thị xếp 3 lớp, giống cơ chế Message T10 bên tab Reward:
     bản gốc trong HTML  <  bản đã đăng trong overrides.json  <  bản nháp local
   Bấm "Đăng cho cả team" là commit <thư-mục>/overrides.json qua GitHub API.
   Token do người dùng tự dán, chỉ nằm trong localStorage của máy họ —
   không bao giờ nằm trong file này hay trong repo.
=========================================================================== */
(function(){
  if(window.__edLayer)return; window.__edLayer=1;

  const REPO='duyennguyen-CT/ct_internal_comms';
  const TKEY='rwgh_tok';
  const DIR=(location.pathname.replace(/\/[^/]*$/,'').split('/').filter(Boolean).pop())||'root';
  const FILE=DIR+'/overrides.json';
  const KEY='ed_'+DIR, MKEY='ed_'+DIR+'_pub';

  /* Các class chữ giải thích có trong 3 file. Mọi thứ ngoài danh sách này
     không bao giờ sửa được — cố ý, để không ai sửa nhầm vào số liệu. */
  const SEL=['h1','.sec-head h2','.sec-head p','.section-h','.section-sub',
    '.sec-title','.sec-sub','.sec-tag','.eyebrow','.p-title','.p-desc',
    '.ctl-label','.range-note','.strip-note','.callout','.note','.src',
    '.foot','.sub','.scope'].join(',');
  /* Vùng loại trừ: Message T10 có cơ chế sửa riêng, đừng để hai cái chồng nhau */
  const SKIP='svg,script,style,button,select,input,textarea,.mc,.mt,[data-f]';

  let store={}, pub={}, pubMeta={updated:null}, editing=false, obs=null, applying=false;
  try{store=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}

  /* ---- khoá định danh phần tử ------------------------------------------- */
  /* Ưu tiên #id. Nếu không có thì đi ngược lên tới tổ tiên gần nhất có id và
     ghép đường dẫn tag.class[thứ-tự]. Khoá phải ổn định qua các lần render lại,
     nếu đổi cách đặt khoá là mọi bản đã đăng và bản nháp mất liên kết. */
  function keyOf(el){
    if(el.id)return'#'+el.id;
    const parts=[];let n=el;
    while(n&&n!==document.body){
      if(n.id){parts.unshift('#'+n.id);break}
      const p=n.parentElement;if(!p)break;
      const tag=n.tagName.toLowerCase();
      const cls=n.className&&typeof n.className==='string'?n.className.trim().split(/\s+/)[0]:'';
      const sib=[...p.children].filter(c=>c.tagName===n.tagName);
      parts.unshift(tag+(cls?'.'+cls:'')+'['+sib.indexOf(n)+']');
      n=p;
    }
    return parts.join('>');
  }

  function targets(){
    return [...document.querySelectorAll(SEL)].filter(el=>{
      if(el.closest(SKIP))return false;
      if(el.querySelector(SEL))return false;          // chỉ lấy node lá
      if(el.closest('#edBar'))return false;
      return (el.textContent||'').trim().length>0 || el.dataset.edKey;
    });
  }

  /* ---- áp dụng 3 lớp ----------------------------------------------------- */
  function apply(){
    applying=true;
    targets().forEach(el=>{
      const k=el.dataset.edKey||(el.dataset.edKey=keyOf(el));
      const o=store[k]!==undefined?store[k]:pub[k];
      if(el.dataset.edOrig===undefined||(!o&&!el.dataset.edLocked)){
        el.dataset.edOrig=el.textContent;
        el.dataset.edOrigHtml=el.innerHTML;
      }
      if(!o){
        el.hidden=false;el.classList.remove('ed-gone');
        delete el.dataset.edLocked;
        return;
      }
      el.dataset.edLocked='1';
      if(o.d){
        el.classList.add('ed-gone');
        el.hidden=!editing;
        if(editing)el.textContent='(đã xoá — bấm để khôi phục)';
      }else{
        el.hidden=false;el.classList.remove('ed-gone');
        if(el!==document.activeElement&&el.textContent!==o.t)el.textContent=o.t;
      }
    });
    applying=false;
  }

  function reapply(){
    if(obs)obs.disconnect();
    apply();
    if(obs)obs.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  /* ---- chế độ sửa -------------------------------------------------------- */
  const PT=(()=>{const d=document.createElement('div');d.contentEditable='plaintext-only';
    return d.contentEditable==='plaintext-only'?'plaintext-only':'true'})();

  function setEdit(on){
    editing=on;
    document.documentElement.classList.toggle('ed-on',on);
    const b=document.getElementById('edToggle');
    b.setAttribute('aria-pressed',on?'true':'false');
    b.textContent=on?'✓ Xong':'✏️ Sửa chữ';
    reapply();
    targets().forEach(el=>{el.contentEditable=on?PT:'false'});
    status();
  }

  function onInput(e){
    if(!editing||applying)return;
    const el=e.target.closest?e.target.closest(SEL):null;
    if(!el||!el.dataset.edKey)return;
    const k=el.dataset.edKey, txt=el.textContent.trim();
    if(el.classList.contains('ed-gone'))return;
    if(!txt){store[k]={d:1};el.dataset.edLocked='1';el.classList.add('ed-gone');
      el.textContent='(đã xoá — bấm để khôi phục)';el.blur();}
    else if(txt===(el.dataset.edOrig||'').trim()&&!pub[k])delete store[k];
    else store[k]={t:el.textContent};
    save();
  }

  function onClick(e){
    if(!editing)return;
    const el=e.target.closest?e.target.closest('.ed-gone'):null;
    if(!el||!el.dataset.edKey)return;
    e.preventDefault();
    delete store[el.dataset.edKey];
    delete el.dataset.edLocked;
    el.classList.remove('ed-gone');
    el.innerHTML=pub[el.dataset.edKey]&&!pub[el.dataset.edKey].d
      ? '' : (el.dataset.edOrigHtml||'');
    if(pub[el.dataset.edKey]&&!pub[el.dataset.edKey].d)el.textContent=pub[el.dataset.edKey].t;
    save();
  }

  function undoAll(){
    if(!Object.keys(store).length)return;
    store={};
    targets().forEach(el=>{
      delete el.dataset.edLocked;
      el.classList.remove('ed-gone');el.hidden=false;
      const k=el.dataset.edKey,o=pub[k];
      if(o&&o.d){el.classList.add('ed-gone');el.hidden=!editing}
      else if(o)el.textContent=o.t;
      else if(el.dataset.edOrigHtml!==undefined)el.innerHTML=el.dataset.edOrigHtml;
    });
    save();status('Đã bỏ hết phần sửa chưa đăng');
  }

  function save(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}status()}

  function status(msg){
    const n=Object.keys(store).length;
    const p=document.getElementById('edPub');if(p)p.disabled=!n;
    const s=document.getElementById('edStat');if(!s)return;
    if(msg){s.textContent=msg;return}
    const when=pubMeta.updated?new Date(pubMeta.updated).toLocaleString('vi-VN',
      {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):null;
    s.textContent=n?`${n} chỗ sửa chưa đăng`
      :(editing?'Bấm vào chữ để sửa · xoá hết chữ là ẩn dòng đó'
        :(when?'Bản chung cập nhật '+when:'Chưa có bản đăng chung'));
  }

  /* ---- bản đã đăng ------------------------------------------------------- */
  function readMirror(){try{return JSON.parse(localStorage.getItem(MKEY)||'null')}catch(e){return null}}
  async function loadPub(){
    let remote=null;
    try{const r=await fetch('overrides.json?t='+Date.now(),{cache:'no-store'});
      if(r.ok)remote=await r.json()}catch(e){}
    const mine=readMirror();
    // Pages mất ~1 phút để build, nên nếu bản mình vừa đăng mới hơn thì ưu tiên nó
    let use=remote;
    if(mine&&mine.updated&&(!remote||!remote.updated||mine.updated>remote.updated))use=mine;
    if(use&&use.items){pub=use.items;pubMeta={updated:use.updated||null}}
    reapply();status();
  }

  function b64(s){
    const by=new TextEncoder().encode(s);let out='';
    for(let i=0;i<by.length;i+=0x8000)out+=String.fromCharCode.apply(null,by.subarray(i,i+0x8000));
    return btoa(out);
  }
  const tok=()=>{try{return localStorage.getItem(TKEY)||''}catch(e){return''}};

  async function publish(){
    if(!Object.keys(store).length)return;
    if(!tok()){openTok(true);status('Cần dán token GitHub trước khi đăng');return}
    const merged=Object.assign({},pub);
    Object.keys(store).forEach(k=>merged[k]=store[k]);
    const body={updated:new Date().toISOString(),updatedBy:'dashboard',items:merged};
    const url='https://api.github.com/repos/'+REPO+'/contents/'+FILE;
    const H={Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'};
    const btn=document.getElementById('edPub');btn.disabled=true;status('Đang đăng…');
    try{
      const g=await fetch(url+'?ref=main&t='+Date.now(),{headers:H,cache:'no-store'});
      if(g.status===401||g.status===403)throw new Error('auth');
      if(!g.ok&&g.status!==404)throw new Error('http '+g.status);
      const sha=g.ok?(await g.json()).sha:undefined;
      const p=await fetch(url,{method:'PUT',
        headers:Object.assign({'Content-Type':'application/json'},H),
        body:JSON.stringify({message:DIR+': cập nhật chữ giải thích',branch:'main',
          content:b64(JSON.stringify(body,null,2)+'\n'),sha})});
      if(p.status===401||p.status===403)throw new Error('auth');
      if(p.status===409||p.status===422)throw new Error('conflict');
      if(!p.ok)throw new Error('http '+p.status);
      pub=merged;pubMeta={updated:body.updated};store={};
      try{localStorage.removeItem(KEY);localStorage.setItem(MKEY,JSON.stringify(body))}catch(e){}
      reapply();
      status('✓ Đã đăng — người khác thấy sau khi GitHub Pages build xong (~1 phút)');
    }catch(err){
      status('✕ '+(err.message==='auth'
        ?'Token không hợp lệ hoặc thiếu quyền Contents: Read and write'
        :err.message==='conflict'?'Có người vừa đăng bản khác, tải lại trang rồi đăng lại'
        :'Không đăng được ('+err.message+')'));
      btn.disabled=false;
    }
  }

  function openTok(on){
    const p=document.getElementById('edTok'),b=document.getElementById('edTokBtn');
    const v=on===undefined?!p.classList.contains('on'):on;
    p.classList.toggle('on',v);b.setAttribute('aria-expanded',v?'true':'false');
    b.textContent=tok()?'🔑 ✓':'🔑';
    if(v)document.getElementById('edTokIn').focus();
  }

  /* ---- giao diện --------------------------------------------------------- */
  const CSS=`
#edBar{position:fixed;right:14px;bottom:14px;z-index:9999;display:flex;align-items:center;
  gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:min(92vw,560px);
  background:rgba(17,20,26,.94);border:1px solid rgba(255,255,255,.14);border-radius:10px;
  padding:8px 10px;font:500 12px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;
  color:#e7ecf3;box-shadow:0 8px 28px rgba(0,0,0,.45);backdrop-filter:blur(6px)}
#edBar button{font:inherit;color:inherit;background:rgba(255,255,255,.08);cursor:pointer;
  border:1px solid rgba(255,255,255,.16);border-radius:7px;padding:5px 9px}
#edBar button:hover:not(:disabled){background:rgba(255,255,255,.16)}
#edBar button:disabled{opacity:.4;cursor:default}
#edToggle[aria-pressed="true"]{background:#2f6df6;border-color:#2f6df6;color:#fff}
#edStat{flex:1 1 150px;min-width:120px;opacity:.78;font-weight:400}
#edTok{display:none;flex-basis:100%;gap:6px}
#edTok.on{display:flex}
#edTok input{flex:1;min-width:0;font:inherit;padding:5px 8px;border-radius:7px;
  border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.35);color:#e7ecf3}
html.ed-on [data-ed-key]{outline:1px dashed rgba(47,109,246,.55);outline-offset:2px;
  border-radius:3px;cursor:text}
html.ed-on [data-ed-key]:focus{outline:2px solid #2f6df6;background:rgba(47,109,246,.1)}
html.ed-on .ed-gone{outline-style:dotted;opacity:.45;font-style:italic;cursor:pointer}
@media print{#edBar{display:none}}`;

  function mount(){
    const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    const bar=document.createElement('div');bar.id='edBar';
    bar.innerHTML='<button type="button" id="edToggle" aria-pressed="false">✏️ Sửa chữ</button>'
      +'<span id="edStat"></span>'
      +'<button type="button" id="edUndo">Hoàn tác</button>'
      +'<button type="button" id="edPub" disabled>Đăng cho cả team</button>'
      +'<button type="button" id="edTokBtn" aria-expanded="false" title="Token GitHub">🔑</button>'
      +'<div id="edTok"><input id="edTokIn" type="password" autocomplete="off" '
      +'placeholder="Dán fine-grained token (Contents: Read and write)">'
      +'<button type="button" id="edTokSave">Lưu</button>'
      +'<button type="button" id="edTokDel">Xoá</button></div>';
    document.body.appendChild(bar);

    document.getElementById('edToggle').addEventListener('click',()=>setEdit(!editing));
    document.getElementById('edUndo').addEventListener('click',undoAll);
    document.getElementById('edPub').addEventListener('click',publish);
    document.getElementById('edTokBtn').addEventListener('click',()=>openTok());
    document.getElementById('edTokSave').addEventListener('click',()=>{
      const v=document.getElementById('edTokIn').value.trim();if(!v)return;
      try{localStorage.setItem(TKEY,v)}catch(e){}
      document.getElementById('edTokIn').value='';openTok(false);
      status('Đã lưu token trên trình duyệt này');
    });
    document.getElementById('edTokDel').addEventListener('click',()=>{
      try{localStorage.removeItem(TKEY)}catch(e){}
      document.getElementById('edTokIn').value='';openTok(false);
      status('Đã xoá token khỏi trình duyệt này');
    });

    document.addEventListener('input',onInput,true);
    document.addEventListener('click',onClick,true);
    document.addEventListener('keydown',e=>{
      if(editing&&e.key==='Enter'&&e.target.dataset&&e.target.dataset.edKey){e.preventDefault();e.target.blur()}
    },true);

    obs=new MutationObserver(()=>{if(!applying)clearTimeout(obs._t),obs._t=setTimeout(reapply,60)});
    reapply();
    obs.observe(document.body,{childList:true,subtree:true,characterData:true});
    openTok(false);status();
    loadPub();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0));
  else setTimeout(mount,0);
})();
