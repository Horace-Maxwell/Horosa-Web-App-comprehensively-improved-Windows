// 老黄历今日日课卡（右栏）：纵向分区呈现 buildHuangliDay 全字段，沿用 .horosa-calendar-* 视觉。
import React from 'react';
import { Divider, Tag } from 'antd';

// jx（good/bad/neutral）或吉凶（吉/凶）→ 语义色 className。
function jxClass(jx) {
	if (jx === 'good' || jx === '吉') { return 'is-good'; }
	if (jx === 'bad' || jx === '凶') { return 'is-bad'; }
	return 'is-neutral';
}

function Section({ title, children }) {
	return (
		<div className='horosa-huangli-section'>
			<div className='horosa-huangli-section-title'>{title}</div>
			<div className='horosa-huangli-section-body'>{children}</div>
		</div>
	);
}

function TagList({ items, tone }) {
	const arr = (Array.isArray(items) ? items : []).filter(Boolean);
	if (!arr.length) { return <span className='horosa-huangli-muted'>（无）</span>; }
	return (
		<span className='horosa-huangli-tags'>
			{arr.map((t, i)=> <Tag key={`${t}-${i}`} className={`horosa-huangli-tag ${tone || ''}`}>{t}</Tag>)}
		</span>
	);
}

function KV({ label, value, cls }) {
	return (
		<div className='horosa-huangli-kv'>
			<span className='horosa-huangli-kv-label'>{label}</span>
			<span className={`horosa-huangli-kv-value ${cls || ''}`}>{value != null && value !== '' ? value : '—'}</span>
		</div>
	);
}

export default function HuangLiDayCard({ day }) {
	if (!day || !day.lunar) {
		return <div className='horosa-empty-hint'>选择日期查看完整通书日课</div>;
	}
	const l = day.lunar;
	const yg = day.yearGods;

	return (
		<div className='horosa-huangli-card'>
			{/* 头部：公农历干支 */}
			<div className='horosa-huangli-head'>
				<div className='horosa-huangli-head-solar'>{day.solar.ymd}　星期{day.solar.week}</div>
				<div className='horosa-huangli-head-lunar'>{l.text}</div>
				<div className='horosa-huangli-head-gz'>
					<Tag className='horosa-huangli-gz'>{l.yearGZ}年</Tag>
					<Tag className='horosa-huangli-gz'>{l.monthGZ}月</Tag>
					<Tag className='horosa-huangli-gz'>{l.dayGZ}日</Tag>
					<Tag className='horosa-huangli-gz'>属{l.shengxiao}</Tag>
				</div>
				{(l.jieqi || (day.solar.festivals || []).length) ? (
					<div className='horosa-huangli-head-tags'>
						{l.jieqi ? <Tag className='horosa-huangli-tag is-good'>{l.jieqi}{l.jieqiTime ? ` ${l.jieqiTime.split(' ')[1] || ''}` : ''}</Tag> : null}
						{(day.solar.festivals || []).map((f, i)=> <Tag key={`f-${i}`} className='horosa-huangli-tag is-neutral'>{f}</Tag>)}
					</div>
				) : null}
			</div>

			{/* 宜 / 忌 */}
			<div className='horosa-huangli-yiji'>
				<div className='horosa-huangli-yiji-col is-yi'>
					<div className='horosa-huangli-yiji-head'>宜</div>
					<div className='horosa-huangli-yiji-body'>{(day.yi || []).length ? (day.yi).join('　') : '诸事不宜'}</div>
				</div>
				<div className='horosa-huangli-yiji-col is-ji'>
					<div className='horosa-huangli-yiji-head'>忌</div>
					<div className='horosa-huangli-yiji-body'>{(day.ji || []).length ? (day.ji).join('　') : '无所忌'}</div>
				</div>
			</div>

			<Section title='值神 · 值宿'>
				<KV label='建除' value={`${day.jianchu.name}日`} cls={jxClass(day.jianchu.jx)} />
				<KV label='黄黑道' value={`${day.tianshen.name}（${day.tianshen.type}）`} cls={jxClass(day.tianshen.luck)} />
				<KV label='值宿' value={`${day.xiu.name}${day.xiu.zheng || ''}${day.xiu.animal || ''}（${day.xiu.xiang}）`} cls={jxClass(day.xiu.jx)} />
				{day.nineStar ? <KV label='九星' value={day.nineStar.name} /> : null}
				<KV label='纳音' value={day.nayin} />
			</Section>

			<Section title='彭祖百忌'>
				<div className='horosa-huangli-pengzu'>{day.pengzu.gan}</div>
				<div className='horosa-huangli-pengzu'>{day.pengzu.zhi}</div>
			</Section>

			<Section title='吉神宜趋 / 凶煞宜忌'>
				<div className='horosa-huangli-row'><span className='horosa-huangli-tagline-label'>吉神</span><TagList items={day.jishen} tone='is-good' /></div>
				<div className='horosa-huangli-row'><span className='horosa-huangli-tagline-label'>凶煞</span><TagList items={day.xiongsha} tone='is-bad' /></div>
			</Section>

			<Section title='冲煞 · 胎神 · 方位'>
				<KV label='冲煞' value={`冲${day.chong.shengxiao}　煞${day.chong.sha}`} cls='is-bad' />
				<KV label='胎神' value={day.tai} />
				<div className='horosa-huangli-pos'>
					<Tag className='horosa-huangli-tag is-good'>喜神 {day.positions.xi}</Tag>
					<Tag className='horosa-huangli-tag is-good'>福神 {day.positions.fu}</Tag>
					<Tag className='horosa-huangli-tag is-good'>财神 {day.positions.cai}</Tag>
					<Tag className='horosa-huangli-tag is-neutral'>阳贵 {day.positions.yangGui}</Tag>
					<Tag className='horosa-huangli-tag is-neutral'>阴贵 {day.positions.yinGui}</Tag>
				</div>
				{day.lu ? <KV label='日禄' value={day.lu} /> : null}
			</Section>

			<Section title='时辰吉凶'>
				<div className='horosa-huangli-times'>
					{(day.times || []).map((t, i)=> (
						<div key={`${t.ganzhi}-${i}`} className={`horosa-huangli-time ${jxClass(t.luck)}`}>
							<span className='horosa-huangli-time-gz'>{t.ganzhi}</span>
							<span className='horosa-huangli-time-range'>{t.range}</span>
							<span className='horosa-huangli-time-luck'>{t.luck}</span>
							<span className='horosa-huangli-time-yi'>{(t.yi || []).slice(0, 3).join('·') || '—'}</span>
						</div>
					))}
				</div>
			</Section>

			{(day.hou || day.liuyao || day.yuexiang || day.shujiu || day.fu) ? (
				<Section title='物候 · 六曜 · 数九三伏'>
					<div className='horosa-huangli-inline'>
						{day.hou ? <span>物候 {day.hou}</span> : null}
						{day.liuyao ? <span>六曜 {day.liuyao}</span> : null}
						{day.yuexiang ? <span>月相 {day.yuexiang}</span> : null}
						{day.shujiu ? <span>数九 {day.shujiu}</span> : null}
						{day.fu ? <span>三伏 {day.fu}</span> : null}
					</div>
				</Section>
			) : null}

			{yg && yg.taisui ? (
				<Section title='流年年神方位'>
					<KV label='太岁' value={`${yg.taisui.dir}（${yg.taisui.zhi}）`} cls='is-neutral' />
					<KV label='岁破' value={`${yg.suipo.dir}（${yg.suipo.zhi}）`} cls='is-bad' />
					<KV label='三煞' value={`${(yg.sansha.list || []).map((s)=>`${s.name}${s.dir || ''}`).join('、')}（${yg.sansha.ju}）`} cls='is-bad' />
					{yg.wuHuang && yg.wuHuang.dir ? <KV label='五黄' value={yg.wuHuang.dir} cls='is-bad' /> : null}
					{(yg.jiDongDirs || []).length ? <KV label='忌动土方' value={(yg.jiDongDirs).join('、')} cls='is-bad' /> : null}
				</Section>
			) : null}

			<Divider className='horosa-huangli-divider' />
			<div className='horosa-huangli-note'>日课由本地历算引擎推得；宜忌须与坐向、主事年命合参，忌逢关键凶煞。</div>
		</div>
	);
}
