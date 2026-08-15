// 占星「格局速览」详解 —— 帮助弹窗内容(占星页)。把右栏格局速览各项的判读规则写清楚,供用户对照。
// 规则依《Horosa 古典占星》正文;术语/配色与右栏 astroPatternOverview / AstroInfo 一致。
import { Component } from 'react';

const JADE = 'var(--horosa-jade, #3a9a6a)';
const DANGER = 'var(--horosa-danger, #cf1322)';
const GOLD = 'var(--horosa-gold, #b8860b)';
const ACCENT = 'var(--horosa-accent, #6c5ce7)';
const MUTED = 'var(--horosa-muted, #999)';

const sectionStyle = { marginTop: 14 };
const h = { fontWeight: 700, fontSize: 13.5, margin: '0 0 4px' };
const p = { margin: '0 0 4px', lineHeight: 1.7 };
const li = { margin: '0 0 2px', lineHeight: 1.6 };
const ul = { margin: '0 0 4px', paddingLeft: 18 };
const kbd = (txt, col) => <b style={{ color: col }}>{txt}</b>;
const tag = (txt, col) => <span style={{ color: col, border: `1px solid ${col}`, borderRadius: 4, padding: '0 5px', marginRight: 6, fontSize: 12 }}>{txt}</span>;

class AstroPatternHelp extends Component{
	render(){
		return (
			<div style={{ marginTop: 10, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.25))', paddingTop: 10, maxHeight: '58vh', overflowY: 'auto', fontSize: 13 }}>
				<div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>右栏「格局速览」判读详解</div>
				<p style={{ ...p, color: MUTED }}>以下每一项对应「信息 / 格局」页右栏的同名条目。规则取自古典占星正文,术语与配色与界面一致。</p>

				<div style={sectionStyle}>
					<div style={h}>配色约定</div>
					<p style={p}>
						{tag('有情·绿', JADE)} 成格局(吉);
						{tag('无情·红', DANGER)} 不成格局/混乱(凶);
						{tag('围攻·红', DANGER)}
						{tag('围荣·金', GOLD)}
						{tag('围耀·紫', ACCENT)}
					</p>
					<p style={{ ...p, color: MUTED }}>注:「拒绝」(供方星陷/落)只是文字标注,本身不决定有情无情,不会把有情联结染红。</p>
				</div>

				<div style={sectionStyle}>
					<div style={h}>宫位:世俗 / 非世俗 / 大凶</div>
					<ul style={ul}>
						<li style={li}>{kbd('非世俗宫(反世俗)= 仅 8宫、12宫', DANGER)};其余 10 宫皆 {kbd('世俗宫', JADE)}。这是判「有情/无情」「先验权力」的依据。</li>
						<li style={li}>{kbd('大凶之宫 = 6、8、12 宫', DANGER)}:这是「后天凶星」的判据,与「非世俗宫」是<b>两套独立概念</b>(6宫属世俗,但仍是大凶宫)。</li>
						<li style={li}>最强宫(Angular)= 1、4、7、10;吉宫 = 1、4、5、7、9、10、11。</li>
					</ul>
				</div>

				<div style={sectionStyle}>
					<div style={h}>主宰星(宫主星)</div>
					<ul style={ul}>
						<li style={li}>上升星座的入庙行星 = 第一宫主宰(命主星 <b>1R</b>);自 1R 星座<b>逆时针</b>顺推,依次定 2R…12R。</li>
						<li style={li}>日、月各只主宰 1 宫,其余 5 星各同时主宰 2 宫。</li>
						<li style={li}><b>后天凶星</b> = 主宰 6/8/12 宫者(无论其先验吉凶)。</li>
						<li style={li}><b>强吉木星</b> = 木星不主宰 3/6/8/12 宫(主 6&9 宫为例外,仍强吉)。强吉木星照耀(成相位)的星越多,格局越高。</li>
					</ul>
				</div>

				<div style={sectionStyle}>
					<div style={h}>联结(结构 / 格局)</div>
					<ul style={ul}>
						<li style={li}>联结只有四种:<b>接纳、互容、合相(0°)、映点</b>。其余相位不算联结。</li>
						<li style={li}><b>接纳</b>:一星落入另一星的入庙/擢升星座,且二者有相位。<b>互容</b>:双方互落对方入庙/擢升星座(=双向接纳)。<span style={{ opacity: 0.75 }}>(此处「互容」是<b>星座</b>义;下节「有情/无情」里的「互换」是<b>宫位</b>义,两者不同轴。)</span></li>
						<li style={li}>联结会把双方「所主宰的宫」与「所落入的宫」连成一体——这就是「格局」。</li>
						<li style={li}>左栏开关 <b>「仅按本垣擢升计算互容接纳」</b>:开启后,只取 本垣(入庙)/擢升 的联结,滤掉三分/界/面等细联结。信息/格局页右栏与星盘、古典页一律随此设置同步。</li>
					</ul>
				</div>

				<div style={sectionStyle}>
					<div style={h}>有情 / 无情(成格局四象 · 外交官模型)</div>
					<p style={p}>把宫主星想成<b>外交官</b>:只为「所主宰宫」服务,在「所落宫」吸收能量、带回所主宰宫。据此分四象:</p>
					<ul style={ul}>
						<li style={li}>① 世俗主宰 → 落世俗宫 = {kbd('有情·世俗纯粹', JADE)}(世俗成功)</li>
						<li style={li}>② 非世俗主宰 → 落非世俗宫 = {kbd('有情·玄纯粹', JADE)}(非世俗成功)</li>
						<li style={li}>③ 世俗主宰 → 落非世俗宫 = {kbd('有情·玄谋世俗', JADE)}(用非世俗手段谋世俗成功)</li>
						<li style={li}>④ 非世俗主宰 → 落世俗宫 = {kbd('无情', DANGER)}(混乱;普通人最常见)</li>
					</ul>
					<p style={p}><b style={{ color: JADE }}>互换(宫位互换)恒有情</b>:互换 = 双方各落入<b>对方所主宰之宫</b>的对等交换 = 纯粹交易,<b>无论玄/世俗一律有情</b>(realm 只决定子标签)。例:拉康 日(12R)落8宫、火(8R)落12宫,即纯粹的 8-12 互换。</p>
					<p style={p}><b style={{ color: DANGER }}>⚠ 勿与「互容」混为一谈</b>:此处「互换」按<b>宫位</b>判(各落对方所主宰之宫);上文「联结」里的「互容」按<b>星座</b>判(互落对方入庙/擢升座)。两者不同轴——星座互容只决定两星是否上「互容」行,<b>不参与</b>本节四象判定。故「互容」行完全可能标{kbd('无情', DANGER)}:那说的是这两星作为宫主星的外交同不同型,与它们为何联结无关。</p>
				</div>

				<div style={sectionStyle}>
					<div style={h}>先验权力(八杀朝天)</div>
					<ul style={ul}>
						<li style={li}><b>12宫与8宫</b> 的联结,或 <b>1宫与8宫</b> 的联结,即先验权力。判定要求双方<b>分别</b>(落入 或 主宰)这两宫——一方沾 8 宫、另一方沾 12 宫或 1 宫,成对成立。</li>
						<li style={li}>这样的人毕生追求先验权力,常显偏执乃至疯狂(哲学家 / 心理学家 / 阴谋家典型)。</li>
						<li style={li}>古称「<b>八杀朝天</b>」为大贵格局,但<b>必须夜生</b>方成(昼生只成普通先验权力联结)。</li>
					</ul>
				</div>

				<div style={sectionStyle}>
					<div style={h}>龙脉(龙截 / 龙拥)· 孤月独明</div>
					<ul style={ul}>
						<li style={li}>以南北交点连线为轴,把星盘截为两半(<b>虚点不计</b>,只看七颗真星)。</li>
						<li style={li}><b>龙截</b>:一半只有 1 颗星(此孤星极重要),或一半 2 颗且二者有高层联结。<b>龙拥</b>:七星全聚于一半。</li>
						<li style={li}><b>孤月独明</b>:夜生,且全盘惟有月亮在地平线以上(其余六星皆在地平线下)。</li>
					</ul>
				</div>

				<div style={sectionStyle}>
					<div style={h}>其余条目</div>
					<ul style={ul}>
						<li style={li}><b>命主星 1R</b>:上升星座的主宰星及其落宫落座,集中表征命主的先验心性。</li>
						<li style={li}><b>三围</b>:{tag('围攻', DANGER)}被两凶星(火/土)夹击(凶,「凶剧」=纯凶);{tag('围荣', GOLD)}被两吉星护卫;{tag('围耀', ACCENT)}被吉星照耀。</li>
						<li style={li}><b>心性·智识</b>:月主「生性」、水主「智识」——看其落座、模式(转/定/二体宫)、主宰星及资质、联结。</li>
						<li style={li}><b>职业·主业</b>:取<b>月亮第一西没星</b>(后于月亮升出地平线的第一颗星);「行事」取<b>太阳第一西没星</b>。</li>
						<li style={li}><b>主宰循环</b>:三星以上首尾相主宰成环,等同高层联结,亦带有情/无情标。</li>
					</ul>
				</div>

				<p style={{ ...p, color: MUTED, marginTop: 12 }}>格局之要在「结构」「整体」「纯粹」,不在单星吉凶或宫位评分。混杂不清即普通人。</p>
			</div>
		);
	}
}

export default AstroPatternHelp;
