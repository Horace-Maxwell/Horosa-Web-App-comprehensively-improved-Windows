// 全站样式入口 layouts/app.less 是按「局部类名」处理的样式文件:写在 :global 里的类名与 animation 引用保持原样,
// 但 @keyframes 的名字仍会被加上哈希后缀 —— 两边对不上,动画在成品里一帧都不播(开发时不报错、肉眼不易察觉)。
// 正确写法 = @keyframes ~":global(名字)"。这里把写法、引用配对,以及随动画复活要一起守住的几处配套一并锁死。
import { SPREADS } from '../../components/tarot/engine/spreads';

const fs = require('fs');
const path = require('path');
const { readSource } = require('./helpers/sourceSet');

const SRC = path.resolve(__dirname, '../..');
const css = readSource(path.join(SRC, 'layouts/app.less'));
const tarotJs = fs.readFileSync(path.join(SRC, 'components/tarot/TarotMain.js'), 'utf8');
const lingqiJs = fs.readFileSync(path.join(SRC, 'components/lingqi/LingQiMain.js'), 'utf8');

function walkLess(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
		const full = path.join(dir, ent.name);
		if(ent.isDirectory()){
			if(ent.name !== 'node_modules' && !ent.name.startsWith('.umi')){
				walkLess(full, out);
			}
		}else if(ent.name.endsWith('.less')){
			out.push(full);
		}
	});
	return out;
}

describe('全局动画关键帧:名字不被加哈希', () => {
	// 下限:共享样式里 6 个自家动画;私有的风水工作台再带两个
	let FLOOR = 6;
	const declared = [];
	css.replace(/@keyframes\s+([^\s{]+)/g, (all, name) => { declared.push(name); return all; });

	it('全站样式入口里的每个 @keyframes 都写成 ~":global(名字)"', () => {
		expect(declared.length).toBeGreaterThanOrEqual(FLOOR);
		declared.forEach((name) => {
			expect(name).toMatch(/^~":global\([A-Za-z][\w-]*\)"$/);
		});
	});

	it('每个 animation 引用到的自家动画都有全局声明(名字逐字相同)', () => {
		const names = new Set(declared.map((n) => (/global\(([\w-]+)\)/.exec(n) || [])[1]));
		const used = new Set();
		css.replace(/animation(?:-name)?:\s*([A-Za-z][\w-]*)/g, (all, name) => { used.add(name); return all; });
		used.delete('none');
		used.delete('inherit');
		used.delete('initial');
		expect(used.size).toBeGreaterThanOrEqual(FLOOR);
		used.forEach((name) => {
			expect([name, names.has(name)]).toEqual([name, true]);
		});
	});

	it('其它带 :global 的样式文件里,@keyframes 同样只许这一种写法', () => {
		const offenders = [];
		walkLess(SRC, []).forEach((file) => {
			const text = fs.readFileSync(file, 'utf8');
			if(!/:global/.test(text)){
				return;
			}
			text.split('\n').forEach((line, i) => {
				if(/@keyframes\s/.test(line) && !/@keyframes\s+~":global\(/.test(line)){
					offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
				}
			});
		});
		expect(offenders).toEqual([]);
	});
});

describe('塔罗发牌动画与横压牌', () => {
	it('动画挂在槽内的牌上、不挂槽位(槽位自己用 transform 定位与横置,关键帧会把它整个盖掉)', () => {
		expect(css).toMatch(/\.horosa-tarot-geo-slot > \.horosa-tarot-card \{ animation: horosa-tarot-deal [^;}]*\bbackwards;/);
		expect(css).not.toMatch(/\.horosa-tarot-geo-slot \{[^}]*animation:/);
		// 落定后不许一直压着牌自己的 transform(悬停上浮)
		css.replace(/animation: horosa-tarot-deal([^;}]*)/g, (all, rest) => {
			expect(rest).not.toMatch(/\b(both|forwards)\b/);
			return all;
		});
	});

	it('减少动态效果时发牌不动', () => {
		expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.horosa-tarot-geo-slot > \.horosa-tarot-card \{ animation: none; \}/);
	});

	it('横压牌垫实底,且只设底色(不用速写,免得同权重盖掉亮色牌面的渐变)', () => {
		const m = css.match(/\.horosa-tarot-geo-slot\.is-crossing > \.horosa-tarot-card \{([^}]*)\}/);
		expect(m).not.toBeNull();
		expect(m[1]).toMatch(/background-color:/);
		expect(m[1]).not.toMatch(/background:/);
	});

	it('横置认位置自己的标记,不认牌阵名', () => {
		expect(tarotJs).toContain('const crossing = !!pos.crossFixed;');
		expect(tarotJs).toContain("crossing ? 'horosa-tarot-geo-slot is-crossing' : 'horosa-tarot-geo-slot'");
		expect(tarotJs).toContain('!!(positions[idx] && positions[idx].crossFixed)');
		expect(tarotJs).not.toMatch(/spreadType === 'celtic' && idx === 1/);
	});

	it('牌阵里凡是两张牌落在同一点,后一张必带横置标记(否则整张盖住前一张)', () => {
		let pairs = 0;
		Object.keys(SPREADS).forEach((key) => {
			const positions = (SPREADS[key] && SPREADS[key].positions) || [];
			const seen = {};
			positions.forEach((pos) => {
				if(typeof pos.x !== 'number' || typeof pos.y !== 'number'){
					return;
				}
				const at = `${pos.x},${pos.y}`;
				if(seen[at]){
					pairs += 1;
					expect([key, pos.i, !!pos.crossFixed]).toEqual([key, pos.i, true]);
				}
				seen[at] = true;
			});
		});
		expect(pairs).toBeGreaterThanOrEqual(3);
	});
});

describe('灵棋掷棋动画节拍', () => {
	const num = (name) => {
		const m = new RegExp(`const ${name} = (\\d+);`).exec(lingqiJs);
		return m ? Number(m[1]) : NaN;
	};

	it('单枚时长与样式同值', () => {
		const m = /animation: horosa-lingqi-toss ([\d.]+)s/.exec(css);
		expect(m).not.toBeNull();
		expect(Math.round(Number(m[1]) * 1000)).toBe(num('TOSS_MS'));
	});

	it('收尾计时由节拍常量算出,等最后一枚落定才撤(不再写死毫秒数)', () => {
		expect(lingqiJs).toContain('const TOSS_TOTAL_MS = TOSS_MS + (TOSS_CHIPS - 1) * TOSS_STAGGER_MS + 80;');
		expect(lingqiJs).toContain('}, TOSS_TOTAL_MS);');
		expect(lingqiJs).toContain('* TOSS_STAGGER_MS}ms`');
		expect(lingqiJs).not.toMatch(/\b1150\b/);
		expect(num('TOSS_CHIPS')).toBe(12);
		expect(num('TOSS_STAGGER_MS')).toBeGreaterThan(0);
	});
});
