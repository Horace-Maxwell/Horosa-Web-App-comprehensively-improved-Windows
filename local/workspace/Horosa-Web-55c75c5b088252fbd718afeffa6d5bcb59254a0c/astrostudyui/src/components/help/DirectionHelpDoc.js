// 星运推运 · 操作手册(帮助页内容组件,推运页右上角「帮助」打开)。
// 逐推运法写清「怎么算 + 看什么」,左栏每个选项写全取值与区别;中性表述,纯展示零后端。
import { Component } from 'react';
import { Tabs } from 'antd';

const { TabPane } = Tabs;
import { MUTED, h, p, ul, li, card, ct, body, title } from './helpDocStyle';

const kv = (k, v) => <div style={{ margin: '1px 0', lineHeight: 1.55 }}><span style={{ color: MUTED }}>{k}：</span>{v}</div>;

class DirectionHelpDoc extends Component{
	render(){
		return (
			<div style={{ marginTop: 10, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.25))', paddingTop: 8 }}>
				<div style={title}>星运推运 · 操作手册</div>
				<Tabs defaultActiveKey="overview" size="small">

					<TabPane tab="总览" key="overview">
						<div style={body}>
							<p style={p}>本页把「时间」加到本命盘上,看运势如何随岁月展开。右侧标签竖排 <b>共 27 种推运法</b>,各自从不同角度推算流年大运:有的逐度推星(主限/太阳弧),有的逐宫轮值(小限/界推运),有的按行星周期分段(法达/十年/黄道星释)。彼此独立,可互相印证。</p>
							<p style={p}>四大类一句话区分:</p>
							<ul style={ul}>
								<li style={li}><b>方向类(推星)</b>:主限法 / 太阳弧 / 行星弧 / 波斯向运 / 赤纬·恒星推运。把本命星按某速率往前推,落到本命某点即应事。</li>
								<li style={li}><b>时主类(分段轮值)</b>:法达 / 十年大运 / 黄道星释 / 小限法 / 界推运 / 三分主星 / 行星年龄 / 129年系统 / Balbillus / 数字相位。把人生切成时段,每段由一颗「时主星」当令。</li>
								<li style={li}><b>返照·流年类</b>:太阳返照 / 月亮返照 / 多重回归 / 回归轴 / 流年法。某星回到本命原位时另起一盘,看该周期主题。</li>
								<li style={li}><b>工具类</b>:次限推运 / 星历 / 年龄推进点 / 月相推运 / 产前朔望。辅助盘与历表。</li>
							</ul>
							<p style={p}>其中<b>主限法</b>另配一张 <b>3D「主限天球」</b>可视化页(右侧同名标签):它<b>不是第 28 种推运法</b>,而是把主限法的推算结果搬到旋转天球上动态呈现——迫星随周日运动追上应星的过程,以及各圈层坐标关系,一眼看清。用法见「主限天球」标签。</p>
							<p style={{ ...p, color: MUTED }}>用法:右侧切到某推运法 → 该法的盘/表在中间显示 → 左栏(或表格上方工具条)调子设置 → 点「提交 / 计算」重算。下面分五个标签详解。</p>
						</div>
					</TabPane>

					<TabPane tab="二十七法一览" key="list">
						<div style={body}>
							<p style={{ ...p, color: MUTED }}>逐法:核心算法 + 看什么。点右侧同名标签进入。</p>
							<div style={card}><div style={ct}>主限法（Primary Direction）</div>
								{kv('怎么算', '本命星随天球周日旋转往前推,迫星(promittor)追上应星(significator)所在赤经/黄经的弧度,按时间换算折成年龄')}
								{kv('看什么', '大事应期最权威的古典法;表列「弧·迫星·应星·日期」。子设置最多,见「主限法」标签')}</div>
							<div style={card}><div style={ct}>主限法盘</div>
								{kv('看什么', '把主限法结果画成盘,看迫星/应星在盘上的几何关系(配合主限法标签的同一套设置)')}</div>
							<div style={card}><div style={ct}>主限天球（3D 可视化）</div>
								{kv('看什么', '把主限法结果搬到可旋转的赤道天球上:迫星随周日运动追上应星的过程 + 六圈层坐标关系,配底部生命时间轴逐岁播放。')}
								{kv('注意', '它是主限法的 3D 呈现,非独立第 28 种推运法;设置见「主限天球」标签')}</div>
							<div style={card}><div style={ct}>界推运（Distributions）</div>
								{kv('怎么算', '上升点经主限运动逐年穿过本命各「界(埃及界)」,所入之界的界主=当令「分配星」,途中触及的本命星=「参与星」')}
								{kv('看什么', '表列「分配星·界(座)·参与星·起·止」;主限法的宫位轮值版')}</div>
							<div style={card}><div style={ct}>太阳弧（Solar Arc）</div>
								{kv('怎么算', '取太阳次限前进的度数为「弧」,把本命全部星体等量前推同一弧度')}
								{kv('看什么', '推运星对本命星的相位网;一岁约推 1°,简明常用')}</div>
							<div style={card}><div style={ct}>行星弧（Planetary Arc）</div>
								{kv('怎么算', '同太阳弧,但用任选一颗星(默认月亮)的次限运动量为弧,等量前推全盘')}</div>
							<div style={card}><div style={ct}>波斯向运（Persian Directed）</div>
								{kv('怎么算', '所有星按固定象征速率(1°/年等)前移,本命宫头不动,遍历各星×本命点×主要相位求应期')}</div>
							<div style={card}><div style={ct}>次限推运（Secondary Progression）</div>
								{kv('怎么算', '一日一年:出生后第 N 天的星空 = 第 N 岁的推运盘')}
								{kv('看什么', '内含次限/三限/小限三盘并列,月亮走得最快、最灵敏')}</div>
							<div style={card}><div style={ct}>赤纬推运（Declination）</div>
								{kv('怎么算', '次限推进后,按赤纬找平行/反平行相位(看星体南北高度而非黄经)')}</div>
							<div style={card}><div style={ct}>恒星推运（Sidereal）</div>
								{kv('怎么算', '在恒星黄道(不计岁差)下做次限推运,推运星与本命双盘对比')}</div>
							<div style={card}><div style={ct}>小限法（Profection）</div>
								{kv('怎么算', '上升每年进一宫(逆转30°),一岁一宫、12年一轮;该年所在宫的宫主=「年主星」')}
								{kv('看什么', '一眼定该年重点宫与当令星,古典年运骨架')}</div>
							<div style={card}><div style={ct}>法达星限（Firdaria）</div>
								{kv('怎么算', '七政加南北交按昼夜次序各主一大限(年数固定),大限内再七等分为子限')}
								{kv('看什么', '表列「主限·子限·日期」,并附逐主限主题解读')}</div>
							<div style={card}><div style={ct}>十年大运（Decennials）</div>
								{kv('怎么算', '起运主星起,各星按小年(土30木12火15日19金8水20月25=129)分段,层层细分 L1十年→L2年→L3月→L4日')}</div>
							<div style={card}><div style={ct}>黄道星释（Zodiacal Releasing）</div>
								{kv('怎么算', '从某基点(默认福点)所在星座起,按星座守护星的小年逐座释放;分 L1～L4 四级释期,触发对宫时标 LB(转折)')}
								{kv('看什么', '事业/精神高峰低谷分期最精细的法,见「子设置」标签')}</div>
							<div style={card}><div style={ct}>三分主星（Triplicity Rulers）</div>
								{kv('怎么算', '区间光体(昼日夜月)所在星座的三颗三分主星,按昼夜序分掌人生前/中/后段')}</div>
							<div style={card}><div style={ct}>行星年龄（Planetary Ages）</div>
								{kv('怎么算', '人生七阶:月(婴)→水→金→日→火→木→土(老),各星主掌一段年龄,按当前岁定当令星')}</div>
							<div style={card}><div style={ct}>129年系统</div>
								{kv('怎么算', '七政小年合 129 年一大轮,按昼夜起点铺开逐个划子限(含日期)')}</div>
							<div style={card}><div style={ct}>Balbillus 法</div>
								{kv('怎么算', '主限长度 = 小年 ×(1 − 离擢升度角距/360°),七星按本命黄经序铺开,再按 129 权重递归切子限')}</div>
							<div style={card}><div style={ct}>数字相位（Keypoints）</div>
								{kv('怎么算', '各星挂一数字 k(自释放点起第 k 座);凡年龄=k 或其小年倍数即激活该星,两端星体被引动')}</div>
							<div style={card}><div style={ct}>太阳返照（Solar Return）</div>
								{kv('怎么算', '太阳回到本命原度的时刻另起一盘,主管该「生日年」整年运势')}</div>
							<div style={card}><div style={ct}>月亮返照（Lunar Return）</div>
								{kv('怎么算', '月亮回到本命原度的时刻另起一盘,约每月一次,管该月;可叠第二月返')}</div>
							<div style={card}><div style={ct}>多重回归（Extra Returns）</div>
								{kv('怎么算', '土星(≈29.5年)/木星(≈12年)/月交(≈18.6年)返照本命原度的时刻,标人生大周期节点')}</div>
							<div style={card}><div style={ct}>回归轴（Return Timeline）</div>
								{kv('怎么算', '指定年份区间内逐次太阳/月亮返照的时刻与上升度,排成时间轴跨年看')}</div>
							<div style={card}><div style={ct}>流年法（Transits）</div>
								{kv('怎么算', '某日某地的实时行星盘叠本命,列出所有触及本命的相位与误差')}</div>
							<div style={card}><div style={ct}>月相推运（Lunation Phase）</div>
								{kv('怎么算', '本命日月黄经差按次限推进,八相各45°,主导「萌发—显化—释放」约29.5年循环')}</div>
							<div style={card}><div style={ct}>年龄推进点（Age Point）</div>
								{kv('怎么算', '年龄点自上升起、每宫6年、72年一圈;逢合本命星即人生关键节点')}</div>
							<div style={card}><div style={ct}>星历（Ephemeris）</div>
								{kv('怎么算', '一段日期内的入座/留站/月相/食相 + 行运触发相位 + 每日星位 + 升落偕日,按页展示')}</div>
								<div style={card}><div style={ct}>产前朔望（Prenatal Syzygy）</div>
									{kv('怎么算', '自出生时刻向前回溯,取最近一次「朔(日月合)」或「望(日月冲)」中较晚者为产前朔望;以该时刻为新起点、出生地不变,精算一张完整天宫图')}
									{kv('看什么', '古典视为命主孕育起点的母盘;中栏画出产前朔望盘,右栏标朔/望类型与该时刻日月位置,供与本命盘对照参研')}</div>
						</div>
					</TabPane>

					<TabPane tab="主限法" key="primary">
						<div style={body}>
							<p style={p}>主限法子设置最多,集中在<b>表格上方的工具条</b>(方法 / 度数 / 方向 / 向运 / 年数 / 附加 + 计算按钮)。改完务必点右端<b>「计算」</b>才重算。下面逐项写全取值。</p>

							<div style={h}>方法（定宫/坐标体系，决定迫星追到应星的「赤经」怎么算）</div>
							<div style={card}>
								{kv('Alchabitius（默认）', '阿卡比修斯半弧法,经典阿拉伯主限制;默认路径精度最高')}
								{kv('Placidus（半弧）', '普拉西德半弧,主限近代主流;按昼夜弧比例升降')}
								{kv('Regiomontanus', '雷乔蒙塔努,以天球大圆分宫,文艺复兴常用')}
								{kv('Campanus', '坎帕努,首垂圈等分')}
								{kv('Topocentric', '地平视差制')}
								{kv('Meridian', '子午(轴)制,按赤经直接推')}
								{kv('Porphyry', '波菲利,象限三等分')}
								{kv('Equal（黄道）', '沿黄道等度推')}
								{kv('Equal（时圈）', '沿时圈等度推')}
								{kv('Horosa原方法', '本程序原始内置法,表头度数列显「赤经」(其余法显「Arc」弧值)。其余多种方位法亦经引擎支持')}
							</div>

							<div style={h}>度数（时间换算，把推运弧度折成「岁」的钥匙；最关键的应期口径）</div>
							<div style={card}>
								{kv('Ptolemy（默认）', '托勒密法,1°≈1年,最古典通用')}
								{kv('Naibod', '奈博德,太阳每日平均行度(约59′08″)折一年,主限常用')}
								{kv('真太阳弧 / 太阳弧（黄经）', '按真太阳实际/象征前进量折算')}
								{kv('Cardano / Umar al-Tabari / Wöllner / Plantiko / Simmonite / Synodic Year / Kepler / Brahe / Kündig', '各家年长常数,微调应期(逐家差几日至数月)')}
								{kv('Symbolic 系（Degree/Year/Moon/Month）', '象征度法:每度/每年/每月象征推进')}
								{kv('Quarterly / Quinary / Duodenary / Novenary / Self-Measure', '按季/五分/十二分/九分/自度等特殊划分')}
							</div>

							<div style={h}>方向（盘面坐标）</div>
							<div style={card}>
								{kv('In Zodiaco（默认）', '黄道制:迫星沿黄道追应星')}
								{kv('In Mundo', '世俗制:按星体在天球实际位置(含纬度)推,更贴实测')}
							</div>

							<div style={h}>向运（顺逆方向，可同时勾）</div>
							<div style={card}>
								{kv('顺（Direct，默认开）', '迫星顺周日旋转方向追应星(正向推运)')}
								{kv('逆（Converse，默认开）', '反方向推;两者默认都开,表中并列两类应期。只看一种时取消另一勾')}
							</div>

							<div style={h}>年数</div>
							<div style={card}>{kv('取值', '推算覆盖的年龄上限(1～3000,默认100)。调大可看更晚年应期')}</div>

							<div style={h}>附加（默认都关）</div>
							<div style={card}>
								{kv('映点', '加算迫星的「映点(Antiscia)」追应星的行;映点=对夏至/冬至轴对称的隐藏敏感点')}
								{kv('界', '加算各星所落「界(T_行)」的界推运行;勾选后表中出现「某星的某界」行')}
							</div>
							<p style={{ ...p, color: MUTED, marginTop: 4 }}>右上「计算 / 重新计算 / 已同步」按钮状态:设置改动后变「重新计算」,点后回算并落库,与盘/AI 导出口径一致。表头度数列:Horosa原方法显「赤经」,其余显「Arc」。</p>
						</div>
					</TabPane>

					<TabPane tab="主限天球" key="pdsphere">
						<div style={body}>
							<p style={p}>主限法结果的 <b>3D 呈现</b>:一颗可旋转的赤道天球,把「主限法」标签里算出的每条应期行,以迫星随周日运动追上应星的动画演出;底部一条 <b>生命时间轴</b>逐岁排点。<b>它读取主限法标签的当前设置(方位法/换算/向运/年限)</b>,顶栏左侧只读回显,想改口径请回「主限法」标签调后重算。本页所有开关只管「怎么看」,不改数据、不影响 AI 导出口径。</p>

							<div style={h}>顶栏左侧回显(只读)</div>
							<div style={card}>
								{kv('向运制', 'In Zodiaco·黄道向运 / In Mundo·世俗向运,末尾带「+界」表示已开界推运;跟随主限法设置')}
								{kv('方位法 · 换算', '当前方位法与年长换算的名称回显,只读')}
								{kv('中段', '悬停/选中某行时显示该行摘要「顺/逆向 · 弧度 · 迫星 → 应星 · 日期」;未选时提示操作')}
							</div>

							<div style={h}>圈层显隐(七个勾选,默认全开)</div>
							<div style={card}>
								{kv('黄道 / 赤道 / 网格', '黄道大圈(带星座刻度)/ 天赤道 / 赤道坐标网格,各自独立显隐')}
								{kv('地平 / 子午 / 卯酉', '地平圈 / 子午圈 / 卯酉圈(卯酉=首垂圈)三条地平系大圈,各自独立显隐')}
								{kv('标注', '总控各圈的文字/方位点标签层(圈体仍在,只收字);默认开')}
								{kv('作用', '勾掉即在天球上隐去对应圈层;记忆到本地,下次进入沿用')}
							</div>

							<div style={h}>视角(单个按钮循环三态,默认「天球仪」)</div>
							<div style={card}>
								{kv('天球仪(默认)', '从球外看整颗天球')}
								{kv('观测者', '移到面南向外看,近似站在地面仰望')}
								{kv('球心', '进到球心向内看(星象馆式),可拖拽环视、滚轮调视野')}
								{kv('切换', '按钮循环 天球仪→观测者→球心;前两态间约 0.6 秒飞行过渡,切到球心为瞬切')}
							</div>

							<div style={h}>显示开关(其余按钮/勾选)</div>
							<div style={card}>
								{kv('聚焦 / 全显', '按钮两态:聚焦(默认)只亮当前所选行涉及的星点;全显=一并显示全部点。点击切换')}
								{kv('相位点', '勾选(默认开)则显示相位敏感点一类虚点;取消则只留实体天体')}
								{kv('宫位', '勾选(默认关)在黄道上标出后天十二宫的宫首刻度;此宫位恒用古籍通例的一种半弧分宫,与推运方位法无关、不改数据')}
								{kv('播完回位', '勾选(默认关)则一段播放结束后约 0.9 秒缓动转回本命姿态;关=停在命中姿态')}
								{kv('播放 / 复位', '「播放」重演当前所选行的追及动画(未选行时禁用);「复位」把天球转回初始朝向')}
							</div>

							<div style={h}>生命时间轴(底部)</div>
							<div style={card}>
								{kv('两条泳道', '上=顺向 Direct(金),下=逆向 Converse(青),各按年龄排布应期事件;密时自动装箱防叠')}
								{kv('缩放', '滑杆调「px/年」;或 ⌘/Ctrl+滚轮以光标为锚缩放。放大后每条化作「迫星[相位]→应星」简写章,拉远退成分级色点')}
								{kv('适配', '一键回到「整段刚好铺满视口宽」的缩放档')}
								{kv('横移', '普通滚轮 = 横向平移时间轴')}
								{kv('年龄轴 0–N 岁', '下拉可选 50 / 80 / 100 / 120 / 150 / 200 / 300 / 360 岁(默认跟随主限法的年数设置);改动会连带按新上限重算数据、轴同步扩展')}
								{kv('「今」游标', '红色虚线标当前实际年龄位置')}
							</div>

							<div style={h}>怎么联动看</div>
							<ul style={ul}>
								<li style={li}><b>点章 / 点事件点</b>:选中该应期行并在天球上播放追及动画,顶栏中段与画面高亮同步。</li>
								<li style={li}><b>拖动横轴</b>:按年龄就近检索表行,松手落定后天球转到该行姿态。</li>
								<li style={li}><b>点 3D 上的实体天体</b>:自动挑该星参与的、与当前选中行年龄最近的一条应期行播放。</li>
							</ul>
							<p style={{ ...p, color: MUTED, marginTop: 4 }}>提示:本页颜色恒为深色(不随亮暗主题切换),金=顺向、青=逆向,与顶栏图例、时间轴一致。所有显隐/视角/缩放/年龄轴选择都记忆到本地,下次进入沿用。</p>
						</div>
					</TabPane>

					<TabPane tab="时主类·子设置" key="timelord">
						<div style={body}>
							<p style={{ ...p, color: MUTED }}>分段轮值类各法的左栏选项与默认。无选项者即纯展示、无需设置。</p>

							<div style={card}><div style={ct}>黄道星释 · 推运基点（单选）</div>
								{kv('取值', '福点(默认) / 精神点 / 水星点 / 金星点 / 火星点 / 木星点 / 土星点 / ASC / DESC / MC / IC,或直接选 白羊～双鱼 任一星座起释')}
								{kv('看什么', '福点看身体物质运、精神点看事业心志运;选定基点其所在座为 L1 起点')}
								{kv('层级', 'L1 释期(主) → L2 子释期 → L3 → L4,逐级细分;子期回到对宫(第2次触及)标 LB=人生转折点')}
								{kv('展开', '可逐层点开看某 L1 下全部 L2、某 L2 下全部 L3、某 L3 下全部 L4')}</div>

							<div style={card}><div style={ct}>十年大运 · 四项设置</div>
								{kv('起运主星', '得时光体(昼日夜月,默认) / 太阳 / 月亮 / 水 / 金 / 火 / 木 / 土。决定起运座度')}
								{kv('分配次序', '实际黄道次序(默认) / 迦勒底星序。决定 L1 各段排序')}
								{kv('日限体系', 'Valens(精确,默认) / Hephaistio(原表日数)。决定段界日期算法')}
								{kv('时间口径', '360天/年(按30天每月,默认) / 365.25天/年(按回归年)')}
								{kv('层级', 'L1 十年 → L2 年 → L3 月 → L4 日,可逐层展开')}</div>

							<div style={card}><div style={ct}>Balbillus · 三项设置</div>
								{kv('起始星', '七政任选,默认 太阳。从该星按本命黄经序铺开')}
								{kv('年制', 'Solar 回归年(365.2422日,默认) / Egyptian·Hellenistic(360日)')}
								{kv('距离口径', '最近角距 nearest(默认) / 顺黄道距 forward。算「离擢升度角距」的取向')}</div>

							<div style={card}><div style={ct}>三分主星 · 三项设置</div>
								{kv('三分体系', '多罗特三主(昼/夜/共同,默认) / 托勒密二主(昼/夜) / 托勒密·水象变体。决定每元素取哪几颗三分主星及昼夜换序')}
									{kv('划分法', '三分 0–25/25–50/50–75(默认) / 两分 上下半生 + 协作贯穿')}
								{kv('寿命基准', '30～120 岁(决定各段折算的年龄跨度)')}</div>

							<div style={card}><div style={ct}>数字相位（Keypoints）· 释放点</div>
								{kv('取值', '身(月亮起,默认) / 命(上升起)。决定各星挂的数字 k 从哪起算')}</div>

							<div style={card}><div style={ct}>波斯向运 · 三项设置</div>
								{kv('向运速率', '波斯 1°/年(默认) / Prophected 30°/年 / Naibod 59′08″/年')}
								{kv('向运方向', 'Direct 逆时针(默认) / Converse 顺时针')}
								{kv('应期年数', '50 / 90(默认) / 120 / 150 / 200,覆盖年限')}</div>

							<div style={card}><div style={ct}>多重回归 · 返照对象</div>
								{kv('取值', '土星返照(默认,≈29.5年) / 木星返照(≈12年) / 月交返照(≈18.6年);可设回数')}</div>

							<div style={card}><div style={ct}>回归轴 · 区间</div>
								{kv('取值', '起始年(默认当前年) + 年数(1～40,默认12),生成区间内逐次太阳/月亮返照')}</div>

							<div style={card}><div style={ct}>无设置（纯展示）</div>
								{kv('法达星限', '七政加南北交按昼夜序分大限,自动算')}
								{kv('界推运 / 年龄推进点', '上升经主限/年龄点自动推,直接出表')}
								{kv('行星年龄 / 129年系统 / 月相推运', '按出生时间自动定当令星与分期')}</div>
						</div>
					</TabPane>

					<TabPane tab="返照·流年·通用" key="common">
						<div style={body}>
							<div style={h}>返照类（太阳返照 / 月亮返照）</div>
							<ul style={ul}>
								<li style={li}><b>目标日期</b>:看哪一年(太阳返照,固定生日年)/哪个月(月亮返照)。空=当前。</li>
								<li style={li}><b>返照地经纬度</b>:返照盘按所在地起;空=沿用本命地。异地过年看「迁徙盘」时改此处。</li>
								<li style={li}><b>双盘布局</b>:返照盘在内盘(默认) / 原命盘在内盘。仅影响内外圈排列,不改数据。</li>
								<li style={li}><b>页签</b>:返照盘(单) / 原命盘(单) / 对比盘(双) / 相位;月返若启用「第二月返」另多两页。</li>
							</ul>

							<div style={h}>流年法（Transits）</div>
							<ul style={ul}>
								<li style={li}><b>流年日期 + 地点 + 时区</b>:看某日某地的实时星象;默认本命后一天、本命地。</li>
								<li style={li}><b>盘型</b>:天象盘在内盘 / 原命盘在内盘(对比盘排列)。</li>
								<li style={li}><b>南北交逆移</b>:是否计月交逆行状态(默认否)。</li>
								<li style={li}><b>相位容许度</b>:判相位成立的允差(默认1°)。</li>
							</ul>

							<div style={h}>次限 / 恒星 / 赤纬推运 · 月长算法</div>
							<ul style={ul}>
								<li style={li}><b>引擎原值(默认)</b> / <b>朔望月每年(标准)</b> / <b>恒星月每年</b>。仅影响小限(minor)那一盘的月推进口径。</li>
								<li style={li}>另有<b>目标日期 / 时间</b>:看第几岁的推运盘(默认今日)。</li>
							</ul>

							<div style={h}>方向类通用（太阳弧 / 行星弧 / 小限法 等的左栏)</div>
							<ul style={ul}>
								<li style={li}><b>目标时刻</b>:推到哪一刻;空=现在。</li>
								<li style={li}><b>步进</b>:逐年 / 逐月 / 逐日。只改时间游标的粒度,不改盘数据。</li>
								<li style={li}><b>南北交逆移</b>:是 / 否(默认否),南北交点推运时是否逆向。</li>
								<li style={li}><b>行运星与本命星交角容许度</b>:双星容许度相加除以2(自动) / 0.5° / 1° / 1.5° / 2° / 2.5° / 3° / 4°。判相位成立的允差,默认1°。</li>
								<li style={li}>(行星弧另有<b>弧源天体</b>:月亮(默认)/水/金/火/木/土/日,取谁的运动量当推进弧。)</li>
							</ul>

							<div style={h}>星历（Ephemeris）</div>
							<ul style={ul}>
								<li style={li}><b>开始 / 结束日期</b>:历表区间(默认今日～90天后)。</li>
								<li style={li}><b>行运触发本命</b>:勾选则同时算这段时间行运对本命的相位(默认开)。</li>
							</ul>
							<p style={{ ...p, color: MUTED, marginTop: 4 }}>提示:多数页改完左栏点「提交」即重算;主限法在表格上方工具条点「计算」。各法盘均可叠加显示设置(星体/宫位/小点显隐),并随 AI 导出同步当前推运口径。</p>
						</div>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default DirectionHelpDoc;
