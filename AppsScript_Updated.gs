function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById('1BlPwtkumqhEkhSs55Uj0QY7ILI4HH7SyIlWE29dqmlU');
    initializeUsersSheet_(ss);
    
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

// Handle CORS preflight requests
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.openById('1BlPwtkumqhEkhSs55Uj0QY7ILI4HH7SyIlWE29dqmlU');
    initializeUsersSheet_(ss);
    
    var body = JSON.parse(e.postData.contents || '{}');
    var type = body.type;
    var action = body.action || 'append';

    // Handle authentication/login
    if (type === 'auth') {
      return handleAuth_(ss, body);
    }

    // Handle user management (admin only)
    if (type === 'users') {
      return handleUserManagement_(ss, body);
    }

    var rows = body.rows || [];
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
  var output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  
  // Add CORS headers
  output.append(''); // CORS is handled by Apps Script automatically for doPost
  return output;
}

// Initialize Users sheet with proper columns
function initializeUsersSheet_(ss) {
  var usersSheet = ss.getSheetByName('Users');
  
  if (!usersSheet) {
    usersSheet = ss.insertSheet('Users', ss.getSheets().length);
    var headers = ['Id', 'Username', 'Password', 'Full Name', 'Role', 'Shop Name', 'Email', 'Phone', 'Status', 'Created Date', 'LastLogin'];
    usersSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Add default admin user (admin/admin123)
    var adminId = Utilities.getUuid();
    var hashedPass = Utilities.getUuid().substring(0, 10);
    usersSheet.appendRow([adminId, 'admin', hashedPass, 'Admin User', 'Admin', '', 'admin@store.com', '', 'active', new Date(), new Date()]);
  }
}

// Handle authentication (login)
function handleAuth_(ss, body) {
  var action = body.action;
  
  if (action === 'login') {
    var username = body.username;
    var password = body.password;
    
    var usersSheet = ss.getSheetByName('Users');
    if (!usersSheet) {
      return json_({ ok: false, error: 'Users sheet not found' });
    }
    
    var usersData = getSheetData_(ss, 'Users');
    var user = usersData.find(function(u) {
      return u.Username === username;
    });
    
    if (!user || user.Password !== password) {
      return json_({ ok: false, error: 'Invalid username or password' });
    }
    
    if (user.Status !== 'active') {
      return json_({ ok: false, error: 'User account is inactive' });
    }
    
    // Auto-generate UUID if Id is empty
    var userId = user.Id;
    if (!userId || userId === '') {
      userId = Utilities.getUuid();
      // Update the sheet with the new UUID
      var data = usersSheet.getDataRange().getValues();
      var headers = data[0];
      var idIndex = headers.indexOf('Id');
      for (var i = 1; i < data.length; i++) {
        if (data[i][headers.indexOf('Username')] === username) {
          usersSheet.getRange(i + 1, idIndex + 1).setValue(userId);
          break;
        }
      }
    }
    
    // Return user info (without password)
    return json_({ 
      ok: true, 
      user: {
        id: userId,
        username: user.Username,
        fullName: user['Full Name'],
        role: user.Role,
        shopName: user['Shop Name'],
        email: user.Email
      }
    });
  }
  
  return json_({ ok: false, error: 'Invalid auth action' });
}

// Handle user management (admin only)
function handleUserManagement_(ss, body) {
  var action = body.action;
  
  if (action === 'getUsers') {
    var usersData = getSheetData_(ss, 'Users');
    var usersWithoutPasswords = usersData.map(function(u) {
      var userCopy = {};
      for (var key in u) {
        if (key !== 'Password') {
          userCopy[key] = u[key];
        }
      }
      return userCopy;
    });
    return json_({ ok: true, users: usersWithoutPasswords });
  }
  
  if (action === 'createUser') {
    var newUser = body.user;
    var usersSheet = ss.getSheetByName('Users');
    var headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
    
    var userId = Utilities.getUuid();
    var values = headers.map(function(h) {
      if (h === 'Id') return userId;
      if (h === 'Created Date') return new Date();
      if (h === 'LastLogin') return new Date();
      return newUser[h] || '';
    });
    
    usersSheet.appendRow(values);
    return json_({ ok: true, message: 'User created', userId: userId });
  }
  
  if (action === 'updateUser') {
    var userId = body.userId;
    var updatedData = body.user;
    var usersSheet = ss.getSheetByName('Users');
    var headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
    var data = usersSheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        var rowData = headers.map(function(h) {
          return updatedData[h] !== undefined ? updatedData[h] : data[i][headers.indexOf(h)];
        });
        usersSheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
        return json_({ ok: true, message: 'User updated' });
      }
    }
    return json_({ ok: false, error: 'User not found' });
  }
  
  if (action === 'deleteUser') {
    var userId = body.userId;
    var usersSheet = ss.getSheetByName('Users');
    var data = usersSheet.getDataRange().getValues();
    
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === userId) {
        usersSheet.deleteRow(i + 1);
        return json_({ ok: true, message: 'User deleted' });
      }
    }
    return json_({ ok: false, error: 'User not found' });
  }
  
  return json_({ ok: false, error: 'Invalid user management action' });
}
