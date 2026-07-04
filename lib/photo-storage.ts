import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';

/**
 * Meal photos live in a private Supabase Storage bucket (`meal-photos`), one
 * folder per user, so they follow the user across devices. `entries.photo_uri`
 * stores the storage PATH (`<uid>/<rand>.jpg`) for new meals; legacy rows keep a
 * local `file://` URI, which `isRemotePath` distinguishes. Reads go through
 * short-lived signed URLs (the bucket is private), cached by React Query.
 */

const BUCKET = 'meal-photos';
const MAX_BYTES = 5_000_000; // Storage standard-upload limit is 6MB; stay under.

function approxBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

async function compress(srcUri: string, quality: number): Promise<string | undefined> {
  const image = await ImageManipulator.manipulate(srcUri).resize({ width: 1024 }).renderAsync();
  const out = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG, base64: true });
  return out.base64 ?? undefined;
}

/**
 * Compress + upload a captured photo to the user's folder. Returns the storage
 * path, or `undefined` on any failure (best-effort: a failed photo must not block
 * logging the meal — the caller saves the entry with a null photo).
 */
export async function uploadMealPhoto(srcUri: string): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return undefined;

    let base64 = await compress(srcUri, 0.6);
    if (base64 && approxBytes(base64) > MAX_BYTES) base64 = await compress(srcUri, 0.4); // one retry
    if (!base64 || approxBytes(base64) > MAX_BYTES) {
      console.warn('[photo] too large to upload after compression');
      return undefined;
    }

    const path = `${uid}/${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, decode(base64), { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  } catch (e) {
    console.warn('[photo] upload failed', String(e));
    return undefined;
  }
}

/** True for a Storage path; false for a local/blob/http URI we can render directly. */
export function isRemotePath(uri?: string): boolean {
  return !!uri && !/^(file:|https?:|blob:|data:)/.test(uri);
}

/** Remove a single meal photo (best-effort; skips legacy local URIs). */
export async function deleteMealPhoto(path?: string): Promise<void> {
  if (!isRemotePath(path)) return;
  await supabase.storage.from(BUCKET).remove([path!]).catch(() => {});
}

/** Remove every photo in the user's folder (reset / account deletion). Storage is
 *  NOT part of the DB cascade, so this must run explicitly. Best-effort. */
export async function deleteAllMealPhotos(uid: string): Promise<void> {
  try {
    // Collect by advancing offset (terminates regardless of removal), then batch-remove.
    // remove() accepts up to 1000 paths; list() caps at 100.
    const limit = 100;
    const paths: string[] = [];
    for (let offset = 0; ; offset += limit) {
      const { data } = await supabase.storage.from(BUCKET).list(uid, { limit, offset });
      if (!data?.length) break;
      paths.push(...data.map((f) => `${uid}/${f.name}`));
      if (data.length < limit) break;
    }
    for (let i = 0; i < paths.length; i += 1000) {
      await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 1000));
    }
  } catch {
    // ignore — best-effort cleanup
  }
}

/**
 * Resolve a `photo_uri` to a displayable URL. Storage paths get a signed URL
 * (cached ~its lifetime); local/http URIs pass through. Returns `undefined` while
 * loading or on error, so callers fall back to the empty state.
 */
export function useSignedPhoto(uri?: string): string | undefined {
  const remote = isRemotePath(uri);
  const { data } = useQuery({
    queryKey: ['photo', uri],
    enabled: remote,
    staleTime: 45 * 60 * 1000, // margin before the 1h signed-URL TTL
    gcTime: 60 * 60 * 1000, // outlive staleTime so the URL isn't re-minted on remount
    queryFn: async () => {
      const res = await supabase.storage.from(BUCKET).createSignedUrl(uri!, 3600);
      if (res.error) throw res.error;
      return res.data.signedUrl;
    },
  });
  return remote ? data : uri;
}
