function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById('1BlPwtkumqhEkhSs55Uj0QY7ILI4HH7SyIlWE29dqmlU');
    var products = getSheetData_(ss, 'Products');
    var bills = getSheetData_(ss, 'Bills');

    var payload = {
      ok: true,
      products: products,
      bills: bills
    };

    return json_(payload);
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.openById('1BlPwtkumqhEkhSs55Uj0QY7ILI4HH7SyIlWE29dqmlU');
    var body = JSON.parse(e.postData.contents || '{}');
    var type = body.type;
    var rows = body.rows || [];
    var action = body.action || 'append';
    var ids = body.ids || [];

    if (!type) {
      return json_({ ok: false, error: 'Invalid payload' });
    }

    if (type !== 'products' && type !== 'bills') {
      return json_({ ok: false, error: 'Invalid type' });
    }

    var sheetName = type === 'products' ? 'Products' : 'Bills';
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return json_({ ok: false, error: 'Sheet not found: ' + sheetName });
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Handle deleteAll action for bills
    if (action === 'deleteAll' && type === 'bills') {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return json_({ ok: true, deleted: lastRow - 1 });
    }

    // Handle delete action
    if (action === 'delete') {
      var idIndex = headers.indexOf('Id');
      if (idIndex === -1) return json_({ ok: false, error: 'Id column not found' });

      var data = sheet.getDataRange().getValues();
      for (var i = data.length - 1; i >= 1; i--) {
        var rowId = data[i][idIndex];
        if (ids.indexOf(String(rowId)) !== -1) {
          sheet.deleteRow(i + 1);
        }
      }
      return json_({ ok: true, deleted: ids.length });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return json_({ ok: false, error: 'Invalid rows' });
    }

    // Handle upsert action
    if (action === 'upsert') {
      var idIndexUpsert = headers.indexOf('Id');
      if (idIndexUpsert === -1) return json_({ ok: false, error: 'Id column not found' });

      var existing = sheet.getDataRange().getValues();
      var rowMap = {};
      for (var r = 1; r < existing.length; r++) {
        var existingId = String(existing[r][idIndexUpsert]);
        rowMap[existingId] = r + 1;
      }

      rows.forEach(function (row) {
        var rowId = String(row['Id']);
        var values = headers.map(function (h) {
          return row[h] !== undefined ? row[h] : '';
        });
        if (rowMap[rowId]) {
          sheet.getRange(rowMap[rowId], 1, 1, values.length).setValues([values]);
        } else {
          sheet.appendRow(values);
        }
      });

      return json_({ ok: true, upserted: rows.length });
    }

    // Default append with duplicate checking for bills
    if (type === 'bills') {
      var billNumberIndex = headers.indexOf('Bill Number');
      if (billNumberIndex === -1) {
        return json_({ ok: false, error: 'Bill Number column not found' });
      }

      // Get existing bill numbers
      var existingData = sheet.getDataRange().getValues();
      var existingBillNumbers = {};
      for (var i = 1; i < existingData.length; i++) {
        var billNum = String(existingData[i][billNumberIndex] || '').trim();
        if (billNum) {
          existingBillNumbers[billNum] = true;
        }
      }

      // Filter out duplicates
      var newRows = rows.filter(function (row) {
        var billNum = String(row['Bill Number'] || '').trim();
        return billNum && !existingBillNumbers[billNum];
      });

      if (newRows.length === 0) {
        return json_({ ok: true, appended: 0, message: 'No new bills to append (all duplicates)' });
      }

      var values = newRows.map(function (row) {
        return headers.map(function (h) {
          return row[h] !== undefined ? row[h] : '';
        });
      });

      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
      return json_({ ok: true, appended: values.length, skipped: rows.length - newRows.length });
    }

    // Default append for products (no duplicate checking)
    var values = rows.map(function (row) {
      return headers.map(function (h) {
        return row[h] !== undefined ? row[h] : '';
      });
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);

    return json_({ ok: true, appended: values.length });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function getSheetData_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  return data.slice(1).filter(function (r) {
    return r.some(function (cell) { return cell !== '' && cell !== null; });
  }).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      obj[h] = row[i];
    });
    return obj;
  });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
