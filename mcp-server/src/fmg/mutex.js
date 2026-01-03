export class Mutex {
  #tail = Promise.resolve();

  async runExclusive(fn) {
    const run = async () => fn();
    const next = this.#tail.then(run, run);
    this.#tail = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

