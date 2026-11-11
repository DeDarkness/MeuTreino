/** Writes are evaluated in order against the last durable state, never a speculative snapshot. */
export function createWriteQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  let generation = 0;
  let pending = 0;
  return {
    get busy() { return pending > 0; },
    async idle() { await tail.catch(() => undefined); },
    run<T>(work: () => Promise<T>): Promise<T> {
      const ticket = generation;
      pending++;
      const next = tail.catch(() => undefined).then(async () => {
        if (ticket !== generation) throw new Error('Uma gravação anterior falhou. Esta ação foi cancelada; tente novamente.');
        try { return await work(); }
        catch (error) { generation++; throw error; }
      }).finally(() => { pending--; });
      tail = next;
      return next;
    },
  };
}
