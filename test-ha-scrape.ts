import 'dotenv/config';
import { scrapeHeritageSold } from './lib/heritage.ts';

const lots = await scrapeHeritageSold('Fantastic Four 55 1966', 20, '55', 1966, ['fantastic four']);
console.log(`Found ${lots.length} Heritage lots:`);
lots.forEach(l => console.log(`  ${l.saleDate}  grade=${l.grade}  $${l.price}  ${l.title.slice(0, 60)}`));
