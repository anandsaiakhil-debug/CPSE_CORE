const $ = s => document.querySelector(s), app = $('#app'), modal = $('#modal');
let data = { groups: [], cpses: [], materials: [], audit: [] }, page = 'dashboard', uploadedDataset = null, currentSearchQuery = '';

const nav = [
  ['dashboard', 'Material Master Dashboard & Analytics'],
  ['matching', 'AI Material Matching & Recommendation'],
  ['standardization', 'Material Standardization & Classification'],
  ['duplicates', 'Duplicate / Near-Duplicate Detection'],
  ['master', 'Common National Material Code Generation'],
  ['mapping', 'CPSE Code Mapping & Migration Support'],
  ['governance', 'Audit Trail & Governance'],
  ['erp', 'SAP / ERP Integration']
];

const cpseSectors = {
  'ONGC': { sector: 'Oil & Gas', cls: 'sector-oil' },
  'IOCL': { sector: 'Oil & Gas', cls: 'sector-oil' },
  'GAIL': { sector: 'Oil & Gas', cls: 'sector-oil' },
  'BPCL': { sector: 'Oil & Gas', cls: 'sector-oil' },
  'HPCL': { sector: 'Oil & Gas', cls: 'sector-oil' },
  'NTPC': { sector: 'Power', cls: 'sector-power' },
  'Power Grid': { sector: 'Power', cls: 'sector-power' },
  'SAIL': { sector: 'Steel', cls: 'sector-steel' },
  'Coal India': { sector: 'Mining', cls: 'sector-mining' },
  'NMDC': { sector: 'Mining', cls: 'sector-mining' },
  'CIL': { sector: 'Mining', cls: 'sector-mining' },
  'BHEL': { sector: 'Heavy Engineering', cls: 'sector-eng' }
};

const api = p => fetch('/api/' + p).then(r => r.json());
const status = s => '<span class="status ' + (s === 'Approved' || s === 'Mapped' ? 'approved' : s === 'Rejected' ? 'rejected' : 'pending') + '">' + s + '</span>';
const title = (ey, h, lead) => '<div class="eyebrow">' + ey + '</div><h1 class="heading">' + h + '</h1><p class="lead">' + lead + '</p>';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightMatch(text, query) {
  if (!query || !text) return escapeHtml(text);
  const str = String(text);
  const qLower = query.toLowerCase();
  const idx = str.toLowerCase().indexOf(qLower);
  if (idx === -1) return escapeHtml(str);
  return escapeHtml(str.substring(0, idx)) +
    '<mark style="background:#d2ecff;color:#053f66;padding:0 2px;border-radius:2px;font-weight:700">' +
    escapeHtml(str.substring(idx, idx + query.length)) +
    '</mark>' +
    escapeHtml(str.substring(idx + query.length));
}

function shell(body) {
  const dsText = uploadedDataset ? uploadedDataset.fileName : 'Sample CPSE Master Store';
  app.innerHTML = '<div class="shell">' +
    '<aside class="side">' +
      '<div class="brand">' +
        '<div class="logo">M</div>' +
        '<div><b>MaterialCode AI</b><small>NATIONAL MATERIAL MASTER</small></div>' +
      '</div>' +
      '<div class="subtle" style="padding:0 8px 12px;font-family:\'DM Mono\';font-size:9px">' +
        'OIL & GAS · POWER · STEEL · MINING · HEAVY ENG.' +
      '</div>' +
      '<nav class="nav">' +
        nav.map((n, i) =>
          '<button class="' + (page === n[0] ? 'active' : '') + '" onclick="go(\'' + n[0] + '\')">' +
            '<i>' + String(i + 1).padStart(2, '0') + '</i>' +
            '<span>' + n[1] + '</span>' +
          '</button>'
        ).join('') +
      '</nav>' +
      '<div class="system">' +
        '<span class="pulse"></span>AI Engine: Active (NLP/ML)<br>' +
        '<span class="subtle" id="sidebar-datasource">Data Source: ' + dsText + '</span>' +
      '</div>' +
    '</aside>' +
    '<main class="main">' +
      '<header class="topbar">' +
        '<div class="workspace"><span class="subtle">FRAMEWORK SCOPE</span><b>National Unified Material Master</b></div>' +
        '<div class="search-wrap">' +
          '<span class="search-icon">🔍</span>' +
          '<input class="global-search" id="global-search-input" value="' + escapeHtml(currentSearchQuery || '') + '" oninput="handleSearchInput(this.value)" onfocus="handleSearchFocus()" onkeydown="handleSearchKey(event)" placeholder="Search materials, codes, specs, CPSEs..." autocomplete="off">' +
          '<div id="search-dropdown" class="search-dropdown" style="display:none"></div>' +
        '</div>' +
        '<span class="demo">ONE NATION – ONE MATERIAL CODE</span>' +
        '<span class="profile">Governance Officer</span>' +
      '</header>' +
      '<section class="content">' + body + '</section>' +
    '</main>' +
  '</div>';
}

function handleSearchFocus() {
  const input = document.getElementById('global-search-input');
  renderRecommendations(input ? input.value : '');
}

function handleSearchInput(val) {
  currentSearchQuery = val;
  renderRecommendations(val);
}

function handleSearchKey(e) {
  if (e.key === 'Escape') {
    closeSearchDropdown();
  } else if (e.key === 'Enter') {
    const first = document.querySelector('.search-item');
    if (first) {
      first.click();
    }
  }
}

function closeSearchDropdown() {
  const dd = document.getElementById('search-dropdown');
  if (dd) dd.style.display = 'none';
}

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function renderRecommendations(q) {
  const dd = document.getElementById('search-dropdown');
  if (!dd) return;

  const query = normalizeText(q);
  let results = [];

  if (!query) {
    results = data.groups.slice(0, 6).map(g => ({
      group: g,
      type: 'group',
      title: g.name,
      nationalCode: g.code,
      spec: g.specification,
      cat: g.category,
      uom: g.uom,
      desc: g.description,
      score: g.score,
      sources: g.records.map(r => r[0] + ' (' + r[1] + ')').join(' · '),
      status: g.status
    }));
  } else {
    const groupMatches = data.groups.filter(g => {
      const searchText = [
        g.name,
        g.code,
        g.description,
        g.specification,
        g.category,
        g.type,
        g.status,
        g.records.map(r => r.join(' ')).join(' ')
      ].join(' ');
      return normalizeText(searchText).includes(query);
    }).map(g => ({
      group: g,
      type: 'group',
      title: g.name,
      nationalCode: g.code,
      spec: g.specification,
      cat: g.category,
      uom: g.uom,
      desc: g.description,
      score: g.score,
      sources: g.records.map(r => r[0] + ' (' + r[1] + ')').join(' · '),
      status: g.status
    }));

    const legacyMatches = data.materials.filter(m => {
      const searchText = [
        m.materialCode,
        m.materialName,
        m.cpse,
        m.nationalCode,
        m.description,
        m.specification,
        m.category,
        m.uom,
        m.groupId
      ].join(' ');
      return normalizeText(searchText).includes(query);
    }).filter(m => !groupMatches.some(gm => gm.group && gm.group.id === m.groupId)).slice(0, 4).map(m => {
      const grp = data.groups.find(g => g.id === m.groupId);
      return {
        group: grp,
        type: 'legacy',
        title: m.materialName,
        nationalCode: m.nationalCode,
        spec: m.specification,
        cat: m.category,
        uom: m.uom,
        desc: m.description,
        score: grp ? grp.score : 92,
        sources: m.cpse + ' Legacy Code: ' + m.materialCode + ' → ' + m.nationalCode,
        status: m.status
      };
    });

    let uploadMatches = [];
    if (uploadedDataset && uploadedDataset.rows) {
      uploadMatches = uploadedDataset.rows.filter(r => {
        const searchText = r.map(c => String(c || '')).join(' ');
        return normalizeText(searchText).includes(query);
      }).slice(0, 2).map((r, i) => ({
        group: null,
        type: 'upload',
        title: r[2] || r[1] || 'Uploaded Record #' + (i + 1),
        nationalCode: 'INTAKE',
        spec: r[4] || 'Custom',
        cat: r[6] || 'Intake Data',
        uom: r[5] || 'NOS',
        desc: r[3] || 'Uploaded from ' + uploadedDataset.fileName,
        score: 95,
        sources: (r[0] || 'CPSE') + ' · ' + (r[1] || 'Code'),
        status: 'Uploaded'
      }));
    }

    results = [...groupMatches, ...legacyMatches, ...uploadMatches].slice(0, 7);
  }

  if (results.length === 0) {
    dd.innerHTML = '<div class="search-empty">' +
      '<div style="font-size:22px;margin-bottom:6px">🔍</div>' +
      '<b>No material recommendations found</b>' +
      '<div class="subtle" style="margin-top:4px">No materials matching "' + escapeHtml(q) + '". Try searching "steel pipe", "bolt", "valve", "cable", "ONGC", or "M10".</div>' +
    '</div>';
    dd.style.display = 'block';
    return;
  }

  const headerTitle = query
    ? 'GOOGLE-STYLE MATERIAL RECOMMENDATIONS (' + results.length + ' MATCHES)'
    : 'RECOMMENDED CPSE MATERIALS (QUICK ACCESS)';

  dd.innerHTML = '<div class="search-header">' + headerTitle + '</div>' +
    results.map((r, i) => {
      const hTitle = highlightMatch(r.title, query);
      const hDesc = highlightMatch(r.desc, query);
      const hSpec = highlightMatch(r.spec, query);
      const hSources = highlightMatch(r.sources, query);
      const grpId = r.group ? r.group.id : '';

      return '<div class="search-item" onclick="selectSearchRecommendation(\'' + grpId + '\', \'' + r.title.replace(/'/g, "\'") + '\')">' +
        '<div class="search-item-code">' +
          '<b>' + r.nationalCode + '</b>' +
          '<span class="score-badge">' + r.score + '% match</span>' +
        '</div>' +
        '<div class="search-item-info">' +
          '<div class="search-item-title">' + hTitle + '</div>' +
          '<div class="search-item-meta">' +
            '<span>' + hDesc + '</span> · ' +
            '<span><b>Spec:</b> ' + hSpec + '</span> · ' +
            '<span>' + r.cat + ' (' + r.uom + ')</span>' +
          '</div>' +
          '<div class="search-item-sources">' +
            '<span class="sources-label">Mapped CPSEs:</span> ' + hSources +
          '</div>' +
        '</div>' +
        '<div class="search-item-action">' +
          '<button type="button" class="button outline small-btn">Review ➔</button>' +
        '</div>' +
      '</div>';
    }).join('') +
    '<div class="search-footer">' +
      '<span>Click any recommendation to open <b>AI Explainability & Governance Review</b></span>' +
      '<span class="subtle">Press ESC to dismiss</span>' +
    '</div>';

  dd.style.display = 'block';
}

function selectSearchRecommendation(groupId, title) {
  closeSearchDropdown();
  const input = document.getElementById('global-search-input');
  if (input) input.value = title;
  currentSearchQuery = title;
  if (groupId) {
    review(groupId);
  } else {
    toast('Selected: ' + title);
  }
}

function dashboard() {
  const hasUpload = !!uploadedDataset;
  const rows = data.groups.slice(0, 5).map(g =>
    '<tr><td class="code">' + g.code + '</td>' +
    '<td><b>' + g.name + '</b><br><span class="subtle">' + g.category + ' · ' + g.uom + '</span></td>' +
    '<td>' + g.records.length + ' CPSEs</td>' +
    '<td>' + status(g.status) + '</td>' +
    '<td><button class="button outline" onclick="review(\'' + g.id + '\')">Review</button></td></tr>'
  ).join('');

  const sectorCards = data.cpses.slice(0, 8).map(c => {
    const info = cpseSectors[c.name] || { sector: 'CPSE', cls: '' };
    const pct = Math.round((c.standardized / c.records) * 100);
    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<b>' + c.name + '</b>' +
        '<span class="sector-pill ' + info.cls + '">' + info.sector + '</span>' +
      '</div>' +
      '<div class="meter"><i style="width:' + pct + '%"></i></div>' +
      '<div class="subtle" style="display:flex;justify-content:space-between">' +
        '<span>' + c.records.toLocaleString() + ' records</span>' +
        '<span><b>' + pct + '%</b> standardized</span>' +
      '</div>' +
    '</div>';
  }).join('');

  shell(
    title('Key Capability 06 · Executive Center', 'Material Master Dashboard & Analytics', 'Unified intelligence, duplicate detection, and harmonization progress across Oil & Gas, Power, Steel, Mining, and Heavy Engineering CPSEs.') +
    '<div class="impact-strip">' +
      '<div class="impact-item"><b>✓ One Nation – One Material Code:</b> Common identity with source code traceability</div>' +
      '<div class="impact-item"><b>✓ Deduplication:</b> 842 cross-CPSE duplicate candidate groups</div>' +
      '<div class="impact-item"><b>✓ Demand Aggregation:</b> ₹142 Cr estimated collaborative procurement savings</div>' +
      '<div class="impact-item"><b>✓ Interoperability:</b> Live SAP/ERP mapping synchronization</div>' +
    '</div>' +
    '<div class="kpis">' +
      [['12', 'Participating CPSEs'], ['12,540', 'Material records'], ['842', 'Duplicate candidates'], ['9,720', 'Standardized materials'], ['2,416', 'Legacy codes mapped'], ['1,964', 'AI matches found'], ['78%', 'Harmonization rate'], ['126', 'Awaiting validation']].map(x =>
        '<div class="kpi"><div class="l">' + x[1] + '</div><div class="v">' + x[0] + '</div></div>'
      ).join('') +
    '</div>' +
    '<div class="grid">' +
      '<div class="card hero">' +
        '<div class="eyebrow" style="color:#8cd8ff">ONE NATION → ONE MATERIAL CODE</div>' +
        '<h2 style="margin:7px 0;font-size:21px">A single identity, with every source retained.</h2>' +
        '<p class="lead">AI identifies equivalent materials across disparate CPSE codes; governance officers confirm unified master entries.</p>' +
        '<div class="map">' +
          '<div class="sources">' +
            '<div class="source"><b>SAIL · B001</b><br>MS Bolt (Steel)</div>' +
            '<div class="source"><b>NTPC · M450</b><br>Mild Steel Bolt (Power)</div>' +
            '<div class="source"><b>BHEL · BL90</b><br>M.S. Bolt (Heavy Eng)</div>' +
          '</div>' +
          '<div class="arrow">AI MATCHING<br>96% ─────▶</div>' +
          '<div class="target">NATIONAL CODE<strong>BOLT001</strong>Mild Steel Bolt<br><small>3 CPSE records mapped</small></div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>Harmonization Posture</h3>' +
        '<p class="subtle">Multi-CPSE data · Review-controlled governance</p>' +
        '<div class="meter"><i style="width:78%"></i></div><b>78% standardized across CPSEs</b>' +
        '<div class="mini-list" style="margin-top:20px">' +
          '<div class="mini"><b>842</b> duplicate groups detected<br><span class="subtle">610 reviewed · 126 awaiting validation</span></div>' +
          '<div class="mini"><b>Human-in-the-loop</b><br><span class="subtle">No source record is overwritten without governance approval.</span></div>' +
          '<div class="mini"><b>Audit Ready</b><br><span class="subtle">Traceability preserved to original CPSE ERP item codes.</span></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-top:16px">' +
      '<div class="section-head">' +
        '<div>' +
          '<span class="eyebrow">CPSE MATERIAL DATA INTAKE</span>' +
          '<h3 style="margin-top:4px">Import CPSE Material Master Data</h3>' +
          '<p class="subtle">Secure intake for CSV, XLSX, and JSON exports from participating CPSE ERP/SAP systems.</p>' +
        '</div>' +
        '<div>' +
          (hasUpload ? '<span class="sector-pill sector-mining" style="font-size:11px">✓ Active File: ' + uploadedDataset.fileName + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="drop" id="drop-zone" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)" onclick="handleDropZoneClick(event)" style="cursor:pointer;margin:14px 0 10px">' +
        '<div class="eyebrow">LOCAL SECURE INTAKE</div>' +
        '<h3 style="margin:6px 0">Drag & Drop material files here or click to browse</h3>' +
        '<p class="subtle">Supports CSV · XLSX / Excel · JSON · Automatic cross-CPSE parsing</p>' +
        '<div style="margin-top:12px">' +
          '<button type="button" class="button" onclick="triggerFileInput(event)">Upload material data</button>' +
        '</div>' +
        '<input type="file" id="material-file-input" accept=".csv,.xlsx,.xls,.json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/json" style="display:none" onchange="handleFileSelect(event)">' +
      '</div>' +
      '<div class="kpis" style="margin:10px 0 0">' +
        '<div class="kpi"><div class="l">Intake File</div><div class="v" style="font-size:14px;' + (hasUpload ? '' : 'color:var(--muted)') + '">' + (hasUpload ? uploadedDataset.fileName : 'No file uploaded yet') + '</div></div>' +
        '<div class="kpi"><div class="l">Records detected</div><div class="v" style="' + (hasUpload ? '' : 'color:var(--muted)') + '">' + (hasUpload ? uploadedDataset.records.toLocaleString() : '—') + '</div></div>' +
        '<div class="kpi"><div class="l">Data quality</div><div class="v" style="' + (hasUpload ? '' : 'color:var(--muted)') + '">' + (hasUpload ? uploadedDataset.quality + '%' : '—') + '</div></div>' +
        '<div class="kpi"><div class="l">Potential duplicates</div><div class="v" style="' + (hasUpload ? '' : 'color:var(--muted)') + '">' + (hasUpload ? uploadedDataset.duplicates.toLocaleString() : '—') + '</div></div>' +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-top:16px">' +
      '<h3>Participating CPSE Sectors & Progress</h3>' +
      '<p class="subtle">Oil & Gas · Power · Steel · Mining · Heavy Engineering</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:14px">' +
        sectorCards +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-top:16px">' +
      '<div class="section-head">' +
        '<div>' +
          '<h3>Unified-Material Review Queue</h3>' +
          '<span class="subtle">Pending AI recommendations requiring governance validation</span>' +
        '</div>' +
        '<button class="button outline" onclick="go(\'matching\')">Open AI Matching</button>' +
      '</div>' +
      '<div class="tablewrap"><table class="table">' +
        '<thead><tr><th>National code</th><th>Suggested standard</th><th>Coverage</th><th>Status</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
    '</div>'
  );
}

function matching() {
  const cards = data.groups.map(g =>
    '<tr>' +
      '<td class="code">' + g.code + '</td>' +
      '<td><b>' + g.name + '</b><br><span class="subtle">' + g.records.map(r => r[0] + ': ' + r[1]).join(' · ') + '</span></td>' +
      '<td>' + g.specification + '<br><span class="subtle">' + g.category + ' · ' + g.uom + '</span></td>' +
      '<td><b>' + g.score + '%</b><br><span class="subtle">' + g.type + '</span></td>' +
      '<td>' + status(g.status) + '</td>' +
      '<td><button class="button outline" onclick="review(\'' + g.id + '\')">Review & Explain</button></td>' +
    '</tr>'
  ).join('');

  shell(
    title('Key Capability 01 · NLP Similarity Engine', 'AI Material Matching & Recommendation', 'Compares material descriptions, specifications, technical attributes, UOM, and classifications across CPSEs to identify equivalents.') +
    '<div class="card">' +
      '<div class="flow">' +
        ['Material Name (30%)', 'Description (25%)', 'Specification (25%)', 'UOM (10%)', 'Category (10%)', 'NLP Similarity', 'Recommendation Rationale'].map(x => '<div>' + x + '</div>').join('') +
      '</div>' +
      '<div class="grid" style="margin-top:20px">' +
        '<div>' +
          '<h3>AI Recommendation Engine: Active</h3>' +
          '<div class="meter"><i style="width:96%"></i></div>' +
          '<b style="font-size:22px">96%</b> <span class="subtle">high-confidence exemplar across SAIL, NTPC & BHEL</span>' +
        '</div>' +
        '<div class="subtle" style="line-height:1.7">' +
          'Weighted Model: Considers semantic naming differences, metric/imperial specs (e.g. 2-IN vs 2 inch), and material grades across CPSE catalogs.' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="toolbar">' +
      '<input oninput="filterMatches(this.value)" placeholder="Search codes, material, specification, or CPSE...">' +
      '<select onchange="filterConfidence(this.value)">' +
        '<option value="">All confidence levels</option>' +
        '<option>High (≥90%)</option>' +
        '<option>Medium (70-89%)</option>' +
      '</select>' +
    '</div>' +
    '<div class="card">' +
      '<div class="tablewrap"><table class="table">' +
        '<thead><tr><th>Recommended National Code</th><th>Suggested Standard Material</th><th>Specification / Group</th><th>AI Confidence</th><th>Review State</th><th></th></tr></thead>' +
        '<tbody id="matchrows">' + cards + '</tbody>' +
      '</table></div>' +
    '</div>'
  );
}

function standardization() {
  const pending = data.groups.filter(g => g.status === 'Pending Review');
  shell(
    title('Key Capability 02 · Automated Harmonization', 'Material Standardization & Classification', 'Automated standardization of material descriptions and technical attributes with intelligent classification and governance approval.') +
    '<div class="card" style="margin-bottom:16px">' +
      '<div class="section-head">' +
        '<div>' +
          '<h3>Standardization Studio</h3>' +
          '<span class="subtle">' + pending.length + ' material groups currently awaiting governance decision</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    pending.map(g =>
      '<div class="card" style="margin-top:14px">' +
        '<div class="section-head">' +
          '<div>' +
            '<span class="eyebrow">AI RECOMMENDATION · ' + g.score + '% SIMILARITY</span>' +
            '<h3 style="font-size:18px;margin-top:7px">' + g.name + ' → <span class="code">' + g.code + '</span></h3>' +
            '<span class="subtle">' + g.description + ' · Spec: ' + g.specification + ' · Classification: ' + g.category + ' · UOM: ' + g.uom + '</span>' +
            '<div style="margin-top:8px;font-size:12px;color:#2a5879">' +
              'Mapped Source CPSEs: ' + g.records.map(r => '<b>' + r[0] + '</b> (' + r[1] + ')').join(' · ') +
            '</div>' +
          '</div>' +
          '<div>' +
            '<button class="button" onclick="review(\'' + g.id + '\')">Review & Approve</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).join('')
  );
}

function duplicates() {
  const dups = data.groups.filter(g => g.status !== 'Approved');
  shell(
    title('Key Capability 03 · Candidate Discovery', 'Duplicate / Near-Duplicate Detection', 'Intelligent detection of exact duplicates, near-duplicates, and functionally equivalent materials across disparate CPSE ERP/SAP catalogs.') +
    '<div class="grid">' +
      dups.map(g =>
        '<div class="card">' +
          '<span class="eyebrow">' + g.type.toUpperCase() + ' · ' + g.id.toUpperCase() + '</span>' +
          '<h3 style="font-size:18px;margin-top:7px">' + g.name + '</h3>' +
          '<p class="subtle">' + g.records.map(r => '<b>' + r[0] + '</b>: ' + r[1] + ' (' + r[2] + ')').join('<br>') + '</p>' +
          '<div class="meter"><i style="width:' + g.score + '%"></i></div>' +
          '<b>' + g.score + '% cross-CPSE similarity</b>' +
          '<div style="margin-top:14px">' +
            '<button class="button" onclick="review(\'' + g.id + '\')">Review Duplicate Group</button>' +
          '</div>' +
        '</div>'
      ).join('') +
    '</div>'
  );
}

function master() {
  shell(
    title('Key Capability 04 · Controlled Catalog', 'Common National Material Code Generation', 'Authoritative National Unified Material Master providing One Nation – One Material Code with complete bi-directional audit traceability.') +
    '<div class="card">' +
      '<div class="section-head">' +
        '<div>' +
          '<h3>National Unified Material Master</h3>' +
          '<span class="subtle">Standardized common identity for approved CPSE material records</span>' +
        '</div>' +
        '<button class="button outline" onclick="downloadMasterCsv()">Export Unified Master CSV</button>' +
      '</div>' +
      '<div class="tablewrap" style="margin-top:14px"><table class="table">' +
        '<thead><tr><th>National Code</th><th>Standard Material</th><th>Specification</th><th>Category / UOM</th><th>Mapped CPSE Records</th><th>Status</th></tr></thead>' +
        '<tbody>' +
          data.groups.map(g =>
            '<tr>' +
              '<td class="code"><b>' + g.code + '</b></td>' +
              '<td><b>' + g.name + '</b><br><span class="subtle">' + g.description + '</span></td>' +
              '<td>' + g.specification + '</td>' +
              '<td>' + g.category + ' · ' + g.uom + '</td>' +
              '<td>' + g.records.length + ' CPSEs / ' + g.records.length + ' codes</td>' +
              '<td>' + status(g.status) + '</td>' +
            '</tr>'
          ).join('') +
        '</tbody>' +
      '</table></div>' +
    '</div>'
  );
}

function mapping() {
  const records = data.materials;
  const mappedCount = records.filter(m => m.status === 'Approved').length;
  shell(
    title('Key Capability 05 · Traceability & Migration', 'CPSE Code Mapping & Migration Support', 'Maintains bi-directional mapping between CPSE legacy material codes and Common National Codes, enabling legacy code rationalization and ERP migration.') +
    '<div class="kpis">' +
      [['2,416', 'Total legacy codes'], [String(mappedCount), 'Approved & Mapped'], [String(records.length - mappedCount), 'Pending review'], ['82%', 'Rationalization rate']].map(x =>
        '<div class="kpi"><div class="l">' + x[1] + '</div><div class="v">' + x[0] + '</div></div>'
      ).join('') +
    '</div>' +
    '<div class="card">' +
      '<div class="section-head">' +
        '<div>' +
          '<h3>CPSE Legacy Code Mapping Table</h3>' +
          '<span class="subtle">Traceable correspondence: Legacy CPSE Code → Common National Code</span>' +
        '</div>' +
        '<button class="button" onclick="downloadCsv()">Download Migration Mapping CSV</button>' +
      '</div>' +
      '<div class="tablewrap" style="margin-top:14px"><table class="table">' +
        '<thead><tr><th>CPSE Enterprise</th><th>Legacy Code</th><th>Source Material Name</th><th>National Code</th><th>Mapping State</th></tr></thead>' +
        '<tbody>' +
          records.map(m => {
            const sec = cpseSectors[m.cpse] || { sector: 'CPSE', cls: '' };
            return '<tr>' +
              '<td><b>' + m.cpse + '</b> <span class="sector-pill ' + sec.cls + '">' + sec.sector + '</span></td>' +
              '<td class="code">' + m.materialCode + '</td>' +
              '<td>' + m.materialName + '</td>' +
              '<td class="code"><b>' + m.nationalCode + '</b></td>' +
              '<td>' + status(m.status === 'Approved' ? 'Mapped' : 'Pending Approval') + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table></div>' +
    '</div>'
  );
}

function governance() {
  shell(
    title('Key Capability 07 · Accountability & Audit', 'Audit Trail & Governance', 'Immutable audit mechanism recording every change, approval, and rejection of material master records with complete actor and code traceability.') +
    '<div class="card">' +
      '<div class="section-head">' +
        '<div>' +
          '<h3>Governance Audit Log</h3>' +
          '<span class="subtle">Audit logs are tamper-evident and permanently link original CPSE codes to national codes</span>' +
        '</div>' +
      '</div>' +
      '<div class="tablewrap" style="margin-top:14px"><table class="table">' +
        '<thead><tr><th>Audit ID</th><th>Action</th><th>Material</th><th>Original Values</th><th>New Value</th><th>Actor / Date</th><th>Status</th></tr></thead>' +
        '<tbody>' +
          data.audit.map(a =>
            '<tr>' +
              '<td class="code">' + a.id + '</td>' +
              '<td><b>' + a.action + '</b></td>' +
              '<td>' + a.material + '</td>' +
              '<td class="code">' + a.oldValue + '</td>' +
              '<td class="code"><b>' + a.newValue + '</b></td>' +
              '<td>' + a.actor + '<br><span class="subtle">' + a.timestamp + '</span></td>' +
              '<td>' + status(a.status) + '</td>' +
            '</tr>'
          ).join('') +
        '</tbody>' +
      '</table></div>' +
    '</div>'
  );
}

function erp() {
  shell(
    title('Key Capability 08 · Interoperability Center', 'SAP / ERP Integration', 'Seamless integration architecture for participating CPSE SAP/ERP systems supporting RFC, OData, REST APIs, and automated delta mapping synchronization.') +
    '<div class="card">' +
      '<h3>Integration Flow Architecture</h3>' +
      '<p class="subtle">Bi-directional exchange between CPSE source ERPs and National Unified Material Master</p>' +
      '<div class="flow">' +
        ['CPSE ERP / SAP\n(Oil & Gas, Power, Steel, Mining, Eng)', 'Secure RFC / API Gateway', 'MaterialCode AI\nMatching & Standardization', 'Unified Master\nCatalog (BOLT001)', 'Bi-directional\nCode Mapping', 'CPSE ERP / SAP\nDelta Synchronization'].map(x => '<div>' + x.replace(/\n/g, '<br>') + '</div>').join('') +
      '</div>' +
    '</div>' +
    '<div class="kpis">' +
      [['Active (RFC/OData)', 'SAP Connector'], ['Online (REST/JSON)', 'API Gateway'], ['Supported', 'Data Exchange'], ['Operational', 'Migration Sync']].map(x =>
        '<div class="kpi"><div class="l">' + x[1] + '</div><div class="v" style="font-size:15px">' + x[0] + '</div></div>'
      ).join('') +
    '</div>' +
    '<div class="card">' +
      '<div class="section-head">' +
        '<div>' +
          '<h3>Supported Enterprise Interfaces</h3>' +
          '<p class="subtle">SAP IDoc · OData / REST · CSV · XLSX · JSON · XML</p>' +
        '</div>' +
        '<button class="button" onclick="testErpSync()">Test ERP Handshake</button>' +
      '</div>' +
    '</div>'
  );
}

function review(id) {
  const g = data.groups.find(x => x.id === id);
  if (!g) return;
  modal.innerHTML = '<div class="modalbg"><div class="dialog">' +
    '<div class="section-head">' +
      '<div>' +
        title('AI EXPLAINABILITY & GOVERNANCE', 'Review: ' + g.name, 'High similarity in material attributes, specifications, and applications across CPSEs. Differences are naming conventions and enterprise codes.') +
      '</div>' +
      '<button class="button outline" onclick="closeModal()">Close</button>' +
    '</div>' +
    '<div class="comparison">' +
      g.records.map(r =>
        '<div class="record">' +
          '<strong>' + r[0] + '</strong><br>' +
          '<span class="code">Legacy Code: ' + r[1] + '</span><br>' +
          'Name: ' + r[2] + '<br>' +
          'Description: ' + r[3] + '<br>' +
          'Specification: ' + g.specification + '<br>' +
          'UOM: ' + g.uom +
        '</div>'
      ).join('') +
    '</div>' +
    '<div class="grid">' +
      '<div class="card">' +
        '<h3>AI Comparison Rationale</h3>' +
        '<p class="subtle">Name 94% · Description 91% · Specification 100% · UOM 100% · Classification 100%</p>' +
        '<div class="meter"><i style="width:' + g.score + '%"></i></div>' +
        '<b>' + g.score + '% overall similarity confidence</b>' +
      '</div>' +
      '<div class="card">' +
        '<span class="eyebrow">PROPOSED COMMON NATIONAL CODE</span>' +
        '<h3>' + g.name + '</h3>' +
        '<p class="subtle">National Code: <span class="code"><b>' + g.code + '</b></span><br>All source CPSE records will be traceably preserved in the mapping layer.</p>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:18px;display:flex;gap:9px;justify-content:flex-end">' +
      (g.status === 'Approved' ? status('Approved') :
        '<button class="button danger" onclick="reject(\'' + g.id + '\')">Reject Recommendation</button>' +
        '<button class="button" onclick="approve(\'' + g.id + '\')">Confirm & Issue National Code</button>'
      ) +
    '</div>' +
  '</div></div>';
}

function closeModal() {
  modal.innerHTML = '';
}

async function approve(id) {
  const r = await fetch('/api/standardization/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId: id })
  }).then(x => x.json());
  toast('✓ Standardization approved — ' + r.message);
  closeModal();
  await load();
  go(page);
}

async function reject(id) {
  const r = await fetch('/api/standardization/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId: id })
  }).then(x => x.json());
  toast(r.message);
  closeModal();
  await load();
  go(page);
}

function testErpSync() {
  toast('✓ ERP Handshake successful: Simulated delta sync with SAP ONGC, NTPC & SAIL instances.');
}

function toast(t) {
  document.body.insertAdjacentHTML('beforeend', '<div class="toast">' + t + '</div>');
  setTimeout(() => $('.toast')?.remove(), 3500);
}

function downloadCsv() {
  const h = 'CPSE Enterprise,Legacy Code,National Code,Standard Name,Migration Status\n';
  const s = data.materials.map(m => m.cpse + ',' + m.materialCode + ',' + m.nationalCode + ',"' + m.materialName + '",' + (m.status === 'Approved' ? 'Mapped' : 'Pending Approval')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([h + s], { type: 'text/csv' }));
  a.download = 'materialcode-migration-mapping.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Migration mapping CSV downloaded.');
}

function downloadMasterCsv() {
  const h = 'National Code,Standard Material Name,Description,Specification,Category,UOM,Status\n';
  const s = data.groups.map(g => g.code + ',"' + g.name + '","' + g.description + '","' + g.specification + '",' + g.category + ',' + g.uom + ',' + g.status).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([h + s], { type: 'text/csv' }));
  a.download = 'national-unified-material-master.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('National Unified Material Master CSV downloaded.');
}

function filterMatches(q) {
  q = q.toLowerCase();
  $('#matchrows').querySelectorAll('tr').forEach(r => {
    r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
}

function filterConfidence(v) {
  $('#matchrows').querySelectorAll('tr').forEach((r, i) => {
    const score = data.groups[i].score;
    r.style.display = !v || (v.includes('High') ? score >= 90 : score >= 70 && score < 90) ? '' : 'none';
  });
}

function triggerFileInput(e) {
  if (e) e.stopPropagation();
  const input = document.getElementById('material-file-input');
  if (input) {
    input.value = '';
    input.click();
  }
}

function handleDropZoneClick(e) {
  if (e.target && e.target.tagName === 'BUTTON') return;
  triggerFileInput();
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
  const dz = document.getElementById('drop-zone');
  if (dz) dz.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('drop-zone');
  if (dz) dz.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('drop-zone');
  if (dz) dz.classList.remove('dragover');
  const files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length > 0) {
    processUploadedFile(files[0]);
  }
}

function handleFileSelect(e) {
  const files = e.target.files;
  if (files && files.length > 0) {
    processUploadedFile(files[0]);
  }
}

function parseCSV(text) {
  const lines = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(c => c !== '')) lines.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) lines.push(row);
  }
  if (lines.length === 0) return { headers: [], rows: [] };
  return { headers: lines[0], rows: lines.slice(1) };
}

function parseJSON(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (err) { throw new Error('Invalid JSON format'); }
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { headers: [], rows: [] };
    if (Array.isArray(parsed[0])) { return { headers: parsed[0].map(String), rows: parsed.slice(1) }; }
    if (typeof parsed[0] === 'object' && parsed[0] !== null) {
      const headers = Object.keys(parsed[0]);
      const rows = parsed.map(obj => headers.map(h => (obj[h] !== undefined && obj[h] !== null ? String(obj[h]) : '')));
      return { headers, rows };
    }
  } else if (typeof parsed === 'object' && parsed !== null) {
    const arrKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (arrKey) return parseJSON(JSON.stringify(parsed[arrKey]));
  }
  throw new Error('Unsupported JSON layout');
}

function parseExcel(buffer) {
  if (typeof XLSX === 'undefined') throw new Error('XLSX parser library not loaded');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) return { headers: [], rows: [] };
  return { headers: (rawRows[0] || []).map(String), rows: rawRows.slice(1) };
}

function analyzeDataset(headers, rows) {
  const validRows = rows.filter(r => r && r.some(c => String(c ?? '').trim() !== ''));
  const recordCount = validRows.length;
  if (recordCount === 0) return { records: 0, quality: 0, duplicates: 0, headers: headers || [], rows: [] };

  const numCols = Math.max(headers.length, 1);
  const cpseIdx = headers.findIndex(h => /^(cpse|company|org|enterprise)/i.test(String(h).trim()));
  const codeIdx = headers.findIndex(h => /^(material\s*code|mat\s*code|item\s*code|code|part\s*no|part\s*number)/i.test(String(h).trim()));

  let totalCells = recordCount * numCols;
  let filledCells = 0;
  let duplicateCount = 0;
  const seenKeys = new Set();
  const seenFullRows = new Set();

  validRows.forEach(row => {
    let rowFilled = 0;
    for (let c = 0; c < numCols; c++) {
      const val = row[c];
      if (val !== undefined && val !== null && String(val).trim() !== '') rowFilled++;
    }
    filledCells += rowFilled;

    let isDup = false;
    const fullRowKey = row.map(v => String(v ?? '').trim().toLowerCase()).join('###');

    if (codeIdx !== -1) {
      const cpseVal = cpseIdx !== -1 ? String(row[cpseIdx] ?? '').trim().toLowerCase() : '';
      const codeVal = String(row[codeIdx] ?? '').trim().toLowerCase();
      if (codeVal !== '') {
        const key = cpseVal + ':::' + codeVal;
        if (seenKeys.has(key)) isDup = true;
        else seenKeys.add(key);
      }
    }

    if (seenFullRows.has(fullRowKey)) isDup = true;
    else seenFullRows.add(fullRowKey);

    if (isDup) duplicateCount++;
  });

  const completeness = totalCells > 0 ? (filledCells / totalCells) : 0;
  const uniqueness = recordCount > 0 ? ((recordCount - duplicateCount) / recordCount) : 1;
  const quality = Math.max(0, Math.min(100, Math.round((completeness * 0.7 + uniqueness * 0.3) * 100)));

  return { records: recordCount, quality, duplicates: duplicateCount, headers, rows: validRows };
}

function processUploadedFile(file) {
  if (!file) return;
  const fileName = file.name;
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const reader = new FileReader();
  reader.onerror = () => toast('Error reading file: ' + fileName);

  if (ext === '.csv') {
    reader.onload = e => {
      try {
        const { headers, rows } = parseCSV(e.target.result);
        applyDataset(fileName, headers, rows);
      } catch (err) { toast('Failed to parse CSV: ' + err.message); }
    };
    reader.readAsText(file);
  } else if (ext === '.json') {
    reader.onload = e => {
      try {
        const { headers, rows } = parseJSON(e.target.result);
        applyDataset(fileName, headers, rows);
      } catch (err) { toast('Failed to parse JSON: ' + err.message); }
    };
    reader.readAsText(file);
  } else if (ext === '.xlsx' || ext === '.xls') {
    reader.onload = e => {
      try {
        const { headers, rows } = parseExcel(e.target.result);
        applyDataset(fileName, headers, rows);
      } catch (err) { toast('Failed to parse Excel file: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  } else {
    toast('Unsupported file format. Please upload CSV, XLSX, or JSON.');
  }
}

function applyDataset(fileName, headers, rows) {
  const analyzed = analyzeDataset(headers, rows);
  if (analyzed.records === 0) {
    toast('File uploaded, but no material records were detected.');
    return;
  }
  uploadedDataset = {
    fileName,
    records: analyzed.records,
    quality: analyzed.quality,
    duplicates: analyzed.duplicates,
    headers: analyzed.headers,
    rows: analyzed.rows
  };
  toast('✓ ' + fileName + ' imported: ' + analyzed.records.toLocaleString() + ' records detected (' + analyzed.quality + '% quality).');
  if (page === 'dashboard') dashboard();
  else go(page);
}

function go(p) {
  page = p;
  ({ dashboard, matching, standardization, duplicates, master, mapping, governance, erp })[p]();
  window.scrollTo(0, 0);
}

async function load() {
  [data.groups, data.cpses, data.materials, data.audit] = await Promise.all([
    api('matches'),
    api('cpse'),
    api('materials'),
    api('audit')
  ]);
}

if (typeof window !== 'undefined') {
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) {
      closeSearchDropdown();
    }
  });
}

load().then(() => go('dashboard'));
