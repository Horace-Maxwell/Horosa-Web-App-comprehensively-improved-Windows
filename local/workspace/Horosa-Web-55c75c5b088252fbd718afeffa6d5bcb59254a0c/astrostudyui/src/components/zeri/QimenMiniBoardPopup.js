// [奇门择日] 结果行「概览」浮窗:可拖拽(标题栏)/可缩放(右下角),fixed 于视口,不关结果表——
// 外壳与其余概览浮窗共用 ZeriFloatPanel。内容 = DunJiaBoard 迷你盘(图例胶囊等壳作用域样式靠 horosa-qimen-mini-board 补挂),
// 盘面用与扫描同源的本地引擎速览(角标注明);pick 起盘后的主盘才走 DunJiaMain 标准显示路由。
import { useMemo } from 'react';
import DunJiaBoard from '../dunjia/DunJiaBoard';
import { computeQimenScanPan } from '../../divination/zeri/qimenScanEngine';
import { geoDepKey } from './zeriHostUtils';
import ZeriFloatPanel from './ZeriFloatPanel';

const BOARD_BASE_W = 662;
const BOARD_BASE_H = 870;

export default function QimenMiniBoardPopup({ row, geoParams, options, seeds, onClose }){
	const pan = useMemo(()=>{
		try{
			const text = `${row && row.pick ? row.pick : ''}`;
			const m = /^(-?\d{1,5}-\d{2}-\d{2})[ ](\d{2}:\d{2})/.exec(text);   // 年带符号 1–5 位
			if(!m){
				return null;
			}
			return computeQimenScanPan(geoParams, options, seeds || {}, m[1], `${m[2]}:00`);
		}catch(e){
			return null;
		}
	// 依赖带上地点与找局种子:浮窗开着时宿主换了地点重扫(预览地点换成新的冻结地点),盘随之重排
	// (此前只认时刻与参数,照旧显示旧地点的盘 —— 与概览浮窗其余各卡同病同修)
	}, [row && row.pick, JSON.stringify(options || {}), geoDepKey(geoParams), JSON.stringify(seeds || {})]);
	return (
		<ZeriFloatPanel
			initialBox={{ x: 110, y: 40, w: 720, h: 780 }}
			minW={380}
			minH={420}
			onClose={onClose}
			title={`概览 · ${row ? row.start : ''}`}
			sub={`${pan ? pan.juText : ''} · 速览(本地排盘,与扫描同源)`}
			bodyClassName="horosa-qimen-mini-board"
			bodyStyle={{ overflow: 'auto', display: 'flex', justifyContent: 'center' }}
		>
			{(box)=>{
				if(!pan){
					return <div className="horosa-zeri-float-empty">排盘失败</div>;
				}
				// 缩放:随浮窗尺寸取宽高最小适配,夹在 DunJiaBoard 官方档位(0.58~1.18,基线 662×870)。
				const boardScale = Math.max(0.58, Math.min(1.18, Math.min((box.w - 24) / BOARD_BASE_W, (box.h - 64) / BOARD_BASE_H)));
				return <DunJiaBoard pan={pan} boardScale={boardScale} />;
			}}
		</ZeriFloatPanel>
	);
}
