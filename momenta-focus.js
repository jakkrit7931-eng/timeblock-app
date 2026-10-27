(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentaFocus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function focusedSeconds({ startedAt, endedAt, pausedDurationMs = 0 }) {
    const start = typeof startedAt === 'number' ? startedAt : Date.parse(startedAt);
    const end = typeof endedAt === 'number' ? endedAt : Date.parse(endedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
    return Math.max(0, Math.floor((end - start - Math.max(0, Number(pausedDurationMs) || 0)) / 1000));
  }
  function makeSession(input) {
    if (!input || !input.blockId || !input.startedAt || !input.endedAt || !['completed', 'skipped', 'cancelled'].includes(input.endReason)) throw new TypeError('Invalid focus session');
    const seconds = Math.max(0, Math.floor(Number(input.focusedSeconds) || 0));
    if (seconds <= 0) throw new TypeError('Invalid focus session duration');
    const start = typeof input.startedAt === 'number' ? new Date(input.startedAt).toISOString() : new Date(input.startedAt).toISOString();
    const end = typeof input.endedAt === 'number' ? new Date(input.endedAt).toISOString() : new Date(input.endedAt).toISOString();
    return { id: `${String(input.blockId)}:${start}`, blockId: String(input.blockId), taskId: String(input.taskId || ''), goalId: String(input.goalId || ''), startedAt: start, endedAt: end, focusedSeconds: seconds, endReason: input.endReason };
  }
  function upsertSession(sessions, session) {
    const rows = Array.isArray(sessions) ? sessions.slice() : [];
    const index = rows.findIndex(row => String(row.id) === session.id);
    if (index < 0) rows.push(session); else rows[index] = session;
    return rows;
  }
  return { focusedSeconds, makeSession, upsertSession };
});
