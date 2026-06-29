
var DATA = window.COPA_DATA;
var SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbyc_84DuzwtrrnTWRr2icNYl4_lLbZ53Ipew40bkGs_R9AJMgzsVO-1ln8G6SDOtFEq/exec';
var KEY = 'passalacqua_copa2026_resultados';
var ADMIN_KEY = 'passalacqua_copa2026_admin';
var matches = [];
var editIndex = -1;
var curStatus = 'agendado';
var isAdmin = false;

function init() {
  isAdmin = sessionStorage.getItem(ADMIN_KEY) === '1';
  matches = [];

  for (var i = 0; i < DATA.groupMatches.length; i++) {
    var m = clone(DATA.groupMatches[i]);
    m.type = 'group';
    addSaved(m, null);
    matches.push(m);
  }

  for (var j = 0; j < DATA.koMatches.length; j++) {
    var k = clone(DATA.koMatches[j]);
    k.type = 'ko';
    k.group = '';
    addSaved(k, null);
    matches.push(k);
  }

  updateAdminUI();
  renderAll();
  loadRemoteResults();
}

function clone(o) { var x = {}; for (var k in o) x[k] = o[k]; return x; }
function addSaved(m, saved) {
  var s = saved && saved[m.num] ? saved[m.num] : {};
  m.gA = s.gA == null ? null : s.gA;
  m.gB = s.gB == null ? null : s.gB;
  m.pA = s.pA == null ? null : s.pA;
  m.pB = s.pB == null ? null : s.pB;
  m.status = s.status || 'agendado';
}
function persist() {
  var s = {};
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    s[m.num] = { gA: m.gA, gB: m.gB, pA: m.pA, pB: m.pB, status: m.status };
  }
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e) {}
}

function flagCode(n) { return DATA.teams[n] || ''; }
function flagEmoji(n) { return (DATA.flagEmoji && DATA.flagEmoji[n]) ? DATA.flagEmoji[n] : ''; }
function flagImg(n, extra) {
  var code = flagCode(n);
  if (!code) return '';
  return '<img class="flag-img ' + (extra || '') + '" src="https://flagcdn.com/w80/' + code.toLowerCase() + '.png" alt="' + n + '" loading="lazy">';
}
function isRealTeam(name) { return !!DATA.teams[name]; }
function teamLabel(name, big) {
  if (isRealTeam(name)) return flagImg(name, big ? 'big' : '') + '<span>' + name + '</span>';
  return '<span class="placeholder">' + name + '</span>';
}

function adminLogin() {
  var p = prompt('Senha de administrador:');
  if (p === DATA.adminPassword) {
    sessionStorage.setItem(ADMIN_KEY, '1');
    isAdmin = true;
    updateAdminUI();
    renderAll();
    toast('Modo administrador ativado.');
  } else if (p !== null) alert('Senha incorreta.');
}
function adminLogout() {
  sessionStorage.removeItem(ADMIN_KEY);
  isAdmin = false;
  updateAdminUI();
  renderAll();
  toast('Modo funcionário ativado.');
}
function updateAdminUI() {
  document.getElementById('adminBtn').className = isAdmin ? 'hidden' : '';
  document.getElementById('logoutBtn').className = isAdmin ? '' : 'hidden';
  document.getElementById('clearBtn').className = isAdmin ? 'danger' : 'hidden danger';
  document.getElementById('modeLabel').innerHTML = isAdmin ? 'Administrador' : 'Funcionário';
  document.getElementById('notice').innerHTML = isAdmin ? 'Modo administrador: edição de placares liberada neste navegador.' : 'Modo funcionário: apenas visualização. Para alterar placares, entrar como administrador.';
}

function groupTables() {
  var st = {};
  for (var g in DATA.groups) {
    for (var i = 0; i < DATA.groups[g].length; i++) {
      var n = DATA.groups[g][i];
      st[n] = { team: n, group: g, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 };
    }
  }
  for (var j = 0; j < matches.length; j++) {
    var m = matches[j];
    if (m.type !== 'group' || m.status !== 'encerrado' || m.gA == null || m.gB == null) continue;
    var a = st[m.a], b = st[m.b];
    if (!a || !b) continue;
    a.j++; b.j++;
    a.gp += m.gA; a.gc += m.gB;
    b.gp += m.gB; b.gc += m.gA;
    if (m.gA > m.gB) { a.v++; a.pts += 3; b.d++; }
    else if (m.gB > m.gA) { b.v++; b.pts += 3; a.d++; }
    else { a.e++; b.e++; a.pts++; b.pts++; }
  }
  var tabs = {};
  for (var gr in DATA.groups) {
    tabs[gr] = [];
    for (var k = 0; k < DATA.groups[gr].length; k++) tabs[gr].push(st[DATA.groups[gr][k]]);
    tabs[gr].sort(sortTeam);
  }
  return tabs;
}
function gd(t) { return t.gp - t.gc; }
function sortTeam(a, b) {
  return (b.pts - a.pts) || (gd(b) - gd(a)) || (b.gp - a.gp) || a.team.localeCompare(b.team);
}
function groupComplete(groupId) {
  var total = 0, done = 0;
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    if (m.type === 'group' && m.group === groupId) {
      total++;
      if (m.status === 'encerrado' && m.gA != null && m.gB != null) done++;
    }
  }
  return total === 6 && done === 6;
}
function allGroupsComplete() { for (var g in DATA.groups) if (!groupComplete(g)) return false; return true; }
function bestThirds(tabs) {
  var arr = [];
  for (var g in tabs) if (tabs[g][2]) arr.push(tabs[g][2]);
  arr.sort(sortTeam);
  return arr;
}
function pickThird(pool, used, thirds) {
  if (!allGroupsComplete()) return 'Melhor 3º ' + pool.split('').join('/');
  for (var i = 0; i < thirds.length; i++) {
    var t = thirds[i];
    if (pool.indexOf(t.group) >= 0 && !used[t.group]) { used[t.group] = true; return t.team; }
  }
  return 'Melhor 3º ' + pool.split('').join('/');
}
function resolveRef(ref, used, tabs, thirds) {
  if (ref.charAt(0) === 'W') return winnerOf(parseInt(ref.substring(1), 10)) || 'Vencedor Jogo ' + ref.substring(1);
  if (ref.charAt(0) === 'L') return loserOf(parseInt(ref.substring(1), 10)) || 'Perdedor Jogo ' + ref.substring(1);
  if (ref.charAt(0) === '1') {
    var g1 = ref.charAt(1);
    return groupComplete(g1) && tabs[g1] ? tabs[g1][0].team : '1º Grupo ' + g1;
  }
  if (ref.charAt(0) === '2') {
    var g2 = ref.charAt(1);
    return groupComplete(g2) && tabs[g2] ? tabs[g2][1].team : '2º Grupo ' + g2;
  }
  if (ref.charAt(0) === '3') return pickThird(ref.substring(1), used, thirds);
  return ref;
}
function knockoutNames() {
  var tabs = groupTables(), thirds = bestThirds(tabs), used = {}, map = {};
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    if (m.type !== 'ko') continue;
    map[m.num] = { a: resolveRef(m.aRef, used, tabs, thirds), b: resolveRef(m.bRef, used, tabs, thirds) };
  }
  return map;
}
function winnerOf(num) {
  var m = findMatch(num);
  if (!m || m.status !== 'encerrado' || m.gA == null || m.gB == null) return null;
  var names = m.type === 'ko' ? knockoutNames()[num] : {a: m.a, b: m.b};
  if (m.gA > m.gB) return names.a;
  if (m.gB > m.gA) return names.b;
  if (m.pA != null && m.pB != null) {
    if (m.pA > m.pB) return names.a;
    if (m.pB > m.pA) return names.b;
  }
  return null;
}
function loserOf(num) {
  var m = findMatch(num);
  if (!m || m.status !== 'encerrado' || m.gA == null || m.gB == null) return null;
  var names = m.type === 'ko' ? knockoutNames()[num] : {a: m.a, b: m.b};
  if (m.gA > m.gB) return names.b;
  if (m.gB > m.gA) return names.a;
  if (m.pA != null && m.pB != null) {
    if (m.pA > m.pB) return names.b;
    if (m.pB > m.pA) return names.a;
  }
  return null;
}
function findMatch(num) { for (var i = 0; i < matches.length; i++) if (matches[i].num === num) return matches[i]; return null; }


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

    if (r.pA != null) m.pA = Number(r.pA);
    if (r.pB != null) m.pB = Number(r.pB);
  }

  persist();
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


function renderAll() { renderBrazilBox(); renderClass(); renderGames(); renderKnockout(); renderBracketTree(); }

function renderBrazilBox() {
  var html = '';
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    if ((m.a === 'Brasil' || m.b === 'Brasil') && m.status !== 'encerrado') {
      html = '<span class="label">🇧🇷 Próximo jogo do Brasil</span>' +
        '<div class="brazil-match-line">' +
        '<div class="brazil-team">' + flagImg(m.a, 'big') + '<strong>' + m.a + '</strong></div>' +
        '<div class="versus-pill">×</div>' +
        '<div class="brazil-team">' + flagImg(m.b, 'big') + '<strong>' + m.b + '</strong></div>' +
        '</div>' +
        '<small class="brazil-meta">📅 ' + m.date + ' · 🕒 ' + m.time + ' · 📍 ' + m.city + '</small>';
      break;
    }
  }
  if (!html) html = '<span class="label">🇧🇷 Brasil</span><strong>Todos os jogos da fase de grupos encerrados</strong>';
  document.getElementById('brazilBox').innerHTML = html;
}
function renderClass() {
  var tabs = groupTables(), html = '<div class="grid">';
  for (var g in tabs) {
    html += '<div class="card"><h2>Grupo ' + g + '</h2><table><thead><tr><th>Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>GP</th><th>PTS</th></tr></thead><tbody>';
    for (var i = 0; i < tabs[g].length; i++) {
      var t = tabs[g][i], p = i + 1, pc = p === 1 ? 'p1' : (p === 2 ? 'p2' : (p === 3 ? 'p3' : '')), sgd = gd(t), sc = sgd > 0 ? 'sgpos' : (sgd < 0 ? 'sgneg' : 'sgzero'), qual = p <= 2 ? 'qualify' : '';
      html += '<tr class="' + qual + '"><td><div class="team-cell"><span class="pos ' + pc + '">' + p + '</span>' + flagImg(t.team) + '<b>' + t.team + '</b></div></td><td>' + t.j + '</td><td>' + t.v + '</td><td>' + t.e + '</td><td>' + t.d + '</td><td class="' + sc + '">' + (sgd > 0 ? '+' : '') + sgd + '</td><td>' + t.gp + '</td><td class="pts">' + t.pts + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }
  html += '</div>';
  html += '<div class="card" style="margin-top:14px"><h2>Melhores terceiros</h2><table><thead><tr><th>#</th><th>Seleção</th><th>Grupo</th><th>PTS</th><th>SG</th><th>GP</th><th>Status</th></tr></thead><tbody>';
  var thirds = bestThirds(tabs);
  for (var j = 0; j < thirds.length; j++) {
    var t2 = thirds[j], ok = j < 8 ? 'Classifica' : 'Eliminado', pc2 = j < 8 ? 'qualify' : '';
    html += '<tr class="' + pc2 + '"><td>' + (j + 1) + '</td><td><div class="team-cell">' + flagImg(t2.team) + '<b>' + t2.team + '</b></div></td><td>' + t2.group + '</td><td class="pts">' + t2.pts + '</td><td>' + gd(t2) + '</td><td>' + t2.gp + '</td><td>' + ok + '</td></tr>';
  }
  html += '</tbody></table><div class="small">Critérios aplicados: pontos, saldo, gols pró e ordem alfabética como desempate final provisório.</div></div>';
  document.getElementById('class').innerHTML = html;
}
function renderGames() {
  var html = '', lastDay = '';
  html += '<div class="stage"><h2>Fase de grupos</h2>';
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    if (m.type !== 'group') continue;
    if (lastDay !== m.date) { html += '<div class="day">' + m.date + '</div>'; lastDay = m.date; }
    html += matchHtml(i, m, m.a, m.b);
  }
  html += '</div>';
  document.getElementById('jogos').innerHTML = html;
}
function renderKnockout() {
  var names = knockoutNames(), html = '', current = '';
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    if (m.type !== 'ko') continue;
    if (current !== m.stage) { if (current) html += '</div>'; html += '<div class="stage"><h2>' + m.stage + '</h2>'; current = m.stage; }
    html += matchHtml(i, m, names[m.num].a, names[m.num].b);
  }
  html += '</div><div class="notice">No mata-mata, os confrontos só são preenchidos automaticamente quando os grupos correspondentes estiverem encerrados.</div>';
  document.getElementById('mata').innerHTML = html;
}
function matchHtml(idx, m, a, b) {
  var sc = m.time, st = '', openScore = ' open';
  if (m.status === 'encerrado' && m.gA != null && m.gB != null) {
    sc = m.gA + ' × ' + m.gB;
    if (m.gA === m.gB && m.pA != null && m.pB != null) sc += ' <small>(' + m.pA + '×' + m.pB + ' pen.)</small>';
    st = '<span class="status">ENC.</span>';
    openScore = '';
  } else if (m.status === 'ao_vivo') {
    sc = (m.gA != null && m.gB != null) ? m.gA + ' × ' + m.gB : '? × ?';
    st = '<span class="status live">AO VIVO</span>';
    openScore = '';
  }
  var gr = m.group ? '<span class="num">J' + m.num + ' · G' + m.group + '</span>' : '<span class="num">J' + m.num + '</span>';
  var brazil = (a === 'Brasil' || b === 'Brasil') ? ' brazil' : '';
  var edit = isAdmin ? '<button class="edit" onclick="openMatch(' + idx + ')">⚽ placar</button>' : '';
  return '<div class="match' + brazil + '">' + gr + '<div class="matchbody"><div class="team-game">' + teamLabel(a, true) + '</div><span class="score' + openScore + '">' + sc + '</span><div class="team-game">' + teamLabel(b, true) + '</div></div>' + st + '<span class="meta">' + m.date + ' · ' + m.city + '</span>' + edit + '</div>';
}
function openMatch(idx) {
  if (!isAdmin) { alert('Somente administrador pode alterar placares.'); return; }
  editIndex = idx;
  var m = matches[idx], names = m.type === 'ko' ? knockoutNames()[m.num] : {a: m.a, b: m.b};
  document.getElementById('mtitle').innerHTML = 'Jogo ' + m.num + ' · ' + m.stage + ' · ' + m.date + ' · ' + m.time;
  document.getElementById('fa').innerHTML = flagImg(names.a, 'big');
  document.getElementById('fb').innerHTML = flagImg(names.b, 'big');
  document.getElementById('na').innerHTML = names.a;
  document.getElementById('nb').innerHTML = names.b;
  document.getElementById('ga').value = m.gA == null ? '' : m.gA;
  document.getElementById('gb').value = m.gB == null ? '' : m.gB;
  document.getElementById('pa').value = m.pA == null ? '' : m.pA;
  document.getElementById('pb').value = m.pB == null ? '' : m.pB;
  document.getElementById('penbox').style.display = m.type === 'ko' ? 'flex' : 'none';
  curStatus = m.status || 'agendado';
  setStatus(curStatus);
  document.getElementById('overlay').className = 'overlay open';
}
function setStatus(s) {
  curStatus = s;
  document.getElementById('s0').className = s === 'agendado' ? 'sel' : '';
  document.getElementById('s1').className = s === 'ao_vivo' ? 'sel' : '';
  document.getElementById('s2').className = s === 'encerrado' ? 'sel' : '';
}
function closeModal() { document.getElementById('overlay').className = 'overlay'; }
function saveMatch() {
  var m = matches[editIndex];
  var ga = document.getElementById('ga').value;
  var gb = document.getElementById('gb').value;
  var pa = document.getElementById('pa').value;
  var pb = document.getElementById('pb').value;

  m.gA = ga === '' ? null : parseInt(ga, 10);
  m.gB = gb === '' ? null : parseInt(gb, 10);
  m.pA = pa === '' ? null : parseInt(pa, 10);
  m.pB = pb === '' ? null : parseInt(pb, 10);
  m.status = curStatus;

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
function tab(id) {
  var ids = ['class','jogos','mata'];
  for (var i = 0; i < ids.length; i++) {
    document.getElementById(ids[i]).className = ids[i] === id ? 'section active' : 'section';
    document.getElementById('tab-' + ids[i]).className = ids[i] === id ? 'active' : '';
  }
}

function getYesterdayDateText() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm;
}

function nextBrazilMatch() {
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    if ((m.a === 'Brasil' || m.b === 'Brasil') && m.status !== 'encerrado') return m;
  }
  return null;
}

function copySummary() {
  var targetDate = getYesterdayDateText();
  var tabs = groupTables();
  var games = [];
  var impacted = {};

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    if (m.type === 'group' && m.date === targetDate && m.status === 'encerrado' && m.gA != null && m.gB != null) {
      games.push(m);
      impacted[m.group] = true;
    }
  }

  var txt = '🏆 COPA DO MUNDO 2026 — PASSALACQUA\n\n';
  txt += '📅 Resumo dos jogos de ontem — ' + targetDate + '\n\n';

  if (games.length === 0) {
    txt += 'Ontem não tivemos jogos encerrados na tabela.\n\n';
  } else {
    txt += '⚽ Resultados\n\n';
    for (var g = 0; g < games.length; g++) {
      var jm = games[g];
      txt += flagEmoji(jm.a) + ' ' + jm.a + ' ' + jm.gA + ' x ' + jm.gB + ' ' + jm.b + ' ' + flagEmoji(jm.b) + '\n';
    }
    txt += '\n📊 Classificação atualizada\n';
    for (var groupId in impacted) {
      txt += '\nGrupo ' + groupId + '\n';
      for (var t = 0; t < tabs[groupId].length; t++) {
        var team = tabs[groupId][t];
        txt += (t + 1) + 'º ' + flagEmoji(team.team) + ' ' + team.team + ' — ' + team.pts + ' pts | SG ' + gd(team) + '\n';
      }
    }
    txt += '\n';
  }

  var br = nextBrazilMatch();
  if (br) {
    txt += '🇧🇷 Próximo jogo do Brasil\n';
    txt += br.a + ' x ' + br.b + '\n';
    txt += br.date + ' • ' + br.time + ' • ' + br.city + '\n\n';
  }

  txt += '🔗 Tabela completa:\n' + (DATA.publicUrl || 'https://passalacqua-copa.github.io/copa2026/');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() {
      toast('Resumo de ontem copiado.');
    }, function() {
      alert(txt);
    });
  } else {
    alert(txt);
  }
}

function clearScores() {
  if (!isAdmin) return;
  alert('Agora os resultados ficam salvos na planilha. Para limpar oficialmente, apague os placares na aba Resultados da planilha.');
}
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  else document.exitFullscreen && document.exitFullscreen();
}
function toast(msg) {
  var e = document.getElementById('toast');
  e.innerHTML = msg;
  e.className = 'toast show';
  setTimeout(function() { e.className = 'toast'; }, 2500);
}
window.onload = init;


/* ===== RESUMO DIÁRIO V11 ===== */

function getTodayDateTextV11() {
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm;
}

function getYesterdayDateTextV11() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm;
}

copySummary = function() {
  var yesterday = getYesterdayDateTextV11();
  var today = getTodayDateTextV11();
  var tabs = groupTables();

  var yesterdayGames = [];
  var impacted = {};
  var todayGames = [];

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if (m.type === 'group' && m.date === yesterday && m.status === 'encerrado' && m.gA != null && m.gB != null) {
      yesterdayGames.push(m);
      impacted[m.group] = true;
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
      txt += flagEmoji(jm.a) + ' ' + jm.a + ' ' + jm.gA + ' x ' + jm.gB + ' ' + jm.b + ' ' + flagEmoji(jm.b) + '\n';
    }

    txt += '\n📊 Classificação atualizada\n';

    for (var groupId in impacted) {
      txt += '\nGrupo ' + groupId + '\n';

      for (var t = 0; t < tabs[groupId].length; t++) {
        var team = tabs[groupId][t];
        txt += (t + 1) + 'º ' + flagEmoji(team.team) + ' ' + team.team + ' — ' + team.pts + ' pts | SG ' + gd(team) + '\n';
      }
    }

    txt += '\n';
  }

  txt += '📅 Jogos de hoje — ' + today + '\n\n';

  if (todayGames.length === 0) {
    txt += 'Não há jogos programados para hoje na tabela.\n\n';
  } else {
    for (var j = 0; j < todayGames.length; j++) {
      var hj = todayGames[j];
      txt += flagEmoji(hj.a) + ' ' + hj.a + ' x ' + hj.b + ' ' + flagEmoji(hj.b) + ' — ' + hj.time + '\n';
    }

    txt += '\n';
  }

  var brazilToday = null;

  for (var b = 0; b < todayGames.length; b++) {
    if (todayGames[b].a === 'Brasil' || todayGames[b].b === 'Brasil') {
      brazilToday = todayGames[b];
      break;
    }
  }

  if (brazilToday) {
    txt += '📣 Destaque do dia\n\n';
    txt += '🇧🇷 ' + brazilToday.a + ' x ' + brazilToday.b + '\n';
    txt += brazilToday.time + ' • ' + brazilToday.city + '\n\n';
  } else if (todayGames.length > 0) {
    var main = todayGames[0];
    txt += '🔥 Principal jogo do dia\n\n';
    txt += flagEmoji(main.a) + ' ' + main.a + ' x ' + main.b + ' ' + flagEmoji(main.b) + '\n';
    txt += main.time + ' • ' + main.city + '\n\n';
  } else {
    var br = nextBrazilMatch();

    if (br) {
      txt += '🇧🇷 Próximo jogo do Brasil\n';
      txt += br.a + ' x ' + br.b + '\n';
      txt += br.date + ' • ' + br.time + ' • ' + br.city + '\n\n';
    }
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
};


/* ===== CHAVEAMENTO V13 ===== */

function bracketMatchHtml(m, names) {
  var a = names[m.num] ? names[m.num].a : (m.aRef || '');
  var b = names[m.num] ? names[m.num].b : (m.bRef || '');
  var score = '';

  if (m.status === 'encerrado' && m.gA != null && m.gB != null) {
    score = '<span class="bracket-score">' + m.gA + ' x ' + m.gB + '</span>';
  } else if (m.status === 'ao_vivo') {
    score = '<span class="bracket-score live-score">AO VIVO</span>';
  } else {
    score = '<span class="bracket-score open-score">' + m.time + '</span>';
  }

  var wa = winnerOf(m.num) === a ? ' winner' : '';
  var wb = winnerOf(m.num) === b ? ' winner' : '';

  return '<div class="bracket-match">' +
    '<div class="bracket-num">J' + m.num + '</div>' +
    '<div class="bracket-team' + wa + '">' + teamLabel(a, false) + '</div>' +
    '<div class="bracket-mid">' + score + '</div>' +
    '<div class="bracket-team' + wb + '">' + teamLabel(b, false) + '</div>' +
    '<div class="bracket-meta">' + m.date + ' · ' + m.city + '</div>' +
  '</div>';
}

function renderBracketView() {
  var names = knockoutNames();
  var stages = ['32avos', 'Oitavas', 'Quartas', 'Semifinal', 'Final'];
  var html = '<div class="bracket-wrap">';
  html += '<h2 class="bracket-title">🏆 Chaveamento do mata-mata</h2>';
  html += '<div class="bracket-scroll"><div class="bracket-board">';

  for (var s = 0; s < stages.length; s++) {
    var stage = stages[s];
    html += '<div class="bracket-col">';
    html += '<div class="bracket-stage-title">' + stage + '</div>';

    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      if (m.type === 'ko' && m.stage === stage) {
        html += bracketMatchHtml(m, names);
      }
    }

    html += '</div>';
  }

  html += '</div></div>';
  html += '<div class="small">O chaveamento é preenchido automaticamente conforme os grupos e fases forem encerrados.</div>';
  html += '</div>';
  return html;
}


/* ===== TAB CHAVEAMENTO V14 ===== */
tab = function(id) {
  var ids = ['class','jogos','mata','chave'];

  for (var i = 0; i < ids.length; i++) {
    var sec = document.getElementById(ids[i]);
    var btn = document.getElementById('tab-' + ids[i]);

    if (sec) sec.className = ids[i] === id ? 'section active' : 'section';
    if (btn) btn.className = ids[i] === id ? 'active' : '';
  }
};


/* ===== CHAVEAMENTO EM ÁRVORE V14 ===== */

function bracketTreeTeam(name) {
  if (isRealTeam(name)) return teamLabel(name, false);
  return '<span class="tree-placeholder">' + name + '</span>';
}

function bracketTreeScore(m) {
  if (m.status === 'encerrado' && m.gA != null && m.gB != null) {
    return '<span class="tree-score">' + m.gA + ' x ' + m.gB + '</span>';
  }

  if (m.status === 'ao_vivo') {
    return '<span class="tree-score live-score">AO VIVO</span>';
  }

  return '<span class="tree-score open-score">' + m.time + '</span>';
}

function treeMatch(num, names) {
  var m = findMatch(num);
  if (!m) return '';

  var a = names[num] ? names[num].a : (m.aRef || '');
  var b = names[num] ? names[num].b : (m.bRef || '');
  var w = winnerOf(num);

  var ac = w === a ? ' winner' : '';
  var bc = w === b ? ' winner' : '';

  return '<div class="tree-match" data-jogo="' + num + '">' +
    '<div class="tree-num">J' + num + '</div>' +
    '<div class="tree-team' + ac + '">' + bracketTreeTeam(a) + '</div>' +
    '<div class="tree-versus">' + bracketTreeScore(m) + '</div>' +
    '<div class="tree-team' + bc + '">' + bracketTreeTeam(b) + '</div>' +
    '<div class="tree-meta">' + m.date + ' · ' + m.city + '</div>' +
  '</div>';
}

function renderBracketSide(title, columns, names) {
  var html = '<div class="tree-side">';
  html += '<div class="tree-side-title">' + title + '</div>';
  html += '<div class="tree-columns">';

  for (var c = 0; c < columns.length; c++) {
    html += '<div class="tree-column level-' + c + '">';
    html += '<div class="tree-stage">' + columns[c].title + '</div>';

    for (var i = 0; i < columns[c].matches.length; i++) {
      html += treeMatch(columns[c].matches[i], names);
    }

    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

function renderChampionBox() {
  var champ = winnerOf(104);
  var vice = loserOf(104);

  var html = '<div class="champion-box">';
  html += '<div class="cup">🏆</div>';
  html += '<div class="champion-label">Campeão</div>';

  if (champ) {
    html += '<div class="champion-team">' + bracketTreeTeam(champ) + '</div>';
  } else {
    html += '<div class="champion-team tree-placeholder">A definir</div>';
  }

  if (vice) {
    html += '<div class="vice-team">Vice: ' + vice + '</div>';
  }

  html += '</div>';
  return html;
}

function renderBracketTree() {
  var target = document.getElementById('chave');
  if (!target) return;

  var names = knockoutNames();

  var left = [
    { title: '32 avos', matches: [73,74,75,76,77,78,79,80] },
    { title: 'Oitavas', matches: [89,90,91,92] },
    { title: 'Quartas', matches: [97,99] },
    { title: 'Semifinal', matches: [101] }
  ];

  var right = [
    { title: '32 avos', matches: [81,82,83,84,85,86,87,88] },
    { title: 'Oitavas', matches: [93,94,95,96] },
    { title: 'Quartas', matches: [98,100] },
    { title: 'Semifinal', matches: [102] }
  ];

  var html = '<div class="tree-wrap">';
  html += '<h2 class="tree-title">🏆 Chaveamento da Copa 2026</h2>';
  html += '<p class="tree-subtitle">Simulação automática do caminho até a final, conforme os resultados lançados.</p>';

  html += '<div class="tree-scroll">';
  html += '<div class="tree-board">';
  html += renderBracketSide('Lado esquerdo da chave', left, names);
  html += '<div class="tree-center">';
  html += renderChampionBox();
  html += '<div class="final-box">';
  html += '<div class="tree-stage">Final</div>';
  html += treeMatch(104, names);
  html += '</div>';
  html += '<div class="third-box">';
  html += '<div class="tree-stage">3º lugar</div>';
  html += treeMatch(103, names);
  html += '</div>';
  html += '</div>';
  html += renderBracketSide('Lado direito da chave', right, names);
  html += '</div></div>';

  html += '<div class="small">A chave é preenchida automaticamente conforme os classificados e vencedores forem definidos.</div>';
  html += '</div>';

  target.innerHTML = html;
}


/* ===== CHAVEAMENTO FINAL V15 ===== */

function bracketTreeTeamV15(name) {
  if (isRealTeam(name)) return teamLabel(name, false);
  return '<span class="tree-placeholder">' + name + '</span>';
}

function bracketTreeScoreV15(m) {
  if (m.status === 'encerrado' && m.gA != null && m.gB != null) {
    return '<span class="tree-score">' + m.gA + ' x ' + m.gB + '</span>';
  }

  if (m.status === 'ao_vivo') {
    return '<span class="tree-score live-score">AO VIVO</span>';
  }

  return '<span class="tree-score open-score">' + m.time + '</span>';
}

function treeMatchV15(num, names) {
  var m = findMatch(num);
  if (!m) return '';

  var a = names[num] ? names[num].a : (m.aRef || '');
  var b = names[num] ? names[num].b : (m.bRef || '');
  var w = winnerOf(num);

  var ac = w === a ? ' winner' : '';
  var bc = w === b ? ' winner' : '';

  return '<div class="tree-match" data-jogo="' + num + '">' +
    '<div class="tree-num">J' + num + '</div>' +
    '<div class="tree-team' + ac + '">' + bracketTreeTeamV15(a) + '</div>' +
    '<div class="tree-versus">' + bracketTreeScoreV15(m) + '</div>' +
    '<div class="tree-team' + bc + '">' + bracketTreeTeamV15(b) + '</div>' +
    '<div class="tree-meta">' + m.date + ' · ' + m.city + '</div>' +
  '</div>';
}

function renderBracketSideV15(columns, names, sideClass) {
  var html = '<div class="tree-side ' + sideClass + '">';
  html += '<div class="tree-columns">';

  for (var c = 0; c < columns.length; c++) {
    html += '<div class="tree-column level-' + c + '">';
    html += '<div class="tree-stage">' + columns[c].title + '</div>';

    for (var i = 0; i < columns[c].matches.length; i++) {
      html += treeMatchV15(columns[c].matches[i], names);
    }

    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

function renderChampionBoxV15() {
  var champ = winnerOf(104);
  var vice = loserOf(104);

  var html = '<div class="champion-box champion-box-v15">';
  html += '<div class="cup">🏆</div>';
  html += '<div class="champion-label">Campeão</div>';

  if (champ) {
    html += '<div class="champion-team">' + bracketTreeTeamV15(champ) + '</div>';
  } else {
    html += '<div class="champion-team tree-placeholder">A definir</div>';
  }

  if (vice) {
    html += '<div class="vice-team">Vice: ' + vice + '</div>';
  }

  html += '</div>';
  return html;
}

function renderBracketTree() {
  var target = document.getElementById('chave');
  if (!target) return;

  var names = knockoutNames();

  var left = [
    { title: '32 avos', matches: [73,74,75,76,77,78,79,80] },
    { title: 'Oitavas', matches: [89,90,91,92] },
    { title: 'Quartas', matches: [97,99] },
    { title: 'Semifinal', matches: [101] }
  ];

  /* lado direito invertido: semifinal encostada na final */
  var right = [
    { title: 'Semifinal', matches: [102] },
    { title: 'Quartas', matches: [98,100] },
    { title: 'Oitavas', matches: [93,94,95,96] },
    { title: '32 avos', matches: [81,82,83,84,85,86,87,88] }
  ];

  var html = '<div class="tree-wrap tree-wrap-v15">';
  html += '<h2 class="tree-title">🏆 Chaveamento da Copa 2026</h2>';
  html += '<p class="tree-subtitle">Simulação automática do caminho até a final, conforme os resultados lançados.</p>';

  html += '<div class="tree-scroll">';
  html += '<div class="tree-board tree-board-v15">';
  html += renderBracketSideV15(left, names, 'left-side');

  html += '<div class="tree-center tree-center-v15">';
  html += '<div class="final-box final-box-v15">';
  html += '<div class="tree-stage final-stage">Final</div>';
  html += treeMatchV15(104, names);
  html += '</div>';
  html += renderChampionBoxV15();
  html += '<div class="third-box third-box-v15">';
  html += '<div class="tree-stage">3º lugar</div>';
  html += treeMatchV15(103, names);
  html += '</div>';
  html += '</div>';

  html += renderBracketSideV15(right, names, 'right-side');
  html += '</div></div>';

  html += '<div class="small">A chave é preenchida automaticamente conforme os classificados e vencedores forem definidos.</div>';
  html += '</div>';

  target.innerHTML = html;
}



/* ===== CHAVEAMENTO REVISADO V16 =====
   Sequência corrigida conforme caminho real:
   SF101 = Q97 x Q98
   SF102 = Q99 x Q100
*/

function renderBracketTree() {
  var target = document.getElementById('chave');
  if (!target) return;

  var names = knockoutNames();

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

  html += '<div class="tree-scroll">';
  html += '<div class="tree-board tree-board-v15">';
  html += renderBracketSideV15(left, names, 'left-side');

  html += '<div class="tree-center tree-center-v15">';
  html += '<div class="final-box final-box-v15">';
  html += '<div class="tree-stage final-stage">Final</div>';
  html += treeMatchV15(104, names);
  html += '</div>';
  html += renderChampionBoxV15();
  html += '<div class="third-box third-box-v15">';
  html += '<div class="tree-stage">3º lugar</div>';
  html += treeMatchV15(103, names);
  html += '</div>';
  html += '</div>';

  html += renderBracketSideV15(right, names, 'right-side');
  html += '</div></div>';

  html += '<div class="small">A chave é preenchida automaticamente conforme os classificados e vencedores forem definidos.</div>';
  html += '</div>';

  target.innerHTML = html;
}


/* ===== CHAVEAMENTO MOBILE ZOOM V17 ===== */

function renderBracketTree() {
  var target = document.getElementById('chave');
  if (!target) return;

  var names = knockoutNames();

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

  html += '<div class="tree-scroll pinch-area" id="bracketViewport">';
  html += '<div class="tree-board tree-board-v15" id="bracketBoard">';
  html += renderBracketSideV15(left, names, 'left-side');

  html += '<div class="tree-center tree-center-v15">';
  html += '<div class="final-box final-box-v15">';
  html += '<div class="tree-stage final-stage">Final</div>';
  html += treeMatchV15(104, names);
  html += '</div>';
  html += renderChampionBoxV15();
  html += '<div class="third-box third-box-v15">';
  html += '<div class="tree-stage">3º lugar</div>';
  html += treeMatchV15(103, names);
  html += '</div>';
  html += '</div>';

  html += renderBracketSideV15(right, names, 'right-side');
  html += '</div></div>';

  html += '<div class="small">A chave é preenchida automaticamente conforme os classificados e vencedores forem definidos.</div>';
  html += '</div>';

  target.innerHTML = html;

  setTimeout(setupBracketMobileZoom, 50);
}

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

  var estimatedHeight = Math.max(520, Math.min(760, (board.scrollHeight || 1300) * bracketZoomState.scale + 30));
  viewport.style.height = estimatedHeight + 'px';

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

  window.addEventListener('resize', function() {
    setTimeout(fitBracketToMobile, 100);
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


/* ===== MATA-MATA CORRIGIDO V18 =====
   Round of 32 confirmado no data-v18.js.
   Chaveamento corrigido conforme os cruzamentos:
   M97 = M89 x M90; M98 = M93 x M94; M99 = M91 x M92; M100 = M95 x M96.
*/

function renderBracketTree() {
  var target = document.getElementById('chave');
  if (!target) return;

  var names = knockoutNames();

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

  html += '<div class="tree-scroll pinch-area" id="bracketViewport">';
  html += '<div class="tree-board tree-board-v15" id="bracketBoard">';
  html += renderBracketSideV15(left, names, 'left-side');

  html += '<div class="tree-center tree-center-v15">';
  html += '<div class="final-box final-box-v15">';
  html += '<div class="tree-stage final-stage">Final</div>';
  html += treeMatchV15(104, names);
  html += '</div>';
  html += renderChampionBoxV15();
  html += '<div class="third-box third-box-v15">';
  html += '<div class="tree-stage">3º lugar</div>';
  html += treeMatchV15(103, names);
  html += '</div>';
  html += '</div>';

  html += renderBracketSideV15(right, names, 'right-side');
  html += '</div></div>';

  html += '<div class="small">A chave é preenchida automaticamente conforme os vencedores forem definidos.</div>';
  html += '</div>';

  target.innerHTML = html;

  setTimeout(setupBracketMobileZoom, 50);
}


/* ===== MATA-MATA ESTÁVEL V24 =====
   Correção sem depender da montagem antiga:
   1) Renderiza a aba Mata-mata normalmente.
   2) Depois injeta o botão de placar nos jogos 73 a 104 quando estiver em Admin.
   3) O botão usa data-idx, abre o modal e salva na planilha.
*/

function isAdminActiveV24() {
  return isAdmin === true || sessionStorage.getItem(ADMIN_KEY) === '1';
}

function getKoIndexesV24() {
  var arr = [];
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].type === 'ko') arr.push(i);
  }
  return arr;
}

function injectKoButtonsV24() {
  var mata = document.getElementById('mata');
  if (!mata) return;

  var existing = mata.querySelectorAll('.ko-edit-v24');
  for (var e = 0; e < existing.length; e++) existing[e].remove();

  if (!isAdminActiveV24()) return;

  var rows = mata.querySelectorAll('.match');
  var koIndexes = getKoIndexesV24();

  for (var i = 0; i < rows.length && i < koIndexes.length; i++) {
    var row = rows[i];
    var idx = koIndexes[i];

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'edit ko-edit-v24';
    btn.textContent = '⚽ placar';
    btn.setAttribute('data-idx', String(idx));
    btn.onclick = function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      openMatchV24(parseInt(this.getAttribute('data-idx'), 10));
    };

    row.appendChild(btn);
  }
}

function safeSetHtmlV24(id, value) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = value == null ? '' : value;
}

function safeSetValueV24(id, value) {
  var el = document.getElementById(id);
  if (el) el.value = value == null ? '' : value;
}

function openMatchV24(idx) {
  if (!isAdminActiveV24()) {
    alert('Somente administrador pode alterar placares.');
    return;
  }

  if (idx == null || idx < 0 || !matches[idx]) {
    alert('Jogo não encontrado.');
    return;
  }

  editIndex = idx;
  var m = matches[idx];

  var names;
  if (m.type === 'ko') {
    var allNames = knockoutNames();
    names = allNames[m.num] || { a: m.aRef || '', b: m.bRef || '' };
  } else {
    names = { a: m.a, b: m.b };
  }

  safeSetHtmlV24('mtitle', 'Jogo ' + m.num + ' · ' + (m.stage || ('Grupo ' + (m.group || ''))) + ' · ' + m.date + ' · ' + m.time);
  safeSetHtmlV24('fa', isRealTeam(names.a) ? flagImg(names.a, 'big') : '');
  safeSetHtmlV24('fb', isRealTeam(names.b) ? flagImg(names.b, 'big') : '');
  safeSetHtmlV24('na', names.a);
  safeSetHtmlV24('nb', names.b);

  safeSetValueV24('ga', m.gA);
  safeSetValueV24('gb', m.gB);
  safeSetValueV24('pa', m.pA);
  safeSetValueV24('pb', m.pB);

  var penbox = document.getElementById('penbox');
  if (penbox) penbox.style.display = m.type === 'ko' ? 'flex' : 'none';

  curStatus = m.status || 'agendado';

  try { setStatus(curStatus); } catch(e) {}

  var overlay = document.getElementById('overlay');
  if (overlay) overlay.className = 'overlay open';
}

function saveRemoteResultV24(m) {
  return new Promise(function(resolve, reject) {
    var cbName = 'copaSaveCallbackV24_' + Date.now();

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

var originalSaveMatchV24 = saveMatch;
saveMatch = function() {
  if (editIndex < 0 || !matches[editIndex]) {
    alert('Nenhum jogo selecionado.');
    return;
  }

  var m = matches[editIndex];

  var ga = document.getElementById('ga').value;
  var gb = document.getElementById('gb').value;
  var pa = document.getElementById('pa') ? document.getElementById('pa').value : '';
  var pb = document.getElementById('pb') ? document.getElementById('pb').value : '';

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

  saveRemoteResultV24(m).then(function() {
    toast('Resultado salvo na planilha.');
    setTimeout(loadRemoteResults, 800);
  }).catch(function(err) {
    console.error(err);
    toast('Falha ao salvar na planilha.');
  });
};

var originalRenderKnockoutV24 = renderKnockout;
renderKnockout = function() {
  originalRenderKnockoutV24();
  injectKoButtonsV24();
};

var originalRenderAllV24 = renderAll;
renderAll = function() {
  originalRenderAllV24();
  injectKoButtonsV24();
};

var originalUpdateAdminUIV24 = updateAdminUI;
updateAdminUI = function() {
  originalUpdateAdminUIV24();
  setTimeout(injectKoButtonsV24, 20);
};
