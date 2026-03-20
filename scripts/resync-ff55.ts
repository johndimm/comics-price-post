import 'dotenv/config';
import { syncEbayData } from '../lib/sync';
syncEbayData('13261', 'Fantastic Four', '55', 1966)
  .then(() => console.log('done'))
  .catch(console.error);
