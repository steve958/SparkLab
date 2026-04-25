import manifest from "../../public/elements/manifest.json";

/**
 * One entry per element from the spark_lab_element_png_pack manifest.
 * Includes name spellings that may differ from elements.json (e.g. Aluminium /
 * Caesium), so we always look up by symbol.
 */
interface ElementImageEntry {
  atomic_number: number;
  symbol: string;
  name: string;
  category: string;
  png_512: string;
  svg_source: string;
}

const entries = manifest as ElementImageEntry[];
const bySymbol = new Map<string, ElementImageEntry>(entries.map((e) => [e.symbol, e]));

/** Public URL for the 512×512 PNG card, or null if no asset exists. */
export function getElementImageUrl(symbol: string): string | null {
  const entry = bySymbol.get(symbol);
  if (!entry) return null;
  return `/elements/${entry.png_512}`;
}

/** Public URL for the matching SVG source, or null. */
export function getElementSvgUrl(symbol: string): string | null {
  const entry = bySymbol.get(symbol);
  if (!entry) return null;
  return `/elements/${entry.svg_source}`;
}
