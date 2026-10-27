(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentaSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
  function canonical(value) {
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }
  function equal(a, b) { return canonical(a) === canonical(b); }
  function describe(path, base, local, remote) { return { path, base: clone(base), local: clone(local), remote: clone(remote) }; }

  function mergeConcurrentState(base, local, remote) {
    const conflicts = [];
    function mergeNode(path, oldValue, localValue, remoteValue) {
      if (equal(localValue, oldValue)) return clone(remoteValue);
      if (equal(remoteValue, oldValue)) return clone(localValue);
      if (equal(localValue, remoteValue)) return clone(localValue);
      if (record(oldValue) && record(localValue) && record(remoteValue)) {
        const result = {};
        const keys = new Set([...Object.keys(oldValue), ...Object.keys(localValue), ...Object.keys(remoteValue)]);
        for (const key of keys) {
          const child = mergeNode(path ? `${path}.${key}` : key, oldValue[key], localValue[key], remoteValue[key]);
          if (child !== undefined) result[key] = child;
        }
        return result;
      }
      if (Array.isArray(oldValue) && Array.isArray(localValue) && Array.isArray(remoteValue)) {
        const canKey = arrays => arrays.every(item => record(item) && typeof item.id === 'string' && item.id.length > 0);
        if (canKey([...(oldValue || []), ...(localValue || []), ...(remoteValue || [])])) {
          const oldMap = new Map(oldValue.map(item => [item.id, item]));
          const localMap = new Map(localValue.map(item => [item.id, item]));
          const remoteMap = new Map(remoteValue.map(item => [item.id, item]));
          if ([oldMap.size !== oldValue.length, localMap.size !== localValue.length, remoteMap.size !== remoteValue.length].some(Boolean)) {
            conflicts.push(describe(path, oldValue, localValue, remoteValue));
            return clone(localValue);
          }
          const ids = new Set([...oldMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
          const mergedById = new Map();
          for (const id of ids) {
            const item = mergeNode(`${path}[${id}]`, oldMap.get(id), localMap.get(id), remoteMap.get(id));
            if (item !== undefined) mergedById.set(id, item);
          }
          const order = [];
          for (const id of [...localMap.keys(), ...remoteMap.keys()]) if (mergedById.has(id) && !order.includes(id)) order.push(id);
          return order.map(id => mergedById.get(id));
        }
      }
      conflicts.push(describe(path || '(root)', oldValue, localValue, remoteValue));
      return clone(localValue);
    }
    const state = mergeNode('', base, local, remote);
    return { ok: conflicts.length === 0, state, conflicts };
  }

  function scopedStateKey(uid) {
    if (typeof uid !== 'string' || !uid.trim()) throw new TypeError('Firebase uid is required for account-scoped state');
    return `tbv3_user_state_${encodeURIComponent(uid.trim())}`;
  }

  return { mergeConcurrentState, scopedStateKey, equal, clone };
});
