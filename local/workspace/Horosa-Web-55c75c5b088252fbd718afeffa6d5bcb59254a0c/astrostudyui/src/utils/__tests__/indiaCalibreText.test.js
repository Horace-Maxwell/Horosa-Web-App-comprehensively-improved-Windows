// 印占口径文字护栏:
// ① 帮助手册 / 口径单源 / 服务层回显不得再出现已废口径的特征短语(曾在「实现细节」页签与前文互相矛盾);
// ② 引擎六力 approximations 每一条的前缀 ↔ 口径单源 INDIA_SHADBALA_APPROX 的键 双向全等
//   (引擎加近似项不写手册 → 红;手册写了引擎已没有的近似 → 红),且手册逐条渲染该表。
import fs from 'fs';
import path from 'path';
import { INDIA_SHADBALA_APPROX, INDIA_CALIBRE_TEXT } from '../../constants/indiaCalibreText';

const SRC = path.resolve(__dirname, '../..');
const ASTROPY = path.resolve(SRC, '../../astropy');
const read = (p)=>fs.readFileSync(p, 'utf8');

const HELP = path.join(SRC, 'components/help/IndiaHelpDoc.js');
const CALIBRE = path.join(SRC, 'constants/indiaCalibreText.js');
const SRV = path.join(ASTROPY, 'websrv/webindiasrv.py');
const PRASHNA_PY = path.join(ASTROPY, 'astrostudy/india/prashna.py');
const SHADBALA_PY = path.join(ASTROPY, 'astrostudy/india/shadbala_bphs.py');

// 已废口径的特征短语(每条都对应一处曾与实现不符的旧说法)
const RETIRED_CALIBRE_PHRASES = [
	'环形宫距 × 10',                  // Dig 宫阶跃(已改连续式)
	'故该列恒为 0',                    // 星曜战未计入(已按 Raman 口径计入)
	'整宫偏移口径',                    // 本命 KP 宫主(已与问事同按宫头落座)
	'按当地民用日推算',                // 星期(全引擎已按日出换日)
	'落在该曜所辖宿里的行星',          // KP 四级旧定义
	'既有本命 KP 面板用民用日口径',    // 校时 vara 说明(本命 KP 早已按日出)
	'× 2 对 9 取余',                   // Panchaka(实为直接对 9 取余)
	'首项不占期',                      // Patyāyinī(首项以自身座内度为权重)
];

function hits(text, phrases){
	return phrases.filter((ph)=>text.indexOf(ph) >= 0);
}

function engineApproxPrefixes(src){
	const a = src.indexOf("out['approximations'] = [");
	expect(a).toBeGreaterThan(0);
	const b = src.indexOf(']', src.indexOf("\n    ]", a));
	const block = src.slice(a, b);
	// 每条以 '前缀:' 开头(续行字符串不含冒号前缀)
	const out = [];
	const re = /\n\s+'([A-Za-z/]+):/g;
	let m;
	while((m = re.exec(block))){ out.push(m[1]); }
	return out;
}

describe('印占口径文字 · 已废短语禁用', ()=>{
	it('帮助手册 / 口径单源 / 服务层回显 / 问事 docstring 零命中', ()=>{
		[HELP, CALIBRE, SRV, PRASHNA_PY].forEach((f)=>{
			expect([path.basename(f), hits(read(f), RETIRED_CALIBRE_PHRASES)]).toEqual([path.basename(f), []]);
		});
	});
	it('判据会咬:把任一旧短语塞回文本即命中', ()=>{
		RETIRED_CALIBRE_PHRASES.forEach((ph)=>{
			expect(hits(`前文 ${ph} 后文`, RETIRED_CALIBRE_PHRASES)).toEqual([ph]);
		});
	});
});

describe('印占口径文字 · 引擎近似项 ↔ 手册双向锁', ()=>{
	const prefixes = engineApproxPrefixes(read(SHADBALA_PY));
	it('引擎 approximations 前缀集 ≡ INDIA_SHADBALA_APPROX 键集', ()=>{
		expect(prefixes.length).toBeGreaterThanOrEqual(5);
		expect([...prefixes].sort()).toEqual(Object.keys(INDIA_SHADBALA_APPROX).sort());
	});
	it('手册逐条渲染近似表,并引用口径单源', ()=>{
		const help = read(HELP);
		expect(help).toContain("from '../../constants/indiaCalibreText'");
		expect(help).toMatch(/Object\.keys\(INDIA_SHADBALA_APPROX\)\.map/);
		Object.keys(INDIA_CALIBRE_TEXT).forEach((k)=>{
			expect([k, help.indexOf(`INDIA_CALIBRE_TEXT.${k}`) >= 0]).toEqual([k, true]);
		});
	});
	it('判据会咬:引擎多一条 / 少一条前缀即不等', ()=>{
		const extra = [...prefixes, 'Ayana'].sort();
		expect(extra).not.toEqual(Object.keys(INDIA_SHADBALA_APPROX).sort());
		const fewer = prefixes.slice(1).sort();
		expect(fewer).not.toEqual(Object.keys(INDIA_SHADBALA_APPROX).sort());
	});
});
