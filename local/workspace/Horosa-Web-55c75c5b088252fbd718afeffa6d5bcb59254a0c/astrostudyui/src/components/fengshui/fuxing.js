// 辅星水法 / 翻卦九星水法（正统古法）· 以向(或坐/水口对宫)起辅弼，翻卦布八方九星，断来去水。
// 与八宅大游年同源翻卦掌(3.7)：生气贪狼/天医巨门/延年武曲/伏位辅弼(吉);祸害禄存/六煞文曲/五鬼廉贞/绝命破军(凶)。
import { dayouNian } from './bazhai';
import { GONG_GUA, OPP_GONG, HOUTIAN_POS } from './fengshuiData';

const GUA8 = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];

// 辅星水法排盘：本卦(向/坐/水口对宫) → 八方九星 + 来去水断。
//   { benGua, qiFrom('xiang'|'zuo'|'shuikou'), waters:{卦:'come'|'go'|''} }
export function fuxing({ benGua = '坎', qiFrom = 'xiang', waters = {} } = {}) {
	// 起卦来源:辅弼(伏位)所坐之卦 —— 向卦=本卦(默认,字节不变);坐卦=向之对宫;水口对宫=去水方之对宫(缺去水回退本卦对宫)。
	const oppGua = (g)=>(GONG_GUA[OPP_GONG[HOUTIAN_POS[g]]] || g);
	let startGua = benGua;
	if (qiFrom === 'zuo') { startGua = oppGua(benGua); }
	else if (qiFrom === 'shuikou') {
		const goGua = Object.keys(waters).find((gua)=>waters[gua] === 'go');
		startGua = goGua ? oppGua(goGua) : oppGua(benGua);
	}
	const stars = dayouNian(startGua);
	if (!stars) { return { available: false }; }
	const palaces = Object.keys(stars).map((g)=>{
		const s = stars[g];
		const gua = GONG_GUA[g];
		const water = waters[gua] || '';
		const good = s.jx === 'good';   // 贪巨武辅=吉星
		let result = good ? '宜来水（吉星方）' : '宜去水（凶星方）'; let vjx = 'neutral';
		if (water === 'come') { result = good ? '来水合·进财禄添丁贵' : '来水逆·漏财损丁'; vjx = good ? 'good' : 'bad'; }
		else if (water === 'go') { result = good ? '去水逆·去衰漏吉' : '去水合·去衰死之气'; vjx = good ? 'bad' : 'good'; }
		return { gong: +g, gua, dir: s.dir, star: s.star, youxing: s.name, jx: s.jx, water, result, verdictJx: vjx };
	}).sort((a, b)=>a.gong - b.gong);
	const registered = palaces.filter((p)=>p.water);
	const heFa = registered.length > 0 && registered.every((p)=>p.verdictJx === 'good');
	return {
		available: true, benGua, startGua, qiFrom, palaces, heFa,
		note: '辅星翻卦(与八宅大游年同源);来水宜贪巨武辅(吉星)方、去水宜禄文廉破(凶星)方',
	};
}

export { GUA8 };
