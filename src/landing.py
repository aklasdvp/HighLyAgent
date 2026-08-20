"""Public landing page served at GET / for browsers.

Security notes — this page is intentionally safe to expose:
  • no version number, no internal hosts/ports, no admin or ws URLs
  • no user-controlled input is ever interpolated (static template + boot time only)
  • API clients (Accept: application/json) get a minimal JSON body instead
"""
from __future__ import annotations

_PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HighLyAgent — Universal AI Middleware</title>
<meta name="description" content="HighLyAgent is a self-learning AI middleware. Ask once — the agent learns the answer and serves every repeat from its knowledge base at zero AI cost.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230B0E12'/%3E%3Ccircle cx='16' cy='10' r='3.2' fill='%23F2A93B'/%3E%3Ccircle cx='9' cy='22' r='2.5' fill='%2323BFA5'/%3E%3Ccircle cx='23' cy='22' r='2.5' fill='%2323BFA5'/%3E%3Cpath d='M16 13 9.6 20M16 13l6.4 7M11.5 22h9' stroke='%23F2A93B' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>document.documentElement.className += ' js';</script>
<style>
  :root{
    --ink:#0B0E12; --panel:#12161C; --panel2:#171D25; --line:#232B35; --line2:#2E3844;
    --mist:#EAEEF4; --dim:#8B95A3; --faint:#5A6472;
    --amber:#F2A93B; --teal:#23BFA5; --cobalt:#609CF0;
    --disp:'Space Grotesk',system-ui,sans-serif;
    --body:'IBM Plex Sans',system-ui,sans-serif;
    --mono:'JetBrains Mono',ui-monospace,monospace;
  }
  *{box-sizing:border-box;margin:0}
  html{scroll-behavior:smooth}
  body{background:var(--ink);color:var(--mist);font-family:var(--body);font-size:15px;line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  ::selection{background:rgba(242,169,59,.28)}

  /* layered ambient background */
  body::before{content:'';position:fixed;inset:-80px;z-index:-2;pointer-events:none;background:
    radial-gradient(900px 540px at 12% -8%, rgba(35,191,165,.08), transparent 62%),
    radial-gradient(820px 500px at 96% 6%, rgba(242,169,59,.065), transparent 60%),
    radial-gradient(760px 760px at 50% 115%, rgba(96,156,240,.06), transparent 62%);
    animation:drift 36s ease-in-out infinite alternate}
  body::after{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;
    background-image:radial-gradient(rgba(234,238,244,.05) 1px, transparent 1px);background-size:26px 26px;
    -webkit-mask-image:linear-gradient(to bottom, rgba(0,0,0,.8), transparent 52%);
            mask-image:linear-gradient(to bottom, rgba(0,0,0,.8), transparent 52%)}
  @keyframes drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(-46px,28px,0) scale(1.05)}}

  .wrap{max-width:1080px;margin:0 auto;padding:0 24px}

  /* topbar */
  .top{display:flex;align-items:center;gap:14px;padding:22px 0;border-bottom:1px solid var(--line)}
  .mark{display:flex;align-items:center;gap:11px}
  .mark svg{display:block}
  .mark b{font-family:var(--disp);font-weight:700;font-size:17px;letter-spacing:-.01em}
  .mark small{font-family:var(--mono);font-size:9px;letter-spacing:.22em;color:var(--faint);text-transform:uppercase;display:block;margin-top:1px}
  .top .right{margin-left:auto;display:flex;align-items:center;gap:16px}
  .status{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;color:var(--teal);
    border:1px solid rgba(35,191,165,.35);background:rgba(35,191,165,.08);padding:6px 12px;border-radius:999px;text-transform:uppercase}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--teal);position:relative}
  .dot::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:1.5px solid var(--teal);opacity:.5;animation:ping 2.2s ease-out infinite}
  @keyframes ping{0%{transform:scale(.5);opacity:.7}80%,100%{transform:scale(1.5);opacity:0}}
  .clock{font-family:var(--mono);font-size:11.5px;color:var(--dim);letter-spacing:.06em}
  .clock b{color:var(--mist);font-weight:500}

  /* opening */
  .open{display:grid;grid-template-columns:1.02fr .98fr;gap:56px;align-items:center;padding:72px 0 64px}
  .tag{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--amber);
    display:inline-flex;align-items:center;gap:8px;margin-bottom:22px}
  .tag::before{content:'';width:26px;height:1px;background:var(--amber)}
  h1{font-family:var(--disp);font-weight:700;font-size:clamp(34px,4.6vw,54px);line-height:1.06;letter-spacing:-.025em}
  h1 em{font-style:normal;color:var(--amber)}
  h1 .tl{color:var(--teal)}
  .lede{color:var(--dim);font-size:16.5px;max-width:52ch;margin:22px 0 26px}
  .lede b{color:var(--mist);font-weight:500}
  .chips{display:flex;flex-wrap:wrap;gap:9px}
  .chip{font-family:var(--mono);font-size:11px;color:var(--dim);border:1px solid var(--line2);border-radius:7px;padding:6px 11px;
    background:rgba(18,22,28,.7);transition:border-color .2s,color .2s,transform .2s}
  .chip:hover{border-color:var(--amber);color:var(--mist);transform:translateY(-2px)}
  .chip i{font-style:normal;color:var(--amber);margin-right:6px}

  /* topology svg */
  .topo{position:relative;border:1px solid var(--line);border-radius:14px;background:linear-gradient(160deg, var(--panel), rgba(18,22,28,.4));padding:18px 14px 10px}
  .topo .cap{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);padding:0 8px 8px}
  .topo svg{width:100%;height:auto;display:block}
  .edge{stroke:var(--line2);stroke-width:1.4;fill:none;stroke-dasharray:3 5}
  .node-rect{fill:var(--panel2);stroke:var(--line2);stroke-width:1.2;transition:stroke .25s}
  g.n:hover .node-rect{stroke:var(--amber)}
  .nlabel{font-family:var(--mono);font-size:10px;fill:var(--dim);letter-spacing:.08em}
  .nsub{font-family:var(--mono);font-size:8.5px;fill:var(--faint);letter-spacing:.06em}
  .core{fill:#1A2029;stroke:var(--amber);stroke-width:1.6}
  .core-txt{font-family:var(--disp);font-weight:700;font-size:13px;fill:var(--mist)}
  .ring{fill:none;stroke:rgba(242,169,59,.4);stroke-width:1;stroke-dasharray:4 7;transform-origin:290px 216px;animation:spin 16s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .pingring{fill:none;stroke:var(--teal);stroke-width:1.4;opacity:0;transform-origin:290px 216px;animation:coreping 3s ease-out infinite}
  @keyframes coreping{0%{transform:scale(.72);opacity:.8}75%,100%{transform:scale(1.28);opacity:0}}
  .pkt{fill:var(--amber)} .pkt.t{fill:var(--teal)}

  /* flow rail */
  .flowhead{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;padding-top:8px}
  h2{font-family:var(--disp);font-weight:600;font-size:clamp(21px,2.4vw,27px);letter-spacing:-.015em}
  .flowhead .note{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--teal);letter-spacing:.06em}
  .steps{margin-top:22px;border-top:1px solid var(--line)}
  .step{display:grid;grid-template-columns:64px 210px 1fr auto;gap:18px;align-items:center;padding:20px 14px;border-bottom:1px solid var(--line);
    transition:background .25s,transform .25s}
  .step:hover{background:rgba(23,29,37,.75);transform:translateX(4px)}
  .step .no{font-family:var(--mono);font-size:13px;color:var(--amber)}
  .step .nm{font-family:var(--disp);font-weight:600;font-size:17px}
  .step .ds{color:var(--dim);font-size:14px}
  .step .tg{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);
    border:1px solid rgba(35,191,165,.35);background:rgba(35,191,165,.07);padding:4px 9px;border-radius:6px;white-space:nowrap}
  .step.hot{box-shadow:inset 3px 0 0 var(--amber)}
  .step.hot .tg{color:var(--amber);border-color:rgba(242,169,59,.4);background:rgba(242,169,59,.07)}

  /* stat line */
  .stats{display:flex;flex-wrap:wrap;gap:0;margin:52px 0 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .stat{flex:1 1 180px;padding:24px 22px;border-right:1px solid var(--line)}
  .stat:last-child{border-right:0}
  .stat .v{font-family:var(--disp);font-weight:700;font-size:26px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
  .stat .v small{font-size:14px;color:var(--dim);font-weight:500}
  .stat .l{font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);margin-top:5px}

  .surfaces{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:40px 0 0}
  .surfaces .sl{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}

  footer{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:30px 0 40px;margin-top:56px;border-top:1px solid var(--line)}
  footer .f1{font-family:var(--disp);font-weight:600;font-size:14px}
  footer .f2{font-family:var(--mono);font-size:10.5px;color:var(--faint);letter-spacing:.06em}
  footer .f3{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--teal);display:flex;align-items:center;gap:7px;letter-spacing:.1em;text-transform:uppercase}

  /* reveals */
  .js [data-reveal]{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.2,.7,.3,1),transform .7s cubic-bezier(.2,.7,.3,1)}
  .js [data-reveal].in{opacity:1;transform:none}

  @media (max-width:920px){
    .open{grid-template-columns:1fr;gap:40px;padding:48px 0}
    .step{grid-template-columns:44px 1fr;grid-template-rows:auto auto}
    .step .ds{grid-column:2}
    .step .tg{grid-column:2;justify-self:start}
    .clock{display:none}
  }
  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation:none!important;transition:none!important}
    .js [data-reveal]{opacity:1;transform:none}
  }
</style>
</head>
<body>
<div class="wrap">

  <!-- topbar -->
  <header class="top">
    <div class="mark">
      <svg width="34" height="34" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#12161C" stroke="#232B35"/>
        <circle cx="16" cy="10" r="3" fill="#F2A93B"/>
        <circle cx="9" cy="22" r="2.3" fill="#23BFA5"/>
        <circle cx="23" cy="22" r="2.3" fill="#23BFA5"/>
        <path d="M16 13 9.6 20M16 13l6.4 7M11.5 22h9" stroke="#F2A93B" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <div><b>HighLyAgent</b><small>AI Middleware</small></div>
    </div>
    <div class="right">
      <span class="clock">UTC <b id="utc">--:--:--</b></span>
      <span class="status"><span class="dot"></span>Operational</span>
    </div>
  </header>

  <!-- opening: live topology, not a hero -->
  <section class="open">
    <div data-reveal>
      <span class="tag">Universal AI Middleware</span>
      <h1>Ask once.<br>The agent <em>learns it</em> —<br>repeats cost <span class="tl">nothing</span>.</h1>
      <p class="lede">HighLyAgent sits between your applications and AI providers. The first question is
        answered by a model; the answer is saved to a vector knowledge base, so every similar question
        after that is served instantly — <b>at zero AI tokens</b>. Teams cut provider spend by 70–80%.</p>
      <div class="chips">
        <span class="chip"><i>◆</i>Self-learning knowledge base</span>
        <span class="chip"><i>◆</i>Multi-project API keys</span>
        <span class="chip"><i>◆</i>Real-time WebSocket gateway</span>
        <span class="chip"><i>◆</i>OpenAI · Gemini · Claude · DeepSeek</span>
      </div>
    </div>

    <div class="topo" data-reveal>
      <div class="cap"><span>// live topology</span><span>knowledge-first routing</span></div>
      <svg viewBox="0 0 560 420" role="img" aria-label="Clients connect to the HighLyAgent core, which routes to the knowledge base and AI providers">
        <!-- edges -->
        <path id="e1" class="edge" d="M84 84 C 170 84, 180 196, 248 208"/>
        <path id="e2" class="edge" d="M84 172 C 160 172, 175 202, 248 212"/>
        <path id="e3" class="edge" d="M84 260 C 160 260, 175 232, 248 222"/>
        <path id="e4" class="edge" d="M84 348 C 170 348, 180 240, 248 226"/>
        <path id="e5" class="edge" d="M332 204 C 400 192, 428 136, 464 132"/>
        <path id="e6" class="edge" d="M332 230 C 400 242, 428 300, 464 302"/>

        <!-- client nodes -->
        <g class="n"><rect class="node-rect" x="40" y="66" width="44" height="34" rx="8"/><text class="nlabel" x="62" y="88" text-anchor="middle">W</text><text class="nsub" x="62" y="115" text-anchor="middle">web</text></g>
        <g class="n"><rect class="node-rect" x="40" y="154" width="44" height="34" rx="8"/><text class="nlabel" x="62" y="176" text-anchor="middle">M</text><text class="nsub" x="62" y="203" text-anchor="middle">mobile</text></g>
        <g class="n"><rect class="node-rect" x="40" y="242" width="44" height="34" rx="8"/><text class="nlabel" x="62" y="264" text-anchor="middle">D</text><text class="nsub" x="62" y="291" text-anchor="middle">desktop</text></g>
        <g class="n"><rect class="node-rect" x="40" y="330" width="44" height="34" rx="8"/><text class="nlabel" x="62" y="352" text-anchor="middle">I</text><text class="nsub" x="62" y="379" text-anchor="middle">iot</text></g>

        <!-- core -->
        <circle class="pingring" cx="290" cy="216" r="44"/>
        <circle class="ring" cx="290" cy="216" r="52"/>
        <polygon class="core" points="326,216 308,185 272,185 254,216 272,247 308,247"/>
        <text class="core-txt" x="290" y="212" text-anchor="middle">HighLy</text>
        <text class="core-txt" x="290" y="228" text-anchor="middle">Agent</text>

        <!-- knowledge + providers -->
        <g class="n">
          <rect class="node-rect" x="466" y="104" width="86" height="56" rx="9"/>
          <line x1="480" y1="122" x2="538" y2="122" stroke="#2E3844" stroke-width="1.2"/>
          <line x1="480" y1="132" x2="538" y2="132" stroke="#2E3844" stroke-width="1.2"/>
          <line x1="480" y1="142" x2="520" y2="142" stroke="#2E3844" stroke-width="1.2"/>
          <text class="nsub" x="509" y="178" text-anchor="middle">knowledge · pgvector</text>
        </g>
        <g class="n">
          <rect class="node-rect" x="466" y="276" width="86" height="56" rx="9"/>
          <path d="M509 290l4 9 9 1.5-7 6.5 2 9.5-8-5-8 5 2-9.5-7-6.5 9-1.5z" fill="none" stroke="#23BFA5" stroke-width="1.3" stroke-linejoin="round"/>
          <text class="nsub" x="509" y="350" text-anchor="middle">ai providers</text>
        </g>

        <!-- travelling packets -->
        <circle class="pkt" r="3.4"><animateMotion dur="3.4s" repeatCount="indefinite" begin="0s"><mpath href="#e1"/></animateMotion></circle>
        <circle class="pkt" r="3.4"><animateMotion dur="3.4s" repeatCount="indefinite" begin="1.2s"><mpath href="#e3"/></animateMotion></circle>
        <circle class="pkt" r="3.4"><animateMotion dur="3.4s" repeatCount="indefinite" begin="2.3s"><mpath href="#e2"/></animateMotion></circle>
        <circle class="pkt t" r="3.4"><animateMotion dur="2.8s" repeatCount="indefinite" begin="0.6s"><mpath href="#e5"/></animateMotion></circle>
        <circle class="pkt t" r="3.4"><animateMotion dur="2.8s" repeatCount="indefinite" begin="1.9s"><mpath href="#e6"/></animateMotion></circle>
      </svg>
    </div>
  </section>

  <!-- how a request flows -->
  <section data-reveal>
    <div class="flowhead">
      <h2>How a request is handled</h2>
      <span class="note">knowledge-first → provider spend ↓ 70–80%</span>
    </div>
    <div class="steps">
      <div class="step">
        <span class="no">01</span><span class="nm">Authenticate</span>
        <span class="ds">Every call carries a Project ID + its scoped API key. A mismatched pair is rejected before anything runs.</span>
        <span class="tg">dual-factor</span>
      </div>
      <div class="step hot">
        <span class="no">02</span><span class="nm">Vector search</span>
        <span class="ds">The question is embedded and matched against the project's knowledge base. A hit returns instantly — no model is called.</span>
        <span class="tg">0 tokens on repeat</span>
      </div>
      <div class="step">
        <span class="no">03</span><span class="nm">Tools, then a model</span>
        <span class="ds">On a miss, the agent may run a tool (weather, math, currency…) and asks the configured provider, with automatic fallback.</span>
        <span class="tg">fallback chain</span>
      </div>
      <div class="step">
        <span class="no">04</span><span class="nm">Learn</span>
        <span class="ds">The new answer is embedded and stored, so the next similar question is a free, instant hit. The loop tightens with every request.</span>
        <span class="tg">self-learning</span>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="v" id="up">0s</div><div class="l">uptime this boot</div></div>
      <div class="stat"><div class="v">0 <small>tokens</small></div><div class="l">cost of a repeated answer</div></div>
      <div class="stat"><div class="v">4 <small>surfaces</small></div><div class="l">web · mobile · desktop · iot</div></div>
      <div class="stat"><div class="v">2 <small>languages</small></div><div class="l">বাংলা + english, one brain</div></div>
    </div>

    <div class="surfaces">
      <span class="sl">Talks to</span>
      <span class="chip">REST · JSON</span>
      <span class="chip">WebSocket · real-time</span>
      <span class="chip">JWT admin plane</span>
    </div>
  </section>

  <footer>
    <span class="f1">HighLyAgent</span>
    <span class="f2">Universal AI Middleware — self-learning agent core</span>
    <span class="f3"><span class="dot"></span>all systems operational</span>
  </footer>

</div>
<script>
(function(){
  var boot = __BOOT_MS__;
  function pad(n){ return (n<10?'0':'')+n; }
  function tick(){
    var d = new Date();
    var utc = document.getElementById('utc');
    if (utc) utc.textContent = pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds());
    var s = Math.max(0, Math.floor((Date.now()-boot)/1000));
    var el = document.getElementById('up');
    if (el){
      var dd = Math.floor(s/86400), hh = Math.floor(s%86400/3600), mm = Math.floor(s%3600/60), ss = s%60;
      el.textContent = (dd? dd+'d ':'') + pad(hh)+':'+pad(mm)+':'+pad(ss);
    }
  }
  tick(); setInterval(tick, 1000);

  if ('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12});
    document.querySelectorAll('[data-reveal]').forEach(function(n){ io.observe(n); });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function(n){ n.classList.add('in'); });
  }
})();
</script>
</body>
</html>
"""


def render(boot_ms: int) -> str:
    """Inject only the server boot timestamp — everything else is static."""
    return _PAGE.replace("__BOOT_MS__", str(int(boot_ms)))
