/**
 * Google Apps Script — Thu thập RSVP & Đồng bộ Sổ Lưu Bút Thiệp Kỷ Yếu K28
 *
 * Cách triển khai (miễn phí, 2 phút):
 * 1. Tạo một Google Sheet mới, đặt tên sheet đầu tiên là "RSVP" với hàng tiêu đề:
 *    timestamp | name | attending | guests | wish
 * 2. Vào menu Extensions -> Apps Script, dán toàn bộ file này vào Code.gs và Lưu.
 * 3. Chọn Deploy -> New deployment -> Type: Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy URL Web App nhận được và dán vào "rsvp.webhookUrl" trong public/data/invitation.json.
 */

const SHEET_NAME = 'RSVP';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['timestamp', 'name', 'attending', 'guests', 'wish']);
  }
  return sheet;
}

function doGet() {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  const entries = [];

  for (let i = Math.max(1, rows.length - 50); i < rows.length; i++) {
    const [timestamp, name, attending, guests, wish] = rows[i];
    if (!name) continue;
    entries.push({
      timestamp: String(timestamp || ''),
      name: String(name),
      attending: String(attending || 'yes'),
      guests: Number(guests) || 1,
      wish: String(wish || ''),
    });
  }

  entries.reverse();
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, entries }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const name = String(data.name || '').trim().slice(0, 120);
    if (!name) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Missing name' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getOrCreateSheet();
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      name,
      String(data.attending || 'yes'),
      Math.max(1, Math.min(10, Number(data.guests) || 1)),
      String(data.wish || '').trim().slice(0, 500),
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
