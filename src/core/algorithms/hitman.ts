import { init } from 'z3-solver';
import type { Bool, Context, Optimize } from 'z3-solver';

let contextPromise: Promise<Context> | null = null;

function loadContext(): Promise<Context> {
  contextPromise ??= init().then(({ Context }) => Context('main'));
  return contextPromise;
}

export class Hitman<T> {
  private readonly ctx: Context;
  private readonly optimizer: Optimize;
  private readonly key: (object: T) => unknown;

  private readonly objects: T[] = [];
  private readonly variables: Bool[] = [];
  private readonly variableIdByKey = new Map<unknown, number>();
  private released = false;

  private constructor(ctx: Context, key: (object: T) => unknown) {
    this.ctx = ctx;
    this.optimizer = new ctx.Optimize();
    this.key = key;
  }

  static async create<T>(key: (object: T) => unknown = (object) => object): Promise<Hitman<T>> {
    return new Hitman<T>(await loadContext(), key);
  }

  get vector(): readonly T[] {
    return this.objects;
  }

  idOf(object: T): number {
    const objectKey = this.key(object);
    const existingId = this.variableIdByKey.get(objectKey);
    if (existingId !== undefined) {
      return existingId;
    }

    const id = this.objects.length + 1;
    const variable = this.ctx.Bool.const(`h${id}`);
    this.objects.push(object);
    this.variables.push(variable);
    this.variableIdByKey.set(objectKey, id);
    this.optimizer.addSoft(this.ctx.Not(variable), 1);
    return id;
  }

  hit(set: T[]): number[] {
    const clause = set.map((object) => this.idOf(object));
    this.optimizer.add(this.ctx.Or(...clause.map((id) => this.variables[id - 1])));
    return clause;
  }

  block(set: T[]): number[] {
    const ids = set.map((object) => this.idOf(object));
    this.optimizer.add(this.ctx.Or(...ids.map((id) => this.ctx.Not(this.variables[id - 1]))));
    return ids.map((id) => -id);
  }

  async get(): Promise<T[] | null> {
    const result = await this.optimizer.check();
    if (result === 'unsat') {
      return null;
    }
    if (result === 'unknown') {
      throw new Error(`Hitman: Z3 returned 'unknown' (${this.optimizer.reasonUnknown()})`);
    }

    const model = this.optimizer.model();
    try {
      return this.objects.filter((_, index) => this.ctx.isTrue(model.eval(this.variables[index], true)));
    } finally {
      model.release();
    }
  }

  /// Explicitly free the optimizer function from memory
  release(): void {
    if (this.released) {
      return;
    }
    this.released = true;
    this.optimizer.release();
  }
}
