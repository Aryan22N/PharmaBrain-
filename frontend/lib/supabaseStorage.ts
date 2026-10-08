import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface StorageUploadResult {
  success: boolean;
  publicUrl: string;
  path: string;
  error?: string;
}

function getEnvConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://dvydfsahkqzgluusdsnn.supabase.co';

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'OCR_Images';
  const folderName = process.env.SUPABASE_STORAGE_FOLDER || 'uploads';

  return { supabaseUrl, supabaseKey, bucketName, folderName };
}

declare global {
  // eslint-disable-next-line no-var
  var __supabaseStorageClient: SupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __supabaseStorageKeyUsed: string | undefined;
}

export function getSupabaseStorageClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseKey } = getEnvConfig();

  if (!supabaseUrl) {
    console.warn('[SupabaseStorage] Missing SUPABASE_URL');
    return null;
  }

  if (!supabaseKey) {
    console.warn(
      '[SupabaseStorage] Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env. Image upload to Supabase bucket will fallback to local disk.'
    );
    return null;
  }

  if (!global.__supabaseStorageClient || global.__supabaseStorageKeyUsed !== supabaseKey) {
    global.__supabaseStorageClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });
    global.__supabaseStorageKeyUsed = supabaseKey;
  }

  return global.__supabaseStorageClient;
}

/**
 * Uploads a prescription image buffer to the Supabase Storage bucket ('OCR_Images').
 */
export async function uploadPrescriptionImageToSupabase(
  fileBuffer: Buffer | ArrayBuffer,
  originalFilename: string,
  mimeType = 'image/png'
): Promise<StorageUploadResult> {
  const { supabaseUrl, supabaseKey, bucketName, folderName } = getEnvConfig();

  if (!supabaseKey) {
    return {
      success: false,
      publicUrl: '',
      path: '',
      error:
        'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env. Please copy your API key from Supabase Dashboard > Project Settings > API and paste it into .env.',
    };
  }

  const supabase = getSupabaseStorageClient();
  if (!supabase) {
    return {
      success: false,
      publicUrl: '',
      path: '',
      error: 'Supabase client could not be initialized.',
    };
  }

  try {
    const extParts = originalFilename.split('.');
    const ext = extParts.length > 1 ? `.${extParts.pop()}` : '.png';
    const cleanBase = originalFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = `${cleanBase}_${Date.now()}${ext}`;

    const filePath = folderName ? `${folderName}/${safeFilename}` : safeFilename;
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);

    console.log(`[SupabaseStorage] Uploading file '${safeFilename}' to Bucket '${bucketName}'...`);

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadErr) {
      console.error(`[SupabaseStorage] Upload error for bucket '${bucketName}':`, uploadErr.message);
      return {
        success: false,
        publicUrl: '',
        path: filePath,
        error: uploadErr.message,
      };
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    const publicUrl =
      publicUrlData?.publicUrl ||
      `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;

    console.log(`[SupabaseStorage] Successfully uploaded image to '${bucketName}': ${publicUrl}`);

    return {
      success: true,
      publicUrl,
      path: filePath,
    };
  } catch (err: any) {
    console.error('[SupabaseStorage] Exception during upload:', err);
    return {
      success: false,
      publicUrl: '',
      path: '',
      error: err.message || 'Upload failed',
    };
  }
}
