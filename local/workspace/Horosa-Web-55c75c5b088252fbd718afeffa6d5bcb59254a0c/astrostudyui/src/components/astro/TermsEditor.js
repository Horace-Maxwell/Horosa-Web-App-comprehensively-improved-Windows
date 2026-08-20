// [WP-7] 自定义界表编辑器(Modal;入口=星盘设置③「界与尊贵」cell 右侧按钮)。
// 昼/夜两表页签(「夜表同昼表」勾选=夜表隐藏且不下发);12 座×5 界逐格(星 Select+宽度 InputNumber);
// 行尾合计实时校验(=30 ✓绿/≠30 ✗红 jx 令牌);非法禁存;「从埃及模板复制」快速起点;JSON 导出/导入。
// 存 localStorage horosa.astro.customTerms.v1(storageKeyRegistry 已登记);下发由
// classicalBackendOverrides termsVariant=4 特例块附 customTermsDay/Night(无合法表=降级不发 4)。
import React from 'react';
import { InputNumber, Input, message } from 'antd';
import { XQModal, XQSelect, XQSegmented, XQButton, XQCheckItem } from '../xq-ui';
import {
	TERMS_SIGNS_CN, TERMS_STARS, EGYPT_TEMPLATE, rowSum, validateTermsTable,
	loadCustomTerms, saveCustomTerms,
} from '../../utils/customCalibreStores';
import { copyTextSmart } from '../../utils/clipboardText';

const Option = XQSelect.Option;

function cloneTable(t){
	return (t || []).map((row) => row.map((c) => [c[0], c[1]]));
}

export default class TermsEditor extends React.Component {
	constructor(props){
		super(props);
		const saved = loadCustomTerms();
		this.state = {
			tab: 'day',
			day: cloneTable((saved && saved.day) || EGYPT_TEMPLATE),
			night: saved && saved.night ? cloneTable(saved.night) : null,   // null=夜同昼
			importOpen: false,   // [R2-5] 导入 JSON 二级弹层(桌面壳无原生 prompt)
			importText: '',
		};
	}

	setCell(which, signIdx, termIdx, field, value){
		this.setState((s) => {
			const table = cloneTable(s[which]);
			if(field === 'star'){ table[signIdx][termIdx][0] = value; }
			else { table[signIdx][termIdx][1] = Number(value) || 0; }
			return { [which]: table };
		});
	}

	toggleNight(same){
		this.setState((s) => ({ night: same ? null : cloneTable(s.night || s.day), tab: same ? 'day' : s.tab }));
	}

	copyTemplate(){
		this.setState((s) => (s.tab === 'night' && s.night
			? { night: cloneTable(EGYPT_TEMPLATE) }
			: { day: cloneTable(EGYPT_TEMPLATE) }));
	}

	async exportJson(){
		try{
			const text = JSON.stringify({ day: this.state.day, night: this.state.night });
			// 复制统一走 copyTextSmart(三级降级,Tauri webview 裸 clipboard 假成功治根件;preflight[118])。
			const ok = await copyTextSmart(text);
			if(ok){
				message.success('界表 JSON 已复制到剪贴板');
			}else{
				// [R4-P3] 桌面壳无原生 prompt(兜底路径也不能用)——把文本放进导入弹层展示,用户可手动全选复制。
				this.setState({ importOpen: true, importText: text });
				message.warning('复制失败:已把 JSON 显示在下方文本框,请手动复制');
			}
		}catch(e){ message.error('导出失败'); }
	}

	importJson(){
		// [R2-5] 桌面壳(Tauri webview)不支持原生 prompt(AIAnalysisMain 先例注释)——改 TextArea 二级弹层。
		this.setState({ importOpen: true, importText: '' });
	}

	applyImportText(text){
		if(!text){ return; }
		try{
			const obj = JSON.parse(text);
			if(!validateTermsTable(obj.day)){ message.error('day 表非法(12 座×5 界·每座和 30)'); return; }
			this.setState({ day: cloneTable(obj.day), night: validateTermsTable(obj.night) ? cloneTable(obj.night) : null });
			message.success('已导入');
		}catch(e){ message.error('JSON 解析失败'); }
	}

	save = () => {
		const { day, night } = this.state;
		if(!validateTermsTable(day) || (night && !validateTermsTable(night))){
			message.error('存在合计 ≠30° 的星座行,请先修正');
			return;
		}
		if(!saveCustomTerms(day, night)){
			message.error('保存失败');
			return;
		}
		message.success('自定义界表已保存');
		if(this.props.onSaved){ this.props.onSaved(); }
		if(this.props.onClose){ this.props.onClose(); }
	};

	renderTable(which){
		const table = this.state[which];
		if(!table){ return null; }
		return (
			<div style={{ overflowX: 'auto' }}>
				<table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
					<thead>
						<tr>
							<th style={{ padding: '4px 6px', textAlign: 'left' }}>星座</th>
							{[1, 2, 3, 4, 5].map((n) => (<th key={n} style={{ padding: '4px 6px' }}>{`第${n}界`}</th>))}
							<th style={{ padding: '4px 6px' }}>合计</th>
						</tr>
					</thead>
					<tbody>
						{table.map((row, si) => {
							const sum = rowSum(row);
							const ok = Math.abs(sum - 30) < 1e-9;
							return (
								<tr key={si}>
									<td style={{ padding: '3px 6px', fontWeight: 600 }}>{TERMS_SIGNS_CN[si]}</td>
									{row.map((cell, ti) => (
										<td key={ti} style={{ padding: '3px 4px' }}>
											<XQSelect size="small" style={{ width: 58 }} value={cell[0]} dropdownMatchSelectWidth={false}
												onChange={(v) => this.setCell(which, si, ti, 'star', v)}>
												{TERMS_STARS.map((s) => (<Option key={s.value} value={s.value}>{s.label}</Option>))}
											</XQSelect>
											<InputNumber size="small" style={{ width: 56, marginLeft: 3 }} min={1} max={26} precision={0}
												value={cell[1]} onChange={(v) => this.setCell(which, si, ti, 'width', v)} />
										</td>
									))}
									<td style={{ padding: '3px 6px', fontWeight: 700,
										color: ok ? 'var(--horosa-jx-ji, #1f8a4c)' : 'var(--horosa-jx-xiong, #c0392b)' }}>
										{sum}° {ok ? '✓' : '✗'}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		);
	}

	render(){
		const { open, onClose } = this.props;
		const { tab, night } = this.state;
		const nightSame = night === null;
		return (
			<XQModal open={open} onCancel={onClose} title="自定义界表（termsVariant · 自定义档）" width={780} footer={null}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
					<XQSegmented value={nightSame ? 'day' : tab}
						options={nightSame ? [{ value: 'day', label: '昼夜同表' }] : [{ value: 'day', label: '昼界表' }, { value: 'night', label: '夜界表' }]}
						onChange={(e) => this.setState({ tab: (e && e.target ? e.target.value : e) })} />
					<XQCheckItem checked={nightSame} onClick={() => this.toggleNight(!nightSame)}>
						<span className="horosa-selector-label">夜表同昼表</span>
					</XQCheckItem>
					<span style={{ flex: 1 }} />
					<XQButton size="small" onClick={() => this.copyTemplate()}>从埃及模板复制</XQButton>
					<XQButton size="small" onClick={() => this.exportJson()}>导出 JSON</XQButton>
					<XQButton size="small" onClick={() => this.importJson()}>导入 JSON</XQButton>
				</div>
				{this.renderTable(nightSame ? 'day' : tab)}
				<div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
					<XQButton onClick={onClose}>取消</XQButton>
					<XQButton type="primary" onClick={this.save}>保存并生效</XQButton>
				</div>
				<div className="horosa-field-hint" style={{ marginTop: 6 }}>
					每座 5 界宽度合计须为 30°；保存后在「界系」选「自定义界表」档生效，随排盘全站透传。
				</div>
				<XQModal open={this.state.importOpen} onCancel={() => this.setState({ importOpen: false })}
					title="导入界表 JSON" width={520} footer={null}>
					<Input.TextArea rows={8} value={this.state.importText}
						placeholder='粘贴 { "day": [...], "night": [...] } 形 JSON(night 可缺=夜同昼)'
						onChange={(e) => this.setState({ importText: e.target.value })} />
					<div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
						<XQButton onClick={() => this.setState({ importOpen: false })}>取消</XQButton>
						<XQButton type="primary" onClick={() => { this.applyImportText(this.state.importText); this.setState({ importOpen: false }); }}>导入</XQButton>
					</div>
				</XQModal>
			</XQModal>
		);
	}
}
