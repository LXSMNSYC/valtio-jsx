import { proxy, subscribe } from 'valtio/vanilla';
import type { JSX } from "./jsx";

type ContextOwner = {
  disposables: any[];
  owner: ContextOwner | null;
  context?: any;
};
export interface Context {
  id: symbol;
  Provider: (props: any) => any;
  defaultValue: unknown;
}

let globalContext: ContextOwner | null = null;

let GET: (<T extends object>(value: T) => T) | undefined;


interface Ref<T> {
  value: T;
}

function ref<T>(value: T): Ref<T> {
  return proxy({ value });
}

function valtioEffect(callback: () => void): () => void {
  let alive = true;
  let cleanups: (() => void)[] = [];

  function cleanup() {
    cleanups.forEach((clean) => {
      clean();
    });
  }

  function revalidate() {
    if (!alive) {
      return;
    }
    cleanup();
    const parent = GET;
    GET = (value) => {
      cleanups.push(subscribe(value, revalidate));
      return value;
    };
    callback();
    GET = parent;
  }

  revalidate();

  return () => {
    cleanup();
    alive = false;
  };
}

export function computed<T>(callback: () => T): Ref<T> {
  const state = ref({}) as Ref<T>;

  valtioEffect(() => {
    state.value = callback();
  });

  return state;
}

export function get<T extends object>(value: T): T {
  if (GET) {
    return GET(value);
  }
  throw new Error('Invalid get call.');
}

export function untracked(fn: () => any) {
  const parent = GET;
  GET = undefined;
  try {
    return fn();
  } finally {
    GET = parent;
  }
}

export function root<T>(fn: (dispose: () => void) => T) {
  let d: any[], ret: T;
  globalContext = {
    disposables: (d = []),
    owner: globalContext
  };
  ret = untracked(() =>
    fn(() => {
      let k, len: number;
      for (k = 0, len = d.length; k < len; k++) d[k]();
      d = [];
    })
  );
  globalContext = globalContext.owner;
  return ret;
}

export function cleanup(fn: () => void) {
  let ref;
  (ref = globalContext) != null && ref.disposables.push(fn);
}

export function effect<T>(fn: (prev?: T) => T, current?: T) {
  const context = {
      disposables: [] as (() => void)[],
      owner: globalContext
    },
    cleanupFn = (final: boolean) => {
      const d = context.disposables;
      context.disposables = [];
      for (let k = 0, len = d.length; k < len; k++) d[k]();
      final && c();
    },
    c = valtioEffect(() => {
      cleanupFn(false);
      globalContext = context;
      current = fn(current);
      globalContext = globalContext.owner;
    });
  cleanup(() => cleanupFn(true));
}

// only updates when boolean expression changes
export function memo<T>(fn: () => T, equal?: boolean): () => T {
  const o = ref(untracked(fn));
  effect(prev => {
    const res = fn();
    (!equal || prev !== res) && (o.value = res);
    return res;
  });
  return () => get(o).value;
}

export function createSelector<T, U extends T>(
  source: () => T,
  fn: (a: U, b: T) => boolean = (a, b) => a === b
){
  let subs = new Map();
  let v: T;
  effect((p?: U) => {
    v = source();
    const keys = [...subs.keys()];
    for (let i = 0, len = keys.length; i < len; i++) {
      const key = keys[i];
      if (fn(key, v) || p !== undefined && fn(key, p)) {
        const o = subs.get(key);
        o.value = null;
      }
    }
    return v as U;
  });
  return (key: U) => {
    let l: Ref<U | undefined> & { _count?: number };
    if (!(l = subs.get(key))) subs.set(key, l = ref<U | undefined>(undefined));
    l.value;
    l._count ? (l._count++) : (l._count = 1);
    cleanup(() => l._count! > 1 ? l._count!-- : subs.delete(key))
    return fn(key, v);
  };
}

type PropsWithChildren<P> = P & { children?: JSX.Element };
export type Component<P = {}> = (props: PropsWithChildren<P>) => JSX.Element;
export type ComponentProps<
  T extends keyof JSX.IntrinsicElements | Component<any>
> = T extends Component<infer P>
  ? P
  : T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : {};

export function createComponent<T>(Comp: Component<T>, props: T): JSX.Element {
  return untracked(() => Comp(props));
}

// dynamic import to support code splitting
export function lazy<T extends Function>(fn: () => Promise<{ default: T }>) {
  return (props: object) => {
    let Comp: T | undefined;
    const result = ref<T | undefined>(undefined);
    fn().then(component => (result.value = component.default));
    const rendered = computed(() => (Comp = get(result).value) && untracked(() => Comp?.(props)));
    return () => get(rendered).value;
  };
}

export function splitProps<T extends object, K1 extends keyof T>(
  props: T,
  ...keys: [K1[]]
): [Pick<T, K1>, Omit<T, K1>];
export function splitProps<T extends object, K1 extends keyof T, K2 extends keyof T>(
  props: T,
  ...keys: [K1[], K2[]]
): [Pick<T, K1>, Pick<T, K2>, Omit<T, K1 | K2>];
export function splitProps<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T,
  K3 extends keyof T
>(
  props: T,
  ...keys: [K1[], K2[], K3[]]
): [Pick<T, K1>, Pick<T, K2>, Pick<T, K3>, Omit<T, K1 | K2 | K3>];
export function splitProps<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T,
  K3 extends keyof T,
  K4 extends keyof T
>(
  props: T,
  ...keys: [K1[], K2[], K3[], K4[]]
): [Pick<T, K1>, Pick<T, K2>, Pick<T, K3>, Pick<T, K4>, Omit<T, K1 | K2 | K3 | K4>];
export function splitProps<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T,
  K3 extends keyof T,
  K4 extends keyof T,
  K5 extends keyof T
>(
  props: T,
  ...keys: [K1[], K2[], K3[], K4[], K5[]]
): [
  Pick<T, K1>,
  Pick<T, K2>,
  Pick<T, K3>,
  Pick<T, K4>,
  Pick<T, K5>,
  Omit<T, K1 | K2 | K3 | K4 | K5>
];
export function splitProps<T>(props: T, ...keys: [(keyof T)[]]) {
  const descriptors = Object.getOwnPropertyDescriptors(props),
    split = (k: (keyof T)[]) => {
      const clone: Partial<T> = {};
      for (let i = 0; i < k.length; i++) {
        const key = k[i];
        if (descriptors[key]) {
          Object.defineProperty(clone, key, descriptors[key]);
          delete descriptors[key];
        }
      }
      return clone;
    };
  return keys.map(split).concat(split(Object.keys(descriptors) as (keyof T)[]));
}

// context api
export function createContext(defaultValue?: unknown): Context {
  const id = Symbol("context");
  return { id, Provider: createProvider(id), defaultValue };
}

export function useContext(context: Context) {
  return lookup(globalContext, context.id) || context.defaultValue;
}

function lookup(owner: ContextOwner | null, key: symbol | string): any {
  return (
    owner && ((owner.context && owner.context[key]) || (owner.owner && lookup(owner.owner, key)))
  );
}

function resolveChildren(children: any): any {
  if (typeof children === "function") {
    const c = ref({});
    effect(() => (c.value = children()));
    return () => get(c).value;
  }
  if (Array.isArray(children)) {
    const results: any[] = [];
    for (let i = 0; i < children.length; i++) {
      let result = resolveChildren(children[i]);
      Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
    }
    return results;
  }
  return children;
}

function createProvider(id: symbol) {
  return function provider(props: { value: unknown; children: any }) {
    let rendered = ref({});
    effect(() => {
      globalContext!.context = { [id]: props.value };
      rendered.value = untracked(() => resolveChildren(props.children));
    });
    return () => get(rendered).value;
  };
}

function dispose(d: (() => void)[]) {
  for (let i = 0; i < d.length; i += 1) d[i]();
}

// https://github.com/solidjs/solid/blob/main/packages/solid/src/reactive/array.ts#L8
export function map<T, U>(
  list: () => T[],
  mapFn: (v: T, i: Ref<number>) => U,
): () => U[] {
  let items: T[] = [];
  let mapped: U[] = [];
  let disposers: (() => void)[] = [];
  let len = 0;
  let indexes: Ref<number>[] = [];

  cleanup(() => dispose(disposers));

  return () => {
    const newItems = list() || [];
    let i: number;
    let j: number;

    function mapper(disposer: () => void) {
      const index = ref(j);
      indexes[j] = index;
      disposers[j] = disposer;
      return mapFn(newItems[j], index);
    }
  
    return untracked(() => {
      const newLen = newItems.length;
      let newIndices: Map<T, number>;
      let newIndicesNext: number[];
      let temp: U[];
      let tempdisposers: (() => void)[];
      let tempIndexes: Ref<number>[];
      let start: number;
      let end: number;
      let newEnd: number;
      let item: T;

      // fast path for empty arrays
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes = [];
        }
      } else if (len === 0) {
        // fast path for new create
        mapped = new Array<U>(newLen);
        for (j = 0; j < newLen; j += 1) {
          items[j] = newItems[j];
          mapped[j] = root(mapper);
        }
        len = newLen;
      } else {
        temp = new Array<U>(newLen);
        tempdisposers = new Array<() => void>(newLen);
        tempIndexes = new Array<Ref<number>>(newLen);

        // skip common prefix
        for (
          start = 0, end = Math.min(len, newLen);
          start < end && items[start] === newItems[start];
          start += 1
        );

        // common suffix
        for (
          end = len - 1, newEnd = newLen - 1;
          end >= start && newEnd >= start && items[end] === newItems[newEnd];
          end -= 1, newEnd -= 1
        ) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          tempIndexes[newEnd] = indexes[end];
        }

        // 0) prepare a map of all indices in newItems,
        // scanning backwards so we encounter them in natural order
        newIndices = new Map<T, number>();
        newIndicesNext = new Array<number>(newEnd + 1);
        for (j = newEnd; j >= start; j -= 1) {
          item = newItems[j];
          i = newIndices.get(item)!;
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        // 1) step through all old items and see if they can be found
        // in the new set; if so, save them in a temp array and
        // mark them moved; if not, exit them
        for (i = start; i <= end; i += 1) {
          item = items[i];
          j = newIndices.get(item)!;
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            tempIndexes![j] = indexes[i];
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        // 2) set all the new values, pulling from the temp array if copied,
        // otherwise entering the new value
        for (j = start; j < newLen; j += 1) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            indexes[j] = tempIndexes![j];
            indexes[j].value = j;
          } else mapped[j] = root(mapper);
        }
        // 3) in case the new set is shorter than the old, set the length of the mapped array
        mapped = mapped.slice(0, (len = newLen));
        // 4) save a copy of the mapped items for the next update
        items = newItems.slice(0);
      }
      return mapped;
    });
  };
}
