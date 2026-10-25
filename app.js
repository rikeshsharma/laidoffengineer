(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const dialog = $('#experience-dialog');
  const content = $('#dialog-content');
  const kicker = $('#dialog-kicker');
  let stream = null;
  let photo = null;
  let currentView = '';
  let runId = 0;
  let toastTimer;
  let currentPage = 'home';
  let transientGraves = null;
  const shuffled = items => [...items].sort(() => Math.random() - .5);
  function makeBag(items) {
    let bag = [];
    let previous;
    return () => {
      if (!bag.length) {
        bag = shuffled(items);
        if (bag.length > 1 && bag[bag.length - 1] === previous) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      previous = bag.pop();
      return previous;
    };
  }
  const nextCaption = makeBag([
    ['OPEN TO WORK.', 'CLOSED TO MEETINGS.'],
    ['SENIOR ENGINEER.', 'JUNIOR GARDENER.'],
    ['MY ROLE WAS ELIMINATED.', 'MY AURA WAS NOT.'],
    ['UNLIMITED PTO.', 'FINALLY APPROVED.'],
    ['EXCEEDS EXPECTATIONS.', 'EXCEEDS HEADCOUNT.'],
    ['CURRENTLY OPTIMIZING', 'MY COUCH PERFORMANCE.'],
    ['404: JOB NOT FOUND.', 'PERSONALITY STILL ONLINE.'],
    ['I USED TO FIX BUGS.', 'NOW I TOUCH GRASS.']
  ]);
  const nextEpitaph = makeBag([
    'Gone before the equity vested.',
    'This meeting could have been an email.',
    'Finally achieved inbox zero.',
    'Survived prod. Not the all-hands.',
    'Last seen typing “sounds good”.',
    'Loved the team. Feared the calendar.',
    'No more standups. Only lie-downs.',
    'Returned to the talent pool.'
  ]);
  const nextOutcome = makeBag([
    { type: 'airplane', symbol: '✈', title: 'We gave it wings.', text: 'Finally, a career move with some lift.' },
    { type: 'receipt', symbol: '⌁', title: 'One very long receipt.', text: '8 years. 42 frameworks. 1 complimentary burnout.' },
    { type: 'promotion', symbol: '✳', title: 'You’re the CEO now.', text: 'Your first board meeting is a nap.' },
    { type: 'void', symbol: '404', title: 'A perfect match!', text: 'The role went to the hiring manager’s nephew.' },
    { type: 'tarot', symbol: '☾', title: 'You drew: The Pivot.', text: 'Mercury is in retrograde. So is the hiring budget.' },
    { type: 'potato', symbol: '🥔', title: 'Certified couch potato.', text: 'Six-hour sprint planning finally paid off.' },
    { type: 'rejection', symbol: '♡', title: 'It’s not you. It’s us.', text: 'Hiring frozen until the heat death of the universe.' },
    { type: 'confetti', symbol: '✺', title: 'Senior Vibes Engineer.', text: 'Dress code: the good pajamas.' }
  ]);
  const wheelJokes = [
    { title: 'Unlimited PTO.', text: 'Finally approved. Permanently.' },
    { title: 'Open to work.', text: 'Closed to “quick syncs”.' },
    { title: 'Senior engineer.', text: 'Junior houseplant supervisor.' },
    { title: 'Performance review:', text: 'Exceeds expectations. Exceeds headcount.' },
    { title: 'Full-stack developer.', text: 'Now specializing in full-time naps.' },
    { title: '“We’re a family.”', text: 'Apparently, you were adopted.' },
    { title: '404: job not found.', text: 'Personality still online.' },
    { title: 'Career growth.', text: 'My sourdough has more openings.' }
  ];
  const wheelOutcomes = wheelJokes.flatMap(joke => [
    { type: 'camera', title: 'Say “severance”.', text: 'Photobooth' },
    { type: 'joke', ...joke }
  ]);
  const wheelIcons = [
    { name: 'coffee', path: 'M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM16 10h2a3 3 0 0 1 0 6h-2M7 3v3M12 2v4' },
    { name: 'laptop', path: 'M4 4h16v12H4zM2 20h20l-2-4H4zM9 8l-2 2 2 2M15 8l2 2-2 2' },
    { name: 'briefcase', path: 'M8 7V4h8v3M3 7h18v14H3zM3 12l7 3h4l7-3M10 13h4v4h-4z' },
    { name: 'plant', path: 'M8 15h8l-1 7H9zM12 15V8M12 10C6 10 4 6 4 3c6 0 8 3 8 7zM12 12c0-6 4-8 8-8 0 5-3 8-8 8z' },
    { name: 'clock', path: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM12 6v6l4 3' },
    { name: 'bed', path: 'M3 5v16M21 12v9M3 17h18M3 10h5v7M8 11h9a4 4 0 0 1 4 4v2M4 10V8h4v2' },
    { name: 'paper-plane', path: 'M2 10l20-8-8 20-4-8zM10 14 22 2' },
    { name: 'pizza', path: 'M3 5a20 20 0 0 1 18 0l-9 17zM5 8a16 16 0 0 1 14 0M10 10h.01M14 13h.01M11 17h.01' },
    { name: 'headphones', path: 'M3 13v-2a9 9 0 0 1 18 0v2M3 12h4v9H3zM17 12h4v9h-4z' },
    { name: 'gamepad', path: 'M7 7h10c3 0 4 3 5 10 0 3-3 4-5 1l-2-2H9l-2 2c-2 3-5 2-5-1C3 10 4 7 7 7zM7 10v5M4.5 12.5h5M16 11h.01M19 14h.01' },
    { name: 'sun', path: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5' },
    { name: 'cloud', path: 'M7 19a5 5 0 1 1 0-10 6 6 0 0 1 11-2 6 6 0 0 1 0 12z' },
    { name: 'heart', path: 'M12 21 3 12C-3 5 7-1 12 6c5-7 15-1 9 6z' },
    { name: 'lightning', path: 'M14 2 4 14h7l-1 8 10-12h-7z' },
    { name: 'star', path: 'm12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z' },
    { name: 'wallet', path: 'M3 7V5a2 2 0 0 1 2-2h13v4M3 7h18v14H3zM21 11h-7v6h7M17 14h.01' }
  ];
  const wheelSliceAngle = 360 / wheelOutcomes.length;
  const nextCameraWheelIndex = makeBag(wheelOutcomes.map((_, index) => index).filter(index => wheelOutcomes[index].type === 'camera'));
  const nextJokeWheelIndex = makeBag(wheelOutcomes.map((_, index) => index).filter(index => wheelOutcomes[index].type === 'joke'));
  const rotor = $('.wheel-rotor');
  const spinButton = $('#spin-wheel');
  let wheelRotation = 0;
  let wheelSpinning = false;
  let selectedWheelJoke = null;
  let activeWheelAnimation = null;
  let wheelRun = 0;

  function createWheel() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 400 400');
    const defs = document.createElementNS(ns, 'defs');
    const filter = document.createElementNS(ns, 'filter');
    filter.id = 'concealed-joke';
    const blur = document.createElementNS(ns, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '4');
    filter.append(blur);
    defs.append(filter);
    svg.append(defs);
    const colors = ['#d7d5ef', '#e5eacb', '#f1d9cd', '#e9dba9', '#d0deea', '#e0cee8', '#dbe2c1', '#ebcfcd'];
    // Decorative icons are shuffled independently of the hidden outcomes.
    const icons = shuffled(wheelIcons);
    const point = angle => {
      const radians = angle * Math.PI / 180;
      return [200 + 190 * Math.cos(radians), 200 + 190 * Math.sin(radians)];
    };
    wheelOutcomes.forEach((outcome, index) => {
      const angle = -90 + index * wheelSliceAngle;
      const start = point(angle - wheelSliceAngle / 2), end = point(angle + wheelSliceAngle / 2);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M200 200L${start.join(' ')}A190 190 0 0 1 ${end.join(' ')}Z`);
      path.setAttribute('fill', colors[index % colors.length]);
      path.setAttribute('stroke', '#fbf8f1');
      path.setAttribute('stroke-width', '2');
      svg.append(path);
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('transform', `rotate(${index * wheelSliceAngle} 200 200)`);
      const hiddenCopy = document.createElementNS(ns, 'text');
      hiddenCopy.setAttribute('x', '200');
      hiddenCopy.setAttribute('y', '111');
      hiddenCopy.setAttribute('text-anchor', 'middle');
      hiddenCopy.setAttribute('filter', 'url(#concealed-joke)');
      hiddenCopy.setAttribute('class', 'wheel-secret');
      // All outcomes stay concealed until the wheel stops.
      [outcome.title, outcome.text].forEach((line, lineIndex) => {
        const span = document.createElementNS(ns, 'tspan');
        span.setAttribute('x', '200');
        span.setAttribute('dy', lineIndex ? '12' : '0');
        span.setAttribute('textLength', '34');
        span.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        span.textContent = line;
        hiddenCopy.append(span);
      });
      const icon = document.createElementNS(ns, 'g');
      icon.setAttribute('transform', 'translate(184 48) scale(1.333333)');
      icon.setAttribute('class', 'wheel-icon');
      icon.setAttribute('data-icon', icons[index].name);
      const iconPath = document.createElementNS(ns, 'path');
      iconPath.setAttribute('d', icons[index].path);
      icon.append(iconPath);
      group.append(hiddenCopy, icon);
      svg.append(group);
    });
    const rim = document.createElementNS(ns, 'circle');
    rim.setAttribute('cx', '200'); rim.setAttribute('cy', '200');
    rim.setAttribute('r', '194'); rim.setAttribute('fill', 'none');
    rim.setAttribute('stroke', '#414837'); rim.setAttribute('stroke-width', '10');
    svg.append(rim);
    for (let index = 0; index < 32; index++) {
      const radians = index * Math.PI / 16;
      const pin = document.createElementNS(ns, 'circle');
      pin.setAttribute('cx', 200 + 194 * Math.cos(radians));
      pin.setAttribute('cy', 200 + 194 * Math.sin(radians));
      pin.setAttribute('r', '1.4'); pin.setAttribute('fill', '#e9e2cb');
      svg.append(pin);
    }
    rotor.append(svg);
  }

  async function spinWheel() {
    if (wheelSpinning || currentPage !== 'home') return;
    const spinRun = ++wheelRun;
    wheelSpinning = true;
    spinButton.disabled = true;
    $('.spin-label').textContent = '…';
    $('.wheel-status').textContent = 'Spinning…';
    $('.wheel-frame').classList.add('is-spinning');
    // Select the outcome type first so every spin has an independent 50% camera chance.
    const index = Math.random() < .5 ? nextCameraWheelIndex() : nextJokeWheelIndex();
    // Sector zero is centered at the top. Rotate the selected sector to that pointer.
    const target = (360 - index * wheelSliceAngle) % 360;
    const delta = (target - wheelRotation % 360 + 360) % 360;
    const end = wheelRotation + 360 * 6 + delta;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animation = rotor.animate([
        { transform: `rotate(${wheelRotation}deg)` },
        { transform: `rotate(${end}deg)` }
      ], { duration: 4300, easing: 'cubic-bezier(.12,.72,.12,1)', fill: 'forwards' });
      activeWheelAnimation = animation;
      try { await animation.finished; } catch { return; }
      if (spinRun !== wheelRun) return;
      rotor.style.transform = `rotate(${end}deg)`;
      animation.cancel();
      activeWheelAnimation = null;
    } else {
      rotor.style.transform = `rotate(${end}deg)`;
    }
    wheelRotation = end;
    const outcome = wheelOutcomes[index];
    $('.wheel-frame').dataset.selectedIndex = index;
    $('.wheel-frame').classList.remove('is-spinning');
    wheelSpinning = false;
    spinButton.disabled = false;
    $('.spin-label').textContent = 'SPIN';
    $('.wheel-status').textContent = '';
    if (dialog.open) dialog.addEventListener('close', () => launchWheelOutcome(outcome, spinRun), { once: true });
    else launchWheelOutcome(outcome, spinRun);
  }

  function launchWheelOutcome(outcome, spinRun) {
    if (currentPage !== 'home' || spinRun !== wheelRun) return;
    if (outcome.type === 'camera') {
      openExperience('camera');
      if (!document.hidden) startCamera();
    } else {
      selectedWheelJoke = outcome;
      openExperience('joke');
    }
  }

  function renderWheelJoke() {
    content.innerHTML = '<div class="joke-symbol" aria-hidden="true">✳</div><h2 id="dialog-title"></h2><p class="joke-punchline"></p><div class="dialog-actions"><button class="primary" id="spin-again-wheel">Spin again ↻</button></div>';
    $('#dialog-title').textContent = selectedWheelJoke.title;
    $('.joke-punchline').textContent = selectedWheelJoke.text;
    $('#spin-again-wheel').addEventListener('click', () => {
      dialog.addEventListener('close', spinWheel, { once: true });
      dialog.close();
    });
  }
  createWheel();
  spinButton.addEventListener('click', spinWheel);
  function notify(message) {
    const toast = $('.toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
  }
  const nextBadgeScan = makeBag([
    ['SUNSET', 'Legacy employee', 'Access denied. You were deprecated with no migration path.'],
    ['REORGED', 'Former team lead', 'Access denied. Your team now reports to a spreadsheet.'],
    ['ARCHIVED', 'Read-only employee', 'Access denied. You may view the office, but not edit it.'],
    ['SACKED', 'Alumni (unpaid)', 'Access denied. Please return your laptop and your sense of purpose.'],
    ['EXITED', 'Free agent', 'Access denied. Badge deactivated during the all-hands about being a family.'],
    ['404', 'Employee not found', 'Badge not found. Have you tried turning your career off and on again?'],
    ['PIVOTED', 'Chief Nap Officer', 'Access granted… to the parking lot.'],
    ['DELETED', 'Ex-rockstar ninja', 'Access denied. Your Slack status is now permanently “away”.'],
    ['LAID OFF', 'Valued employee', 'Beep. The badge reader thanks you for your contributions.']
  ]);
  const badge = $('.id-card');
  let badgeScans = 0;
  badge.addEventListener('click', () => {
    const [stamp, title, message] = nextBadgeScan();
    badgeScans++;
    $('.redundant-stamp', badge).textContent = stamp;
    $('.id-title', badge).textContent = title;
    badge.classList.remove('is-scanned');
    void badge.offsetWidth;
    badge.classList.add('is-scanned');
    notify(badgeScans % 7 === 0 ? 'HR has been notified that you keep scanning a deactivated badge.' : message);
  });
  function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  function cleanup() {
    stopCamera();
    photo = null;
    runId++;
  }
  function openExperience(view, payload) {
    cleanup();
    currentView = view;
    dialog.dataset.view = view;
    kicker.textContent = { camera: 'PHOTOBOOTH', grave: 'GRAVEYARD', resume: 'RÉSUMÉ ROULETTE', about: 'ABOUT', joke: 'JOKE ROULETTE', memorial: 'MEMORIAL' }[view];
    if (view === 'camera') renderCamera();
    if (view === 'grave') renderGrave();
    if (view === 'resume') renderResume();
    if (view === 'about') renderAbout();
    if (view === 'joke') renderWheelJoke();
    if (view === 'memorial') renderMemorial(payload);
    if (!dialog.open) dialog.showModal();
    music?.duck(true);
    dialog.scrollTop = 0;
  }
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openExperience(button.dataset.open)));
  $('.close-button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', cleanup);
  dialog.addEventListener('close', () => music?.duck(false));
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && stream) {
      stopCamera();
      if (dialog.open && currentView === 'camera' && !photo) renderCamera('Camera paused. Open it again to continue.');
    }
  });
  function downloadCanvas(canvas, name) {
    canvas.toBlob(blob => {
      if (!blob) return notify('Couldn’t save. Try again.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify('Saved.');
    }, 'image/png');
  }
  function preparePhotoSharing(canvas) {
    const button = $('#share-photo');
    const label = $('.share-label', button);
    const status = $('.inline-status', content);
    const saveButton = $('#save-photo');
    let shareFile = null;
    let encodingFailed = false;
    let sharing = false;
    button.disabled = true;
    label.textContent = 'Preparing…';
    // Prepare the actual meme before the click so native sharing retains user activation.
    canvas.toBlob(blob => {
      if (!button.isConnected) return;
      encodingFailed = !blob;
      if (blob && typeof File === 'function') {
        shareFile = new File([blob], 'laidoffengineer-meme.png', { type: 'image/png' });
      }
      button.disabled = false;
      label.textContent = 'Share';
    }, 'image/png');
    const offerDownload = message => {
      status.textContent = message;
      saveButton.textContent = 'Save to share ↓';
      saveButton.focus();
    };
    button.addEventListener('click', async () => {
      if (sharing) return;
      status.textContent = '';
      if (encodingFailed) {
        status.textContent = 'Couldn’t prepare this photo. Retake it and try again.';
        return;
      }
      const data = { files: shareFile ? [shareFile] : [] };
      try {
        if (!shareFile || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || !navigator.canShare(data)) {
          offerDownload('Save the photo, then share it from your gallery.');
          return;
        }
        sharing = true;
        button.disabled = true;
        label.textContent = 'Sharing…';
        // File only: share the photo and its current caption, without a local page URL.
        await navigator.share(data);
      } catch (error) {
        if (button.isConnected && error.name !== 'AbortError') {
          offerDownload('Couldn’t share. Save the photo and share it from your gallery.');
        }
      } finally {
        sharing = false;
        if (button.isConnected) {
          button.disabled = false;
          label.textContent = 'Share';
        }
      }
    });
  }
  function renderCamera(message = '') {
    content.innerHTML = `<h2 id="dialog-title">Say <em>“severance”.</em></h2><div class="camera-stage"><div class="camera-placeholder"><svg viewBox="0 0 80 80" aria-hidden="true"><rect x="12" y="25" width="56" height="39" rx="7"/><path d="m26 25 6-10h16l6 10"/><circle cx="40" cy="44" r="13"/><path d="M19 32h5"/></svg></div></div><p class="inline-status" role="status"></p><div class="dialog-actions"><button class="primary" id="open-camera">Open camera ↗</button><button class="secondary" id="demo-camera">Try demo</button></div><p class="privacy-note">Photos stay on your device until you share.</p>`;
    $('.inline-status', content).textContent = message;
    $('#open-camera').addEventListener('click', startCamera);
    $('#demo-camera').addEventListener('click', () => { runId++; stopCamera(); makePhoto(null); });
  }
  async function startCamera() {
    const requestRun = runId;
    const button = $('#open-camera');
    button.disabled = true;
    button.textContent = 'Asking your camera…';
    if (!navigator.mediaDevices?.getUserMedia) {
      renderCamera('Camera needs HTTPS. Try the demo instead.');
      return;
    }
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (!dialog.open || document.hidden || currentView !== 'camera' || requestRun !== runId) { camera.getTracks().forEach(track => track.stop()); return; }
      stream = camera;
      const stage = $('.camera-stage');
      stage.innerHTML = '<video autoplay playsinline muted aria-label="Live camera preview"></video>';
      const video = $('video', stage);
      video.srcObject = stream;
      $('.inline-status').textContent = '';
      $('.dialog-actions', content).innerHTML = '<button class="primary" id="capture-photo" disabled>Warming up…</button><button class="secondary" id="demo-camera">Try demo</button>';
      const capture = $('#capture-photo');
      video.addEventListener('loadeddata', () => { capture.disabled = false; capture.textContent = 'Take photo'; }, { once: true });
      capture.addEventListener('click', () => {
        if (!video.videoWidth) return;
        makePhoto(video);
        stopCamera();
      });
      $('#demo-camera').addEventListener('click', () => { runId++; stopCamera(); makePhoto(null); });
      await video.play();
    } catch (error) {
      if (requestRun !== runId || !dialog.open) return;
      stopCamera();
      renderCamera(error.name === 'NotAllowedError' ? 'Camera access denied. Try the demo.' : 'No camera found. Try the demo.');
    }
  }
  function makePhoto(video) {
    photo = document.createElement('canvas');
    photo.width = 800;
    photo.height = 730;
    const ctx = photo.getContext('2d');
    if (video) {
      const scale = Math.max(800 / video.videoWidth, 730 / video.videoHeight);
      const width = video.videoWidth * scale, height = video.videoHeight * scale;
      ctx.translate(800, 0); ctx.scale(-1, 1);
      ctx.drawImage(video, (800 - width) / 2, (730 - height) / 2, width, height);
    } else {
      ctx.fillStyle = '#d5cee9'; ctx.fillRect(0, 0, 800, 730);
      ctx.fillStyle = '#7787bb'; ctx.beginPath(); ctx.ellipse(400, 730, 290, 235, 0, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#dfb49a'; ctx.fillRect(350, 440, 100, 150);
      ctx.fillStyle = '#edc5a8'; ctx.beginPath(); ctx.ellipse(400, 325, 160, 202, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#35342d'; ctx.beginPath(); ctx.ellipse(400, 160, 168, 100, -.08, Math.PI, Math.PI * 2); ctx.lineTo(554, 290); ctx.lineTo(510, 180); ctx.quadraticCurveTo(390, 250, 280, 190); ctx.lineTo(242, 290); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#35342d'; ctx.lineWidth = 11; ctx.strokeRect(275, 290, 99, 69); ctx.strokeRect(426, 290, 99, 69); ctx.beginPath(); ctx.moveTo(374, 310); ctx.lineTo(426, 310); ctx.stroke();
      ctx.fillStyle = '#35342d'; ctx.fillRect(319, 310, 11, 17); ctx.fillRect(469, 310, 11, 17);
      ctx.strokeStyle = '#aa7260'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(357, 433); ctx.quadraticCurveTo(400, 399, 443, 433); ctx.stroke();
      ctx.fillStyle = '#fbf8f1'; ctx.font = '600 23px Figtree, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HELLO, I AM BETWEEN OPPORTUNITIES', 400, 670);
    }
    showPhoto();
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' '); let line = ''; let lines = [];
    for (const word of words) {
      if (line && ctx.measureText(line + ' ' + word).width > maxWidth) { lines.push(line); line = word; } else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
    return lines.length * lineHeight;
  }
  function showPhoto() {
    const caption = nextCaption();
    $('.camera-stage').classList.add('result-stage');
    $('.camera-stage').innerHTML = '<canvas width="860" height="1100" role="img"></canvas>';
    const canvas = $('.camera-stage canvas');
    canvas.setAttribute('aria-label', `Your layoff meme: ${caption.join(' ')}`);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbf8f1'; ctx.fillRect(0, 0, 860, 1100);
    ctx.fillStyle = '#24261f'; ctx.font = '600 18px Figtree, sans-serif'; ctx.fillText('LAID OFF ENGINEER / THE PHOTOBOOTH', 30, 40);
    ctx.drawImage(photo, 30, 65, 800, 730);
    ctx.fillStyle = '#24261f'; ctx.textAlign = 'center'; ctx.font = '800 39px Figtree, sans-serif';
    let y = 863;
    caption.forEach(line => { y += wrapText(ctx, line, 430, y, 780, 49); });
    ctx.fillStyle = '#626657'; ctx.font = '400 18px Figtree, sans-serif'; ctx.fillText('laidoffengineer.lol · made redundant. still relevant.', 430, 1063);
    $('.inline-status').textContent = '';
    $('.dialog-actions', content).classList.add('photo-actions');
    $('.dialog-actions', content).innerHTML = '<button class="primary share-button" id="share-photo" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/></svg><span class="share-label">Share</span></button><button class="secondary" id="save-photo">Save ↓</button><button class="secondary" id="print-photo">Print</button><button class="secondary" id="remix-photo">Remix ↻</button><button class="text-button" id="retake-photo">Retake</button>';
    preparePhotoSharing(canvas);
    $('#save-photo').addEventListener('click', () => downloadCanvas(canvas, 'my-character-arc.png'));
    $('#print-photo').addEventListener('click', () => {
      const sheet = $('#print-sheet');
      sheet.replaceChildren();
      const img = new Image();
      img.alt = caption.join(' ');
      img.onload = () => window.print();
      img.src = canvas.toDataURL('image/png');
      sheet.append(img);
    });
    $('#remix-photo').addEventListener('click', showPhoto);
    $('#retake-photo').addEventListener('click', () => { runId++; photo = null; renderCamera(); });
  }
  function readGraves() {
    if (transientGraves) return transientGraves;
    try {
      const items = JSON.parse(localStorage.getItem('loe-graves') || '[]');
      return Array.isArray(items) ? items.filter(item => item && typeof item.name === 'string' && typeof item.epitaph === 'string') : [];
    } catch { return []; }
  }
  function renderGrave() {
    const graves = readGraves();
    const last = graves[graves.length - 1];
    content.innerHTML = `<h2 id="dialog-title">Rest in <em>pivot.</em></h2><div class="grave-preview"><span class="grave-sun"></span><div class="stone small" aria-hidden="true"><strong>RIP</strong><p>Daily<br>standups</p></div><div class="stone"><strong>RIP</strong><span class="grave-name"></span><p class="grave-epitaph"></p></div><div class="stone small" aria-hidden="true"><strong>RIP</strong><p>“We’re<br>a family”</p></div></div><p class="grave-count"></p><form id="grave-form"><label class="field">Name<input id="grave-name" maxlength="35" placeholder="My 9–5" required autocomplete="off"></label><div class="field-inline"><label class="field">Epitaph<input id="grave-epitaph" maxlength="90" required autocomplete="off"></label><button class="dice" type="button" id="shuffle-epitaph" aria-label="Choose a random epitaph">⚄</button></div><div class="dialog-actions"><button class="primary" type="submit">Lay it to rest ↘</button><button class="secondary" type="button" id="save-grave">Save memorial ↓</button></div></form><p class="privacy-note" id="grave-privacy">Saved on this device.</p>`;
    $('#grave-name').value = last?.name || 'My 9–5';
    $('#grave-epitaph').value = last?.epitaph || nextEpitaph();
    const update = () => {
      $('.grave-name').textContent = $('#grave-name').value.trim() || 'My 9–5';
      $('.grave-epitaph').textContent = $('#grave-epitaph').value.trim() || 'Gone before the equity vested.';
    };
    $('.grave-count').textContent = graves.length ? `${graves.length} memorial${graves.length === 1 ? '' : 's'}` : '';
    $('#grave-name').addEventListener('input', update);
    $('#grave-epitaph').addEventListener('input', update);
    $('#shuffle-epitaph').addEventListener('click', () => { $('#grave-epitaph').value = nextEpitaph(); update(); });
    $('#grave-form').addEventListener('submit', event => {
      event.preventDefault();
      const name = $('#grave-name').value.trim(), epitaph = $('#grave-epitaph').value.trim();
      if (!name || !epitaph) return notify('Add a name and epitaph.');
      const entries = [...readGraves(), { name, epitaph, date: new Date().toISOString() }];
      let persisted = true;
      try { localStorage.setItem('loe-graves', JSON.stringify(entries)); transientGraves = null; } catch { persisted = false; transientGraves = entries; }
      $('.grave-count').textContent = persisted ? `${entries.length} memorial${entries.length === 1 ? '' : 's'}` : 'Download to keep it.';
      if (!persisted) $('#grave-privacy').textContent = 'Storage unavailable. Download to keep it.';
      notify('Laid to rest.');
      update();
      refreshGraveyard({ visitNewest: true });
    });
    $('#save-grave').addEventListener('click', saveGrave);
    update();
  }
  function saveGrave() {
    downloadMemorial($('#grave-name').value.trim() || 'My 9–5', $('#grave-epitaph').value.trim() || 'Gone before the equity vested.');
  }
  function downloadMemorial(name, epitaph) {
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e4ebd7'; ctx.fillRect(0, 0, 900, 900);
    ctx.fillStyle = '#f3edb9'; ctx.beginPath(); ctx.arc(715, 150, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9ca68c'; ctx.beginPath(); ctx.roundRect(239, 239, 440, 487, [220, 220, 5, 5]); ctx.fill();
    ctx.fillStyle = '#c1c7b6'; ctx.beginPath(); ctx.roundRect(220, 230, 440, 490, [220, 220, 5, 5]); ctx.fill();
    ctx.fillStyle = '#3d4935'; ctx.textAlign = 'center'; ctx.font = '650 90px Newsreader, Georgia, serif'; ctx.fillText('RIP', 440, 386);
    ctx.font = '600 34px Figtree, sans-serif'; wrapText(ctx, name, 440, 460, 360, 42);
    ctx.font = 'italic 34px Newsreader, Georgia, serif'; wrapText(ctx, epitaph, 440, 557, 350, 39);
    ctx.fillStyle = '#aebb90'; ctx.fillRect(0, 715, 900, 185);
    ctx.fillStyle = '#3d4935'; ctx.font = '500 22px Figtree, sans-serif'; ctx.fillText('REST IN PIVOT.', 450, 787); ctx.font = '400 18px Figtree, sans-serif'; ctx.fillText('laidoffengineer.lol · the corporate graveyard', 450, 835);
    downloadCanvas(canvas, 'rest-in-pivot.png');
  }
  const uploadIcon = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 5h18l8 9v29H12zM29 5v10h9M24 35V22m-5 5 5-5 5 5"/></svg>';
  function renderResume() {
    content.innerHTML = `<h2 id="dialog-title">Your résumé.<br><em>Our condolences.</em></h2><button class="dropzone" id="dropzone">${uploadIcon}<strong>Drop or choose a résumé</strong><span>PDF, DOC, DOCX, RTF, TXT · 5 MB max</span></button><input type="file" id="resume-file" accept=".pdf,.doc,.docx,.rtf,.txt" hidden><p class="inline-status" role="status"></p><div class="dialog-actions"><button class="secondary" id="demo-resume">Try demo ↗</button></div><p class="privacy-note">Never read, stored, or uploaded.</p>`;
    const input = $('#resume-file'), zone = $('#dropzone');
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { if (input.files[0]) chooseResume(input.files[0]); });
    for (const type of ['dragenter', 'dragover']) zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('dragover'); });
    for (const type of ['dragleave', 'drop']) zone.addEventListener(type, event => { event.preventDefault(); zone.classList.remove('dragover'); });
    zone.addEventListener('drop', event => { if (event.dataTransfer.files[0]) chooseResume(event.dataTransfer.files[0]); });
    $('#demo-resume').addEventListener('click', () => processResume('definitely-qualified.pdf', true));
  }
  function chooseResume(file) {
    const status = $('.inline-status');
    if (!/\.(pdf|docx?|rtf|txt)$/i.test(file.name)) { status.textContent = 'Use PDF, DOC, DOCX, RTF, or TXT.'; return; }
    if (file.size > 5 * 1024 * 1024) { status.textContent = '5 MB max. Choose a smaller file.'; return; }
    if (!file.size) { status.textContent = 'Empty file. Choose another or try demo.'; return; }
    processResume(file.name, false);
  }
  async function processResume(filename, isDemo) {
    const processRun = ++runId;
    content.innerHTML = '<h2 id="dialog-title">Trust the <em>process?</em></h2><p class="dialog-description resume-picked"></p><div class="resume-result" aria-busy="true"><div class="processing-wheel" aria-hidden="true"></div><p role="status">Consulting the office plant…</p></div>';
    $('.resume-picked').textContent = filename;
    await new Promise(resolve => setTimeout(resolve, 1100));
    if (!dialog.open || currentView !== 'resume' || runId !== processRun) return;
    showOutcome(filename, isDemo);
  }
  function showOutcome(filename, isDemo) {
    const result = nextOutcome();
    content.innerHTML = '<h2 id="dialog-title">Your <em>verdict.</em></h2><div class="resume-result" role="status"><div class="result-symbol" aria-hidden="true"></div><h3></h3><p></p></div><div class="dialog-actions"><button class="primary" id="spin-again">Again ↻</button><button class="secondary" id="new-resume">Choose another</button><button class="text-button" id="save-result">Save verdict ↓</button></div><p class="privacy-note">Random, not a résumé assessment.</p>';
    const stage = $('.resume-result'); stage.dataset.type = result.type;
    $('.result-symbol').textContent = result.symbol;
    $('h3', stage).textContent = result.title;
    $('p', stage).textContent = result.text;
    if (result.type === 'confetti' || result.type === 'promotion') {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 18; i++) {
        const piece = document.createElement('i');
        piece.style.setProperty('--x', `${(i * 19 + 3) % 100}%`);
        piece.style.setProperty('--delay', `${i % 6 * .06}s`);
        piece.style.setProperty('--color', ['#8b94c7', '#c47775', '#c1a45a', '#829463'][i % 4]);
        confetti.append(piece);
      }
      stage.prepend(confetti);
    }
    $('#spin-again').addEventListener('click', () => processResume(filename, isDemo));
    $('#new-resume').addEventListener('click', renderResume);
    $('#save-result').addEventListener('click', () => saveOutcome(result));
  }
  function saveOutcome(result) {
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 900;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e7e0f4'; ctx.fillRect(0, 0, 900, 900);
    ctx.textAlign = 'center'; ctx.fillStyle = '#34364b'; ctx.font = '500 20px Figtree, sans-serif'; ctx.fillText('RÉSUMÉ ROULETTE / YOUR VERDICT', 450, 88);
    ctx.font = '80px Figtree, sans-serif'; ctx.fillText(result.symbol, 450, 240);
    ctx.font = '650 67px Newsreader, Georgia, serif'; const titleHeight = wrapText(ctx, result.title, 450, 370, 730, 70);
    ctx.font = '400 28px Figtree, sans-serif'; wrapText(ctx, result.text, 450, 410 + titleHeight, 700, 42);
    ctx.font = '400 20px Figtree, sans-serif'; ctx.fillText('laidoffengineer.lol · this algorithm runs on vibes.', 450, 828);
    downloadCanvas(canvas, 'my-resume-verdict.png');
  }
  function renderAbout() {
    content.innerHTML = `<div class="about-symbol" aria-hidden="true">✳</div><h2 id="dialog-title">You are more<br>than <em>your job.</em></h2><div class="about-copy"><p>A little comic relief between jobs.</p></div><div class="dialog-actions"><button class="primary" id="back-to-play">Back to play ↗</button></div>`;
    $('#back-to-play').addEventListener('click', () => dialog.close());
  }

  function renderMemorial(grave) {
    content.innerHTML = '<h2 id="dialog-title"></h2><p class="memorial-epitaph"></p><div class="dialog-actions"><button class="primary" id="download-memorial">Save memorial ↓</button></div>';
    $('#dialog-title').textContent = `RIP ${grave.name}`;
    $('.memorial-epitaph').textContent = grave.epitaph;
    $('#download-memorial').addEventListener('click', () => downloadMemorial(grave.name, grave.epitaph));
  }

  // The Graveyard is a Three.js world, loaded the first time someone visits it.
  const decorativeGraves = [
    { name: 'Daily standups', epitaph: 'Could have been an email.' },
    { name: '“We’re a family”', epitaph: 'Adopted out.' },
    { name: 'The ping-pong table', epitaph: 'Never booked again.' }
  ];
  // Memorials are addressed by index, oldest first. A shared backend only needs these two calls;
  // the world requests one chunk-sized range at a time around the mascot.
  const graveSource = {
    count: () => readGraves().length || decorativeGraves.length,
    range: (start, end) => (readGraves().length ? readGraves() : decorativeGraves).slice(start, end)
  };
  let graveyardWorld = null;
  const music = window.graveyardMusic;
  let musicState = null;
  let graveyardLoad = null;

  function renderCemeteryCount() {
    const count = readGraves().length;
    $('#cemetery-count').textContent = `${count} memorial${count === 1 ? '' : 's'} · ${transientGraves ? 'this session' : 'on this device'}`;
    $('#cemetery-empty').hidden = !!count || !graveyardWorld;
  }

  function showNearbyMemorial(grave) {
    const prompt = $('#cemetery-prompt');
    prompt.hidden = !grave;
    if (grave) $('.prompt-name', prompt).textContent = `RIP ${grave.name}`;
  }

  function renderGraveyardFallback() {
    $('#cemetery-loading').hidden = true;
    const list = document.createElement('div');
    list.className = 'cemetery-fallback';
    const heading = document.createElement('p');
    heading.textContent = 'The 3D graveyard needs WebGL and a web server. Here are the latest memorials.';
    list.append(heading);
    const graves = readGraves().slice(-24).reverse();
    for (const grave of graves.length ? graves : decorativeGraves) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = `RIP ${grave.name}`;
      button.addEventListener('click', () => openExperience('memorial', grave));
      list.append(button);
    }
    $('#graveyard-world').replaceChildren(list);
    $('.cemetery').classList.add('is-fallback');
  }

  function showGraveyard() {
    music?.enter();
    renderCemeteryCount();
    if (graveyardWorld) { graveyardWorld.start(); return; }
    graveyardLoad ??= import('./graveyard3d.js').then(({ createGraveyardWorld }) => createGraveyardWorld({
      host: $('#graveyard-world'),
      stick: $('#cemetery-stick'),
      jumpButton: $('#cemetery-jump'),
      source: graveSource,
      isActive: () => currentPage === 'graveyard' && !dialog.open,
      onRead: grave => openExperience('memorial', grave),
      onNearby: showNearbyMemorial,
      reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    })).then(world => {
      graveyardWorld = world;
      $('#cemetery-loading').hidden = true;
      renderCemeteryCount();
      if (currentPage === 'graveyard') world.start();
    }).catch(renderGraveyardFallback);
  }

  function showMusicState(state) {
    musicState = state;
    const toggle = $('#music-toggle');
    toggle.hidden = state.status === 'unsupported';
    toggle.setAttribute('aria-pressed', String(state.enabled));
    toggle.textContent = !state.enabled ? '🔇 Music' : state.status === 'blocked' ? '🔈 Tap for music' : '🔊 Music';
    $('#music-next').hidden = !state.enabled || !state.canSkip;
    const nowPlaying = $('#now-playing');
    nowPlaying.hidden = !state.track;
    if (state.track) $('span', nowPlaying).textContent = state.track.credit || [state.track.title, state.track.artist].filter(Boolean).join(' — ');
  }

  function initGraveyard() {
    music?.onChange(showMusicState);
    $('#music-toggle').addEventListener('click', () => (musicState?.status === 'blocked' && musicState.enabled ? music.play() : music.toggle()));
    $('#music-next').addEventListener('click', () => music?.next());
    $('#graveyard-gate').addEventListener('click', () => graveyardWorld?.goToGate());
    $('#graveyard-newest').addEventListener('click', () => graveyardWorld?.goToMemorial(graveyardWorld.total - 1));
    $('#cemetery-read').addEventListener('click', () => graveyardWorld?.readNearby());
  }

  async function refreshGraveyard({ visitNewest = false } = {}) {
    renderCemeteryCount();
    if (!graveyardWorld) return;
    const total = await graveyardWorld.refresh();
    if (visitNewest) graveyardWorld.goToMemorial(total - 1);
  }

  function cancelWheelSpin() {
    wheelRun++;
    if (activeWheelAnimation) { activeWheelAnimation.cancel(); activeWheelAnimation = null; }
    wheelSpinning = false;
    spinButton.disabled = false;
    $('.spin-label').textContent = 'SPIN';
    $('.wheel-status').textContent = '';
    $('.wheel-frame').classList.remove('is-spinning');
  }

  function navigatePage(page, { history = true, focus = true } = {}) {
    if (!['home', 'graveyard', 'community'].includes(page)) page = 'home';
    currentPage = page;
    // Lets page-specific CSS react, e.g. the full-screen Graveyard.
    document.documentElement.dataset.page = page;
    if (page !== 'home') cancelWheelSpin();
    if (page !== 'graveyard') { graveyardWorld?.stop(); music?.leave(); }
    if (dialog.open) dialog.close();
    cleanup();
    document.querySelectorAll('.site-view').forEach(view => { view.hidden = view.id !== `${page}-view`; });
    document.querySelectorAll('.navigation-dock [data-page]').forEach(link => {
      if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (history && window.location.hash !== `#${page}`) window.history.pushState(null, '', `#${page}`);
    document.title = page === 'home' ? 'Laid Off Engineer — Still a legend.' : `${page === 'graveyard' ? 'Graveyard' : 'Community'} — Laid Off Engineer`;
    if (page === 'graveyard') showGraveyard();
    if (focus) {
      const heading = $(`#${page === 'home' ? 'hero' : page}-title`);
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  function initNavigation() {
    document.querySelectorAll('[data-page]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      navigatePage(link.dataset.page);
    }));
    initGraveyard();
    document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      $('#forum-category-title').textContent = button.dataset.category;
    }));
    window.addEventListener('hashchange', () => navigatePage(window.location.hash.slice(1), { history: false }));
    window.addEventListener('storage', event => { if (event.key === 'loe-graves') refreshGraveyard(); });
    navigatePage(window.location.hash.slice(1), { history: false, focus: false });
  }
  initNavigation();
})();
