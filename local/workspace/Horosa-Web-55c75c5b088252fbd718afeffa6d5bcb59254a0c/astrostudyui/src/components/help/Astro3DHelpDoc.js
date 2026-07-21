// 3D 星盘 · 操作手册(帮助页内容组件,3D星盘页右上角「帮助」打开)。
import { Component } from 'react';
import { Tabs } from 'antd';

const { TabPane } = Tabs;
import { MUTED, p, card, ct, body, title } from './helpDocStyle';

const kv = (k, v) => <div style={{ margin: '1px 0', lineHeight: 1.55 }}><span style={{ color: MUTED }}>{k}：</span>{v}</div>;

class Astro3DHelpDoc extends Component{
	render(){
		return (
			<div style={{ marginTop: 10, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.25))', paddingTop: 8 }}>
				<div style={title}>3D 星盘 · 操作手册</div>
				<Tabs defaultActiveKey="overview" size="small">
					<TabPane tab="总览" key="overview">
						<div style={body}>
							<p style={p}><b>3D 星盘</b>把星盘还原成三维天球:黄道、天赤道、地平圈与宫位界线以真实球面几何呈现,行星按黄经黄纬落位,相位以弦线连接。用它可以直观看出「盘面上相邻的两星在天球上其实相距多远」、纬度(黄纬)如何影响相位的真实紧密度等平面盘看不出的信息。</p>
							<div style={card}><div style={ct}>视角操作</div>
								{kv('旋转', '按住鼠标左键拖动')}
								{kv('缩放', '滚轮')}
								{kv('全屏', '双击画布进入或退出全屏')}</div>
							<div style={card}><div style={ct}>简化模式</div>
								{kv('说明', '3D 行星模型资源缺失时自动进入简化模式:行星以符号标记呈现,轨道 / 圈层 / 相位弦等几何全部保留,判读不受影响')}</div>
						</div>
					</TabPane>
					<TabPane tab="时间与参数" key="input">
						<div style={body}>
							<div style={card}><div style={ct}>时间</div>
								{kv('编辑', '右栏顶部逐段选择纪元 / 年月日 / 时区 / 时分秒;「此刻」跳当前时间;「确定」应用')}
								{kv('步进', '「−」「+」按所选步长(分钟 / 小时 / 天…)前后推动时间,盘面即时重算')}</div>
							<div style={card}><div style={ct}>盘面参数</div>
								{kv('黄道', '回归黄道 / 恒星黄道(含多种岁差)切换')}
								{kv('宫位制', 'Alcabitius / Placidus / 整宫等常用分宫制')}
								{kv('星座口径', '天文星座 / 涵义星座 两种画法')}
								{kv('中心体切换', '把天球的中心从「地心(默认)」换成「日心 / 月心」或任一行星心(水星心…冥王心)。换心后整盘按新中心重算并有过渡动画;非地心时改时间 / 地点会以同一中心原地刷新;计算失败会自动回落到地心并提示')}
								{kv('地点', '「经纬度选择」打开地点弹窗:城市快搜(本地数据)/ 在线地图(首次使用需你同意加载)/ 手输经纬度')}</div>
						</div>
					</TabPane>
					<TabPane tab="右栏五页" key="rightpanel">
						<div style={body}>
							<div style={card}><div style={ct}>信息</div>
								{kv('看什么', '昼夜盘、日主星 / 时主星、映点 / 反映点、接纳(正 / 邪·有情无情)、互容、光线围攻、夹星 / 夹宫、纬照(平行 / 相对星体)等古典结构判读')}</div>
							<div style={card}><div style={ct}>相位</div>
								{kv('看什么', '两两相位与容许度列表,与 3D 球面上的弦线一一对应')}</div>
							<div style={card}><div style={ct}>行星</div>
								{kv('看什么', '逐颗行星的落座落宫与度数详情')}</div>
							<div style={card}><div style={ct}>希腊点</div>
								{kv('看什么', '已启用的希腊点 / 阿拉伯点位置(受占星页的希腊点开关控制)')}</div>
								<div style={card}><div style={ct}>显示</div>
									{kv('看什么', '三维天球的视觉调节面(视角预设 / 开关 / 参数 / 颜色),详见「显示设置」页')}</div>
					</div>
					</TabPane>
					<TabPane tab="显示设置" key="display">
						<div style={body}>
							<p style={p}>右栏第五页「显示」是三维天球的视觉调节面板,只改画面呈现、不改任何排盘数据。设置会自动记住,下次打开沿用。分四组:</p>
							<div style={card}><div style={ct}>视角预设(一键飞到某个观察角度)</div>
								{kv('春分点', '相机移到黄经 0°、黄纬 0°,正对春分点方向')}
								{kv('北天极', '移到天球北极附近(约黄经 90°、纬 66.56°),俯瞰赤道面')}
								{kv('黄道极', '移到黄道正上方(纬约 90°),垂直俯视黄道盘')}
								{kv('出生地地平', '对准上升点方向(仅在盘中已算出上升点时出现)')}
								{kv('作用', '点击即以缓动动画飞过去,只换视角、不动盘;想自由转动仍可随时拖动画布')}</div>
							<div style={card}><div style={ct}>开关(默认全部关闭,勾选即生效)</div>
								{kv('摄像机旋转', '开启后视角自动缓慢环绕,像地球仪自转;想细看时关掉')}
								{kv('有云地球 / 隐藏地球', '前者给中心地球叠加云层贴图更写实;后者直接隐去地球球体,只留圈层与星体')}
								{kv('地球自转轴', '画出穿过南北极的自转轴线')}
								{kv('隐藏地球附近星体', '隐去贴近地球的近距天体,避免中心处遮挡')}
								{kv('使用虚拟28宿 / 隐藏28宿距星', '前者以规整等分的虚拟宿界代替真实距星连线;后者隐去二十八宿的距星标记')}
								{kv('隐藏北极和北斗 / 隐藏其它恒星', '分别隐去北极 / 北斗一组,或其余背景恒星,让盘面更干净')}
								{kv('显示斗柄连线', '画出北斗七星斗柄的连线,便于定位')}</div>
							<div style={card}><div style={ct}>参数(滑块 / 下拉,拖动即时反映到画面)</div>
								{kv('纹理编码', 'sRGB / Linear 两种贴图色彩编码;sRGB 更接近常见观感,Linear 偏物理线性')}
								{kv('摄像机视野', '30–120,视野角(近似焦距);数值小=拉近放大、大=广角')}
								{kv('摄像机天球经度 / 纬度', '经度 0–360、纬度 −90–90,直接以数值定位观察方位(与视角预设等价的手动版)')}
								{kv('太阳光强度 / 环境光强度', '前者 0–10 调主光明暗与阴影对比,后者 0–2 调整体基础亮度')}
								{kv('恒星距离行星圈', '0–500,把恒星层放到离中心多远的球壳上')}
								{kv('恒星半径', '0.5–8,恒星标记的大小')}</div>
							<div style={card}><div style={ct}>颜色(取色器,随选随变)</div>
								{kv('可调项', '星盘背景 / 太阳光颜色 / 环境光颜色 / 文本颜色')}
								{kv('说明', '点色块弹出取色器选颜色,用于配合明暗主题或个人偏好')}</div>
							<div style={card}><div style={ct}>小提示</div>
								{kv('何时可用', '需先出盘;未出盘时该页提示「出盘后可调显示设置」,可点「刷新」重试')}</div>
						</div>
					</TabPane>
				</Tabs>
			</div>
		);
	}
}

export default Astro3DHelpDoc;
