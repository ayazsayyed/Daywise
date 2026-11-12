export type ClearArgs = { tenant: string; destination?: string };

const USAGE = "Usage: pnpm learnings:clear --tenant <slug> [--destination <name>]";

export function parseClearArgs(argv: string[]): ClearArgs {
  const out: Partial<ClearArgs> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.split("=", 2) as [string, string | undefined];
    const value = () => {
      const v = inline ?? argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${flag} needs a value. ${USAGE}`);
      return v.trim();
    };
    if (flag === "--tenant") out.tenant = value();
    else if (flag === "--destination") out.destination = value();
    else if (a === "--") continue;
    else throw new Error(`Unknown argument "${a}". ${USAGE}`);
  }
  if (!out.tenant) throw new Error(USAGE);
  return out as ClearArgs;
}
