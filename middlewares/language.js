import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load locales synchronously on startup
const locales = {
  en: JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en.json'), 'utf-8')),
  hi: JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/hi.json'), 'utf-8')),
};

export const languageMiddleware = (req, res, next) => {
  // 1. Detect language from Header (Priority 1)
  let lang = req.headers['accept-language'] || 'en';
  
  // Normalize "en-US,en;q=0.9" -> "en"
  if (lang.indexOf(',') > -1) lang = lang.split(',')[0];
  if (lang.indexOf('-') > -1) lang = lang.split('-')[0];
  
  // Validate against supported locales
  if (!locales[lang]) lang = 'en';
  
  // Attach to request
  req.language = lang;
  
  // Translation helper
  req.t = (key) => {
    return locales[lang][key] || locales['en'][key] || key;
  };

  next();
};
