// 印占「补充表」页签:Graha Samaya、Dirah Bala、西占 Dirah、Sphuta。
import { XQSelect as Select } from '../../xq-ui';
import { SmallTable } from '../AstroExtraCommon';
import { INDIA_TABLE_SETTINGS, DIRAH_VARIANTS, DIRAH_WESTERN_TYPES, dirahColumns, dirahScore, extraLon, extraPointName, sphutaLabel } from '../../../utils/indiaExtraTables';

const { Option } = Select;

function scoreColumns(keys, types){
	return keys.map((key)=>({ key, title: types[key], align: 'right', render: (value, row)=>dirahScore(row.scores[key]) }));
}

function DirahCard({ data, variant, onChange }){
	const rows = variant === 'classic' ? data.dirahClassic : data.dirah;
	const keys = dirahColumns(rows, data.dirahTypes);
	return (
		<div className="horosa-info-card">
			<div className="horosa-info-card-title">Dirah Bala</div>
			<div className="horosa-india-select-grid">
				<div className="horosa-india-select-field">
					<span>口径</span>
					<Select size="small" style={{ width: '100%' }} value={variant} onChange={(value)=>{ INDIA_TABLE_SETTINGS.save({ dirahVariant: value }); onChange({ dirahVariant: value }); }}>
						{DIRAH_VARIANTS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
					</Select>
				</div>
			</div>
			<SmallTable scrollX rows={rows} rowKey={(row)=>row.planet} columns={[
				{ key: 'planet', title: '星', render: extraPointName },
				...scoreColumns(keys, data.dirahTypes),
				{ key: 'sum', title: '合计', align: 'right', render: dirahScore },
			]} />
			{data.polar ? <div className="horosa-india-card-note">本盘在极圈内,Placidus 没有定义,宫位分按 Porphyry 宫算。</div> : null}
		</div>
	);
}

function IndiaExtraTables({ data, variant, onChange, failed }){
	if(!data || data.available === false){
		return <div className="horosa-india-dasha-empty">{failed ? '补充表这次没算出来,换盘或重算后再试' : '补充表计算中...'}</div>;
	}
	const westernRows = (variant === 'classic' && data.dirahWesternClassic) || data.dirahWestern;
	const westernKeys = dirahColumns(westernRows, DIRAH_WESTERN_TYPES);
	return (
		<div className="horosa-india-jyotish-panel">
			<DirahCard data={data} variant={variant || 'improved'} onChange={onChange} />
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">Dirah 西占版</div>
				<SmallTable scrollX rows={westernRows} rowKey={(row)=>row.planet} columns={[
					{ key: 'planet', title: '星', render: extraPointName },
					...scoreColumns(westernKeys, DIRAH_WESTERN_TYPES),
				]} />
			</div>
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">Graha Samaya</div>
				<SmallTable rows={data.samaya} rowKey={(row)=>row.planet} columns={[
					{ key: 'planet', title: '星', render: extraPointName },
					{ key: 'value', title: '值', align: 'right' },
				]} />
			</div>
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">Sphuta</div>
				{data.sphuta.length ? (
					<SmallTable rows={data.sphuta} rowKey={(row)=>row.name} columns={[
						{ key: 'name', title: '点', render: (value)=>`${sphutaLabel(value)}(${value})` },
						{ key: 'lon', title: '位置', render: extraLon },
					]} />
				) : <div className="horosa-india-dasha-empty">这个纬度当天没有日出,土子算不出,Sphuta 无法给出</div>}
			</div>
		</div>
	);
}

export default IndiaExtraTables;
