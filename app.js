
var DATA = window.COPA_DATA;
var KEY = 'passalacqua_copa2026_resultados';
var ADMIN_KEY = 'passalacqua_copa2026_admin';
var matches = [];
var editIndex = -1;
var curStatus = 'agendado';
var isAdmin = false;

function init() {
  isAdmin = sessionStorage.getItem(ADMIN_KEY) === '1';
  var saved = null;

  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch(e) {
    saved = null;
  }

  matches = [];

  for (var i = 0; i < DATA.groupMatches.length; i++) {
    var m = clone(DATA.groupMatches[i]);
    m.type = 'group';
    addSaved(m, saved);
    matches.push(m);
  }

  for (var j = 0; j < DATA.koMatches.length; j++) {
    var k = clone(DATA.koMatches[j]);
    k.type = 'ko';
    k.group = '';
    addSaved(k, saved);
    matches.push(k);
  }

  updateAdminUI();
  renderAll();
}

function clone(o) {
  var x = {};
  for (var k in o) x[k] = o[k];
  return x;
}

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

function flag(n) {
  return DATA.teams[n] || '';
}

function flagSpan(n, extra) {
  var fl = flag(n);
  if (!fl) return '';
  return '<span class="flag ' + (extra || '') + '">' + fl + '</span>';
}

function isRealTeam(name) {
  return !!DATA.teams[name];
}

function teamLabel(name, big) {
  if (isRealTeam(name)) {
    return flagSpan(name, big ? 'big' : '') + '<span>' + name + '</span>';
  }
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
  } else if (p !== null) {
    alert('Senha incorreta.');
  }
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
  document.getElementById('notice').innerHTML = isAdmin
    ? 'Modo administrador: edição de placares liberada neste navegador.'
    : 'Modo funcionário: apenas visualização. Para alterar placares, entrar como administrador.';
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

    if (m.type !== 'group' || m.status !== 'encerrado' || m.gA == null || m.gB == null) {
      continue;
    }

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

function gd(t) {
  return t.gp - t.gc;
}

function sortTeam(a, b) {
  return (b.pts - a.pts) ||
    (gd(b) - gd(a)) ||
    (b.gp - a.gp) ||
    a.team.localeCompare(b.team);
}

function groupComplete(groupId) {
  var total = 0;
  var done = 0;

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if (m.type === 'group' && m.group === groupId) {
      total++;

      if (m.status === 'encerrado' && m.gA != null && m.gB != null) {
        done++;
      }
    }
  }

  return total === 6 && done === 6;
}

function allGroupsComplete() {
  for (var g in DATA.groups) {
    if (!groupComplete(g)) return false;
  }

  return true;
}

function bestThirds(tabs) {
  var arr = [];

  for (var g in tabs) {
    if (tabs[g][2]) arr.push(tabs[g][2]);
  }

  arr.sort(sortTeam);
  return arr;
}

function pickThird(pool, used, thirds) {
  if (!allGroupsComplete()) {
    return 'Melhor 3º ' + pool.split('').join('/');
  }

  for (var i = 0; i < thirds.length; i++) {
    var t = thirds[i];

    if (pool.indexOf(t.group) >= 0 && !used[t.group]) {
      used[t.group] = true;
      return t.team;
    }
  }

  return 'Melhor 3º ' + pool.split('').join('/');
}

function resolveRef(ref, used, tabs, thirds) {
  if (ref.charAt(0) === 'W') {
    return winnerOf(parseInt(ref.substring(1), 10)) || 'Vencedor Jogo ' + ref.substring(1);
  }

  if (ref.charAt(0) === 'L') {
    return loserOf(parseInt(ref.substring(1), 10)) || 'Perdedor Jogo ' + ref.substring(1);
  }

  if (ref.charAt(0) === '1') {
    var g1 = ref.charAt(1);
    return groupComplete(g1) && tabs[g1] ? tabs[g1][0].team : '1º Grupo ' + g1;
  }

  if (ref.charAt(0) === '2') {
    var g2 = ref.charAt(1);
    return groupComplete(g2) && tabs[g2] ? tabs[g2][1].team : '2º Grupo ' + g2;
  }

  if (ref.charAt(0) === '3') {
    return pickThird(ref.substring(1), used, thirds);
  }

  return ref;
}

function knockoutNames() {
  var tabs = groupTables();
  var thirds = bestThirds(tabs);
  var used = {};
  var map = {};

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if (m.type !== 'ko') continue;

    map[m.num] = {
      a: resolveRef(m.aRef, used, tabs, thirds),
      b: resolveRef(m.bRef, used, tabs, thirds)
    };
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

function findMatch(num) {
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].num === num) return matches[i];
  }

  return null;
}

function renderAll() {
  renderBrazilBox();
  renderClass();
  renderGames();
  renderKnockout();
}

function renderBrazilBox() {
  var html = '';

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if ((m.a === 'Brasil' || m.b === 'Brasil') && m.status !== 'encerrado') {
      html =
        '<span>🇧🇷 Próximo jogo do Brasil</span>' +
        '<div class="brazil-match-line">' +
          '<div class="brazil-team">' + flagSpan(m.a, 'big') + '<strong>' + m.a + '</strong></div>' +
          '<div class="versus-pill">×</div>' +
          '<div class="brazil-team">' + flagSpan(m.b, 'big') + '<strong>' + m.b + '</strong></div>' +
        '</div>' +
        '<small class="brazil-meta">📅 ' + m.date + ' · 🕒 ' + m.time + ' · 📍 ' + m.city + '</small>';

      break;
    }
  }

  if (!html) {
    html =
      '<span>🇧🇷 Brasil</span>' +
      '<strong>Todos os jogos da fase de grupos encerrados</strong>';
  }

  document.getElementById('brazilBox').innerHTML = html;
}

function renderClass() {
  var tabs = groupTables();
  var html = '<div class="grid">';

  for (var g in tabs) {
    html += '<div class="card"><h2>Grupo ' + g + '</h2>';
    html += '<table><thead><tr><th>Seleção</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>GP</th><th>PTS</th></tr></thead><tbody>';

    for (var i = 0; i < tabs[g].length; i++) {
      var t = tabs[g][i];
      var p = i + 1;
      var pc = p === 1 ? 'p1' : (p === 2 ? 'p2' : (p === 3 ? 'p3' : ''));
      var sgd = gd(t);
      var sc = sgd > 0 ? 'sgpos' : (sgd < 0 ? 'sgneg' : 'sgzero');
      var qual = p <= 2 ? 'qualify' : '';

      html += '<tr class="' + qual + '">';
      html += '<td><div class="team-cell"><span class="pos ' + pc + '">' + p + '</span>' + flagSpan(t.team) + '<b>' + t.team + '</b></div></td>';
      html += '<td>' + t.j + '</td><td>' + t.v + '</td><td>' + t.e + '</td><td>' + t.d + '</td>';
      html += '<td class="' + sc + '">' + (sgd > 0 ? '+' : '') + sgd + '</td>';
      html += '<td>' + t.gp + '</td><td class="pts">' + t.pts + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table></div>';
  }

  html += '</div>';
  html += '<div class="card" style="margin-top:14px"><h2>Melhores terceiros</h2>';
  html += '<table><thead><tr><th>#</th><th>Seleção</th><th>Grupo</th><th>PTS</th><th>SG</th><th>GP</th><th>Status</th></tr></thead><tbody>';

  var thirds = bestThirds(tabs);

  for (var j = 0; j < thirds.length; j++) {
    var t2 = thirds[j];
    var ok = j < 8 ? 'Classifica' : 'Eliminado';
    var pc2 = j < 8 ? 'qualify' : '';

    html += '<tr class="' + pc2 + '">';
    html += '<td>' + (j + 1) + '</td>';
    html += '<td><div class="team-cell">' + flagSpan(t2.team) + '<b>' + t2.team + '</b></div></td>';
    html += '<td>' + t2.group + '</td><td class="pts">' + t2.pts + '</td><td>' + gd(t2) + '</td><td>' + t2.gp + '</td><td>' + ok + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table><div class="small">Critérios aplicados: pontos, saldo, gols pró e ordem alfabética como desempate final provisório.</div></div>';

  document.getElementById('class').innerHTML = html;
}

function renderGames() {
  var html = '';
  var lastDay = '';

  html += '<div class="stage"><h2>Fase de grupos</h2>';

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];

    if (m.type !== 'group') continue;

    if (lastDay !== m.date) {
      html += '<div class="day">' + m.date + '</div>';
      lastDay = m.date;
    }

    html += matchHtml(i, m, m.a, m.b);
  }

  html += '</div>';

  document.getElementById('jogos').innerHTML = html;
}

function renderKnockout() {
  var names = knockoutNames();
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

    html += matchHtml(i, m, names[m.num].a, names[m.num].b);
  }

  html += '</div>';
  html += '<div class="notice">No mata-mata, os confrontos só são preenchidos automaticamente quando os grupos correspondentes estiverem encerrados.</div>';

  document.getElementById('mata').innerHTML = html;
}

function matchHtml(idx, m, a, b) {
  var sc = m.time;
  var st = '';
  var openScore = ' open';

  if (m.status === 'encerrado' && m.gA != null && m.gB != null) {
    sc = m.gA + ' × ' + m.gB;

    if (m.gA === m.gB && m.pA != null && m.pB != null) {
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
  var edit = isAdmin ? '<button class="edit" onclick="openMatch(' + idx + ')">⚽ placar</button>' : '';

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

function openMatch(idx) {
  if (!isAdmin) {
    alert('Somente administrador pode alterar placares.');
    return;
  }

  editIndex = idx;
  var m = matches[idx];
  var names = m.type === 'ko' ? knockoutNames()[m.num] : {a: m.a, b: m.b};

  document.getElementById('mtitle').innerHTML = 'Jogo ' + m.num + ' · ' + m.stage + ' · ' + m.date + ' · ' + m.time;
  document.getElementById('fa').innerHTML = flag(names.a);
  document.getElementById('fb').innerHTML = flag(names.b);
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

function closeModal() {
  document.getElementById('overlay').className = 'overlay';
}

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
  toast('Resultado salvo.');
}

function tab(id) {
  var ids = ['class','jogos','mata'];

  for (var i = 0; i < ids.length; i++) {
    document.getElementById(ids[i]).className = ids[i] === id ? 'section active' : 'section';
    document.getElementById('tab-' + ids[i]).className = ids[i] === id ? 'active' : '';
  }
}

function copySummary() {
  var tabs = groupTables();
  var txt = '🏆 Copa 2026 — Passalacqua\\n';

  for (var g in tabs) {
    txt += '\\nGrupo ' + g + '\\n';

    for (var i = 0; i < tabs[g].length; i++) {
      var t = tabs[g][i];
      txt += (i + 1) + 'º ' + flag(t.team) + ' ' + t.team + ' — ' + t.pts + ' pts | SG ' + gd(t) + '\\n';
    }
  }

  var f = winnerOf(104);

  if (f) {
    txt += '\\n🏆 Campeão: ' + flag(f) + ' ' + f + '\\n';
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() {
      toast('Resumo copiado.');
    }, function() {
      alert(txt);
    });
  } else {
    alert(txt);
  }
}

function clearScores() {
  if (!isAdmin) return;

  if (!confirm('Apagar todos os placares salvos neste navegador?')) return;

  try {
    localStorage.removeItem(KEY);
  } catch(e) {}

  init();
  toast('Placares apagados.');
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
  e.innerHTML = msg;
  e.className = 'toast show';

  setTimeout(function() {
    e.className = 'toast';
  }, 2500);
}

window.onload = init;
