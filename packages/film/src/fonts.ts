// The type catalogue: families (SIL OFL 1.1) with distinct voices, so two
// films never have to look alike. Each says what it sounds like, which weights
// it has, and how it sets a headline (weight, tracking, line height, capitals).
// The model picks a display face and a text face by name; their files are
// copied into the project; scripts/font-metrics.ts measures each one for the
// layout. Only the faces a film cannot do without are shipped (fonts/: Inter,
// the fallback, and JetBrains Mono, for code); the others are fetched from
// google/fonts when a film first uses them, at the commit they were measured
// from, so the layout always measures the file it draws.

export interface Family {
  /** the name the model writes */
  name: string;
  /** its file in the project (and in fonts/ when shipped) */
  file: string;
  license: string;
  /** where it is fetched in google/fonts (ofl/…) when it is not shipped */
  remote?: string;
  /** CSS weight range of the file ('100 900', or one weight) */
  weight: string;
  /** the weights measured for the layout (others are interpolated) */
  measure: number[];
  /** a paragraph, a name or a figure, a headline */
  regular: number;
  strong: number;
  display: number;
  tracking: number;
  lineHeight: number;
  /** set in capitals */
  upper?: boolean;
  kind: 'grotesk' | 'geometric' | 'expressive' | 'serif' | 'condensed' | 'mono';
  /** what it says, for the model */
  voice: string;
}

const range = (lo: number, hi: number) => [300, 400, 500, 600, 700, 800].filter((w) => w >= lo && w <= hi);

export const FAMILIES: Family[] = [
  { name: 'Inter', file: 'Inter.ttf', license: 'inter-license.json', weight: '100 900', measure: [300, 400, 500, 600, 700, 800, 900], regular: 420, strong: 640, display: 600, tracking: -0.025, lineHeight: 1.06, kind: 'grotesk', voice: 'neutral and precise: product, software, interfaces' },
  { name: 'Space Grotesk', file: 'SpaceGrotesk.ttf', license: 'spacegrotesk-license.json', remote: 'spacegrotesk/SpaceGrotesk[wght].ttf', weight: '300 700', measure: range(300, 700), regular: 400, strong: 600, display: 600, tracking: -0.03, lineHeight: 1.04, kind: 'grotesk', voice: 'technical with quirks: developer tools, crypto, engineering' },
  { name: 'Sora', file: 'Sora.ttf', license: 'sora-license.json', remote: 'sora/Sora[wght].ttf', weight: '100 800', measure: range(300, 800), regular: 400, strong: 600, display: 600, tracking: -0.03, lineHeight: 1.06, kind: 'geometric', voice: 'clean geometric, calm confidence: AI, cloud, modern tech' },
  { name: 'Manrope', file: 'Manrope.ttf', license: 'manrope-license.json', remote: 'manrope/Manrope[wght].ttf', weight: '200 800', measure: range(300, 800), regular: 450, strong: 700, display: 700, tracking: -0.03, lineHeight: 1.06, kind: 'geometric', voice: 'warm, rounded, friendly: finance for everyone, consumer apps, health' },
  { name: 'Bricolage Grotesque', file: 'BricolageGrotesque.ttf', license: 'bricolagegrotesque-license.json', remote: 'bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf', weight: '200 800', measure: range(300, 800), regular: 400, strong: 650, display: 700, tracking: -0.035, lineHeight: 1.0, kind: 'expressive', voice: 'contemporary with character: creative tools, startups with a voice, culture' },
  { name: 'Syne', file: 'Syne.ttf', license: 'syne-license.json', remote: 'syne/Syne[wght].ttf', weight: '400 800', measure: range(400, 800), regular: 400, strong: 600, display: 700, tracking: -0.02, lineHeight: 1.02, kind: 'expressive', voice: 'art school, wide and unexpected: events, fashion, music, galleries' },
  { name: 'Anton', file: 'Anton.ttf', license: 'anton-license.json', remote: 'anton/Anton-Regular.ttf', weight: '400', measure: [400], regular: 400, strong: 400, display: 400, tracking: 0.005, lineHeight: 0.98, upper: true, kind: 'condensed', voice: 'condensed, loud capitals: sport, manifestos, sales, posters' },
  { name: 'Fraunces', file: 'Fraunces.ttf', license: 'fraunces-license.json', remote: 'fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf', weight: '100 900', measure: range(300, 800), regular: 400, strong: 600, display: 500, tracking: -0.02, lineHeight: 1.04, kind: 'serif', voice: 'soft and characterful serif: food, lifestyle, books, warm brands' },
  { name: 'Playfair Display', file: 'PlayfairDisplay.ttf', license: 'playfairdisplay-license.json', remote: 'playfairdisplay/PlayfairDisplay[wght].ttf', weight: '400 900', measure: range(400, 800), regular: 400, strong: 600, display: 500, tracking: -0.015, lineHeight: 1.04, kind: 'serif', voice: 'classic high contrast: luxury, fashion, private banking, heritage' },
  { name: 'DM Serif Display', file: 'DMSerifDisplay.ttf', license: 'dmserifdisplay-license.json', remote: 'dmserifdisplay/DMSerifDisplay-Regular.ttf', weight: '400', measure: [400], regular: 400, strong: 400, display: 400, tracking: -0.01, lineHeight: 1.02, kind: 'serif', voice: 'elegant display serif: editorial headlines, events, premium services' },
  { name: 'Instrument Serif', file: 'InstrumentSerif-Regular.ttf', license: 'serif-license.json', remote: 'instrumentserif/InstrumentSerif-Regular.ttf', weight: '400', measure: [400], regular: 400, strong: 400, display: 400, tracking: -0.012, lineHeight: 1.02, kind: 'serif', voice: 'refined, a little condensed: data stories, reports, institutions' },
  { name: 'JetBrains Mono', file: 'JetBrainsMono.ttf', license: 'mono-license.json', weight: '100 800', measure: [400, 700], regular: 400, strong: 700, display: 600, tracking: -0.01, lineHeight: 1.1, kind: 'mono', voice: 'monospace: code, terminals, data, labels' },
];

export const familyNames = FAMILIES.map((f) => f.name);
export const familyOf = (name: string | undefined): Family | undefined => FAMILIES.find((f) => f.name.toLowerCase() === (name ?? '').toLowerCase());

/** the asset id of a shipped family in a project */
export const fontAsset = (f: Family) => `font-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** google/fonts at the commit the catalogue was measured from */
const GOOGLE_FONTS = 'https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/';

/** a file a film copies into its project: shipped in fonts/, or fetched (a license fetched as text is wrapped as the shipped ones are) */
export interface FontFile { path: string; shipped?: string; url?: string; licenseOf?: string }

/** the files of a family, by their path in the project */
export function familyFiles(f: Family): FontFile[] {
  const at = (name: string) => `assets/fonts/${name}`;
  if (!f.remote) return [{ path: at(f.file), shipped: f.file }, { path: at(f.license), shipped: f.license }];
  const dir = GOOGLE_FONTS + f.remote.slice(0, f.remote.indexOf('/') + 1);
  return [{ path: at(f.file), url: GOOGLE_FONTS + encodeURI(f.remote) }, { path: at(f.license), url: `${dir}OFL.txt`, licenseOf: f.name }];
}

/** the bytes of a film's file: a shipped one read by `shipped`, the others fetched */
export async function fontFile(f: FontFile, shipped: (name: string) => Promise<Uint8Array>): Promise<Uint8Array> {
  if (f.shipped) return shipped(f.shipped);
  const r = await fetch(f.url!);
  if (!r.ok) throw new Error(`film: ${f.url} could not be fetched (HTTP ${r.status}); import the font into the project instead`);
  if (!f.licenseOf) return new Uint8Array(await r.arrayBuffer());
  return new TextEncoder().encode(JSON.stringify({ font: `${f.licenseOf} (SIL OFL 1.1)`, license: await r.text() }, null, 1));
}
