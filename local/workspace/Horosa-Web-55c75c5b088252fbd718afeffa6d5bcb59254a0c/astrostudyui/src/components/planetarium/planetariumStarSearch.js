// Pure, BABYLON-free helpers for: (1) picking the nearest star to a click ray,
// (2) building a name index and searching stars by name — like mature planetarium software.
// Kept dependency-free so it is unit-testable in node (jest). PlanetariumBabylon.js
// supplies world positions / the pick ray and consumes the returned star objects.
//
// 纯增量:只新增「点最近星 + 按名搜索」能力,不改任何既有星点渲染/坐标/星等/既有点击行为。

import { STAR_PROPER_NAMES } from './planetariumStarNames';
import { matchesUserQuery, scriptMatchKey } from '../../utils/scriptMode';

// 名字比对(单源):界面繁体时照屏幕输入繁体(「織女一」)也能命中简体星名;简体模式与原先逐字节等价。
const hitLabel = (e, q, opts) => !!(e.label && matchesUserQuery(`${e.label}`, q, opts));

function norm3(x, y, z) {
	const m = Math.sqrt(x * x + y * y + z * z);
	if (!(m > 0)) {
		return null;
	}
	return [x / m, y / m, z / m];
}

// Angle (degrees) between two 3D vectors.
export function angleBetweenDeg(ax, ay, az, bx, by, bz) {
	const a = norm3(ax, ay, az);
	const b = norm3(bx, by, bz);
	if (!a || !b) {
		return 180;
	}
	let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	dot = Math.max(-1, Math.min(1, dot));
	return Math.acos(dot) * 180 / Math.PI;
}

// Find the point whose direction from the ray origin is closest (smallest angle) to the
// ray direction, within maxAngleDeg and in front of the camera. points: [{x,y,z, ...meta}].
// Returns the winning point object (with added `_angleDeg`) or null.
export function nearestPointToRay(origin, dir, points, maxAngleDeg) {
	if (!origin || !dir || !points || !points.length) {
		return null;
	}
	const d = norm3(dir.x, dir.y, dir.z);
	if (!d) {
		return null;
	}
	const limit = Number.isFinite(maxAngleDeg) ? maxAngleDeg : 2.5;
	let best = null;
	let bestAng = limit;
	for (let i = 0; i < points.length; i += 1) {
		const p = points[i];
		const vx = p.x - origin.x;
		const vy = p.y - origin.y;
		const vz = p.z - origin.z;
		// in front of camera (same hemisphere as the ray)
		if (vx * d[0] + vy * d[1] + vz * d[2] <= 0) {
			continue;
		}
		const ang = angleBetweenDeg(vx, vy, vz, d[0], d[1], d[2]);
		if (ang < bestAng) {
			bestAng = ang;
			best = p;
		}
	}
	if (best) {
		return { ...best, _angleDeg: bestAng };
	}
	return null;
}

function pushKey(map, key, star) {
	if (!key) {
		return;
	}
	const k = `${key}`.trim().toLowerCase();
	if (k && !map.has(k)) {
		map.set(k, star);
	}
}

// Build a search index over the star catalog: exact-key map + an ordered entry list
// (brighter stars first) for prefix/substring autocomplete. Enriches with proper/Chinese
// names (e.g. 天狼/Sirius) from STAR_PROPER_NAMES, keyed by HR id or Bayer.
export function buildStarIndex(catalog, properNames) {
	const names = properNames || STAR_PROPER_NAMES || {};
	const byKey = new Map();
	const entries = [];
	(catalog || []).forEach((star) => {
		if (!star) {
			return;
		}
		const hr = star.id ? `${star.id}`.replace(/^bsc5-/i, '') : '';
		const proper = (star.id && names[star.id]) || (hr && names[`HR${hr}`]) || (hr && names[hr]) || null;
		const zh = proper && proper.zh ? proper.zh : null;
		const en = proper && proper.proper ? proper.proper : null;
		// 星座缩写不单独入索引:精确命中会落到目录里该座随便哪一颗星(按目录序,不是最亮)。
		// 拜耳 / 弗兰斯蒂德名里本就带缩写(如「α CMa」),按星名搜仍能找到该座的星。
		[star.name, star.bayer, star.flamsteed, star.id, hr && `HR ${hr}`, hr && `HR${hr}`, en, zh]
			.forEach((k) => pushKey(byKey, k, star));
		const label = zh ? `${zh}${en ? ` ${en}` : ''}` : (en || star.name || star.id);
		entries.push({
			star,
			label,
			zh,
			proper: en,
			mag: Number.isFinite(Number(star.mag)) ? Number(star.mag) : 99,
			haystack: [star.name, star.bayer, star.flamsteed, star.id, hr, en, zh]
				.filter(Boolean).join(' ').toLowerCase(),
		});
	});
	entries.sort((a, b) => a.mag - b.mag);
	return { byKey, entries };
}

// Resolve a query to a single star: exact key, then brightest prefix, then brightest substring.
export function findStarByName(index, query) {
	if (!index || !query) {
		return null;
	}
	const q = `${query}`.trim().toLowerCase();
	if (!q) {
		return null;
	}
	if (index.byKey.has(q)) {
		return index.byKey.get(q);
	}
	const qk = scriptMatchKey(q).toLowerCase();
	if (qk !== q && index.byKey.has(qk)) {
		return index.byKey.get(qk);
	}
	const pre = index.entries.find((e) => matchesUserQuery(e.haystack, q, { prefix: true }) || hitLabel(e, q, { prefix: true }));
	if (pre) {
		return pre.star;
	}
	const sub = index.entries.find((e) => matchesUserQuery(e.haystack, q));
	return sub ? sub.star : null;
}

// Look up a star's proper/Chinese name ({zh, proper}) by HR id, or null.
export function starProperName(star, properNames) {
	const names = properNames || STAR_PROPER_NAMES || {};
	if (!star) {
		return null;
	}
	const hr = star.id ? `${star.id}`.replace(/^bsc5-/i, '') : '';
	return (star.id && names[star.id]) || (hr && names[`HR${hr}`]) || (hr && names[hr]) || null;
}

// Display label like "织女一 Vega" for named stars, else null (caller falls back to catalog name).
export function starDisplayLabel(star, properNames) {
	const p = starProperName(star, properNames);
	if (!p) {
		return null;
	}
	if (p.zh) {
		return p.proper ? `${p.zh} ${p.proper}` : p.zh;
	}
	return p.proper || null;
}

// Autocomplete suggestions (brightest-first), for the search dropdown.
export function suggestStars(index, query, limit) {
	if (!index || !index.entries) {
		return [];
	}
	const q = `${query || ''}`.trim().toLowerCase();
	const cap = Number.isFinite(limit) ? limit : 8;
	if (!q) {
		return [];
	}
	const out = [];
	for (let i = 0; i < index.entries.length && out.length < cap; i += 1) {
		const e = index.entries[i];
		if (matchesUserQuery(e.haystack, q) || hitLabel(e, q)) {
			out.push(e);
		}
	}
	return out;
}
