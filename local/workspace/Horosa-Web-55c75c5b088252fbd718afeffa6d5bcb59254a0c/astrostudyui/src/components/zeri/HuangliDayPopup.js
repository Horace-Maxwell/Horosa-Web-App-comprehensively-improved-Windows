// 结果行「日卡」浮窗:遮罩点击关 / Esc 关 / 内容阻冒泡;卡面外观与其余概览浮窗同一副外壳(horosa-zeri-float*),
// 内容=复用 HuangLiDayCard(与老黄历页右栏同一组件同一数据链,判定单源)。
import { buildHuangliDay } from '../../components/calendar/huangliDay';
import HuangLiDayCard from '../calendar/HuangLiDayCard';
import { ZeriFloatClose } from './ZeriFloatPanel';
import { useEscapeClose } from '../../utils/useEscapeClose';

export default function HuangliDayPopup({ row, onClose }){
	useEscapeClose(onClose, !!row);   // 遮罩是 presentation(不进 Tab 序),键盘用户按 Esc 关
	if(!row){
		return null;
	}
	const m = /^(-?\d{1,5})-(\d{2})-(\d{2})/.exec(`${row.pick || row.start || ''}`);   // 年带符号 1–5 位
	let day = null;
	if(m){
		try{
			day = buildHuangliDay(Number(m[1]), Number(m[2]), Number(m[3]));
		}catch(e){
			day = null;
		}
	}
	return (
		<div className="horosa-zeri-daycard-mask" onClick={onClose} role="presentation">
			<div className="horosa-zeri-float horosa-zeri-daycard" onClick={(e)=>e.stopPropagation()} role="presentation">
				<div className="horosa-zeri-float-head">
					<span className="horosa-zeri-float-title">{row.start}{row.days > 1 ? ` ~ ${row.end}` : ''} · 日课</span>
					<span className="horosa-zeri-float-gap" />
					<ZeriFloatClose onClose={onClose} />
				</div>
				<div className="horosa-zeri-float-body horosa-zeri-daycard-body">
					{day ? <HuangLiDayCard day={day} /> : <div className="horosa-zeri-float-empty">该日超出可算域。</div>}
				</div>
			</div>
		</div>
	);
}
