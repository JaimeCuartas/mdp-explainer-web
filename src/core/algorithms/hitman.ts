import { init } from 'z3-solver';
import type { Bool, Context, Optimize } from 'z3-solver';

type Z3Api = Awaited<ReturnType<typeof init>>;

let z3Promise: Promise<Z3Api> | null = null;

function loadZ3(): Promise<Z3Api> {
  z3Promise ??= init();
  return z3Promise;
}

export class Hitman<T> {
  private readonly ctx: Context;
  private readonly optimizer: Optimize;
  private readonly key: (object: T) => unknown;

  private readonly objects: T[] = [];
  private readonly variables: Bool[] = [];
  private readonly variableIdByKey = new Map<unknown, number>();

  private constructor(ctx: Context, key: (object: T) => unknown) {
    this.ctx = ctx;
    this.optimizer = new ctx.Optimize();
    this.key = key;
  }

  static async create<T>(key: (object: T) => unknown = (object) => object): Promise<Hitman<T>> {
    const { Context } = await loadZ3();
    return new Hitman<T>(Context('main'), key);
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
    // Prefer leaving every object out of the hitting set.
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
    return this.objects.filter((_, index) => this.ctx.isTrue(model.eval(this.variables[index], true)));
  }
}
