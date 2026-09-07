(() => {
  'use strict';
  const STORAGE_KEY = 'yumeAnnotationTool.v1';
  const $ = id => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ratingLabel = r => ({'3':'❤️❤️❤️','2':'❤️❤️','1':'❤️','0':'△','-1':'❌'})[String(r)] ?? '';
  const ratingClass = r => r === 3 ? 'r3' : r === 2 ? 'r2' : r === 1 ? 'r1' : r === 0 ? 'r0' : 'rn1';
  const uniqueSorted = values => [...new Set(values.filter(Boolean).map(v => String(v).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
  function refreshWorkSuggestions() {
    const fill = (id, values) => { const el=$(id); if(el) el.innerHTML=uniqueSorted(values).map(v=>`<option value="${escapeHtml(v)}"></option>`).join(''); };
    fill('characterSuggestions', state.works.map(w=>w.character));
    fill('seriesSuggestions', state.works.map(w=>w.series));
    fill('pairSuggestions', state.works.map(w=>w.pair_id));
  }
  function inferPromptVersionFromFilename(name) {
    const base=String(name||'').replace(/\.(txt|md)$/i,'');
    if (base.includes('新プロンプト_')) return 'new';
    if (base.includes('旧プロンプト_')) return 'old';
    return null;
  }

  let state = loadState();
  let currentWorkId = null;
  let pendingSelection = null;
  let selectedRating = null;
  let editingAnnotationId = null;
  let notesTimer = null;
  let batchImportQueue = [];
  let batchImportTotal = 0;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { schema_version:1, works:[] };
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (e) {
      console.error(e);
      return { schema_version:1, works:[] };
    }
  }
  function normalizeState(data) {
    const works = Array.isArray(data?.works) ? data.works : [];
    return { schema_version:1, works:works.map(w => ({
      id:w.id || uid('work'), title:w.title || '', character:w.character || '', prompt_version:w.prompt_version === 'new' ? 'new' : 'old',
      full_text:w.full_text || '', series:w.series || '', pair_id:w.pair_id || '', scenario:w.scenario || '', notes:w.notes || '',
      created_at:w.created_at || nowIso(), updated_at:w.updated_at || nowIso(), annotations:Array.isArray(w.annotations) ? w.annotations.map(a => ({
        id:a.id || uid('annotation'), work_id:w.id || '', quote:a.quote || '', start:Number(a.start)||0, end:Number(a.end)||0,
        rating:[-1,0,1,2,3].includes(Number(a.rating)) ? Number(a.rating) : 0, comment:a.comment || '', created_at:a.created_at || nowIso(), updated_at:a.updated_at || nowIso()
      })) : []
    }))};
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch (e) { alert('保存に失敗しました。Safariのストレージ容量をご確認ください。\n' + e.message); return false; }
  }
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function getWork() { return state.works.find(w => w.id === currentWorkId) || null; }
  function showView(name) {
    $('listView').hidden = name !== 'list'; $('readerView').hidden = name !== 'reader'; $('bottomEval').hidden = name !== 'reader';
  }

  function renderList() {
    const q = $('searchInput').value.trim().toLowerCase();
    const char = $('characterFilter').value;
    const ver = $('versionFilter').value;
    const chars = [...new Set(state.works.map(w => w.character).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
    const previous = $('characterFilter').value;
    $('characterFilter').innerHTML = '<option value="">全キャラ</option>' + chars.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (chars.includes(previous)) $('characterFilter').value = previous;
    const filtered = state.works.filter(w => {
      const hay = `${w.title} ${w.character} ${w.series}`.toLowerCase();
      return (!q || hay.includes(q)) && (!char || w.character === char) && (!ver || w.prompt_version === ver);
    }).sort((a,b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    const list = $('workList');
    if (!filtered.length) { list.innerHTML = '<div class="empty">該当する作品がありません。<br>「＋ 新規作品」から本文を登録できます。</div>'; return; }
    list.innerHTML = filtered.map(w => {
      const anns = w.annotations || [], hi = anns.filter(a => a.rating >= 2).length, low = anns.filter(a => a.rating < 0).length;
      return `<article class="card work-card" data-work-id="${escapeHtml(w.id)}">
        <div class="card-head"><div><div class="card-title">${escapeHtml(w.title)}</div><div class="subtle">${escapeHtml(w.character)}${w.series ? ' ・ '+escapeHtml(w.series) : ''}</div></div><span class="badge ${w.prompt_version}">${w.prompt_version.toUpperCase()}</span></div>
        <div class="stats"><span>注釈 ${anns.length}</span><span>高評価 ${hi}</span><span>低評価 ${low}</span></div>
      </article>`;
    }).join('');
    list.querySelectorAll('[data-work-id]').forEach(el => el.addEventListener('click', () => openReader(el.dataset.workId)));
  }

  function openReader(id) {
    currentWorkId = id; pendingSelection = null; window.getSelection()?.removeAllRanges();
    const w = getWork(); if (!w) return;
    $('readerTitle').textContent = w.title;
    $('readerMeta').innerHTML = `<span class="badge ${w.prompt_version}">${w.prompt_version.toUpperCase()}</span><span class="badge">${escapeHtml(w.character)}</span>${w.series?`<span class="badge">${escapeHtml(w.series)}</span>`:''}`;
    $('readerNotes').value = w.notes || '';
    renderAnnotatedText(w);
    $('selectionStatus').textContent = '本文を選択してください';
    showView('reader'); window.scrollTo({top:0,behavior:'instant'});
    requestAnimationFrame(syncBottomEvalToVisualViewport);
  }

  function renderAnnotatedText(w) {
    const text = w.full_text || '';
    const anns = [...(w.annotations || [])].filter(a => a.start >= 0 && a.end > a.start && a.end <= text.length && text.slice(a.start,a.end) === a.quote).sort((a,b)=>a.start-b.start || b.end-a.end);
    let html='', pos=0;
    for (const a of anns) {
      if (a.start < pos) continue;
      html += escapeHtml(text.slice(pos,a.start));
      html += `<mark id="ann-${escapeHtml(a.id)}" class="annotation ${ratingClass(a.rating)}" data-ann-id="${escapeHtml(a.id)}" title="${escapeHtml(ratingLabel(a.rating)+' '+(a.comment||''))}">${escapeHtml(text.slice(a.start,a.end))}</mark>`;
      pos = a.end;
    }
    html += escapeHtml(text.slice(pos));
    $('readerText').innerHTML = html;
    $('readerText').querySelectorAll('[data-ann-id]').forEach(el => el.addEventListener('click', ev => { ev.stopPropagation(); openAnnotationEdit(el.dataset.annId); }));
  }

  function getSelectionOffsets() {
    const root = $('readerText'); const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return null;
    const pre = document.createRange(); pre.selectNodeContents(root); pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length; const quote = range.toString(); const end = start + quote.length;
    if (!quote.trim()) return null;
    return { start, end, quote };
  }

  function syncBottomEvalToVisualViewport() {
    const bar = $('bottomEval');
    if (!bar || bar.hidden || $('readerView').hidden) return;
    bar.style.position = 'fixed';
    bar.style.top = 'auto';
    bar.style.bottom = '0px';
    bar.style.left = '0';
    bar.style.right = '0';
  }

  function ensureEvaluationBarVisible() {
    if ($('readerView').hidden) return;
    $('bottomEval').hidden = false;
    syncBottomEvalToVisualViewport();
    requestAnimationFrame(syncBottomEvalToVisualViewport);
    setTimeout(syncBottomEvalToVisualViewport, 60);
    setTimeout(syncBottomEvalToVisualViewport, 180);
    setTimeout(syncBottomEvalToVisualViewport, 350);
  }

  function refreshSelection() {
    if ($('readerView').hidden) return;
    if ($('annotationDialog').open) return;
    const s = getSelectionOffsets();
    if (s) pendingSelection = s;
    $('selectionStatus').textContent = s ? `${s.quote.trim().slice(0,18)}${s.quote.trim().length>18?'…':''}` : '本文を選択してください';
    ensureEvaluationBarVisible();
  }
  document.addEventListener('selectionchange', () => setTimeout(refreshSelection, 0));
  document.addEventListener('touchend', () => setTimeout(refreshSelection, 40), {passive:true});
  document.addEventListener('pointerup', () => setTimeout(refreshSelection, 20));
  window.addEventListener('scroll', syncBottomEvalToVisualViewport, {passive:true});
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncBottomEvalToVisualViewport);
    window.visualViewport.addEventListener('scroll', syncBottomEvalToVisualViewport);
  }
  window.addEventListener('orientationchange', () => setTimeout(syncBottomEvalToVisualViewport, 100));

  $('evaluateSelectionBtn').addEventListener('click', () => {
    const s = getSelectionOffsets() || pendingSelection;
    if (!s) { toast('先に本文の範囲を選択してください'); return; }
    pendingSelection = s; selectedRating = null;
    $('annotationQuote').textContent = s.quote;
    const commentBox = $('annotationComment');
    commentBox.value='';
    commentBox.readOnly = true;
    commentBox.tabIndex = -1;
    document.querySelectorAll('#ratingRow .rating-btn').forEach(b => b.classList.remove('selected'));
    $('annotationDialog').showModal();
    const closeBtn = $('annotationDialog').querySelector('.modal-close-x');
    requestAnimationFrame(() => {
      try { closeBtn?.focus({preventScroll:true}); } catch (_) { closeBtn?.focus(); }
      setTimeout(() => {
        commentBox.readOnly = false;
        commentBox.tabIndex = 0;
      }, 180);
    });
  });
  document.querySelectorAll('#ratingRow .rating-btn').forEach(btn => btn.addEventListener('click', () => {
    selectedRating = Number(btn.dataset.rating);
    document.querySelectorAll('#ratingRow .rating-btn').forEach(b => b.classList.toggle('selected', b === btn));
  }));
  function closeAnnotationDialog() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const dialog = $('annotationDialog');
    if (dialog.open) dialog.close();
    requestAnimationFrame(() => { if (dialog.open) dialog.close(); });
  }

  $('saveAnnotationBtn').addEventListener('click', () => {
    const w = getWork();
    if (!w) { toast('作品を読み込めませんでした'); return; }
    if (!pendingSelection) { toast('選択範囲が失われました。もう一度本文を選択してください'); return; }
    const selectionToSave = {...pendingSelection};
    if (selectedRating === null) { toast('評価を選んでください'); return; }
    const quote = w.full_text.slice(selectionToSave.start,selectionToSave.end);
    if (quote !== selectionToSave.quote) { toast('選択位置が変わりました。もう一度選択してください'); closeAnnotationDialog(); return; }
    const t = nowIso();
    w.annotations.push({ id:uid('annotation'), work_id:w.id, quote, start:selectionToSave.start, end:selectionToSave.end, rating:selectedRating, comment:$('annotationComment').value.trim(), created_at:t, updated_at:t });
    w.updated_at=t;
    saveState();
    closeAnnotationDialog();
    window.getSelection()?.removeAllRanges();
    pendingSelection=null;
    renderAnnotatedText(w);
    renderAnnotationList();
    ensureEvaluationBarVisible();
    toast('アノテーションを保存しました');
  });

  function openAnnotationEdit(id) {
    const w=getWork(), a=w?.annotations.find(x=>x.id===id); if(!a) return;
    editingAnnotationId=id; $('editAnnotationQuote').textContent=a.quote; $('editAnnotationRating').value=String(a.rating); $('editAnnotationComment').value=a.comment||''; $('annotationEditDialog').showModal();
  }
  $('updateAnnotationBtn').addEventListener('click', () => {
    const w=getWork(), a=w?.annotations.find(x=>x.id===editingAnnotationId); if(!a) return;
    a.rating=Number($('editAnnotationRating').value); a.comment=$('editAnnotationComment').value.trim(); a.updated_at=nowIso(); w.updated_at=nowIso(); saveState(); $('annotationEditDialog').close(); renderAnnotatedText(w); renderAnnotationList(); toast('更新しました');
  });
  $('deleteAnnotationBtn').addEventListener('click', () => {
    const w=getWork(); if(!w) return; const a=w.annotations.find(x=>x.id===editingAnnotationId); if(!a) return;
    if(!confirm('このアノテーションを削除しますか？')) return;
    w.annotations=w.annotations.filter(x=>x.id!==editingAnnotationId); w.updated_at=nowIso(); saveState(); $('annotationEditDialog').close(); renderAnnotatedText(w); renderAnnotationList(); toast('削除しました');
  });

  function renderAnnotationList() {
    const w=getWork(); if(!w) return; const f=$('annotationFilter').value;
    const items=[...(w.annotations||[])].filter(a=>f===''||String(a.rating)===f).sort((a,b)=>a.start-b.start);
    $('annotationList').innerHTML = items.length ? items.map(a=>`<div class="anno-item">
      <div><strong>${ratingLabel(a.rating)}</strong> <span class="subtle">${a.start}–${a.end}</span></div>
      <div class="anno-quote">${escapeHtml(a.quote)}</div>
      ${a.comment?`<div class="anno-comment">${escapeHtml(a.comment)}</div>`:''}
      <div class="anno-actions"><button class="btn small" data-jump="${escapeHtml(a.id)}">本文へ</button><button class="btn small" data-edit-ann="${escapeHtml(a.id)}">編集</button></div>
    </div>`).join('') : '<div class="empty">該当するアノテーションはありません。</div>';
    $('annotationList').querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{
      $('annotationsDialog').close(); const el=$(`ann-${b.dataset.jump}`); if(el){el.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>openAnnotationEdit(b.dataset.jump),350);} else toast('重複範囲のため本文ハイライト非表示です');
    }));
    $('annotationList').querySelectorAll('[data-edit-ann]').forEach(b=>b.addEventListener('click',()=>openAnnotationEdit(b.dataset.editAnn)));
  }
  $('annotationsBtn').addEventListener('click',()=>{
    $('annotationFilter').value='';
    renderAnnotationList();
    $('annotationsDialog').showModal();
    requestAnimationFrame(() => {
      const closeBtn = $('annotationsDialog').querySelector('.modal-close-x');
      try { closeBtn?.focus({preventScroll:true}); } catch (_) { closeBtn?.focus(); }
    });
  });
  $('annotationFilter').addEventListener('change',renderAnnotationList);

  $('newWorkBtn').addEventListener('click',()=>{ $('newWorkChoiceDialog').showModal(); });
  $('newWorkDirectBtn').addEventListener('click',()=>{ $('newWorkChoiceDialog').close(); openWorkDialog(); });
  $('newWorkFileBtn').addEventListener('click',()=>{ $('newWorkTextFile').click(); });
  $('newWorkTextFile').addEventListener('change', async e => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    try {
      const seeds = [];
      let skipped = 0;
      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (!(lower.endsWith('.txt') || lower.endsWith('.md'))) { skipped++; continue; }
        const text = await file.text();
        if (!text.trim()) { skipped++; continue; }
        const suggestedTitle = file.name.replace(/\.(txt|md)$/i, '');
        const inferredVersion = inferPromptVersionFromFilename(file.name);
        seeds.push({ title:suggestedTitle, full_text:text, ...(inferredVersion ? {prompt_version:inferredVersion} : {}) });
      }
      if (!seeds.length) throw new Error('読み込める .txt / .md ファイルがありませんでした。');
      batchImportQueue = seeds;
      batchImportTotal = seeds.length;
      $('newWorkChoiceDialog').close();
      openNextBatchImport();
      toast(skipped ? `${seeds.length}件を読み込み、${skipped}件をスキップしました` : `${seeds.length}件のファイルを読み込みました`);
    } catch (err) {
      alert('ファイルの読み込みに失敗しました。\n' + err.message);
      batchImportQueue = [];
      batchImportTotal = 0;
    } finally {
      e.target.value = '';
    }
  });

  function openNextBatchImport() {
    if (!batchImportQueue.length) {
      batchImportTotal = 0;
      renderList();
      return;
    }
    const seed = batchImportQueue.shift();
    openWorkDialog(null, seed);
    const current = batchImportTotal - batchImportQueue.length;
    $('workDialogTitle').textContent = `作品を追加 ${current}/${batchImportTotal}`;
  }
  $('workDialogFileBtn').addEventListener('click',()=>{ $('workDialogTextFile').click(); });
  $('workDialogTextFile').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (!(lower.endsWith('.txt') || lower.endsWith('.md'))) throw new Error('対応形式は .txt / .md です。');
      const text = await file.text();
      if (!text.trim()) throw new Error('ファイルの本文が空です。');
      $('workText').value = text;
      if (!$('workTitle').value.trim()) $('workTitle').value = file.name.replace(/\.(txt|md)$/i, '');
      const inferredVersion = inferPromptVersionFromFilename(file.name);
      if (inferredVersion) $('workVersion').value = inferredVersion;
      toast(inferredVersion ? `本文を読み込み、${inferredVersion.toUpperCase()} と判定しました` : '本文を読み込みました');
    } catch (err) {
      alert('ファイルの読み込みに失敗しました。\n' + err.message);
    } finally { e.target.value = ''; }
  });

  $('editWorkBtn').addEventListener('click',()=>openWorkDialog(getWork()));
  function openWorkDialog(w=null, seed=null){
    const source = w || seed || {};
    refreshWorkSuggestions();
    $('workDialogTitle').textContent=w?'作品を編集':'作品を追加'; $('workId').value=w?.id||''; $('workTitle').value=source.title||''; $('workCharacter').value=source.character||''; $('workVersion').value=source.prompt_version||'old'; $('workSeries').value=source.series||''; $('workPair').value=source.pair_id||''; $('workScenario').value=source.scenario||''; $('workText').value=source.full_text||''; $('workDeleteArea').hidden=!w; $('workDialog').showModal();
    requestAnimationFrame(() => {
      const back = $('workDialog').querySelector('[data-close="workDialog"]');
      try { back?.focus({preventScroll:true}); } catch (_) { back?.focus(); }
    });
  }
  $('workForm').addEventListener('submit',e=>{
    e.preventDefault(); const id=$('workId').value; const existing=state.works.find(w=>w.id===id); const t=nowIso();
    const payload={ title:$('workTitle').value.trim(), character:$('workCharacter').value.trim(), prompt_version:$('workVersion').value, series:$('workSeries').value.trim(), pair_id:$('workPair').value.trim(), scenario:$('workScenario').value.trim(), full_text:$('workText').value };
    if(existing){
      const textChanged=existing.full_text!==payload.full_text;
      if(textChanged && existing.annotations.length && !confirm('本文を変更すると既存アノテーションの位置がずれる可能性があります。本文変更を保存しますか？')) return;
      Object.assign(existing,payload,{updated_at:t});
    } else state.works.push({id:uid('work'),...payload,notes:'',created_at:t,updated_at:t,annotations:[]});
    if(!saveState()) return;
    refreshWorkSuggestions(); $('workDialog').close(); renderList();
    if(existing){
      currentWorkId=existing.id; openReader(existing.id); toast('作品を保存しました');
    } else if(batchImportTotal > 0) {
      if(batchImportQueue.length) {
        toast('保存しました。次のファイルを開きます');
        setTimeout(openNextBatchImport, 100);
      } else {
        batchImportTotal = 0;
        toast('複数ファイルの登録が完了しました');
      }
    } else {
      toast('作品を保存しました');
    }
  });
  $('deleteWorkBtn').addEventListener('click',()=>{
    const id=$('workId').value; const w=state.works.find(x=>x.id===id); if(!w) return;
    if(!confirm(`「${w.title}」をアノテーションごと削除しますか？`)) return;
    state.works=state.works.filter(x=>x.id!==id); saveState(); $('workDialog').close(); currentWorkId=null; showView('list'); renderList(); toast('作品を削除しました');
  });

  $('readerNotes').addEventListener('input',()=>{
    clearTimeout(notesTimer); notesTimer=setTimeout(()=>{const w=getWork(); if(!w)return; w.notes=$('readerNotes').value; w.updated_at=nowIso(); saveState();},350);
  });
  $('backBtn').addEventListener('click',()=>{ const w=getWork(); if(w){w.notes=$('readerNotes').value; saveState();} currentWorkId=null; showView('list'); renderList(); });

  function exportDataForLLM() {
    return { schema_version:1, exported_at:nowIso(), works:state.works.map(w=>({ id:w.id,title:w.title,series:w.series,character:w.character,prompt_version:w.prompt_version,pair_id:w.pair_id,scenario:w.scenario,notes:w.notes,full_text:w.full_text,annotations:(w.annotations||[]).map(a=>({id:a.id,quote:a.quote,start:a.start,end:a.end,rating:a.rating,comment:a.comment,created_at:a.created_at,updated_at:a.updated_at})),created_at:w.created_at,updated_at:w.updated_at })) };
  }
  function download(filename, content, mime) {
    const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('exportJsonBtn').addEventListener('click',()=>download(`yume-annotations-${dateStamp()}.json`,JSON.stringify(exportDataForLLM(),null,2),'application/json;charset=utf-8'));
  $('exportMdBtn').addEventListener('click',()=>download(`yume-annotations-${dateStamp()}.md`,toMarkdown(exportDataForLLM()),'text/markdown;charset=utf-8'));
  $('importJsonBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    try { const parsed=JSON.parse(await file.text()); const imported=normalizeState(parsed); if(!confirm(`JSONから ${imported.works.length} 作品を読み込みます。現在のデータは置き換わります。よろしいですか？`)) return; state=imported; saveState(); currentWorkId=null; showView('list'); renderList(); toast('JSONを読み込みました'); }
    catch(err){alert('JSONの読み込みに失敗しました。\n'+err.message);} finally {e.target.value='';}
  });
  function toMarkdown(data){
    const lines=['# 夢小説アノテーションデータ','',`- schema_version: ${data.schema_version}`,`- exported_at: ${data.exported_at}`,''];
    data.works.forEach((w,i)=>{
      lines.push(`## ${i+1}. ${w.title}`,'',`- キャラクター: ${w.character}`,`- 作品名: ${w.series||''}`,`- prompt_version: ${w.prompt_version}`,`- pair_id: ${w.pair_id||''}`,`- scenario: ${w.scenario||''}`,'', '### 全体メモ','',w.notes||'','', '### 本文全文','',w.full_text||'','', '### アノテーション一覧','');
      if(!w.annotations.length) lines.push('（なし）','');
      w.annotations.forEach((a,j)=>lines.push(`#### ${j+1}. ${ratingLabel(a.rating)} / ${a.start}–${a.end}`,'',`> ${String(a.quote).replace(/\n/g,'\n> ')}`,'',`- 評価値: ${a.rating}`,`- コメント: ${a.comment||''}`,'',));
      lines.push('---','');
    }); return lines.join('\n');
  }
  function dateStamp(){return new Date().toISOString().slice(0,10);}

  ['newWorkChoiceDialog','workDialog','annotationDialog','annotationsDialog','annotationEditDialog'].forEach(id => {
    document.querySelectorAll(`[data-close="${id}"]`).forEach(b=>b.addEventListener('click',()=>$(id).close()));
    $(id).addEventListener('click',e=>{ const r=$(id).getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) $(id).close(); });
  });
  $('workDialog').querySelectorAll('[data-close="workDialog"]').forEach(btn=>btn.addEventListener('click',()=>{
    if(batchImportTotal > 0){
      batchImportQueue=[];
      batchImportTotal=0;
      toast('複数ファイル登録を中止しました');
    }
  }));

  $('searchInput').addEventListener('input',renderList); $('characterFilter').addEventListener('change',renderList); $('versionFilter').addEventListener('change',renderList);

  renderList(); showView('list');
})();