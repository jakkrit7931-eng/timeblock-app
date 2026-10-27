(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentaDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CURRENT_SCHEMA_VERSION = 3;
  const ARRAY_FIELDS = ['blocks', 'goals', 'tasks', 'events', 'expenses', 'accounts', 'investmentAssets', 'recurringBills', 'focusSessions', 'pomoCustomModes'];
  const OBJECT_FIELDS = ['timerState', 'stats', 'journal', 'budgets', 'monthlyBudgets', 'pomoSettings', 'farmStates', 'syncMeta'];

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function validateState(input) {
    const errors = [];
    const warnings = [];
    if (!isRecord(input)) return { ok: false, errors: ['state ต้องเป็น object'], warnings };

    for (const key of ARRAY_FIELDS) {
      if (input[key] !== undefined && !Array.isArray(input[key])) errors.push(`${key} ต้องเป็น array`);
      if (!Array.isArray(input[key])) continue;
      const seen = new Set();
      input[key].forEach((row, index) => {
        if (!isRecord(row)) {
          errors.push(`${key}[${index}] ต้องเป็น object`);
          return;
        }
        if (row.id !== undefined && (typeof row.id !== 'string' || !row.id.trim())) errors.push(`${key}[${index}].id ไม่ถูกต้อง`);
        if (row.id && seen.has(row.id)) errors.push(`${key} มี id ซ้ำ: ${row.id}`);
        if (row.id) seen.add(row.id);
      });
    }
    for (const key of OBJECT_FIELDS) {
      if (input[key] !== undefined && !isRecord(input[key])) errors.push(`${key} ต้องเป็น object`);
    }
    if (input.schemaVersion !== undefined && (!Number.isInteger(Number(input.schemaVersion)) || Number(input.schemaVersion) < 1)) errors.push('schemaVersion ไม่ถูกต้อง');

    for (const goal of Array.isArray(input.goals) ? input.goals : []) {
      const subtasks = Array.isArray(goal.subtasks) ? goal.subtasks : [];
      const weighted = subtasks.filter(row => row && row.weight !== undefined && Number.isFinite(Number(row.weight)));
      if (weighted.length && Math.abs(weighted.reduce((sum, row) => sum + Number(row.weight), 0) - 100) > 0.001) {
        warnings.push(`เป้าหมาย ${goal.title || goal.id || ''} มีน้ำหนักขั้นย่อยรวม ${weighted.reduce((sum, row) => sum + Number(row.weight), 0)}%`);
      }
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function migrateState(input) {
    if (!isRecord(input)) throw new TypeError('state ต้องเป็น object');
    const state = clone(input);
    const oldVersion = state.schemaVersion === undefined ? 1 : Number(state.schemaVersion);
    if (!Number.isInteger(oldVersion) || oldVersion < 1) throw new TypeError('schemaVersion ไม่ถูกต้อง');
    if (oldVersion > CURRENT_SCHEMA_VERSION) throw new RangeError(`ข้อมูลรุ่น ${oldVersion} ใหม่กว่ารุ่นที่แอปรองรับ`);

    for (const key of ['blocks', 'goals', 'tasks', 'events', 'expenses', 'accounts', 'pomoCustomModes']) {
      if (state[key] === undefined) state[key] = [];
    }
    for (const key of ['timerState', 'journal', 'budgets']) {
      if (state[key] === undefined) state[key] = {};
    }
    if (state.stats === undefined) state.stats = { byDate: {} };
    if (state.investmentAssets === undefined) state.investmentAssets = [];
    if (state.monthlyBudgets === undefined) state.monthlyBudgets = {};
    if (state.recurringBills === undefined) state.recurringBills = [];
    if (state.focusSessions === undefined) state.focusSessions = [];
    if (state.farmStates === undefined) state.farmStates = {};
    if (state.syncMeta === undefined) state.syncMeta = {};
    if (state.pomoSettings === undefined) state.pomoSettings = {};
    state.schemaVersion = CURRENT_SCHEMA_VERSION;

    const report = validateState(state);
    if (!report.ok) throw new TypeError(report.errors.join('; '));
    return { state, warnings: report.warnings, fromVersion: oldVersion, toVersion: CURRENT_SCHEMA_VERSION, changed: oldVersion !== CURRENT_SCHEMA_VERSION };
  }

  function parseStoredState(raw) {
    if (typeof raw !== 'string') return { ok: false, error: 'ข้อมูลต้นทางไม่ใช่ข้อความ', raw };
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, error: `JSON เสียรูปแบบ: ${error.message}`, raw };
    }
    try {
      const migrated = migrateState(parsed);
      return { ok: true, raw, state: migrated.state, warnings: migrated.warnings, fromVersion: migrated.fromVersion, toVersion: migrated.toVersion, needsMigration: migrated.changed || parsed.schemaVersion !== CURRENT_SCHEMA_VERSION };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'อ่านข้อมูลไม่ได้', raw };
    }
  }

  return { CURRENT_SCHEMA_VERSION, validateState, migrateState, parseStoredState };
});
