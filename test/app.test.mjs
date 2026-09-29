/**
 * N0 — the application entry of the native runtime: `createObixApp(ir, options)` makes an application of a root component, `mount(target)` puts it in the page — an element, or
 * a selector looked up in the document the options give (the browser's own document when there is one) — and `unmount()` takes it out.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createObixApp } from 'obix-runtime-browser';

const SCHEMA = 'obix-dop-ir/3';
const hello = {
  schema: SCHEMA, kind: 'component', id: 'component', name: 'Hello', props: [], state: [], derived: [], outputs: [], actions: [], effects: [], dependencies: [], styles: [],
  view: [{ kind: 'element', id: 'view.0', tag: 'p', attributes: [], properties: [], accessibility: { attributes: [], properties: [] }, events: [], children: [{ kind: 'text', id: 'view.0.children.0', parts: [{ kind: 'static', value: 'Hello' }] }] }],
};

const page = () => new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>').window.document;

test('mount into an element renders the root component there, and unmount empties it', () => {
  const document = page();
  const target = document.getElementById('app');
  const app = createObixApp(hello);
  app.mount(target);
  assert.equal(target.innerHTML, '<p>Hello</p>');
  app.unmount();
  assert.equal(target.innerHTML, '');
});

test('mount by selector finds the target in the document given', () => {
  const document = page();
  const app = createObixApp(hello, { document });
  app.mount('#app');
  assert.equal(document.getElementById('app').innerHTML, '<p>Hello</p>');
});

test('a selector that finds nothing, a selector with no document, and a second mount are refused', () => {
  const document = page();
  assert.throws(() => createObixApp(hello, { document }).mount('#none'), (error) => error.code === 'OBIX_RUNTIME_MOUNT' && /#none/.test(error.message));
  assert.equal(typeof globalThis.document, 'undefined');
  assert.throws(() => createObixApp(hello).mount('#app'), (error) => error.code === 'OBIX_RUNTIME_MOUNT' && /document/.test(error.message));
  const app = createObixApp(hello);
  app.mount(document.getElementById('app'));
  assert.throws(() => app.mount(document.body), (error) => error.code === 'OBIX_RUNTIME_MOUNT' && /already mounted/.test(error.message));
});

test('an application whose root is not an IR of this schema is refused when it is made, not when it is mounted', () => {
  assert.throws(() => createObixApp({ ...hello, schema: 'obix-dop-ir/2' }), (error) => error.code === 'OBIX_RUNTIME_SCHEMA');
});

test('mounting leaves what the target held before the application in place, after it', () => {
  const document = page();
  const target = document.getElementById('app');
  target.innerHTML = '<noscript>needs JavaScript</noscript>';
  const app = createObixApp(hello);
  app.mount(target);
  assert.equal(target.innerHTML, '<noscript>needs JavaScript</noscript><p>Hello</p>');
  app.unmount();
  assert.equal(target.innerHTML, '<noscript>needs JavaScript</noscript>');
});

test('N1: the options give the root component its inputs, and an input it does not declare is refused when the application is mounted', () => {
  const greet = { ...hello, name: 'Greet', props: [{ id: 'props.0', name: 'who', type: 'string', required: true, default: null }],
    view: [{ ...hello.view[0], children: [{ kind: 'text', id: 'view.0.children.0', parts: [{ kind: 'static', value: 'Hello, ' }, { kind: 'display', expression: { kind: 'reference', scope: 'prop', name: 'who' } }] }] }] };
  const document = page();
  const target = document.getElementById('app');
  createObixApp(greet, { props: { who: 'Ada' } }).mount(target);
  assert.equal(target.innerHTML, '<p>Hello, Ada</p>');
  assert.throws(() => createObixApp(greet, { props: { who: 'Ada', whom: 'x' } }).mount(page().getElementById('app')), (error) => error.code === 'OBIX_RUNTIME_INPUT');
});

test('N2: setProps gives the root new inputs; settled() resolves once the page shows them, flush() shows them now', async () => {
  const greet = { ...hello, name: 'Greet', props: [{ id: 'props.0', name: 'who', type: 'string', required: true, default: null }],
    view: [{ ...hello.view[0], children: [{ kind: 'text', id: 'view.0.children.0', parts: [{ kind: 'display', expression: { kind: 'reference', scope: 'prop', name: 'who' } }] }] }] };
  const target = page().getElementById('app');
  const app = createObixApp(greet, { props: { who: 'a' } });
  app.mount(target);
  app.setProps({ who: 'b' });
  assert.equal(target.textContent, 'a');
  await app.settled();
  assert.equal(target.textContent, 'b');
  app.setProps({ who: 'c' });
  app.flush();
  assert.equal(target.textContent, 'c');
  assert.throws(() => createObixApp(greet, { props: { who: 'x' } }).setProps({ who: 'y' }), (error) => error.code === 'OBIX_RUNTIME_MOUNT' && /not mounted/.test(error.message));
});

test('N7: the options give the registry of the components the root invokes; a dependency with nothing registered is refused when the application is made', () => {
  const child = { ...hello, name: 'Child' };
  const parent = { ...hello, name: 'Parent', dependencies: [{ id: 'dependencies.0', local: 'Child', specifier: './Child.obix', export: 'default' }],
    view: [{ kind: 'invocation', id: 'view.0', component: 'Child', attributes: [], properties: [], children: [], interactions: [] }] };
  const target = page().getElementById('app');
  createObixApp(parent, { registry: { './Child.obix': child } }).mount(target);
  assert.equal(target.innerHTML, '<p>Hello</p>');
  assert.throws(() => createObixApp(parent, { registry: {} }), (error) => error.code === 'OBIX_RUNTIME_LINK' && /\.\/Child\.obix/.test(error.message));
});

test('N8: the options give the page\'s handlers of the root\'s outputs; one on a channel the root does not declare is refused when the application is made', () => {
  const button = { ...hello, name: 'Go', outputs: [{ id: 'outputs.0', channel: 'go', payload: null }],
    view: [{ ...hello.view[0], tag: 'button', events: [{ id: 'view.0.events.0', event: 'click', steps: [{ kind: 'output', id: 's', channel: 'go', value: null }] }] }] };
  const target = page().getElementById('app');
  let told = 0;
  createObixApp(button, { interactions: { go: () => told++ } }).mount(target);
  target.querySelector('button').click();
  assert.equal(told, 1);
  assert.throws(() => createObixApp(button, { interactions: { went: () => {} } }), (error) => error.code === 'OBIX_RUNTIME_LINK' && /went/.test(error.message));
});

test('N10: an application unmounted and mounted again starts afresh; one taken down refuses new inputs; an update that throws rejects settled()', async () => {
  const counter = { ...hello, name: 'Counter', state: [{ id: 'state.0', name: 'n', initial: { kind: 'literal', value: 0 } }, { id: 'state.1', name: 'box', initial: { kind: 'object', entries: [{ key: 'v', value: { kind: 'literal', value: 'ok' } }] } }],
    view: [{ ...hello.view[0], tag: 'button', events: [{ id: 'e', event: 'click', steps: [{ kind: 'assign', id: 's', target: 'n', value: { kind: 'binary', operator: '+', left: { kind: 'reference', scope: 'state', name: 'n' }, right: { kind: 'literal', value: 1 } } }] },
      { id: 'e2', event: 'dblclick', steps: [{ kind: 'assign', id: 's2', target: 'box', value: { kind: 'literal', value: null } }] }],
      children: [{ kind: 'text', id: 't', parts: [{ kind: 'display', expression: { kind: 'reference', scope: 'state', name: 'n' } }, { kind: 'display', expression: { kind: 'member', object: { kind: 'reference', scope: 'state', name: 'box' }, property: 'v' } }] }] }] };
  const document = page();
  const target = document.getElementById('app');
  const app = createObixApp(counter);
  app.mount(target);
  target.querySelector('button').click();
  await app.settled();
  assert.equal(target.textContent, '1ok');
  app.unmount();
  assert.equal(target.innerHTML, '');
  assert.throws(() => app.setProps({}), (error) => error.code === 'OBIX_RUNTIME_MOUNT');
  app.mount(target);
  assert.equal(target.textContent, '0ok', 'a new mount is a new component');
  target.querySelector('button').dispatchEvent(new document.defaultView.MouseEvent('dblclick', { bubbles: true }));
  await assert.rejects(app.settled(), TypeError);
  app.unmount();
});
