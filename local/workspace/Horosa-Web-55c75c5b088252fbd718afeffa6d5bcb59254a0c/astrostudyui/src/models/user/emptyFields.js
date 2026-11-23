// 用户模型 · 空命盘 / 空事盘字段表(新建与重置时的基准)
// 从 user.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import DateTime from '../../components/comp/DateTime';
import { DefLat, DefLon, DefGpsLat, DefGpsLon } from '../../utils/constants';

export function newEmptyChartFields(){
	let now = new DateTime();
	const fields = {
		birth: {
			value: now,
			name: ['birth'],
		},
		zone: {
			value: now.zone,
			name: ['zone'],
		},
		lat: {
			value: DefLat,
			name: ['lat'],
		},
		lon: {
			value: DefLon,
			name: ['lon'],
		},
		gpsLat: {
			value: DefGpsLat,
			name: ['gpsLat'],
		},
		gpsLon: {
			value: DefGpsLon,
			name: ['gpsLon'],
		},
		pos: {
			value: null,
			name: ['pos'],
		},
		name: {
			value: null,
			name: ['name'],
		},
		isPub: {
			value: 0,
			name: ['isPub'],
		},
		gender: {
			value: -1,
			name: ['gender'],
		},
		group: {
			value: null,
			name: ['group'],
		},
		doubingSu28: {
			value: 0,
			name: ['doubingSu28'],
		},
		creator: {
			value: null,
			name: ['creator'],
		},
		updateTime: {
			value: null,
			name: ['updateTime'],
		},
		cid: {
			value: null,
			name: ['cid'],
		},
		// 日界点 + 晚子时·时柱起干 + 时间算法 必须随命盘存档(不存则下次打开按全局默认,日柱/时柱可能算错)。
		orbs:{
			value: undefined,
			name: ['orbs'],
		},
		orbScale:{
			value: undefined,
			name: ['orbScale'],
		},
		after23NewDay:{
			value: undefined,
			name: ['after23NewDay'],
		},
		lateZiHourUseNextDay:{
			value: undefined,
			name: ['lateZiHourUseNextDay'],
		},
		timeAlg:{
			value: undefined,
			name: ['timeAlg'],
		},
		memoAstro:{
			value: null,
			name: ['memoAstro'],
		},
		memoBaZi:{
			value: null,
			name: ['memoBaZi'],
		},
		memoZiWei:{
			value: null,
			name: ['memoZiWei'],
		},
		memo74:{
			value: null,
			name: ['memo74'],
		},
		memoGua:{
			value: null,
			name: ['memoGua'],
		},
		memoLiuReng:{
			value: null,
			name: ['memoLiuReng'],
		},
		memoQiMeng:{
			value: null,
			name: ['memoQiMeng'],
		},
		memoSuZhan:{
			value: null,
			name: ['memoSuZhan'],
		},
		// [V] 通用备注(命盘表单直填;技法批注 memo* 八槽照旧走右栏「命盘批注」抽屉)。
		memo: {
			value: null,
			name: ['memo'],
		},
		rodden: {
			value: null,
			name: ['rodden'],
		},
		relation: {
			value: null,
			name: ['relation'],
		},
		sourceNote: {
			value: null,
			name: ['sourceNote'],
		},
		payload: {
			value: null,
			name: ['payload'],
		},
		sourceModule: {
			value: null,
			name: ['sourceModule'],
		},
		chartType: {
			value: null,
			name: ['chartType'],
		},

	};

	return fields;
}

export function newEmptyCaseFields(){
	let now = new DateTime();
	const fields = {
		divTime: {
			value: now,
			name: ['divTime'],
		},
		zone: {
			value: now.zone,
			name: ['zone'],
		},
		lat: {
			value: DefLat,
			name: ['lat'],
		},
		lon: {
			value: DefLon,
			name: ['lon'],
		},
		gpsLat: {
			value: DefGpsLat,
			name: ['gpsLat'],
		},
		gpsLon: {
			value: DefGpsLon,
			name: ['gpsLon'],
		},
		pos: {
			value: null,
			name: ['pos'],
		},
		event: {
			value: null,
			name: ['event'],
		},
		caseType: {
			value: 'liuyao',
			name: ['caseType'],
		},
		// 性别随档(占类影响取用神:六爻占婚男取妻财/女取官鬼)。null=未指定,不落库。
		// 🔴 曾三段断链:存案入口一直送 caseGenderValue(fields),但此模板无槽 → 表单管道整段丢,
		// applyCase 的 gender 还原读取永远落空、AI 挂载恒退默认男。
		gender: {
			value: null,
			name: ['gender'],
		},
		// 事盘备注(断后复盘/应期回填;present 才落库)。
		memo: {
			value: null,
			name: ['memo'],
		},
		rodden: {
			value: null,
			name: ['rodden'],
		},
		relation: {
			value: null,
			name: ['relation'],
		},
		sourceNote: {
			value: null,
			name: ['sourceNote'],
		},
		isPub: {
			value: 0,
			name: ['isPub'],
		},
		group: {
			value: null,
			name: ['group'],
		},
		creator: {
			value: null,
			name: ['creator'],
		},
		updateTime: {
			value: null,
			name: ['updateTime'],
		},
		cid: {
			value: null,
			name: ['cid'],
		},
		payload: {
			value: null,
			name: ['payload'],
		},
		sourceModule: {
			value: null,
			name: ['sourceModule'],
		},
	};
	return fields;
}
