const { query } = require('../config/database');

async function listPublicBranches() {
  return query(
    `SELECT slug, public_name AS publicName
       FROM branches
      WHERE is_active = 1
      ORDER BY public_name ASC`
  );
}

async function listAdminBranches() {
  return query(
    `SELECT id,
            code,
            slug,
            administrative_name AS administrativeName,
            public_name AS publicName,
            is_active AS isActive
       FROM branches
      ORDER BY administrative_name ASC`
  );
}

async function resolveActiveBranch({ token, slug }, executor = null, lock = false) {
  const db = executor || { execute: async (sql, params) => [await query(sql, params)] };
  const conditions = ['is_active = 1'];
  const params = [];

  if (token) {
    conditions.push('qr_token = ?');
    params.push(token);
  } else {
    conditions.push('slug = ?');
    params.push(slug);
  }

  const [rows] = await db.execute(
    `SELECT id,
            code,
            slug,
            administrative_name AS administrativeName,
            public_name AS publicName
       FROM branches
      WHERE ${conditions.join(' AND ')}
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    params
  );

  return rows[0] || null;
}

module.exports = {
  listPublicBranches,
  listAdminBranches,
  resolveActiveBranch
};
