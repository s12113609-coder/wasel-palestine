require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Users
    const adminHash = await bcrypt.hash('Admin@2026', 10);
    const modHash = await bcrypt.hash('Mod@2026', 10);
    const userHash = await bcrypt.hash('User@2026', 10);

    await pool.query(`
      INSERT INTO users (username, email, password_hash, role) VALUES
      ('admin', 'admin@wasel.ps', $1, 'admin'),
      ('moderator1', 'mod1@wasel.ps', $2, 'moderator'),
      ('citizen1', 'citizen1@wasel.ps', $3, 'citizen')
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, modHash, userHash]);

    // Checkpoints
    await pool.query(`
      INSERT INTO checkpoints (name, name_ar, latitude, longitude, type, region) VALUES
      ('Qalandia Checkpoint', 'حاجز قلنديا', 31.8653, 35.2141, 'military', 'Ramallah'),
      ('Huwwara Checkpoint', 'حاجز حوارة', 32.1318, 35.2574, 'military', 'Nablus'),
      ('Gilo Checkpoint', 'حاجز جيلو', 31.7439, 35.1860, 'military', 'Bethlehem'),
      ('Beit Iba Checkpoint', 'حاجز بيت إيبا', 32.2192, 35.2084, 'military', 'Nablus'),
      ('Tarqumiya Checkpoint', 'حاجز ترقوميا', 31.5983, 34.9441, 'crossing', 'Hebron'),
      ('Za''atara Checkpoint', 'حاجز زعترة', 32.0567, 35.2631, 'flying', 'Ramallah')
      ON CONFLICT DO NOTHING
    `);

    const checkpoints = await pool.query('SELECT id FROM checkpoints LIMIT 3');
    const adminUser = await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
    const adminId = adminUser.rows[0]?.id;

    if (checkpoints.rows.length > 0 && adminId) {
      for (const cp of checkpoints.rows) {
        await pool.query(`
          INSERT INTO checkpoint_status_history (checkpoint_id, status, notes, reported_by)
          VALUES ($1, 'open', 'Initial status', $2)
          ON CONFLICT DO NOTHING
        `, [cp.id, adminId]);
      }

      // Incidents
      await pool.query(`
        INSERT INTO incidents (title, description, type, severity, status, latitude, longitude, region, reported_by)
        VALUES
        ('Road closure near Qalandia', 'Road blocked due to military operation', 'closure', 'high', 'active', 31.8653, 35.2141, 'Ramallah', $1),
        ('Traffic delay at Huwwara', 'Heavy vehicle checks causing 2-hour delay', 'delay', 'medium', 'verified', 32.1318, 35.2574, 'Nablus', $1),
        ('Road damage on Route 60', 'Large pothole near Beit El junction', 'road_damage', 'low', 'active', 31.9785, 35.2266, 'Ramallah', $1)
        ON CONFLICT DO NOTHING
      `, [adminId]);
    }

    console.log('✅ Database seeded successfully');
    console.log('👤 Admin: admin@wasel.ps / Admin@2026');
    console.log('👤 Moderator: mod1@wasel.ps / Mod@2026');
    console.log('👤 Citizen: citizen1@wasel.ps / User@2026');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
