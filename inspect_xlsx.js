const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dataDir = 'c:/Users/namvt.PROPERWELL/Documents/PPW/Dropbox/Data';

function inspectFile(filename) {
  const filePath = path.join(dataDir, filename);
  console.log(`\n========================================`);
  console.log(`Inspecting file: ${filename}`);
  console.log(`========================================`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  
  console.log(`Sheets in file:`, wb.SheetNames);
  
  const ACCEPTED = ['outlet', 'mainline', 'cutup'];
  
  for (const shName of wb.SheetNames) {
    if (!ACCEPTED.includes(shName.toLowerCase().trim())) {
      console.log(`Skipping sheet: ${shName}`);
      continue;
    }
    
    console.log(`\n--- Sheet: ${shName} ---`);
    const ws = wb.Sheets[shName];
    if (!ws || !ws['!ref']) {
      console.log(`Empty sheet!`);
      continue;
    }
    
    const range = XLSX.utils.decode_range(ws['!ref']);
    const nrows = range.e.r + 1;
    const ncols = range.e.c + 1;
    console.log(`Range: ${ws['!ref']} (rows: ${nrows}, cols: ${ncols})`);
    
    // Find data start row
    let dataStartRow = 4;
    for (let ri = 3; ri <= 8; ri++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: 1 })];
      if (cell && /^V[A-Z]{2}\d/.test(String(cell.v || ''))) {
        dataStartRow = ri;
        break;
      }
    }
    console.log(`Detected dataStartRow: ${dataStartRow}`);
    
    // Let's print rows 0 to dataStartRow
    console.log(`Header rows (first 40 columns):`);
    for (let r = 0; r < dataStartRow; r++) {
      let rowCells = [];
      for (let c = 0; c < Math.min(ncols, 40); c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        rowCells.push(cell ? String(cell.v ?? '').trim() : '');
      }
      console.log(`Row ${r}:`, rowCells.slice(0, 15).map((v, i) => `[Col ${i}: ${v}]`).join(', '));
      // Log some interesting columns specifically
      const interesting = [18, 19, 20, 21, 27, 28, 32, 33, 34, 35, 36, 37, 38, 39];
      console.log(`  Interesting Cols:`, interesting.map(c => `Col ${c}: "${rowCells[c] || ''}"`).join(' | '));
    }
    
    const testCell5 = ws[XLSX.utils.encode_cell({ r: dataStartRow, c: 5 })];
    const testVal5 = testCell5 ? String(testCell5.v || '').trim() : '';
    const isVersion03 = testVal5.length > 5 && !testVal5.startsWith('=') && testVal5.includes('/');
    console.log(`testVal5 at row ${dataStartRow}, col 5: "${testVal5}"`);
    console.log(`isVersion03: ${isVersion03}`);
    
    // Let's print first 3 data rows to see what is where
    console.log(`Sample data rows (first 3):`);
    let count = 0;
    for (let r = dataStartRow; r < nrows && count < 3; r++) {
      const oNo = ws[XLSX.utils.encode_cell({ r, c: 1 })];
      if (oNo && /^V[A-Z]{2}\d/.test(String(oNo.v || ''))) {
        count++;
        let rowData = {};
        for (let c = 0; c < ncols; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
            rowData[c] = cell.v;
          }
        }
        console.log(`Row ${r} (${oNo.v}):`);
        // Log keys of rowData that are interesting (e.g. 18, 19, 20, 21, 32, 33, 34, 35, 36, 37, 38, 39)
        const displayKeys = [1, 2, 4, 5, 6, 18, 19, 20, 21, 32, 33, 34, 35, 36, 37, 38, 39];
        const filteredData = {};
        displayKeys.forEach(k => {
          if (rowData[k] !== undefined) filteredData[k] = rowData[k];
        });
        console.log(JSON.stringify(filteredData, null, 2));
      }
    }
  }
}

inspectFile('F26 GENERAL MATERIAL TRACKING - LEATHER - 04.21.xlsx');
inspectFile('F26 GENERAL MATERIAL TRACKING - 01.17.xlsx');
