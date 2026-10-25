// The Graveyard soundtrack. Plays the tracks listed in assets/audio/tracks.json in shuffled order,
// or a soundscape generated in the browser when that list is empty. Tracks play through a plain
// audio element: routing it into Web Audio crashed headless Chromium next to the WebGL world.
// iOS ignores element volume, so there tracks start and stop without fading.
window.graveyardMusic = (() => {
  'use strict';
  const STORAGE_KEY = 'loe-music';
  const AUDIO_DIR = 'assets/audio/';
  const VOLUME = .35;
  const DUCKED_VOLUME = .12;
  const AMBIENT = { title: 'Graveyard ambience', credit: 'Ambient · generated live in your browser' };
  const listeners = new Set();
  let ctx = null;
  let master = null;
  let audio = null;
  let ambient = null;
  let tracks = null;
  let bag = [];
  let current = null;
  let wanted = false;
  let ducked = false;
  let status = 'idle';
  let stopTimer = 0;
  let volumeTimer = 0;
  let enabled = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { /* Defaults to on. */ }

  // The list is tiny; loading it up front lets playback start inside the user's click.
  const tracksReady = fetch(`${AUDIO_DIR}tracks.json`, { cache: 'no-cache' })
    .then(response => response.ok ? response.json() : { tracks: [] })
    .then(data => { tracks = (Array.isArray(data.tracks) ? data.tracks : []).filter(track => track && typeof track.file === 'string' && track.file); })
    .catch(() => { tracks = []; })
    .finally(emit);

  function emit() {
    const state = { enabled, status, track: status === 'playing' ? current : null, canSkip: (tracks?.length || 0) > 1 };
    listeners.forEach(listener => listener(state));
  }

  function setStatus(next) {
    status = next;
    emit();
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    return ctx;
  }

  function fadeTo(level, seconds) {
    if (ctx) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(level, now + seconds);
    }
    if (!audio) return;
    clearInterval(volumeTimer);
    const from = audio.volume, started = performance.now();
    volumeTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / (seconds * 1000));
      audio.volume = from + (level - from) * progress;
      if (progress === 1) clearInterval(volumeTimer);
    }, 40);
  }

  function targetVolume() {
    return ducked ? DUCKED_VOLUME : VOLUME;
  }

  function nextTrack() {
    if (!bag.length) {
      bag = [...tracks].sort(() => Math.random() - .5);
      if (bag.length > 1 && bag[bag.length - 1] === current) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    return bag.pop();
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 0;
    audio.addEventListener('ended', () => { if (wanted && enabled) playTrack(nextTrack()); });
    audio.addEventListener('error', () => {
      // A missing or unsupported file is dropped from this session's list.
      tracks = tracks.filter(track => track !== current);
      bag = bag.filter(track => track !== current);
      if (wanted && enabled) tracks.length ? playTrack(nextTrack()) : playAmbient();
    });
    return audio;
  }

  function playTrack(track) {
    current = track;
    const element = ensureAudio();
    element.src = AUDIO_DIR + track.file.split('/').map(encodeURIComponent).join('/');
    element.loop = tracks.length === 1;
    return resumeElement();
  }

  function resumeElement() {
    return audio.play().then(() => setStatus('playing'), error => {
      if (error?.name === 'NotAllowedError') setStatus('blocked');
    });
  }

  function playAmbient() {
    if (!ensureContext()) { setStatus('unsupported'); return; }
    current = AMBIENT;
    ambient ??= createAmbient(ctx, master);
    ambient.start();
    setStatus('playing');
  }

  function start() {
    if (!wanted || !enabled) return;
    clearTimeout(stopTimer);
    if (tracks === null) { tracksReady.then(() => { if (status !== 'playing') start(); }); return; }
    if (tracks.length) {
      // A blocked play() reports itself; the next tap or key retries.
      fadeTo(targetVolume(), 1.5);
      if (status === 'playing') return;
      if (audio?.src) resumeElement();
      else playTrack(nextTrack());
      return;
    }
    if (!ensureContext()) { setStatus('unsupported'); return; }
    ctx.resume().then(() => { if (status === 'blocked' && wanted && enabled) start(); }, () => {});
    fadeTo(targetVolume(), 1.5);
    if (ctx.state !== 'running' && !navigator.userActivation?.isActive) {
      // Browsers keep audio suspended until the visitor interacts; the next tap or key retries.
      setStatus('blocked');
      return;
    }
    if (status !== 'playing') playAmbient();
  }

  function stop(seconds) {
    fadeTo(0, seconds);
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      audio?.pause();
      ambient?.stop();
      if (status === 'playing' || status === 'blocked') setStatus('idle');
    }, seconds * 1000 + 50);
  }

  // A tap or key press anywhere unlocks audio that the browser held back.
  for (const type of ['pointerdown', 'keydown']) {
    document.addEventListener(type, event => {
      if (event.target.closest?.('[data-music-toggle]')) return;
      if (wanted && enabled && status !== 'playing') start();
    }, true);
  }
  document.addEventListener('visibilitychange', () => {
    const resume = !document.hidden && wanted && enabled && status === 'playing';
    if (ctx) document.hidden ? ctx.suspend() : resume && ctx.resume();
    if (audio && current !== AMBIENT) document.hidden ? audio.pause() : resume && audio.play().catch(() => setStatus('blocked'));
  });

  function createAmbient(context, output) {
    const bus = context.createGain();
    bus.connect(output);
    // A soft echo shared by the music box and the birds.
    const echo = context.createDelay(1);
    echo.delayTime.value = .34;
    const feedback = context.createGain();
    feedback.gain.value = .32;
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    echo.connect(tone);
    tone.connect(feedback);
    feedback.connect(echo);
    tone.connect(bus);
    const send = context.createGain();
    send.gain.value = .45;
    send.connect(echo);
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
    const bass = [130.81, 110, 174.61, 196];
    const beat = 60 / 76 / 2;
    let sources = [];
    let timers = [];
    let step = 0;
    let note = 2;
    let nextTime = 0;

    function wind() {
      const length = context.sampleRate * 4;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        last = (last + .02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 500;
      filter.Q.value = .6;
      const gain = context.createGain();
      gain.gain.value = .05;
      const gust = context.createOscillator();
      gust.frequency.value = .06;
      const gustDepth = context.createGain();
      gustDepth.gain.value = 260;
      gust.connect(gustDepth).connect(filter.frequency);
      const swell = context.createOscillator();
      swell.frequency.value = .045;
      const swellDepth = context.createGain();
      swellDepth.gain.value = .025;
      swell.connect(swellDepth).connect(gain.gain);
      noise.connect(filter).connect(gain).connect(bus);
      [noise, gust, swell].forEach(source => { source.start(); sources.push(source); });
    }

    function pluck(time, frequency, level, length) {
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(level, time + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, time + length);
      gain.connect(bus);
      gain.connect(send);
      // A slightly inharmonic overtone makes the sine sound like a music-box tine.
      for (const [ratio, amount] of [[1, 1], [2.01, .25]]) {
        const oscillator = context.createOscillator();
        const partial = context.createGain();
        oscillator.frequency.value = frequency * ratio;
        partial.gain.value = amount;
        oscillator.connect(partial).connect(gain);
        oscillator.start(time);
        oscillator.stop(time + length + .05);
      }
    }

    function schedule() {
      if (nextTime < context.currentTime) nextTime = context.currentTime + .05;
      while (nextTime < context.currentTime + .6) {
        if (step % 16 === 0) pluck(nextTime, bass[(step / 16) % bass.length], .07, 3.2);
        if (Math.random() > .38) {
          note = Math.max(0, Math.min(scale.length - 1, note + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
          pluck(nextTime, scale[note], .045 + Math.random() * .02, 1.6);
        }
        nextTime += beat;
        step++;
      }
    }

    function chirp() {
      const panner = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
      if (panner.pan) panner.pan.value = Math.random() * 1.6 - .8;
      panner.connect(bus);
      panner.connect(send);
      const base = 2600 + Math.random() * 1400;
      let time = context.currentTime + .05;
      for (let i = 0, count = 2 + Math.floor(Math.random() * 3); i < count; i++) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.setValueAtTime(base, time);
        oscillator.frequency.exponentialRampToValueAtTime(base * 1.35, time + .07);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(.018, time + .015);
        gain.gain.linearRampToValueAtTime(0, time + .09);
        oscillator.connect(gain).connect(panner);
        oscillator.start(time);
        oscillator.stop(time + .1);
        time += .11 + Math.random() * .06;
      }
    }

    function birds() {
      chirp();
      timers.push(setTimeout(birds, 4000 + Math.random() * 8000));
    }

    return {
      start() {
        if (sources.length) return;
        nextTime = context.currentTime + .1;
        wind();
        timers.push(setInterval(schedule, 200));
        timers.push(setTimeout(birds, 2500));
      },
      stop() {
        timers.forEach(timer => { clearInterval(timer); clearTimeout(timer); });
        timers = [];
        sources.forEach(source => source.stop());
        sources = [];
      }
    };
  }

  return {
    // Call from the click or navigation that opens the Graveyard.
    enter() {
      wanted = true;
      start();
    },
    leave() {
      wanted = false;
      if (ctx) stop(.8);
    },
    // Quieter while a memorial is open.
    duck(on) {
      ducked = on;
      if (wanted && enabled && status === 'playing') fadeTo(targetVolume(), .4);
    },
    // Starts playback held back by the browser, without changing the visitor's preference.
    play() {
      if (enabled) start();
    },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch { /* Not remembered. */ }
      if (enabled) start();
      else stop(.5);
      emit();
    },
    next() {
      if (!enabled || !tracks || tracks.length < 2) return;
      fadeTo(targetVolume(), .3);
      playTrack(nextTrack());
    },
    onChange(listener) {
      listeners.add(listener);
      emit();
    }
  };
})();
