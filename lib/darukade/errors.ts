/** Error taxonomy for the Darukade connector. */

/** Base class so callers can catch every connector failure with one type. */
export class DarukadeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DarukadeError";
  }
}

/** A request was made to a host/scheme that is not allow-listed. */
export class BlockedUrlError extends DarukadeError {
  readonly url: string;

  constructor(url: string) {
    super(`Refusing to fetch non-Darukade URL: ${url}`);
    this.name = "BlockedUrlError";
    this.url = url;
  }
}

/** HTTP response was not ok after retries were exhausted. */
export class HttpError extends DarukadeError {
  readonly url: string;
  readonly status: number;

  constructor(url: string, status: number, message?: string) {
    super(message ?? `HTTP ${status} for ${url}`);
    this.name = "HttpError";
    this.url = url;
    this.status = status;
  }
}

/** `__NEXT_DATA__` was missing or not valid JSON. */
export class ParseError extends DarukadeError {
  readonly url: string | undefined;

  constructor(message: string, url?: string) {
    super(url ? `${message} (${url})` : message);
    this.name = "ParseError";
    this.url = url;
  }
}
