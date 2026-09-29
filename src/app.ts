/**
 * An application of OBIX's native runtime: a root component of canonical IR, made into an application once — the IR is read then, so an IR the runtime cannot run is refused
 * before anything is mounted — and put in a page by `mount`, taken out by `unmount`.
 */
import { hasPendingJobs, nextTick } from 'obix-runtime-reactivity';
import { Linker, ObixRuntimeError, mountComponent, pageListeners } from 'obix-runtime-component';
import type { MountedComponent, ObixIrComponent, Registry } from 'obix-runtime-component';

export interface ObixAppOptions {
  /** the document a selector is looked up in; the page's own when there is one and none is given */
  readonly document?: Document;
  /** the inputs of the root component (its props) */
  readonly props?: Readonly<Record<string, unknown>>;
  /** the components the application invokes, by the module specifier their sources wrote */
  readonly registry?: Registry;
  /** the page's handlers of the root's outputs, by channel */
  readonly interactions?: Readonly<Record<string, unknown>>;
}

export interface ObixApp {
  /** put the application at the end of `target` — an element, or a selector looked up in the document */
  mount(target: Element | string): void;
  /** give the root component new inputs; the page shows them after the current task */
  setProps(props: Readonly<Record<string, unknown>>): void;
  /** write every pending update now */
  flush(): void;
  /** resolves once every pending update is written (rejects with what an update threw) */
  settled(): Promise<void>;
  /** take it out; a second time is nothing */
  unmount(): void;
}

const mountError = (message: string): ObixRuntimeError => new ObixRuntimeError('OBIX_RUNTIME_MOUNT', message);

export function createObixApp(root: unknown, options: ObixAppOptions = {}): ObixApp {
  // the whole application is read and linked when it is made: what cannot run is refused before anything is mounted
  const ir: ObixIrComponent = new Linker(options.registry ?? {}).link(root);
  pageListeners(ir, options.interactions ?? {});
  let mounted: MountedComponent | null = null;
  return {
    mount(target) {
      if (mounted !== null) throw mountError(`${ir.name} is already mounted`);
      let element: Element;
      if (typeof target === 'string') {
        const document = options.document ?? (globalThis as { document?: Document }).document;
        if (document === undefined) throw mountError(`${ir.name}: the selector ${target} needs a document, and there is none: give one in the options`);
        const found = document.querySelector(target);
        if (found === null) throw mountError(`${ir.name}: the selector ${target} finds nothing in the document`);
        element = found;
      } else {
        element = target;
      }
      mounted = mountComponent(ir, { target: element, props: options.props ?? {}, registry: options.registry ?? {}, interactions: options.interactions ?? {} });
    },
    setProps(props) {
      if (mounted === null) throw mountError(`${ir.name} is not mounted: there is nothing to give new inputs to`);
      mounted.setProps(props);
    },
    flush() {
      mounted?.flush();
    },
    async settled() {
      while (hasPendingJobs()) await nextTick();
    },
    unmount() {
      mounted?.unmount();
      mounted = null;
    },
  };
}
