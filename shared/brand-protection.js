// Protected brand matching, shared by the server (which enforces it) and the staff
// UI (which previews it). The list is stored one entry per line:
//   minecraft        protect the brand
//   !pineapple       allow this exact name even though it matches a brand

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };
const ENTRY = /^!?[a-z0-9][a-z0-9-]{1,62}$/;

const compact = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// The spellings a name could be read as: as typed, digits read as letters, and "1" as "l".
function readings(value) {
  const base = compact(value);
  const letters = base.replace(/[0-9]/g, (digit) => LEET[digit] ?? digit);
  return [...new Set([base, letters, letters.replace(/i/g, (_, index) => (base[index] === '1' ? 'l' : 'i'))])];
}

export function parseBrandList(value) {
  const lines = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/);
  const brands = new Set();
  const allowed = new Set();
  for (const raw of lines) {
    const entry = String(raw).trim().toLowerCase();
    if (!ENTRY.test(entry)) continue;
    if (entry.startsWith('!')) allowed.add(entry.slice(1));
    else brands.add(entry);
  }
  return { brands: [...brands], allowed: [...allowed] };
}

// Normalise a pasted list for storage: valid entries only, de-duplicated, brands first.
export function normaliseBrandList(value) {
  const { brands, allowed } = parseBrandList(value);
  return [...brands.sort(), ...allowed.sort().map((name) => `!${name}`)].join('\n');
}

// Returns the protected brand a requested name imitates, or null.
// A name matches when, ignoring punctuation and common digit swaps (m1necraft):
//  - the whole name is the brand (minecraft, mine-craft);
//  - it starts or ends with the brand (minecraftserver, playminecraft);
//  - a run of its words is the brand (get-minecraft-free, play.minecraft).
export function matchProtectedBrand(subdomain, list) {
  const { brands, allowed } = Array.isArray(list?.brands) ? list : parseBrandList(list);
  const name = String(subdomain || '').trim().toLowerCase().replace(/\.$/, '');
  if (!name || allowed.includes(name) || allowed.includes(compact(name))) return null;
  const words = name.split(/[^a-z0-9]+/).filter(Boolean);
  for (const brand of brands) {
    const target = compact(brand);
    if (target.length < 2) continue;
    const whole = readings(name);
    if (whole.some((reading) => reading === target || reading.startsWith(target) || reading.endsWith(target))) return brand;
    for (let start = 0; start < words.length; start++) {
      for (let end = start + 1; end <= words.length; end++) {
        if (readings(words.slice(start, end).join('')).includes(target)) return brand;
      }
    }
  }
  return null;
}

export function protectedBrandMessage(subdomain, brand) {
  return `"${subdomain}" looks like the protected brand "${brand}" and can't be registered. If you represent ${brand}, contact support.`;
}
