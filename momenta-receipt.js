(function (root) {
  'use strict';
  const thaiDigits = text => String(text || '').replace(/[๐-๙]/g, c => String(c.charCodeAt(0) - 0x0e50));
  function extractCandidates(input) {
    const text = thaiDigits(input), amounts = [], dates = [];
    const amountPattern = /(?:จำนวนเงิน|ยอดโอน|ยอดสุทธิ|ยอดรวม|ยอดเงิน|รวมทั้งสิ้น|total|amount)[^\d\n]{0,25}(?:\n[^\d\n]{0,20})?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
    for (const match of text.matchAll(amountPattern)) {
      const value = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(value) && value > 0 && value < 1000000000 && !amounts.includes(value)) amounts.push(value);
    }
    const datePattern = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})\b/g;
    for (const match of text.matchAll(datePattern)) {
      const day = Number(match[1]), month = Number(match[2]); let year = Number(match[3]);
      if (year < 100) year += 2000;
      if (year >= 2500 && year <= 2600) year -= 543;
      const date = new Date(Date.UTC(year, month - 1, day));
      if (year >= 2000 && year <= 2100 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
        const iso = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        if (!dates.includes(iso)) dates.push(iso);
      }
    }
    return { amounts: amounts.slice(0, 8), dates: dates.slice(0, 8) };
  }
  if (typeof module === 'object' && module.exports) module.exports = { extractCandidates };
  if (!root?.document) return;
  let libraryPromise = null, workerPromise = null, activeScan = 0;
  function loadLibrary() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './vendor/tesseract/tesseract.min.js';
      script.onload = () => resolve(root.Tesseract);
      script.onerror = () => { libraryPromise = null; script.remove(); reject(new Error('โหลดตัวอ่านไม่ได้')); };
      document.head.appendChild(script);
    });
    return libraryPromise;
  }
  async function getWorker() {
    if (!workerPromise) workerPromise = (async () => {
      const api = await loadLibrary();
      const base = new URL('./vendor/tesseract/', location.href).href.replace(/\/$/, '');
      return api.createWorker('tha+eng', 1, { workerPath: `${base}/worker.min.js`, corePath: base, workerBlobURL: false });
    })().catch(error => { workerPromise = null; throw error; });
    return workerPromise;
  }
  function mount(containerId, prefix, overlayId) {
    const host = document.getElementById(containerId), overlay = document.getElementById(overlayId);
    if (!host || !overlay) return;
    host.innerHTML = `<details class="receipt-reader"><summary>อ่านสลิปหรือบิลจากภาพ</summary><p>ภาพอ่านบนเครื่อง ไฟล์ภาษาอาจต้องดาวน์โหลดครั้งแรก กรุณาตรวจข้อมูลก่อนบันทึก</p><div class="receipt-reader-actions"><button type="button" data-receipt-pick>เลือกรูป</button><button type="button" data-receipt-camera>ถ่ายรูป</button></div><input type="file" accept="image/*" data-receipt-file hidden><input type="file" accept="image/*" capture="environment" data-receipt-camera-file hidden><p data-receipt-status role="status"></p><div data-receipt-results></div></details>`;
    const status = host.querySelector('[data-receipt-status]'), results = host.querySelector('[data-receipt-results]');
    const pick = host.querySelector('[data-receipt-file]'), camera = host.querySelector('[data-receipt-camera-file]');
    host.querySelector('[data-receipt-pick]').addEventListener('click', () => pick.click());
    host.querySelector('[data-receipt-camera]').addEventListener('click', () => camera.click());
    function reset() { activeScan++; pick.value=''; camera.value=''; status.textContent=''; results.replaceChildren(); }
    new MutationObserver(() => { if (!overlay.classList.contains('show')) reset(); }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    async function scan(event) {
      const file = event.target.files?.[0]; if (!file) return;
      const token = ++activeScan; results.replaceChildren();
      if (file.size > 12000000) { status.textContent = 'รูปใหญ่เกิน 12 MB กรุณาเลือกรูปที่เล็กลง'; return; }
      status.textContent = 'กำลังโหลดตัวอ่านและอ่านข้อความ อาจใช้เวลาสักครู่ในครั้งแรก';
      try {
        const worker = await getWorker();
        if (token !== activeScan) return;
        status.textContent = 'กำลังอ่านข้อความจากภาพบนเครื่อง';
        const result = await worker.recognize(file);
        if (token !== activeScan || !overlay.classList.contains('show')) return;
        const text = String(result.data?.text || '').trim();
        const candidates = extractCandidates(text);
        status.textContent = text ? 'อ่านเสร็จแล้ว เลือกค่าที่ถูกต้องและตรวจอีกครั้งก่อนบันทึก' : 'อ่านไม่พบข้อความ ลองภาพที่ชัดขึ้นหรือกรอกเอง';
        function addChoices(label, values, field, format) {
          if (!values.length) return;
          const row = document.createElement('div'); row.className='receipt-reader-choices';
          const title=document.createElement('strong'); title.textContent=label; row.appendChild(title);
          values.forEach(value => { const button=document.createElement('button'); button.type='button'; button.textContent=format(value); button.addEventListener('click',()=>{document.getElementById(`${prefix}_${field}`).value=value; const details=document.getElementById(`${prefix}_${field}`).closest('details'); if(details)details.open=true; status.textContent='ใส่ค่าแล้ว กรุณาตรวจข้อมูลและบัญชีก่อนบันทึก';});row.appendChild(button); });
          results.appendChild(row);
        }
        addChoices('จำนวนเงินที่พบ', candidates.amounts, 'amount', value => `฿${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        addChoices('วันที่ที่พบ', candidates.dates, 'date', value => value);
        if (text) { const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre'); summary.textContent='ดูข้อความที่อ่านได้'; pre.textContent=text.slice(0, 6000);details.append(summary,pre);results.appendChild(details); }
        if (text && !candidates.amounts.length && !candidates.dates.length) status.textContent='อ่านข้อความได้ แต่ไม่มั่นใจยอดหรือวันที่ กรุณาดูข้อความและกรอกเอง';
      } catch (_) { if (token === activeScan) status.textContent='อ่านภาพไม่สำเร็จ ตรวจอินเทอร์เน็ตสำหรับดาวน์โหลดไฟล์ภาษาแล้วลองใหม่ หรือกรอกเอง'; }
      finally { event.target.value=''; }
    }
    pick.addEventListener('change',scan); camera.addEventListener('change',scan);
  }
  mount('expenseReceiptReader','exp','expenseOverlay');
  mount('incomeReceiptReader','inc','incomeOverlay');
})(typeof window !== 'undefined' ? window : globalThis);
