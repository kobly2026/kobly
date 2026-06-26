// Kobly — registry de adaptadores de plataforma. O allowlist de providers É as chaves daqui.
import type { Adapter } from "./types.ts";
import { generic } from "./generic.ts";
import { nexopayt } from "./nexopayt.ts";

export type { Adapter, NormalizedEvent, ParseResult } from "./types.ts";

export const ADAPTERS: Record<string, Adapter> = {
  generic,
  nexopayt,
  // TODO: hotmart, kiwify, perfectpay, kactus — 1 arquivo cada quando a doc chegar.
};

export function getAdapter(name?: string | null): Adapter {
  return ADAPTERS[name || "generic"] ?? ADAPTERS.generic;
}

export function isKnownProvider(name?: string | null): boolean {
  return !!name && name in ADAPTERS;
}
