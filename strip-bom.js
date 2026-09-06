const fs = require('fs');
const files = [
  'scripts/migrate.js',
  'scripts/verify-infra.js',
  'apps/api/src/db/migrations/006_fix_campaign_status.sql'
];
files.forEach(f => {
  try {
    let c = fs.readFileSync(f);
    if (c[0] === 0xEF && c[1] === 0xBB && c[2] === 0xBF) {
      fs.writeFileSync(f, c.slice(3));
      console.log('Stripped BOM from', f);
    }
  } catch (e) {
    console.log('Error', f, e.message);
  }
});
