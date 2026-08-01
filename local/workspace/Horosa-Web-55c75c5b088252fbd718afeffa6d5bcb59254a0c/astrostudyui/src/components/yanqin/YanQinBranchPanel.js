// 演禽 · 右栏「演法」结果面板:挂在原万化仙禽演禽页右侧信息栏(主三栏盘与原页签零改)。
// 时间/性别复用左栏(主命盘)输入;流派/互锁开关在左输入栏(YanQinControls,共享 yanqinStore)。
// 本面板只出结果:子页签 起禽/择日/占卜/投胎。纯前端引擎,零后端。
import React, { Component } from 'react';
import { Solar } from 'lunar-javascript';
import { Tabs, Input, InputNumber } from 'antd';
import { XQSelect, XQTable } from '../xq-ui';
import {
	YAO_TO_WUXING, DIZHI, DIZHI_TO_IDX, R_RING, mansionByIdx,
	SIJI_WANG, YANQIN_12GONG_ZIWEI, TIANGAN,
} from './yanqinConst';
import {
	castQinChart, qinKeByWuxing, wuxingOfMansion, monthQin, toutaiDu,
	yearQin, ganzhiOfDay, mansionOfDay, yuanJiangOfDay, huangHeiDao, jianChu,
	dingjuRiqin, dingjuYueqin, dingjuNianqin, seasonOfMansionHead,
} from './yanqinEngine';
import { resolveWoBi, YANQIN_PRESETS } from './yanqinSchools';
import { getYanqinSettings, subscribeYanqin } from './yanqinStore';
import { STROKE_TO_YAO, STROKE_LABELS, chaiziChart, BAMEN } from './chaiziEngine';
import { XIUYAO_27, sanjiu, xiangXing, XIANGXING_MEANING } from './xiuyaoEngine';
import YanQinChart from './YanQinChart';
import {
	ZHIRI_JIXIONG, SISHI_YIJI, SISHI_COLS, SUOBO_POSITIONS, SUOBO_DETAIL, QIZHENG_CHANGSHENG,
	FENLEI_ZHAN, ZHANDUAN_ZONGZE, TUNDAN_GE, TUNDAN_JUE_12ZHI, THIRTYSIX_XIHAO,
	KEYING_MIAOJUE, KEYING_PENDING,
} from './yanqinData';
import './yanqinPanel.less';
import { parseDateParts } from '../../utils/dateStrSafe';
import { isLunarJsYearReliable } from '../../utils/lunarDomainGuard';
import { deriveNongliUniversalSync, subscribeRemoteNongli } from '../../utils/divinationTimeDraft';

const { TabPane } = Tabs;
const WUXING_COLOR = { 木: '#3a7d44', 火: '#c0392b', 土: '#b8860b', 金: '#9a8478', 水: '#2c6e9b' };
const NATURE_COLOR = { 大吉: '#2e7d32', 吉: '#3c9a4e', 半吉: '#7cb342', '半吉半凶': '#b8860b', 凶: '#c0392b', 大凶: '#8e1b1b' };
const TONE_COLOR = { best: '#2e7d32', good: '#43a047', mid: '#b8860b', bad: '#c0392b', worst: '#8e1b1b' };
const TONE_LABEL = { best: '极得地·大化吉', good: '得地·吉', mid: '平/视禽而定', bad: '失位·凶弱', worst: '极凶' };
const MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

function mod(n, m) { return ((n % m) + m) % m; }
function hourToBranch(h) { return Math.floor(((h + 1) % 24) / 2); }
// 性别→1(男)/0(女):优先左栏「性别」控件(props.gender,与系统A/河洛/一掌经 this.state.gender 同源),
// 回退命盘 fields.gender;'0'/'女'/'Female'/'F'/0 皆判女——防 string '0'/'Female' 恒真被误判男(投胎男女命标签)。
function resolveMaleFlag(propGender, fieldGender) {
	let raw = 1;
	if (propGender !== undefined && propGender !== null) { raw = propGender; }
	else if (fieldGender && fieldGender.value !== undefined) { raw = fieldGender.value; }
	const s = String(raw);
	return (s === '0' || s === '女' || s === 'Female' || s === 'female' || s === 'F') ? 0 : 1;
}

const TOUTAI_DUAN = {
	凤凰: '至尊之禽。男主显贵、女主端淑;一生清高、近贵得名。', 狮子: '男人多福寿,女人珠满箱。威重有权,宜掌印持柄。',
	孔雀: '女人多艳丽,男人作朝臣。文采风流、近华近贵。', 金鸡: '女人从夫义,男人多廉节。勤谨守分、衣禄无亏。',
	白鸽: '男子为僧道,女子诵心经。清虚淡泊、近释道缘。', 鸳鸯: '主和合姻缘、夫妻偕老;情厚而重义。',
	仙鹤: '清贵高寿、超然出尘;宜艺宜隐。', 白鹿: '禄养丰足、林泉之福;性柔得安。',
	燕子: '勤而善营、往来得利;主迁动。', 朱雀: '口才文明、亦防口舌是非。',
	双雁: '主信义、远行有成;伴侣相随。', 鸿雁: '志高远行、音信往来;漂泊中得名。',
};

function chip(label, mansion) {
	if (!mansion) { return null; }
	return (
		<span className="yq-chip" key={label}>
			<span className="yq-chip-label">{label}</span>
			<span className="yq-chip-pill" style={{ background: WUXING_COLOR[YAO_TO_WUXING[mansion.yao]] || '#666' }}>
				<i className="yq-dot" />{mansion.name}
			</span>
		</span>
	);
}
function suoboOf(mansion, timeBranchIdx) {
	if (!mansion) { return null; }
	const cs = QIZHENG_CHANGSHENG[mansion.yao];
	if (cs == null) { return null; }
	const pos = SUOBO_POSITIONS[mod(timeBranchIdx - DIZHI_TO_IDX[cs], 12)];
	return { pos, ...SUOBO_DETAIL[pos] };
}

export default class YanQinBranchPanel extends Component {
	constructor(props) {
		super(props);
		this.state = {
			sub: props.initialSub || 'zeri', shiClass: 'hunyin',
			chaiziNum: 8, chaiziStrokes: '横,竖,撇,捺', xiuyaoMing: '昴', xiuyaoOther: '角',
		};
		this._onStore = () => this.forceUpdate();
	}
	componentDidMount() {
		this._unsub = subscribeYanqin(this._onStore);
		// 全年份域:BC/域外农历月(月禽/投胎)经远程桥;桥远程回包后触发重渲补全(域内 lunar-js 无桥)。
		this._unsubRemoteNongli = subscribeRemoteNongli(() => { if (!this._ymUnmounted) { this.forceUpdate(); } });
	}
	componentWillUnmount() {
		this._ymUnmounted = true;
		if (this._unsub) { this._unsub(); }
		if (this._unsubRemoteNongli) { this._unsubRemoteNongli(); }
	}

	// 复用左栏(主命盘)时间/性别。fields.date/time.value 是 app 的 DateTime 对象(非 moment):
	// 用 .format() 取值(同 KinAstroMain.parseFieldsDateTime),不用 .year() 方法。
	fieldsTime() {
		const f = this.props.fields;
		if (!f || !f.date || !f.date.value || !f.time || !f.time.value) { return null; }
		const dv = f.date.value; const tv = f.time.value;
		if (typeof dv.format !== 'function' || typeof tv.format !== 'function') { return null; }
		const _dp = parseDateParts(dv.format('YYYY-MM-DD'));
		const dm = _dp ? [_dp.year, _dp.month, _dp.day] : [];
		const hour = parseInt(tv.format('HH:mm:ss').split(':')[0], 10);
		// 🔴 全年份域:年可为公元前(负,无 0 年)——旧 `dm[0] > 0` 把 BC 整段拦成 null → 演法面板
		// (起禽/择日/占卜/投胎)对 BC 全空。演禽引擎日禽/年禽/时禽/翻禽全走 dayNumber(儒略/格里 JDN)
		// BC 安全;放行负年(仅排除 0 年/非数)即可渲染。农历月(月禽/投胎)另经 lunarMonthOf 走桥。
		if (!Number.isFinite(dm[0]) || dm[0] === 0 || !(dm[1] > 0) || !(dm[2] > 0) || isNaN(hour)) { return null; }
		const hb = hourToBranch(hour);
		return {
			year: dm[0], month: dm[1], day: dm[2], hourBranch: hb,
			gender: resolveMaleFlag(this.props.gender, f.gender),
			timeStr: `${dv.format('YYYY-MM-DD')} ${DIZHI[hb]}时`,
		};
	}

	cast(ft) {
		if (!ft) { return null; }
		const s = getYanqinSettings();
		return castQinChart(ft.year, ft.month, ft.day, ft.hourBranch, { useXun: s.xunOffset, huoYaoVariant: s.huoYaoVariant });
	}

	// 左栏公历 → 农历月(投胎/月禽用)。域内(AD1~9999)走 lunar-js;域外(BC/万年后)lunar-js 节气
	// 静默错位 → 月禽/投胎错,改走远程农历桥(与八字/紫微/一掌经同源;桥远程回包由 subscribeRemoteNongli
	// 触发重渲补全,首回退月公历月兜底不崩)。桥 monthInt 已修 BC civil 无 0 年同轴(BC12026=三月)。
	lunarMonthOf(ft) {
		if (isLunarJsYearReliable(ft.year)) {
			try { return mod(Math.abs(Solar.fromYmd(ft.year, ft.month, ft.day).getLunar().getMonth()) - 1, 12) + 1; }
			catch (e) { return ft.month; }
		}
		try {
			const nl = deriveNongliUniversalSync(this.props.fields);
			if (nl && nl.monthInt) { return nl.monthInt; }
		} catch (e) { /* 远程在途/失败 → 兜底 */ }
		return ft.month; // 桥远程在途:退公历月;回包后重渲取真农历月
	}

	renderInfoBar(ft) {
		const s = getYanqinSettings();
		const school = (YANQIN_PRESETS[s.school] || {}).label || '自定义';
		return (
			<div className="yq-infobar">
				{ft ? <span>取左栏时间 <b>{ft.timeStr}</b></span> : <span className="yq-note">左栏填时间后起算</span>}
				<span className="yq-infobar-school">流派 · {school}</span>
			</div>
		);
	}

	renderNoTime() { return <div className="yq-card yq-note">请先在左栏填好出生 / 目标时间(演法诸法取左栏时间起算);流派与高级开关也在左栏「演法设置」。</div>; }

	renderQiqin(ft) {
		const cast = this.cast(ft);
		if (!cast) { return <div>{this.renderInfoBar(ft)}{this.renderNoTime()}</div>; }
		const s = getYanqinSettings();
		const mq = monthQin(ft.year, this.lunarMonthOf(ft), s.monthVerse);
		const oneYuanIdx = mod(cast.dayQin.idx - 1 - (cast.yuan - 1) * 4, 28) + 1;
		const row = [1, 2, 3, 4, 5, 6, 7].map((e) => mansionByIdx(mod(oneYuanIdx - 1 + (e - 1) * 4, 28) + 1).name);
		return (
			<div>
				{this.renderInfoBar(ft)}
				<div className="yq-card">
					<div className="yq-meta">{cast.ganzhi}日 · {cast.yuan}元{cast.jiang}将 · {cast.weekday}曜</div>
					<div className="yq-divider" />
					<div className="yq-chip-row">
						{chip('年禽', cast.yearQin)}{chip('月禽', mq)}{chip('日禽', cast.dayQin)}{chip('时禽', cast.hourQin)}
						{chip('翻禽', cast.fanQin)}
						{cast.daoJiang ? chip('倒将·主', cast.daoJiang.zhuJiang) : null}
						{cast.daoJiang ? chip('倒将·次', cast.daoJiang.ciJiang) : null}
						{cast.huoYao ? chip('活曜', cast.huoYao) : null}
					</div>
				</div>
				<div className="yq-card">
					<div className="yq-sec">起禽推导</div>
					<div className="yq-kv">① <span className="k">日禽</span>:周历机制(锚 1996-01-28 甲子虚日鼠周日)→ <b>{cast.dayQin.name}</b>。</div>
					<div className="yq-kv">② <span className="k">元将</span>:七元甲子 420 日 → <b>{cast.yuan}元{cast.jiang}将</b>。</div>
					<div className="yq-kv">③ <span className="k">时禽</span>:元元相轮 {R_RING.join('→')} {cast.ziStart ? <span>子时起 <b>{cast.ziStart.name}</b> →</span> : null} <b>{cast.hourQin.name}</b>。</div>
					<div className="yq-kv">④ <span className="k">翻禽</span>:当日盘读时禽→日禽落点 → <b>{cast.fanQin.name}</b>。</div>
					<div className="yq-kv">⑤ <span className="k">四季旺</span>:日禽{cast.dayQin.name[0]}宿旺于 <b style={{ color: 'var(--horosa-accent,#b8860b)' }}>{seasonOfMansionHead(cast.dayQin.name[0]) || '—'}</b>(得时令则强、失令则弱)。</div>
					<div className="yq-sec" style={{ marginTop: 10 }}>日禽定局 · {cast.ganzhi}行</div>
					<XQTable size="small" pagination={false}
						dataSource={[{ key: 'r', ...row.reduce((o, v, i) => { o['e' + i] = v; return o; }, {}) }]}
						columns={[1, 2, 3, 4, 5, 6, 7].map((e, i) => ({ title: e + '元', dataIndex: 'e' + i, render: (t) => <span style={{ fontWeight: cast.yuan === e ? 700 : 400, color: cast.yuan === e ? 'var(--horosa-accent,#b8860b)' : 'inherit' }}>{t}</span> }))} />
				</div>
			</div>
		);
	}

	renderZeri(ft) {
		const cast = this.cast(ft);
		if (!cast) { return <div>{this.renderInfoBar(ft)}{this.renderNoTime()}</div>; }
		const di = ZHIRI_JIXIONG.find((x) => x.head === cast.dayQin.name[0]) || {};
		const sishi = SISHI_YIJI[cast.dayQin.name[0]] || [];
		const s = getYanqinSettings();
		// WP-10 择日叠加:黄黑道十二值神 + 建除十二神(月支/日支直算)。农历月支:正月=寅(idx2)。
		const lunarMonth = this.lunarMonthOf(ft);
		const monthZhiIdx = mod(lunarMonth + 1, 12);
		const dayZhiIdx = DIZHI_TO_IDX[cast.ganzhi[1]];
		const hd = huangHeiDao(monthZhiIdx, dayZhiIdx);
		const jc = jianChu(monthZhiIdx, dayZhiIdx);
		const keying = KEYING_MIAOJUE[cast.dayQin.name[0]];
		const r = resolveWoBi(s);
		const ent = { shi: cast.hourQin, fan: cast.fanQin, dao: cast.daoJiang ? cast.daoJiang.zhuJiang : null };
		const me = ent[r.me]; const they = ent[r.they];
		let ke = '—';
		if (me && they) { ke = { meWin: '我克彼 → 吉(我胜)', theyWin: '彼克我 → 凶(彼胜)', meSheng: '我生彼 → 泄气', theySheng: '彼生我 → 受助', peace: '比和 → 相持' }[qinKeByWuxing(wuxingOfMansion(me, s.qinWuxing), wuxingOfMansion(they, s.qinWuxing))]; }
		const keColor = ke.indexOf('吉') >= 0 ? NATURE_COLOR['吉'] : (ke.indexOf('凶') >= 0 ? NATURE_COLOR['凶'] : 'inherit');
		return (
			<div>
				{this.renderInfoBar(ft)}
				<div className="yq-card">
					<div className="yq-hero">
						<div className="yq-meta">{cast.ganzhi}日 · {cast.yuan}元{cast.jiang}将 · {cast.weekday}曜</div>
						<div className="yq-hero-name" style={{ color: WUXING_COLOR[YAO_TO_WUXING[cast.dayQin.yao]] }}>{cast.dayQin.name}</div>
						<span className="yq-badge" style={{ background: NATURE_COLOR[di.nature] || '#666' }}>{di.nature || '—'}</span>
					</div>
					<div className="yq-divider" />
					<div className="yq-chip-row">{chip('年禽', cast.yearQin)}{chip('日禽', cast.dayQin)}{chip('时禽', cast.hourQin)}{chip('翻禽', cast.fanQin)}</div>
					<div className="yq-divider" />
					<div className="yq-kv">禽课:我 <b>{me ? me.name : '—'}</b> / 彼 <b>{they ? they.name : '—'}</b> → <b className="yq-verdict" style={{ color: keColor }}>{ke}</b></div>
					<div className="yq-note">{r.note}(须宿吉 ＋ 我得地克彼 双吉为上课)</div>
					<div className="yq-divider" />
					<div className="yq-kv">诸吉神叠加:黄黑道 <b style={{ color: hd.huang ? TONE_COLOR.good : TONE_COLOR.worst }}>{hd.shen}</b>({hd.huang ? '黄道吉' : '黑道凶'})　建除 <b style={{ color: jc.good ? TONE_COLOR.good : 'inherit' }}>{jc.shen}</b>{jc.good ? '(择吉常用)' : ''}</div>
					<div className="yq-note">(三奇紫白需飞星,较重,本期未叠·待深化。)</div>
				</div>
				<Tabs defaultActiveKey="verse" size="small">
					<TabPane tab="值日吉凶歌" key="verse">
						<div className="yq-verse">{di.verse || '—'}</div>
						<div className="yq-yiji"><span className="yq-yi">宜</span> {di.yi || '—'}　<span className="yq-ji">忌</span> {di.ji || '—'}</div>
					</TabPane>
					<TabPane tab="四事项" key="sishi">
						<XQTable size="small" pagination={false}
							dataSource={SISHI_COLS.map((c, i) => ({ key: c, item: c, val: sishi[i] || '—' }))}
							columns={[{ title: '事项', dataIndex: 'item' }, { title: cast.dayQin.name, dataIndex: 'val' }]} />
					</TabPane>
					<TabPane tab="婚课" key="hun">
						<div className="yq-kv"><b>婚课</b>:男家问以体(时禽)为男;女家问以天禽(翻禽)为男、地禽为女。两禽比和/相生、我得地为和合吉;相克(尤彼克我)主刑克。</div>
						<div className="yq-note" style={{ marginTop: 6 }}>上等婚课＝吉宿值日 ＋ 吉时之时禽与翻禽「我得地克彼/比和」 ＋ 黄道吉神 ＋ 建除定/成。</div>
					</TabPane>
					<TabPane tab="克应·应兆" key="keying">
						{keying
							? <div className="yq-verse">{keying}</div>
							: <div className="yq-note">{cast.dayQin.name[0]}宿克应妙诀源头截断→待纸本核({KEYING_PENDING.join('')}后十宿)。</div>}
						<div className="yq-note" style={{ marginTop: 4 }}>克应妙诀断「占时应何兆」(来人/风云/声响/禽兽),区别于值日造作吉凶歌。</div>
					</TabPane>
				</Tabs>
			</div>
		);
	}

	renderZhanbu(ft) {
		const { shiClass } = this.state;
		const s = getYanqinSettings();
		const cast = this.cast(ft);
		if (!cast || !cast.hourQin) { return <div>{this.renderInfoBar(ft)}{this.renderNoTime()}</div>; }
		const r = resolveWoBi(s);
		const ent = { shi: cast.hourQin, fan: cast.fanQin, dao: cast.daoJiang ? cast.daoJiang.zhuJiang : null };
		const me = ent[r.me]; const they = ent[r.they]; const hb = cast.hourBranch;
		const j = me && they ? qinKeByWuxing(wuxingOfMansion(me, s.qinWuxing), wuxingOfMansion(they, s.qinWuxing)) : 'peace';
		const sansuoNote = { both: '断法重心:三传四课 + 翻禽倒将 + 锁泊 并用。', suobo: '断法重心:广东派 —— 重三传锁泊(飞伏得地失位为主)。', fanqin: '断法重心:江西派 —— 重翻禽倒将(我彼禽胜负为主)。' }[s.sansuo] || '';
		const res = { meWin: '我克彼 → 我胜(吉)', theyWin: '彼克我 → 我负(凶)', meSheng: '我生彼 → 我泄', theySheng: '彼生我 → 我受助', peace: '比和 → 和/相持' }[j];
		const resColor = (res.indexOf('吉') >= 0 || res.indexOf('胜') >= 0) ? TONE_COLOR.good : ((res.indexOf('凶') >= 0 || res.indexOf('负') >= 0) ? TONE_COLOR.worst : 'inherit');
		let caution = '';
		if (shiClass === 'qiucai') { caution = '空拳求财反断:以「用(彼)禽旺相、克体(我)」为得财之象。'; }
		else if (shiClass === 'jibing') { caution = '占病:地禽=病人,天禽=病症;地克天→病愈,天克地→难愈。'; }
		else if (shiClass === 'hunyin') { caution = '占婚:男问以体为男;女问以天禽为男、地禽为女。'; }
		const fl = FENLEI_ZHAN.find((x) => x.key === shiClass) || FENLEI_ZHAN[0];
		const meSb = suoboOf(me, hb); const theySb = suoboOf(they, hb);
		const isMe = (key) => r.me === key; const isThey = (key) => r.they === key;
		const chuan = (label, mansion, key) => (
			<div className={`yq-chuan${key && isMe(key) ? ' is-me' : ''}${key && isThey(key) ? ' is-they' : ''}`}>
				<span className="yq-chuan-label">{label}</span>
				<span className="yq-chuan-val" style={{ color: mansion ? WUXING_COLOR[YAO_TO_WUXING[mansion.yao]] : 'inherit' }}>{mansion ? mansion.name : '—'}</span>
			</div>
		);
		return (
			<div>
				{this.renderInfoBar(ft)}
				<div className="yq-card">
					<div className="yq-meta" style={{ marginBottom: 6 }}>{cast.ganzhi}日 · {DIZHI[hb]}时 · {cast.yuan}元{cast.jiang}将</div>
					<div className="yq-sec">三传四课</div>
					<div className="yq-sanchuan">
						{chuan('初传 / 日禽(共用)', cast.dayQin)}
						{chuan('中传 / 时禽(地禽)', cast.hourQin, 'shi')}
						{chuan('末传 / 翻禽(天禽)', cast.fanQin, 'fan')}
						{chuan('四课 / 活曜', cast.huoYao)}
						{cast.daoJiang ? chuan('倒将 / 主将', cast.daoJiang.zhuJiang, 'dao') : null}
						{cast.daoJiang ? chuan('倒将 / 次将', cast.daoJiang.ciJiang) : null}
					</div>
					<div className="yq-divider" />
					<div className="yq-kv">我(体) <b>{me ? me.name : '—'}</b>　彼(用) <b>{they ? they.name : '—'}</b></div>
					<div className="yq-kv">判:<b className="yq-verdict" style={{ color: resColor }}>{res}</b> <span className="yq-note">{r.note}</span></div>
					{caution ? <div className="yq-caution">⚠ {caution}</div> : null}
					{sansuoNote ? <div className="yq-note" style={{ marginTop: 2 }}>{sansuoNote}</div> : null}
				</div>
				<Tabs activeKey={undefined} defaultActiveKey={s.sansuo === 'fanqin' ? 'fenlei' : 'suobo'} size="small">
					<TabPane tab="锁泊" key="suobo">
						{[{ l: '我禽', m: me, sb: meSb }, { l: '彼禽', m: they, sb: theySb }].map(({ l, m, sb }) => (
							<div className="yq-suobo-row" key={l}>
								<b>{l} {m ? m.name : '—'}</b>
								{sb ? <span className="yq-suobo-pos" style={{ color: TONE_COLOR[sb.tone] }}>落「{sb.pos}」· {TONE_LABEL[sb.tone]}</span> : ' · —'}
								{sb ? <div className="yq-note">{sb.text}</div> : null}
							</div>
						))}
						<div className="yq-note" style={{ borderTop: '1px solid var(--horosa-border,rgba(120,120,120,0.2))', paddingTop: 4 }}>落天/风/月/水多得地化吉;刀位最凶。我得地、彼失位为吉。</div>
					</TabPane>
					<TabPane tab="分类占" key="fenlei">
						<XQSelect size="small" style={{ width: 130, marginBottom: 6 }} value={shiClass} onChange={(v) => this.setState({ shiClass: v })}
							options={FENLEI_ZHAN.map((x) => ({ value: x.key, label: x.label }))} />
						<div style={{ fontWeight: 700, fontSize: 14 }}>{fl.label}</div>
						<div className="yq-kv">{fl.text}</div>
					</TabPane>
					<TabPane tab="应期·总则" key="zongze">
						<div className="yq-kv"><b>应期</b>:以所克之禽/用神之禽所值地支、宿次定应期月日。</div>
						<div className="yq-kv yq-note" style={{ marginTop: 6 }}>{ZHANDUAN_ZONGZE}</div>
					</TabPane>
					<TabPane tab="吞啖相战" key="tundan">
						<div className="yq-kv"><b>占时 {DIZHI[hb]} 位</b>相战:{TUNDAN_JUE_12ZHI[DIZHI[hb]] || '—'}</div>
						<div className="yq-kv">该位化境:{THIRTYSIX_XIHAO[DIZHI[hb]] ? `${THIRTYSIX_XIHAO[DIZHI[hb]].place}境 · ${THIRTYSIX_XIHAO[DIZHI[hb]].qin.join('/')}` : '—'}</div>
						<div className="yq-divider" />
						<div className="yq-sec">吞啖相战歌(禽性生克·动物相制)</div>
						{TUNDAN_GE.map((line, i) => <div className="yq-note" key={i}>{line}</div>)}
					</TabPane>
				</Tabs>
			</div>
		);
	}

	renderToutai(ft) {
		if (!ft) { return <div>{this.renderInfoBar(ft)}{this.renderNoTime()}</div>; }
		const lunarMonth = this.lunarMonthOf(ft);
		const bird = toutaiDu(lunarMonth, ft.hourBranch);
		return (
			<div>
				{this.renderInfoBar(ft)}
				<div className="yq-card">
					<div className="yq-hero">
						<div className="yq-meta">投胎度数 · 农历 {MONTHS[lunarMonth - 1]}月 {DIZHI[ft.hourBranch]}时 · {ft.gender ? '男' : '女'}命</div>
						<div className="yq-hero-name yq-sm" style={{ color: 'var(--horosa-accent, #b8860b)' }}>{bird}</div>
					</div>
					<div className="yq-divider" />
					<div className="yq-kv">{TOUTAI_DUAN[bird] || '⚠️ 此禽逐字命运分段待校《三世演禽》全本。'}</div>
					<div className="yq-note" style={{ marginTop: 4 }}>(取左栏出生时间自动换算农历月;月以节令为界。投胎度数 = 农历月令与时辰之差。)</div>
				</div>
				<div className="yq-card">
					<div className="yq-sec">演禽十二宫字位(六吉六凶 · 参考)</div>
					<div className="yq-ziwei-row">
						{YANQIN_12GONG_ZIWEI.map((z) => (
							<span key={z.zi} className="yq-ziwei-cell" style={{ color: z.ji ? TONE_COLOR.good : TONE_COLOR.worst }}>{z.zi}</span>
						))}
					</div>
					<div className="yq-note">贵文印权福寿为吉、劫伤孤空暗刑为凶(非紫微式固定宫神)。身命胎主星「落何字位」古籍未给精确锚点→待纸本,此处仅列字位表。</div>
				</div>
			</div>
		);
	}

	// WP-11 定局:日禽60×7 / 月禽7×12 / 年禽三元 完整查表(当前盘高亮)。引擎循环生成,零新算法。
	renderDingju(ft) {
		const s = getYanqinSettings();
		const cur = ft ? { gz: ganzhiOfDay(ft.year, ft.month, ft.day), yuan: yuanJiangOfDay(ft.year, ft.month, ft.day).yuan, year: ft.year } : {};
		const ri = dingjuRiqin();
		const yue = dingjuYueqin(s.monthVerse);
		const nian = dingjuNianqin(1864, 2043);
		const hi = (on) => (on ? { fontWeight: 700, color: 'var(--horosa-accent,#b8860b)' } : {});
		return (
			<div>
				{this.renderInfoBar(ft)}
				<Tabs defaultActiveKey="ri" size="small">
					<TabPane tab="日禽 60×7" key="ri">
						<div className="yq-note" style={{ marginBottom: 4 }}>干支 × 七元 → 值日宿(当前 {cur.gz || '—'}·{cur.yuan || '—'}元 高亮)。</div>
						<XQTable size="small" pagination={false} scroll={{ y: 360 }}
							dataSource={ri.map((r) => ({ key: r.ganzhi, gz: r.ganzhi, ...r.cells.reduce((o, v, i) => { o['y' + i] = v; return o; }, {}) }))}
							columns={[{ title: '干支', dataIndex: 'gz', width: 44, render: (t) => <span style={hi(t === cur.gz)}>{t}</span> }]
								.concat([1, 2, 3, 4, 5, 6, 7].map((e, i) => ({ title: e + '元', dataIndex: 'y' + i, render: (t, row) => <span style={hi(row.gz === cur.gz && cur.yuan === e)}>{t}</span> })))} />
					</TabPane>
					<TabPane tab="月禽 7×12" key="yue">
						<div className="yq-note" style={{ marginBottom: 4 }}>年禽曜 × 农历月 → 月禽({s.monthVerse}版口诀)。</div>
						<XQTable size="small" pagination={false}
							dataSource={yue.map((r) => ({ key: r.yao, yao: r.yao + '曜', ...r.cells.reduce((o, v, i) => { o['m' + i] = v; return o; }, {}) }))}
							columns={[{ title: '年禽曜', dataIndex: 'yao', width: 52 }]
								.concat(MONTHS.map((m, i) => ({ title: m, dataIndex: 'm' + i })))} />
					</TabPane>
					<TabPane tab="年禽三元" key="nian">
						<div className="yq-note" style={{ marginBottom: 4 }}>上元1864 / 中元1924 / 下元1984,一年一宿(当前 {cur.year || '—'} 高亮)。</div>
						<div className="yq-nianqin-grid">
							{nian.map((n) => (
								<span className="yq-nianqin-cell" key={n.year} style={hi(n.year === cur.year)}>
									<i>{n.year}</i>{n.name}
								</span>
							))}
						</div>
					</TabPane>
				</Tabs>
			</div>
		);
	}

	// WP-23 圆形演禽盘 + WP-24 三传流转弧
	renderPan(ft) {
		const cast = this.cast(ft);
		if (!cast || !cast.ziStart) { return <div>{this.renderInfoBar(ft)}{this.renderNoTime()}</div>; }
		const s = getYanqinSettings();
		const r = resolveWoBi(s);
		const ent = { shi: cast.hourQin, fan: cast.fanQin, dao: cast.daoJiang ? cast.daoJiang.zhuJiang : null };
		const me = ent[r.me]; const they = ent[r.they];
		return (
			<div>
				{this.renderInfoBar(ft)}
				<div className="yq-card">
					<div className="yq-sec">圆形演禽盘 · {DIZHI[cast.hourBranch]}时</div>
					<YanQinChart cast={cast} me={me} they={they} />
				</div>
				<div className="yq-card">
					<div className="yq-sec">三传流转(日→时→翻)</div>
					<div className="yq-sanchuan-arc">
						<span className="yq-arc-node" style={{ color: WUXING_COLOR[YAO_TO_WUXING[cast.dayQin.yao]] }}>{cast.dayQin.name}</span>
						<span className="yq-arc-sep">→</span>
						<span className="yq-arc-node" style={{ color: cast.hourQin ? WUXING_COLOR[YAO_TO_WUXING[cast.hourQin.yao]] : 'inherit' }}>{cast.hourQin ? cast.hourQin.name : '—'}</span>
						<span className="yq-arc-sep">→</span>
						<span className="yq-arc-node" style={{ color: cast.fanQin ? WUXING_COLOR[YAO_TO_WUXING[cast.fanQin.yao]] : 'inherit' }}>{cast.fanQin ? cast.fanQin.name : '—'}</span>
					</div>
					<div className="yq-note">初传日禽(共用) → 中传时禽(我/体) → 末传翻禽(彼/用)。我 <b>{me ? me.name : '—'}</b> / 彼 <b>{they ? they.name : '—'}</b>。</div>
				</div>
			</div>
		);
	}

	// WP-20 拆字演禽(八门)· 独立子系统(不碰四禽主链)
	renderChaizi() {
		const { chaiziNum, chaiziStrokes } = this.state;
		const strokes = `${chaiziStrokes}`.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
		const strokeYaos = strokes.map((x) => STROKE_TO_YAO[x]).filter(Boolean);
		const r = chaiziChart(chaiziNum, strokeYaos);
		return (
			<div>
				<div className="yq-card">
					<div className="yq-sec">拆字演禽(八门)· 独立起盘</div>
					<div className="yq-kv">报数:<InputNumber size="small" min={1} value={chaiziNum} onChange={(v) => this.setState({ chaiziNum: v || 1 })} style={{ width: 80, marginLeft: 6 }} /></div>
					<div className="yq-kv">笔顺(逗号分隔):<Input size="small" value={chaiziStrokes} onChange={(e) => this.setState({ chaiziStrokes: e.target.value })} style={{ width: 180, marginLeft: 6 }} /></div>
					<div className="yq-note">笔画配政:{Object.values(STROKE_LABELS).join('、')}</div>
					<div className="yq-divider" />
					<div className="yq-chip-row">
						{chip('遇星(彼)', r.yuXing)}{chip('主星(我)', r.zhuXing)}
					</div>
					<div className="yq-kv">流星(过程):{r.liuXing.length ? r.liuXing.map((x) => x.name).join(' → ') : '—'}</div>
					<div className="yq-note">断:主星=我/体、遇星=彼/用、日禽=彼我共用、流星=过程;看三星五行生克 + 禽性吞啖锁泊格局。</div>
				</div>
				<div className="yq-card">
					<div className="yq-sec">八门(事类方向 · 吉凶加权)</div>
					<XQTable size="small" pagination={false}
						dataSource={BAMEN.map((b) => ({ key: b.name, men: b.name, ji: b.ji, use: b.use }))}
						columns={[{ title: '门', dataIndex: 'men', width: 40 }, { title: '吉凶', dataIndex: 'ji', width: 44 }, { title: '事类', dataIndex: 'use' }]} />
				</div>
			</div>
		);
	}

	// WP-21 宿曜道 / 三九秘法 · 独立子系统(27 宿去牛)
	renderXiuyao() {
		const { xiuyaoMing, xiuyaoOther } = this.state;
		const sj = sanjiu(xiuyaoMing);
		const xx = xiangXing(xiuyaoMing, xiuyaoOther);
		const opts = XIUYAO_27.map((h) => ({ value: h, label: h }));
		return (
			<div>
				<div className="yq-card">
					<div className="yq-sec">宿曜道 · 三九秘法(27 宿去牛)</div>
					<div className="yq-kv">本命宿:<XQSelect size="small" style={{ width: 90, marginLeft: 6 }} value={xiuyaoMing} onChange={(v) => this.setState({ xiuyaoMing: v })} options={opts} /></div>
					<div className="yq-divider" />
					{sj ? (
						<div className="yq-chip-row-simple">
							<span className="yq-xiuyao-cell">命 <b>{sj.ming}</b></span>
							<span className="yq-xiuyao-cell">业(前世) <b>{sj.ye}</b></span>
							<span className="yq-xiuyao-cell">胎(来世) <b>{sj.tai}</b></span>
						</div>
					) : null}
					<div className="yq-note">三九:本命宿为「命」,每 9 宿取一 → 第 9 宿=业、第 18 宿=胎,三段各 9 宿覆盖 27(三世因缘)。</div>
				</div>
				<div className="yq-card">
					<div className="yq-sec">人际相性(729 通)</div>
					<div className="yq-kv">对方本命宿:<XQSelect size="small" style={{ width: 90, marginLeft: 6 }} value={xiuyaoOther} onChange={(v) => this.setState({ xiuyaoOther: v })} options={opts} /></div>
					<div className="yq-kv">相性:{xx ? <b>{xx.key ? `${xx.key}(${xx.meaning})` : xx.meaning}</b> : '—'}</div>
					<div className="yq-note">十一字:{Object.entries(XIANGXING_MEANING).map(([k, v]) => `${k}=${v}`).join('、')}</div>
					<div className="yq-note">(本命宿=旧历月朔日之宿顺数生日数;朔日值宿锚表待纸本,此处由用户指定本命宿。)</div>
				</div>
			</div>
		);
	}

	renderSub(key, ft) {
		// 子页签内容分派(与右栏主页签内容同层级,惰性:仅激活项计算)。
		switch (key) {
			case 'pan': return this.renderPan(ft);
			case 'qiqin': return this.renderQiqin(ft);
			case 'zeri': return this.renderZeri(ft);
			case 'zhanbu': return this.renderZhanbu(ft);
			case 'dingju': return this.renderDingju(ft);
			case 'chaizi': return this.renderChaizi();
			case 'xiuyao': return this.renderXiuyao();
			default: return this.renderToutai(ft);
		}
	}

	render() {
		const { sub } = this.state;
		const ft = this.fieldsTime();
		const SUBS = [
			{ value: 'pan', label: '盘' }, { value: 'qiqin', label: '起禽' }, { value: 'zeri', label: '择日' },
			{ value: 'zhanbu', label: '占卜' }, { value: 'toutai', label: '投胎' },
			{ value: 'dingju', label: '定局' }, { value: 'chaizi', label: '拆字' }, { value: 'xiuyao', label: '宿曜' },
		];
		return (
			<div className="yanqin-branch-panel">
				{/* 子页签统一为 ant Tabs(下划线式),与右栏主页签「概览/宫位/星禽/吞啖/演法」同款 */}
				<Tabs
					className="yq-subtabs-tabs"
					activeKey={sub}
					size="small"
					onChange={(k) => this.setState({ sub: k })}
				>
					{SUBS.map((it) => (
						<TabPane tab={it.label} key={it.value}>
							{sub === it.value ? this.renderSub(it.value, ft) : null}
						</TabPane>
					))}
				</Tabs>
			</div>
		);
	}
}
