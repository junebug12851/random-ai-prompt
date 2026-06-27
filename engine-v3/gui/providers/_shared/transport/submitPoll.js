/**
 * Generic submit-then-poll helper used **server-side** by hosted adapters whose APIs are
 * asynchronous (Stability, fal.ai, Replicate, BFL/FLUX, Leonardo, …): submit a job, then
 * poll until it's done. Keeping it here means each provider supplies only its endpoints +
 * mappings, not its own poll loop. (OpenAI is synchronous and does not need this.)
 * @module gui/providers/_shared/transport/submitPoll
 */

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms Milliseconds.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a submit → poll loop.
 * @param {object} opts
 * @param {() => Promise<object>} opts.submit Submit the job; resolves to the submit response.
 * @param {(submitResponse: object) => Promise<object>} opts.poll Poll once; resolves to a status.
 * @param {(status: object) => boolean} opts.isDone True when the poll status is terminal-success.
 * @param {(status: object) => boolean} [opts.isFailed] True when the status is terminal-failure.
 * @param {(status: object) => string[]} opts.getImages Extract image URLs from a done status.
 * @param {number} [opts.intervalMs] Poll interval (default 1500).
 * @param {number} [opts.timeoutMs] Overall timeout (default 120000).
 * @returns {Promise<{images: string[]}>}
 * @throws {Error} On failure or timeout.
 */
export async function submitPoll({
  submit,
  poll,
  isDone,
  isFailed = () => false,
  getImages,
  intervalMs = 1500,
  timeoutMs = 120000,
}) {
  const submitted = await submit();
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await poll(submitted);
    if (isFailed(status)) throw new Error("Generation failed upstream.");
    if (isDone(status)) return { images: getImages(status) };
    if (Date.now() > deadline) throw new Error("Generation timed out.");
    await sleep(intervalMs);
  }
}
