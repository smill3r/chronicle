/**
 * Sleep for a given number of milliseconds.
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retry an async function with exponential backoff.
 * Honors Retry-After headers by reading them from the thrown error.
 *
 * @param {Function} fn          - Async function to retry
 * @param {number}   maxAttempts - Max attempts before throwing (default 3)
 * @param {number}   baseDelayMs - Initial delay in ms, doubles each attempt (default 1000)
 */
export async function withRetry(fn, maxAttempts = 3, baseDelayMs = 1000) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Honor Retry-After if the error carries it (set by wikipedia.js on 429)
      const retryAfterMs = err.retryAfterMs ?? null
      const delay = retryAfterMs ?? baseDelayMs * Math.pow(2, attempt - 1)

      if (attempt < maxAttempts) {
        console.warn(
          `  ⚠ Attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delay}ms…`
        )
        await sleep(delay)
      }
    }
  }
  throw lastError
}
