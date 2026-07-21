// WS-X1 枚举缝:把运行时【展开后】的 TECHNIQUE_SETTINGS_SCHEMA 忠实 dump 成 JSON。
//
// 为什么走 jest 而不是 Node 直读/AST:该文件 import 组件模块(DunJiaCalc/ziweiOptions/…),
// Node 裸 require 必炸;共享字段数组(TIME_FIELDS 等)spread 进多技法 + PROGRESSION_EMPTY_KEYS
// 运行时补注册 —— 静态 AST 必漏。umi-test 环境是唯一忠实读法(既有 techniqueMountSettings.test
// 已证此路通)。
//
// 平时 `npm test` 本文件自动 skip(零污染);枚举时:
//   HOROSA_DUMP_MATRIX=1 npx umi-test --testPathPattern=dumpSettingsMatrix
// 产物: build/perf/matrix-schema.json(仓根 build/,与 ladder/chunk 留档同区)
import fs from 'fs';
import path from 'path';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../techniqueMountSettings';

const enabled = process.env.HOROSA_DUMP_MATRIX === '1';
const maybe = enabled ? it : it.skip;

maybe('dump TECHNIQUE_SETTINGS_SCHEMA 全展开矩阵', () => {
	const repoRoot = path.join(__dirname, '..', '..', '..', '..', '..');
	const outDir = path.join(repoRoot, 'build', 'perf');
	fs.mkdirSync(outDir, { recursive: true });
	const schemaPath = path.join(__dirname, '..', 'techniqueMountSettings.js');
	const out = {
		dumpedBy: 'dumpSettingsMatrix.seam.test.js',
		schemaFileBytes: fs.statSync(schemaPath).size,
		techniques: {},
	};
	for(const [key, sch] of Object.entries(TECHNIQUE_SETTINGS_SCHEMA)){
		out.techniques[key] = {
			kind: sch.kind || null,
			optionsPath: sch.optionsPath !== undefined ? sch.optionsPath : null,
			group: sch.group || null,
			emptyHint: sch.emptyHint || sch.reason || null,
			fields: (sch.fields || []).map((f) => ({
				name: f.name,
				label: f.label,
				type: f.type,
				group: f.group || null,
				default: f.default !== undefined ? f.default : null,
				when: f.when || null,
				min: f.min !== undefined ? f.min : null,
				max: f.max !== undefined ? f.max : null,
				values: (f.options || []).map((o) => ({ value: o.value, label: o.label })),
			})),
		};
	}
	const dst = path.join(outDir, 'matrix-schema.json');
	fs.writeFileSync(dst, JSON.stringify(out, null, 1));
	// 防倒退锚:技法数收缩=schema 被误删(2026-07-16 实测 60 kind 条目)
	expect(Object.keys(out.techniques).length).toBeGreaterThanOrEqual(58);
	// eslint-disable-next-line no-console
	console.log(`[dump-matrix] ${Object.keys(out.techniques).length} 技法 → ${dst}`);
});

it('schema 形态锚:每技法有 kind,每 field 有 name/type(枚举器契约)', () => {
	for(const [key, sch] of Object.entries(TECHNIQUE_SETTINGS_SCHEMA)){
		expect(typeof sch.kind).toBe('string');
		for(const f of sch.fields || []){
			if(!f.name || !f.type){
				throw new Error(`技法 ${key} 存在缺 name/type 的 field: ${JSON.stringify(f).slice(0, 120)}`);
			}
		}
	}
});
