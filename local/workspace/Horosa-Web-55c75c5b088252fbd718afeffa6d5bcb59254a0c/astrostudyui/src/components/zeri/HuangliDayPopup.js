// [Z1·黄历择日] 结果行「日卡」浮窗:交互逐字对齐奇门 QimenMiniBoardPopup(遮罩点击关/内容阻冒泡),
// 内容=复用 HuangLiDayCard(与老黄历页右栏同一组件同一数据链,判定单源)。
import { buildHuangliDay } from '../../components/calendar/huangliDay';
import HuangLiDayCard from '../calendar/HuangLiDayCard';

export default function HuangliDayPopup({ row, onClose }){
	if(!row){
		return null;
	}
	const m = /^(\d{1,4})-(\d{2})-(\d{2})/.exec(`${row.pick || row.start || ''}`);
	let day = null;
	if(m){
		try{
			day = buildHuangliDay(Number(m[1]), Number(m[2]), Number(m[3]));
		}catch(e){
			day = null;
		}
	}
	return (
		<div
			style={{
				position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(15,18,26,.45)',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
			}}
			onClick={onClose}
		>
			<div
				style={{
					width: 430, maxHeight: '86vh', overflowY: 'auto', borderRadius: 12,
					background: 'var(--horosa-astro-panel, #fff)', border: '1px solid rgba(148,163,184,.35)',
					boxShadow: '0 18px 60px rgba(0,0,0,.4)', padding: 14,
				}}
				onClick={(e)=>e.stopPropagation()}
			>
				<div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
					<span style={{ fontWeight: 600 }}>{row.start}{row.days > 1 ? ` ~ ${row.end}` : ''} · 日课</span>
					<span style={{ flex: 1 }} />
					<a onClick={onClose} style={{ fontSize: 12 }}>关闭 ✕</a>
				</div>
				{day ? <HuangLiDayCard day={day} /> : <div style={{ opacity: 0.6, padding: 16 }}>该日超出可算域。</div>}
			</div>
		</div>
	);
}
