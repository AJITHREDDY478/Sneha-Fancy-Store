# Apps Script Implementation - Delete All Bills

Add this to your Google Apps Script to enable the "Delete All" bills functionality.

## Update your doPost function

In your Apps Script, find the `doPost` function and add the delete-all action handler:

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type;
    const action = data.action || 'append';
    
    if (type === 'products') {
      if (action === 'upsert') {
        return upsertProducts(data.rows);
      } else if (action === 'delete') {
        return deleteProducts(data.ids);
      } else {
        return appendProducts(data.rows);
      }
    } else if (type === 'bills') {
      if (action === 'deleteAll') {
        return deleteAllBills();
      } else {
        return appendBills(data.rows);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'Invalid request type'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Add the deleteAllBills function

Add this new function to handle deleting all bills:

```javascript
function deleteAllBills() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const billsSheet = ss.getSheetByName('Bills');
    
    if (!billsSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: 'Bills sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get the last row with data
    const lastRow = billsSheet.getLastRow();
    
    // If there's more than just the header row, delete all data rows
    if (lastRow > 1) {
      billsSheet.deleteRows(2, lastRow - 1);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      deleted: lastRow - 1
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Steps to Update

1. Open your Google Apps Script editor
2. Find the `doPost` function
3. Add the `action === 'deleteAll'` handling for bills (see code above)
4. Add the new `deleteAllBills()` function
5. Save the script
6. Deploy as a new version (or use existing deployment URL)

## Notes

- The function deletes all rows EXCEPT the header row (row 1)
- Returns the count of deleted bills
- Works with your existing Bills sheet structure
- No changes needed to your sheet headers or permissions

## Testing

After updating the script:
1. Open your app
2. Go to Bills page
3. Click "Delete All" button
4. Confirm the deletion
5. All bills will be removed from both localStorage and Google Sheets
