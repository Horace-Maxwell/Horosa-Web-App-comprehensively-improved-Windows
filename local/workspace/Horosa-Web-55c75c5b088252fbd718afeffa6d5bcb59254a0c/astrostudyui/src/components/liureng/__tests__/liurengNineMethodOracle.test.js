// 大六壬 · 九宗门全域独立对拍 oracle（Windows #46 制度化产物）
// ─────────────────────────────────────────────────────────────────────────
// 背景:曾把古籍「九法」章的列举序号误读为判定优先级(八专下移到遥克后)并锁进金标,
// 直到真实用户以甲寅日两课实报(#46)才暴露。教训:单点金标只能锁"已想到的课式"。
// 本文件把课经九宗门整链用「独立第二实现」重写一遍(自带干支表,与 LRConst/ChuangChart
// 零共享),对 60 日 × 12 种天地盘 = 720 课全枚举逐课比对(课名 + 三传),任何一课分歧即红。
// 判定序(课经条文,非列举序):
//   伏吟/返吟(盘体) → 贼克(下贼上先,含比用/涉害) → 八专(两课,无克不复取遥) →
//   遥克(蒿矢先弹射后) → 别责(三课备,无克无遥) → 昴星(四课全,无克无遥,兜底)。
// 流派参数与默认引擎一致:涉害=App 默认法(仅数被克·计起点不计本家·寄宫干同数),
// 复等取地盘孟/仲上独一者,俱等刚日干上柔日支上;始入课不单列(并入重审)。
// ⚠️ 若本对拍失败:先以古籍条文裁决哪边错,再改错的那边——绝不许"改 oracle 迁就引擎"。
jest.mock('../../../utils/helper', () => ({ randomStr: () => 'mocked', creatTooltip: () => {} }));
import ChuangChart from '../ChuangChart';

// ── 独立干支基础表(全部手工按公版古籍口径重录,勿从 LRConst 拷贝) ──
const ZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
	甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const KE_MAP = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const restrains = (a, b) => KE_MAP[WX[a]] === WX[b];
const YANG_GAN = ['甲', '丙', '戊', '庚', '壬'];
const YANG_ZI = ['子', '寅', '辰', '午', '申', '戌'];
const JI = { 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' };
// 地盘各宫所寄之干(涉害历数用):由 JI 反推
const SEAT_GANS = {};
Object.keys(JI).forEach((g) => { (SEAT_GANS[JI[g]] = SEAT_GANS[JI[g]] || []).push(g); });
const XING = { 子: '卯', 卯: '子', 寅: '巳', 巳: '申', 申: '寅', 丑: '戌', 戌: '未', 未: '丑', 辰: '辰', 午: '午', 酉: '酉', 亥: '亥' };
const CHONG = (z) => ZI[(ZI.indexOf(z) + 6) % 12];
const YIMA = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
const GAN_HE = { 甲: '己', 乙: '庚', 丙: '辛', 丁: '壬', 戊: '癸', 己: '甲', 庚: '乙', 辛: '丙', 壬: '丁', 癸: '戊' };
// 支前三合(三合局生旺墓顺行下一位):别责柔日发用
const SANHE_NEXT = { 申: '子', 子: '辰', 辰: '申', 寅: '午', 午: '戌', 戌: '寅', 巳: '酉', 酉: '丑', 丑: '巳', 亥: '卯', 卯: '未', 未: '亥' };
const MENG = ['寅', '申', '巳', '亥'];
const ZHONG = ['子', '午', '卯', '酉'];

// ── oracle 本体 ──
function oracle(delta, gan, zhi){
	const shang = (z) => ZI[(ZI.indexOf(z) + delta) % 12];
	const seatOf = (z) => ZI[((ZI.indexOf(z) - delta) % 12 + 12) % 12]; // 天盘神所临地盘宫
	const k1 = shang(JI[gan]);
	const k2 = shang(k1);
	const k3 = shang(zhi);
	const k4 = shang(k3);
	const courses = [[k1, gan], [k2, k1], [k3, zhi], [k4, k3]];
	const yang = YANG_GAN.indexOf(gan) >= 0;
	const walk = (c) => [c, shang(c), shang(shang(c))];
	const uniq = (arr) => arr.filter((z, i) => z && arr.indexOf(z) === i);

	const xingChain = (c0) => {
		let c1;
		let selfX = false;
		if(XING[c0] === c0){ selfX = true; }
		return { selfX, next: XING[c0] };
	};

	// 伏吟:仅课1可能有克(余三课皆同支);有克不虞,无克刚自任柔自信,初传自刑=杜传;
	// 中=初刑(初自刑:有克/刚日转支上,柔日转干上);末=中刑(中自刑取冲)。
	if(delta === 0){
		const hasKe = restrains(gan, k1) || restrains(k1, gan);
		let c0;
		let altMid;
		let name;
		if(hasKe){ c0 = k1; altMid = k3; name = '不虞课'; }
		else if(yang){ c0 = k1; altMid = k3; name = '自任课'; }
		else { c0 = k3; altMid = k1; name = '自信课'; }
		const x0 = xingChain(c0);
		const c1 = x0.selfX ? altMid : x0.next;
		const x1 = xingChain(c1);
		const c2 = x1.selfX ? CHONG(c1) : x1.next;
		if(!hasKe && x0.selfX){ name = '杜传课'; }
		return { name, cuang: [c0, c1, c2] };
	}

	const resolveKe = (cands, oneName, biName, mode) => {
		const u = uniq(cands);
		if(u.length === 0){ return null; }
		if(u.length === 1){ return { name: oneName, cuang: walk(u[0]) }; }
		const bi = u.filter((z) => (YANG_ZI.indexOf(z) >= 0) === yang);
		if(bi.length === 1){ return { name: biName, cuang: walk(bi[0]) }; }
		return sheHai(bi.length > 1 ? bi : u);
	};

	// 涉害(App 默认法):候选自所临地盘宫涉归本家,含起点不含本家;
	// 途中地盘支克候选 +1、该宫所寄之干克候选 +1(只数「克我」一向)。
	const sheHai = (cands) => {
		let max = -1;
		let stack = [];
		cands.forEach((c) => {
			let cnt = 0;
			let seat = ((ZI.indexOf(c) - delta) % 12 + 12) % 12;
			let home = ZI.indexOf(c);
			if(home < seat){ home += 12; }
			for(let i = seat; i < home; i++){
				const z = ZI[i % 12];
				if(restrains(z, c)){ cnt++; }
				(SEAT_GANS[z] || []).forEach((g) => { if(restrains(g, c)){ cnt++; } });
			}
			if(cnt > max){ max = cnt; stack = [c]; }
			else if(cnt === max){ stack.push(c); }
		});
		if(stack.length === 1){ return { name: '涉害课', cuang: walk(stack[0]) }; }
		const onMeng = stack.filter((c) => MENG.indexOf(seatOf(c)) >= 0);
		if(onMeng.length === 1){ return { name: '见机课', cuang: walk(onMeng[0]) }; }
		const onZhong = stack.filter((c) => ZHONG.indexOf(seatOf(c)) >= 0);
		if(onZhong.length === 1){ return { name: '察微课', cuang: walk(onZhong[0]) }; }
		return { name: '缀瑕课', cuang: walk(yang ? k1 : k3) };
	};

	// 返吟:有克照常取克(总名无依);无克(丁己辛之丑未日)取日支驿马,中支上末干上,名无亲。
	if(delta === 6){
		let r = resolveKe(courses.filter((c) => restrains(c[1], c[0])).map((c) => c[0]), '', '');
		if(!r){ r = resolveKe(courses.filter((c) => restrains(c[0], c[1])).map((c) => c[0]), '', ''); }
		if(r){ return { name: '无依课', cuang: r.cuang }; }
		return { name: '无亲课', cuang: [YIMA[zhi], k3, k1] };
	}

	// 贼克:下贼上先,上克下后;多者取比,俱比俱不比涉害。
	let r = resolveKe(courses.filter((c) => restrains(c[1], c[0])).map((c) => c[0]), '重审课', '比用课');
	if(r){ return r; }
	r = resolveKe(courses.filter((c) => restrains(c[0], c[1])).map((c) => c[0]), '元首课', '知一课');
	if(r){ return r; }

	// 八专(干支同位,止两课):无克不复取遥克,径入。阳日干上神顺数三,阴日第四课上神逆数三,中末皆干上神。
	if(k1 === k3){
		const c0 = yang ? ZI[(ZI.indexOf(k1) + 2) % 12] : ZI[(ZI.indexOf(k4) + 10) % 12];
		return { name: '八专课', cuang: [c0, k1, k1] };
	}

	// 遥克:二三四课上神克日干(蒿矢)先,日干克上神(弹射)后;多者取比,再多涉害。
	r = resolveKe(courses.slice(1).filter((c) => restrains(c[0], gan)).map((c) => c[0]), '蒿矢课', '蒿矢课');
	if(r){ return r; }
	r = resolveKe(courses.slice(1).filter((c) => restrains(gan, c[0])).map((c) => c[0]), '弹射课', '弹射课');
	if(r){ return r; }

	// 别责(四课不全三课备,无克无遥):刚日取干合寄宫上神,柔日取支前三合;中末皆干上神。
	const dup = k1 === k2 || k1 === k4 || k2 === k3 || k2 === k4 || k3 === k4;
	if(dup){
		const c0 = yang ? shang(JI[GAN_HE[gan]]) : SANHE_NEXT[zhi];
		return { name: yang ? '不备课' : '芜淫课', cuang: [c0, k1, k1] };
	}

	// 昴星(四课全,无克无遥):刚日仰取地盘酉宫上神(先辰后日),柔日俯取天盘酉所临地盘支(先日后辰)。
	if(yang){
		return { name: '虎视课', cuang: [shang('酉'), k3, k1] };
	}
	return { name: '掩目课', cuang: [seatOf('酉'), k1, k3] };
}

// ── 引擎侧驱动(与 lrzhan/LiuRengMain.buildLiuRengLayout/buildKeData 同构) ──
const JIGONG = JI;
function makeChart(delta, gan, zhi){
	const downZi = ZI.slice(0);
	const upZi = ZI.map((_, i) => ZI[(i + delta) % 12]);
	const shang = (z) => upZi[downZi.indexOf(z)];
	const c1 = shang(JIGONG[gan]);
	const c2 = shang(c1);
	const c3 = shang(zhi);
	const c4 = shang(c3);
	const ke = [['', c1, gan], ['', c2, c1], ['', c3, zhi], ['', c4, c3]];
	return new ChuangChart({ owner: null, chartObj: { nongli: { dayGanZi: gan + zhi } }, nongli: { dayGanZi: gan + zhi }, ke, seHaiOpts: null, liuRengChart: { downZi, upZi, houseTianJiang: new Array(12).fill('贵人') }, x: 0, y: 0, width: 0, height: 0 });
}

const DAYS60 = [];
for(let i = 0; i < 60; i++){ DAYS60.push([GAN10[i % 10], ZI[i % 12]]); }

describe('大六壬 · 九宗门 720 课全域独立对拍(oracle)', () => {
	test('60 日 × 12 天地盘:课名 + 三传逐课零分歧', () => {
		const diffs = [];
		let baZhuanCnt = 0;
		DAYS60.forEach(([gan, zhi]) => {
			for(let delta = 0; delta < 12; delta++){
				const exp = oracle(delta, gan, zhi);
				const got = makeChart(delta, gan, zhi).getSangCuang();
				if(exp.name === '八专课'){ baZhuanCnt++; }
				if(got.name !== exp.name || got.cuang.join('') !== exp.cuang.join('')){
					diffs.push(`${gan}${zhi}日 天盘+${delta}:引擎 ${got.name}/${got.cuang.join('')} ≠ oracle ${exp.name}/${exp.cuang.join('')}`);
				}
			}
		});
		expect(diffs).toEqual([]);
		// 全域八专无克数量普查:五个八专日(甲寅庚申丁未己未癸丑)各 12 盘,减去伏吟/返吟各 1 盘
		// 及有克盘后的余量——数值一经确认即锁,防未来把八专再度误吞进遥克/别责。
		expect(baZhuanCnt).toBeGreaterThanOrEqual(10);
	});

	// 破坏性自证(哨兵正反双跑纪律):在测试内复原历史错误顺序(遥克先于八专),
	// 对拍必须能抓出分歧——若此用例失败,说明对拍本身失去牙齿(虚绿),比引擎回归更危险。
	test('负控:恢复旧序(遥克先于八专)时对拍必报分歧', () => {
		class OldOrderChart extends ChuangChart {
			getSangCuang(){
				let c = this.isFuYin(); if(c){ return c; }
				c = this.isFangYin(); if(c){ return c; }
				c = this.isJinKe0(); if(c){ return c; }
				c = this.isJinKe1(); if(c){ return c; }
				c = this.isYaoKe0(); if(c){ return c; }
				c = this.isYaoKe1(); if(c){ return c; }
				c = this.isBaZhuang(); if(c){ return c; }
				c = this.isBieZe(); if(c){ return c; }
				return this.isMaoXing();
			}
		}
		let mismatch = 0;
		DAYS60.forEach(([gan, zhi]) => {
			for(let delta = 0; delta < 12; delta++){
				const downZi = ZI.slice(0);
				const upZi = ZI.map((_, i) => ZI[(i + delta) % 12]);
				const shang = (z) => upZi[downZi.indexOf(z)];
				const c1 = shang(JIGONG[gan]);
				const c3 = shang(zhi);
				const ke = [['', c1, gan], ['', shang(c1), c1], ['', c3, zhi], ['', shang(c3), c3]];
				const old = new OldOrderChart({ owner: null, chartObj: { nongli: { dayGanZi: gan + zhi } }, nongli: { dayGanZi: gan + zhi }, ke, seHaiOpts: null, liuRengChart: { downZi, upZi, houseTianJiang: new Array(12).fill('贵人') }, x: 0, y: 0, width: 0, height: 0 }).getSangCuang();
				const exp = oracle(delta, gan, zhi);
				if(old.name !== exp.name || old.cuang.join('') !== exp.cuang.join('')){ mismatch++; }
			}
		});
		// 旧序会把「八专无近克而带遥克」的课式误发蒿矢/弹射——#46 两例(天盘+9/+4)必在其中。
		expect(mismatch).toBeGreaterThanOrEqual(2);
	});
});
