// [WP-7] 自定义恒星黄道槽位管理(Modal;入口=星盘设置③「恒星与天象」按钮)。
// 10 槽:名称+参考历元(JD)+该历元 ayanamsa 度值;「设为当前」后左栏黄道下拉的
// 「恒星黄道·自定义」档即用该槽(fields 下发 siderealAyanamsa='user'+userAyanT0/userAyanDeg,
// 后端 SIDM_USER 三参;参数缺失后端回落 Lahiri 不炸盘)。换算器按 50.29″/年 近似仅供参考。
import React from 'react';
import { InputNumber, Input, message } from 'antd';
import { XQModal, XQButton } from '../xq-ui';
import { AYAN_MAX_SLOTS, loadCustomAyanamsa, saveCustomAyanamsa, approxAyanAt } from '../../utils/customCalibreStores';

const J2000 = 2451545.0;

export default class CustomAyanamsaManager extends React.Component {
	constructor(props){
		super(props);
		this.state = { ...loadCustomAyanamsa(), calcJd: J2000 };
	}

	persist(next){
		const store = { slots: next.slots !== undefined ? next.slots : this.state.slots,
			current: next.current !== undefined ? next.current : this.state.current };
		saveCustomAyanamsa(store);
		this.setState(store);
		if(this.props.onChanged){ this.props.onChanged(store); }
	}

	addSlot(){
		if(this.state.slots.length >= AYAN_MAX_SLOTS){ message.warning(`最多 ${AYAN_MAX_SLOTS} 槽`); return; }
		this.persist({ slots: [...this.state.slots, { name: `自定义 ${this.state.slots.length + 1}`, t0: J2000, deg: 24 }] });
	}

	setSlot(idx, field, value){
		// [R2-17] InputNumber 清空回调 null:Number(null)=0 会把历元静默归零(JD 0=公元前 4713 年)——
		// 空值存 null,消费端(currentAyanSlot/userAyanParamsFrom)按 isFinite 拦截。
		const numVal = (value === null || value === undefined || `${value}` === '') ? null : Number(value);
		// [R4-P3] 清空「当前槽」的历元参=排盘将静默回落 Lahiri(N6 闸只拦「设为当前」,编辑路径绕过)——即时警告。
		if(numVal === null && field !== 'name' && this.state.current === idx){
			message.warning('当前槽历元被清空:该参缺失时排盘将回落 Lahiri,请补全或另设当前槽');
		}
		const slots = this.state.slots.map((s, i) => (i === idx ? { ...s, [field]: field === 'name' ? `${value}` : numVal } : s));
		this.persist({ slots });
	}

	removeSlot(idx){
		const slots = this.state.slots.filter((_, i) => i !== idx);
		let current = this.state.current;
		if(current === idx){ current = null; }
		else if(current !== null && current > idx){ current -= 1; }
		this.persist({ slots, current });
	}

	render(){
		const { open, onClose } = this.props;
		const { slots, current, calcJd } = this.state;
		const cur = current !== null ? slots[current] : null;
		return (
			<XQModal open={open} onCancel={onClose} title="自定义恒星黄道（岁差历元槽位）" width={640} footer={null}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
					{slots.length === 0 ? (
						<div className="horosa-field-hint">尚无槽位。「新增槽位」后填参考历元(儒略日 JD)与该历元的 ayanamsa 度值。</div>
					) : slots.map((s, i) => (
						<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
							padding: '5px 8px', borderRadius: 6,
							border: `1px solid ${current === i ? 'var(--horosa-accent)' : 'var(--horosa-border)'}` }}>
							<Input size="small" style={{ width: 120 }} value={s.name}
								onChange={(e) => this.setSlot(i, 'name', e.target.value)} />
							<span style={{ fontSize: 12, opacity: 0.75 }}>历元 JD</span>
							<InputNumber size="small" style={{ width: 120 }} value={s.t0} precision={1}
								onChange={(v) => this.setSlot(i, 't0', v)} />
							<span style={{ fontSize: 12, opacity: 0.75 }}>ayanamsa(°)</span>
							<InputNumber size="small" style={{ width: 100 }} value={s.deg} precision={4} step={0.01}
								onChange={(v) => this.setSlot(i, 'deg', v)} />
							<span style={{ flex: 1 }} />
							<XQButton size="small" type={current === i ? 'primary' : 'default'}
								onClick={() => {
									// [N6] 未填历元两参的槽设为当前=后端静默回落 Lahiri 且 UI 零提示——先校验。
									if(current !== i && !(Number.isFinite(s.t0) && s.t0 > 0 && Number.isFinite(s.deg))){
										message.warning('请先填写历元 JD(>0)与 ayanamsa 度值,再设为当前');
										return;
									}
									this.persist({ current: current === i ? null : i });
								}}>
								{current === i ? '当前 ✓' : '设为当前'}
							</XQButton>
							<XQButton size="small" onClick={() => this.removeSlot(i)}>删除</XQButton>
						</div>
					))}
					<div>
						<XQButton size="small" onClick={() => this.addSlot()}>新增槽位</XQButton>
					</div>
					{cur ? (
						<div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--horosa-panel-soft)' }}>
							<div style={{ fontSize: 12, marginBottom: 4 }}>换算器（近似 · 50.29″/年;排盘走 Swiss Ephemeris 精确模型）</div>
							<span style={{ fontSize: 12, opacity: 0.75, marginRight: 6 }}>目标 JD</span>
							<InputNumber size="small" style={{ width: 130 }} value={calcJd} precision={1}
								onChange={(v) => this.setState({ calcJd: Number(v) || J2000 })} />
							<span style={{ fontSize: 12, marginLeft: 10 }}>
								≈ {(approxAyanAt(cur, calcJd) || 0).toFixed(4)}°
							</span>
						</div>
					) : null}
					<div className="horosa-field-hint">
						设为当前后，左栏「黄道」下拉选「恒星黄道 · 自定义」即按该槽历元排盘；未设当前时该档回落 Lahiri。
					</div>
				</div>
			</XQModal>
		);
	}
}
