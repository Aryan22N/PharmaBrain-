import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface StorageUploadResult {
  success: boolean;
  publicUrl: string;
  path: string;
  error?: string;
}

const DEFAULT_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dvydfsahkqzgluusdsnn.supabase.co';
const DEFAULT_BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'OCR_Images';
const DEFAULT_FOLDER_NAME = process.env.SUPABASE_STORAGE_FOLDER || 'uploads';

function getEnvConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';


  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET_NAME;
  const folderName = process.env.SUPABASE_STORAGE_FOLDER || DEFAULT_FOLDER_NAME;

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

  if (!supabaseUrl || !supabaseKey) {
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
 * Normalizes image mime type for Supabase Storage acceptance
 */
function normalizeMimeType(filename: string, mimeType?: string): string {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (mimeType && (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp')) {
    return mimeType;
  }
  return 'image/png';
}

/**
 * Uploads a prescription image buffer to the Supabase Storage bucket ('OCR_Images').
 * Uses Supabase JS Client with automatic fallback to native REST API.
 */
export async function uploadPrescriptionImageToSupabase(
  fileBuffer: Buffer | ArrayBuffer | Uint8Array,
  originalFilename: string,
  mimeType = 'image/png'
): Promise<StorageUploadResult> {
  const { supabaseUrl, supabaseKey, bucketName, folderName } = getEnvConfig();

  if (!supabaseUrl || !supabaseKey) {
    return {
      success: false,
      publicUrl: '',
      path: '',
      error: 'Supabase storage credentials are not configured.',
    };
  }

  const extParts = originalFilename.split('.');
  const rawExt = extParts.length > 1 ? `.${extParts.pop()}`.toLowerCase() : '.png';
  const cleanExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(rawExt) ? rawExt : '.png';
  const cleanBase = originalFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFilename = `${cleanBase}_${Date.now()}${cleanExt}`;
  const filePath = folderName ? `${folderName}/${safeFilename}` : safeFilename;
  const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer as any);
  const normalizedMime = normalizeMimeType(originalFilename, mimeType);

  console.log(`[SupabaseStorage] Uploading file '${safeFilename}' (${buffer.length} bytes, ${normalizedMime}) to Bucket '${bucketName}'...`);

  // Method 1: Try via Supabase JS client
  try {
    const supabase = getSupabaseStorageClient();
    if (supabase) {
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from(bucketName)
        .upload(filePath, buffer, {
          contentType: normalizedMime,
          upsert: true,
          cacheControl: '3600',
        });

      if (!uploadErr && uploadData) {
        const publicUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucketName}/${filePath}`;
        console.log(`[SupabaseStorage] Successfully uploaded via Supabase client: ${publicUrl}`);
        return {
          success: true,
          publicUrl,
          path: filePath,
        };
      }
      console.warn('[SupabaseStorage] Supabase client upload warning:', uploadErr?.message, 'Trying direct REST API...');
    }
  } catch (clientErr: any) {
    console.warn('[SupabaseStorage] Supabase client exception:', clientErr?.message, 'Trying direct REST API...');
  }

  // Method 2: Direct Supabase Storage REST API fallback
  try {
    const restUploadUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${bucketName}/${filePath}`;
    const restRes = await fetch(restUploadUrl, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': normalizedMime,
        'x-upsert': 'true',
      },
      body: buffer as any,
    });

    if (restRes.ok) {
      const publicUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucketName}/${filePath}`;
      console.log(`[SupabaseStorage] Successfully uploaded via direct REST API: ${publicUrl}`);
      return {
        success: true,
        publicUrl,
        path: filePath,
      };
    }

    const restErrText = await restRes.text().catch(() => '');
    console.error(`[SupabaseStorage] REST API error status ${restRes.status}: ${restErrText}`);
    return {
      success: false,
      publicUrl: '',
      path: filePath,
      error: `Supabase Storage REST error (${restRes.status}): ${restErrText}`,
    };
  } catch (restErr: any) {
    console.error('[SupabaseStorage] REST API upload exception:', restErr);
    return {
      success: false,
      publicUrl: '',
      path: '',
      error: restErr.message || 'Supabase upload failed',
    };
  }
}

