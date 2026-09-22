// [Issue#75 同批·八字域] 十二长生四子表 × 两大口径 + 纳音长生表 ≡ 公式派生。
// 事发:六壬六亲表手抄漂移(Issue#75)后全仓同类表机械对拍,在本文件抓到 26 格真错:
//   ①ZhangSheng.ganziInverse 辛_酉/辛_戌 冠带↔临官 互换(**默认档**,八字十二长生页用户可见;
//     辛禄在酉=临官,与仓内 baziWuxing.LU_ZHI['辛']='酉' 自相矛盾);
//   ②ZhangSheng.ganphaseInverse 辛行 12 格=庚行逐字复制(该档阴干应逆行,子起);
//   ③ZhangSheng.nayinwxzhi 纳音金 12 格整行提前一支(金长生在巳,表以辰起)。
// 口径(两大对象各自成派,勿混判):
//   ZhangSheng=火土同宫;SuiTuTong=水土同宫;
//   ganzi/ganphase 子表=阴阳同生同死(阴干同其阳干、全顺行);*Inverse 子表=阳顺阴逆。
import { ZhangSheng, SuiTuTong } from '../bazimsg';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const PH = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const YANG = new Set(['甲', '丙', '戊', '庚', '壬']);
// 长生起宫:同生同死档(阴干同阳干)/阳顺阴逆档(阴干自有起宫)。土随火(ZhangSheng)或随水(SuiTuTong)。
const SAME_HUOTU = { 甲: '亥', 乙: '亥', 丙: '寅', 丁: '寅', 戊: '寅', 己: '寅', 庚: '巳', 辛: '巳', 壬: '申', 癸: '申' };
const SAME_SHUITU = { 甲: '亥', 乙: '亥', 丙: '寅', 丁: '寅', 戊: '申', 己: '申', 庚: '巳', 辛: '巳', 壬: '申', 癸: '申' };
const INV_HUOTU = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
const NAYIN_START = { 金: '巳', 木: '亥', 水: '申', 火: '寅', 土: '申' };

function phaseAt(startZhi, gan, zhi, inverse){
	const st = ZHI.indexOf(startZhi);
	const i = ZHI.indexOf(zhi);
	const step = (!inverse || YANG.has(gan)) ? ((i - st) % 12 + 12) % 12 : ((st - i) % 12 + 12) % 12;
	return PH[step];
}
function zhiAt(startZhi, gan, phase, inverse){
	const st = ZHI.indexOf(startZhi);
	const k = PH.indexOf(phase);
	return (!inverse || YANG.has(gan)) ? ZHI[(st + k) % 12] : ZHI[((st - k) % 12 + 12) % 12];
}
function checkGanZi(table, starts, inverse, label){
	const wrong = [];
	Object.keys(starts).forEach((gan)=>{
		ZHI.forEach((zhi)=>{
			const got = table[`${gan}_${zhi}`];
			if(got === undefined){ return; }
			const want = phaseAt(starts[gan], gan, zhi, inverse);
			if(got !== want){ wrong.push(`${label} ${gan}_${zhi}: 表=${got} 应=${want}`); }
		});
	});
	return wrong;
}
function checkGanPhase(table, starts, inverse, label){
	const wrong = [];
	Object.keys(starts).forEach((gan)=>{
		PH.forEach((ph)=>{
			const got = table[`${gan}_${ph}`];
			if(got === undefined){ return; }
			const want = zhiAt(starts[gan], gan, ph, inverse);
			if(got !== want){ wrong.push(`${label} ${gan}_${ph}: 表=${got} 应=${want}`); }
		});
	});
	return wrong;
}

describe('八字十二长生表 ≡ 公式派生(六子表 720 格 + 纳音 60 格)', ()=>{
	it('ZhangSheng(火土同宫)四子表逐格一致', ()=>{
		let wrong = [];
		wrong = wrong.concat(checkGanZi(ZhangSheng.ganzi, SAME_HUOTU, false, 'ganzi'));
		wrong = wrong.concat(checkGanZi(ZhangSheng.ganziInverse, INV_HUOTU, true, 'ganziInverse'));
		wrong = wrong.concat(checkGanPhase(ZhangSheng.ganphase, SAME_HUOTU, false, 'ganphase'));
		wrong = wrong.concat(checkGanPhase(ZhangSheng.ganphaseInverse, INV_HUOTU, true, 'ganphaseInverse'));
		expect(wrong).toEqual([]);
	});
	it('SuiTuTong(水土同宫)两子表逐格一致', ()=>{
		let wrong = [];
		wrong = wrong.concat(checkGanZi(SuiTuTong.ganzi, SAME_SHUITU, false, 'STT.ganzi'));
		wrong = wrong.concat(checkGanPhase(SuiTuTong.ganphase, SAME_SHUITU, false, 'STT.ganphase'));
		expect(wrong).toEqual([]);
	});
	it('纳音五行长生表(60 格)≡ 各自长生起宫顺行', ()=>{
		const wrong = [];
		Object.keys(NAYIN_START).forEach((wx)=>{
			ZHI.forEach((zhi)=>{
				const got = ZhangSheng.nayinwxzhi[`纳音${wx}_${zhi}`];
				if(got === undefined){ return; }
				const want = phaseAt(NAYIN_START[wx], '甲', zhi, false);
				if(got !== want){ wrong.push(`纳音${wx}_${zhi}: 表=${got} 应=${want}`); }
			});
		});
		expect(wrong).toEqual([]);
	});
	it('两子表互为逆映射(ganzi ↔ ganphase 自洽)', ()=>{
		const wrong = [];
		Object.keys(SAME_HUOTU).forEach((gan)=>{
			PH.forEach((ph)=>{
				const zhi = ZhangSheng.ganphase[`${gan}_${ph}`];
				if(!zhi){ return; }
				const back = ZhangSheng.ganzi[`${gan}_${zhi}`];
				if(back !== ph){ wrong.push(`${gan}: ${ph}→${zhi}→${back}`); }
			});
		});
		expect(wrong).toEqual([]);
	});
	it('Issue#75 同批实例:辛日禄位=酉(临官),纳音金长生=巳', ()=>{
		expect(ZhangSheng.ganziInverse['辛_酉']).toBe('临官');
		expect(ZhangSheng.ganziInverse['辛_戌']).toBe('冠带');
		expect(ZhangSheng.ganphaseInverse['辛_长生']).toBe('子');
		expect(ZhangSheng.nayinwxzhi['纳音金_巳']).toBe('长生');
	});
});
