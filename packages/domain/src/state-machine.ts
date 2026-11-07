export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export class InvalidTransitionError extends Error {
  constructor(
    public readonly machine: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`${machine}: transition from "${from}" to "${to}" is not allowed`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransition<S extends string>(map: TransitionMap<S>, from: S, to: S): boolean {
  return map[from].includes(to);
}

export function assertTransition<S extends string>(
  machine: string,
  map: TransitionMap<S>,
  from: S,
  to: S,
): void {
  if (!canTransition(map, from, to)) {
    throw new InvalidTransitionError(machine, from, to);
  }
}

export function terminalStates<S extends string>(map: TransitionMap<S>): S[] {
  return (Object.keys(map) as S[]).filter((s) => map[s].length === 0);
}
