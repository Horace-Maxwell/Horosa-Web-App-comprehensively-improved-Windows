import { Component } from 'react';
import { XQModal as Modal, XQSelect as Select, XQTabs as Tabs } from '../xq-ui';
import { BRIGHTNESS_GRADES, starLightOf } from './data/ziweiTables';

const { Option } = Select;
const { TabPane } = Tabs;

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 四组 32 星(与亮度表全集一致):正曜14 / 辅曜8 / 煞曜6 / 四化星4 = 384 格。
const STAR_GROUPS = [
	{ key: 'main', label: '十四正曜', stars: ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'] },
	{ key: 'assist', label: '辅曜', stars: ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马'] },
	{ key: 'sha', label: '煞曜', stars: ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'] },
	{ key: 'sihua', label: '四化星', stars: ['化禄', '化权', '化科', '化忌'] },
];

// 以「当前生效亮度源」逐格快照出预填表(编辑起点=所见即当前;空格=该星该支无标注,保存后回落基表)。
function snapshotFromSource(source){
	const src = source === 'custom' ? 'zi_jian' : source;
	const t = {};
	STAR_GROUPS.forEach((g)=>{
		g.stars.forEach((star)=>{
			const row = {};
			BRANCHES.forEach((zhi)=>{
				const v = starLightOf(star, zhi, src);
				if(v != null){ row[zhi] = v; }
			});
			t[star] = row;
		});
	});
	return t;
}

function cloneTable(src){
	const t = {};
	Object.keys(src || {}).forEach((star)=>{ t[star] = { ...src[star] }; });
	return t;
}

// [B14] 自定义亮度表编辑器:32 星 × 12 支网格,分四组页签。档值域 9 值+空(空=回落基表)。
class ZWBrightnessCustomModal extends Component {
	constructor(props){
		super(props);
		this.state = { table: this.initTable(), tab: 'main' };
		this.ok = this.ok.bind(this);
	}

	initTable(){
		// LS 已存有效表则以之起步(缺星缺格保持空=回落);否则以当前生效源快照预填。
		if(this.props.table && Object.keys(this.props.table).length){
			return cloneTable(this.props.table);
		}
		return snapshotFromSource(this.props.currentSource || 'zi_jian');
	}

	componentDidUpdate(prev){
		if(!prev.open && this.props.open){
			this.setState({ table: this.initTable(), tab: 'main' });
		}
	}

	change(star, zhi, val){
		this.setState((s)=>{
			const t = cloneTable(s.table);
			if(!t[star]){ t[star] = {}; }
			if(val){ t[star][zhi] = val; } else { delete t[star][zhi]; }
			return { table: t };
		});
	}

	// 当前页签星组整组重置为当前生效源的标注(其余组不动)。
	resetGroup(){
		const g = STAR_GROUPS.find((x)=>x.key === this.state.tab);
		if(!g){ return; }
		const snap = snapshotFromSource(this.props.currentSource || 'zi_jian');
		this.setState((s)=>{
			const t = cloneTable(s.table);
			g.stars.forEach((star)=>{ t[star] = { ...(snap[star] || {}) }; });
			return { table: t };
		});
	}

	ok(){
		if(this.props.onOk){ this.props.onOk(cloneTable(this.state.table)); }
	}

	render(){
		const t = this.state.table;
		return (
			<Modal
				open={this.props.open}
				title="自定义星曜亮度表"
				onCancel={this.props.onCancel}
				onOk={this.ok}
				width={860}
				okText="保存"
				cancelText="取消"
				className="horosa-ziwei-brightness-modal"
			>
				<Tabs activeKey={this.state.tab} onChange={(k)=>this.setState({ tab: k })} size="small">
					{STAR_GROUPS.map((g)=>(
						<TabPane tab={g.label} key={g.key}>
							<div className="horosa-ziwei-brightness-grid" style={{ overflowX: 'auto' }}>
								<table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
									<thead>
										<tr>
											<th style={{ padding: '2px 6px' }}>星</th>
											{BRANCHES.map((z)=><th key={z} style={{ padding: '2px 4px' }}>{z}</th>)}
										</tr>
									</thead>
									<tbody>
										{g.stars.map((star)=>(
											<tr key={star}>
												<td style={{ padding: '2px 6px', whiteSpace: 'nowrap' }}>{star}</td>
												{BRANCHES.map((zhi)=>(
													<td key={zhi} style={{ padding: 1 }}>
														<Select
															size="small"
															style={{ width: 56 }}
															value={(t[star] && t[star][zhi]) || undefined}
															onChange={(v)=>this.change(star, zhi, v)}
															allowClear
															placeholder="—"
														>
															{BRIGHTNESS_GRADES.map((d)=><Option key={d} value={d}>{d}</Option>)}
														</Select>
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</TabPane>
					))}
				</Tabs>
				<div className="horosa-ziwei-brightness-editor-tip" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
					<button type="button" className="horosa-ziwei-school-edit-btn" onClick={()=>this.resetGroup()}>本组重置为当前亮度源</button>
					<span style={{ fontSize: 11, opacity: 0.65 }}>留空=该格不标注(按基础表);仅改动的格生效,保存后立即随盘显示。</span>
				</div>
			</Modal>
		);
	}
}

export { snapshotFromSource, STAR_GROUPS };
export default ZWBrightnessCustomModal;
