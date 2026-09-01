// Public base URL used when encoding QR links for printed asset tags.
//
// Set NEXT_PUBLIC_BASE_URL to the stable internal hostname once DNS is ready
// (e.g. http://airhouse.airlink.mn); until then it defaults to the server IP.
// This is the ONE switch: whatever it is at print time gets baked into the QR,
// so finalize it (ideally the hostname) before mass-printing stickers.
export const PUBLIC_BASE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ?? 'http://10.58.152.12'
).replace(/\/+$/, '');

/** The URL a printed QR encodes — opens the public scan page for this item. */
export const scanUrl = (itemId: string) => `${PUBLIC_BASE_URL}/scan/${itemId}`;
