/**
 * Product image helpers.
 *
 * The source catalog stores a shared `NOImage.jpg` placeholder inside
 * `products.image_urls` (often as the *first* entry), so picking `image_urls[0]`
 * blindly made ~38% of product cards display the "no image" graphic even though
 * the product has real photos further down the list.
 */

/** Matches the source's placeholder filename, e.g. `.../NOImage.jpg`. */
const PLACEHOLDER_IMAGE = /noimage/i;

/** Real, non-empty product images, in source order. */
export function productImages(
  urls: readonly string[] | null | undefined,
): string[] {
  return (urls ?? []).filter(
    (url): url is string =>
      Boolean(url && url.trim()) && !PLACEHOLDER_IMAGE.test(url),
  );
}

/** The first real product image, or `undefined` when there is only a placeholder. */
export function primaryProductImage(
  urls: readonly string[] | null | undefined,
): string | undefined {
  return productImages(urls)[0];
}
