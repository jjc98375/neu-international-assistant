// jsdom ships no window.matchMedia, but every browser we target has it, so
// the components use it unguarded. Stub it here rather than adding a
// defensive branch to production code for an environment that only exists
// under test.
//
// Defaults to "does not match": the assistant page reads
// `(min-width: 1024px)` to decide whether the history rail docks, and the
// narrow/overlay layout is the one the existing suite was written against.
// A test that wants the wide layout can re-stub with `matches: true`.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
