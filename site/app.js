/* Haltéro 95 — site statique. Les données viennent de data/*.json (mis à jour chaque nuit). */
(() => {
  const $app = document.getElementById("app");
  const $tip = document.getElementById("tip");
  const LIFTS = [["snatch", "Arraché"], ["cj", "Épaulé-jeté"], ["total", "Total"]];
  const SHORT = { snatch: "ARR", cj: "É-J", total: "TOT" };
  const LC = { snatch: "var(--snatch)", cj: "var(--cj)", total: "var(--total)" };
  const AGE_ORDER = ["U13", "U15", "U17", "U20", "Senior"];
  const CLUB_COLORS = ["#e4002b", "#2f6bff", "#f08c00", "#8b5cf6"];
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let D = null; // données
  const state = { club: null, q: "", recPeriod: null, recSex: "F", recAge: "Senior", showAll: false };

  // ---------- utils
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const frDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const longDate = (iso) => (iso ? `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : "—");
  const monthYear = (iso) => (iso ? `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : "");
  const kg = (v) => (v || v === 0 ? String(v).replace(".", ",") : "—");
  const sexLabel = (s) => (s === "F" ? "Femme" : "Homme");
  const sexPlural = (s) => (s === "F" ? "Femmes" : "Hommes");
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const athleteLink = (lic, name) => `<a href="#/a/${encodeURIComponent(lic)}">${esc(name)}</a>`;
  const ageSort = (a) => (AGE_ORDER.includes(a) ? AGE_ORDER.indexOf(a) * 100 : 1000 + parseInt(a.slice(1), 10));
  const clubColor = (c) => CLUB_COLORS[Math.max(0, D.meta.clubs.indexOf(c)) % CLUB_COLORS.length];
  const clubShort = (c) => (c || "").replace("AFHMA FRANCONVILLE", "AFHMA Franconville").replace("HFC CP95 CERGY", "HFC CP95 Cergy").replace("WIM LIFT", "WIM Lift");
  // « RICHEVAUX Jade » → { last: "RICHEVAUX", first: "Jade" }
  const splitName = (n) => {
    const w = String(n).split(/\s+/);
    const i = w.findIndex((x) => x !== x.toUpperCase() || !/[A-ZÀ-Ý]/.test(x));
    return i <= 0 ? { last: n, first: "" } : { last: w.slice(0, i).join(" "), first: w.slice(i).join(" ") };
  };
  const initials = (n) => { const { last, first } = splitName(n); return ((first[0] || "") + (last[0] || "")).toUpperCase(); };
  const bestTotal = (a) => a.pb.total ? a.pb.total.value : 0;
  const rv = (i) => `rv" style="--i:${i}`; // classe d'apparition échelonnée

  async function load() {
    const get = (f) => fetch(`data/${f}?v=${Date.now().toString().slice(0, -5)}`).then((r) => r.json());
    const [meta, athletes, results, records] = await Promise.all([get("meta.json"), get("athletes.json"), get("results.json"), get("records.json")]);
    D = { meta, athletes, results, records, byLic: Object.fromEntries(athletes.map((a) => [a.licence, a])) };
    state.recPeriod = meta.latest_period;
    document.getElementById("updated").textContent =
      `Dernier résultat : ${longDate(meta.latest_result)} · mis à jour le ${longDate(meta.updated_at.slice(0, 10))}`;
  }

  function setNav(key) {
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === key));
  }

  // ---------- animations après rendu
  function animate() {
    const run = () => {
      $app.querySelectorAll("[data-count]").forEach((el) => {
        const end = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length;
        if (REDUCED) { el.textContent = kg(end.toFixed(dec)); return; }
        const t0 = performance.now(), dur = 1100;
        const step = (t) => {
          const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
          el.textContent = kg((end * e).toFixed(dec));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      $app.querySelectorAll("[data-w]").forEach((el) => { el.style.width = el.dataset.w; });
      $app.querySelectorAll("[data-off]").forEach((el) => { el.style.strokeDashoffset = el.dataset.off; });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }

  // ---------- accueil
  function viewHome(soft) {
    setNav("home");
    const clubs = D.meta.clubs;
    const q = norm(state.q);
    const list = D.athletes
      .filter((a) => !state.club || a.clubs.includes(state.club))
      .filter((a) => !q || norm(a.name).includes(q) || a.licence.includes(q))
      .sort((a, b) => (b.last_date || "").localeCompare(a.last_date || "") || a.name.localeCompare(b.name));
    const listHtml = list.map((a, i) => `
      <a class="aitem ${i < 24 && !soft ? rv(Math.min(i, 12) + 6) : ""}" href="#/a/${encodeURIComponent(a.licence)}">
        <span class="avatar" style="--c:${clubColor(a.club)}">${esc(initials(a.name))}</span>
        <span class="ainfo"><b>${esc(a.name)}</b><span><span class="tag">${esc(a.age_cat)}</span> ${esc(clubShort(a.club))}</span></span>
        ${bestTotal(a) ? `<span class="abest"><b>${bestTotal(a)}</b><span>kg total</span></span>` : ""}
      </a>`).join("") || `<p class="empty">Aucun athlète trouvé.</p>`;

    if (soft) { // frappe dans la recherche : on ne redessine que la liste
      $app.querySelector(".alist").innerHTML = listHtml;
      $app.querySelector(".count").textContent = `${list.length} athlète${list.length > 1 ? "s" : ""} · les plus récents en premier`;
      return;
    }
    const hist = D.records.history;
    const season = D.meta.latest_season;
    const seasonStart = `${season.slice(0, 4)}-09-01`;
    const recSeason = hist.filter((h) => h.date >= seasonStart).length;
    const comps = new Set(D.results.map((r) => r.competition + r.date)).size;
    const last = hist.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 18);
    const tk = last.map((h) => `<a class="tk" href="#/a/${encodeURIComponent(h.licence)}"><span class="bolt">⚡</span><b>${kg(h.value)}</b>
      <span class="who">${esc(h.athlete)}</span><span class="what">${esc(Object.fromEntries(LIFTS)[h.lift])} · ${esc(h.age_cat)} ${h.sex} ${esc(h.weight_class)}</span></a>`).join("");

    $app.innerHTML = `
      <section class="hero">
        <div class="hero-logo ${rv(1)}"><img class="only-light" src="img/logo-afhma.svg" alt="Logo AFHMA Franconville"><img class="only-dark" src="img/logo-afhma-dark.svg" alt="Logo AFHMA Franconville"></div>
        <div class="eyebrow ${rv(0)}">AFHMA Franconville · Saison ${esc(season)}</div>
        <h1 class="${rv(1)}">Trouve<br><span class="out">ta</span> <span class="red">fiche.</span></h1>
        <p class="sub ${rv(2)}">Tes records, ta progression, tes séries et les records du 95 de ta catégorie.</p>
        <div class="stats ${rv(3)}">
          <div class="stat"><div class="v" data-count="${D.athletes.length}">0</div><div class="l">Athlètes</div></div>
          <div class="stat"><div class="v" data-count="${comps}">0</div><div class="l">Compétitions</div></div>
          <div class="stat"><div class="v" data-count="${recSeason}">0</div><div class="l">Records cette saison</div></div>
        </div>
      </section>
      ${last.length ? `<div class="ticker ${rv(4)}"><div class="ticker-track">${tk}${tk}</div></div>` : ""}
      <div class="search ${rv(5)}"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" id="q" placeholder="Ton nom ou ta licence…" value="${esc(state.q)}" autocomplete="off"></div>
      <div class="chips ${rv(5)}">
        <button class="chip ${!state.club ? "on" : ""}" data-club="">Tous les clubs</button>
        ${clubs.map((c) => `<button class="chip ${state.club === c ? "on" : ""}" data-club="${esc(c)}"><span class="dot" style="background:${clubColor(c)}"></span>${esc(clubShort(c))}</button>`).join("")}
      </div>
      <p class="count">${list.length} athlète${list.length > 1 ? "s" : ""} · les plus récents en premier</p>
      <div class="alist">${listHtml}</div>`;
    $app.querySelectorAll("[data-club]").forEach((b) => b.addEventListener("click", () => {
      state.club = b.dataset.club || null;
      $app.querySelectorAll("[data-club]").forEach((x) => x.classList.toggle("on", x === b));
      viewHome(true);
    }));
    const inp = $app.querySelector("#q");
    inp.addEventListener("input", () => { state.q = inp.value; viewHome(true); });
    animate();
  }

  // ---------- fiche athlète
  function viewAthlete(lic) {
    setNav("home");
    const a = D.byLic[lic];
    if (!a) { $app.innerHTML = `<p class="pad center">Athlète introuvable. <a href="#/">Retour</a></p>`; return; }
    const rows = a.results.map((id) => D.results[id]).reverse();
    const catTxt = `${a.age_cat} ${a.sex} ${a.weight_class || ""}`.trim();
    const { last, first } = splitName(a.name);
    const C = 2 * Math.PI * 40;

    const lifts = LIFTS.map(([k, label], i) => {
      const pb = a.pb[k];
      const rec = a.record95[k];
      const mine = rec && rec.licence === a.licence;
      let side = "", foot = `<div class="rec">Pas encore de record du 95 dans ta catégorie</div>`;
      if (mine) {
        side = `<div class="trophy">🏆</div>`;
        foot = `<div class="rec">Record du 95 · ${esc(catTxt)}</div>`;
      } else if (rec) {
        const pct = pb ? Math.min(100, Math.round((pb.value / rec.value) * 100)) : 0;
        side = `<div class="ring"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="40"/>
          <circle class="prg" style="stroke:${LC[k]}" cx="50" cy="50" r="40" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C * (1 - pct / 100)).toFixed(1)}"/></svg>
          <div class="pct"><span><span data-count="${pct}">0</span>%<small>du record</small></span></div></div>`;
        foot = `<div class="rec">Record du 95 : <b>${kg(rec.value)} kg</b> · ${athleteLink(rec.licence, rec.athlete)}<br>
          Encore <b>${kg(Math.max(0, +(rec.value - (pb ? pb.value : 0)).toFixed(1)))} kg</b> à aller chercher</div>`;
      }
      return `<div class="lift ${mine ? "crown" : ""} ${rv(4 + i)}" style="--lc:${LC[k]}">
        <div class="body"><div class="lbl">${label}</div>
          <div class="val">${pb ? `<span data-count="${pb.value}">0</span>` : "—"}<small>kg</small></div>
          <div class="when">${pb ? `le ${longDate(pb.date)}` : "pas encore de barre validée"}</div>${foot}</div>${side}</div>`;
    }).join("");

    const seasons = Object.values(a.best_total_by_season);
    $app.innerHTML = `
      <a href="#/" class="back ${rv(0)}">← Tous les athlètes</a>
      <section class="ahero">
        ${a.pb.total ? `<div class="bgnum">${a.pb.total.value}</div>` : ""}
        <div class="eyebrow ${rv(1)}">${esc(clubShort(a.club))}</div>
        <h1 class="${rv(2)}">${first ? `<span class="first">${esc(first)}</span>` : ""}${esc(last)}</h1>
        <div class="meta ${rv(3)}">
          <span class="pill red">${esc(catTxt)}</span>
          ${frHeld(a)}
          <span class="pill">${sexLabel(a.sex)}</span>
          ${a.last_bw ? `<span class="pill"><i>Poids de corps</i> ${kg(a.last_bw)} kg</span>` : ""}
          <span class="pill"><i>Dernière compét.</i> ${longDate(a.last_date)}</span>
        </div>
      </section>
      <div class="lifts">${lifts}</div>
      <div class="kpis ${rv(7)}">
        <div class="kpi"><div class="v" data-count="${a.n_competitions}">0</div><div class="l">Compétitions</div></div>
        <div class="kpi"><div class="v">${a.best_iwf ? `<span data-count="${a.best_iwf}">0</span>` : "—"}</div><div class="l">Meilleur score IWF</div></div>
        <div class="kpi"><div class="v">${seasons.length}</div><div class="l">Saison${seasons.length > 1 ? "s" : ""} · depuis ${monthYear(a.first_date)}</div></div>
      </div>
      ${refCard(a)}
      <div class="grid2 ${rv(8)}">
        <div class="card chart draw"><div class="card-h"><h2>Ma progression</h2>
          <div class="legend"><span><i style="background:var(--snatch)"></i>Arraché</span><span><i style="background:var(--cj)"></i>Épaulé-jeté</span><span><i style="background:var(--total)"></i>Total</span></div></div>
          ${chart(rows.slice().reverse())}</div>
        <div class="card stack"><div class="card-h"><h2>Meilleur total par saison</h2>
          <div class="legend"><span><i style="background:var(--snatch)"></i>Arraché</span><span><i style="background:var(--cj)"></i>Épaulé-jeté</span></div></div>
          ${seasonStack(rows)}</div>
      </div>
      ${levelsCard(a)}
      <div class="card ${rv(10)}"><div class="card-h"><h2>Mes compétitions</h2><span class="muted small">${rows.length} au total</span></div>
        ${resultsTable(rows, state.showAll ? rows.length : 10)}
        ${rows.length > 10 ? `<button class="btn" id="more">${state.showAll ? "Voir moins" : `Voir les ${rows.length} compétitions`}</button>` : ""}
        <p class="note">🇫🇷 = record de France établi ce jour-là (toujours en cours). 🏆 = record du 95 battu ce jour-là (dans ta catégorie ou une catégorie au-dessus). Les essais barrés en rouge sont ratés.</p></div>`;
    $app.querySelectorAll("[data-ref]").forEach((b) => b.addEventListener("click", () => {
      state.ref = b.dataset.ref;
      const y = scrollY; viewAthlete(lic); scrollTo(0, y);
    }));
    const moreS = $app.querySelector("#more-series");
    if (moreS) moreS.addEventListener("click", () => { state.showAllSeries = !state.showAllSeries; const y = scrollY; viewAthlete(lic); scrollTo(0, y); });
    const more = $app.querySelector("#more");
    if (more) more.addEventListener("click", () => { state.showAll = !state.showAll; viewAthlete(lic); });
    $app.querySelectorAll(".chart .ln").forEach((p) => p.style.setProperty("--len", Math.ceil(p.getTotalLength())));
    bindChart(rows.slice().reverse());
    bindStack();
    animate();
  }

  // records de France détenus, regroupés par catégorie : « U17 F 61 kg · arraché, épaulé-jeté, total »
  function frHeld(a) {
    if (!a.france_held || !a.france_held.length) return "";
    const short = { snatch: "arraché", cj: "épaulé-jeté", total: "total" };
    const groups = {};
    a.france_held.forEach((h) => { (groups[`${h.age_cat} ${h.sex} ${h.weight_class}`] ||= []).push(short[h.lift]); });
    return Object.entries(groups).map(([cat, l]) => `<span class="pill fr">🇫🇷 Record de France · ${esc(cat)} <i>${l.join(", ")}</i></span>`).join("");
  }

  // « Mes records vs record de référence » : record du 95 ou record de France de ma catégorie
  function refCard(a) {
    const hasFr = LIFTS.some(([k]) => a.record_fr && a.record_fr[k]);
    if (!state.ref || (state.ref === "fr" && !hasFr)) state.ref = "95";
    const refOf = (k) => {
      if (state.ref === "fr") {
        const r = a.record_fr[k];
        return r && { value: r.value, who: r.standard ? "minimum Fédé (pas encore battu)" : r.holder, mine: r.mine };
      }
      const r = a.record95[k];
      return r && { value: r.value, who: r.athlete, mine: r.licence === a.licence };
    };
    const frCat = hasFr ? LIFTS.map(([k]) => a.record_fr[k]).find(Boolean).age_cat : "";
    const rows = LIFTS.map(([k, label]) => {
      const pb = a.pb[k] ? a.pb[k].value : 0, ref = refOf(k);
      if (!ref) return `<div class="ref-row" style="--lc:${LC[k]}"><span class="rl">${label}</span><span class="rt"></span><span class="rv muted">pas de référence</span></div>`;
      const pct = Math.round((pb / ref.value) * 100), w = Math.min(100, pct);
      return `<div class="ref-row ${pct >= 100 ? "done" : ""}" style="--lc:${LC[k]}">
        <span class="rl">${label}</span>
        <span class="rt"><span class="rb" data-w="${w}%"></span><span class="rm"></span></span>
        <span class="rv"><b>${kg(pb)}</b> / ${kg(ref.value)} kg <em>${pct >= 100 ? "✓" : pct + " %"}</em></span>
        <span class="rw">${ref.mine ? "C'est toi qui le détiens 🏆" : `Record : ${esc(ref.who || "")}${pct < 100 ? ` · encore ${kg(+(ref.value - pb).toFixed(1))} kg` : ""}`}</span></div>`;
    }).join("");
    return `<div class="card refc ${rv(8)}"><div class="card-h"><h2>Mes records vs référence</h2>
      <div class="seg">${[["95", "Record du 95"], ["fr", "Record de France"]].map(([v, l]) =>
        `<button class="${state.ref === v ? "on" : ""}" data-ref="${v}" ${v === "fr" && !hasFr ? "disabled" : ""}>${l}</button>`).join("")}</div></div>
      ${rows}
      <p class="note">${state.ref === "fr" ? `Record de France ${esc(frCat)} ${a.sex} ${esc(a.weight_class || "")} (page records de la Fédé, mise à jour chaque nuit).` : `Record du 95 de ta catégorie ${esc(a.age_cat)} ${a.sex} ${esc(a.weight_class || "")}.`}</p></div>`;
  }

  let CH = null; // géométrie du graphique courant (pour l'info-bulle)
  function chart(rows) {
    const pts = rows.filter((r) => r.total && r.date);
    CH = null;
    if (pts.length < 2) return `<p class="empty">Il faut au moins deux compétitions pour tracer la courbe.</p>`;
    const narrow = innerWidth < 600;
    const W = narrow ? 360 : 640, H = narrow ? 240 : 280, L = 34, R = 12, T = 18, B = 28;
    const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date);
    const maxV = Math.max(...pts.map((r) => r.total)), minV = Math.min(...pts.map((r) => r.snatch || r.total));
    const lo = Math.max(0, Math.floor((minV * 0.85) / 10) * 10), hi = Math.ceil((maxV * 1.05) / 10) * 10;
    const x = (d) => L + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const step = (hi - lo) > 150 ? 50 : (hi - lo) > 60 ? 20 : 10;
    let grid = "";
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:rgba(var(--fg-rgb), .06)"/><text x="${L - 8}" y="${y(v) + 4}" font-size="11" text-anchor="end" style="fill:var(--dim)">${v}</text>`;
    const y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear();
    for (let yr = y0 + 1; yr <= y1; yr++) {
      const xx = x(`${yr}-01-01`);
      grid += `<text x="${xx}" y="${H - 6}" font-size="11" font-weight="600" text-anchor="middle" style="fill:var(--dim)">${yr}</text>`;
    }
    const path = (k) => pts.filter((r) => r[k]).map((r, i) => `${i ? "L" : "M"}${x(r.date).toFixed(1)},${y(r[k]).toFixed(1)}`).join("");
    const tp = pts.map((r) => [x(r.date).toFixed(1), y(r.total).toFixed(1)]);
    const area = `M${tp[0][0]},${H - B}` + tp.map(([a, b]) => `L${a},${b}`).join("") + `L${tp[tp.length - 1][0]},${H - B}Z`;
    const best = pts.reduce((m, r) => (r.total > m.total ? r : m), pts[0]);
    CH = { pts, x, y, W, T, H, B };
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progression">
      <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--total)" stop-opacity=".28"/><stop offset="1" style="stop-color:var(--total)" stop-opacity="0"/></linearGradient></defs>
      ${grid}<path class="area" d="${area}" fill="url(#ga)"/>
      <path class="ln s" d="${path("snatch")}" style="stroke:var(--snatch)"/>
      <path class="ln c" d="${path("cj")}" style="stroke:var(--cj)"/>
      <path class="ln t" d="${path("total")}" style="stroke:var(--total)" stroke-width="3.2"/>
      <g class="pt"><circle cx="${x(best.date)}" cy="${y(best.total)}" r="11" style="fill:rgba(var(--gold-rgb), .18)"/><circle cx="${x(best.date)}" cy="${y(best.total)}" r="5" style="fill:var(--total)"/>
        <text x="${Math.min(W - R - 4, x(best.date))}" y="${y(best.total) - 16}" text-anchor="${x(best.date) > W - 60 ? "end" : "middle"}" font-size="13" font-weight="800" style="fill:var(--total)">${best.total} kg</text></g>
      <line class="hair" id="hair" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
      <g id="hdots" visibility="hidden"><circle r="5" style="fill:var(--snatch);stroke:var(--card)" stroke-width="2"/><circle r="5" style="fill:var(--cj);stroke:var(--card)" stroke-width="2"/><circle r="6" style="fill:var(--total);stroke:var(--card)" stroke-width="2"/></g>
      <rect id="hit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/></svg>`;
  }

  function bindChart() {
    const svg = $app.querySelector(".chart svg");
    if (!svg || !CH) return;
    const hair = svg.querySelector("#hair"), dots = svg.querySelectorAll("#hdots circle"), g = svg.querySelector("#hdots");
    const hide = () => { $tip.hidden = true; hair.setAttribute("visibility", "hidden"); g.setAttribute("visibility", "hidden"); };
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const sx = ((ev.clientX - r.left) / r.width) * CH.W;
      let best = CH.pts[0], bd = Infinity;
      for (const p of CH.pts) { const d = Math.abs(CH.x(p.date) - sx); if (d < bd) { bd = d; best = p; } }
      const px = CH.x(best.date);
      hair.setAttribute("x1", px); hair.setAttribute("x2", px); hair.setAttribute("visibility", "visible");
      g.setAttribute("visibility", "visible");
      ["snatch", "cj", "total"].forEach((k, i) => {
        if (best[k]) { dots[i].setAttribute("cx", px); dots[i].setAttribute("cy", CH.y(best[k])); dots[i].style.display = ""; } else dots[i].style.display = "none";
      });
      $tip.innerHTML = `<div class="d">${longDate(best.date)} · ${esc(best.weight_class || "")}</div>
        <div class="r"><span style="color:var(--snatch)">Arraché</span><b>${kg(best.snatch) || "—"}</b></div>
        <div class="r"><span style="color:var(--cj)">Épaulé-jeté</span><b>${kg(best.cj) || "—"}</b></div>
        <div class="r"><span style="color:var(--total)">Total</span><b>${kg(best.total)}</b></div>
        <div class="c">${esc(best.competition)}</div>`;
      $tip.hidden = false;
      const tx = r.left + (px / CH.W) * r.width, tw = $tip.offsetWidth;
      $tip.style.left = `${Math.max(8, Math.min(innerWidth - tw - 8, tx - tw / 2))}px`;
      const th = $tip.offsetHeight, above = ev.clientY - th - 18;
      $tip.style.top = `${above > 76 ? above : ev.clientY + 22}px`;
    };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerdown", move);
    svg.addEventListener("pointerleave", hide);
    addEventListener("scroll", hide, { passive: true, once: true });
  }

  // Barres empilées par saison : arraché + épaulé-jeté de la compétition au meilleur total
  let ST = null;
  function seasonStack(rows) {
    const best = {};
    rows.forEach((r) => { if (r.total && (!best[r.season] || r.total > best[r.season].total)) best[r.season] = r; });
    const data = Object.keys(best).sort().map((s) => best[s]);
    ST = data;
    if (!data.length) return `<p class="empty">Pas encore de total valide.</p>`;
    const W = 360, H = 250, L = 30, R = 6, T = 22, B = 24;
    const max = Math.max(...data.map((r) => r.total));
    const step = max > 250 ? 100 : max > 120 ? 50 : 20;
    const hi = Math.ceil((max * 1.08) / step) * step;
    const y = (v) => T + (1 - v / hi) * (H - T - B);
    const band = (W - L - R) / data.length, bw = Math.min(40, band * 0.62);
    const top = Math.max(...data.map((r) => r.total));
    let g = "";
    for (let v = 0; v <= hi; v += step)
      g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:rgba(var(--fg-rgb),${v ? .06 : .18})"/><text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" style="fill:var(--dim)">${v}</text>`;
    // segment au coin haut arrondi (4px) ; le bas reste carré, posé sur la ligne de base
    const seg = (x, y0, y1, round, color) => {
      const h = y0 - y1; if (h <= 0) return "";
      const r = round ? Math.min(4, h, bw / 2) : 0;
      return `<path d="M${x},${y0}V${y1 + r}${r ? `Q${x},${y1} ${x + r},${y1}` : ""}H${x + bw - r}${r ? `Q${x + bw},${y1} ${x + bw},${y1 + r}` : ""}V${y0}Z" style="fill:${color}"/>`;
    };
    const bars = data.map((r, i) => {
      const x = L + band * i + (band - bw) / 2, base = y(0);
      const sn = r.snatch || 0, cj = r.cj || 0;
      const ySn = y(sn), yTot = y(sn + cj);
      return `<g class="sb" data-i="${i}" style="--d:${i * 80}ms">
        <rect x="${L + band * i}" y="${T}" width="${band}" height="${H - T - B}" fill="transparent"/>
        <g class="grow">${seg(x, base, ySn, cj <= 0, "var(--snatch)")}${seg(x, ySn - 2, yTot, true, "var(--cj)")}</g>
        <text x="${x + bw / 2}" y="${yTot - 6}" text-anchor="middle" font-size="12" font-weight="800" class="tl ${r.total === top ? "best" : ""}">${r.total}</text>
        <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="10" font-weight="600" style="fill:var(--dim)">${esc(r.season.replace(/^20(\d\d)\/20(\d\d)$/, "$1/$2"))}</text></g>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Meilleur total par saison, arraché et épaulé-jeté empilés">${g}${bars}</svg>`;
  }

  function bindStack() {
    const svg = $app.querySelector(".stack svg");
    if (!svg || !ST) return;
    const show = (ev, g) => {
      const r = ST[+g.dataset.i];
      svg.querySelectorAll(".sb").forEach((x) => x.classList.toggle("dim", x !== g));
      $tip.innerHTML = `<div class="d">Saison ${esc(r.season)} · ${longDate(r.date)}</div>
        <div class="r"><span style="color:var(--snatch)">Arraché</span><b>${kg(r.snatch)}</b></div>
        <div class="r"><span style="color:var(--cj)">Épaulé-jeté</span><b>${kg(r.cj)}</b></div>
        <div class="r"><span>Total</span><b>${kg(r.total)}</b></div>
        <div class="c">${esc(r.competition)}</div>`;
      $tip.hidden = false;
      const tw = $tip.offsetWidth, th = $tip.offsetHeight, above = ev.clientY - th - 18;
      $tip.style.left = `${Math.max(8, Math.min(innerWidth - tw - 8, ev.clientX - tw / 2))}px`;
      $tip.style.top = `${above > 76 ? above : ev.clientY + 22}px`;
    };
    svg.querySelectorAll(".sb").forEach((g) => {
      g.addEventListener("pointermove", (ev) => show(ev, g));
      g.addEventListener("pointerdown", (ev) => show(ev, g));
    });
    svg.addEventListener("pointerleave", () => { $tip.hidden = true; svg.querySelectorAll(".sb").forEach((x) => x.classList.remove("dim")); });
  }

  // Séries : un niveau atteint valide aussi tous les niveaux en dessous.
  // On liste la série de CHAQUE compétition, et on surligne celles où un nouveau niveau a été franchi.
  function levelsCard(a) {
    const scales = { ffhm: D.meta.series_levels, masters: D.meta.masters_levels };
    const codeMap = {};
    Object.entries(scales).forEach(([sc, lv]) => lv.forEach((l, i) => l.codes.forEach((c) => { codeMap[c] = { sc, i, key: l.key }; })));
    const rows = a.results.map((id) => D.results[id]).filter((r) => r.date).sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id);
    const best = { ffhm: -1, masters: -1 };
    const reach = { ffhm: [], masters: [] }; // par niveau : 1re date atteinte (ou dépassée) + nb de fois
    const lines = rows.map((r) => {
      const m = codeMap[r.series];
      let isNew = false;
      if (m) {
        for (let i = 0; i <= m.i; i++) {
          const x = (reach[m.sc][i] ||= { first: r.date, count: 0, direct: false });
          x.count++;
          if (i === m.i) x.direct = true;
        }
        if (m.i > best[m.sc]) { isNew = true; best[m.sc] = m.i; }
      }
      return { r, m, isNew };
    });
    const block = (sc) => `<div class="levels">${scales[sc].map((l, i) => {
      const x = reach[sc][i];
      return `<div class="lvl ${x ? "got" : ""} ${i === best[sc] ? "peak" : ""}"><div class="code">${l.codes.map(esc).join("<br>")}</div><div class="name">${esc(l.label)}</div>
        <div class="when">${x ? `${frDate(x.first)}<br><span class="muted small">${x.count} fois${x.direct ? "" : " (dépassé)"}</span>` : "à venir"}</div></div>`;
    }).join("")}</div>`;
    const n = state.showAllSeries ? lines.length : 10;
    const shown = lines.slice().reverse().slice(0, n);
    return `<div class="card ${rv(9)}"><div class="card-h"><h2>Mes séries FFHM</h2><span class="muted small">en or : ton meilleur niveau</span></div>
      ${block("ffhm")}
      ${best.masters >= 0 ? `<div class="h3">Séries Masters</div>${block("masters")}` : ""}
      ${lines.length ? `<div class="h3">Ma série à chaque compétition</div><div class="tbl-wrap"><table class="series-tbl">
        <thead><tr><th>Date</th><th>Série</th><th class="num">Total</th><th>Cat.</th><th>Compétition</th></tr></thead><tbody>
        ${shown.map(({ r, m, isNew }) => `<tr class="${isNew ? "lvl-new" : ""}"><td class="num c-date" style="text-align:left">${frDate(r.date)}</td>
          <td class="c-ser"><span class="serie ${m ? "" : "nc"}">${esc(r.series || "—")}</span>${isNew ? `<span class="newlvl">▲ Nouveau niveau</span>` : ""}</td>
          <td class="num tot c-tot" data-l="Total"><b>${r.total || "—"}</b></td><td class="c-cat">${esc(r.age_cat)}</td><td class="comp c-comp">${esc(r.competition)}</td></tr>`).join("")}
      </tbody></table></div>
      ${lines.length > 10 ? `<button class="btn" id="more-series">${state.showAllSeries ? "Voir moins" : `Voir les ${lines.length} compétitions`}</button>` : ""}` : ""}
      <p class="note">La série est attribuée par la Fédé selon le total réalisé. Un niveau atteint valide aussi ceux en dessous (« dépassé » = jamais obtenu pile, mais franchi par une série plus haute). Lignes surlignées : premières fois à un niveau plus haut. N.C. = non classé.</p></div>`;
  }

  function attempts(arr) {
    if (!arr || !arr.some((v) => v !== null)) return "";
    return `<span class="att">${arr.map((v) => (v === null ? "·" : v < 0 ? `<span class="ko">${-v}</span>` : v)).join(" / ")}</span>`;
  }

  function resultsTable(rows, n) {
    return `<div class="tbl-wrap"><table class="res-tbl">
      <thead><tr><th>Date</th><th>Compétition</th><th>Cat.</th><th class="num">PC</th><th class="num">Arr.</th><th class="num">É-J</th><th class="num">Total</th><th>Série</th></tr></thead><tbody>
      ${rows.slice(0, n).map((r) => `<tr>
        <td class="num c-date" style="text-align:left">${frDate(r.date)}</td>
        <td class="comp c-comp">${r.competition_url ? `<a href="${esc(r.competition_url)}" target="_blank" rel="noopener">${esc(r.competition)}</a>` : esc(r.competition)}
          ${r.france && r.france.length ? `<br><span class="badge fr" title="${esc(r.france.join(" · "))}">🇫🇷 Record de France · ${esc(r.france[0])}${r.france.length > 1 ? ` +${r.france.length - 1}` : ""}</span>` : ""}
          ${r.records.length ? `<br><span class="badge" title="${esc(r.records.join(" · "))}">🏆 Record 95 · ${esc(r.records[0])}${r.records.length > 1 ? ` +${r.records.length - 1}` : ""}</span>` : ""}</td>
        <td class="c-cat">${esc(r.age_cat)}<br><span class="muted small">${esc(r.weight_class || "")}</span></td>
        <td class="num muted c-bw" data-l="Poids">${kg(r.bw)}</td>
        <td class="num c-arr" data-l="Arr."><b>${r.snatch || "0"}</b>${attempts(r.snatch_attempts)}</td>
        <td class="num c-ej" data-l="É-J"><b>${r.cj || "0"}</b>${attempts(r.cj_attempts)}</td>
        <td class="num tot c-tot" data-l="Total"><b>${r.total || "—"}</b></td>
        <td class="c-ser">${r.series ? `<span class="serie">${esc(r.series)}</span>` : ""}</td></tr>`).join("")}
    </tbody></table></div>`;
  }

  // ---------- records du 95
  function viewRecords() {
    setNav("records");
    const { records } = D.records;
    const periods = Object.keys(D.meta.periods);
    const inPeriod = records.filter((r) => r.period === state.recPeriod && r.sex === state.recSex);
    const ages = [...new Set(inPeriod.map((r) => r.age_cat))].sort((a, b) => ageSort(a) - ageSort(b));
    if (!ages.includes(state.recAge)) state.recAge = "Senior";
    const list = inPeriod.filter((r) => r.age_cat === state.recAge);
    const frIdx = {};
    if (state.recPeriod === D.meta.latest_period) (D.records.france || []).forEach((f) => { frIdx[`${f.age_cat}|${f.sex}|${f.weight_class}|${f.lift}`] = f; });
    const frAge = AGE_ORDER.includes(state.recAge) ? (state.recAge === "U13" ? null : state.recAge) : "Senior";
    let curWc = "";
    const frTag = (k) => { const f = frAge && frIdx[`${frAge}|${state.recSex}|${curWc}|${k}`]; return f ? `<span class="frv" title="Record de France ${esc(frAge)}${f.standard ? " (minimum Fédé)" : " · " + esc(f.holder)}">🇫🇷 ${kg(f.value)}</span>` : ""; };
    const row = (k, rec) => rec
      ? `<div class="rrow" style="--lc:${LC[k]}"><span class="k">${SHORT[k]}</span>
          <span class="h">${athleteLink(rec.licence, rec.athlete)}<span>${frDate(rec.date)} · ${esc(clubShort(rec.club))}</span></span>
          <span class="v">${kg(rec.value)}<small> kg</small>${frTag(k)}</span></div>`
      : `<div class="rrow none" style="--lc:${LC[k]}"><span class="k">${SHORT[k]}</span><span class="h">Record à prendre</span><span class="v">—${frTag(k)}</span></div>`;
    $app.innerHTML = `
      <div class="eyebrow ${rv(0)}">AFHMA · HFC CP95 · WIM Lift</div>
      <h1 class="${rv(1)}">Records<br><span class="out">du</span> <span class="red">95.</span></h1>
      <p class="sub ${rv(2)}">Les meilleures barres du Val d'Oise depuis 2020/21, catégorie par catégorie.</p>
      <div class="${rv(3)}">
        <div class="chips">${periods.map((p) => `<button class="chip ${p === state.recPeriod ? "on" : ""}" data-p="${p}">${esc(D.meta.periods[p])}</button>`).join("")}</div>
        <div class="seg">${["F", "M"].map((s) => `<button class="${s === state.recSex ? "on" : ""}" data-s="${s}">${sexPlural(s)}</button>`).join("")}</div>
        <div class="chips">${ages.map((a) => `<button class="chip ${a === state.recAge ? "on" : ""}" data-a="${a}">${a}</button>`).join("")}</div>
      </div>
      <div class="rgrid">
        ${list.map((r, i) => `${(curWc = r.weight_class, "")}<div class="rcard ${rv(4 + Math.min(i, 10))}">
          <div class="rcard-h"><span class="w">${esc(r.weight_class.replace(" kg", ""))}<small>kg</small></span>
            ${r.total ? `<span class="t"><b>${kg(r.total.value)}</b><span>kg au total</span></span>` : ""}</div>
          ${row("snatch", r.snatch)}${row("cj", r.cj)}${row("total", r.total)}</div>`).join("") || `<p class="empty">Aucune catégorie.</p>`}
      </div>
      <details class="rules"><summary>Comment sont calculés ces records ?</summary>
        <p>Calculés sur les résultats de l'AFHMA Franconville, du HFC CP95 Cergy et de WIM LIFT depuis 2020/21.
        Une perf compte dans la catégorie d'âge de l'athlète et dans celles au-dessus (U15 → U17, U20, Senior ; Masters → leur tranche + Senior ; U13 → U13 uniquement).
        Catégorie de poids recalculée d'après le poids de corps. Seules les perfs avec un total valide comptent.
        🇫🇷 = record de France en cours de la catégorie (U15 à Senior ; les Masters sont comparés au record Senior), d'après la page records de la Fédé.</p></details>`;
    $app.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => { state.recPeriod = b.dataset.p; viewRecords(); }));
    $app.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => { state.recSex = b.dataset.s; viewRecords(); }));
    $app.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => { state.recAge = b.dataset.a; viewRecords(); }));
  }

  // ---------- derniers records battus
  function viewLatest() {
    setNav("derniers");
    const label = Object.fromEntries(LIFTS);
    const items = D.records.history.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
    const days = [];
    for (const h of items) {
      const k = h.date + "|" + h.competition;
      if (!days.length || days[days.length - 1].k !== k) days.push({ k, date: h.date, comp: h.competition, items: [] });
      days[days.length - 1].items.push(h);
    }
    let n = 0;
    $app.innerHTML = `
      <div class="eyebrow ${rv(0)}">Les 60 derniers</div>
      <h1 class="${rv(1)}">Ça <span class="out">vient de</span><br><span class="red">tomber.</span></h1>
      <p class="sub ${rv(2)}">Les derniers records du 95 battus, toutes catégories confondues.</p>
      <div class="tl">${days.map((d) => `
        <div class="tl-day ${rv(Math.min(n++, 12) + 3)}">${longDate(d.date)}<small>${esc(d.comp)}</small></div>
        <div class="tl-items">${d.items.map((h) => `
          <a class="rec-item ${rv(Math.min(n++, 14) + 3)}" href="#/a/${encodeURIComponent(h.licence)}">
            <span class="big"><b>${kg(h.value)}</b><span>kg</span></span>
            <span class="info"><b>${esc(h.athlete)}</b>
              <div class="c"><span class="liftk" style="--lc:${LC[h.lift]}">${esc(label[h.lift])}</span> ${esc(h.age_cat)} ${h.sex} ${esc(h.weight_class)}</div>
              ${h.previous ? `<span class="delta">+${kg(+(h.value - h.previous).toFixed(1))} kg</span> <span class="muted small">ancien : ${kg(h.previous)} · ${esc(h.previous_holder)}</span>`
                : `<span class="delta new">Nouveau record</span>`}</span>
          </a>`).join("")}</div>`).join("")}</div>`;
  }

  // ---------- routeur
  function route() {
    const h = location.hash.replace(/^#/, "") || "/";
    $tip.hidden = true;
    if (!h.startsWith("/a/")) { state.showAll = false; state.showAllSeries = false; }
    if (h.startsWith("/a/")) viewAthlete(decodeURIComponent(h.slice(3)));
    else if (h === "/records") viewRecords();
    else if (h === "/derniers") viewLatest();
    else viewHome();
    window.scrollTo(0, 0);
  }

  // ---------- thème clair / sombre
  const setThemeColor = () => document.querySelector('meta[name="theme-color"]')
    .setAttribute("content", document.documentElement.dataset.theme === "light" ? "#1f3354" : "#0b0b0d");
  setThemeColor();
  document.getElementById("theme").addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("theme", t); } catch (e) {}
    setThemeColor();
  });

  load().then(() => { window.addEventListener("hashchange", route); route(); })
    .catch((e) => { $app.innerHTML = `<p class="pad center">Impossible de charger les données. Réessaie dans un instant.</p>`; console.error(e); });
})();
