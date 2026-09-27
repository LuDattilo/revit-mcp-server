import { z, ZodTypeAny } from "zod";

/**
 * Builds a sample value for a zod schema.
 *
 * - "min":  only required fields are populated (optional / defaulted fields are omitted).
 * - "full": every field is populated, so a handler that silently drops a
 *           declared parameter is caught by the pass-through assertion.
 *
 * Returns `undefined` for an omitted field. The result is NOT guaranteed to satisfy
 * refinements; callers validate it with `safeParse` and fall back to a hand-written
 * fixture when it does not.
 */
export type SampleMode = "min" | "full";

const MAX_DEPTH = 6;

export function sampleFor(schema: ZodTypeAny, mode: SampleMode, key = "value", depth = 0): unknown {
  const def: any = (schema as any)._def;
  const typeName: string = def?.typeName;

  switch (typeName) {
    case "ZodOptional":
      return mode === "min" ? undefined : sampleFor(def.innerType, mode, key, depth);
    case "ZodDefault":
      return mode === "min" ? undefined : sampleFor(def.innerType, mode, key, depth);
    case "ZodNullable":
      return sampleFor(def.innerType, mode, key, depth);
    case "ZodEffects":
      return sampleFor(def.schema, mode, key, depth);
    case "ZodLazy":
      return sampleFor(def.getter(), mode, key, depth);
    case "ZodBranded":
      return sampleFor(def.type, mode, key, depth);
    case "ZodCatch":
      return sampleFor(def.innerType, mode, key, depth);
    case "ZodPipeline":
      return sampleFor(def.in, mode, key, depth);

    case "ZodString": {
      const checks: any[] = def.checks ?? [];
      let s = `${key}_sample`;
      for (const c of checks) {
        if (c.kind === "email") s = "user@example.com";
        if (c.kind === "url") s = "https://example.com/x";
        if (c.kind === "uuid") s = "00000000-0000-4000-8000-000000000000";
      }
      const min = checks.find((c) => c.kind === "min")?.value;
      const max = checks.find((c) => c.kind === "max")?.value;
      const len = checks.find((c) => c.kind === "length")?.value;
      if (len !== undefined) s = "x".repeat(len);
      if (min !== undefined && s.length < min) s = s.padEnd(min, "x");
      if (max !== undefined && s.length > max) s = s.slice(0, max);
      return s;
    }
    case "ZodNumber": {
      const checks: any[] = def.checks ?? [];
      const min = checks.find((c) => c.kind === "min");
      const max = checks.find((c) => c.kind === "max");
      let n = 1;
      if (min) n = min.inclusive ? min.value : min.value + 1;
      if (max && n > max.value) n = max.inclusive ? max.value : max.value - 1;
      if (min && max && !min.inclusive && !checks.some((c) => c.kind === "int")) {
        n = (min.value + max.value) / 2;
      }
      return n;
    }
    case "ZodBigInt":
      return BigInt(1);
    case "ZodBoolean":
      return true;
    case "ZodDate":
      return new Date(0);
    case "ZodLiteral":
      return def.value;
    case "ZodEnum":
      return def.values[0];
    case "ZodNativeEnum":
      return Object.values(def.values)[0];
    case "ZodAny":
    case "ZodUnknown":
      return `${key}_any`;
    case "ZodNull":
      return null;

    case "ZodArray": {
      if (depth > MAX_DEPTH) return [];
      const minLen = def.minLength?.value ?? def.exactLength?.value ?? 1;
      const count = Math.max(1, minLen);
      const items: unknown[] = [];
      for (let i = 0; i < count; i++) {
        items.push(sampleFor(def.type, mode === "min" ? "min" : "full", key, depth + 1));
      }
      return items;
    }
    case "ZodTuple":
      return def.items.map((t: ZodTypeAny, i: number) => sampleFor(t, mode, `${key}${i}`, depth + 1));
    case "ZodSet":
      return new Set([sampleFor(def.valueType, mode, key, depth + 1)]);
    case "ZodRecord":
      return { [`${key}_key`]: sampleFor(def.valueType, mode, key, depth + 1) };
    case "ZodMap":
      return new Map([[sampleFor(def.keyType, mode, key, depth + 1), sampleFor(def.valueType, mode, key, depth + 1)]]);

    case "ZodObject": {
      if (depth > MAX_DEPTH) return {};
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      return sampleShape(shape, mode, depth + 1);
    }
    case "ZodUnion":
    case "ZodDiscriminatedUnion": {
      const options: ZodTypeAny[] = Array.isArray(def.options) ? def.options : Array.from(def.options.values());
      return sampleFor(options[0], mode, key, depth);
    }
    case "ZodIntersection": {
      const l = sampleFor(def.left, mode, key, depth) as any;
      const r = sampleFor(def.right, mode, key, depth) as any;
      return typeof l === "object" && typeof r === "object" ? { ...l, ...r } : l;
    }
    default:
      throw new Error(`zodSample: unsupported zod type '${typeName}' for key '${key}'`);
  }
}

export function sampleShape(shape: Record<string, ZodTypeAny>, mode: SampleMode, depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(shape)) {
    const value = sampleFor(v, mode, k, depth);
    if (value !== undefined) out[k] = value;
  }
  return out;
}

/** True when the schema accepts `undefined` (optional or defaulted). */
export function isOptional(schema: ZodTypeAny): boolean {
  return schema.safeParse(undefined).success;
}

/**
 * Returns a JSON value of the wrong type that `schema` rejects, or undefined when the
 * field accepts anything we can think of (e.g. z.any()).
 */
export function wrongValueFor(schema: ZodTypeAny): unknown {
  const candidates: unknown[] = [12345, "not-the-right-type", true, [], { unexpected: 1 }, null];
  for (const c of candidates) {
    if (!schema.safeParse(c).success) return c;
  }
  return undefined;
}

export { z };
