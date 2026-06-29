/**
 * @file Default MSW request handlers (empty by default). Network-touching tests add
 * their own per-test handlers with `server.use(...)`; keeping the default set empty
 * (plus `onUnhandledRequest: "bypass"`) means tests that stub `fetch` directly are
 * unaffected, while tests that opt into MSW get explicit, asserted responses.
 */
export const handlers = [];
