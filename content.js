(() => {
  if (window.__adlens) return;
  window.__adlens = true;

  // ---------- state ----------
  const ads = new Map();
  let saved = {};
  let tab = "ads";
  let sortBy = "days";
  let filter = "";
  let live = true;
  let scrolling = false;
  let target = 100;

  const CTAS = ["Shop now","Learn more","Sign up","Download","Book now","Order now","Get offer","Contact us","Send message","Install now","Watch more","Apply now","Get quote","Subscribe","Buy now","Call now","Get directions","Play game","Use app","Listen now","See menu","Request time","Donate now","Send WhatsApp message","WhatsApp message"];
  const STOP = new Set("the a an and or to of in on for with is are you your we our it this that at by from as be have has will can not no all get more new now me my us they them their so if but just out up what how when who which than then about into over also one two its was were been".split(" "));
  const NOISE = /^(Library ID|Started running|Active$|Inactive$|Platforms|See ad details|See summary details|Open Dropdown|Sponsored|\d+:\d+\s*\/\s*\d+:\d+|\d+ ads? use|This ad has multiple versions|Ad Library|Status)/i;

  // ---------- extraction ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const idRe = /Library ID:?\s*(\d{6,})/g;
  const countIds = (el) => (el.innerText || "").match(idRe)?.length || 0;

  function findContainers() {
    const found = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!/Library ID/i.test(n.nodeValue)) continue;
      let el = n.parentElement;
      for (let i = 0; i < 4 && el && countIds(el) < 1; i++) el = el.parentElement;
      if (!el || countIds(el) !== 1) continue;
      for (let d = 0; d < 18; d++) {
        const p = el.parentElement;
        if (!p || p === document.body || countIds(p) !== 1) break;
        el = p;
      }
      const id = ((el.innerText || "").match(/Library ID:?\s*(\d{6,})/) || [])[1];
      if (id && !found.has(id)) found.set(id, el);
    }
    return found;
  }

  function decodeLink(href) {
    try {
      const u = new URL(href);
      if (u.hostname === "l.facebook.com") return u.searchParams.get("u") || href;
    } catch (e) {}
    return href;
  }

  function parseAd(id, el) {
    const t = el.innerText || "";
    const lines = t.split("\n").map((s) => s.trim()).filter(Boolean);
    const status = /\bInactive\b/.test(t) ? "Inactive" : /\bActive\b/.test(t) ? "Active" : "";
    const dateRe = "([A-Z][a-z]{2,8} \\d{1,2}, \\d{4}|\\d{1,2} [A-Z][a-z]{2,8} \\d{4})";
    const started = (t.match(new RegExp("Started running on\\s*:?\\s*" + dateRe)) || [])[1];
    const range = t.match(new RegExp(dateRe + "\\s*[-–]\\s*" + dateRe));
    const start = started || (range && range[1]) || "";
    const end = range ? range[2] : "";
    let days = null;
    if (start) {
      const s = Date.parse(start);
      const e = end ? Date.parse(end) : Date.now();
      if (!isNaN(s) && !isNaN(e)) days = Math.max(0, Math.round((e - s) / 864e5));
    }

    // advertiser + copy
    const sIdx = lines.findIndex((l) => /^Sponsored$/i.test(l));
    let advertiser = sIdx > 0 ? lines[sIdx - 1] : "";
    if (!advertiser) {
      const a = [...el.querySelectorAll("a[href]")].find((x) => x.innerText.trim() && /facebook\.com\/(?!ads\/|l\.php)/.test(x.href) && !/See ad details/i.test(x.innerText));
      advertiser = a ? a.innerText.trim() : "";
    }
    let cta = "";
    const copyLines = [];
    const after = sIdx >= 0 ? lines.slice(sIdx + 1) : lines;
    for (const l of after) {
      const hit = CTAS.find((c) => c.toLowerCase() === l.toLowerCase());
      if (hit) { cta = hit; break; }
      if (NOISE.test(l) || l === advertiser || /^See more$/i.test(l) || /^[A-Z0-9.\-]+\.(COM|NET|ORG|CO|IO|SHOP|STORE|APP|XYZ)\b/i.test(l) && l.length < 40) continue;
      copyLines.push(l);
    }
    if (!cta) {
      const hit = lines.find((l) => CTAS.some((c) => c.toLowerCase() === l.toLowerCase()));
      cta = hit || "";
    }
    const copy = copyLines.join("\n").slice(0, 2000);

    // landing
    const la = el.querySelector('a[href*="l.facebook.com/l.php"]');
    const landing = la ? decodeLink(la.href) : "";

    // media
    const video = el.querySelector("video");
    let type = video ? "Video" : "Image";
    let thumb = video ? video.poster || "" : "";
    if (!thumb) {
      const imgs = [...el.querySelectorAll("img")].filter((i) => i.src && (i.naturalWidth > 120 || i.width > 120));
      imgs.sort((a, b) => b.width * b.height - a.width * a.height);
      thumb = imgs[0]?.src || "";
    }
    const variants = parseInt((t.match(/(\d+)\s+ads? use this creative/i) || [])[1] || "1", 10);

    return { id, advertiser, status, start, end, days, variants, type, cta, copy, landing, thumb, link: "https://www.facebook.com/ads/library/?id=" + id };
  }

  function scan() {
    const before = ads.size;
    const found = findContainers();
    found.forEach((el, id) => {
      try {
        const a = parseAd(id, el);
        const old = ads.get(id);
        ads.set(id, old ? { ...old, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== "" && v !== null)) } : a);
      } catch (e) {}
    });
    if (ads.size !== before) render();
    else updateCount();
    return ads.size - before;
  }

  // ---------- analysis ----------
  const list = (src) => {
    let l = [...src];
    const q = filter.trim().toLowerCase();
    if (q) l = l.filter((a) => (a.advertiser + " " + a.copy + " " + a.cta + " " + a.landing).toLowerCase().includes(q));
    const s = {
      days: (a, b) => (b.days ?? -1) - (a.days ?? -1),
      variants: (a, b) => b.variants - a.variants,
      name: (a, b) => a.advertiser.localeCompare(b.advertiser),
    }[sortBy];
    return l.sort(s);
  };
  const top = (arr, n) => {
    const m = new Map();
    arr.forEach((x) => x && m.set(x, (m.get(x) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  };
  const bars = (rows) => {
    if (!rows.length) return '<div class="muted">No data yet</div>';
    const max = rows[0][1];
    return rows.map(([k, v]) => `<div class="bar"><span class="bl" title="${esc(k)}">${esc(k)}</span><span class="bt"><i style="width:${(v / max) * 100}%"></i></span><b>${v}</b></div>`).join("");
  };
  function insights() {
    const l = list(ads.values());
    if (!l.length) return '<div class="muted">Scan ads first.</div>';
    const advs = top(l.map((a) => a.advertiser), 8);
    const active = l.filter((a) => a.status === "Active").length;
    const vid = l.filter((a) => a.type === "Video").length;
    const withDays = l.filter((a) => a.days !== null);
    const avgDays = withDays.length ? Math.round(withDays.reduce((s, a) => s + a.days, 0) / withDays.length) : 0;
    const avgLen = Math.round(l.reduce((s, a) => s + a.copy.length, 0) / l.length);
    const winners = [...withDays].sort((a, b) => b.days - a.days).slice(0, 5);
    const words = [];
    l.forEach((a) => {
      const w = (a.copy.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []).filter((x) => x.length > 2 && !STOP.has(x) && !/^\d+$/.test(x));
      new Set(w).forEach((x) => words.push(x));
    });
    const hooks = top(l.map((a) => a.copy.split(/\s+/).slice(0, 3).join(" ").toLowerCase()).filter((h) => h.split(" ").length === 3), 6).filter((h) => h[1] > 1);
    const domains = top(l.map((a) => { try { return new URL(a.landing).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }), 6);
    return `
      <div class="grid">
        <div class="stat"><b>${l.length}</b><span>ads</span></div>
        <div class="stat"><b>${new Set(l.map((a) => a.advertiser)).size}</b><span>advertisers</span></div>
        <div class="stat"><b>${Math.round((active / l.length) * 100)}%</b><span>active</span></div>
        <div class="stat"><b>${Math.round((vid / l.length) * 100)}%</b><span>video</span></div>
        <div class="stat"><b>${avgDays}d</b><span>avg run</span></div>
        <div class="stat"><b>${avgLen}</b><span>avg copy chars</span></div>
      </div>
      <h4>Top advertisers (ad count)</h4>${bars(advs)}
      <h4>Longest running (winner signal)</h4>
      ${winners.map((a) => `<div class="row"><a href="${esc(a.link)}" target="_blank">${esc(a.advertiser || a.id)}</a><b>${a.days}d</b></div>`).join("") || '<div class="muted">No dates found</div>'}
      <h4>Top CTA</h4>${bars(top(l.map((a) => a.cta), 6))}
      <h4>Top keywords in copy</h4>${bars(top(words, 12))}
      <h4>Common hooks (first 3 words)</h4>${bars(hooks)}
      <h4>Landing domains</h4>${bars(domains)}`;
  }

  // ---------- export ----------
  const FIELDS = ["id", "advertiser", "status", "start", "end", "days", "variants", "type", "cta", "copy", "landing", "thumb", "link"];
  function toCSV(rows) {
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    return "\ufeff" + [FIELDS.join(",")].concat(rows.map((r) => FIELDS.map((f) => q(r[f])).join(","))).join("\n");
  }
  function download(name, text, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);

  // ---------- storage ----------
  const store = chrome.storage.local;
  store.get("saved").then((r) => { saved = r.saved || {}; render(); }).catch(() => {});
  const persist = () => store.set({ saved }).catch(() => {});

  // ---------- UI ----------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;top:12px;right:12px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
  <style>
    *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    .p{width:390px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#fff;color:#1c1e21;border:1px solid #d0d4da;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);font-size:13px;overflow:hidden}
    .p.min .body,.p.min .bar2,.p.min .tabs,.p.min .tools{display:none}
    .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1877f2;color:#fff;font-weight:600}
    .hd span{flex:1}.hd button{background:rgba(255,255,255,.2);color:#fff;border:0;border-radius:6px;padding:2px 8px;cursor:pointer}
    .tools{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-bottom:1px solid #eee}
    button.b{background:#e7f0ff;color:#1155c0;border:0;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:12px}
    button.b:hover{background:#d3e4ff}button.b.on{background:#1877f2;color:#fff}
    .bar2{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid #eee}
    input,select{border:1px solid #ccd0d5;border-radius:6px;padding:5px 7px;font-size:12px}input{flex:1;min-width:0}
    .tabs{display:flex;border-bottom:1px solid #eee}
    .tabs div{flex:1;text-align:center;padding:8px;cursor:pointer;color:#65676b}
    .tabs div.on{color:#1877f2;border-bottom:2px solid #1877f2;font-weight:600}
    .body{overflow:auto;padding:10px 12px}
    .card{display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0}
    .th{width:64px;height:64px;border-radius:6px;background:#eee center/cover no-repeat;flex:none;position:relative}
    .th em{position:absolute;bottom:2px;right:2px;background:#000a;color:#fff;font-size:9px;padding:0 4px;border-radius:3px;font-style:normal}
    .ci{flex:1;min-width:0}
    .ci strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .meta{color:#65676b;font-size:11px;margin:2px 0}
    .tag{display:inline-block;padding:0 6px;border-radius:8px;font-size:10px;margin-right:4px;background:#eee}
    .tag.g{background:#dff5e1;color:#14702a}.tag.r{background:#fde3e3;color:#a11}.tag.y{background:#fff1c9;color:#7a5a00}
    .cp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
    .act{margin-top:4px;display:flex;gap:10px}.act a,.act span{color:#1877f2;cursor:pointer;font-size:11px;text-decoration:none}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}
    .stat{background:#f4f6f8;border-radius:8px;padding:8px;text-align:center}.stat b{display:block;font-size:17px}.stat span{font-size:10px;color:#65676b}
    h4{margin:12px 0 4px;font-size:12px}
    .bar{display:flex;align-items:center;gap:6px;margin:2px 0}.bl{width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
    .bt{flex:1;height:8px;background:#eef0f3;border-radius:4px;overflow:hidden}.bt i{display:block;height:100%;background:#1877f2}
    .row{display:flex;justify-content:space-between;padding:2px 0}.row a{color:#1877f2;text-decoration:none}
    .muted{color:#8a8d91;padding:10px 0}
  </style>
  <div class="p" id="p">
    <div class="hd"><span>AdLens <small id="cnt">0 ads</small></span><button id="min">_</button></div>
    <div class="tools">
      <button class="b" data-a="scan">Scan page</button>
      <button class="b on" data-a="live">Live scan</button>
      <button class="b" data-a="scroll">Auto-scroll</button>
      <input id="tgt" type="number" value="100" min="10" step="10" style="width:64px" title="Auto-scroll target ad count">
      <button class="b" data-a="csv">CSV</button>
      <button class="b" data-a="json">JSON</button>
      <button class="b" data-a="clear">Clear</button>
    </div>
    <div class="bar2">
      <input id="q" placeholder="Filter by name, copy, CTA, domain...">
      <select id="s"><option value="days">Longest running</option><option value="variants">Most variants</option><option value="name">Advertiser A-Z</option></select>
    </div>
    <div class="tabs"><div data-t="ads" class="on">Ads</div><div data-t="insights">Insights</div><div data-t="saved">Saved</div></div>
    <div class="body" id="body"></div>
  </div>`;
  document.documentElement.appendChild(host);
  const $ = (s) => root.querySelector(s);

  function card(a) {
    const isSaved = !!saved[a.id];
    const dayTag = a.days === null ? "" : `<span class="tag ${a.days >= 30 ? "g" : a.days < 7 ? "y" : ""}">${a.days}d running</span>`;
    const st = a.status ? `<span class="tag ${a.status === "Active" ? "g" : "r"}">${a.status}</span>` : "";
    const vr = a.variants > 1 ? `<span class="tag">${a.variants} variants</span>` : "";
    return `<div class="card">
      <div class="th" style="background-image:url('${esc(a.thumb)}')"><em>${a.type}</em></div>
      <div class="ci">
        <strong>${esc(a.advertiser || "Unknown advertiser")}</strong>
        <div class="meta">${st}${dayTag}${vr}${a.cta ? `<span class="tag">${esc(a.cta)}</span>` : ""}</div>
        <div class="cp">${esc(a.copy)}</div>
        <div class="act">
          <span data-save="${a.id}">${isSaved ? "★ Saved" : "☆ Save"}</span>
          <span data-copy="${a.id}">Copy text</span>
          <a href="${esc(a.link)}" target="_blank">Open</a>
          ${a.landing ? `<a href="${esc(a.landing)}" target="_blank">Landing</a>` : ""}
        </div>
      </div></div>`;
  }

  function render() {
    updateCount();
    root.querySelectorAll(".tabs div").forEach((d) => d.classList.toggle("on", d.dataset.t === tab));
    const body = $("#body");
    if (tab === "insights") body.innerHTML = insights();
    else {
      const src = tab === "saved" ? Object.values(saved) : ads.values();
      const l = list(src);
      body.innerHTML = l.length ? l.slice(0, 150).map(card).join("") + (l.length > 150 ? `<div class="muted">Showing 150 of ${l.length}. Use CSV for all.</div>` : "") : `<div class="muted">${tab === "saved" ? "Nothing saved yet." : "No ads found yet. Search a keyword or advertiser, scroll, then Scan."}</div>`;
    }
  }
  function updateCount() { const c = $("#cnt"); if (c) c.textContent = ads.size + " ads"; }

  // ---------- events ----------
  root.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.id === "min") return $("#p").classList.toggle("min");
    if (t.dataset.t) { tab = t.dataset.t; return render(); }
    if (t.dataset.save) {
      const id = t.dataset.save;
      if (saved[id]) delete saved[id]; else saved[id] = ads.get(id) || saved[id];
      persist(); return render();
    }
    if (t.dataset.copy) {
      const a = ads.get(t.dataset.copy) || saved[t.dataset.copy];
      await navigator.clipboard.writeText(a?.copy || "").catch(() => {});
      t.textContent = "Copied"; return;
    }
    const act = t.dataset.a;
    if (!act) return;
    const rows = list(tab === "saved" ? Object.values(saved) : ads.values());
    if (act === "scan") { const n = scan(); t.textContent = "Scan (+" + n + ")"; }
    if (act === "live") { live = !live; t.classList.toggle("on", live); }
    if (act === "csv") download(`adlens-${stamp()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
    if (act === "json") download(`adlens-${stamp()}.json`, JSON.stringify(rows, null, 2), "application/json");
    if (act === "clear") { ads.clear(); render(); }
    if (act === "scroll") {
      if (scrolling) { scrolling = false; t.classList.remove("on"); t.textContent = "Auto-scroll"; return; }
      scrolling = true; t.classList.add("on"); t.textContent = "Stop";
      target = parseInt($("#tgt").value, 10) || 100;
      let stuck = 0, last = -1;
      while (scrolling && ads.size < target && stuck < 5) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((r) => setTimeout(r, 1800));
        scan();
        stuck = ads.size === last ? stuck + 1 : 0;
        last = ads.size;
      }
      scrolling = false; t.classList.remove("on"); t.textContent = "Auto-scroll";
    }
  });
  $("#q").addEventListener("input", (e) => { filter = e.target.value; render(); });
  $("#s").addEventListener("change", (e) => { sortBy = e.target.value; render(); });

  let timer;
  new MutationObserver(() => {
    if (!live) return;
    clearTimeout(timer);
    timer = setTimeout(scan, 1200);
  }).observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((m) => {
    if (m.type === "toggle") host.style.display = host.style.display === "none" ? "" : "none";
  });

  setTimeout(scan, 1500);
  render();
})();
