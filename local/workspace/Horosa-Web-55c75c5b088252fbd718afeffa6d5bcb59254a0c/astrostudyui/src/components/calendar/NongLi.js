import { Component } from 'react';
import NongLiDate from './NongLiDate';
import {Week} from '../../msg/types';
import DateTime from '../comp/DateTime';

class NongLi extends Component{
	constructor(props) {
		super(props);
		this.state = {
			// [黄历小屏自适应](horosa_calendar_cell_fit_v1)三态,互不耦合:
			//   cellScale  — 仅由格宽驱动的连续比例(0.55..1),供 CSS 变量 --hl-cell-scale
			//                (格内全部字号与间距 calc 等比缩);高度绝不参与,字号恒不因高缩。
			//   cellDensity— 三档行高/字距微调(全量显示,不隐藏任何行)。
			//   cellVLevel — 0..4 渐进收行等级(高度不足时逐级合行,详见 applyCellFit)。
			// RO 全兼容(无 container query)。
			cellScale: 1,
			cellDensity: 'full',
			cellVLevel: 0,
		};
		this.otherDaysColor = '';
		this.daysColor = 'var(--horosa-text, #3b3b3b)';

		this.genDateCol = this.genDateCol.bind(this);
		this.genDaysDom = this.genDaysDom.bind(this);
		this.getMonth = this.getMonth.bind(this);

		this.onDateClick = this.onDateClick.bind(this);
		this.captureRoot = this.captureRoot.bind(this);
		this.fitOnWinResize = this.fitOnWinResize.bind(this);
	}

	// RO 双保险:个别 WebView 对「放大方向」的 RO 回调不可靠(缩小档进得去回不来,实测),
	// window resize 兜底重测一次;applyCellFit 幂等(值不变零 setState),双通道无害。
	fitOnWinResize(){
		if(this._fitRoot){
			try{ this.applyCellFit(this._fitRoot.getBoundingClientRect().width); }catch(e){ /* ignore */ }
		}
	}

	componentDidMount(){
		if(typeof window !== 'undefined'){
			window.addEventListener('resize', this.fitOnWinResize);
		}
	}

	componentDidUpdate(prevProps){
		// 月份切换 5↔6 行时容器高不变但格高变(高/行数),RO 不触发 → 数据到位后重测一次。
		if(prevProps.days !== this.props.days || prevProps.prevDays !== this.props.prevDays){
			this.fitOnWinResize();
		}
	}

	captureRoot(el){
		if(this._fitRO){
			try{ this._fitRO.disconnect(); }catch(e){ /* ignore */ }
			this._fitRO = null;
		}
		this._fitRoot = el;
		if(!el || typeof ResizeObserver === 'undefined'){
			return;
		}
		this._fitRO = new ResizeObserver((entries)=>{
			const entry = entries && entries[0];
			const width = entry && entry.contentRect ? entry.contentRect.width : 0;
			this.applyCellFit(width);
		});
		this._fitRO.observe(el);
		// 首帧立即测一次(RO 首回调有的实现延后一帧,先按当前宽出正确档)。
		try{ this.applyCellFit(el.getBoundingClientRect().width); }catch(e){ /* ignore */ }
	}

	applyCellFit(width){
		if(!width || width <= 0){
			return;
		}
		const cellW = width / 7;
		// ── 双维自适应:宽驱动等比缩、高驱动渐进收行,两条通道彼此独立 ──
		// (用户实告二连:先是窄「宽」字爆格,修后又发现矮「高」时格内行垂向溢出叠印到下一行格)。
		// 宽向:基准 150px=设计格宽,cellW/150 连续比例(0.55..1),0.02 粒度圆整防 RO 抖动
		//       导致的重渲染风暴;格内全部字号与间距 calc 等比。
		// 高向(用户定版【字号绝不因高度缩小】):高不足绝不缩字,改逐级合行(见下 cellVLevel)。
		// 格可用高:优先直读首格 clientHeight(最准——grid高/行数含格间隙与边框会虚高 ~9px)。
		let cellH = Infinity;
		try{
			const card = this._fitRoot ? this._fitRoot.querySelector('.horosa-lunar-date-card') : null;
			if(card && card.clientHeight > 0){
				cellH = card.clientHeight;
			}else{
				const grid = this._fitRoot ? this._fitRoot.querySelector('.horosa-calendar-grid') : null;
				if(grid && grid.children && grid.children.length >= 7){
					const rows = Math.max(1, Math.round(grid.children.length / 7));
					const gh = grid.getBoundingClientRect().height;
					if(gh > 0){
						cellH = gh / rows - 9;
					}
				}
			}
		}catch(e){ /* 网格未挂载时只按宽 */ }
		const cellScale = Math.round(Math.max(0.55, Math.min(1, cellW / 150)) * 50) / 50;
		const cellDensity = cellW >= 128 ? 'full' : (cellW >= 96 ? 'compact' : 'mini');
		// 渐进收行等级(用户定版:「随高度缩窄逐渐往上一行收」,非一刀切横流):
		//   m1 = 农历并入日号行; m2 = 干支与建除·章·宿行合一行; m3 = 乌兔星并入; m4 = 宜忌并入(全横流)。
		// 等级 = 「能放下的最浅级」。各级自然高不查硬编码表——按当前真实内容+真实格宽
		// 现场测量(克隆内容最全的格到无高约束测量台逐级 probe):农历/老黄历两板内容差异
		// 巨大(硬编码 178 链曾让农历在放得下时被过早合并,用户实告「高度够也没正常显示」),
		// 且横流级自然高随格宽折行数漂移,唯实测恒准。结果按 (格宽桶,天数,档位) 缓存。
		let cellVLevel = 0;
		if(cellH !== Infinity){
			// 缓存键必须含【内容维】:同为 31 天的两个月,宜忌/节气文字长短不同 ⇒ 自然高不同,
			// 只按天数缓存会让切月后沿用上个月的高度判级。用最长格文本长度作内容签名
			// (与 measure 取样口径同源:那里也是按 textContent 长度排最长两格)。
			const lvKey = Math.round(cellW / 4) + ':' + cellDensity + ':' + cellScale
				+ ':' + this.contentSignature();
			if(!this._lvHeights || this._lvHeightsKey !== lvKey){
				const hs = this.measureLevelNaturalHeights(cellW, cellScale, cellDensity);
				if(hs){
					this._lvHeights = hs;
					this._lvHeightsKey = lvKey;
				}
			}
			const hs = this._lvHeights;
			if(hs){
				while(cellVLevel < 4 && hs[cellVLevel] > cellH){
					cellVLevel += 1;
				}
			}
		}
		if(cellScale !== this.state.cellScale || cellDensity !== this.state.cellDensity || cellVLevel !== this.state.cellVLevel){
			this.setState({ cellScale, cellDensity, cellVLevel });
		}
	}

	// 各收行等级(L0 原纵排..L4 全横流)在当前内容/格宽/缩放下的真实自然高。
	// 做法:取文本最长的前两格(格间 extra 有无差异大,最长≈最高)克隆到复刻 class 链
	// (workspace-shell→board→calendar+mN)的离屏测量台,无高约束下逐级读包围盒高。
	// 10 次离屏布局仅在缓存 key 变化时发生(拖拽 resize 走 4px 宽桶),稳态零成本。
	// 内容签名:格数 + 最长格文本长度。构成收行等级缓存键的内容维(见 applyCellFit)。
	contentSignature(){
		try{
			const root = this._fitRoot;
			if(!root){
				return '0:0';
			}
			const cards = root.querySelectorAll('.horosa-lunar-date-card');
			let mx = 0;
			for(let i = 0; i < cards.length; i++){
				const len = (cards[i].textContent || '').length;
				if(len > mx){
					mx = len;
				}
			}
			return cards.length + ':' + mx;
		}catch(e){
			return '0:0';
		}
	}

	measureLevelNaturalHeights(cellW, cellScale, cellDensity){
		// 测量台务必 finally 拆除:中途任何抛错(克隆/布局读数)若走 catch 直接返回,
		// 已 append 的离屏节点会永久滞留 document.body 并逐次累积。
		// 递归守卫:测量台 append/remove 理论上可让个别 WebView 的 RO 再次回调 →
		// applyCellFit 重入 → 无限递归。绝对定位脱流实测不触发,仍以标志位钉死。
		if(this._measuring){
			return null;
		}
		let shell = null;
		this._measuring = true;
		try{
			const rootEl = this._fitRoot;
			if(!rootEl || typeof document === 'undefined'){
				return null;
			}
			const cards = rootEl.querySelectorAll('.horosa-lunar-date-card');
			if(!cards || !cards.length){
				return null;
			}
			const ranked = Array.prototype.slice.call(cards)
				.sort((a, b)=>((b.textContent || '').length - (a.textContent || '').length))
				.slice(0, 2);
			const boardEl = rootEl.closest ? rootEl.closest('.horosa-calendar-board-panel') : null;
			shell = document.createElement('div');
			shell.className = 'horosa-workspace-shell';
			shell.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + cellW + 'px;pointer-events:none;';
			const board = document.createElement('section');
			board.className = boardEl ? boardEl.className : 'horosa-calendar-board-panel';
			const cal = document.createElement('div');
			cal.style.setProperty('--hl-cell-scale', String(cellScale || 1));
			board.appendChild(cal);
			shell.appendChild(board);
			document.body.appendChild(shell);
			const LV_CLS = ['', ' horosa-cal-m1', ' horosa-cal-m1 horosa-cal-m2',
				' horosa-cal-m1 horosa-cal-m2 horosa-cal-m3',
				' horosa-cal-m1 horosa-cal-m2 horosa-cal-m3 horosa-cal-m4'];
			return LV_CLS.map((cls)=>{
				cal.className = 'horosa-lunar-calendar horosa-cal-density-' + (cellDensity || 'full') + cls;
				let mx = 0;
				for(let i = 0; i < ranked.length; i++){
					cal.innerHTML = '';
					const clone = ranked[i].cloneNode(true);
					clone.style.height = 'auto';
					clone.style.minHeight = '0';
					cal.appendChild(clone);
					const h = clone.getBoundingClientRect().height;
					if(h > mx){
						mx = h;
					}
				}
				return Math.ceil(mx);
			});
		}catch(e){
			return null;
		}finally{
			this._measuring = false;
			if(shell && shell.parentNode){
				try{ shell.parentNode.removeChild(shell); }catch(e2){ /* ignore */ }
			}
		}
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined'){
			window.removeEventListener('resize', this.fitOnWinResize);
		}
		if(this._fitRO){
			try{ this._fitRO.disconnect(); }catch(e){ /* ignore */ }
			this._fitRO = null;
		}
	}

	onDateClick(date){
		if(this.props.onDateClick){
			this.props.onDateClick(date);
		}
	}

	getMonth(date){
		let dt = new DateTime();
		dt = dt.parse(date.birth, 'yyyy-MM-dd HH:mm:ss');
		return dt.month;
	}

	// 行循环按固定 42 格索引取数;days/prevDays 短缺时(如 prevDays 未就绪)对应格为
	// undefined,直接进 genDateCol 会在 date.birth 上抛错白屏 → 以空占位格兜底。
	genDateColSafe(resdays, i, focusDate){
		const obj = resdays[i];
		if(obj === undefined || obj === null){
			return (<div key={`nl-empty-${i}`} className="horosa-calendar-cell-wrap" />);
		}
		return this.genDateCol(obj, i % 7, focusDate);
	}

	genDateCol(date, ord, focusDate){
		let hightlight = false;
		let parts = date.birth.split(' ');
		if(focusDate && focusDate === parts[0]){
			hightlight = true;
		}
		let col = (
			// key 用日期本身:randomStr 每次渲染都变,整列子树反复重挂(丢状态+白耗)
			<div key={date.birth} className={`horosa-calendar-cell-wrap ${ord === 0 || ord === 6 ? 'is-weekend' : ''}`}>
				<NongLiDate
					date={date}
					hightLight={hightlight}
					onClick={this.onDateClick}
					extra={this.props.dayExtra ? this.props.dayExtra(date) : null}
				/>
			</div>
		);
		return col;
	}

	genDaysDom(){
		let days = this.props.days;
		if(days.length === 0){
			return null;
		}

		let focusDate = null;
		if(this.props.focusDate){
			focusDate = this.props.focusDate.format('YYYY-MM-DD');
		}

		let prevdays = this.props.prevDays || [];
		let first = days[0].dayOfWeek;
		let resdays = [];
		for(let i=first-1; i>=0; i--){
			let obj = prevdays[i];
			// prevDays 尚未就绪/长度不足时跳过补位格,别抛错(后一个 days 循环本就有同款守卫)
			if(obj === undefined || obj === null){
				continue;
			}
			obj.isOther = true;
			resdays.push(obj);
		}
		let len = 42 - resdays.length;
		let month = this.getMonth(days[0]);
		for(let i=0; i<len; i++){
			let obj = days[i];
			if(obj === undefined || obj === null){
				break;
			}
			let m = this.getMonth(obj);
			if(m === month){
				obj.isOther = false;
			}else{
				obj.isOther = true;
			}
			resdays.push(obj);
		}


		let row0cols = [];
		for(let i=0; i<7; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row0cols.push(col);
		}

		let row1cols = [];
		for(let i=7; i<14; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row1cols.push(col);
			
		}

		let row2cols = [];
		for(let i=14; i<21; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row2cols.push(col);
			
		}

		let row3cols = [];
		for(let i=21; i<28; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row3cols.push(col);
			
		}

		let row4cols = [];
		for(let i=28; i<35; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row4cols.push(col);			
		}

		let row5cols = [];
		for(let i=35; i<resdays.length; i++){
			let col = this.genDateColSafe(resdays, i, focusDate);
			row5cols.push(col);			
		}

		let rows = [row0cols, row1cols, row2cols, row3cols, row4cols];
		if(resdays[35] && resdays[35].isOther === false){
			rows.push(row5cols);
		}

		const cells = rows.reduce((acc, item) => acc.concat(item), []);

		return (
			<div className='horosa-calendar-grid'>
				{cells}
			</div>
		);
	}


	render(){
		let height = this.props.height ? this.props.height : '100%';
		let dt = this.props.date.format('YYYY-MM');

		let daysdom = this.genDaysDom();

		return (
			<div
				ref={this.captureRoot}
				className={`horosa-lunar-calendar horosa-cal-density-${this.state.cellDensity}${[1,2,3,4].filter((n)=>this.state.cellVLevel >= n).map((n)=>` horosa-cal-m${n}`).join('')}`}
				style={{ height: height, '--hl-cell-scale': this.state.cellScale }}
			>
				<div className='horosa-calendar-title'>{dt}</div>
				<div className='horosa-calendar-week-row'>
					<div>{Week['0']}</div>
					<div>{Week['1']}</div>
					<div>{Week['2']}</div>
					<div>{Week['3']}</div>
					<div>{Week['4']}</div>
					<div>{Week['5']}</div>
					<div>{Week['6']}</div>
				</div>
				{daysdom}

			</div>
		);
	}
}

export default NongLi;
