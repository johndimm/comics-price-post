/**
 * Resync all shortboxed-listed comics with eBay + Heritage data, then
 * print a comparison table: shortboxed price vs our FMV.
 */
import 'dotenv/config';
import { syncEbayData } from '../lib/sync';
import { calcFMV, getListingsByComic, getGradeCurvePoints } from '../lib/db';

const COMICS: { marvel_id: string; title: string; number: string; year: number; grade: number; sbPrice: number | null; note?: string }[] = [
  { marvel_id: '13261', title: 'Fantastic Four',    number: '55',  year: 1966, grade: 9.2, sbPrice: 1695 },
  { marvel_id: '13251', title: 'Fantastic Four',    number: '46',  year: 1966, grade: 9.0, sbPrice: 1332 },
  { marvel_id: '13216', title: 'Fantastic Four',    number: '39',  year: 1965, grade: 9.0, sbPrice: 804  },
  { marvel_id: '13264', title: 'Fantastic Four',    number: '58',  year: 1967, grade: 9.2, sbPrice: 595  },
  { marvel_id: '13274', title: 'Fantastic Four',    number: '67',  year: 1967, grade: 8.0, sbPrice: 324  },
  { marvel_id: '13262', title: 'Fantastic Four',    number: '56',  year: 1966, grade: 7.5, sbPrice: 127  },
  { marvel_id: '13252', title: 'Fantastic Four',    number: '47',  year: 1966, grade: 9.0, sbPrice: 386  },
  { marvel_id: '13249', title: 'Fantastic Four',    number: '44',  year: 1965, grade: 9.2, sbPrice: 375  },
  { marvel_id: '13239', title: 'Fantastic Four',    number: '41',  year: 1965, grade: 9.0, sbPrice: 295  },
  { marvel_id: '13205', title: 'Fantastic Four',    number: '38',  year: 1965, grade: 8.5, sbPrice: 342  },
  { marvel_id: '6582',  title: 'Amazing Spider-Man',number: '19',  year: 1964, grade: 9.0, sbPrice: 1899 },
  { marvel_id: '6705',  title: 'Amazing Spider-Man',number: '30',  year: 1965, grade: 7.5, sbPrice: 294  },
  { marvel_id: '6671',  title: 'Amazing Spider-Man',number: '27',  year: 1965, grade: 8.0, sbPrice: 560  },
  { marvel_id: '6516',  title: 'Amazing Spider-Man',number: '13',  year: 1964, grade: 3.0, sbPrice: 445, note: 'RAW est. gr3.0' },
  { marvel_id: '11462', title: 'Mighty Thor',       number: '134', year: 1966, grade: 5.5, sbPrice: 111  },
  { marvel_id: '9693',  title: 'Journey Into Mystery', number: '118', year: 1965, grade: 9.2, sbPrice: 1020 },
  { marvel_id: '9691',  title: 'Journey Into Mystery', number: '116', year: 1965, grade: 8.0, sbPrice: 189  },
  { marvel_id: '9690',  title: 'Journey Into Mystery', number: '115', year: 1965, grade: 9.0, sbPrice: 380  },
  { marvel_id: '9689',  title: 'Journey Into Mystery', number: '114', year: 1965, grade: 7.0, sbPrice: 250  },
  { marvel_id: '12464', title: 'X-Men',             number: '18',  year: 1966, grade: 5.0, sbPrice: 156  },
  { marvel_id: '12462', title: 'X-Men',             number: '16',  year: 1966, grade: 5.0, sbPrice: 216  },
  { marvel_id: '12447', title: 'X-Men',             number: '13',  year: 1965, grade: 6.0, sbPrice: 400  },
  { marvel_id: '12425', title: 'X-Men',             number: '11',  year: 1965, grade: 6.5, sbPrice: 324  },
  { marvel_id: '12414', title: 'X-Men',             number: '10',  year: 1965, grade: 7.0, sbPrice: 368  },
];

async function main() {
  console.log('Resyncing all shortboxed comics (eBay + Heritage)...\n');

  for (const c of COMICS) {
    process.stdout.write(`  ${c.title} #${c.number}... `);
    try {
      await syncEbayData(c.marvel_id, c.title, c.number, c.year);
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
    }
  }

  console.log('\n\n── Shortboxed vs Our FMV ────────────────────────────────────────────\n');
  console.log(`${'Comic'.padEnd(30)} ${'Gr'.padStart(4)} ${'SB Price'.padStart(9)} ${'Our FMV'.padStart(9)} ${'Diff'.padStart(7)} ${'Heritage?'.padStart(10)}  FMV Method`);
  console.log('─'.repeat(110));

  for (const c of COMICS) {
    const listings = getListingsByComic(c.marvel_id);
    const sold = listings.filter(l => l.type === 'sold');
    const asking = listings.filter(l => l.type === 'asking');
    const curves = getGradeCurvePoints(c.marvel_id);
    const result = calcFMV(null, sold, asking, c.grade, curves, true);
    const fmv = result.value;
    const hasHeritage = listings.some(l => (l as any).source === 'heritage');
    const heritageSold = sold.filter(l => (l as any).source === 'heritage').length;

    const name = `${c.title} #${c.number}`;
    const sbStr = c.sbPrice ? `$${c.sbPrice.toLocaleString()}` : '—';
    const fmvStr = fmv ? `$${fmv.toLocaleString()}` : '—';
    let diffStr = '—';
    if (fmv && c.sbPrice) {
      const pct = Math.round((c.sbPrice - fmv) / fmv * 100);
      diffStr = (pct >= 0 ? '+' : '') + pct + '%';
    }
    const haStr = hasHeritage ? `✓ (${heritageSold})` : '✗';
    const methodShort = result.method.slice(0, 40);

    console.log(`${name.padEnd(30)} ${String(c.grade).padStart(4)} ${sbStr.padStart(9)} ${fmvStr.padStart(9)} ${diffStr.padStart(7)} ${haStr.padStart(10)}  ${methodShort}`);
  }

}

main().catch(console.error);
