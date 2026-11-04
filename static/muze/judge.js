'use strict';
(() => {
  const byId = name => document.getElementById('muze-' + name);
  const dialog = byId('intro');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const groups = [...document.querySelectorAll('#muze-takeover .muze-grid section')];
  const cues = groups.flatMap(group => [...group.querySelectorAll('li')].map(item =>
    `${group.querySelector('h3').textContent} / ${item.textContent}`
  ));
  const duration = 180;
  let elapsed = 0;
  let startedAt = null;
  let timer;

  function showCue() {
    const seconds = Math.max(0, Math.ceil(duration - elapsed));
    byId('clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    byId('timeline').value = elapsed;
    const index = Math.min(cues.length - 1, Math.floor(elapsed / duration * cues.length));
    byId('caption').textContent = elapsed === duration ? 'Walkthrough complete. Run the proof demo below.' :
      `${String(index + 1).padStart(2, '0')} / ${cues.length} · ${cues[index]}`;
  }

  function pause() {
    clearInterval(timer);
    startedAt = null;
    byId('play').textContent = elapsed && elapsed < duration ? 'Resume walkthrough' : 'Start walkthrough';
  }

  function update() {
    elapsed = Math.min(duration, (performance.now() - startedAt) / 1000);
    showCue();
    if (elapsed === duration) pause();
  }

  function play() {
    if (startedAt !== null) return;
    if (elapsed === duration) elapsed = 0;
    startedAt = performance.now() - elapsed * 1000;
    byId('play').textContent = 'Pause walkthrough';
    timer = setInterval(update, 100);
    showCue();
  }

  byId('play').addEventListener('click', () => {
    if (startedAt === null) play();
    else { update(); pause(); }
  });
  byId('reset').addEventListener('click', () => {
    elapsed = 0;
    pause();
    showCue();
  });

  const canvas = byId('tunnel');
  const context = canvas.getContext('2d');
  const particles = Array.from({ length: 90 }, () => ({ angle: Math.random() * Math.PI * 2, offset: Math.random() }));
  const introDuration = 3600;
  const logs = ['Loading protocol map…', 'Reading the sample token trace…', 'Opening the evidence walkthrough…'];
  let introFrame;
  let introStart;

  function drawIntro(now) {
    if (!dialog.open) return;
    const progress = Math.min(1, (now - introStart) / introDuration);
    byId('token').textContent = Math.round(1000000 - progress * 870000).toLocaleString('en-US');
    byId('intro-progress').value = progress;
    byId('intro-log').textContent = logs[Math.min(logs.length - 1, Math.floor(progress * logs.length))];
    if (context && !motion.matches) {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      particles.forEach(({ angle, offset }, index) => {
        const radius = (offset + progress) % 1 * Math.hypot(width, height) / 2;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;
        context.fillStyle = index % 2 ? '#79e6e5' : '#ffc367';
        context.fillRect(x, y, 3, 3);
      });
    }
    if (progress < 1) introFrame = requestAnimationFrame(drawIntro);
    else dialog.close();
  }

  function intro() {
    if (dialog.open) return;
    pause();
    elapsed = 0;
    dialog.showModal();
    if (motion.matches) {
      byId('token').textContent = '1,000,000';
      byId('intro-progress').value = 1;
      byId('intro-log').textContent = 'The walkthrough is ready.';
      return;
    }
    introStart = performance.now();
    introFrame = requestAnimationFrame(drawIntro);
  }

  dialog.addEventListener('close', () => {
    cancelAnimationFrame(introFrame);
    byId('play').focus();
    play();
  });
  byId('skip').addEventListener('click', () => dialog.close());
  if (typeof dialog.showModal === 'function') {
    byId('replay').hidden = false;
    byId('replay').addEventListener('click', intro);
    if (!motion.matches && !location.hash) intro();
  }

  const fields = ['project', 'team', 'repo'].map(byId);
  const output = byId('output');
  const status = byId('status');
  const storageKey = 'muze-v6-submission';
  const values = () => fields.map(field => field.value.trim());
  function refresh() {
    const [project, team, repo] = values();
    output.value = [
      '# ' + (project || 'MuZe V6'), '',
      'Team · ' + (team || '[Add team names]'),
      'Repository · ' + (repo || '[Add repository URL]'), '',
      '## Summary', 'A self-hosted workspace for reviewing agent proposals and verifying evidence.', '',
      '## Judge demo', 'Fixture lead → template draft → payload-bound decision → evidence export → offline verification.', '',
      '## Architecture', 'BroCODE presentation → MuzeBOS owner console → SQLite evidence → offline verifier.', '',
      '## Protocol roadmap', ...cues.map((cue, index) => `${index + 1}. ${cue}`), '',
      '## Submission notes', '- 1M → 130K is an illustrative trace.', '- Meta integrations are a pilot goal subject to provider approval.', '- Attach a reviewed evidence sample and confirmed project results.'
    ].join('\n');
  }

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(saved)) fields.forEach((field, i) => {
      if (typeof saved[i] === 'string') field.value = saved[i].slice(0, field.maxLength);
    });
  } catch { /* Storage can be unavailable. The draft still works in memory. */ }
  fields.forEach(field => field.addEventListener('input', refresh));
  refresh();

  byId('save').addEventListener('click', () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(values()));
      status.textContent = 'Draft saved on this device.';
    } catch {
      status.textContent = 'Device storage is unavailable. Download the draft to keep it.';
    }
  });
  byId('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      status.textContent = 'Markdown copied.';
    } catch {
      output.focus();
      output.select();
      status.textContent = 'Markdown selected. Use your device’s copy shortcut.';
    }
  });
  byId('download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([output.value], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'submission.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
