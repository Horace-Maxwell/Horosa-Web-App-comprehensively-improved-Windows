// 演禽 · 操作手册(帮助页内容组件,演禽页右上角「帮助」打开)。
// 逐选项写清「怎么用 + 看哪里」;中性表述,纯展示零后端。
import { Component } from 'react';
import { Tabs } from 'antd';

const { TabPane } = Tabs;
import { MUTED, h, p, ul, li, card, ct, body, title } from './helpDocStyle';

const kv = (k, v) => <div style={{ margin: '1px 0', lineHeight: 1.55 }}><span style={{ color: MUTED }}>{k}：</span>{v}</div>;

class YanqinHelpDoc extends Component{
	render(){
		return (
			<div style={{ marginTop: 10, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.25))', paddingTop: 8 }}>
				<div style={title}>演禽 · 操作手册</div>
				<Tabs defaultActiveKey="overview" size="small">
					<TabPane tab="总览" key="overview">
						<div style={body}>
							<p style={p}><b>演禽</b>以二十八宿星禽配十二宫起盘:由出生时间定三宫(命 / 身 / 胎)与各宫星禽,再看星禽之间的吞啖合战以断吉凶。本页位于「其他」组,与策天飞星同页切换。</p>
							<div style={h}>怎么用</div>
							<ul style={ul}>
								<li style={li}>顶部填好出生时间,即自动起盘;改时间实时重排(盘面 + 右栏 + AI 挂载)。</li>
								<li style={li}>左栏可调<b>性别</b>与<b>入式历法</b>(见「排盘设置」),改任一项即重排。</li>
								<li style={li}>中央十二宫格显示各宫所落星禽,角标「命 / 身 / 胎」标出三宫所在。</li>
								<li style={li}>右栏分页查看概览、宫位、星禽、吞啖四类细目。</li>
								<li style={li}>右栏末页<b>「演法」</b>另起 起禽 / 择日 / 占卜 / 投胎 四个子页签,自带日期 / 时辰 / 流派选择,与主命盘独立(排四禽、择吉日、占一事、投胎度数)。</li>
							</ul>
							<p style={{ ...p, color: MUTED }}>本页起盘只用时间与历法设置,不取地点经纬。</p>
						</div>
					</TabPane>

					<TabPane tab="排盘设置" key="input">
						<div style={body}>
							<div style={h}>出生时间</div>
							<p style={p}>顶部时间面板;晚子时、过子时归日按全局日界点设置自动处理。</p>
							<div style={h}>性别</div>
							<p style={p}>男 / 女。影响起运方向与部分取用。</p>
							<div style={h}>入式历法</div>
							<ul style={ul}>
								<li style={li}><b>自动换算农历(默认)</b>:由出生公历时间推算农历再起盘。</li>
								<li style={li}><b>手动农历</b>:直接填农历年 / 月 / 日入式,用于已知农历或校正历法歧义。</li>
								<li style={li}><b>公历数值入式</b>:以公历的年月日数值直接入式(不转农历)。</li>
							</ul>
							<p style={{ ...p, color: MUTED }}>选「手动农历」时下方农历年 / 月 / 日三栏方可编辑;其余两档由时间面板取值,农历栏置灰。</p>
						</div>
					</TabPane>

					<TabPane tab="盘面要点" key="chart">
						<div style={body}>
							<div style={h}>三宫</div>
							<ul style={ul}>
								<li style={li}><b>命宫</b>:角标「命」,立命之宫,定命星(主一生格局)。</li>
								<li style={li}><b>身宫</b>:角标「身」,主后天际遇。</li>
								<li style={li}><b>胎宫</b>:角标「胎」,主禀赋根基。</li>
							</ul>
							<div style={h}>十二宫星禽</div>
							<p style={p}>命、财帛、兄弟、田宅、子息(子女)、奴仆、妻妾(夫妻)、疾厄、迁移、官禄、福德、相貌各宫各配星禽;每宫首行为主星禽,其余为辅。</p>
							<div style={h}>盘心基准</div>
							<p style={p}>盘心一并标出<b>三元</b>(各宫星禽排布的根)、<b>昼夜</b>、<b>命星 / 身星 / 胎星</b>三主星,以及总体<b>格局</b>评级与简要依据。</p>
							<p style={{ ...p, color: MUTED }}>盘面下方亦标出当前入式历法与对应的年月日。</p>
						</div>
					</TabPane>

					<TabPane tab="右栏看什么" key="right">
						<div style={body}>
							<div style={card}><div style={ct}>概览</div>
								{kv('命星 / 身星 / 胎星', '三宫主星禽与总体格局摘要')}</div>
							<div style={card}><div style={ct}>宫位</div>
								{kv('十二宫', '逐宫列星禽与所主人事(财帛 / 官禄 / 妻妾 等)')}</div>
							<div style={card}><div style={ct}>星禽</div>
								{kv('二十八宿禽', '各宿对应星禽及其正像、属性')}</div>
							<div style={card}><div style={ct}>吞啖</div>
								{kv('合战', '星禽之间的吞啖、合战关系,据此判强弱吉凶')}</div>
							<div style={card}><div style={ct}>演法</div>
								{kv('起禽 / 择日 / 占卜 / 投胎', '独立子页签:四禽起例与日禽定局、二十八宿值日吉凶歌择吉、仿大六壬三传四课占一事(体用我彼随流派反转、锁泊十二宫)、投胎度数十二禽兽;自带日期 / 时辰 / 流派选择,与主命盘独立')}</div>
							<div style={h}>演法 · 流派设置(演法区顶部)</div>
							<div style={card}><div style={ct}>流派预设(六派 + 自定义)</div>
								{kv('六派', '江西派宗本 / 江西派集大成 / 广东派 / 江西派翻禽倒将 / 现代凤凰占课 / 翻禽倒将传本;选任一派即一键套下方五档开关,切「自定义」可逐档微调')}
								{kv('主要分野', '江西一系重活曜番禽、翻禽倒将判吉凶;广东一系重三传锁泊;凤凰系时禽=我、完整三传四课不立命宫')}</div>
							<div style={card}><div style={ct}>五档互锁开关(占卜体系分歧)</div>
								{kv('我 / 彼归属', '翻禽=我 / 时禽=我 / 到将=我 —— 定体用双方,凤凰系与江西宗本恰相反')}
								{kv('时禽旬头位移', '加位移 / 不加(算例口径)')}
								{kv('月禽口诀', 'A 版(主流) / B 版(别系)')}
								{kv('活曜传本', '不立活曜 / 番禽系(土→翼) / 翻禽系(土→箕)')}
								{kv('占卜重心', '三传+翻禽并用 / 重三传锁泊(粤) / 重翻禽倒将(赣)')}</div>
							<p style={{ ...p, color: MUTED }}>右栏当前所见即 AI 分析挂载与导出内容,所见即所得。</p>
						</div>
					</TabPane>

					<TabPane tab="演法 · 起禽" key="qiqin">
						<div style={body}>
							<p style={p}>「演法」区选<b>起禽</b>子页签,取左栏时间排出该时刻的年 / 月 / 日 / 时四禽及翻禽、倒将、活曜,并把四禽的推导逐步展开。改左栏时间或流派即重排。</p>
							<div style={h}>起禽推导(四步)</div>
							<ul style={ul}>
								<li style={li}><b>① 日禽</b>:按七曜周历机制,一日一换、二十八日一轮,以某一甲子日为锚顺推得当日值宿之禽。</li>
								<li style={li}><b>② 元将</b>:七元甲子共四百二十日、一元六十日、一将十五日;由日序定出「几元几将」。</li>
								<li style={li}><b>③ 时禽</b>:元元相轮,子时先起本元起宿,再按七曜次序顺排至所占时辰得时禽。</li>
								<li style={li}><b>④ 翻禽</b>(他禽 / 天禽):以当日盘从时禽读到日禽落点之禽,即为翻禽。</li>
							</ul>
							<div style={h}>日禽定局 · 七元表</div>
							<p style={p}>一行七格,列出一元至七元各自的起宿;高亮格＝当日日禽所属之元。可据此核对当日落在七元中的哪一元、时禽从何宿起轮。</p>
							<p style={{ ...p, color: MUTED }}>顶部另标出干支日、几元几将、值日之曜,以及四禽 / 翻禽 / 倒将 / 活曜的色块(色随星禽五行)。活曜是否出现随流派「活曜传本」开关而定。</p>
						</div>
					</TabPane>

					<TabPane tab="演法 · 择日" key="zeri">
						<div style={body}>
							<p style={p}><b>择日</b>子页签以当日<b>日禽值宿</b>断该日吉凶,并给出禽课「我 / 彼」胜负速判。取左栏时间起算。</p>
							<div style={h}>顶部 · 禽课我彼胜负</div>
							<ul style={ul}>
								<li style={li}><b>我 / 彼归属</b>由流派开关决定(时禽＝我 / 翻禽＝我 / 到将＝我 三选一,详见「右栏看什么 · 五档互锁开关」)。</li>
								<li style={li}>按我禽、彼禽五行生克判:我克彼＝吉(我胜)、彼克我＝凶(彼胜)、我生彼＝泄气、彼生我＝受助、比和＝相持。</li>
								<li style={li}>上等日课＝<b>值宿吉 ＋ 我得地克彼</b>双吉俱全。</li>
							</ul>
							<div style={h}>下方三内页签</div>
							<div style={card}><div style={ct}>值日吉凶歌</div>
								{kv('当日日禽', '该值宿的吉凶断语(歌诀)＋逐项「宜 / 忌」')}</div>
							<div style={card}><div style={ct}>四事项</div>
								{kv('宿宜忌速查', '嫁娶 / 安葬 / 动土造作 / 开市放水 四项,列出当日值宿对各项的宜忌')}</div>
							<div style={card}><div style={ct}>婚课</div>
								{kv('男女取法', '男家问以体(时禽)为男;女家问以天禽(翻禽)为男、地禽为女')}
								{kv('判断', '两禽比和 / 相生、我得地为和合吉;相克(尤彼克我)主刑克。上等婚课＝吉宿值日 ＋ 吉时我得地克彼 / 比和 ＋ 黄道吉神 ＋ 建除定 / 成')}</div>
						</div>
					</TabPane>

					<TabPane tab="演法 · 占卜" key="zhanbu">
						<div style={body}>
							<p style={p}><b>占卜</b>子页签仿三传四课以四禽占一事:初传＝日禽(彼我共用)、中传＝时禽(地禽 / 体 / 我)、末传＝翻禽(天禽 / 用 / 彼)、四课＝活曜,倒将为主将。顶部给出「我 / 彼」与总判(生克胜负),并随流派标出断法重心(三传并用 / 重锁泊 / 重翻禽倒将)。</p>
							<div style={h}>下方页签</div>
							<div style={card}><div style={ct}>锁泊</div>
								{kv('我禽 / 彼禽', '各禽由长生位起「山」顺数至用时,落十二位(山水田园井刀天草岸风火月)定得地失位')}
								{kv('取向', '落天 / 风 / 月 / 水多得地化吉,刀位最凶;我得地、彼失位为吉')}</div>
							<div style={card}><div style={ct}>分类占(选择器)</div>
								{kv('选一类事项', '婚姻 / 行人 / 交易 / 失物 / 词讼 / 疾病 / 求财 / 交战博弈 / 天时 / 家宅 / 求官 / 生产 / 捕盗 / 起造')}
								{kv('作用', '选中即换出该类的体用断语(哪一禽代表何人 / 何物,如何以生克断成败)')}</div>
							<div style={card}><div style={ct}>应期 · 总则</div>
								{kv('应期', '以所克之禽 / 用神之禽所值地支、宿次定应期月日')}
								{kv('总则', '本禽长生位起「山」顺数至用时,看彼我之禽何者得地变化,遇吉则吉、遇凶则凶')}</div>
							<div style={h}>反断与专类提示(顶部随选类浮现)</div>
							<ul style={ul}>
								<li style={li}><b>空拳求财反断</b>:空手求财者,反以「用(彼)禽旺相、克体(我)」为得财之象(常规求财则地星宜旺相)。</li>
								<li style={li}><b>占病</b>:地禽＝病人、天禽＝病症;地克天→病愈,天克地→难愈。</li>
								<li style={li}><b>占婚</b>:男问以体为男;女问以天禽为男、地禽为女。</li>
							</ul>
							<p style={{ ...p, color: MUTED }}>兵家 / 博弈专用「我胜彼」;其余事项据类别或用彼胜我、或用我胜彼、或取比和,以选中分类的断语为准。</p>
						</div>
					</TabPane>
				</Tabs>
			</div>
		);
	}
}

export default YanqinHelpDoc;
