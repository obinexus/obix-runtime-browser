/**
 * obix-runtime-browser — the browser entry of OBIX's native runtime (Phase 6, docs/recovery/native-runtime.md).
 *
 *     const app = createObixApp(rootIr, { … });
 *     app.mount('#app');
 *
 * No Vue, no React: the components are canonical IR, run by obix-runtime-component.
 */
export { createObixApp } from './app.js';
export type { ObixApp, ObixAppOptions } from './app.js';
export { ObixRuntimeError } from 'obix-runtime-component';
export type { ObixIrComponent, ObixRuntimeErrorCode, Registry } from 'obix-runtime-component';
