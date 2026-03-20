import 'dotenv/config';
import { syncEbayData } from '../lib/sync';
syncEbayData('local-motor-city-comics-1', 'Motor City Comics', '1', 1971)
  .then(() => console.log('done'))
  .catch(console.error);
