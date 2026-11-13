// 印占 Yoga 页下半的 111 条判定表。口径和显示范围只影响视图,状态放在宿主页,切页签不丢;亲手改的跨会话保留。
import { XQSelect as Select } from '../../xq-ui';
import { INDIA_TABLE_SETTINGS, YOGA_NATURE_LABELS, YOGA_TABLE_SCOPES, YOGA_TABLE_VARIANTS, yogaRowCond, yogaRowHit } from '../../../utils/indiaExtraTables';

const { Option } = Select;

function IndiaYogaRuleTable({ data, variant = 'improved', scope = 'hit', onChange }){
	if(!data || data.available === false || !Array.isArray(data.rows)){ return null; }
	const rows = data.rows.filter((row)=>scope === 'all' || yogaRowHit(row, variant));
	const count = variant === 'classic' ? data.classicHits : data.hits;
	return (
		<div className="horosa-info-card">
			<div className="horosa-info-card-title">Yoga 判定表 · 成立 {count} / 111</div>
			<div className="horosa-india-select-grid">
				<div className="horosa-india-select-field">
					<span>口径</span>
					<Select size="small" style={{ width: '100%' }} value={variant} onChange={(value)=>{ INDIA_TABLE_SETTINGS.save({ yogaTableVariant: value }); onChange({ yogaTableVariant: value }); }}>
						{YOGA_TABLE_VARIANTS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
					</Select>
				</div>
				<div className="horosa-india-select-field">
					<span>显示</span>
					<Select size="small" style={{ width: '100%' }} value={scope} onChange={(value)=>{ INDIA_TABLE_SETTINGS.save({ yogaTableScope: value }); onChange({ yogaTableScope: value }); }}>
						{YOGA_TABLE_SCOPES.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
					</Select>
				</div>
			</div>
			{rows.length ? (
				<div className="horosa-india-data-list">
					{rows.map((row)=>(
						<div className="horosa-india-data-row" key={row.id}>
							<strong>{row.zh}</strong>
							<span>
								{row.name} · {row.group} · {YOGA_NATURE_LABELS[row.nature] || '中'}
								{scope === 'all' && yogaRowHit(row, variant) ? <span className="horosa-india-flag-badge is-good" style={{ marginLeft: 6 }}>成立</span> : null}
							</span>
							<em>{yogaRowCond(row, variant)}</em>
						</div>
					))}
				</div>
			) : <div className="horosa-india-dasha-empty">这张盘没有成立的条目</div>}
		</div>
	);
}

export default IndiaYogaRuleTable;
