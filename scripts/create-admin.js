const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/config/database');
const { config } = require('../src/config/env');

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) continue;
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = true;
    }
  }
  return values;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const username = String(args.username || process.env.ADMIN_USERNAME || '').trim();
  const email = String(args.email || process.env.ADMIN_EMAIL || '').trim() || null;
  const password = String(args.password || process.env.ADMIN_PASSWORD || '');
  const role = String(args.role || process.env.ADMIN_ROLE || 'superadmin');
  const update = Boolean(args.update);

  if (username.length < 3) throw new Error('Indica --username con al menos 3 caracteres.');
  if (password.length < 12) {
    throw new Error('Indica ADMIN_PASSWORD o --password con al menos 12 caracteres.');
  }
  if (!['superadmin', 'analyst'].includes(role)) {
    throw new Error('El rol debe ser superadmin o analyst.');
  }

  const existing = await query(
    'SELECT id FROM admin_users WHERE username = ? OR (? IS NOT NULL AND email = ?) LIMIT 1',
    [username, email, email]
  );
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  if (existing.length > 0) {
    if (!update) {
      throw new Error('El usuario o correo ya existe. Usa --update para actualizarlo.');
    }
    await query(
      `UPDATE admin_users
          SET username = ?, email = ?, password_hash = ?, role = ?, is_active = 1
        WHERE id = ?`,
      [username, email, passwordHash, role, existing[0].id]
    );
    console.log(`Administrador actualizado: ${username} (${role}).`);
    return;
  }

  await query(
    `INSERT INTO admin_users (username, email, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [username, email, passwordHash, role]
  );
  console.log(`Administrador creado: ${username} (${role}).`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
