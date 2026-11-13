// 罕见字(CJK 扩展 B 及以后)文本回退:登记表完整性 + 回退口径 + 各落点接线。
import fs from 'fs';
import path from 'path';
import { RARE_CHARS, hasRareChar, rareCharFallback, rareCharGloss, rareSafeText, rareSafeDeep,
	canRenderRareChar, setRareGlyphProbe } from '../rareChars';
import { pdfSafeText } from '../aiExportPdfVector';

const SRC = path.resolve(__dirname, '..', '..');
const RARE_G = /[\u{20000}-\u{3FFFF}]/gu;

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){
			// 简繁转换表里的字是「转换对照」不是给人看的正文;测试夹具不算产品数据
			if(e.name === '__tests__' || e.name === 'scriptConvert' || e.name.startsWith('.umi') || e.name === 'node_modules'){ return; }
			walk(p, out);
		}else if(/\.(js|json)$/.test(e.name) && !/\.test\.js$/.test(e.name) && p !== path.join(SRC, 'utils', 'rareChars.js')){
			out.push(p);
		}
	});
	return out;
}

afterEach(()=>setRareGlyphProbe(null));

describe('登记表', ()=>{
	test('前端数据里出现的扩展 B 及以后的字,全部登记了回退写法', ()=>{
		const missing = {};
		let seen = 0;
		walk(SRC, []).forEach((p)=>{
			const m = fs.readFileSync(p, 'utf8').match(RARE_G);
			(m || []).forEach((ch)=>{
				seen += 1;
				if(!RARE_CHARS[ch]){ (missing[ch] = missing[ch] || new Set()).add(path.relative(SRC, p)); }
			});
		});
		expect(seen).toBeGreaterThan(20);   // 判别力:确实扫到了灵棋经 / 断易 / 星官里的字
		expect(Object.keys(missing).map((ch)=>`${ch} U+${ch.codePointAt(0).toString(16).toUpperCase()} ← ${[...missing[ch]].join(', ')}`)).toEqual([]);
	});

	test('每一项都有可用的回退,且回退写法本身不含罕见字', ()=>{
		Object.keys(RARE_CHARS).forEach((ch)=>{
			const it = RARE_CHARS[ch];
			expect({ ch, single: [...ch].length === 1, rare: hasRareChar(ch) }).toEqual({ ch, single: true, rare: true });
			expect({ ch, ok: !!(it.same || it.parts) }).toEqual({ ch, ok: true });
			expect({ ch, fb: hasRareChar(rareCharFallback(ch)) }).toEqual({ ch, fb: false });
			if(it.same){ expect({ ch, n: [...it.same].length }).toEqual({ ch, n: 1 }); }
			if(it.parts){ expect({ ch, parts: /^(左.+右.+|上.+下.+)$/.test(it.parts) }).toEqual({ ch, parts: true }); }
		});
	});
});

describe('回退口径', ()=>{
	test('画不出:有通行写法换通行写法,没有的写拆字说明;未登记的字与普通字原样', ()=>{
		setRareGlyphProbe(()=>false);
		expect(rareSafeText('婚𡛸甚吉')).toBe('婚姻甚吉');
		expect(rareSafeText('陰陽啟𠯒，其變赤白')).toBe('陰陽啟〔上化下口〕，其變赤白');
		expect(rareSafeText('𤕠')).toBe('〔左爻右守〕');
		expect(rareSafeText('𫓧钺')).toBe('鈇钺');
		expect(rareSafeText('明朝𫄨绤也应难')).toBe('明朝絺绤也应难');
		expect(rareSafeText('𠀀甲')).toBe('𠀀甲');          // 未登记:不乱猜
		expect(rareSafeText('普通文字 abc')).toBe('普通文字 abc');
		expect(rareCharGloss('𠑩')).toBe('左亻右矍,同「矍」');
		expect(rareCharGloss('𡛸')).toBe('同「姻」');
	});

	test('画得出:一个字都不动(装了大字库的机器看到的就是原字)', ()=>{
		setRareGlyphProbe(()=>true);
		expect(rareSafeText('婚𡛸甚吉 陰陽啟𠯒')).toBe('婚𡛸甚吉 陰陽啟𠯒');
	});

	test('量不了(没有画布)当画得出:文本不凭空变', ()=>{
		expect(canRenderRareChar('𡛸')).toBe(true);
		expect(rareSafeText('婚𡛸甚吉')).toBe('婚𡛸甚吉');
	});

	test('逐字判定:画得出的留原字,画不出的才换', ()=>{
		setRareGlyphProbe((ch)=>ch === '𡛸');
		expect(rareSafeText('𡛸𠯒')).toBe('𡛸〔上化下口〕');
	});

	test('整对象:没有罕见字的子树原样复用,有的只换字符串', ()=>{
		setRareGlyphProbe(()=>false);
		const plain = { a: ['甲', { b: '乙' }], n: 3 };
		expect(rareSafeDeep(plain)).toBe(plain);
		const pan = { taixuan: { gua: { name: '𤕠' }, allLines: [{ name: '次四', content: '其志𠑩𠑩' }], keep: plain }, seed: 7 };
		const out = rareSafeDeep(pan);
		expect(out).not.toBe(pan);
		expect(out.taixuan.gua.name).toBe('〔左爻右守〕');
		expect(out.taixuan.allLines[0].content).toBe('其志矍矍');
		expect(out.taixuan.keep).toBe(plain);
		expect(out.seed).toBe(7);
		expect(pan.taixuan.gua.name).toBe('𤕠');          // 原对象不动(存档 / 快照用原字)
		expect(rareSafeDeep(null)).toBe(null);
	});

	test('PDF:内嵌字体没有的罕见字走同一张表,不落成 □', ()=>{
		const cs = new Set([...'婚姻甚吉陰陽啟上化下口〔〕□絺绤'].map((c)=>c.codePointAt(0)));
		expect(pdfSafeText('婚𡛸甚吉', cs)).toBe('婚姻甚吉');
		expect(pdfSafeText('陰陽啟𠯒', cs)).toBe('陰陽啟〔上化下口〕');
		expect(pdfSafeText('𠀀', cs)).toBe('□');
	});
});

describe('落点接线', ()=>{
	const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
	test('灵棋经原文档 / 太玄画面盘 / 断易歌赋 / 星官名牌都经回退出口', ()=>{
		expect(read('components/lingqi/LingQiMain.js')).toMatch(/display === 'orig' \? rareSafeText\(/);
		const tx = read('components/taixuan/TaiXuanMain.js');
		expect(tx).toMatch(/this\._displayPan = rareSafeDeep\(pan\)/);
		// 画面读的是 displayPan;存档 / 快照读 state.pan(原字)
		expect(tx).toMatch(/snapshot: buildSnapshotText\(this\.state\.pan\)/);
		const renderPart = tx.slice(tx.indexOf('	renderLineDiagram(){'), tx.indexOf('	renderBottomQuickDock(){'));
		expect(renderPart.replace(/hasResult: !!this\.state\.pan/, '')).not.toMatch(/this\.state\.pan/);
		expect(read('components/guazhan/LiuYaoZhanLeiView.js').match(/rareSafeText\(r\.text\)/g).length).toBe(2);
		expect(read('components/planetarium/babylon/PlanetariumRenderer.js')).toMatch(/const name = rareSafeText\(item\.name \|\| item\.pinyin \|\| ''\)/);
	});
});
