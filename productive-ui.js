/* Productive Time: planning-first UI, sharing the existing data and actions. */
/* Meditation is independent from task completion and uses a wall-clock deadline. */
const meditation={remaining:300000,end:0,running:false,volume:0.2,audioInterrupted:false};
const meditationTime=document.getElementById('meditationTime'),meditationStatus=document.getElementById('meditationStatus');
function stopMeditationAudio(){window.meditationAudio?.stopAmbient();}
function startMeditationAudio(){
  const sound=document.getElementById('meditationSound').value;
  return window.meditationAudio?.startAmbient(sound,meditation.volume)??sound==='silent';
}
function renderMeditation(){
 if(meditation.running){meditation.remaining=Math.max(0,meditation.end-Date.now());if(!meditation.remaining){meditation.running=false;meditation.audioInterrupted=false;stopMeditationAudio();if(document.visibilityState==='visible'&&document.getElementById('meditationSound').value!=='silent'&&meditation.volume>0)window.meditationAudio?.playAlert('soft',meditation.volume);meditationStatus.textContent='ครบเวลาแล้ว';}}
 window.MomentaWake?.setActive('meditation',meditation.running);
 document.getElementById('meditationResumeSound').hidden=!meditation.running||!meditation.audioInterrupted;
 const seconds=Math.ceil(meditation.remaining/1000);meditationTime.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');document.getElementById('meditationStart').textContent=meditation.running?'หยุดชั่วคราว':meditation.remaining?'เริ่มสมาธิ':'เริ่มอีกครั้ง';document.getElementById('meditationMinutes').disabled=meditation.running;document.getElementById('meditationSound').disabled=meditation.running;document.getElementById('meditationVolume').disabled=meditation.running;document.getElementById('meditationPreview').disabled=meditation.running;
}
document.getElementById('meditationStart').addEventListener('click',()=>{meditation.audioInterrupted=false;if(meditation.running){meditation.remaining=Math.max(0,meditation.end-Date.now());meditation.running=false;stopMeditationAudio();meditationStatus.textContent='หยุดชั่วคราว';}else{if(!meditation.remaining)meditation.remaining=Number(document.getElementById('meditationMinutes').value)*60000;meditation.end=Date.now()+meditation.remaining;meditation.running=true;meditationStatus.textContent=startMeditationAudio()?'กำลังนั่งสมาธิ':'กำลังนั่งสมาธิ · เบราว์เซอร์ไม่รองรับเสียง';}renderMeditation();});
document.getElementById('meditationReset').addEventListener('click',()=>{meditation.running=false;stopMeditationAudio();meditation.remaining=Number(document.getElementById('meditationMinutes').value)*60000;meditationStatus.textContent='พร้อมเริ่ม';renderMeditation();});
document.getElementById('meditationMinutes').addEventListener('change',e=>{meditation.remaining=Number(e.target.value)*60000;renderMeditation();});
document.getElementById('meditationVolume').addEventListener('input',e=>{meditation.volume=Math.max(0,Math.min(1,Number(e.target.value)/100));});
document.getElementById('meditationPreview').addEventListener('click',()=>{const kind=document.getElementById('meditationSound').value;const ok=window.meditationAudio?.previewAmbient(kind,meditation.volume,7000);meditationStatus.textContent=kind==='silent'?'เลือกปิดเสียงอยู่':ok?'กำลังเล่นตัวอย่างเสียงสังเคราะห์ 7 วินาที':'เบราว์เซอร์นี้ไม่รองรับเสียง';});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'&&meditation.running){stopMeditationAudio();meditation.audioInterrupted=document.getElementById('meditationSound').value!=='silent';meditationStatus.textContent='พักเสียงเมื่อออกจากแอป';}else if(document.visibilityState==='visible')renderMeditation();});
document.getElementById('meditationResumeSound').addEventListener('click',()=>{if(!meditation.running)return;const ok=startMeditationAudio();meditation.audioInterrupted=!ok;meditationStatus.textContent=ok?'กำลังนั่งสมาธิ':'เล่นเสียงไม่ได้ ลองอีกครั้ง';renderMeditation();});
setInterval(renderMeditation,1000);
const uiIcons={play:'<path d="m9 5 11 7-11 7Z"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>'};
function uiIcon(name){return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(uiIcons[name]||uiIcons.clock)+'</svg>';}
let uiDetailTaskId=null,uiUndo=null,uiUndoTimer=null;
const uiTaskDialog=document.createElement('dialog');
uiTaskDialog.id='uiTaskDetail';uiTaskDialog.className='ui-dialog';uiTaskDialog.setAttribute('aria-labelledby','uiDetailTitle');
document.body.appendChild(uiTaskDialog);
const uiUndoBar=document.createElement('div');uiUndoBar.id='uiUndoBar';uiUndoBar.hidden=true;uiUndoBar.setAttribute('role','status');document.body.appendChild(uiUndoBar);

function uiTaskRow(task,meta=[]){
  const id=esc(String(task.id)),title=esc(String(task.title||''));
  return `<article class="pm-task-row${task.completed?' is-done':''}"><button type="button" class="pm-task-check" data-task-action="toggle" data-task-id="${id}" aria-label="${task.completed?'ทำเครื่องหมายว่ายังไม่เสร็จ':'ทำเสร็จแล้ว'} ${title}" aria-pressed="${!!task.completed}">${uiIcon('check')}</button><button type="button" class="pm-task-main ui-task-open" data-ui-task="${id}"><span class="pm-task-title">${title}</span><span class="pm-task-meta">${meta.join('')}</span></button><button type="button" class="ui-icon-button" data-ui-task="${id}" aria-label="รายละเอียดและตัวเลือก ${title}">⋯</button></article>`;
}
function uiRenderFocusPicker(){
 const select=document.getElementById('momentaFocusTask'),button=document.getElementById('momentaFocusOpen');if(!select||!button)return;
 const available=tasks.filter(t=>!t.completed),previous=select.value,options=available.length?available.map(t=>`<option value="${esc(String(t.id))}">${esc(String(t.title))}</option>`).join(''):'<option value="">ยังไม่มีงานที่ต้องทำ</option>';
 if(select.innerHTML!==options){select.innerHTML=options;if(available.some(t=>String(t.id)===previous))select.value=previous;}
 button.dataset.uiTask=select.value;button.disabled=!select.value;
 document.getElementById('momentaFocusHint').textContent=available.length?'Pomodoro อยู่ในรายละเอียดงาน เลือกเวลาและเสียงได้ก่อนเริ่ม':'ยังไม่มีงานที่ต้องทำ ไปเพิ่มงานก่อนเริ่ม Pomodoro';
 document.getElementById('momentaFocusTasks').textContent=available.length?'ดูงานทั้งหมด':'ไปเพิ่มงาน';
}
function uiRenderWidgetPreview(){
 const containers=[document.getElementById('momentaWidgetPreview'),document.getElementById('momentaWidgetPage')].filter(Boolean);if(!containers.length)return;
 const next=tasks.filter(t=>!t.completed).slice().sort((a,b)=>(taskTargetDate(a)||'9999').localeCompare(taskTargetDate(b)||'9999'))[0],goal=goals.find(g=>g.mode!=='habit'),rounds=Number(stats.byDate?.[todayStr()]?.focusRounds)||0;
 const html=`<button type="button" data-ui-route="tasks"><small>งานถัดไป</small><strong>${next?esc(next.title):'ยังไม่มีงาน'}</strong><small>${next&&taskTargetDate(next)?formatShortDate(taskTargetDate(next)):'เปิดรายการงาน'}</small></button><button type="button" data-ui-route="progress"><small>โฟกัสวันนี้</small><strong>${rounds} รอบ</strong><small>ดูความคืบหน้า</small></button><button type="button" data-ui-route="goals"><small>เป้าหมาย</small><strong>${goal?esc(goal.title):'ยังไม่มีเป้าหมาย'}</strong><small>${goal?`${Math.max(0,Math.min(100,Number(goalProgress(goal.id).pct)||0))}%`:'เปิดโปรเจกต์'}</small></button><button type="button" data-ui-route="money"><small>การเงิน</small><strong>••••••</strong><small>ซ่อนยอด · แตะเพื่อดู</small></button>`;
 containers.forEach(container=>{if(container.innerHTML!==html)container.innerHTML=html;});
}
document.getElementById('momentaFocusTask').addEventListener('change',uiRenderFocusPicker);
document.querySelector('.momenta-more').addEventListener('click',event=>{if(event.target.closest('[data-ui-route]'))document.querySelector('.momenta-more').open=false;});
function uiRenderToday(){
  uiRenderFocusPicker();
  uiRenderWidgetPreview();
  const date=viewDate,dayTasks=tasks.filter(t=>(t.scheduleDate||t.dueDate)===date),open=dayTasks.filter(t=>!t.completed),done=dayTasks.filter(t=>t.completed).length;
  const percent=dayTasks.length?Math.round(done/dayTasks.length*100):0,rounds=Number(stats.byDate?.[date]?.focusRounds)||0;
  const month=monthKey(date),monthly=expenses.filter(e=>monthKey(e.date)===month),income=monthly.filter(e=>e.type==='income').reduce((n,e)=>n+Number(e.amount||0),0),spent=monthly.filter(e=>e.type==='expense').reduce((n,e)=>n+Number(e.amount||0),0);
  const summary=document.getElementById('momentaTodaySummary');
  const summaryContent=`<div class="momenta-progress-card"><p>ความคืบหน้าวันนี้</p><div class="momenta-progress-content"><div class="momenta-progress-ring" aria-hidden="true">${percent}%</div><div><strong>${done} จาก ${dayTasks.length} งาน</strong><small>เหลืออีก ${open.length} งาน</small><progress max="${dayTasks.length||1}" value="${done}" aria-label="งานวันนี้เสร็จ ${done} จาก ${dayTasks.length} งาน"></progress></div></div></div><div class="momenta-stat-grid"><div><strong>${rounds} รอบ</strong><small>โฟกัสวันนี้</small></div><div><strong>${open.length} งาน</strong><small>ยังไม่เสร็จ</small></div><div><strong>฿${(income-spent).toLocaleString('th-TH')}</strong><small>สุทธิเดือนนี้</small></div></div>`;
  if(summary&&summary.innerHTML!==summaryContent)summary.innerHTML=summaryContent;
  const overdue=date===todayStr()?tasks.filter(t=>!t.completed&&taskTargetDate(t)&&taskTargetDate(t)<date):[];
  const rank={high:0,normal:1,low:2},priority=[...open,...overdue].sort((a,b)=>(rank[a.priority]??1)-(rank[b.priority]??1));
  const schedule=blocks.filter(b=>b.date===date),active=date===todayStr()?getActiveBlock():null;
  document.getElementById('uiTodayDate').textContent=new Date(date+'T00:00:00').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('uiTodaySummary').textContent=open.length?`มี ${open.length} งานให้ค่อย ๆ ทำวันนี้`:done?'งานวันนี้เสร็จแล้ว ให้เวลากับตัวเองได้เลย':'เริ่มจากสิ่งสำคัญทีละอย่าง';
  const card=document.getElementById('uiFocusCard'),candidate=priority[0];
  let hero;
  if(active&&!active.completed){
    const linked=tasks.find(t=>t.id===active.taskId),ts=timerState[active.id];
    hero=`<div class="ui-focus-top"><span>${uiIcon('clock')} ${ts?'กำลังโฟกัส':'ถึงเวลาของงานนี้'}</span><span>${active.start} – ${active.end}</span></div><h2>${esc(blockDisplayTitle(active))}</h2><p>${ts?'พักหน้าจออื่น แล้วกลับมาอยู่กับงานตรงหน้า':'เริ่มจับเวลา หรือเปิดรายละเอียดเพื่อจัดการงาน'}</p><button type="button" class="ui-focus-primary" data-ui-focus-block="${esc(active.id)}">${uiIcon('play')}${ts?'กลับไปจับเวลา':'เริ่มโฟกัส'}</button>${linked?`<button type="button" class="ui-focus-secondary" data-ui-task="${esc(linked.id)}">รายละเอียดงาน</button>`:''}`;
  }else if(candidate){
    hero=`<div class="ui-focus-top"><span>${uiIcon('target')} งานถัดไปของคุณ</span><span>ทีละหนึ่งงาน</span></div><h2>${esc(candidate.title)}</h2><p>${candidate.dueDate&&candidate.dueDate<todayStr()?'เลยกำหนดแล้ว ลองแบ่งเวลาสั้น ๆ เพื่อเริ่มต่อ':'เลือกช่วงโฟกัสที่เหมาะกับคุณ แล้วเริ่มได้เลย'}</p><button type="button" class="ui-focus-primary" data-ui-start-task="${esc(candidate.id)}">${uiIcon('play')}เริ่มโฟกัส 25 นาที</button><button type="button" class="ui-focus-secondary" data-ui-task="${esc(candidate.id)}">รายละเอียดงาน</button>`;
  }else{
    hero=`<div class="ui-focus-top"><span>${uiIcon('target')} พื้นที่สำหรับวันของคุณ</span></div><h2>${done?'ทำได้ดีแล้ววันนี้':'วันนี้อยากทำอะไรให้สำเร็จ?'}</h2><p>${done?'เพิ่มงานใหม่ หรือดูตารางเวลาที่วางไว้':'เริ่มจากหนึ่งงานเล็ก ๆ แล้วค่อยจัดเวลาให้มัน'}</p><button type="button" class="ui-focus-primary" data-ui-add>${uiIcon('plus')}${tasks.length?'เพิ่มงานวันนี้':'เพิ่มงานแรก'}</button>`;
  }
  // Keep keyboard focus stable while the existing clock refreshes Today.
  if(card.innerHTML!==hero)card.innerHTML=hero;
  const rows=priority.slice(0,3).map(t=>uiTaskRow(t,t.dueDate&&t.dueDate<date?['<span class="pm-task-chip overdue">เลยกำหนด</span>']:t.priority==='high'?['<span class="pm-task-chip priority-high">สำคัญสูง</span>']:[])).join('');
  const content=`<div class="ui-section-heading"><h2>งานวันนี้</h2><button type="button" class="btn-primary momenta-add-task" data-ui-add>${uiIcon('plus')} เพิ่มงาน</button></div>${rows||`<div class="ui-empty-small"><p>${done?'งานวันนี้เสร็จครบแล้ว':'ยังไม่มีงานสำหรับวันนี้'}</p></div>`}<button type="button" class="ui-text-button" data-ui-route="tasks">ดูงานทั้งหมด ${uiIcon('arrow')}</button><div class="ui-completion"><span>เสร็จแล้ว <strong>${done}/${dayTasks.length}</strong> งาน</span><progress max="${dayTasks.length||1}" value="${done}" aria-label="งานวันนี้ที่ทำเสร็จ"></progress></div>`;
  const overview=document.getElementById('todayOverview');if(overview.innerHTML!==content)overview.innerHTML=content;
  const plan=document.getElementById('pmDashboard');plan.innerHTML=`<div class="pm-dashboard-head"><div><p class="pm-dashboard-title">งานทั้งหมด</p><p class="pm-dashboard-note">วันนี้ ${open.length} งาน${overdue.length?' · เลยกำหนด '+overdue.length+' งาน':''}</p></div></div>`;
}
function uiOpenTask(id){
  const task=tasks.find(t=>t.id===id);if(!task)return;
  uiDetailTaskId=id;
  const goal=goals.find(g=>g.id===task.goalId),sessions=blocks.filter(b=>b.taskId===id).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  const measure=window.MomentaMetrics?.taskProgress(task)||{kind:'binary',pct:task.completed?100:0,value:task.completed?1:0,target:1,unit:''};
  const measureLabel=measure.kind==='binary'?(task.completed?'ยืนยันว่าทำเสร็จแล้ว':'ยังไม่ได้ยืนยันงานเสร็จ'): `${measure.value} / ${measure.target} ${measure.unit} · ${measure.pct}%`;
  uiTaskDialog.innerHTML=`<header class="ui-dialog-head"><span>รายละเอียดงาน</span><button type="button" class="ui-icon-button" data-ui-close aria-label="ปิดรายละเอียดงาน">✕</button></header><div class="ui-dialog-body"><span class="ui-status-chip">${task.completed?'เสร็จแล้ว':'ยังไม่เสร็จ'}</span><h2 id="uiDetailTitle">${esc(task.title)}</h2><dl class="ui-task-facts"><div><dt>วางแผนทำ</dt><dd>${task.scheduleDate?formatShortDate(task.scheduleDate):'ยังไม่ได้กำหนด'}</dd></div><div><dt>กำหนดส่ง</dt><dd>${task.dueDate?formatShortDate(task.dueDate):'ไม่มีกำหนด'}</dd></div><div><dt>ความสำคัญ</dt><dd>${{high:'สูง',normal:'ปกติ',low:'ต่ำ'}[task.priority]||'ปกติ'}</dd></div>${goal?`<div><dt>เป้าหมาย</dt><dd>${esc(goal.title)}</dd></div>`:''}</dl><section class="ui-task-measure" aria-label="ตัววัดความคืบหน้างาน"><div><strong>${measure.kind==='binary'?'สถานะงาน':'ความคืบหน้าตามตัววัด'}</strong><span>${esc(measureLabel)}</span></div><progress max="100" value="${measure.pct}" aria-label="ความคืบหน้างาน ${measure.pct}%"></progress>${measure.warning?`<small role="status">${esc(measure.warning)}</small>`:''}</section><section class="ui-task-pomo"><div class="ui-section-heading"><h3>${uiIcon('clock')} Pomodoro</h3><span>โฟกัสทีละช่วง</span></div><p>โฟกัส 25 นาที พัก 5 นาที ครบเวลาแล้วคุณเป็นคนเลือกว่างานเสร็จหรือยัง</p><button type="button" class="btn-primary" data-ui-start-task="${esc(id)}" ${task.completed?'disabled':''}>${uiIcon('play')}เริ่มโฟกัส</button><details><summary>เลือกโหมดและเสียง</summary><label for="uiPomoMode">โหมดโฟกัส</label><select id="uiPomoMode"><option value="classic">Classic 25 / 5 นาที</option><option value="sprint">Sprint 15 / 3 นาที</option><option value="flow">Flow 45 / 10 นาที</option><option value="deep">Deep work 50 / 10 นาที</option><option value="long">Long focus 90 / 15 นาที</option>${pomoCustomModes.map(m=>`<option value="${esc(m.id)}">${esc(m.name)} ${m.focus} / ${m.break} นาที</option>`).join('')}</select><label for="uiPomoSound">เสียงแจ้งเตือน</label><select id="uiPomoSound">${Object.entries(POMO_SOUND_LABELS).map(([value,label])=>`<option value="${value}" ${pomoSettings.sound===value?'selected':''}>${label}</option>`).join('')}</select><label for="uiPomoAmbient">เสียงพื้นหลังระหว่างโฟกัส</label><select id="uiPomoAmbient"><option value="silent" >ปิดเสียง</option><option value="rain">ฝนสังเคราะห์</option><option value="waves">คลื่นสังเคราะห์</option><option value="nature">ธรรมชาติสังเคราะห์</option></select><button type="button" class="ui-text-button" data-ui-pomo-settings>ตั้งเวลาเองและฟังเสียงตัวอย่าง</button></details></section><section class="ui-task-sessions"><div class="ui-section-heading"><h3>ช่วงเวลาที่จัดไว้</h3><button type="button" class="ui-text-button" data-ui-schedule="${esc(id)}">จัดเวลา</button></div>${sessions.length?sessions.map(b=>`<button type="button" class="ui-session-row" data-ui-edit-block="${esc(b.id)}"><span>${formatShortDate(b.date)}<small>${b.start} – ${b.end}</small></span><span>${b.completed?'เสร็จแล้ว':modeLabel(b)||'ไม่ใช้ตัวจับเวลา'} ›</span></button>`).join(''):'<p>ยังไม่ได้จัดเวลา เลือกวันและเวลาที่เหมาะกับคุณได้</p>'}</section><p id="uiFocusError" class="ui-field-error" role="alert" hidden></p><details class="ui-task-more"><summary>ตัวเลือกงาน</summary><button type="button" class="ui-link-row" data-ui-edit-task="${esc(id)}">แก้ไขงาน</button><button type="button" class="ui-link-row ui-danger" data-ui-delete-task="${esc(id)}">ลบงาน</button></details></div><footer class="ui-dialog-foot"><button type="button" class="btn-primary" data-ui-complete="${esc(id)}">${uiIcon('check')}${task.completed?'ทำเครื่องหมายว่ายังไม่เสร็จ':'ทำเสร็จแล้ว'}</button></footer>`;
  const ambientSelect=document.getElementById('uiPomoAmbient');if(ambientSelect)ambientSelect.value=pomoSettings.ambient||'silent';
  if(!uiTaskDialog.open)uiTaskDialog.showModal();
}
function uiFocusError(message){
  if(uiTaskDialog.open){const el=document.getElementById('uiFocusError');el.textContent=message;el.hidden=false;el.scrollIntoView({block:'nearest'});}else showToast(message);
}
function uiFocusTask(id){
  const task=tasks.find(t=>t.id===id);if(!task||task.completed)return;
  const active=getActiveBlock();
  if(active&&active.taskId!==id){uiFocusError(`ขณะนี้มี “${blockDisplayTitle(active)}” เวลา ${active.start}–${active.end} เปิดปฏิทินเพื่อเลือกเวลาใหม่`);return;}
  const mode=document.getElementById('uiPomoMode')?.value||'classic',mm=MODES[mode]||pomoCustomModes.find(m=>m.id===mode)||MODES.classic;
  const start=currentNowMin(),end=start+Number(mm.focus)+Number(mm.break);
  if(end>=1440){uiFocusError('ช่วงโฟกัสนี้ข้ามวัน โปรดจัดเวลาเริ่มในวันถัดไป');return;}
  let block=active;
  if(!block){
    const conflict=blocks.find(b=>b.date===todayStr()&&toMinutes(b.start)<end&&toMinutes(b.end)>start);
    if(conflict){uiFocusError(`ช่วงนี้ชนกับ “${blockDisplayTitle(conflict)}” ${conflict.start}–${conflict.end} เลือกจัดเวลาในรายละเอียดงานได้`);return;}
    block={id:uid(),taskId:id,title:task.title,date:todayStr(),start:minutesToHM(start),end:minutesToHM(end),goalId:task.goalId||'',mode,notify:true,details:''};
    blocks.push(block);
  }else if(!modeMinutes(block)){block.mode=mode;}
  if(!task.scheduleDate)task.scheduleDate=todayStr();
  if(uiTaskDialog.open)uiTaskDialog.close();
  saveState();startFocus(block.id);document.getElementById('pomoFullOverlay').classList.add('show');
  updatePomoDisplays(block,timerState[block.id],modeMinutes(block));
  renderAll();
}
function uiDeleteTask(task){
  if(uiTaskDialog.open)uiTaskDialog.close();
  const linked=blocks.filter(b=>b.taskId===task.id).map(b=>({id:b.id,taskId:b.taskId,title:b.title}));
  const index=tasks.findIndex(t=>t.id===task.id);
  blocks=unlinkTaskFromBlocks(blocks,task.id,task.title);tasks=tasks.filter(t=>t.id!==task.id);
  uiUndo={task:{...task},index,linked};clearTimeout(uiUndoTimer);
  uiUndoBar.innerHTML='<span>ลบงานแล้ว ช่วงเวลายังคงอยู่</span><button type="button" id="uiUndoButton">เลิกทำ</button>';uiUndoBar.hidden=false;
  uiUndoTimer=setTimeout(()=>{uiUndo=null;uiUndoBar.hidden=true;},12000);
  saveState();renderAll();
}
uiUndoBar.addEventListener('click',e=>{
  if(!e.target.closest('#uiUndoButton')||!uiUndo)return;
  if(!tasks.some(t=>t.id===uiUndo.task.id))tasks.splice(Math.min(uiUndo.index,tasks.length),0,uiUndo.task);
  for(const old of uiUndo.linked){const block=blocks.find(b=>b.id===old.id);if(block&&!block.taskId){block.taskId=old.taskId;block.title=old.title;}}
  clearTimeout(uiUndoTimer);uiUndo=null;uiUndoBar.hidden=true;saveState();renderAll();showToast('คืนงานแล้ว');
});
function uiSaveStatus(status){
  const labels={local:'บันทึกในเครื่องแล้ว',saving:'กำลังซิงค์',synced:'ซิงค์แล้ว',error:'บันทึกไม่สำเร็จ ตรวจการเชื่อมต่อหรือส่งออกข้อมูลสำรอง'};
  const el=document.getElementById('uiSaveStatus');if(el){el.textContent=labels[status]||labels.local;el.dataset.status=status;}
}
function uiBlockError(message){
  const el=document.getElementById('uiBlockError');el.textContent=message;el.hidden=false;
  el.scrollIntoView({block:'nearest'});
}
const uiBlockWarning=document.createElement('div');uiBlockWarning.className='ui-block-warning';
uiBlockWarning.innerHTML='<p id="uiBlockError" class="ui-field-error" role="alert" hidden></p><label id="uiOverlapLabel" class="ui-overlap-choice" hidden><input type="checkbox" id="uiAllowOverlap">ฉันต้องการจัดเวลาซ้อนกัน</label>';
document.querySelector('#blockOverlay .modal-body').prepend(uiBlockWarning);
document.getElementById('saveBtn').addEventListener('click',e=>{
  const start=document.getElementById('f_start').value,end=document.getElementById('f_end').value,date=document.getElementById('f_date').value;
  if(!start||!end||!date||toMinutes(end)<=toMinutes(start))return;
  const dates=[date];
  if(!editingId&&document.getElementById('f_repeatEnabled').checked){
    dates.length=0;const until=document.getElementById('f_repeatUntil').value;
    for(let day=date,guard=0;until&&day<=until&&guard<366;day=addDays(day,1),guard++){
      const dow=new Date(day+'T00:00:00').getDay();
      if(pickedRepeatPattern==='daily'||(pickedRepeatPattern==='weekdays'&&dow>=1&&dow<=5)||(pickedRepeatPattern==='custom'&&pickedRepeatDays.has(dow)))dates.push(day);
    }
  }
  const collision=blocks.find(b=>b.id!==editingId&&dates.includes(b.date)&&toMinutes(b.start)<toMinutes(end)&&toMinutes(b.end)>toMinutes(start));
  if(collision&&!document.getElementById('uiAllowOverlap').checked){
    e.stopImmediatePropagation();
    uiBlockError(`เวลาชนกับ “${blockDisplayTitle(collision)}” วันที่ ${formatShortDate(collision.date)} ${collision.start}–${collision.end} โปรดเปลี่ยนเวลา หรือยืนยันด้านล่าง`);
    document.getElementById('uiOverlapLabel').hidden=false;
  }
},true);
function uiResetBlockWarning(){document.getElementById('uiBlockError').hidden=true;document.getElementById('uiOverlapLabel').hidden=true;document.getElementById('uiAllowOverlap').checked=false;}
document.getElementById('blockOverlay').addEventListener('input',e=>{if(e.target.id!=='uiAllowOverlap')uiResetBlockWarning();});
new MutationObserver(()=>{if(blockOverlay.classList.contains('show'))uiResetBlockWarning();}).observe(blockOverlay,{attributes:true,attributeFilter:['class']});
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-ui-route],[data-ui-profile],[data-ui-task],[data-ui-add],[data-ui-close],[data-ui-start-task],[data-ui-focus-block],[data-ui-schedule],[data-ui-edit-task],[data-ui-delete-task],[data-ui-complete],[data-ui-edit-block],[data-ui-pomo-settings]');if(!button)return;
  if(button.hasAttribute('data-ui-close')){uiTaskDialog.close();return;}
  if(button.dataset.uiRoute){if(uiTaskDialog.open)uiTaskDialog.close();openWorkspaceRoute(button.dataset.uiRoute);window.scrollTo({top:0});return;}
  if(button.hasAttribute('data-ui-profile')){document.getElementById('openProfileBtn').click();return;}
  if(button.hasAttribute('data-ui-add')){openTaskEditor(null,viewDate);return;}
  if(button.dataset.uiTask){uiOpenTask(button.dataset.uiTask);return;}
  if(button.dataset.uiStartTask){uiFocusTask(button.dataset.uiStartTask);return;}
  if(button.dataset.uiFocusBlock){const block=blocks.find(b=>b.id===button.dataset.uiFocusBlock);if(block){if(!modeMinutes(block)){block.mode='classic';saveState();}startFocus(block.id);document.getElementById('pomoFullOverlay').classList.add('show');updatePomoDisplays(block,timerState[block.id],modeMinutes(block));}return;}
  if(button.dataset.uiEditBlock){uiTaskDialog.close();openModal(blocks.find(b=>b.id===button.dataset.uiEditBlock));return;}
  if(button.dataset.uiSchedule){uiTaskDialog.close();const task=tasks.find(t=>t.id===button.dataset.uiSchedule);openModal(null,task.scheduleDate||todayStr(),task.id);document.getElementById('f_goalId').value=task.goalId||'';return;}
  if(button.dataset.uiEditTask){uiTaskDialog.close();openTaskEditor(tasks.find(t=>t.id===button.dataset.uiEditTask));return;}
  if(button.dataset.uiDeleteTask){uiDeleteTask(tasks.find(t=>t.id===button.dataset.uiDeleteTask));return;}
  if(button.dataset.uiComplete){const task=tasks.find(t=>t.id===button.dataset.uiComplete);task.completed=!task.completed;task.completedAt=task.completed?new Date().toISOString():'';uiTaskDialog.close();saveState();renderAll();showToast(task.completed?'ทำงานเสร็จแล้ว':'ย้ายกลับไปงานที่ยังไม่เสร็จ');return;}
  if(button.hasAttribute('data-ui-pomo-settings')){uiTaskDialog.close();openWorkspaceRoute('settings');document.querySelector('.pomo-settings-card').scrollIntoView({block:'start'});}
});
uiTaskDialog.addEventListener('click',e=>{if(e.target===uiTaskDialog){const rect=uiTaskDialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)uiTaskDialog.close();}});
uiTaskDialog.addEventListener('change',e=>{if(e.target.id==='uiPomoSound'){pomoSettings.sound=e.target.value;saveState({localOnly:true});renderPomoSoundSettings();}else if(e.target.id==='uiPomoAmbient'){pomoSettings.ambient=e.target.value;saveState({localOnly:true});const b=getActiveBlock();syncPomoAmbient(b,b&&timerState[b.id]);}});
// Existing sheets receive keyboard containment, Escape and focus restoration.
const uiSheets=[...document.querySelectorAll('.overlay,.day-modal-overlay,.pomo-full-overlay')];
const uiSheetFocus=new WeakMap();
for(const sheet of uiSheets){
  sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
  const heading=sheet.querySelector('h2,[id="pomoFullTitle"]');if(heading){if(!heading.id)heading.id=sheet.id+'Title';sheet.setAttribute('aria-labelledby',heading.id);}
  new MutationObserver(()=>{const shown=sheet.classList.contains('show');if(shown){uiSheetFocus.set(sheet,document.activeElement);const focus=sheet.querySelector('input:not([type="hidden"]),button,select,textarea');focus?.focus();}else{const previous=uiSheetFocus.get(sheet);if(previous?.isConnected)previous.focus();}}).observe(sheet,{attributes:true,attributeFilter:['class']});
}
document.addEventListener('keydown',e=>{
  if(uiTaskDialog.open)return;
  const sheet=uiSheets.filter(s=>s.classList.contains('show')).at(-1);if(!sheet)return;
  if(e.key==='Escape'){sheet.classList.remove('show');e.preventDefault();return;}
  if(e.key!=='Tab')return;
  const stops=[...sheet.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
  const first=stops[0],last=stops.at(-1);if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}
});
document.getElementById('taskTitleInput').setAttribute('aria-describedby','taskTitleError');
document.getElementById('taskTitleInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('taskSaveBtn').click();}});
document.getElementById('taskTitleInput').addEventListener('input',()=>{document.getElementById('taskTitleError').hidden=true;document.getElementById('taskTitleInput').removeAttribute('aria-invalid');});
const uiStatus=document.createElement('p');uiStatus.id='uiSaveStatus';uiStatus.className='ui-save-status';uiStatus.setAttribute('role','status');document.getElementById('page-settings').querySelector('.workspace-intro').after(uiStatus);uiSaveStatus('local');
window.addEventListener('offline',()=>{uiStatus.textContent='ออฟไลน์ ใช้ข้อมูลในเครื่องได้';});
window.addEventListener('online',()=>{uiSaveStatus('local');if(pendingLocalChange)queueCloudPush();});
document.querySelectorAll('.tab-bar svg,.settings-icon').forEach(el=>el.setAttribute('aria-hidden','true'));
document.querySelector('.tab-bar').setAttribute('aria-label','เมนูหลัก');
document.getElementById('ttsToast').setAttribute('role','status');
uiRenderToday();renderTasks();
