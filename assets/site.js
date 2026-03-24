(function () {
  const PAYLOAD_CANDIDATES = [
    'data/dashboard_payload.json',
    './data/dashboard_payload.json',
    '/dashboard/data/dashboard_payload.json'
  ];
  const REPLAY_CANDIDATES = [
    '../reports/lv2022_night_replay_report.json',
    '/reports/lv2022_night_replay_report.json'
  ];
  const MUNICIPALITY_CENTROIDS = {
    torshavn: [62.01, -6.77],
    runavik: [62.13, -6.78],
    klaksvik: [62.23, -6.59],
    sunda: [62.20, -7.02],
    sorvagur: [62.07, -7.31],
    vagar: [62.05, -7.20],
    tvoroyri: [61.56, -6.81],
    eystur: [62.17, -6.75],
    fuglafjordur: [62.24, -6.81],
    hvalba: [61.60, -6.96],
    husa: [62.27, -6.68],
    husavik: [61.91, -6.69],
    hvalvik: [62.18, -7.00],
    hov: [61.50, -6.76],
    famjin: [61.55, -6.88],
    porkeri: [61.47, -6.74],
    sumba: [61.41, -6.69],
    sandur: [61.84, -6.80],
    skopun: [61.91, -6.88],
    skalavik: [61.81, -6.66],
    kvivik: [62.11, -7.07],
    eidi: [62.30, -7.09],
    nes: [62.10, -6.75],
    sjorvar: [62.10, -6.76],
    sjovar: [62.10, -6.76],
    hvannasund: [62.28, -6.53],
    kunoy: [62.30, -6.67],
    vidareidi: [62.36, -6.53],
    vagur: [61.47, -6.81],
    skugvoy: [61.77, -6.81],
    fugloy: [62.33, -6.28],
    vestmanna: [62.16, -7.17],
  };

  function num(v, d = 2) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(d) : '-';
  }

  function badge(status) {
    if (status === 'passed') return '<span class="badge badge-pass">OK</span>';
    if (status === 'failed') return '<span class="badge badge-fail">FEILUR</span>';
    return '<span class="badge badge-missing">VANTAR</span>';
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeMunicipalityName(name) {
    return String(name || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s*municipality/g, '')
      .replace(/\s*,.*$/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function municipalityKey(name) {
    const n = normalizeMunicipalityName(name);
    if (n === 'eii') return 'eidi';
    if (n === 'sjovar') return 'sjovar';
    if (n === 'sorvagur') return 'sorvagur';
    return n.replace(/\s+/g, '');
  }

  function markerColor(value, maxValue, palette) {
    const t = maxValue > 0 ? (Number(value || 0) / maxValue) : 0;
    if (palette === 'green') {
      if (t > 0.66) return '#177c55';
      if (t > 0.33) return '#3ba06f';
      return '#78c297';
    }
    if (palette === 'red') {
      if (t > 0.66) return '#c73529';
      if (t > 0.33) return '#df6d63';
      return '#ef9b95';
    }
    if (t > 0.66) return '#154b8b';
    if (t > 0.33) return '#2f6fb8';
    return '#6ea1dc';
  }

  async function getJson(urlOrUrls) {
    const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    let lastErr = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
        return await r.json();
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('fetch failed for all URLs');
  }

  function showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = `<p><strong>Feilur:</strong> ${esc(message)}</p>`;
    }
  }

  window.renderOverviewPage = async function () {
    let p;
    try {
      p = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError('last-sync', err?.message || 'Kundi ikki lesa dashboard payload');
      return;
    }
    document.getElementById('last-sync').textContent = `Dagført ${p.generated_at_utc || '-'}`;
    document.getElementById('kpi-phase1').innerHTML = badge(p.phase_status?.phase1?.overall_status || 'missing');
    document.getElementById('kpi-phase3').innerHTML = badge(p.phase_status?.phase3?.overall_status || 'missing');
    document.getElementById('kpi-phase4').innerHTML = badge(p.phase_status?.phase4?.overall_status || 'missing');
    document.getElementById('kpi-div').textContent = String(p.model?.n_divergences ?? '-');
  };

  window.renderNowcastPage = async function () {
    let p;
    try {
      p = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError('party-grid', err?.message || 'Kundi ikki lesa dashboard payload');
      showError('timeline', err?.message || 'Kundi ikki lesa dashboard payload');
      return;
    }
    const demo = p.demo_nowcast || {};
    const parties = Array.isArray(demo.parties) ? demo.parties : [];
    const timeline = Array.isArray(demo.timeline) ? demo.timeline : [];

    document.getElementById('party-grid').innerHTML = parties.map((x) => {
      const up = Number(x.delta || 0) >= 0;
      const sign = up ? '+' : '';
      return `
        <div class="party-card">
          <div><strong>${x.party_id}</strong> <span class="party-name">${x.label}</span></div>
          <div class="party-metric">${num(x.vote_share,1)}%</div>
          <div class="${up ? 'party-delta-up' : 'party-delta-down'}">${sign}${num(x.delta,1)} pp</div>
          <div>Sessir: <strong>${x.seat_mid}</strong> (${x.seat_lo}-${x.seat_hi})</div>
        </div>
      `;
    }).join('');

    const maxU = Math.max(1, ...timeline.map((t) => Number(t.uncertainty || 0)));
    document.getElementById('timeline').innerHTML = timeline.map((t) => {
      const rp = Number(t.reported_pct || 0);
      const un = Number(t.uncertainty || 0);
      const uw = Math.max(5, Math.min(100, Math.round((un / maxU) * 100)));
      return `
        <div class="timeline-row">
          <div class="timeline-time">${t.t}</div>
          <div>
            <div class="track"><div class="fill-reported" style="width:${rp}%"></div></div>
            <div class="track"><div class="fill-unc" style="width:${uw}%"></div></div>
          </div>
          <div class="timeline-v">${rp}% / ±${num(un,1)}</div>
        </div>
      `;
    }).join('');

    if (typeof L !== 'undefined') {
      const map = L.map('map', { scrollWheelZoom: false }).setView([62.05, -6.95], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      [[62.01,-6.77,'Tórshavn'],[62.23,-6.59,'Klaksvík'],[62.07,-7.11,'Vestmanna'],[61.47,-6.81,'Vágur'],[62.16,-7.18,'Sørvágur']]
        .forEach((m) => L.circleMarker([m[0],m[1]], { radius: 8, color: '#fff', weight: 2, fillColor: '#c73529', fillOpacity: .92 }).bindPopup(m[2]).addTo(map));
    }
  };

  window.renderDiagnosticsPage = async function () {
    let p;
    try {
      p = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError('gate-table', err?.message || 'Kundi ikki lesa dashboard payload');
      showError('model-summary', err?.message || 'Kundi ikki lesa dashboard payload');
      return;
    }
    const phase = p.phase_status || {};
    const rows = [['Phase 1', phase.phase1 || {}], ['Phase 3', phase.phase3 || {}], ['Phase 4', phase.phase4 || {}]];

    document.getElementById('gate-table').innerHTML = `
      <table class="status-table">
        <thead><tr><th>Fasa</th><th>Støða</th><th>Tal av feilum</th></tr></thead>
        <tbody>${rows.map(([label,v]) => `<tr><td>${label}</td><td>${badge(v.overall_status || 'missing')}</td><td>${v.failed_count || 0}</td></tr>`).join('')}</tbody>
      </table>
    `;

    const m = p.model || {};
    document.getElementById('model-summary').innerHTML = `
      <p><strong>Konvergerað:</strong> ${m.converged ? 'Ja' : 'Nei'}</p>
      <p><strong>Rhat max:</strong> ${num(m.rhat_max,3)}</p>
      <p><strong>ESS bulk min:</strong> ${num(m.ess_bulk_min,2)}</p>
      <p><strong>Divergensir:</strong> ${m.n_divergences ?? '-'}</p>
      <p><strong>PPC dekningspartur (90%):</strong> ${num(m.coverage_vote_share_90,2)}</p>
    `;

    const ppc = Array.isArray(m.ppc_party) ? m.ppc_party : [];
    document.getElementById('ppc-bars').innerHTML = ppc.map((x) => {
      const v = Math.max(0, Math.min(1, Number(x.ppc_p_value || 0)));
      return `<div class="bar-row"><div>${x.party_id}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v*100)}%"></div></div><div>${v.toFixed(2)}</div></div>`;
    }).join('');
  };

  window.renderDataPage = async function () {
    let p;
    try {
      p = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError('data-overview', err?.message || 'Kundi ikki lesa dashboard payload');
      showError('data-counts', err?.message || 'Kundi ikki lesa dashboard payload');
      showError('consistency-flags', err?.message || 'Kundi ikki lesa dashboard payload');
      showError('mapping-summary', err?.message || 'Kundi ikki lesa dashboard payload');
      return;
    }
    const audit = p.data_audit || {};
    const consistency = audit.consistency || {};
    const counts = consistency.counts || {};
    const muni = audit.municipality_resolution || {};
    const ib = audit.ib01031_summary || {};
    const muniCounts = Array.isArray(ib.municipality_counts) ? ib.municipality_counts : [];
    const rows = Array.isArray(audit.mapping_rows) ? audit.mapping_rows : [];
    const historical = p.historical_overlays || {};

    document.getElementById('data-overview').innerHTML = `
      <p><strong>IB01031 mánði:</strong> ${esc(ib.ib01031_month || '-')}</p>
      <p><strong>Lokalitetir:</strong> ${ib.total_localities ?? '-'}</p>
      <p><strong>Mappaðir:</strong> ${ib.ib01031_mapped ?? '-'}</p>
      <p><strong>Ómappaðir:</strong> ${ib.ib01031_unmapped ?? '-'}</p>
      <p><strong>Klárt til training:</strong> ${(consistency.ready_for_training === true) ? 'Ja' : 'Nei'}</p>
      <p><strong>Klárt til live run:</strong> ${(consistency.ready_for_live_run === true) ? 'Ja' : 'Nei'}</p>
    `;

    document.getElementById('data-counts').innerHTML = `
      <table class="status-table">
        <thead><tr><th>Talva</th><th>Raðir</th></tr></thead>
        <tbody>
          ${Object.entries(counts).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;

    const checks = muni.checks || {};
    document.getElementById('consistency-flags').innerHTML = `
      <p><strong>Mapping-fíla:</strong> ${esc(checks.mapping_file || '-')}</p>
      <p><strong>Coverage rows:</strong> ${esc(checks.coverage_rows ?? '-')}</p>
      <p><strong>Candidate rows:</strong> ${esc(checks.candidate_rows ?? '-')}</p>
      <p><strong>Override rows:</strong> ${esc(checks.override_rows ?? '-')}</p>
      <p><strong>Pending candidates:</strong> ${esc(checks.pending_candidates ?? '-')}</p>
      <p><strong>Strict mode:</strong> ${checks.strict ? 'Ja' : 'Nei'}</p>
    `;

    document.getElementById('mapping-summary').innerHTML = `
      <table class="status-table">
        <thead><tr><th>Kommuna</th><th>Lokalitetir</th></tr></thead>
        <tbody>
          ${muniCounts.slice(0, 40).map((x) => `<tr><td>${esc(x.municipality)}</td><td>${esc(x.localities)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;

    const filterBox = document.getElementById('mapping-filter');
    const tableNode = document.getElementById('mapping-table');

    function drawMappingTable(query) {
      const q = String(query || '').trim().toLowerCase();
      const filtered = rows.filter((x) => {
        if (!q) return true;
        const loc = String(x.locality || '').toLowerCase();
        const mun = String(x.municipality_current || '').toLowerCase();
        const code = String(x.locality_code || '').toLowerCase();
        return loc.includes(q) || mun.includes(q) || code.includes(q);
      }).slice(0, 200);

      tableNode.innerHTML = `
        <table class="status-table">
          <thead><tr><th>Kota</th><th>Lokalitetur</th><th>Kommuna</th><th>Fólkatal</th></tr></thead>
          <tbody>
            ${filtered.map((x) => `<tr><td>${esc(x.locality_code)}</td><td>${esc(x.locality)}</td><td>${esc(x.municipality_current)}</td><td>${num(x.population, 0)}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
    }

    drawMappingTable('');
    if (filterBox) {
      filterBox.addEventListener('input', () => drawMappingTable(filterBox.value));
    }

    const overlaySelect = document.getElementById('municipality-overlay');
    const timeSelect = document.getElementById('overlay-timepoint');
    const mapNode = document.getElementById('municipality-map');

    const histMost = Array.isArray(historical.most_distinct_sites) ? historical.most_distinct_sites : [];
    const histClose = Array.isArray(historical.closest_sites) ? historical.closest_sites : [];
    const histTimes = [...new Set([...histMost, ...histClose].map((x) => String(x.timestamp || '')).filter(Boolean))].sort();
    timeSelect.innerHTML = histTimes.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

    if (typeof L !== 'undefined' && mapNode) {
      const map = L.map('municipality-map', { scrollWheelZoom: false }).setView([62.05, -6.95], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const layer = L.layerGroup().addTo(map);

      function municipalityCenter(name) {
        const key = municipalityKey(name);
        return MUNICIPALITY_CENTROIDS[key] || [62.02, -6.90];
      }

      const localityToMunicipality = new Map();
      rows.forEach((r) => {
        localityToMunicipality.set(normalizeMunicipalityName(r.locality), r.municipality_current);
      });

      function aggregatePopulation() {
        const acc = new Map();
        rows.forEach((r) => {
          const key = String(r.municipality_current || 'Unknown');
          const cur = acc.get(key) || { municipality: key, value: 0, localities: 0 };
          cur.value += Number(r.population || 0);
          cur.localities += 1;
          acc.set(key, cur);
        });
        return [...acc.values()];
      }

      function aggregateLocalities() {
        return muniCounts.map((m) => ({ municipality: m.municipality, value: Number(m.localities || 0), localities: Number(m.localities || 0) }));
      }

      function historicalRows(kind, timepoint) {
        const source = kind === 'history-close' ? histClose : histMost;
        const subset = source.filter((x) => !timepoint || String(x.timestamp || '') === String(timepoint));
        return subset.map((x) => {
          const normSite = normalizeMunicipalityName(x.site_name || '');
          let municipality = 'Unknown';
          rows.some((r) => {
            const loc = normalizeMunicipalityName(r.locality || '');
            if (loc === normSite || loc.includes(normSite) || normSite.includes(loc)) {
              municipality = r.municipality_current || 'Unknown';
              return true;
            }
            return false;
          });
          return {
            municipality,
            site_name: x.site_name,
            timestamp: x.timestamp,
            value: Number(x.distance_l1 || 0),
            votes_total: Number(x.votes_total || 0),
          };
        });
      }

      function renderOverlay() {
        layer.clearLayers();
        const mode = overlaySelect.value;
        const timepoint = timeSelect.value;
        let records = [];
        let palette = 'blue';
        let radiusBase = 8;

        if (mode === 'population') {
          records = aggregatePopulation();
          palette = 'blue';
          radiusBase = 10;
        } else if (mode === 'localities') {
          records = aggregateLocalities();
          palette = 'blue';
          radiusBase = 8;
        } else if (mode === 'history-most') {
          records = historicalRows(mode, timepoint);
          palette = 'red';
          radiusBase = 10;
        } else {
          records = historicalRows(mode, timepoint);
          palette = 'green';
          radiusBase = 10;
        }

        const maxValue = Math.max(1, ...records.map((r) => Number(r.value || 0)));
        records.forEach((r) => {
          const center = municipalityCenter(r.municipality);
          const value = Number(r.value || 0);
          const radius = Math.max(6, Math.min(22, radiusBase + Math.round((value / maxValue) * 12)));
          const color = markerColor(value, maxValue, palette);
          const popup = mode.startsWith('history')
            ? `<strong>${esc(r.municipality)}</strong><br/>Støð: ${esc(r.site_name || '-')}<br/>Tíð: ${esc(r.timestamp || '-')}<br/>L1-frástøða: ${num(value,3)}<br/>Atkvøður: ${esc(r.votes_total ?? '-')}`
            : `<strong>${esc(r.municipality)}</strong><br/>Virði: ${num(value, 1)}<br/>Lokalitetir: ${esc(r.localities ?? '-')}`;

          L.circleMarker(center, {
            radius,
            color: '#ffffff',
            weight: 2,
            fillColor: color,
            fillOpacity: 0.9,
          }).bindPopup(popup).addTo(layer);
        });
      }

      if (!timeSelect.value && histTimes.length) {
        timeSelect.value = histTimes[0];
      }
      overlaySelect.addEventListener('change', renderOverlay);
      timeSelect.addEventListener('change', renderOverlay);
      renderOverlay();
    }
  };

  window.renderReplayPage = async function () {
    let payload;
    try {
      payload = await getJson(PAYLOAD_CANDIDATES);
    } catch (err) {
      showError('replay-summary', err?.message || 'Kundi ikki lesa dashboard payload');
      showError('replay-eval', err?.message || 'Kundi ikki lesa dashboard payload');
      return;
    }
    let replays = Array.isArray(payload.replays) ? payload.replays : [];
    if (!replays.length) {
      const fallback = await getJson(REPLAY_CANDIDATES);
      replays = [{
        election: fallback.election || 'Replay',
        n_updates: fallback.n_updates || 0,
        final_timestamp: fallback.final_timestamp || '-',
        summary: fallback.summary || {},
        trace: Array.isArray(fallback.trace) ? fallback.trace : [],
      }];
    }

    const electionSelect = document.getElementById('replay-election');
    const timepointSelect = document.getElementById('replay-timepoint');
    const summaryNode = document.getElementById('replay-summary');
    const evalNode = document.getElementById('replay-eval');
    const traceNode = document.getElementById('replay-trace');
    const replayMapNode = document.getElementById('replay-map');
    const historical = payload.historical_overlays || {};
    const histMost = Array.isArray(historical.most_distinct_sites) ? historical.most_distinct_sites : [];
    const histClose = Array.isArray(historical.closest_sites) ? historical.closest_sites : [];
    const mappingRows = Array.isArray(payload.data_audit?.mapping_rows) ? payload.data_audit.mapping_rows : [];

    electionSelect.innerHTML = replays.map((r, idx) => `<option value="${idx}">${esc(r.election || `Val ${idx + 1}`)}</option>`).join('');

    function renderTraceTable(trace, selectedTimestamp) {
      traceNode.innerHTML = `
        <table class="status-table">
          <thead><tr><th>Tíð</th><th>Uppgjørt %</th><th>MAE model</th><th>MAE naive</th><th>Betri/verri %</th></tr></thead>
          <tbody>
            ${trace.map((x) => {
              const selected = x.timestamp === selectedTimestamp ? ' selected-row' : '';
              return `<tr class="${selected}"><td>${esc(x.timestamp)}</td><td>${num(x.reported_pct,1)}</td><td>${num(x.mae_model,4)}</td><td>${num(x.mae_naive,4)}</td><td>${num(x.improvement_pct,2)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    let replayMap = null;
    let replayLayer = null;
    if (typeof L !== 'undefined' && replayMapNode) {
      replayMap = L.map('replay-map', { scrollWheelZoom: false }).setView([62.05, -6.95], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(replayMap);
      replayLayer = L.layerGroup().addTo(replayMap);
    }

    function municipalityForSite(siteName) {
      const norm = normalizeMunicipalityName(siteName);
      let municipality = 'Unknown';
      mappingRows.some((r) => {
        const loc = normalizeMunicipalityName(r.locality || '');
        if (loc === norm || loc.includes(norm) || norm.includes(loc)) {
          municipality = r.municipality_current || 'Unknown';
          return true;
        }
        return false;
      });
      return municipality;
    }

    function renderHistoricalReplayMap(timepoint) {
      if (!replayMap || !replayLayer) return;
      replayLayer.clearLayers();

      const points = [
        ...histMost.filter((x) => String(x.timestamp || '') === String(timepoint)).map((x) => ({ ...x, type: 'most' })),
        ...histClose.filter((x) => String(x.timestamp || '') === String(timepoint)).map((x) => ({ ...x, type: 'close' })),
      ];

      points.forEach((x) => {
        const municipality = municipalityForSite(x.site_name || '');
        const center = MUNICIPALITY_CENTROIDS[municipalityKey(municipality)] || [62.02, -6.90];
        const isMost = x.type === 'most';
        const color = isMost ? '#c73529' : '#177c55';
        const radius = Math.max(7, Math.min(18, 7 + Math.round(Number(x.distance_l1 || 0) * 24)));
        L.circleMarker(center, {
          radius,
          color: '#fff',
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9,
        })
          .bindPopup(`<strong>${esc(municipality)}</strong><br/>Støð: ${esc(x.site_name || '-')}<br/>Tíð: ${esc(x.timestamp || '-')}<br/>L1-frástøða: ${num(x.distance_l1,3)}<br/>Slag: ${isMost ? 'Mest avvikandi' : 'Mest lík landsúrsliti'}`)
          .addTo(replayLayer);
      });
    }

    function renderElection() {
      const replay = replays[Number(electionSelect.value) || 0] || replays[0] || {};
      const summary = replay.summary || {};
      const trace = Array.isArray(replay.trace) ? replay.trace : [];
      const times = trace.map((x) => String(x.timestamp || '')).filter(Boolean);

      timepointSelect.innerHTML = times.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
      if (!timepointSelect.value && times.length) {
        timepointSelect.value = times[Math.floor(times.length / 2)];
      }

      summaryNode.innerHTML = `
        <p><strong>Val:</strong> ${esc(replay.election || '-')}</p>
        <p><strong>Updates:</strong> ${esc(replay.n_updates ?? '-')}</p>
        <p><strong>Seinasta tíð:</strong> ${esc(replay.final_timestamp || '-')}</p>
        <p><strong>Average improvement:</strong> ${num(summary.avg_improvement_pct,2)}%</p>
        <p><strong>Average improvement tíðliga (<=25%):</strong> ${num(summary.avg_improvement_pct_early_25,2)}%</p>
      `;

      renderTimepoint();

      function renderTimepoint() {
        const ts = String(timepointSelect.value || '');
        const row = trace.find((x) => String(x.timestamp || '') === ts) || trace[0] || null;
        if (!row) {
          evalNode.innerHTML = '<p>Eingin replay-data funnin.</p>';
          traceNode.innerHTML = '';
          return;
        }

        evalNode.innerHTML = `
          <p><strong>Tíðspunkt:</strong> ${esc(row.timestamp)}</p>
          <p><strong>Uppgjørt partur:</strong> ${num(row.reported_pct,1)}%</p>
          <p><strong>Model MAE:</strong> ${num(row.mae_model,4)}</p>
          <p><strong>Naive MAE:</strong> ${num(row.mae_naive,4)}</p>
          <p><strong>Betri/verri:</strong> ${num(row.improvement_pct,2)}%</p>
        `;

        renderTraceTable(trace, row.timestamp);
        renderHistoricalReplayMap(row.timestamp);
      }

      timepointSelect.onchange = renderTimepoint;
    }

    electionSelect.onchange = renderElection;
    renderElection();
  };
})();
