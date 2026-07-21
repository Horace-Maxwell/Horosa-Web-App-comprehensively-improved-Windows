// 七政四余 · 资料页(G35/G29):§6 全表速查 + 化曜 A≠B 明示 + 流派对照(中性词)。
// 自包含组件:触发按钮 + Modal,消费 guolaoData(纯展示,零后端)。复用神煞 doc「数据驱动展示」范式。
import { Component } from 'react';
import { Modal, Tabs } from 'antd';
import './GuoLaoStarSectDoc.less';
import {
	SU28, SU28_DISTANCE, SU28_DEGREE_LORD, SU28_JIAO_START_MODERN, SU28_JIAO_START_ANCIENT,
	DIZHI, PALACE_LORD, DIGNITY_TABLE, HUAYAO_A, KUIXING_B, SHIHUA_ORDER,
	SIYU_DAILY_RATE, SIYU_PERIOD_YEAR, SIYU_WUXING, DONGWEI_PALACE_YEARS,
} from './guolaoData';

const { TabPane } = Tabs;

// 流派对照(中性词:依设置组合定派相,非派名硬绑)。
const SCHOOL_TABLE = [
	['琴堂五星', '四柱为体·星盘为辅', '身宫逢酉', '宫主', '重八字合参'],
	['果老星宗', '星盘为体', '太阴落宫', '贬宫主专度主', '近纯星占'],
	['天官/耶律', '化曜配十神·引子平', '太阴落宫', '度主', '年干起例为主'],
	['弧角天星', '真太阳时+经纬弧角', '太阴落宫', '宫主', '偏赤道弧角推步'],
];

function Table({ head, rows }){
	return (
		<table className="horosa-guolao-doc-table">
			<thead><tr>{head.map((h, i)=><th key={i}>{h}</th>)}</tr></thead>
			<tbody>{rows.map((r, i)=><tr key={i}>{r.map((c, j)=><td key={j}>{c}</td>)}</tr>)}</tbody>
		</table>
	);
}

// horosa_guolao_doc_static_rows_v1(PERF-R9 Ship 6):六张表的行数据全部由**模块级静态常量**
// (guolaoData 的 SU28/PALACE_LORD/…)派生,与 props/state 无关 —— 原先每次 render 都重算一遍
// (七政左栏每次改选项/切时间都会重渲本组件),现提到模块级只算一次。行内容逐字节不变。
const SU28_ROWS = SU28.map((s, i)=>[i + 1, s, SU28_DISTANCE[i] + '°', SU28_DEGREE_LORD[i]]);
const PALACE_ROWS = DIZHI.map((z)=>{ const p = PALACE_LORD[z]; return [z, p[0], p[1], p[2] === '—' ? '—' : `${p[1]==='—'?'':''}${p[2]}${p[3]}`]; });
const DIGNITY_ROWS = Object.keys(DIGNITY_TABLE).map((star)=>[star, ...DIGNITY_TABLE[star]]);
const HUAYAO_ROWS = Object.keys(HUAYAO_A).map((g)=>[g, HUAYAO_A[g], KUIXING_B[g]]);
const SIYU_ROWS = Object.keys(SIYU_DAILY_RATE).map((n)=>[n, SIYU_WUXING[n], `${SIYU_DAILY_RATE[n]}°/日`, `${SIYU_PERIOD_YEAR[n]}年`]);
const SHIHUA_ROWS = SHIHUA_ORDER.map((o, i)=>[`${i + 1}.${o[0]}`, o[1], o[2] || '—']);
const DONGWEI_ROWS = DONGWEI_PALACE_YEARS.map((d)=>[d[0], d[1] + ' 年']);

export default class GuoLaoStarSectDoc extends Component {
	constructor(props){
		super(props);
		this.state = { open: false };
		// 首次打开前不构造 Modal 子树(未打开过=用户从没见过,不构成降级);打开过之后
		// 永久保留(粘性),开关行为与今天逐帧一致。
		this._everOpen = false;
	}

	// horosa_guolao_doc_scu_v1:本组件**零 props**(调用点 <GuoLaoStarSectDoc />),唯一输入是
	// state.open。故父组件(GuoLaoInput→GuoLaoChartMain)因任何无关原因重渲时,本子树可完全跳过。
	shouldComponentUpdate(nextProps, nextState){
		return nextState.open !== this.state.open;
	}

	render(){
		const su28Rows = SU28_ROWS;
		const palaceRows = PALACE_ROWS;
		const dignityRows = DIGNITY_ROWS;
		const huayaoRows = HUAYAO_ROWS;
		const siyuRows = SIYU_ROWS;
		if(this.state.open){
			this._everOpen = true;
		}
		return (
			<>
				<button
					type="button"
					onClick={()=>this.setState({ open: true })}
					style={{ marginTop: 8, width: '100%', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
						border: '1px solid var(--horosa-border-soft, rgba(231,189,117,0.2))', background: 'transparent', color: 'var(--horosa-text-soft, #c8c0b2)' }}
				>七政四余 · 资料速查</button>
				{!this._everOpen ? null : (
				<Modal
					open={this.state.open}
					title="七政四余 · 资料速查（古法立成）"
					footer={null}
					width={760}
					onCancel={()=>this.setState({ open: false })}
					className="horosa-guolao-doc-modal"
				>
					<Tabs defaultActiveKey="su28" className="horosa-guolao-doc-tabs">
						<TabPane tab="二十八宿" key="su28">
							<p className="horosa-guolao-doc-note">距度合 360°；度主木金土日月火水循环。今宿角起 {SU28_JIAO_START_MODERN}°(J2000,+50.29″/年)；古宿角起 {SU28_JIAO_START_ANCIENT}°(冻结)。赤道古度制总 365.25°。</p>
							<Table head={['#', '宿', '距度', '度主']} rows={su28Rows} />
						</TabPane>
						<TabPane tab="十二宫" key="palace">
							<p className="horosa-guolao-doc-note">自命宫逆布；末位「相貌」非「父母」。宫主＝黄道宫庙主；旺＝擢升曜及度数。</p>
							<Table head={['地支', '黄道宫·十二次', '宫主', '旺(擢升)']} rows={palaceRows} />
						</TabPane>
						<TabPane tab="庙旺" key="dignity">
							<p className="horosa-guolao-doc-note">力量序：庙＞旺＞得地三方＞平＞落＞陷。庙=入庙本宫，旺=擢升，落=旺对宫，陷=庙对宫。</p>
							<Table head={['曜', ...DIZHI]} rows={dignityRows} />
						</TabPane>
						<TabPane tab="化曜" key="huayao">
							<p className="horosa-guolao-doc-note"><strong>化曜诀(A)≠魁星诀(B)</strong>：起盘配十化用 A 诀；B 诀仅备注，勿混。A 诀(无日)：甲火乙孛丙木丁金戊土己太阴庚水辛炁壬计癸罗。</p>
							<Table head={['天干', '化曜(A诀)', '魁星(B诀·非化曜)']} rows={huayaoRows} />
							<p className="horosa-guolao-doc-note" style={{ marginTop: 10 }}>十化次序·所管宫·≈紫微四化：</p>
							<Table head={['化名', '所管宫', '≈紫微']} rows={SHIHUA_ROWS} />
						</TabPane>
						<TabPane tab="四余" key="siyu">
							<p className="horosa-guolao-doc-note">古法立成(匀速平行)每日行度；今法走真交点/真拱点真算。罗火计土孛水炁木；计＝罗+180 对冲。</p>
							<Table head={['余', '五行', '每日行度', '周期']} rows={siyuRows} />
						</TabPane>
						<TabPane tab="洞微大限" key="dongwei">
							<p className="horosa-guolao-doc-note">自命宫顺行，各宫年数不等(合≈百六)；命宫起限＝floor(太阳在命宫内度数/3)+10。</p>
							<Table head={['宫名', '年数']} rows={DONGWEI_ROWS} />
						</TabPane>
						<TabPane tab="流派对照" key="school">
							<p className="horosa-guolao-doc-note">定盘相的是「设置组合」(盘制·安命基准·四余算法·真平太阳时)而非派名。</p>
							<Table head={['流派', '体用', '身宫', '命主', '取向']} rows={SCHOOL_TABLE} />
						</TabPane>
					</Tabs>
				</Modal>
				)}
			</>
		);
	}
}
