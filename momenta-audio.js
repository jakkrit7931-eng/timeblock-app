(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentaAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const AMBIENCE = new Set(['rain', 'waves', 'nature', 'wind', 'white', 'deep', 'hum', 'lofi', 'lofi-rain', 'lofi-soft']);
  const LOFI = new Set(['lofi', 'lofi-rain', 'lofi-soft']);

  function fillLofi(samples, rate, name) {
    const chords = [[130.81, 155.56, 196], [110, 130.81, 164.81], [87.31, 110, 130.81], [98, 123.47, 146.83]];
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate, beat = t % 0.8, chordTime = t % 1.6;
      const notes = chords[Math.floor(t / 1.6) % chords.length];
      const envelope = Math.exp(-chordTime * 1.8) * Math.min(1, chordTime * 25);
      const keys = notes.reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * t), 0) * envelope * 0.13;
      const bass = Math.sin(2 * Math.PI * notes[0] * 0.5 * t) * Math.exp(-beat * 3) * Math.min(1, beat * 25) * 0.12;
      const kick = name === 'lofi-soft' ? 0 : Math.sin(2 * Math.PI * (65 * beat - 20 * beat * beat)) * Math.exp(-beat * 24) * 0.18;
      const noise = (Math.random() * 2 - 1) * (name === 'lofi-rain' ? 0.13 : 0.02);
      const hatTime = t % 0.4;
      const hat = name === 'lofi-soft' ? 0 : (Math.random() * 2 - 1) * Math.exp(-hatTime * 45) * 0.04;
      samples[i] = Math.max(-1, Math.min(1, keys + bass + kick + noise + hat));
    }
  }
  const ALERTS = {
    chime: [660, 880, 1320],
    soft: [420, 560],
    pulse: [880, 880, 1180],
    digital: [540, 760, 980]
  };

  function createAudioController(options = {}) {
    let context = null;
    let graph = null;
    let previewTimer = null;
    const contextFactory = options.audioContextFactory || (() => {
      const Context = root?.AudioContext || root?.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is unavailable');
      return new Context();
    });
    const setTimer = options.setTimeout || setTimeout;
    const clearTimer = options.clearTimeout || clearTimeout;

    function getContext() {
      if (!context) context = contextFactory();
      if (context.state === 'suspended') context.resume()?.catch?.(() => {});
      return context;
    }

    function stopAmbient() {
      if (previewTimer !== null) {
        clearTimer(previewTimer);
        previewTimer = null;
      }
      if (!graph) return;
      const current = graph;
      graph = null;
      current.sources.forEach(source => {
        try { source.stop(); } catch (_) {}
      });
      current.nodes.forEach(node => {
        try { node.disconnect(); } catch (_) {}
      });
    }

    function startAmbient(name, volume = 0.2) {
      if (previewTimer !== null) {
        clearTimer(previewTimer);
        previewTimer = null;
      }
      if (name === 'silent' || !name) {
        stopAmbient();
        return true;
      }
      if (!AMBIENCE.has(name)) return false;
      const level = Math.max(0, Math.min(1, Number(volume) || 0));
      if (level === 0) {
        stopAmbient();
        return true;
      }
      if (graph?.name === name && graph.volume === level) {
        if (context?.state === 'suspended') context.resume()?.catch?.(() => {});
        return true;
      }
      stopAmbient();
      try {
        const ctx = getContext();
        const seconds = Math.max(1, Math.ceil(ctx.sampleRate * (LOFI.has(name) ? 6.4 : 2)));
        const buffer = ctx.createBuffer(1, seconds, ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        if (LOFI.has(name)) fillLofi(samples, ctx.sampleRate, name);
        else for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const output = ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = name === 'nature' || name === 'wind' ? 'bandpass' : 'lowpass';
        filter.frequency.value = ({rain:1200, waves:420, nature:1500, wind:550, white:16000, deep:160, hum:280, lofi:2400, 'lofi-rain':2400, 'lofi-soft':2000})[name];
        output.gain.value = level * 0.22;
        source.connect(filter);
        filter.connect(output);
        output.connect(ctx.destination);

        const nodes = [source, filter, output];
        const sources = [source];
        if (name === 'waves' || name === 'wind') {
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.type = 'sine';
          lfo.frequency.value = name === 'wind' ? 0.07 : 0.11;
          depth.gain.value = level * 0.12;
          lfo.connect(depth);
          depth.connect(output.gain);
          lfo.start();
          nodes.push(lfo, depth);
          sources.push(lfo);
        } else if (name === 'nature' || name === 'hum') {
          const tone = ctx.createOscillator();
          const toneGain = ctx.createGain();
          tone.type = 'sine';
          tone.frequency.value = name === 'hum' ? 110 : 1450;
          toneGain.gain.value = level * (name === 'hum' ? 0.08 : 0.012);
          tone.connect(toneGain);
          toneGain.connect(ctx.destination);
          tone.start();
          nodes.push(tone, toneGain);
          sources.push(tone);
        }
        source.start();
        graph = { name, volume: level, nodes, sources };
        return true;
      } catch (_) {
        stopAmbient();
        return false;
      }
    }

    function previewAmbient(name, volume = 0.2, durationMs = 7000) {
      if (!startAmbient(name, volume)) return false;
      if (name === 'silent' || !name) return true;
      if (previewTimer !== null) clearTimer(previewTimer);
      previewTimer = setTimer(() => {
        previewTimer = null;
        stopAmbient();
      }, Math.max(1000, Number(durationMs) || 7000));
      return true;
    }

    function playAlert(name = 'chime', volume = 0.28) {
      if (name === 'silent') return true;
      const notes = ALERTS[name];
      if (!notes) return false;
      try {
        const ctx = getContext();
        const level = Math.max(0.01, Math.min(0.5, Number(volume) || 0.28));
        const now = ctx.currentTime;
        notes.forEach((frequency, index) => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + index * 0.24;
          oscillator.type = index % 2 ? 'triangle' : 'sine';
          oscillator.frequency.setValueAtTime(frequency, start);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(level, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
          oscillator.onended = () => { try { oscillator.disconnect(); gain.disconnect(); } catch (_) {} };
          oscillator.start(start);
          oscillator.stop(start + 0.22);
        });
        return true;
      } catch (_) {
        return false;
      }
    }

    function dispose() {
      stopAmbient();
      if (context) {
        const current = context;
        context = null;
        current.close()?.catch?.(() => {});
      }
    }

    return { startAmbient, stopAmbient, previewAmbient, playAlert, dispose, getActiveAmbient: () => graph ? { name: graph.name, volume: graph.volume } : null };
  }

  return { createAudioController };
});
