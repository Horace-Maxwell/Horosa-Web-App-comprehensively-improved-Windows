// 【总锁】「王牌」判据只许有一处定义,任何模块不得再写 arcana === 'major' 这类字面量。
// 本轮 QA 连着三层挖出同一个病:牌组把大牌另名(minchiate_trump / visconti_trump),
// 而各层各写一份字面量判据 —— 显示层漏 → 出 undefined 脏名;引擎层漏 → 计时法报「异常牌组」;
// 内容层漏 → 大牌义/传统义/主题占断/女主叙事全取不到;更底层漏 → 修了上层也只是半截(段出得来、内容全空)。
// 单靠人眼 grep 挡不住下一次,故立机械总锁:白名单之外出现字面量即红。
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(__dirname, '..');

// 白名单:语义是「从标准 78 张(CORE78)里取大牌」而非「判断这张牌是不是王牌」——
// CORE78 的 arcana 恒为 'major',这些是建库/查表,不是判据。
const ALLOW = [
	'decks/core78.js',        // 定义处
	'decks/visconti.js',      // 建库:把 CORE78 的 major 改名为 visconti_trump
	'decks/minchiate.js',     // 建库:同上
	'decks/continental.js',   // 建库:取 CORE78 的 22 大牌
	'engine/arcana.js',       // 判据本体
];
// 这些文件里,仅允许「从 CORE78 取」这一形态(CORE78.filter / CORE78.find 同一行内)
const ALLOW_IF_CORE78 = ['engine/pairReading.js', 'engine/cardSchema.js'];

function walk(dir, out = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
		const p = path.join(dir, e.name);
		if(e.isDirectory()){
			if(e.name === '__tests__'){ return; }
			walk(p, out);
		}else if(e.name.endsWith('.js')){ out.push(p); }
	});
	return out;
}

// horosa_win_pathsep_posix_v1(仓内第 5 个宿主;建议上游化 Mac):
// `path.relative` 在 Windows 返回反斜杠分隔(`decks\continental.js`),而下方 ALLOW /
// ALLOW_IF_CORE78 白名单与 `toBe('engine/arcana.js')` 期望值都是 POSIX 写法 ⇒ 白名单恒查不中、
// 期望值恒不等 ⇒ 六个合法豁免全被报成「字面量判据残留」、判据本体定义位置也判不等(macOS 恒绿)。
// 归一到 POSIX 再比对;判据语义零放宽(仍是「白名单外一处都不许有」)。
const relPosix = (from, to) => path.relative(from, to).split(path.sep).join('/');

describe('王牌判据总锁', () => {
	test('除白名单外,塔罗全目录不得再出现 arcana === "major" 这类字面量判据', () => {
		const offenders = [];
		walk(DIR).forEach((file) => {
			const rel = relPosix(DIR, file);
			if(ALLOW.includes(rel)){ return; }
			const src = fs.readFileSync(file, 'utf8');
			src.split('\n').forEach((line, i) => {
				if(line.trim().startsWith('//')){ return; } // 注释里可以谈论它
				if(!/arcana\s*[=!]==\s*'major'/.test(line)){ return; }
				if(ALLOW_IF_CORE78.includes(rel) && /CORE78\.(filter|find)/.test(line)){ return; }
				offenders.push(`${rel}:${i + 1} → ${line.trim().slice(0, 90)}`);
			});
		});
		expect(`字面量判据残留 ${offenders.length} 处: ${offenders.join(' ;; ')}`).toBe('字面量判据残留 0 处: ');
	});
	test('判据本体只有一份定义(不得再被复制到别处)', () => {
		const defs = [];
		walk(DIR).forEach((file) => {
			const src = fs.readFileSync(file, 'utf8');
			if(/function\s+isTrumpArcana\s*\(/.test(src)){ defs.push(relPosix(DIR, file)); }
		});
		expect(defs.join(',')).toBe('engine/arcana.js');
	});
	test('判据本体是零依赖叶子(否则将来又会因循环导入被迫复制一份)', () => {
		const src = fs.readFileSync(path.join(DIR, 'engine/arcana.js'), 'utf8');
		expect(/^\s*import\s/m.test(src)).toBe(false);
	});
});
