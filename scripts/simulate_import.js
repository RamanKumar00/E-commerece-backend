
import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath = path.resolve(__dirname, "../../products.xlsx");

const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

let productsToInsert = [];
for (const row of data) {
    const productName = row["Item name*"] || row["Item name"] || row["Product Name"];
    if (!productName) continue;

    const stock = parseInt(row["Current stock quantity"] || row["Stock"] || 0);
    productsToInsert.push({ name: productName, stock: stock });
}

console.log(`TOTAL_INSERTABLE: ${productsToInsert.length}`);
console.log("FIRST_5_STOCKS:");
productsToInsert.slice(0, 5).forEach(p => console.log(`${p.name}: ${p.stock}`));
