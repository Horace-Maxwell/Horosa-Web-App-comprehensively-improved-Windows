// 3D 星盘「显示设置」右栏面板(WS-1:替代画布内 lil-gui,双主题、走引擎 applyOption 单源)。
// 受控约定:面板 state 初始化自引擎 chartOpt(localStorage['chart3dOpt'] 已持久化),
// 每次变更调 engine.applyOption(key, val) —— 应用逻辑全在引擎,面板零业务分支。
import React from 'react';
import { Slider } from 'antd';
import { XQPanel, XQSwitch, XQSelect, XQButton } from '../xq-ui';

const SWITCH_ROWS = [
	['摄像机旋转'],
	['有云地球', '隐藏地球'],
	['地球自转轴', '隐藏地球附近星体'],
	['使用虚拟28宿', '隐藏28宿距星'],
	['隐藏北极和北斗', '隐藏其它恒星'],
	['显示斗柄连线'],
];

const SLIDERS = [
	{ key: '摄像机视野', min: 30, max: 120, step: 1 },
	{ key: '摄像机天球经度', min: 0, max: 360, step: 1 },
	{ key: '摄像机天球纬度', min: -90, max: 90, step: 1 },
	{ key: '太阳光强度', min: 0, max: 10, step: 0.1 },
	{ key: '环境光强度', min: 0, max: 2, step: 0.05 },
	{ key: '恒星距离行星圈', min: 0, max: 500, step: 5 },
	{ key: '恒星半径', min: 0.5, max: 8, step: 0.1 },
];

const COLORS = ['星盘背景', '天球线条颜色', '太阳光颜色', '环境光颜色', '文本颜色'];

const PRESET_ORDER = ['vernal', 'northPole', 'eclipticPole', 'horizonAsc'];

function toColorInput(v){
	if(typeof v === 'number'){ return `#${v.toString(16).padStart(6, '0')}`; }
	if(typeof v === 'string' && v.startsWith('#')){ return v; }
	return '#ffffff';
}

class Astro3DSettingsPanel extends React.Component {
	constructor(props){
		super(props);
		this.state = { opt: null };
	}

	componentDidMount(){
		this.syncFromEngine();
	}

	componentDidUpdate(prevProps){
		if(prevProps.engineTick !== this.props.engineTick){
			this.syncFromEngine();
		}
	}

	engine(){
		return typeof this.props.getEngine === 'function' ? this.props.getEngine() : null;
	}

	syncFromEngine(){
		const eng = this.engine();
		if(eng && eng.chartOpt){
			this.setState({ opt: { ...eng.chartOpt } });
		}
	}

	apply(key, val){
		const eng = this.engine();
		if(!eng || typeof eng.applyOption !== 'function'){
			return;
		}
		eng.applyOption(key, val);
		this.setState((s)=>({ opt: { ...s.opt, [key]: val } }));
	}

	render(){
		const { opt } = this.state;
		const eng = this.engine();
		if(!opt || !eng){
			return (
				<div style={{ padding: 16, color: 'var(--horosa-muted)' }}>
					出盘后可调显示设置。
					<div style={{ marginTop: 8 }}>
						<XQButton size="small" onClick={()=>this.syncFromEngine()}>刷新</XQButton>
					</div>
				</div>
			);
		}
		const presets = typeof eng.getCameraPresets === 'function' ? eng.getCameraPresets() : {};
		const fmt = (v, step)=> (step >= 1 ? Math.round(v) : (Math.round(v * 100) / 100));
		return (
			<div className="horosa-astro3d-settings">
				<div className="horosa-a3ds-sec">
					<div className="horosa-a3ds-title">视角预设</div>
					<div className="horosa-a3ds-presets">
						{PRESET_ORDER.filter((k)=>presets[k]).map((k)=>(
							<XQButton key={k} size="small" block onClick={()=>eng.flyToPreset(k)}>{presets[k].name}</XQButton>
						))}
					</div>
				</div>
				<div className="horosa-a3ds-sec">
					<div className="horosa-a3ds-title">显示开关</div>
					<div className="horosa-a3ds-switchgrid">
						{SWITCH_ROWS.flat().map((key)=>(
							<label key={key} className="horosa-a3ds-switchrow">
								<span className="horosa-a3ds-label">{key}</span>
								<XQSwitch size="small" checked={!!opt[key]} onChange={(v)=>this.apply(key, v)} />
							</label>
						))}
					</div>
				</div>
				<div className="horosa-a3ds-sec">
					<div className="horosa-a3ds-title">渲染参数</div>
					<label className="horosa-a3ds-switchrow" style={{ marginBottom: 4 }}>
						<span className="horosa-a3ds-label">纹理编码</span>
						<XQSelect size="small" style={{ width: 104 }} value={opt['纹理编码']}
							options={[{ value: 'sRGB', label: 'sRGB' }, { value: 'Linear', label: 'Linear' }]}
							onChange={(v)=>this.apply('纹理编码', v)} />
					</label>
					{SLIDERS.map(({ key, min, max, step })=>(
						<div key={key} className="horosa-a3ds-sliderrow">
							<div className="horosa-a3ds-sliderhead">
								<span className="horosa-a3ds-label">{key}</span>
								<em className="horosa-a3ds-val">{fmt(Number(opt[key]) || 0, step)}</em>
							</div>
							<Slider min={min} max={max} step={step} value={Number(opt[key]) || 0}
								tooltip={{ open: false }} onChange={(v)=>this.apply(key, v)} />
						</div>
					))}
				</div>
				<div className="horosa-a3ds-sec">
					<div className="horosa-a3ds-title">颜色</div>
					<div className="horosa-a3ds-colorgrid">
						{COLORS.map((key)=>(
							<label key={key} className="horosa-a3ds-colorrow">
								<input type="color" value={toColorInput(opt[key])}
									onChange={(e)=>this.apply(key, e.target.value)} className="horosa-a3ds-swatch" />
								<span className="horosa-a3ds-label">{key}</span>
							</label>
						))}
					</div>
				</div>
			</div>
		);
	}
}

export default Astro3DSettingsPanel;
