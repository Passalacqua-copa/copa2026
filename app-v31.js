
var DATA = window.COPA_DATA;
var SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbyc_84DuzwtrrnTWRr2icNYl4_lLbZ53Ipew40bkGs_R9AJMgzsVO-1ln8G6SDOtFEq/exec';
var KEY = 'passalacqua_copa2026_resultados';
var ADMIN_KEY = 'passalacqua_copa2026_admin';
var matches = [];
var editIndex = -1;
var curStatus = 'agendado';
var isAdmin = false;

function clone(o) {
  var x = {};
  for (var k in o) x[k] = o[k];
  return x;
}

function init() {
  isAdmin = sessionStorage.getItem(ADMIN_KEY) === '1';
  matches = [];

  for (var i = 0; i < DATA.groupMatches.length; i++) {
    var m = clone(DATA.groupMatches[i]);
    m.type = 'group';
    addBlankScore(m);
    matches.push(m);
  }

  for (var j = 0; j < DATA.koMatches.length; j++) {
    var k = clone(DATA.koMatches[j]);
    k.type = 'ko';
    k.group = '';
    addBlankScore(k);
    matches.push(k);
  }

  loadLocal();
  updateAdminUI();
  renderAll();
  loadRemoteResults();
}

function addBlankScore(m) {
  m.gA = null;
  m.gB = null;
  m.pA = null;
  m.pB = null;
  m.status = 'agendado';
}

function loadLocal() {
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '{}');

    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      var s = saved[m.num];

      if (!s) continue;

      m.gA = s.gA == null ? null : Number(s.gA);
      m.gB = s.gB == null ? null : Number(s.gB);
      m.pA = s.pA == null ? null : Number(s.pA);
      m.pB = s.pB == null ? null : Number(s.pB);
      m.status = s.status || 'agendado';
    }
  } catch(e) {}
}

function persist() {
  var s = {};

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    s[m.num] = {
      gA: m.gA,
      gB: m.gB,
      pA: m.pA,
      pB: m.pB,
      status: m.status
    };
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch(e) {}
}

function findMatch(num) {
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].num === num) return matches[i];
  }

  return null;
}

function flagCode(n) {
  return DATA.teams[n] || '';
}

function flagEmoji(n) {
  return DATA.flagEmoji && DATA.flagEmoji[n] ? DATA.flagEmoji[n] : '';
}

function isRealTeam(name) {
  return !!DATA.teams[name];
}

function flagImg(n, extra) {
  var code = flagCode(n);

  if (!code) return '';

  return '<img class="flag-img ' + (extra || '') + '" src="https://flagcdn.com/w80/' + code.toLowerCase() + '.png" alt="' + n + '" loading="lazy">';
}

function teamLabel(name, big) {
  if (isRealTeam(name)) return flagImg(name, big ? 'big' : '') + '<span>' + name + '</span>';
  return '<span class="placeholder">' + name + '</span>';
}

function gd(t) {
  return t.gp - t.gc;
}

function sortTeam(a, b) {
  return (b.pts - a.pts) || (gd(b) - gd(a)) || (b.gp - a.gp) || a.team.localeCompare(b.team);
}

function groupTables() {
  var st = {};

  for (var g in DATA.groups) {
    for (var i = 0; i < DATA.groups[g].length; i++) {
      var n = DATA.groups[g][i];
      st[n] = {
        team: n,
        group: g,
        j: 0,
        v: 0,
        e: 0,
        d: 0,
        gp: 0,
        gc: 0,
        pts: 0
      };
    }
  }

  for (var j = 0; j < matches.length; j++) {
    var m = matches[j];

    if (m.type !== 'group' || m.status !== 'encerrado' || m.gA == null || m.gB == null) continue;

    var a = st[m.a];
    var b = st[m.b];

    if (!a || !b) continue;

    a.j++;
    b.j++;
    a.gp += m.gA;
    a.gc += m.gB;
    b.gp += m.gB;
    b.gc += m.gA;

    if (m.gA > m.gB) {
      a.v++;
      a.pts += 3;
      b.d++;
    } else if (m.gB > m.gA) {
      b.v++;
      b.pts += 3;
      a.d++;
    } else {
      a.e++;
      b.e++;
      a.pts++;
      b.pts++;
    }
  }

  var tabs = {};

  for (var gr in DATA.groups) {
    tabs[gr] = [];

    for (var k = 0; k < DATA.groups[gr].length; k++) {
      tabs[gr].push(st[DATA.groups[gr][k]]);
    }

    tabs[gr].sort(sortTeam);
  }

  return tabs;
}

function refName(ref, stack) {
  stack = stack || {};

  if (!ref) return '';
  if (typeof ref !== 'string') return String(ref);

  var type = ref.charAt(0);

  if (type !== 'W' && type !== 'L') return ref;

  var num = parseInt(ref.substring(1), 10);

  if (isNaN(num)) return ref;

  var key = type + num;

  if (stack[key]) return type === 'W' ? 'Vencedor Jogo ' + num : 'Perdedor Jogo ' + num;

  stack[key] = true;

  var m = findMatch(num);

  if (!m) return type === 'W' ? 'Vencedor Jogo ' + num : 'Perdedor Jogo ' + num;

  if (m.status !== 'encerrado' || m.gA == null || m.gB == null) {
    return type === 'W' ? 'Vencedor Jogo ' + num : 'Perdedor Jogo ' + num;
  }

  var names = matchNames(m, stack);
  var winner = null;
  var loser = null;

  if (m.gA > m.gB) {
    winner = names.a;
    loser = names.b;
  } else if (m.gB > m.gA) {
    winner = names.b;
    loser = names.a;
  } else if (m.type === 'ko' && m.pA != null && m.pB != null) {
    if (m.pA > m.pB) {
      winner = names.a;
      loser = names.b;
    } else if (m.pB > m.pA) {
      winner = names.b;
      loser = names.a;
    }
  }

  return type === 'W'
    ? (winner || 'Vencedor Jogo ' + num)
    : (loser || 'Perdedor Jogo ' + num);
}

function matchNames(m, stack) {
  stack = stack || {};

  if (!m) return { a: '', b: '' };

  if (m.type === 'ko') {
    return {
      a: refName(m.aRef, Object.assign({}, stack)),
      b: refName(m.bRef, Object.assign({}, stack))
    };
  }

  return {
    a: m.a || '',
    b: m.b || ''
  };
}

function winnerOf(num) {
  var n = refName('W' + num, {});
  return n.indexOf('Vencedor Jogo ') === 0 ? null : n;
}

function loserOf(num) {
  var n = refName('L' + num, {});
  return n.indexOf('Perdedor Jogo ') === 0 ? null : n;
}

function resolveRef(ref) {
  return refName(ref, {});
}

function knockoutNames() {
  var out = {};

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if (m.type === 'ko') {
      out[m.num] = matchNames(m, {});
    }
  }

  return out;
}

function matchHtml(idx, m, a, b) {
  var sc = m.time;
  var st = '';
  var openScore = ' open';

  if (m.status === 'encerrado' && m.gA != null && m.gB != null) {
    sc = m.gA + ' × ' + m.gB;

    if (m.type === 'ko' && m.gA === m.gB && m.pA != null && m.pB != null) {
      sc += ' <small>(' + m.pA + '×' + m.pB + ' pen.)</small>';
    }

    st = '<span class="status">ENC.</span>';
    openScore = '';
  } else if (m.status === 'ao_vivo') {
    sc = (m.gA != null && m.gB != null) ? m.gA + ' × ' + m.gB : '? × ?';
    st = '<span class="status live">AO VIVO</span>';
    openScore = '';
  }

  var gr = m.group
    ? '<span class="num">J' + m.num + ' · G' + m.group + '</span>'
    : '<span class="num">J' + m.num + '</span>';

  var brazil = (a === 'Brasil' || b === 'Brasil') ? ' brazil' : '';
  var edit = isAdmin ? '<button class="edit" type="button" onclick="openMatch(' + idx + ')">⚽ placar</button>' : '';

  return '<div class="match' + brazil + '">' +
    gr +
    '<div class="matchbody">' +
      '<div class="team-game">' + teamLabel(a, true) + '</div>' +
      '<span class="score' + openScore + '">' + sc + '</span>' +
      '<div class="team-game">' + teamLabel(b, true) + '</div>' +
    '</div>' +
    st +
    '<span class="meta">' + m.date + ' · ' + m.city + '</span>' +
    edit +
  '</div>';
}

function renderClass() {
  var tabs = groupTables();
  var html = '<div class="groups">';

  for (var g in tabs) {
    html += '<div class="group-card"><h2>Grupo ' + g + '</h2>';
    html += '<table><thead><tr><th>Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>GP</th><th>Pts</th></tr></thead><tbody>';

    for (var i = 0; i < tabs[g].length; i++) {
      var t = tabs[g][i];
      html += '<tr><td><span class="pos">' + (i + 1) + '</span>' + teamLabel(t.team, false) + '</td><td>' + t.j + '</td><td>' + t.v + '</td><td>' + t.e + '</td><td>' + t.d + '</td><td>' + gd(t) + '</td><td>' + t.gp + '</td><td><b>' + t.pts + '</b></td></tr>';
    }

    html += '</tbody></table></div>';
  }

  html += '</div>';
  document.getElementById('class').innerHTML = html;
}

function renderGames() {
  var html = '<h2>Fase de grupos</h2>';
  var lastDate = '';

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if (m.type !== 'group') continue;

    if (m.date !== lastDate) {
      html += '<h3 class="date-title">' + m.date + '</h3>';
      lastDate = m.date;
    }

    html += matchHtml(i, m, m.a, m.b);
  }

  document.getElementById('jogos').innerHTML = html;
}

function renderKnockout() {
  var html = '';
  var current = '';

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if (m.type !== 'ko') continue;

    if (current !== m.stage) {
      if (current) html += '</div>';
      html += '<div class="stage"><h2>' + m.stage + '</h2>';
      current = m.stage;
    }

    var n = matchNames(m, {});
    html += matchHtml(i, m, n.a, n.b);
  }

  if (current) html += '</div>';

  html += '<div class="notice">No mata-mata, os vencedores avançam automaticamente para as próximas fases.</div>';

  document.getElementById('mata').innerHTML = html;
}

function bracketTreeTeam(name) {
  if (isRealTeam(name)) return teamLabel(name, false);
  return '<span class="tree-placeholder">' + name + '</span>';
}

function bracketTreeScore(m) {
  if (m.status === 'encerrado' && m.gA != null && m.gB != null) {
    var s = m.gA + ' x ' + m.gB;

    if (m.gA === m.gB && m.pA != null && m.pB != null) s += ' (' + m.pA + 'x' + m.pB + ')';

    return '<span class="tree-score">' + s + '</span>';
  }

  if (m.status === 'ao_vivo') return '<span class="tree-score live-score">AO VIVO</span>';

  return '<span class="tree-score open-score">' + m.time + '</span>';
}

function treeMatch(num) {
  var m = findMatch(num);

  if (!m) return '';

  var n = matchNames(m, {});
  var w = winnerOf(num);
  var ac = w === n.a ? ' winner' : '';
  var bc = w === n.b ? ' winner' : '';

  return '<div class="tree-match" data-jogo="' + num + '">' +
    '<div class="tree-num">J' + num + '</div>' +
    '<div class="tree-team' + ac + '">' + bracketTreeTeam(n.a) + '</div>' +
    '<div class="tree-versus">' + bracketTreeScore(m) + '</div>' +
    '<div class="tree-team' + bc + '">' + bracketTreeTeam(n.b) + '</div>' +
    '<div class="tree-meta">' + m.date + ' · ' + m.city + '</div>' +
  '</div>';
}

function renderBracketSide(columns, sideClass) {
  var html = '<div class="tree-side ' + sideClass + '"><div class="tree-columns">';

  for (var c = 0; c < columns.length; c++) {
    html += '<div class="tree-column level-' + c + '">';
    html += '<div class="tree-stage">' + columns[c].title + '</div>';

    for (var i = 0; i < columns[c].matches.length; i++) {
      html += treeMatch(columns[c].matches[i]);
    }

    html += '</div>';
  }

  html += '</div></div>';

  return html;
}

function renderChampionBox() {
  var champ = winnerOf(104);
  var vice = loserOf(104);
  var html = '<div class="champion-box champion-box-v15">';
  html += '<div class="cup">🏆</div>';
  html += '<div class="champion-label">Campeão</div>';
  html += champ ? '<div class="champion-team">' + bracketTreeTeam(champ) + '</div>' : '<div class="champion-team tree-placeholder">A definir</div>';

  if (vice) html += '<div class="vice-team">Vice: ' + vice + '</div>';

  html += '</div>';

  return html;
}

function renderBracketTree() {
  var target = document.getElementById('chave');

  if (!target) return;

  var left = [
    { title: '32 avos', matches: [74,77,73,75,83,84,81,82] },
    { title: 'Oitavas', matches: [89,90,93,94] },
    { title: 'Quartas', matches: [97,98] },
    { title: 'Semifinal', matches: [101] }
  ];

  var right = [
    { title: 'Semifinal', matches: [102] },
    { title: 'Quartas', matches: [99,100] },
    { title: 'Oitavas', matches: [91,92,95,96] },
    { title: '32 avos', matches: [76,78,79,80,86,88,85,87] }
  ];

  var html = '<div class="tree-wrap tree-wrap-v15">';
  html += '<h2 class="tree-title">🏆 Chaveamento da Copa 2026</h2>';
  html += '<p class="tree-subtitle">Simulação automática do caminho até a final, conforme os resultados lançados.</p>';
  html += '<div class="mobile-zoom-hint">📱 No celular: use dois dedos para aproximar/afastar e arraste para navegar pela chave.</div>';
  html += '<div class="zoom-actions"><button type="button" onclick="zoomBracketOut()">−</button><button type="button" onclick="resetBracketZoom()">Ajustar</button><button type="button" onclick="zoomBracketIn()">+</button></div>';
  html += '<div class="tree-scroll pinch-area" id="bracketViewport"><div class="tree-board tree-board-v15" id="bracketBoard">';
  html += renderBracketSide(left, 'left-side');
  html += '<div class="tree-center tree-center-v15">';
  html += '<div class="final-box final-box-v15"><div class="tree-stage final-stage">Final</div>' + treeMatch(104) + '</div>';
  html += renderChampionBox();
  html += '<div class="third-box third-box-v15"><div class="tree-stage">3º lugar</div>' + treeMatch(103) + '</div>';
  html += '</div>';
  html += renderBracketSide(right, 'right-side');
  html += '</div></div>';
  html += '<div class="small">A chave é preenchida automaticamente conforme os vencedores forem definidos.</div>';
  html += '</div>';

  target.innerHTML = html;

  setTimeout(setupBracketMobileZoom, 50);
}

function renderBrazilBox() {
  var box = document.getElementById('brazilBox');
  var next = null;

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var n = matchNames(m, {});

    if ((n.a === 'Brasil' || n.b === 'Brasil') && m.status !== 'encerrado') {
      next = { match: m, names: n };
      break;
    }
  }

  if (!next) {
    box.innerHTML = '<span class="label">BR Brasil</span><strong>Todos os jogos da fase de grupos encerrados</strong>';
    return;
  }

  var m2 = next.match;
  var n2 = next.names;

  box.innerHTML = '<span class="label">BR Próximo jogo do Brasil</span>' +
    '<strong>' + teamLabel(n2.a, true) + '<span class="score open">×</span>' + teamLabel(n2.b, true) + '</strong>' +
    '<p>🗓️ ' + m2.date + ' · 🕘 ' + m2.time + ' · 📍 ' + m2.city + '</p>';
}

function renderAll() {
  renderBrazilBox();
  renderClass();
  renderGames();
  renderKnockout();
  renderBracketTree();
}

function tab(id) {
  var ids = ['class', 'jogos', 'mata', 'chave'];

  for (var i = 0; i < ids.length; i++) {
    var sec = document.getElementById(ids[i]);
    var btn = document.getElementById('tab-' + ids[i]);

    if (sec) sec.className = ids[i] === id ? 'section active' : 'section';
    if (btn) btn.className = ids[i] === id ? 'active' : '';
  }
}

function adminLogin() {
  var p = prompt('Senha de administrador:');

  if (p === DATA.adminPassword) {
    isAdmin = true;
    sessionStorage.setItem(ADMIN_KEY, '1');
    updateAdminUI();
    renderAll();
  } else if (p !== null) {
    alert('Senha incorreta.');
  }
}

function adminLogout() {
  isAdmin = false;
  sessionStorage.removeItem(ADMIN_KEY);
  updateAdminUI();
  renderAll();
}

function updateAdminUI() {
  document.getElementById('adminBtn').className = isAdmin ? 'hidden' : '';
  document.getElementById('logoutBtn').className = isAdmin ? '' : 'hidden';
  document.getElementById('clearBtn').className = isAdmin ? 'danger' : 'hidden danger';
  document.getElementById('modeLabel').innerHTML = isAdmin ? 'Administrador' : 'Funcionário';
  document.getElementById('notice').innerHTML = isAdmin
    ? 'Modo administrador: edição de placares liberada neste navegador.'
    : 'Modo funcionário: apenas visualização. Para alterar placares, entrar como administrador.';
}

function openMatch(idx) {
  if (!isAdmin) return;

  editIndex = idx;

  var m = matches[idx];
  var n = matchNames(m, {});

  document.getElementById('mtitle').innerHTML = 'Jogo ' + m.num + ' · ' + (m.stage || ('Grupo ' + (m.group || ''))) + ' · ' + m.date + ' · ' + m.time;
  document.getElementById('fa').innerHTML = isRealTeam(n.a) ? flagImg(n.a, 'big') : '';
  document.getElementById('fb').innerHTML = isRealTeam(n.b) ? flagImg(n.b, 'big') : '';
  document.getElementById('na').innerHTML = n.a;
  document.getElementById('nb').innerHTML = n.b;
  document.getElementById('ga').value = m.gA == null ? '' : m.gA;
  document.getElementById('gb').value = m.gB == null ? '' : m.gB;
  document.getElementById('pa').value = m.pA == null ? '' : m.pA;
  document.getElementById('pb').value = m.pB == null ? '' : m.pB;
  document.getElementById('penbox').style.display = m.type === 'ko' ? 'flex' : 'none';

  curStatus = m.status || 'agendado';

  setStatus(curStatus);

  document.getElementById('overlay').className = 'overlay open';
}

function closeModal() {
  document.getElementById('overlay').className = 'overlay';
}

function setStatus(s) {
  curStatus = s;

  var ids = ['s0', 's1', 's2'];

  for (var i = 0; i < ids.length; i++) {
    document.getElementById(ids[i]).className = '';
  }

  if (s === 'agendado') document.getElementById('s0').className = 'sel';
  if (s === 'ao_vivo') document.getElementById('s1').className = 'sel';
  if (s === 'encerrado') document.getElementById('s2').className = 'sel';
}

function saveMatch() {
  if (editIndex < 0 || !matches[editIndex]) return;

  var m = matches[editIndex];
  var ga = document.getElementById('ga').value;
  var gb = document.getElementById('gb').value;
  var pa = document.getElementById('pa').value;
  var pb = document.getElementById('pb').value;

  m.gA = ga === '' ? null : parseInt(ga, 10);
  m.gB = gb === '' ? null : parseInt(gb, 10);
  m.pA = pa === '' ? null : parseInt(pa, 10);
  m.pB = pb === '' ? null : parseInt(pb, 10);
  m.status = curStatus || 'agendado';

  if (m.type === 'ko' && m.status === 'encerrado' && m.gA != null && m.gB != null && m.gA === m.gB) {
    if (m.pA == null || m.pB == null || m.pA === m.pB) {
      alert('Em jogo de mata-mata empatado, informe o placar dos pênaltis para definir o vencedor.');
      return;
    }
  }

  persist();
  closeModal();
  renderAll();
  toast('Salvando na planilha...');

  saveRemoteResult(m).then(function() {
    toast('Resultado salvo na planilha.');
    setTimeout(loadRemoteResults, 800);
  }).catch(function() {
    toast('Falha ao salvar na planilha.');
  });
}

function saveRemoteResult(m) {
  return new Promise(function(resolve, reject) {
    var cbName = 'copaSaveCallback_' + Date.now();

    window[cbName] = function(data) {
      try {
        if (data && data.ok) resolve(data);
        else reject(data || { error: 'Falha ao salvar' });
      } finally {
        delete window[cbName];

        var el = document.getElementById(cbName);

        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
    };

    var params = [
      'action=save',
      'callback=' + encodeURIComponent(cbName),
      'token=' + encodeURIComponent(DATA.adminPassword),
      'jogo=' + encodeURIComponent(String(m.num)),
      'golsA=' + encodeURIComponent(m.gA == null ? '' : String(m.gA)),
      'golsB=' + encodeURIComponent(m.gB == null ? '' : String(m.gB)),
      'status=' + encodeURIComponent(m.status || 'agendado'),
      'penA=' + encodeURIComponent(m.pA == null ? '' : String(m.pA)),
      'penB=' + encodeURIComponent(m.pB == null ? '' : String(m.pB)),
      't=' + Date.now()
    ].join('&');

    var script = document.createElement('script');
    script.id = cbName;
    script.src = SHEETS_API_URL + '?' + params;
    script.onerror = function() {
      delete window[cbName];
      reject({ error: 'Erro de comunicação' });
    };

    document.body.appendChild(script);
  });
}

function loadRemoteResults() {
  var cbName = 'copaResultsCallback_' + Date.now();

  window[cbName] = function(data) {
    try {
      if (data && data.ok && data.results) {
        applyRemoteResults(data.results);
        renderAll();
        toast('Resultados sincronizados.');
      }
    } finally {
      delete window[cbName];

      var el = document.getElementById(cbName);

      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  };

  var script = document.createElement('script');
  script.id = cbName;
  script.src = SHEETS_API_URL + '?callback=' + cbName + '&t=' + Date.now();
  script.onerror = function() {
    delete window[cbName];
    toast('Não foi possível sincronizar a planilha.');
  };

  document.body.appendChild(script);
}

function applyRemoteResults(results) {
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var r = results[m.num];

    if (!r) continue;

    m.gA = r.gA == null ? null : Number(r.gA);
    m.gB = r.gB == null ? null : Number(r.gB);
    m.status = r.status || 'agendado';
    m.pA = r.pA == null ? null : Number(r.pA);
    m.pB = r.pB == null ? null : Number(r.pB);
  }

  persist();
}

function clearScores() {
  if (!isAdmin) return;
  alert('Agora os resultados ficam salvos na planilha. Para limpar oficialmente, apague os placares na aba Resultados da planilha.');
}

function copySummary() {
  var dY = new Date();
  dY.setDate(dY.getDate() - 1);
  var yesterday = String(dY.getDate()).padStart(2, '0') + '/' + String(dY.getMonth() + 1).padStart(2, '0');

  var dT = new Date();
  var today = String(dT.getDate()).padStart(2, '0') + '/' + String(dT.getMonth() + 1).padStart(2, '0');

  var tabs = groupTables();
  var yesterdayGames = [];
  var impacted = {};
  var todayGames = [];

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if (m.date === yesterday && m.status === 'encerrado' && m.gA != null && m.gB != null) {
      yesterdayGames.push(m);

      if (m.type === 'group') impacted[m.group] = true;
    }

    if (m.date === today && m.status !== 'encerrado') {
      todayGames.push(m);
    }
  }

  var txt = '🏆 COPA DO MUNDO 2026 — PASSALACQUA\n\n';
  txt += '📅 Resumo dos jogos de ontem — ' + yesterday + '\n\n';

  if (yesterdayGames.length === 0) {
    txt += 'Ontem não tivemos jogos encerrados na tabela.\n\n';
  } else {
    txt += '⚽ Resultados\n\n';

    for (var g = 0; g < yesterdayGames.length; g++) {
      var jm = yesterdayGames[g];
      var jn = matchNames(jm, {});

      txt += flagEmoji(jn.a) + ' ' + jn.a + ' ' + jm.gA + ' x ' + jm.gB + ' ' + jn.b + ' ' + flagEmoji(jn.b);

      if (jm.type === 'ko' && jm.gA === jm.gB && jm.pA != null && jm.pB != null) {
        txt += ' — pênaltis: ' + jm.pA + ' x ' + jm.pB;
      }

      txt += '\n';
    }

    var hasGroup = false;

    for (var groupId in impacted) hasGroup = true;

    if (hasGroup) {
      txt += '\n📊 Classificação atualizada\n';

      for (var groupId2 in impacted) {
        txt += '\nGrupo ' + groupId2 + '\n';

        for (var t = 0; t < tabs[groupId2].length; t++) {
          var team = tabs[groupId2][t];
          txt += (t + 1) + 'º ' + flagEmoji(team.team) + ' ' + team.team + ' — ' + team.pts + ' pts | SG ' + gd(team) + '\n';
        }
      }

      txt += '\n';
    } else {
      txt += '\n🏆 Mata-mata atualizado\n\n';
    }
  }

  txt += '📅 Jogos de hoje — ' + today + '\n\n';

  if (todayGames.length === 0) {
    txt += 'Não há jogos programados para hoje na tabela.\n\n';
  } else {
    for (var j = 0; j < todayGames.length; j++) {
      var hj = todayGames[j];
      var hn = matchNames(hj, {});

      txt += flagEmoji(hn.a) + ' ' + hn.a + ' x ' + hn.b + ' ' + flagEmoji(hn.b) + ' — ' + hj.time + '\n';
    }

    txt += '\n';
  }

  var brazilToday = null;

  for (var b = 0; b < todayGames.length; b++) {
    var bn = matchNames(todayGames[b], {});

    if (bn.a === 'Brasil' || bn.b === 'Brasil') {
      brazilToday = {
        match: todayGames[b],
        names: bn
      };
      break;
    }
  }

  if (brazilToday) {
    txt += '📣 Destaque do dia\n\n';
    txt += '🇧🇷 ' + brazilToday.names.a + ' x ' + brazilToday.names.b + '\n';
    txt += brazilToday.match.time + ' • ' + brazilToday.match.city + '\n\n';
  } else if (todayGames.length > 0) {
    var main = todayGames[0];
    var mn = matchNames(main, {});

    txt += '🔥 Principal jogo do dia\n\n';
    txt += flagEmoji(mn.a) + ' ' + mn.a + ' x ' + mn.b + ' ' + flagEmoji(mn.b) + '\n';
    txt += main.time + ' • ' + main.city + '\n\n';
  }

  txt += '🔗 Tabela completa:\n' + (DATA.publicUrl || 'https://passalacqua-copa.github.io/copa2026/');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() {
      toast('Resumo diário copiado.');
    }, function() {
      alert(txt);
    });
  } else {
    alert(txt);
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen && document.exitFullscreen();
  }
}

function toast(msg) {
  var e = document.getElementById('toast');

  if (!e) return;

  e.innerHTML = msg;
  e.className = 'toast show';

  setTimeout(function() {
    e.className = 'toast';
  }, 2500);
}

/* mobile zoom */

var bracketZoomState = {
  scale: 1,
  min: 0.22,
  max: 1.25,
  x: 0,
  y: 0,
  startDist: 0,
  startScale: 1,
  lastX: 0,
  lastY: 0,
  dragging: false
};

function isMobileBracket() {
  return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
}

function applyBracketTransform() {
  var board = document.getElementById('bracketBoard');
  if (!board) return;
  board.style.transform = 'translate(' + bracketZoomState.x + 'px,' + bracketZoomState.y + 'px) scale(' + bracketZoomState.scale + ')';
  board.style.transformOrigin = '0 0';
}

function fitBracketToMobile() {
  var viewport = document.getElementById('bracketViewport');
  var board = document.getElementById('bracketBoard');

  if (!viewport || !board) return;

  if (!isMobileBracket()) {
    bracketZoomState.scale = 1;
    bracketZoomState.x = 0;
    bracketZoomState.y = 0;
    board.style.transform = '';
    viewport.style.height = '';
    return;
  }

  var vw = viewport.clientWidth || window.innerWidth;
  var boardWidth = board.scrollWidth || 1680;
  bracketZoomState.scale = Math.max(0.22, Math.min(0.42, (vw - 12) / boardWidth));
  bracketZoomState.x = 0;
  bracketZoomState.y = 0;
  viewport.style.height = Math.max(520, Math.min(760, (board.scrollHeight || 1300) * bracketZoomState.scale + 30)) + 'px';
  applyBracketTransform();
}

function setupBracketMobileZoom() {
  var viewport = document.getElementById('bracketViewport');
  var board = document.getElementById('bracketBoard');

  if (!viewport || !board) return;

  fitBracketToMobile();

  if (viewport.dataset.zoomReady === '1') return;

  viewport.dataset.zoomReady = '1';

  viewport.addEventListener('touchstart', function(e) {
    if (!isMobileBracket()) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      bracketZoomState.startDist = touchDistance(e.touches[0], e.touches[1]);
      bracketZoomState.startScale = bracketZoomState.scale;
      bracketZoomState.dragging = false;
    } else if (e.touches.length === 1) {
      bracketZoomState.dragging = true;
      bracketZoomState.lastX = e.touches[0].clientX;
      bracketZoomState.lastY = e.touches[0].clientY;
    }
  }, { passive: false });

  viewport.addEventListener('touchmove', function(e) {
    if (!isMobileBracket()) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      var dist = touchDistance(e.touches[0], e.touches[1]);
      var next = bracketZoomState.startScale * (dist / Math.max(1, bracketZoomState.startDist));
      bracketZoomState.scale = Math.max(bracketZoomState.min, Math.min(bracketZoomState.max, next));
      applyBracketTransform();
    } else if (e.touches.length === 1 && bracketZoomState.dragging) {
      e.preventDefault();
      var nx = e.touches[0].clientX;
      var ny = e.touches[0].clientY;
      bracketZoomState.x += nx - bracketZoomState.lastX;
      bracketZoomState.y += ny - bracketZoomState.lastY;
      bracketZoomState.lastX = nx;
      bracketZoomState.lastY = ny;
      applyBracketTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', function(e) {
    if (e.touches.length === 0) bracketZoomState.dragging = false;
  });
}

function touchDistance(a, b) {
  var dx = a.clientX - b.clientX;
  var dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function zoomBracketIn() {
  if (!isMobileBracket()) return;
  bracketZoomState.scale = Math.min(bracketZoomState.max, bracketZoomState.scale + 0.08);
  applyBracketTransform();
}

function zoomBracketOut() {
  if (!isMobileBracket()) return;
  bracketZoomState.scale = Math.max(bracketZoomState.min, bracketZoomState.scale - 0.08);
  applyBracketTransform();
}

function resetBracketZoom() {
  fitBracketToMobile();
}

window.onload = init;

/* ===== V31 PENALTIS + CLASSIFICAÇÃO ===== */

applyRemoteResults = function(results) {
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var r = results[m.num];
    if (!r) continue;

    m.gA = r.gA == null || r.gA === '' ? null : Number(r.gA);
    m.gB = r.gB == null || r.gB === '' ? null : Number(r.gB);
    m.status = r.status || 'agendado';

    var remotePA = r.pA != null ? r.pA : r.penA;
    var remotePB = r.pB != null ? r.pB : r.penB;

    if (remotePA != null && remotePA !== '') m.pA = Number(remotePA);
    if (remotePB != null && remotePB !== '') m.pB = Number(remotePB);
  }
  persist();
};

function refName(ref, stack) {
  stack = stack || {};
  if (!ref) return '';
  if (typeof ref !== 'string') return String(ref);

  var type = ref.charAt(0);
  if (type !== 'W' && type !== 'L') return ref;

  var num = parseInt(ref.substring(1), 10);
  if (isNaN(num)) return ref;

  var key = type + num;
  if (stack[key]) return type === 'W' ? 'Vencedor Jogo ' + num : 'Perdedor Jogo ' + num;
  stack[key] = true;

  var m = findMatch(num);
  if (!m) return type === 'W' ? 'Vencedor Jogo ' + num : 'Perdedor Jogo ' + num;

  if (m.status !== 'encerrado' || m.gA == null || m.gB == null) {
    return type === 'W' ? 'Vencedor Jogo ' + num : 'Perdedor Jogo ' + num;
  }

  var names = matchNames(m, stack);
  var winner = null;
  var loser = null;

  if (m.gA > m.gB) {
    winner = names.a; loser = names.b;
  } else if (m.gB > m.gA) {
    winner = names.b; loser = names.a;
  } else if (m.type === 'ko' && m.pA != null && m.pB != null && m.pA !== m.pB) {
    if (m.pA > m.pB) { winner = names.a; loser = names.b; }
    else { winner = names.b; loser = names.a; }
  }

  return type === 'W' ? (winner || 'Vencedor Jogo ' + num) : (loser || 'Perdedor Jogo ' + num);
}

function winnerOf(num) {
  var n = refName('W' + num, {});
  return n.indexOf('Vencedor Jogo ') === 0 ? null : n;
}

function loserOf(num) {
  var n = refName('L' + num, {});
  return n.indexOf('Perdedor Jogo ') === 0 ? null : n;
}

function resolveRef(ref) {
  return refName(ref, {});
}

renderClass = function() {
  var tabs = groupTables();
  var html = '<div class="groups">';
  for (var g in tabs) {
    html += '<div class="group-card"><h2>Grupo ' + g + '</h2>';
    html += '<table class="class-table"><thead><tr><th>Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>GP</th><th>Pts</th></tr></thead><tbody>';
    for (var i = 0; i < tabs[g].length; i++) {
      var t = tabs[g][i];
      html += '<tr><td class="team-cell"><span class="pos">' + (i + 1) + '</span>' + teamLabel(t.team, false) + '</td><td>' + t.j + '</td><td>' + t.v + '</td><td>' + t.e + '</td><td>' + t.d + '</td><td>' + gd(t) + '</td><td>' + t.gp + '</td><td><b>' + t.pts + '</b></td></tr>';
    }
    html += '</tbody></table></div>';
  }
  html += '</div>';
  document.getElementById('class').innerHTML = html;
};
