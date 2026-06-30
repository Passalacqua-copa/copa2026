const SHEET_NAME = 'Resultados';
const TOKEN = 'PassaCopa26';

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.getRange('A1:F1').setValues([['Jogo','Gols A','Gols B','Status','Pen A','Pen B']]);
  for (let i = 1; i <= 104; i++) sh.getRange(i + 1, 1).setValue(i);
}

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback;
  const data = action === 'save' ? saveResult_(e) : readResults_();
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function saveResult_(e) {
  if (e.parameter.token !== TOKEN) return {ok:false,error:'Token inválido'};
  const jogo = Number(e.parameter.jogo);
  if (!jogo || jogo < 1 || jogo > 104) return {ok:false,error:'Jogo inválido'};
  const sh = getSheet_();
  const row = jogo + 1;
  sh.getRange(row,1).setValue(jogo);
  sh.getRange(row,2).setValue(valueOrBlank_(e.parameter.golsA));
  sh.getRange(row,3).setValue(valueOrBlank_(e.parameter.golsB));
  sh.getRange(row,4).setValue(e.parameter.status || 'agendado');
  const penA = e.parameter.pA !== undefined ? e.parameter.pA : e.parameter.penA;
  const penB = e.parameter.pB !== undefined ? e.parameter.pB : e.parameter.penB;
  sh.getRange(row,5).setValue(valueOrBlank_(penA));
  sh.getRange(row,6).setValue(valueOrBlank_(penB));
  return {ok:true};
}

function readResults_() {
  const sh = getSheet_();
  const values = sh.getRange(2,1,104,6).getValues();
  const results = {};
  values.forEach(row => {
    const jogo = Number(row[0]);
    if (!jogo) return;
    results[jogo] = {
      gA: row[1] === '' ? null : Number(row[1]),
      gB: row[2] === '' ? null : Number(row[2]),
      status: row[3] || 'agendado',
      pA: row[4] === '' ? null : Number(row[4]),
      pB: row[5] === '' ? null : Number(row[5])
    };
  });
  return {ok:true, results};
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { setup(); sh = ss.getSheetByName(SHEET_NAME); }
  ensureHeader_(sh);
  return sh;
}

function ensureHeader_(sh) {
  const expected = ['Jogo','Gols A','Gols B','Status','Pen A','Pen B'];
  sh.getRange('A1:F1').setValues([expected]);
  for (let i = 1; i <= 104; i++) {
    const c = sh.getRange(i + 1, 1);
    if (!c.getValue()) c.setValue(i);
  }
}

function valueOrBlank_(v) {
  if (v === undefined || v === null || v === '') return '';
  return Number(v);
}
