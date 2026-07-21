// 演禽 · 右栏「演法」结果面板:挂在原万化仙禽演禽页右侧信息栏(主三栏盘与原页签零改)。
// 时间/性别复用左栏(主命盘)输入;流派/互锁开关在左输入栏(YanQinControls,共享 yanqinStore)。
// 本面板只出结果:子页签 起禽/择日/占卜/投胎。纯前端引擎,零后端。
import React, { Component } from 'react';
import { Solar } from 'lunar-javascript';
import { Tabs } from 'antd';
import { XQSegmented, XQSelect, XQTable } from '../xq-ui';
import {
	YAO_TO_WUXING, DIZHI, DIZHI_TO_IDX, R_RING, mansionByIdx,
} from './yanqinConst';
import { castQinChart, qinKeByWuxing, wuxingOfMansion, monthQin, toutaiDu } from './yanqinEngine';
import { resolveWoBi, YANQIN_PRESETS } from './yanqinSchools';
import { getYanqinSettings, subscribeYanqin } from './yanqinStore';
import {
	ZHIRI_JIXIONG, SISHI_YIJI, SISHI_COLS, SUOBO_POSITIONS, SUOBO_DETAIL, QIZHENG_CHANGSHENG,
	FENLEI_ZHAN, ZHANDUAN_ZONGZE,
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
		this.state = { sub: props.initialSub || 'zeri', shiClass: 'hunyin' };
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
			gender: (f.gender && f.gender.value !== undefined) ? f.gender.value : 1,
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
						{chip('翻禽', cast.fanQin)}{cast.daoJiang ? chip('倒将', cast.daoJiang.zhuJiang) : null}
						{cast.huoYao ? chip('活曜', cast.huoYao) : null}
					</div>
				</div>
				<div className="yq-card">
					<div className="yq-sec">起禽推导</div>
					<div className="yq-kv">① <span className="k">日禽</span>:周历机制(锚 1996-01-28 甲子虚日鼠周日)→ <b>{cast.dayQin.name}</b>。</div>
					<div className="yq-kv">② <span className="k">元将</span>:七元甲子 420 日 → <b>{cast.yuan}元{cast.jiang}将</b>。</div>
					<div className="yq-kv">③ <span className="k">时禽</span>:元元相轮 {R_RING.join('→')} {cast.ziStart ? <span>子时起 <b>{cast.ziStart.name}</b> →</span> : null} <b>{cast.hourQin.name}</b>。</div>
					<div className="yq-kv">④ <span className="k">翻禽</span>:当日盘读时禽→日禽落点 → <b>{cast.fanQin.name}</b>。</div>
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
		const r = resolveWoBi(s);
		const ent = { shi: cast.hourQin, fan: cast.fanQin, dao: cast.daoJiang ? cast.daoJiang.zhuJiang : null };
		const me = ent[r.me]; const they = ent[r.they];
		let ke = '—';
		if (me && they) { ke = { meWin: '我克彼 → 吉(我胜)', theyWin: '彼克我 → 凶(彼胜)', meSheng: '我生彼 → 泄气', theySheng: '彼生我 → 受助', peace: '比和 → 相持' }[qinKeByWuxing(wuxingOfMansion(me), wuxingOfMansion(they))]; }
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
		const j = me && they ? qinKeByWuxing(wuxingOfMansion(me), wuxingOfMansion(they)) : 'peace';
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
			</div>
		);
	}

	render() {
		const { sub } = this.state;
		const ft = this.fieldsTime();
		const SUBS = [
			{ value: 'qiqin', label: '起禽' }, { value: 'zeri', label: '择日' },
			{ value: 'zhanbu', label: '占卜' }, { value: 'toutai', label: '投胎' },
		];
		return (
			<div className="yanqin-branch-panel">
				<div className="yq-subtabs">
					<XQSegmented value={sub} onChange={(e) => this.setState({ sub: e.target.value })} options={SUBS} />
				</div>
				{sub === 'qiqin' ? this.renderQiqin(ft)
					: sub === 'zeri' ? this.renderZeri(ft)
						: sub === 'zhanbu' ? this.renderZhanbu(ft)
							: this.renderToutai(ft)}
			</div>
		);
	}
}
