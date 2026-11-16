/* Haltéro 95 — site statique. Les données viennent de data/*.json (mis à jour chaque nuit). */
(() => {
  const $app = document.getElementById("app");
  const LIFTS = [["snatch", "Arraché"], ["cj", "Épaulé-jeté"], ["total", "Total"]];
  const AGE_ORDER = ["U13", "U15", "U17", "U20", "Senior"];
  let D = null; // données
  const state = { club: null, q: "", recPeriod: null, recSex: "F", recAge: "Senior", showAll: false };

  // ---------- utils
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const frDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
  const monthYear = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
  const kg = (v) => (v || v === 0 ? String(v).replace(".", ",") : "—");
  const sexLabel = (s) => (s === "F" ? "Femme" : "Homme");
  const sexPlural = (s) => (s === "F" ? "Femmes" : "Hommes");
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const athleteLink = (lic, name) => `<a href="#/a/${encodeURIComponent(lic)}">${esc(name)}</a>`;
  const ageSort = (a) => (AGE_ORDER.includes(a) ? AGE_ORDER.indexOf(a) * 100 : 1000 + parseInt(a.slice(1), 10));

  async function load() {
    const get = (f) => fetch(`data/${f}?v=${Date.now().toString().slice(0, -5)}`).then((r) => r.json());
    const [meta, athletes, results, records] = await Promise.all([get("meta.json"), get("athletes.json"), get("results.json"), get("records.json")]);
    D = { meta, athletes, results, records, byLic: Object.fromEntries(athletes.map((a) => [a.licence, a])) };
    state.recPeriod = meta.latest_period;
    document.getElementById("updated").textContent =
      `Dernier résultat : ${frDate(meta.latest_result)} · mis à jour le ${frDate(meta.updated_at.slice(0, 10))}`;
  }

  function setNav(key) {
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === key));
  }

  // ---------- accueil
  function viewHome() {
    setNav("home");
    const clubs = D.meta.clubs;
    const q = norm(state.q);
    const list = D.athletes
      .filter((a) => !state.club || a.clubs.includes(state.club))
      .filter((a) => !q || norm(a.name).includes(q) || a.licence.includes(q))
      .sort((a, b) => (b.last_date || "").localeCompare(a.last_date || "") || a.name.localeCompare(b.name));
    $app.innerHTML = `
      <h1>Trouve ta fiche</h1>
      <div class="sub">Tes records, ta progression, tes séries et les records du 95 de ta catégorie.</div>
      <div class="chips">
        <button class="chip ${!state.club ? "on" : ""}" data-club="">Tous les clubs</button>
        ${clubs.map((c) => `<button class="chip ${state.club === c ? "on" : ""}" data-club="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      <input type="search" id="q" placeholder="Ton nom ou ta licence…" value="${esc(state.q)}" autocomplete="off">
      <p class="muted small">${list.length} athlète${list.length > 1 ? "s" : ""} · les plus récents en premier</p>
      <div class="alist">
        ${list.map((a) => `
          <a class="aitem" href="#/a/${encodeURIComponent(a.licence)}">
            <span><b>${esc(a.name)}</b><br><span class="muted small">${esc(a.club)}</span></span>
            <span class="tag">${esc(a.age_cat)} · ${frDate(a.last_date).slice(3)}</span>
          </a>`).join("") || `<p class="empty">Aucun athlète trouvé.</p>`}
      </div>`;
    $app.querySelectorAll("[data-club]").forEach((b) => b.addEventListener("click", () => { state.club = b.dataset.club || null; viewHome(); }));
    const inp = $app.querySelector("#q");
    inp.addEventListener("input", () => { state.q = inp.value; const pos = inp.selectionStart; viewHome(); const n = $app.querySelector("#q"); n.focus(); n.setSelectionRange(pos, pos); });
  }

  // ---------- fiche athlète
  function viewAthlete(lic) {
    setNav("home");
    const a = D.byLic[lic];
    if (!a) { $app.innerHTML = `<p class="pad center">Athlète introuvable. <a href="#/">Retour</a></p>`; return; }
    const rows = a.results.map((id) => D.results[id]).reverse();
    const catTxt = `${a.age_cat} ${a.sex} ${a.weight_class || ""}`.trim();

    const tiles = LIFTS.map(([k, label]) => {
      const pb = a.pb[k];
      const rec = a.record95[k];
      let foot = `<div class="line">Record du 95 (${esc(catTxt)}) : pas encore de record</div>`;
      if (rec) {
        const mine = rec.licence === a.licence;
        const pct = pb ? Math.min(100, Math.round((pb.value / rec.value) * 100)) : 0;
        foot = mine
          ? `<div class="line crown">🏆 Tu détiens le record du 95 (${esc(catTxt)})</div>`
          : `<div class="bar"><i style="width:${pct}%"></i></div>
             <div class="line">Record du 95 : <b>${kg(rec.value)} kg</b> · ${esc(rec.athlete)}<br>
             Encore ${kg(Math.max(0, rec.value - (pb ? pb.value : 0)))} kg · ${pct} % du record</div>`;
      }
      return `<div class="tile"><div class="lbl">Record ${label}</div>
        <div class="val">${pb ? kg(pb.value) : "—"} <small>kg</small></div>
        ${pb ? `<div class="line">le ${frDate(pb.date)}</div>` : ""}${foot}</div>`;
    }).join("");

    $app.innerHTML = `
      <a href="#/" class="back">← Tous les athlètes</a>
      <h1>${esc(a.name)}</h1>
      <div class="sub">${esc(a.club)} · ${sexLabel(a.sex)} · Catégorie ${esc(catTxt)}${a.last_bw ? ` (dernier poids de corps : ${kg(a.last_bw)} kg)` : ""} · Dernière compétition : ${frDate(a.last_date)}</div>
      <div class="tiles">
        ${tiles}
        <div class="tile"><div class="lbl">Compétitions</div>
          <div class="val">${a.n_competitions}</div>
          <div class="line">depuis ${monthYear(a.first_date)}${a.best_iwf ? `<br>Meilleur score IWF : ${kg(a.best_iwf)}` : ""}</div></div>
      </div>
      <div class="grid2">
        <div class="card chart"><h2>Ma progression en compétition</h2>${chart(rows.slice().reverse())}
          <div class="legend"><span><i style="background:var(--snatch)"></i>Arraché</span><span><i style="background:var(--cj)"></i>Épaulé-jeté</span><span><i style="background:var(--total)"></i>Total</span></div></div>
        <div class="card"><h2>Meilleur total par saison</h2>${seasonBars(a.best_total_by_season)}</div>
      </div>
      ${levelsCard(a)}
      <div class="card"><h2>Mes compétitions</h2>${resultsTable(rows, state.showAll ? rows.length : 10)}
        ${rows.length > 10 ? `<button class="btn" id="more">${state.showAll ? "Voir moins" : `Voir les ${rows.length} compétitions`}</button>` : ""}
        <p class="muted small">Badge rouge = record du 95 battu ce jour-là (dans ta catégorie ou une catégorie au-dessus). Les essais barrés sont ratés.</p></div>`;
    const more = $app.querySelector("#more");
    if (more) more.addEventListener("click", () => { state.showAll = !state.showAll; viewAthlete(lic); });
  }

  function chart(rows) {
    const pts = rows.filter((r) => r.total && r.date);
    if (pts.length < 2) return `<p class="empty">Il faut au moins deux compétitions pour tracer la courbe.</p>`;
    const W = 640, H = 260, L = 38, R = 10, T = 10, B = 26;
    const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date);
    const maxV = Math.max(...pts.map((r) => r.total)), minV = Math.min(...pts.map((r) => r.snatch || r.total));
    const lo = Math.max(0, Math.floor((minV * 0.85) / 10) * 10), hi = Math.ceil((maxV * 1.05) / 10) * 10;
    const x = (d) => L + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const step = (hi - lo) > 150 ? 50 : (hi - lo) > 60 ? 20 : 10;
    let grid = "";
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${v}</text>`;
    const y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear();
    for (let yr = y0 + 1; yr <= y1; yr++) {
      const xx = x(`${yr}-01-01`);
      grid += `<line x1="${xx}" x2="${xx}" y1="${T}" y2="${H - B}" stroke="var(--line)" stroke-dasharray="3 3"/><text x="${xx}" y="${H - 8}" font-size="11" text-anchor="middle" fill="var(--muted)">${yr}</text>`;
    }
    const line = (k, color) => {
      const p = pts.filter((r) => r[k]);
      const d = p.map((r, i) => `${i ? "L" : "M"}${x(r.date).toFixed(1)},${y(r[k]).toFixed(1)}`).join("");
      const dots = p.map((r) => `<circle cx="${x(r.date).toFixed(1)}" cy="${y(r[k]).toFixed(1)}" r="3" fill="${color}"><title>${frDate(r.date)} · ${kg(r[k])} kg · ${esc(r.competition)}</title></circle>`).join("");
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>${dots}`;
    };
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progression">${grid}${line("snatch", "var(--snatch)")}${line("cj", "var(--cj)")}${line("total", "var(--total)")}</svg>`;
  }

  function seasonBars(obj) {
    const entries = Object.entries(obj);
    if (!entries.length) return `<p class="empty">Pas encore de total valide.</p>`;
    const max = Math.max(...entries.map(([, v]) => v));
    return `<div class="seasons">${entries.map(([s, v]) => `
      <div class="season-row"><span class="muted">${esc(s)}</span><span class="b" style="width:${Math.max(4, (v / max) * 100)}%"></span><b class="num">${v} kg</b></div>`).join("")}</div>`;
  }

  function levelsCard(a) {
    const block = (scale, levels) => `<div class="levels">${levels.map((l) => {
      const got = a.levels[`${scale}:${l.key}`];
      const codes = l.codes.join(" · ");
      return `<div class="lvl ${got ? "got" : ""}"><div class="code">${esc(codes)}</div><div class="name">${esc(l.label)}</div>
        <div class="when">${got ? `${frDate(got.first)}<br><span class="muted small">${got.count} fois</span>` : "—"}</div></div>`;
    }).join("")}</div>`;
    const hasMasters = Object.keys(a.levels).some((k) => k.startsWith("masters:"));
    const hist = a.level_history.slice().sort((x, y) => x.date.localeCompare(y.date));
    return `<div class="card"><h2>Mes niveaux de performance (séries FFHM)</h2>
      <p class="muted small">La série est attribuée par la Fédé selon le total réalisé. En vert : niveaux déjà atteints, avec la date de la première fois et le nombre de fois.</p>
      ${block("ffhm", D.meta.series_levels)}
      ${hasMasters ? `<h2 style="margin-top:16px">Séries Masters</h2>${block("masters", D.meta.masters_levels)}` : ""}
      ${hist.length ? `<h2 style="margin-top:16px">Chaque nouveau niveau atteint</h2><div class="tbl-wrap"><table>
        <tr><th>Niveau</th><th>Date</th><th>Cat.</th><th class="num">Total</th><th>Compétition</th></tr>
        ${hist.map((h) => `<tr><td><b>${esc(h.level)}</b></td><td>${frDate(h.date)}</td><td>${esc(h.age_cat)}</td><td class="num">${h.total}</td><td class="comp">${esc(h.competition)}</td></tr>`).join("")}
      </table></div>` : ""}</div>`;
  }

  function attempts(arr) {
    if (!arr || !arr.some((v) => v !== null)) return "";
    return `<span class="att">${arr.map((v) => (v === null ? "·" : v < 0 ? `<span class="ko">${-v}</span>` : v)).join(" / ")}</span>`;
  }

  function resultsTable(rows, n) {
    return `<div class="tbl-wrap"><table>
      <tr><th>Date</th><th>Compétition</th><th>Cat.</th><th class="num">PC</th><th class="num">Arr.</th><th class="num">É-J</th><th class="num">Total</th><th>Série</th></tr>
      ${rows.slice(0, n).map((r) => `<tr>
        <td>${frDate(r.date)}</td>
        <td class="comp">${r.competition_url ? `<a href="${esc(r.competition_url)}" target="_blank" rel="noopener">${esc(r.competition)}</a>` : esc(r.competition)}
          ${r.records.length ? `<br><span class="badge" title="${esc(r.records.join(" · "))}">Record 95 · ${esc(r.records[0])}${r.records.length > 1 ? ` +${r.records.length - 1}` : ""}</span>` : ""}</td>
        <td>${esc(r.age_cat)}<br><span class="muted small">${esc(r.weight_class || "")}</span></td>
        <td class="num">${kg(r.bw)}</td>
        <td class="num"><b>${r.snatch || "0"}</b>${attempts(r.snatch_attempts)}</td>
        <td class="num"><b>${r.cj || "0"}</b>${attempts(r.cj_attempts)}</td>
        <td class="num"><b>${r.total || "—"}</b></td>
        <td>${esc(r.series)}</td></tr>`).join("")}
    </table></div>`;
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
    const cell = (rec) => rec
      ? `<td class="rec-holder"><b>${kg(rec.value)} kg</b><br>${athleteLink(rec.licence, rec.athlete)}<br><span class="muted">${frDate(rec.date)}</span></td>`
      : `<td class="empty">—</td>`;
    $app.innerHTML = `
      <h1>Records du Val d'Oise</h1>
      <div class="sub">Calculés sur les résultats de l'AFHMA Franconville, du HFC CP95 Cergy et de WIM LIFT depuis 2020/21.
        Une perf compte dans la catégorie d'âge de l'athlète et dans celles au-dessus (U15 → U17, U20, Senior ; Masters → leur tranche + Senior ; U13 → U13 uniquement). Catégorie de poids recalculée d'après le poids de corps. Seules les perfs avec un total valide comptent.</div>
      <div class="chips">${periods.map((p) => `<button class="chip ${p === state.recPeriod ? "on" : ""}" data-p="${p}">${esc(D.meta.periods[p])}</button>`).join("")}</div>
      <div class="chips">${["F", "M"].map((s) => `<button class="chip ${s === state.recSex ? "on" : ""}" data-s="${s}">${sexPlural(s)}</button>`).join("")}</div>
      <div class="chips">${ages.map((a) => `<button class="chip ${a === state.recAge ? "on" : ""}" data-a="${a}">${a}</button>`).join("")}</div>
      <div class="card"><div class="tbl-wrap"><table>
        <tr><th>Catégorie</th><th>Arraché</th><th>Épaulé-jeté</th><th>Total</th></tr>
        ${list.map((r) => `<tr><td><b>${esc(r.weight_class)}</b></td>${cell(r.snatch)}${cell(r.cj)}${cell(r.total)}</tr>`).join("")}
      </table></div></div>`;
    $app.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => { state.recPeriod = b.dataset.p; viewRecords(); }));
    $app.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => { state.recSex = b.dataset.s; viewRecords(); }));
    $app.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => { state.recAge = b.dataset.a; viewRecords(); }));
  }

  // ---------- derniers records battus
  function viewLatest() {
    setNav("derniers");
    const label = Object.fromEntries(LIFTS);
    const items = D.records.history.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
    $app.innerHTML = `
      <h1>Derniers records battus</h1>
      <div class="sub">Les 60 derniers records du 95 battus, toutes catégories confondues.</div>
      <div class="card"><div class="tbl-wrap"><table>
        <tr><th>Date</th><th>Athlète</th><th>Catégorie</th><th>Mouvement</th><th class="num">Record</th><th class="num">Ancien</th></tr>
        ${items.map((h) => `<tr><td>${frDate(h.date)}</td><td>${athleteLink(h.licence, h.athlete)}<br><span class="muted small">${esc(h.club)}</span></td>
          <td>${esc(h.age_cat)} ${h.sex} ${esc(h.weight_class)}</td><td>${label[h.lift]}</td><td class="num"><b>${kg(h.value)} kg</b></td>
          <td class="num muted">${h.previous ? `${kg(h.previous)} kg<br><span class="small">${esc(h.previous_holder)}</span>` : "nouveau"}</td></tr>`).join("")}
      </table></div></div>`;
  }

  // ---------- routeur
  function route() {
    const h = location.hash.replace(/^#/, "") || "/";
    if (h.startsWith("/a/")) { viewAthlete(decodeURIComponent(h.slice(3))); }
    else if (h === "/records") viewRecords();
    else if (h === "/derniers") viewLatest();
    else viewHome();
    if (!h.startsWith("/a/")) state.showAll = false;
    window.scrollTo(0, 0);
  }

  load().then(() => { window.addEventListener("hashchange", route); route(); })
    .catch((e) => { $app.innerHTML = `<p class="pad center">Impossible de charger les données. Réessaie dans un instant.</p>`; console.error(e); });
})();
