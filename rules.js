// 依使用者歷來的規則檢查公民學習網：node rules.js <index.html>
// 排版（textbook-layout-fidelity）＋題庫／錯題（no-image-questions、qKey）
const fs = require('fs');
const F = process.argv[2] || 'C:/Users/anita/OneDrive/Desktop/claude/網頁APP/公民學習網/index.html';
const t = fs.readFileSync(F, 'utf8');
const code = t.slice(t.indexOf('<script>') + 8, t.lastIndexOf('</script>'));
const E = [], W = [];
// 取資料
const env = {};
const a = code.indexOf('/* ===== 各單元學習內容 ===== */'), b = code.indexOf('\n];', code.indexOf('const SUBJECTS=[')) + 3;
const S = eval('(function(){' + code.slice(a, b) + 'return SUBJECTS;})()');
const qi = code.indexOf('const Q_CIV=['), qe = code.indexOf('\n];', qi) + 3;
const Q = eval('(function(){' + code.slice(qi, qe) + 'return Q_CIV;})()');
const fi = code.indexOf('const QF='), fe = code.indexOf('\n', fi);
const QF = JSON.parse(code.slice(fi + 9, fe).replace(/;\s*$/, ''));
const qKey = q => q.k0 || String(q.q).replace(/⟦[^⟧]*⟧/g, '').slice(0, 60);

const units = S[0].vols.flatMap(v => v.us);
const allSvg = [];
units.forEach(u => {
  const where = '單元' + u.n;
  const parts = u.ps.map(p => ({ w: where + ' 重點' + p.n + '「' + p.t + '」', h: p.c || '' }));
  if (u.mem) parts.push({ w: where + ' 會考大解密／名詞', h: u.mem });
  parts.forEach(({ w, h }) => {
    if (!h) { (typeof u.n === 'number' ? E : W).push(w + '：內容待補'); return; }
    // 排版規則 1：除法用分數
    (h.replace(/<[^>]+>/g, '').match(/.{0,12}÷.{0,12}/g) || []).forEach(m => W.push(w + '：出現 ÷（應改分數，除非書上就印 ÷）→ ' + m));
    // 排版規則 2：用文字描述圖
    const plain = h.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '');
    (plain.match(/.{0,10}(橫軸|縱軸|如下圖|如圖所示|下圖為|上圖為).{0,10}/g) || []).forEach(m => { if (!/<svg|<table/.test(h)) E.push(w + '：用文字描述圖、卻沒有畫圖 → ' + m); });
    // 分數標記在學習內容裡不會被轉換
    if (/⟬/.test(h)) E.push(w + '：學習內容裡有 ⟬⟭ 分數標記（不會顯示成分數）');
    // 未確認的字
    (plain.match(/.{0,8}【\?】.{0,8}/g) || []).forEach(m => W.push(w + '：有看不清的字 → ' + m));
    (h.match(/<svg[\s\S]*?<\/svg>/g) || []).forEach(sv => allSvg.push({ w, sv }));
  });
  const nt = u.ps.reduce((n, p) => n + ((p.c || '').match(/<table/g) || []).length, 0);
  const ns = u.ps.reduce((n, p) => n + ((p.c || '').match(/<svg/g) || []).length, 0);
  console.log('  單元' + String(u.n).padStart(2) + ' ' + u.t.padEnd(14, '　') + ' 表格 ' + String(nt).padStart(2) + '、圖 ' + String(ns).padStart(2) + '、題目 ' + Q.filter(q => u.ps.some(p => p.t === q.sec)).length);
  if (u.ps.every(p => p.c) && nt === 0) W.push('單元' + u.n + '：學習內容沒有任何表格（書上幾乎每單元都有表，請確認）');
});
Object.entries(QF).forEach(([k, h]) => (h.match(/<svg[\s\S]*?<\/svg>/g) || []).forEach(sv => allSvg.push({ w: '附圖 ' + k, sv })));
// HTML 結構：每段內容與每張附圖的 <div> 開關數要相等（少一個 </div> 會把後面整頁吞進去）
const divBal = h => (h.match(/<div[\s>]/g) || []).length - (h.match(/<\/div>/g) || []).length;
units.forEach(u => u.ps.forEach(p => { const d = divBal(p.c || ''); if (d) E.push('單元' + u.n + ' 重點' + p.n + '「' + p.t + '」：<div> 開關差 ' + d); }));
units.forEach(u => { if (u.mem) { const d = divBal(u.mem); if (d) E.push('單元' + u.n + ' 會考大解密／名詞：<div> 開關差 ' + d); } });
Object.entries(QF).forEach(([k, h]) => { const d = divBal(h); if (d) E.push('附圖 ' + k + '：<div> 開關差 ' + d); });
// SVG 規則
const seenId = {};
allSvg.forEach(({ w, sv }) => {
  if (!/<svg[^>]*\swidth="/.test(sv)) E.push(w + '：SVG 沒有 width（放進表格會被壓扁）');
  const ids = (sv.match(/\sid="([^"]+)"/g) || []).map(x => x.slice(5, -1));
  ids.forEach(id => { if (seenId[id]) E.push(w + '：id「' + id + '」與 ' + seenId[id] + ' 重複（箭頭會消失）'); else seenId[id] = w; });
  (sv.match(/url\(#([^)]+)\)/g) || []).forEach(u => { const id = u.slice(5, -1); if (!ids.includes(id)) E.push(w + '：引用了圖外的 #' + id); });
  (sv.match(/<marker[^>]*>/g) || []).forEach(m => { if (!/markerUnits="userSpaceOnUse"/.test(m)) W.push(w + '：marker 沒有 markerUnits="userSpaceOnUse"（粗線箭頭會變超大）'); });
});
// 題庫／錯題
const keys = {};
const secs = new Set(units.flatMap(u => u.ps.map(p => p.t)));
Q.forEach((q, i) => {
  const w = '第 ' + (i + 1) + ' 題（' + q.sec + '）';
  if (!secs.has(q.sec) && !/模擬試題/.test(q.sec)) E.push(w + '：分類不是任何重點');
  const stem = q.q + ' ' + q.opts.join(' ');
  if (/(如圖|下圖|附圖|圖中|右圖|左圖|上圖|下表|如下表|表中|附表|右表|如表所示|漫畫)/.test(stem.replace(/⟦[^⟧]*⟧/g, '')) && !/⟦/.test(stem)) E.push(w + '：題目提到圖表卻沒有附圖 → ' + q.q.replace(/<[^>]+>/g, '').slice(0, 40));
  (stem.match(/⟦([^⟧]+)⟧/g) || []).forEach(m => { if (!QF['civ:' + m.slice(1, -1)]) E.push(w + '：附圖 ' + m + ' 不存在'); });
  const k = qKey(q);
  if (keys[k]) E.push(w + '：前 60 字與第 ' + keys[k] + ' 題相同（錯題本會混在一起）'); else keys[k] = i + 1;
  if (/÷/.test(stem.replace(/<[^>]+>/g, ''))) W.push(w + '：題目有 ÷');
  if (!q.exp || q.exp === '（書上無詳解）') W.push(w + '：沒有詳解');
});
// 程式面：錯題本與進度用的 key、雲端 app 名稱
[['function qKey', '錯題本 key（qKey）'], ['"civics"', '雲端錯題 app=civics'], ['"civics_progress"', '雲端進度 app=civics_progress'], ['PG_SINCE', '學習進度起算時間'], ['qFind', '錯題重測找回原題（qFind）']]
  .forEach(([s, n]) => { if (!code.includes(s)) E.push('程式缺：' + n); });
console.log('\n題目 ' + Q.length + '、附圖 ' + Object.keys(QF).length + '、SVG ' + allSvg.length);
console.log(E.length ? '❌ ' + E.length + ' 項錯誤' : '✅ 規則檢查無錯誤');
E.forEach(x => console.log('  ✗ ' + x));
W.forEach(x => console.log('  ⚠ ' + x));
process.exit(E.length ? 1 : 0);
