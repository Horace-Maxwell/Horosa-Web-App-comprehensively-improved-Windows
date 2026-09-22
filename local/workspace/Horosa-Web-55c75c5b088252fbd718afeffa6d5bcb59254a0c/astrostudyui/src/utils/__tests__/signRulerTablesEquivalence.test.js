// [#79 加固] 四份并行的「星座→庙主」表必须与 AstroConst.SignsProp 逐座相同。
// #79 把宫主派生收编成单源后,仓里仍有各自为政的庙主表(主宰链/小限年主/12分度/七政中文名),今天数据一致
// 只是巧合,没有锁=下一次修表就漂移。preflight [240] 只盯三文件,这里补数据级等价锁。
import fs from 'fs';
import path from 'path';
import * as AstroConst from '../../constants/AstroConst';
import { SIGNS } from '../../divination/data/signs';

const SRC = (rel)=>fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8');
const EXPECT = AstroConst.LIST_SIGNS.map((s)=>`${AstroConst.SignsProp[s].Ruler}`.toLowerCase());
const CN_PLANET = { '太阳': 'sun', '月亮': 'moon', '水星': 'mercury', '金星': 'venus', '火星': 'mars', '木星': 'jupiter', '土星': 'saturn', '日': 'sun', '月': 'moon', '水': 'mercury', '金': 'venus', '火': 'mars', '木': 'jupiter', '土': 'saturn' };

function literalBlock(text, marker){
	const i = text.indexOf(marker);
	if(i < 0){ return null; }
	const open = text.indexOf(text[text.indexOf(marker) + marker.length] === '[' ? '[' : '{', i + marker.length - 1);
	const openCh = text[open];
	const closeCh = openCh === '[' ? ']' : '}';
	let depth = 0;
	for(let k = open; k < text.length; k++){
		if(text[k] === openCh){ depth += 1; }
		if(text[k] === closeCh){ depth -= 1; if(depth === 0){ return text.slice(open, k + 1); } }
	}
	return null;
}

describe('星座庙主表数据级等价(单源 SignsProp)', ()=>{
	it('期望序本身自洽:12 座各有庙主', ()=>{
		expect(EXPECT.length).toBe(12);
		expect(EXPECT).toEqual(['mars', 'venus', 'mercury', 'moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter']);
	});
	it('divination/data/signs.js domicile(主宰链 dispositorChain 消费)', ()=>{
		const got = AstroConst.LIST_SIGNS.map((s)=>SIGNS[`${s}`.toLowerCase()].domicile);
		expect(got).toEqual(EXPECT);
	});
	it('astroAiSnapshot TRAD_SIGN_RULERS(12分度)按 LIST_SIGNS 位序', ()=>{
		const text = SRC('utils/astroAiSnapshot.js');
		const block = literalBlock(text, 'TRAD_SIGN_RULERS = ');
		expect(block).toBeTruthy();
		const toks = block.match(/[A-Z][A-Z_]+|'[a-z]+'|"[a-z]+"/g).map((t)=>t.replace(/['"]/g, '').toLowerCase());
		expect(toks.length).toBe(12);
		expect(toks).toEqual(EXPECT);
	});
	it('小限年主不自带星座表:庙主取 signs.js domicile(上一例已锁),本地表只做行星 id→glyph 映射 —— [Q-105 2026-09-18] 表随派生算法抽到 utils/profectionSummary.js 单源,页面不再自带', ()=>{
		const text = SRC('utils/profectionSummary.js');
		expect(text).toMatch(/PROFECTION_SIGN_RULER_ID\s*=\s*\{/);
		expect(text).toMatch(/\.domicile/);
		expect(text).not.toMatch(/aries\s*:\s*['"]mars['"]/);
		const page = SRC('components/astro/AstroProfection.js');
		expect(page).not.toMatch(/PROFECTION_SIGN_RULER_ID\s*=\s*\{/);
		expect(page).toMatch(/from '..\/..\/utils\/profectionSummary'/);
	});
	it('GuoLaoMoiraWheel SIGN_RULERS_CN(七政命主/身主中文)逐座', ()=>{
		const text = SRC('components/guolao/GuoLaoMoiraWheel.js');
		const block = literalBlock(text, 'SIGN_RULERS_CN = ');
		expect(block).toBeTruthy();
		const pairs = {};
		block.replace(/([A-Za-z]+)\s*:\s*['"]([^'"]+)['"]/g, (_m, k, v)=>{ pairs[k.toLowerCase()] = CN_PLANET[v] || v; return ''; });
		AstroConst.LIST_SIGNS.forEach((s, i)=>{ expect([s, pairs[`${s}`.toLowerCase()]]).toEqual([s, EXPECT[i]]); });
	});
});
