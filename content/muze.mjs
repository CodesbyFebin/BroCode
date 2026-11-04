export const stages = [
  ['Token', ['Semantic deduplication', 'Sample token trace', 'Compression review']],
  ['Wire', ['Direct agent messages', 'Typed envelopes', 'Message replay protection']],
  ['Mesh', ['Peer discovery', 'ZkWorld routing', 'Peer health']],
  ['Swarm', ['Task queue', 'Worker claims', 'Failure and retry']],
  ['Marketplace', ['Skill recipes', 'Human skill review', 'Versioned registry']],
  ['Sovereign', ['Self-hosted server', 'Local business data', 'Local model routing']],
  ['Verify', ['Check evidence chain', 'Review payload hash', 'Offline receipt verification']],
  ['Prove', ['Evidence bundle', 'Merkle inclusion proof', 'zkVM receipt']],
  ['Audit', ['Human approval', 'Evidence export', 'MetaPenAudit gate']],
  ['Release', ['Staged rollout', 'Rollback plan', 'Submission draft']],
];

const boss = 'https://github.com/CodesbyFebin/MuzeBOS--The-Zero-Trust-Business-OS';

export const muzeBody = `
<link rel="stylesheet" href="/muze/judge.css">
<section class="muze" aria-labelledby="muze-title">
  <header class="muze-hero">
    <p class="muze-kicker">BROCODE ARENA / MUZE V6</p>
    <h1 id="muze-title" tabindex="-1">Agents with a place to work.</h1>
    <p>Follow a draft through human approval and inspect the evidence it leaves behind.</p>
    <div class="muze-actions">
      <button type="button" id="muze-replay" hidden>Replay intro</button>
      <a href="#muze-demo">Run the proof demo</a>
    </div>
  </header>
  <dialog id="muze-intro" aria-labelledby="muze-intro-title">
    <canvas id="muze-tunnel" aria-hidden="true"></canvas>
    <div class="muze-intro-copy">
      <p class="muze-kicker">MUZE V6 / JUDGE MODE</p>
      <h2 id="muze-intro-title">Powering up the workspace</h2>
      <p><strong id="muze-token">1,000,000</strong> → <strong>130,000</strong> tokens</p>
      <p class="muze-kicker">SAMPLE TRACE · ILLUSTRATIVE</p>
      <progress id="muze-intro-progress" max="1" value="0" aria-label="Intro progress"></progress>
      <p id="muze-intro-log">Loading protocol map…</p>
      <button type="button" id="muze-skip" autofocus>Skip intro</button>
    </div>
  </dialog>
  <section id="muze-takeover" class="muze-panel" aria-labelledby="muze-takeover-title">
    <p class="muze-kicker">PROTOCOL ROADMAP · 30 CUES</p>
    <h2 id="muze-takeover-title">Judge takeover <span id="muze-clock">03:00</span></h2>
    <progress id="muze-timeline" max="180" value="0" aria-label="Takeover progress"></progress>
    <p id="muze-caption">Start the walkthrough to cycle through the protocol map.</p>
    <div class="muze-actions">
      <button type="button" id="muze-play">Start walkthrough</button>
      <button type="button" id="muze-reset">Reset</button>
    </div>
    <details>
      <summary>View all 30 cues</summary>
      <div class="muze-grid">${stages.map(([name, cues], i) => `<section><h3>${name}</h3><ol start="${i * 3 + 1}">${cues.map(cue => `<li>${cue}</li>`).join('')}</ol></section>`).join('')}</div>
    </details>
  </section>
  <section id="muze-demo" class="muze-panel">
    <p class="muze-kicker">SELF-HOSTED DEMO</p>
    <h2>From draft to evidence</h2>
    <ol>
      <li>Start MuzeBOS locally and open the judge demo as the owner.</li>
      <li>Insert the fixture lead and propose an editable template reply.</li>
      <li>Make a human decision on the exact payload, then inspect the audit trail.</li>
      <li>Export the evidence bundle and run the offline verifier.</li>
    </ol>
    <div class="muze-actions">
      <a href="http://localhost:3000/workspace/builder/demo">Open local judge demo</a>
      <a href="${boss}#readme">MuzeBOS setup</a>
      <a href="/meta-500/">Browse sample catalog</a>
    </div>
  </section>
  <section id="muze-submission" class="muze-panel">
    <p class="muze-kicker">HACKATHON / SUBMISSION DESK</p>
    <h2>Prepare a submission</h2>
    <p>Drafts can be saved on this device. Review your evidence before sending a submission.</p>
    <div class="muze-fields">
      <label>Project name<input type="text" id="muze-project" maxlength="120" value="MuZe V6"></label>
      <label>Team names<input type="text" id="muze-team" maxlength="240"></label>
      <label>Repository URL<input id="muze-repo" type="url" maxlength="400" value="${boss}"></label>
    </div>
    <label>Submission Markdown<textarea id="muze-output" rows="9" readonly></textarea></label>
    <div class="muze-actions">
      <button type="button" id="muze-save">Save draft on device</button>
      <button type="button" id="muze-copy">Copy Markdown</button>
      <button type="button" id="muze-download">Download submission.md</button>
      <a href="/muze/pitch.md" download>Download pitch outline</a>
    </div>
    <p id="muze-status" role="status"></p>
  </section>
</section>
<script src="/muze/judge.js" defer></script>`;
