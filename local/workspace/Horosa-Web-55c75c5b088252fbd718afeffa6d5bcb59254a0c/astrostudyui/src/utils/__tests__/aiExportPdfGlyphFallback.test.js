// 矢量 PDF 缺字换字:内嵌中文子集字体没有的字符,PDF 画出来是空白(.notdef)。导出层把度数统一写成「˚」(U+02DA),
// 字体只有「°」→ 此前所有导出 PDF 的度数符号都是空白、「360⁄14」成了「360 14」(TXT / Word 不受影响)。
import fs from 'fs';
import path from 'path';
import { pdfSafeText } from '../aiExportPdfVector';

const fontkit = require('@pdf-lib/fontkit');
const FONT = fontkit.create(fs.readFileSync(path.join(__dirname, '../../../public/fonts/HorosaCJK-subset.ttf')));
const BOLD = fontkit.create(fs.readFileSync(path.join(__dirname, '../../../public/fonts/HorosaCJK-Bold-subset.ttf')));
const CS = new Set(FONT.characterSet);
const CSB = new Set(BOLD.characterSet);
const covered = (s, cs)=>[...s].every((c)=>c.codePointAt(0) < 0x20 || cs.has(c.codePointAt(0)));

describe('矢量 PDF 缺字换成字体里有的字', ()=>{
	it('前提:字体确实缺「˚」「⁄」,有「°」「/」(否则本测试测不出东西)', ()=>{
		expect(CS.has(0x02DA)).toBe(false);
		expect(CS.has(0x2044)).toBe(false);
		expect(CS.has(0x00B0)).toBe(true);
		expect(CS.has(0x2F)).toBe(true);
	});
	it('度数 / 分数斜杠换成等价字,其余原样', ()=>{
		expect(pdfSafeText('26.4872˚(J2000.0 时 26˚37分18秒)', CS)).toBe('26.4872°(J2000.0 时 26°37分18秒)');
		expect(pdfSafeText('14 谐(360˚⁄14 倍数)', CS)).toBe('14 谐(360°/14 倍数)');
		expect(pdfSafeText('木星 金牛 ☉ 12°', CS)).toBe('木星 金牛 ☉ 12°');
		expect(pdfSafeText('一\n二\t三', CS)).toBe('一\n二\t三');
	});
	it('导出里实际出现过的缺字逐个换成可读形态', ()=>{
		expect(pdfSafeText('流派：Parāśarī', CS)).toBe('流派：Parasari');
		expect(pdfSafeText('牡鹿四星(α Cas)', CS)).toBe('牡鹿四星(alpha Cas)');
		expect(pdfSafeText('闭式(ε≈23.44˚)', CS)).toBe('闭式(epsilon≈23.44°)');
		expect(pdfSafeText('木·拱(Δ12)', CS)).toBe('木·拱(Delta12)');
		expect(pdfSafeText('GU₄.AN.NA', CS)).toBe('GU4.AN.NA');
		expect(pdfSafeText('Duʾūzu', CS)).toBe("Du'uzu");
		expect(pdfSafeText('日11宫✓', CS)).toBe('日11宫√');
		expect(pdfSafeText('Utu/Šamaš LÚ.ḪUN.GÁ', CS)).toBe('Utu/Samas LÚ.HUN.GÁ');
	});
	it('换完一定全在字体里(兼容分解 / 去附加符号 / □ 兜底),Regular 与 Bold 同覆盖', ()=>{
		const sample = '˚⁄∕‐‑‒–′″‘’“”…•∙⋅ﬁ①Ⅻ㎡é ñ Ǖ ☽♈𝔄🜨';
		const out = pdfSafeText(sample, CS);
		expect(covered(out, CS)).toBe(true);
		expect(covered(pdfSafeText(sample, CSB), CSB)).toBe(true);
	});
	it('零宽记号(组合附加符 / 变体选择符 / 方向与零宽控制)直接去掉,不画成方块', ()=>{
		expect(pdfSafeText('H\u0331olon', CS)).toBe('Holon');          // 组合下横线:去掉记号留字母
		expect(pdfSafeText('注意\u26A0\uFE0F', CS)).toBe(pdfSafeText('注意\u26A0', CS));   // 表情变体选择符不再多出一个 □
		expect(pdfSafeText('甲\u200B乙\u200D丙\uFEFF丁', CS)).toBe('甲乙丙丁');
		expect(pdfSafeText('\u202A右\u202C', CS)).toBe('右');
	});
	it('四字节字符(表情 / 数学字母)按一个字处理:缺字时只出一个 □', ()=>{
		const out = pdfSafeText('🜨', CS);
		expect([...out].length).toBe(1);
		const src = fs.readFileSync(path.join(__dirname, '../aiExportPdfVector.js'), 'utf8');
		expect(src).toContain('const re = /[A-Za-z0-9]+(?:[.\\-_/@%:][A-Za-z0-9]+)*|[ \\t]+|[\\s\\S]/gu;');
	});
	it('导出层统一写出的度数符号「˚」一定能换成字体里的字', ()=>{
		const meaning = fs.readFileSync(path.join(__dirname, '../aiExport/meaning.js'), 'utf8');
		expect(meaning).toMatch(/\.replace\(\/\[°º\]\/g, '˚'\)/);
		expect(covered(pdfSafeText('˚', CS), CS)).toBe(true);
		expect(pdfSafeText('˚', CS)).toBe('°');
	});
	it('换字挂在两副字体的 encodeText / widthOfTextAtSize 上(全部落笔点一次覆盖)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../aiExportPdfVector.js'), 'utf8');
		expect(src).toContain('const font = guardFontGlyphs(await pdf.embedFont(fontBytes, { subset: false }));');
		expect(src).toContain('boldFont = guardFontGlyphs(await pdf.embedFont(boldBytes, { subset: false }));');
		expect(src).toContain('f.encodeText = (t)=>enc(pdfSafeText(t, cs));');
		expect(src).toContain('f.widthOfTextAtSize = (t, size)=>wid(pdfSafeText(t, cs), size);');
	});
});
