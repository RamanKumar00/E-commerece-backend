
import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath = path.resolve(__dirname, "../../products.xlsx");

const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

if (data.length > 0) {
  const keys = Object.keys(data[0]);
  console.log("HEADERS_START");
  keys.forEach(k => console.log(k));
  console.log("HEADERS_END");
}
