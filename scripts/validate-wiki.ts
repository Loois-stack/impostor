/**
 * Resuelve la imagen de Wikipedia de cada carta y la guarda en src/data/images.json
 * (así el juego no tiene que consultar la API en cada partida). Reporta las que fallan.
 *   npm run validate-wiki
 */
import { writeFileSync } from 'node:fs';
import { ITEMS } from '../src/data';

type Lang = 'en' | 'es';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA ='ImpostorPartyGame/1.0 (juego personal; build-time image lookup)';

function parse(t: string): { lang: Lang; title: string } {
  return t.startsWith('es:') ? { lang: 'es', title: t.slice(3) } : { lang: 'en', title: t };
}

async function batch(lang: Lang, titles: string[]): Promise<Record<string, string>> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=640&pilicense=any&titles=${encodeURIComponent(titles.join('|'))}`;
  let res = await fetch(url, { headers: { 'User-Agent': UA } });
  for (let attempt = 1; res.status === 429 && attempt <= 5; attempt++) {
    await sleep(attempt * 5000);
    res = await fetch(url, { headers: { 'User-Agent': UA } });
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await sleep(1500);
  const json = (await res.json()) as {
    query?: {
      normalized?: { from: string; to: string }[];
      redirects?: { from: string; to: string }[];
      pages?: { title: string; thumbnail?: { source: string } }[];
    };
  };
  const q = json.query ?? {};
  const byTitle: Record<string, string> = {};
  for (const p of q.pages ?? []) if (p.thumbnail) byTitle[p.title] = p.thumbnail.source;
  const out: Record<string, string> = {};
  for (const t of titles) {
    let cur = t;
    cur = q.normalized?.find((n) => n.from === cur)?.to ?? cur;
    cur = q.redirects?.find((n) => n.from === cur)?.to ?? cur;
    if (byTitle[cur]) out[t] = byTitle[cur];
  }
  return out;
}

async function main() {
  const wanted = new Map<string, { lang: Lang; title: string }>();
  for (const it of ITEMS) for (const t of it.wiki.split('|').filter(Boolean)) wanted.set(t, parse(t));

  const resolved: Record<string, string> = {};
  for (const lang of ['en', 'es'] as Lang[]) {
    const list = [...wanted].filter(([, v]) => v.lang === lang);
    for (let i = 0; i < list.length; i += 40) {
      const chunk = list.slice(i, i + 40);
      const got = await batch(lang, chunk.map(([, v]) => v.title));
      for (const [key, v] of chunk) if (got[v.title]) resolved[key] = got[v.title];
    }
  }

  const images: Record<string, string> = {};
  const missing: string[] = [];
  const noWiki: string[] = [];
  for (const it of ITEMS) {
    if (!it.wiki) {
      noWiki.push(it.id);
      continue;
    }
    const hit = it.wiki.split('|').find((t) => resolved[t]);
    if (hit) images[it.id] = resolved[hit];
    else missing.push(`${it.id} (${it.wiki})`);
  }

  writeFileSync(new URL('../src/data/images.json', import.meta.url), JSON.stringify(images, null, 1) + '\n');
  const withWiki = ITEMS.length - noWiki.length;
  console.log(`Imágenes: ${Object.keys(images).length}/${withWiki} (${Math.round((Object.keys(images).length / withWiki) * 100)}%)`);
  console.log(`Arte propio (sin wiki): ${noWiki.length}`);
  if (missing.length) console.log(`Sin imagen:\n  ${missing.join('\n  ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
