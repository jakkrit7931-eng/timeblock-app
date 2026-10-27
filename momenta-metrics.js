(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentaMetrics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clampPercent = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

  function taskProgress(task) {
    const measure = task && task.measure && typeof task.measure === 'object' ? task.measure : { kind: 'binary' };
    const kind = ['binary', 'count', 'duration'].includes(measure.kind) ? measure.kind : 'binary';
    const completed = task?.completed === true;
    if (kind === 'binary') return { kind, pct: completed ? 100 : 0, value: completed ? 1 : 0, target: 1, unit: '', completed };
    const target = Number(measure.target), value = Math.max(0, Number(measure.value) || 0);
    if (!Number.isFinite(target) || target <= 0) return { kind, pct: 0, value, target: Number.isFinite(target) ? target : 0, unit: String(measure.unit || ''), completed, warning: 'กำหนดเป้าหมายที่มากกว่า 0 ก่อนคำนวณเปอร์เซ็นต์' };
    return { kind, pct: clampPercent(value / target * 100), value, target, unit: String(measure.unit || ''), completed };
  }

  function projectProgress(goal, tasks = [], blocks = [], focusSessions = []) {
    const subtasks = Array.isArray(goal?.subtasks) ? goal.subtasks : [];
    const linkedTasks = tasks.filter(task => String(task.goalId || '') === String(goal?.id || ''));
    const source = goal?.progressSource || (subtasks.length ? 'subtasks' : 'tasks');
    if (source === 'subtasks') {
      const weighted = subtasks.filter(item => Number.isFinite(Number(item.weight)) && item.weight !== undefined);
      if (weighted.length) {
        const total = weighted.reduce((sum, item) => sum + Number(item.weight), 0);
        const completed = weighted.filter(item => item.done === true).reduce((sum, item) => sum + Number(item.weight), 0);
        return { pct: clampPercent(completed), source, sourceLabel: 'ขั้นย่อยถ่วงน้ำหนัก', done: subtasks.filter(item => item.done === true).length, target: subtasks.length, warning: Math.abs(total - 100) > 0.001 ? `น้ำหนักขั้นย่อยรวม ${total}% ควรปรับเป็น 100%` : '' };
      }
      const done = subtasks.filter(item => item.done === true).length;
      return { pct: subtasks.length ? clampPercent(done / subtasks.length * 100) : 0, source, sourceLabel: 'ขั้นย่อย', done, target: subtasks.length, warning: subtasks.length ? '' : 'เพิ่มขั้นย่อยหรือเลือกคำนวณจากงานที่ผูกไว้' };
    }
    if (source === 'tasks') {
      const done = linkedTasks.filter(task => task.completed === true).length;
      const pct = linkedTasks.length ? clampPercent(linkedTasks.reduce((sum, task) => sum + taskProgress(task).pct, 0) / linkedTasks.length) : 0;
      return { pct, source, sourceLabel: 'งานที่ผูกกับโปรเจกต์', done, target: linkedTasks.length, warning: linkedTasks.length ? '' : 'ยังไม่มีงานที่ผูกกับโปรเจกต์นี้' };
    }
    if (source === 'time') {
      const target = Math.max(0, Number(goal?.targetHours) || 0);
      const taskIds = new Set(linkedTasks.map(task => String(task.id)));
      const blockIds = new Set(blocks.filter(block => String(block.goalId || '') === String(goal?.id || '')).map(block => String(block.id)));
      const seconds = focusSessions.filter(session => taskIds.has(String(session.taskId || '')) || blockIds.has(String(session.blockId || '')) || String(session.goalId || '') === String(goal?.id || '')).reduce((sum, session) => sum + Math.max(0, Number(session.focusedSeconds) || 0), 0);
      const hours = Math.round(seconds / 3600 * 100) / 100;
      return { pct: target ? clampPercent(hours / target * 100) : 0, source, sourceLabel: 'เวลาที่โฟกัสจริง', done: hours, target, unit: 'ชม.', warning: !target ? 'กำหนดเวลาเป้าหมายก่อน' : seconds > 0 ? '' : 'เริ่มบันทึกช่วงโฟกัสเพื่อให้ตัวเลขสะท้อนเวลาจริง' };
    }
    if (source === 'count') {
      const target = Math.max(0, Number(goal?.targetCount) || 0);
      const done = linkedTasks.length
        ? linkedTasks.reduce((sum, task) => sum + (task.measure?.kind === 'count' ? Math.max(0, Number(task.measure.value) || 0) : (task.completed ? 1 : 0)), 0)
        : blocks.filter(block => String(block.goalId || '') === String(goal?.id || '') && block.completed === true).reduce((sum, block) => sum + Math.max(0, Number(block.countAchieved ?? block.countAmount) || 0), 0);
      return { pct: target ? clampPercent(done / target * 100) : 0, source, sourceLabel: 'จำนวนที่บันทึกในช่วงงาน', done, target, unit: String(goal?.unit || ''), warning: !target ? 'กำหนดเป้าหมายจำนวนก่อน' : '' };
    }
    return { pct: 0, source: 'subtasks', sourceLabel: 'ขั้นย่อย', done: 0, target: 0, warning: 'เลือกวิธีวัดความคืบหน้าใหม่' };
  }

  return { taskProgress, projectProgress };
});
