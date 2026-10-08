const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'frontend', 'node_modules', '@supabase', 'supabase-js'));
const { Pool } = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'pg'));

// Simple manual .env parser without external dependencies
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.dvydfsahkqzgluusdsnn:arn2252006%40123@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dvydfsahkqzgluusdsnn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'prescriptions';
const folderName = process.env.SUPABASE_STORAGE_FOLDER || 'uploads';

console.log('--- SUPABASE STORAGE MIGRATION TOOL ---');
console.log('Database URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));
console.log('Supabase URL:', supabaseUrl);
console.log('Target Bucket:', bucketName);
console.log('Target Folder:', folderName);

async function migrateUploads() {
  const uploadsDir = path.join(__dirname, '..', 'frontend', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log(`No local uploads directory found at ${uploadsDir}. Migration not needed.`);
    return;
  }

  const files = fs.readdirSync(uploadsDir).filter(f => !fs.statSync(path.join(uploadsDir, f)).isDirectory() && !f.startsWith('.'));
  console.log(`Found ${files.length} local upload file(s) in ${uploadsDir}`);

  if (files.length === 0) {
    console.log('No local upload files to migrate.');
    return;
  }

  let supabase = null;
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some(b => b.name === bucketName)) {
      console.log(`Creating public bucket '${bucketName}'...`);
      await supabase.storage.createBucket(bucketName, { public: true });
    }
  } else {
    console.log('Note: Service/Anon key not explicitly passed in env. Presuming bucket pre-configured or public access.');
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  let migratedCount = 0;

  for (const filename of files) {
    const filePath = path.join(uploadsDir, filename);
    const fileBytes = fs.readFileSync(filePath);
    const storagePath = `${folderName}/${filename}`;
    const legacyPath = `/uploads/${filename}`;
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    let publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${storagePath}`;

    if (supabase) {
      console.log(`Uploading ${filename} to Supabase Storage bucket '${bucketName}'...`);
      const { error: uploadErr } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, fileBytes, { contentType: mimeType, upsert: true });

      if (uploadErr) {
        console.warn(`Upload error for ${filename}:`, uploadErr.message);
      } else {
        const { data: pubData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        if (pubData?.publicUrl) publicUrl = pubData.publicUrl;
      }
    }

    console.log(`Updating PostgreSQL database references from '${legacyPath}' to '${publicUrl}'...`);

    try {
      const docRes = await pool.query(
        `UPDATE "Document" SET "storedFilename" = $1 WHERE "storedFilename" = $2 OR "storedFilename" LIKE $3 RETURNING id;`,
        [publicUrl, legacyPath, `%${filename}`]
      );

      const analysisRes = await pool.query(
        `UPDATE "Analysis" SET "structuredResult" = jsonb_set("structuredResult", '{image_url}', $1::jsonb) WHERE "structuredResult"->>'image_url' = $2 OR "structuredResult"->>'image_url' LIKE $3 RETURNING id;`,
        [JSON.stringify(publicUrl), legacyPath, `%${filename}`]
      );

      console.log(`  Updated ${docRes.rowCount} Document row(s) and ${analysisRes.rowCount} Analysis row(s) for ${filename}`);
      migratedCount++;
    } catch (dbErr) {
      console.error(`Database update error for ${filename}:`, dbErr.message);
    }
  }

  await pool.end();
  console.log(`\nMigration completed! ${migratedCount}/${files.length} file(s) processed.`);
}

migrateUploads().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
