(function () {
  function buildPayloadCandidates() {
    const origin = window.location.origin || "";
    const pathname = window.location.pathname || "/";
    const segments = pathname.split("/").filter(Boolean);
    const projectBase = segments.length > 0 ? `/${segments[0]}` : "";
    const currentDir = pathname.endsWith("/") ? pathname : pathname.replace(/[^/]*$/, "");
    const candidates = [
      "data/dashboard_payload.json",
      "./data/dashboard_payload.json",
      "/data/dashboard_payload.json",
      "/dashboard/data/dashboard_payload.json",
      `${projectBase}/data/dashboard_payload.json`,
      `${origin}${projectBase}/data/dashboard_payload.json`,
      `${origin}${currentDir}data/dashboard_payload.json`,
    ];
    return [...new Set(candidates.filter(Boolean))];
  }

  const PAYLOAD_CANDIDATES = buildPayloadCandidates();
  const REPLAY_CANDIDATES = [
    "../reports/lv2022_night_replay_report.json",
    "/reports/lv2022_night_replay_report.json",
  ];

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmtNumber(value, digits) {
    const n = toNumber(value);
    return n === null ? "-" : n.toFixed(digits);
  }

  function fmtInt(value) {
    const n = toNumber(value);
    return n === null ? "-" : Math.round(n).toLocaleString("fo-FO");
  }

  function fmtPercent(value, digits) {
    const n = toNumber(value);
    return n === null ? "-" : `${n.toFixed(digits)}%`;
  }

  function maeDelta(modelMae, naiveMae) {
    const m = toNumber(modelMae);
    const n = toNumber(naiveMae);
    if (m === null || n === null) return null;
    return n - m;
  }

  function badge(status) {
    if (status === "passed") return '<span class="badge badge-pass">OK</span>';
    if (status === "failed") return '<span class="badge badge-fail">Feilur</span>';
    return '<span class="badge badge-missing">Vantar</span>';
  }

  function showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="callout callout-error"><strong>Feilur:</strong> ${esc(message)}</div>`;
  }

  function showEmpty(containerId, message) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="callout"><strong>Upplating:</strong> ${esc(message)}</div>`;
  }

  async function getJson(urlOrUrls) {
    const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    let lastErr = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
        return await r.json();
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("fetch failed for all URLs");
  }

  function safeRows(arrayLike) {
    return Array.isArray(arrayLike) ? arrayLike : [];
  }

  function statusText(phase) {
    if (phase === "passed") return "Tilbúgvið";
    if (phase === "failed") return "Krevur arbeiði";
    return "Ókent";
  }

  window.renderOverviewPage = async function () {
    let payload;
    try {
      payload = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError("last-sync", err?.message || "Kundi ikki lesa dashboard payload");
      return;
    }

    const generated = payload.generated_at_utc || "-";
    const phase = payload.phase_status || {};
    const model = payload.model || {};

    const lastSync = document.getElementById("last-sync");
    if (lastSync) lastSync.textContent = `Dagført ${generated}`;

    const p1 = phase.phase1?.overall_status || "missing";
    const p3 = phase.phase3?.overall_status || "missing";
    const p4 = phase.phase4?.overall_status || "missing";

    const kpiP1 = document.getElementById("kpi-phase1");
    const kpiP3 = document.getElementById("kpi-phase3");
    const kpiP4 = document.getElementById("kpi-phase4");
    const kpiDiv = document.getElementById("kpi-div");

    if (kpiP1) kpiP1.innerHTML = `${badge(p1)}<div class="kpi-sub">${statusText(p1)}</div>`;
    if (kpiP3) kpiP3.innerHTML = `${badge(p3)}<div class="kpi-sub">${statusText(p3)}</div>`;
    if (kpiP4) kpiP4.innerHTML = `${badge(p4)}<div class="kpi-sub">${statusText(p4)}</div>`;
    if (kpiDiv) kpiDiv.innerHTML = `<div class="kpi">${fmtInt(model.n_divergences)}</div><div class="kpi-sub">Tal eigur at vera 0</div>`;
  };

  function renderNowcastPanels(demo, ids, summaryText) {
    const parties = safeRows(demo.parties)
      .filter((x) => toNumber(x.vote_share) !== null)
      .sort((a, b) => (toNumber(b.vote_share) || 0) - (toNumber(a.vote_share) || 0));

    const partyGrid = document.getElementById(ids.partyGridId);
    if (!parties.length) {
      showEmpty(ids.partyGridId, "Eingin flokksmeting er tøk enn.");
    } else if (partyGrid) {
      partyGrid.innerHTML = parties
        .map((x) => {
          const delta = toNumber(x.delta) || 0;
          const up = delta >= 0;
          const sign = up ? "+" : "";
          const partyId = String(x.party_id || "").trim();
          const label = String(x.label || "").trim();
          const showId = label && label.toUpperCase() !== partyId.toUpperCase();
          return `
            <article class="party-card">
              <div class="party-topline">
                <strong>${esc(label || partyId || "-")}</strong>
                ${showId ? `<span class="party-name">(${esc(partyId)})</span>` : ""}
              </div>
              <div class="party-metric">${fmtPercent(x.vote_share, 1)}</div>
              <div class="${up ? "party-delta-up" : "party-delta-down"}">${sign}${fmtNumber(delta, 1)} pp</div>
              <div class="party-seatline">Sessir: <strong>${fmtInt(x.seat_mid)}</strong> (${fmtInt(x.seat_lo)}-${fmtInt(x.seat_hi)})</div>
            </article>
          `;
        })
        .join("");
    }

    const nowcastSummary = demo.summary || {};
    const reportedBasis = String(nowcastSummary.reported_pct_basis || "");
    const reportingSites = toNumber(nowcastSummary.reporting_sites);
    const eligibleSiteCount = toNumber(nowcastSummary.eligible_site_count);
    const observedVotes = toNumber(nowcastSummary.turnout_observed_total_votes ?? nowcastSummary.observation_total_votes);
    const eligibleVotes = toNumber(nowcastSummary.eligible_total_votes);

    const timelineRows = safeRows(demo.timeline)
      .map((row) => ({
        t: String(row.t || "-"),
        reportedPct: toNumber(row.reported_pct),
        uncertainty: toNumber(row.uncertainty),
      }))
      .filter((row) => row.reportedPct !== null || row.uncertainty !== null);

    const timeline = document.getElementById(ids.timelineId);
    if (!timelineRows.length) {
      showEmpty(ids.timelineId, "Eingin framgongd-data er tøk enn.");
    } else if (timelineRows.length === 1 && timeline) {
      const only = timelineRows[0];
      const basisLine = reportedBasis === "reporting_sites"
        ? `<p><strong>Frágreiðandi valstaðir:</strong> ${fmtInt(reportingSites)} av ${fmtInt(eligibleSiteCount)}</p>`
        : `<p><strong>Talda atkvøður / skrásettir veljarar:</strong> ${fmtInt(observedVotes)} / ${fmtInt(eligibleVotes)}</p>`;
      timeline.innerHTML = `
        <div class="callout">
          <p><strong>Tid:</strong> ${esc(only.t)}</p>
          <p><strong>Framgongd í uppteljing:</strong> ${fmtPercent(only.reportedPct, 1)}</p>
          ${basisLine}
          <p><strong>Ovissa:</strong> ±${fmtNumber(only.uncertainty, 1)}</p>
        </div>
      `;
    } else if (timeline) {
      const maxUncertainty = Math.max(0.1, ...timelineRows.map((x) => x.uncertainty || 0));
      timeline.innerHTML = timelineRows
        .map((row) => {
          const reported = Math.max(0, Math.min(100, row.reportedPct || 0));
          const uncertainty = Math.max(0, row.uncertainty || 0);
          const uncertaintyBar = Math.max(4, Math.round((uncertainty / maxUncertainty) * 100));
          return `
            <div class="timeline-row">
              <div class="timeline-time">${esc(row.t)}</div>
              <div>
                <div class="track"><div class="fill-reported" style="width:${reported}%"></div></div>
                <div class="track"><div class="fill-unc" style="width:${uncertaintyBar}%"></div></div>
              </div>
              <div class="timeline-v">${fmtPercent(reported, 1)} / ±${fmtNumber(uncertainty, 1)}</div>
            </div>
          `;
        })
        .join("");
    }

    const map = document.getElementById(ids.mapId);
    if (map) {
      const latest = timelineRows[timelineRows.length - 1] || null;
      map.innerHTML = `
        <div class="callout">
          <p><strong>Samandráttur:</strong> ${esc(summaryText)}</p>
          <p><strong>Seinasta framgongd:</strong> ${latest ? `${fmtPercent(latest.reportedPct, 1)}, óvissa ±${fmtNumber(latest.uncertainty, 1)}` : "Ikki tøk"}</p>
          <p><strong>Viðmerking:</strong> Landakort er tikið burtur av hesi síðu fyri at sleppa undan villleiðandi visualisering.</p>
        </div>
      `;
    }
  }

  window.renderNowcastPage = async function () {
    let payload;
    try {
      payload = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError("party-grid", err?.message || "Kundi ikki lesa dashboard payload");
      showError("timeline", err?.message || "Kundi ikki lesa dashboard payload");
      showError("map", err?.message || "Kundi ikki lesa dashboard payload");
      return;
    }

    const demo = payload.demo_nowcast || {};
    renderNowcastPanels(
      demo,
      { partyGridId: "party-grid", timelineId: "timeline", mapId: "map" },
      "Núverandi síða vísir bert staðfestar kjarnutøl."
    );
  };

  window.renderPollAdjustedNowcastPage = async function () {
    let payload;
    try {
      payload = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError("poll-impact", err?.message || "Kundi ikki lesa dashboard payload");
      showError("party-grid-polls", err?.message || "Kundi ikki lesa dashboard payload");
      showError("timeline-polls", err?.message || "Kundi ikki lesa dashboard payload");
      showError("map-polls", err?.message || "Kundi ikki lesa dashboard payload");
      return;
    }

    const baseline = payload.demo_nowcast || {};
    const withPolls = payload.demo_nowcast_with_polls || baseline;
    renderNowcastPanels(
      withPolls,
      { partyGridId: "party-grid-polls", timelineId: "timeline-polls", mapId: "map-polls" },
      "Henda síða vísir metingina, har veljarakanningar eru tiknar við í online dagføringini."
    );

    const impact = document.getElementById("poll-impact");
    if (!impact) {
      return;
    }

    const baselineParties = safeRows(baseline.parties);
    const pollParties = safeRows(withPolls.parties);
    const byId = new Map();
    baselineParties.forEach((row) => byId.set(String(row.party_id || "").toUpperCase(), row));

    const changed = pollParties
      .map((row) => {
        const id = String(row.party_id || "").toUpperCase();
        const base = byId.get(id) || {};
        return {
          id,
          label: String(row.label || id || "-"),
          voteShift: (toNumber(row.vote_share) || 0) - (toNumber(base.vote_share) || 0),
          seatShift: Math.round((toNumber(row.seat_mid) || 0) - (toNumber(base.seat_mid) || 0)),
        };
      })
      .sort((a, b) => Math.abs(b.voteShift) - Math.abs(a.voteShift));

    const top = changed[0] || null;
    const seatsMoved = changed.reduce((acc, x) => acc + Math.abs(x.seatShift), 0);
    const voteShiftSum = changed.reduce((acc, x) => acc + Math.abs(x.voteShift), 0);

    impact.innerHTML = `
      <div class="impact-grid">
        <article class="impact-card">
          <div class="impact-title">Størsta broyting</div>
          <div class="impact-value">${top ? esc(top.label) : "-"}</div>
          <div class="impact-note">${top ? `${top.voteShift >= 0 ? "+" : ""}${fmtNumber(top.voteShift, 2)} pp` : "Eingin samanbering"}</div>
        </article>
        <article class="impact-card">
          <div class="impact-title">Samlað broyting í sessum</div>
          <div class="impact-value">${fmtInt(seatsMoved)}</div>
          <div class="impact-note">Samanlagt skift yvir allar flokkar</div>
        </article>
        <article class="impact-card">
          <div class="impact-title">Samlað broyting í partum</div>
          <div class="impact-value">${fmtNumber(voteShiftSum, 2)} pp</div>
          <div class="impact-note">Samanlagt absolutt skift móti no-poll meting</div>
        </article>
      </div>
    `;
  };

  window.renderDiagnosticsPage = async function () {
    let payload;
    try {
      payload = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError("gate-table", err?.message || "Kundi ikki lesa dashboard payload");
      showError("model-summary", err?.message || "Kundi ikki lesa dashboard payload");
      showError("ppc-bars", err?.message || "Kundi ikki lesa dashboard payload");
      return;
    }

    const phase = payload.phase_status || {};
    const rows = [
      ["Phase 1", phase.phase1 || {}],
      ["Phase 3", phase.phase3 || {}],
      ["Phase 4", phase.phase4 || {}],
    ];

    const gateTable = document.getElementById("gate-table");
    if (gateTable) {
      gateTable.innerHTML = `
        <table class="status-table">
          <thead><tr><th>Fasa</th><th>Støða</th><th>Feilir</th></tr></thead>
          <tbody>
            ${rows
              .map(([label, val]) => `<tr><td>${label}</td><td>${badge(val.overall_status || "missing")}</td><td>${fmtInt(val.failed_count || 0)}</td></tr>`)
              .join("")}
          </tbody>
        </table>
      `;
    }

    const model = payload.model || {};
    const modelSummary = document.getElementById("model-summary");
    if (modelSummary) {
      modelSummary.innerHTML = `
        <div class="stats-list">
          <div><strong>Konvergerað:</strong> ${model.converged ? "Ja" : "Nei"}</div>
          <div><strong>Rhat max:</strong> ${fmtNumber(model.rhat_max, 3)}</div>
          <div><strong>ESS bulk min:</strong> ${fmtNumber(model.ess_bulk_min, 2)}</div>
          <div><strong>Divergensir:</strong> ${fmtInt(model.n_divergences)}</div>
          <div><strong>PPC coverage (90%):</strong> ${fmtNumber(model.coverage_vote_share_90, 2)}</div>
        </div>
      `;
    }

    const ppc = safeRows(model.ppc_party);
    const bars = document.getElementById("ppc-bars");
    if (!ppc.length) {
      showEmpty("ppc-bars", "Eingin ppc flokkslisti funnin.");
    } else if (bars) {
      bars.innerHTML = ppc
        .map((x) => {
          const val = Math.max(0, Math.min(1, toNumber(x.ppc_p_value) || 0));
          return `
            <div class="bar-row">
              <div>${esc(x.party_id || "-")}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round(val * 100)}%"></div></div>
              <div>${fmtNumber(val, 2)}</div>
            </div>
          `;
        })
        .join("");
    }
  };

  window.renderDataPage = async function () {
    let payload;
    try {
      payload = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError("data-overview", err?.message || "Kundi ikki lesa dashboard payload");
      showError("data-counts", err?.message || "Kundi ikki lesa dashboard payload");
      showError("consistency-flags", err?.message || "Kundi ikki lesa dashboard payload");
      showError("mapping-summary", err?.message || "Kundi ikki lesa dashboard payload");
      showError("mapping-table", err?.message || "Kundi ikki lesa dashboard payload");
      return;
    }

    const audit = payload.data_audit || {};
    const consistency = audit.consistency || {};
    const counts = consistency.counts || {};
    const ib = audit.ib01031_summary || {};
    const muni = audit.municipality_resolution || {};
    const muniCounts = safeRows(ib.municipality_counts);
    const rows = safeRows(audit.mapping_rows);

    const overview = document.getElementById("data-overview");
    if (overview) {
      overview.innerHTML = `
        <div class="stats-list">
          <div><strong>IB01031 mánði:</strong> ${esc(ib.ib01031_month || "-")}</div>
          <div><strong>Lokalitetir:</strong> ${fmtInt(ib.total_localities)}</div>
          <div><strong>Mappaðir:</strong> ${fmtInt(ib.ib01031_mapped)}</div>
          <div><strong>Ómappaðir:</strong> ${fmtInt(ib.ib01031_unmapped)}</div>
          <div><strong>Klárt til training:</strong> ${consistency.ready_for_training === true ? "Ja" : "Nei"}</div>
          <div><strong>Klárt til live run:</strong> ${consistency.ready_for_live_run === true ? "Ja" : "Nei"}</div>
        </div>
      `;
    }

    const countsNode = document.getElementById("data-counts");
    const orderedCounts = Object.entries(counts).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    if (!orderedCounts.length) {
      showEmpty("data-counts", "Eingin talvusamandráttur er tøk.");
    } else if (countsNode) {
      countsNode.innerHTML = `
        <table class="status-table">
          <thead><tr><th>Talva</th><th>Raðir</th></tr></thead>
          <tbody>${orderedCounts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${fmtInt(v)}</td></tr>`).join("")}</tbody>
        </table>
      `;
    }

    const checks = muni.checks || {};
    const flags = document.getElementById("consistency-flags");
    if (flags) {
      flags.innerHTML = `
        <div class="stats-list">
          <div><strong>Mapping-fila:</strong> ${esc(checks.mapping_file || "-")}</div>
          <div><strong>Coverage rows:</strong> ${fmtInt(checks.coverage_rows)}</div>
          <div><strong>Candidate rows:</strong> ${fmtInt(checks.candidate_rows)}</div>
          <div><strong>Override rows:</strong> ${fmtInt(checks.override_rows)}</div>
          <div><strong>Pending candidates:</strong> ${fmtInt(checks.pending_candidates)}</div>
          <div><strong>Strict mode:</strong> ${checks.strict ? "Ja" : "Nei"}</div>
        </div>
      `;
    }

    const summary = document.getElementById("mapping-summary");
    if (!muniCounts.length) {
      showEmpty("mapping-summary", "Eingin kommunusamandráttur er tøk.");
    } else if (summary) {
      summary.innerHTML = `
        <table class="status-table">
          <thead><tr><th>Kommuna</th><th>Lokalitetir</th></tr></thead>
          <tbody>${muniCounts.slice(0, 50).map((x) => `<tr><td>${esc(x.municipality)}</td><td>${fmtInt(x.localities)}</td></tr>`).join("")}</tbody>
        </table>
      `;
    }

    const overlaySelect = document.getElementById("municipality-overlay");
    const timeSelect = document.getElementById("overlay-timepoint");
    const mapNode = document.getElementById("municipality-map");
    if (overlaySelect && timeSelect && mapNode) {
      mapNode.innerHTML = "<div class='callout'>Kommunu-overlay er ikki viðkomandi fyri driftsstodu jattan her; brúka tabellina omanfyri.</div>";
      overlaySelect.disabled = true;
      timeSelect.disabled = true;
    }

    const filterBox = document.getElementById("mapping-filter");
    const tableNode = document.getElementById("mapping-table");
    function renderMapRows(query) {
      const q = String(query || "").trim().toLowerCase();
      const filtered = rows
        .filter((x) => {
          if (!q) return true;
          const loc = String(x.locality || "").toLowerCase();
          const munName = String(x.municipality_current || "").toLowerCase();
          const code = String(x.locality_code || "").toLowerCase();
          return loc.includes(q) || munName.includes(q) || code.includes(q);
        })
        .slice(0, 300);

      if (!tableNode) return;
      if (!filtered.length) {
        tableNode.innerHTML = "<div class='callout'>Eingin lokalitetur fannst við hesum filtri.</div>";
        return;
      }
      tableNode.innerHTML = `
        <table class="status-table">
          <thead><tr><th>Kota</th><th>Lokalitetur</th><th>Kommuna</th><th>Folkatal</th></tr></thead>
          <tbody>
            ${filtered
              .map((x) => `<tr><td>${esc(x.locality_code)}</td><td>${esc(x.locality)}</td><td>${esc(x.municipality_current)}</td><td>${fmtInt(x.population)}</td></tr>`)
              .join("")}
          </tbody>
        </table>
      `;
    }

    renderMapRows("");
    if (filterBox) filterBox.addEventListener("input", () => renderMapRows(filterBox.value));
  };

  window.renderReplayPage = async function () {
    let payload;
    try {
      payload = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError("replay-summary", err?.message || "Kundi ikki lesa dashboard payload");
      showError("replay-eval", err?.message || "Kundi ikki lesa dashboard payload");
      showError("replay-trace", err?.message || "Kundi ikki lesa dashboard payload");
      showError("replay-map", err?.message || "Kundi ikki lesa dashboard payload");
      return;
    }

    let replays = safeRows(payload.replays);
    if (!replays.length) {
      try {
        const fallback = await getJson(REPLAY_CANDIDATES);
        replays = [
          {
            election: fallback.election || "Replay",
            n_updates: fallback.n_updates || 0,
            final_timestamp: fallback.final_timestamp || "-",
            summary: fallback.summary || {},
            trace: safeRows(fallback.trace),
          },
        ];
      } catch (err) {
        showEmpty("replay-summary", "Eingin replay-data er tøk.");
        showEmpty("replay-eval", "Eingin replay-data er tøk.");
        showEmpty("replay-trace", "Eingin replay-data er tøk.");
        showEmpty("replay-map", "Replay-kort er tikið burtur fyri at forða fyri villleiding.");
        return;
      }
    }

    const electionSelect = document.getElementById("replay-election");
    const timepointSelect = document.getElementById("replay-timepoint");
    const summaryNode = document.getElementById("replay-summary");
    const evalNode = document.getElementById("replay-eval");
    const traceNode = document.getElementById("replay-trace");
    const replayMapNode = document.getElementById("replay-map");

    if (replayMapNode) {
      replayMapNode.innerHTML = "<div class='callout'>Replay-kort er tikið burtur. Bruka tabellur niðanfyri fyri greiðan samanburd.</div>";
    }

    if (!electionSelect || !timepointSelect || !summaryNode || !evalNode || !traceNode) {
      return;
    }

    electionSelect.innerHTML = replays
      .map((r, idx) => `<option value="${idx}">${esc(r.election || `Val ${idx + 1}`)}</option>`)
      .join("");

    function renderTraceTable(trace, selectedTimestamp) {
      traceNode.innerHTML = `
        <table class="status-table">
          <thead><tr><th>Tid</th><th>Uppgjort %</th><th>MAE model</th><th>MAE naive</th><th>Delta (naive-model)</th></tr></thead>
          <tbody>
            ${trace
              .map((x) => {
                const selected = String(x.timestamp || "") === String(selectedTimestamp || "") ? " selected-row" : "";
                return `<tr class="${selected}"><td>${esc(x.timestamp)}</td><td>${fmtNumber(x.reported_pct, 1)}</td><td>${fmtNumber(x.mae_model, 4)}</td><td>${fmtNumber(x.mae_naive, 4)}</td><td>${fmtNumber(maeDelta(x.mae_model, x.mae_naive), 4)}</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      `;
    }

    function renderElection() {
      const replay = replays[Number(electionSelect.value) || 0] || replays[0] || {};
      const summary = replay.summary || {};
      const trace = safeRows(replay.trace);
      const times = trace.map((x) => String(x.timestamp || "")).filter(Boolean);
      timepointSelect.innerHTML = times.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
      if (!timepointSelect.value && times.length) timepointSelect.value = times[Math.floor(times.length / 2)];

      summaryNode.innerHTML = `
        <div class="stats-list">
          <div><strong>Val:</strong> ${esc(replay.election || "-")}</div>
          <div><strong>Updates:</strong> ${fmtInt(replay.n_updates)}</div>
          <div><strong>Seinasta tid:</strong> ${esc(replay.final_timestamp || "-")}</div>
          <div><strong>Byrjan (model MAE):</strong> ${fmtNumber(summary.first_update?.mae_model, 4)}</div>
          <div><strong>Midan (model MAE):</strong> ${fmtNumber(summary.mid_update?.mae_model, 4)}</div>
          <div><strong>Endi (model MAE):</strong> ${fmtNumber(summary.last_update?.mae_model, 4)}</div>
        </div>
      `;

      function renderTimepoint() {
        const ts = String(timepointSelect.value || "");
        const row = trace.find((x) => String(x.timestamp || "") === ts) || trace[0] || null;
        if (!row) {
          evalNode.innerHTML = "<div class='callout'>Eingin replay-meting fyri valda tid.</div>";
          traceNode.innerHTML = "";
          return;
        }

        evalNode.innerHTML = `
          <div class="stats-list">
            <div><strong>Tidspunkt:</strong> ${esc(row.timestamp)}</div>
            <div><strong>Uppgjordur partur:</strong> ${fmtPercent(row.reported_pct, 1)}</div>
            <div><strong>Uppgjordar atkvodur:</strong> ${fmtInt(row.reported_votes)}</div>
            <div><strong>Model MAE:</strong> ${fmtNumber(row.mae_model, 4)}</div>
            <div><strong>Naive MAE:</strong> ${fmtNumber(row.mae_naive, 4)}</div>
            <div><strong>Model minus naive (MAE):</strong> ${fmtNumber(maeDelta(row.mae_model, row.mae_naive), 4)}</div>
          </div>
        `;

        renderTraceTable(trace, row.timestamp);
      }

      timepointSelect.onchange = renderTimepoint;
      renderTimepoint();
    }

    const defaultIndex = replays.findIndex((r) => String(r.election || "").includes("2022"));
    if (defaultIndex >= 0) {
      electionSelect.value = String(defaultIndex);
    }

    electionSelect.onchange = renderElection;
    renderElection();
  };

  window.renderPollsPage = async function () {
    let payload;
    try {
      payload = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError("polls-summary", err?.message || "Kundi ikki lesa dashboard payload");
      showError("polls-table", err?.message || "Kundi ikki lesa dashboard payload");
      return;
    }

    const block = payload.latest_polls || {};
    const rows = safeRows(block.rows);
    const familySelect = document.getElementById("poll-family");
    const partySelect = document.getElementById("poll-party");
    const summaryNode = document.getElementById("polls-summary");
    const tableNode = document.getElementById("polls-table");

    if (!summaryNode || !tableNode || !familySelect || !partySelect) return;

    if (!rows.length) {
      summaryNode.innerHTML = "<div class='callout'>Ongar veljarakanningar funnar seinastu 4 arini.</div>";
      tableNode.innerHTML = "";
      return;
    }

    const families = [...new Set(rows.map((r) => String(r.election_family || "unknown")))].sort();
    const parties = [...new Set(rows.map((r) => String(r.party_id || "").toUpperCase()).filter(Boolean))].sort();
    const partyLabels = {};
    rows.forEach((r) => {
      const id = String(r.party_id || "").toUpperCase();
      if (!id) return;
      const label = String(r.party_label || r.party_id || "").trim();
      if (!partyLabels[id]) {
        partyLabels[id] = label;
      }
    });

    familySelect.innerHTML = ["all", ...families]
      .map((v) => `<option value="${esc(v)}">${v === "all" ? "Allar" : esc(v)}</option>`)
      .join("");
    partySelect.innerHTML = ["all", ...parties]
      .map((v) => `<option value="${esc(v)}">${v === "all" ? "Allir" : esc(partyLabels[v] || v)}</option>`)
      .join("");

    function renderTable() {
      const fam = familySelect.value || "all";
      const party = partySelect.value || "all";
      const filtered = rows
        .filter((r) => {
          const famOk = fam === "all" || String(r.election_family || "") === fam;
          const partyOk = party === "all" || String(r.party_id || "").toUpperCase() === party;
          return famOk && partyOk;
        })
        .sort((a, b) => String(b.poll_date || "").localeCompare(String(a.poll_date || "")));

      const pollIds = new Set(filtered.map((r) => String(r.poll_id || "")));
      const latestDate = filtered.length ? filtered[0].poll_date : "-";
      const earliestDate = filtered.length ? filtered[filtered.length - 1].poll_date : "-";

      summaryNode.innerHTML = `
        <div class="stats-list">
          <div><strong>Radir:</strong> ${fmtInt(filtered.length)}</div>
          <div><strong>Einstakar kanningar:</strong> ${fmtInt(pollIds.size)}</div>
          <div><strong>Tidarskeid:</strong> ${esc(earliestDate)} til ${esc(latestDate)}</div>
          <div><strong>Keldur:</strong> ${esc(safeRows(block.sources).join(", ") || "-")}</div>
        </div>
      `;

      if (!filtered.length) {
        tableNode.innerHTML = "<div class='callout'>Eingin rada passar til valdu filter.</div>";
        return;
      }

      tableNode.innerHTML = `
        <table class="status-table polls-table">
          <thead><tr><th>Dagur</th><th>Valfamilja</th><th>Poll ID</th><th>Flokkur</th><th>Partur %</th><th>Urtak</th><th>Stovnur</th></tr></thead>
          <tbody>
            ${filtered
              .slice(0, 400)
              .map(
                (r) => `
              <tr>
                <td>${esc(r.poll_date)}</td>
                <td>${esc(r.election_family || "-")}</td>
                <td>${esc(r.poll_id || "-")}</td>
                <td>${esc(r.party_label || r.party_id || "-")}</td>
                <td>${fmtNumber(r.vote_share_percent, 1)}</td>
                <td>${fmtInt(r.sample_size)}</td>
                <td>${esc(r.polling_firm || "-")}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    familySelect.addEventListener("change", renderTable);
    partySelect.addEventListener("change", renderTable);
    renderTable();
  };
})();
