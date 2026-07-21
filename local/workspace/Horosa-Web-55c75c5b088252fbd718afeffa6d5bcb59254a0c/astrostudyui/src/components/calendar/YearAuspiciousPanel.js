// 年度黄道吉日榜面板：按事项类别列当年 Top 吉日，点击回填老黄历选中日。
import React, { useMemo, useState } from 'react';
import { Modal, List, Tag, Switch } from 'antd';
import { XQSegmented } from '../xq-ui';
import { buildYearAuspicious } from './yearAuspicious';
import { EVENT_CATEGORIES } from './tongshuData';

const NON_SENSITIVE = EVENT_CATEGORIES.filter((c)=> !c.sensitive);

export default function YearAuspiciousPanel({ year, visible, onPick, onClose }) {
	const [cat, setCat] = useState('marriage');
	const [includeBurial, setIncludeBurial] = useState(false);

	const events = useMemo(
		()=> (includeBurial ? EVENT_CATEGORIES : NON_SENSITIVE).map((c)=> c.key),
		[includeBurial],
	);
	// 仅在打开时扫全年（避免未展开也重算）。
	const buckets = useMemo(
		()=> (visible ? buildYearAuspicious(year, { events, topN: 12 }) : {}),
		[visible, year, events],
	);

	// 选项条只随「含丧葬」开关变化，无须每次父组件重渲都重建一遍数组。
	const catOptions = useMemo(
		()=> (includeBurial ? EVENT_CATEGORIES : NON_SENSITIVE).map((c)=> ({ label: c.label, value: c.key })),
		[includeBurial],
	);
	const activeCat = buckets[cat] ? cat : (catOptions[0] && catOptions[0].value);
	const list = (buckets[activeCat] && buckets[activeCat].list) || [];

	return (
		<Modal
			title={`${year} 年度黄道吉日榜`}
			open={visible}
			onCancel={onClose}
			footer={null}
			width={640}
			className='horosa-year-auspicious-modal'
		>
			<div className='horosa-year-auspicious-controls'>
				<XQSegmented value={activeCat} options={catOptions} onChange={(e)=> setCat(e.target.value)} />
				<span className='horosa-year-auspicious-burial'>
					含丧葬&nbsp;<Switch size='small' checked={includeBurial} onChange={setIncludeBurial} />
				</span>
			</div>
			<div className='horosa-year-auspicious-list'>
				<List
					size='small'
					dataSource={list}
					rowKey={(d)=> d.ymd}
					locale={{ emptyText: '本年该事项无显著吉日' }}
					renderItem={(d)=> (
						<List.Item
							className='horosa-year-auspicious-item'
							onClick={()=> onPick && onPick(d.ymd)}
						>
							<div className='horosa-year-auspicious-row'>
								<div className='horosa-year-auspicious-date'>
									<span className='horosa-ya-solar'>{d.ymd}</span>
									<span className='horosa-ya-week'>星期{d.week}</span>
									<span className='horosa-ya-lunar'>{d.lunar}</span>
									<Tag className='horosa-huangli-gz'>{d.ganzhi}</Tag>
									<Tag className={`horosa-huangli-tag ${d.huangdao === '黄道' ? 'is-good' : 'is-neutral'}`}>{d.jianchu}·{d.huangdao}</Tag>
								</div>
								<div className='horosa-year-auspicious-reasons'>
									{d.reasons.map((r, i)=> (
										<Tag key={i} className={`horosa-huangli-tag ${r.t === 'good' ? 'is-good' : (r.t === 'bad' ? 'is-bad' : 'is-neutral')}`}>{r.text}</Tag>
									))}
								</div>
							</div>
						</List.Item>
					)}
				/>
			</div>
			<div className='horosa-year-auspicious-note'>吉日据本地历算引擎按「宜事项 + 建除吉位 + 黄道 + 吉神 − 关键凶煞」评分排序；点击某日回填老黄历查看完整日课。</div>
		</Modal>
	);
}
