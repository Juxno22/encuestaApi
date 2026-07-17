const { randomUUID } = require('node:crypto');
const { query, withTransaction, pool } = require('../src/config/database');

async function main() {
  const branches = await query('SELECT id, public_name AS publicName FROM branches ORDER BY id');
  if (branches.length === 0) throw new Error('No existen sucursales para actualizar.');

  const result = await withTransaction(async (connection) => {
    const updated = [];
    for (const branch of branches) {
      const token = randomUUID();
      await connection.execute('UPDATE branches SET qr_token = ? WHERE id = ?', [token, branch.id]);
      updated.push({ id: branch.id, publicName: branch.publicName, token });
    }
    return updated;
  });

  console.log('Tokens QR renovados. Genera nuevamente los enlaces y códigos QR:');
  for (const branch of result) {
    console.log(`${branch.id}\t${branch.publicName}\t${branch.token}`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
