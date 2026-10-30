// 主限天球恒星名牌与表格 / 时间轴同源保英文名:字形表里只有部分恒星有三字以内的中文名,
// 曾一部分走字形分支出中文(毕宿五、天狼星…)、一部分落回英文(Fomalhaut…),同屏中英混排。
import { pdStarBaseIds, pointGlyphOf } from '../PDSphereEngine';

const ROSTER = ['Aldebaran', 'Regulus', 'Antares', 'Fomalhaut', 'Algol', 'Alcyone', 'Capella', 'Sirius',
	'Procyon', 'Algorab', 'Spica', 'Arcturus', 'Alphecca', 'Vega', 'Deneb Algedi'];

describe('主限天球恒星名牌', ()=>{
	test('恒星本体名从 FS_ / FSD_ / FSS_ 迫星与 kind=star 的点收集', ()=>{
		const set = pdStarBaseIds({
			FS_Aldebaran_0: { kind: 'star' }, FSD_Vega_60: { kind: 'aspect' }, 'FSS_Deneb Algedi_90': { kind: 'aspect' },
			N_Spica_0: { kind: 'star' }, N_Sun_0: { kind: 'planet' }, D_Moon_60: { kind: 'aspect' },
		});
		expect([...set].sort()).toEqual(['Aldebaran', 'Deneb Algedi', 'Spica', 'Vega']);
	});

	test('名册里的恒星一律英文名、不走字形;行星与宿命点照旧', ()=>{
		const stars = new Set(ROSTER);
		ROSTER.forEach((name)=>{
			expect(pointGlyphOf(name, stars)).toEqual({ text: name, astroFont: false });
		});
		expect(pointGlyphOf('Sun', stars)).toEqual(pointGlyphOf('Sun'));
		expect(pointGlyphOf('Sun', stars).astroFont).toBe(true);
		expect(pointGlyphOf('Vertex', stars)).toEqual(pointGlyphOf('Vertex'));
	});
});
