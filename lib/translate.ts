/**
 * Lightweight Persian↔English translation via MyMemory's free, keyless
 * endpoint. Results (and in-flight requests) are cached in-memory. Meant for
 * on-demand use, not for every render — each miss is a network round-trip.
 */

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

/** True when the text is already Latin/ASCII. */
const isLatin = (text: string) => /^[\x00-\x7F\s]*$/.test(text);

async function translateText(
  text: string,
  from: "fa" | "en",
  to: "fa" | "en",
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return Promise.resolve(text);

  const key = `${from}|${to}|${trimmed}`;
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(trimmed) +
        `&langpair=${from}|${to}`;
      const response = await fetch(url);
      if (!response.ok) return text;

      const data = (await response.json()) as {
        responseData?: { translatedText?: string };
      };
      const translated = data.responseData?.translatedText?.trim();
      if (translated && translated.toLowerCase() !== trimmed.toLowerCase()) {
        cache.set(key, translated);
        return translated;
      }
    } catch {
      // fall through and return the original text
    }

    return text;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export function translateFaToEn(text: string): Promise<string> {
  if (isLatin(text.trim())) return Promise.resolve(text);
  return translateText(text, "fa", "en");
}

export function translateEnToFa(text: string): Promise<string> {
  return translateText(text, "en", "fa");
}
