const path = require('path');
const fs = require('fs');
const { createClient } = require(path.join(__dirname, '..', 'frontend', 'node_modules', '@supabase', 'supabase-js'));

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dvydfsahkqzgluusdsnn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_X3dLZlp-hGEg1S9KfFsQWg_7cAu8kgs';
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'OCR_Images';

console.log('--- TESTING SUPABASE STORAGE BUCKET UPLOAD ---');
console.log('Target Bucket:', bucketName);
console.log('Supabase URL:', supabaseUrl);
console.log('Using Key:', supabaseKey.slice(0, 20) + '...');

async function testUpload() {
  const dummyBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const filename = `test_prescription_${Date.now()}.png`;
  const filePath = `uploads/${filename}`;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Uploading test file '${filePath}' to bucket '${bucketName}'...`);
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, dummyBuffer, { contentType: 'image/png', upsert: true });

  if (error) {
    console.error('Upload Failed:', error.message);
  } else {
    console.log('Upload SUCCESSFUL! File path in bucket:', data?.path || filePath);
    const { data: pubData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    console.log('Public CDN URL:', pubData?.publicUrl);
  }
}

testUpload();
