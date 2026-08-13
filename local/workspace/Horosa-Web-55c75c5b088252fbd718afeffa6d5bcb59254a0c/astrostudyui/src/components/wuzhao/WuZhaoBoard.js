import React, { Component } from 'react';
import { Popover } from 'antd';

// 经典兆图:十二支外环 + 五乡方位盒 + 纳甲带 + 神煞徽章。
// 方位依后天八卦:巽(兆)东南、离(火)南、震(木)东、中(土)、兑(金)西、坎(水)北,
// 与排盘六位次第(巽兆/震木乡/离火乡/中土乡/兑金乡/坎水乡)一一对应。

const RING = [
	{ branch: '辰', row: 1, col: 0 },
	{ branch: '巳', row: 0, col: 1 },
	{ branch: '午', row: 0, col: 2 },
	{ branch: '未', row: 0, col: 3 },
	{ branch: '申', row: 1, col: 4 },
	{ branch: '酉', row: 2, col: 4 },
	{ branch: '戌', row: 3, col: 4 },
	{ branch: '亥', row: 4, col: 3 },
	{ branch: '子', row: 4, col: 2 },
	{ branch: '丑', row: 4, col: 1 },
	{ branch: '寅', row: 3, col: 0 },
	{ branch: '卯', row: 2, col: 0 },
];

// 六位在内盘 3×3 中的落位(index 与 pan.positions / classic.positions 同序)
const CELLS = [
	{ index: 0, row: 1, col: 1, palace: '巽' },
	{ index: 1, row: 2, col: 1, palace: '震' },
	{ index: 2, row: 1, col: 2, palace: '离' },
	{ index: 3, row: 2, col: 2, palace: '中' },
	{ index: 4, row: 2, col: 3, palace: '兑' },
	{ index: 5, row: 3, col: 2, palace: '坎' },
];

const ELEM_CLASS = { 木: 'is-mu', 火: 'is-huo', 土: 'is-tu', 金: 'is-jin', 水: 'is-shui' };
const LUCK_CLASS = { ji: 'is-ji', xiong: 'is-xiong' };

function textOf(value){
	if(value === null || value === undefined || value === ''){ return ''; }
	return `${value}`;
}

class WuZhaoBoard extends Component{
	constructor(props){
		super(props);
		this.boardRef = React.createRef();
		this.getPopupContainer = this.getPopupContainer.bind(this);
	}

	// 🔴 Popover 必须挂进兆图容器:挂 body 时切页/冻结 pane 会留幽灵浮层。
	getPopupContainer(){
		return this.boardRef.current || document.body;
	}

	// 外环某支上所有神煞、行神、空亡与纳甲落位。
	// 🔴 行神须与乡盒同受「六神显示」档位管辖:只管住乡盒而外环照挂一圈行神徽章,
	// 就是「选了游宫六神却还看得见行神」的半死开关。
	collectBranch(branch){
		const { classic, beastView } = this.props;
		const hits = [];
		if(!classic){ return hits; }
		const showXingshen = beastView !== 'yougong';
		(classic.shensha && classic.shensha.items ? classic.shensha.items : []).forEach((item)=>{
			if(item.branch === branch){
				hits.push({ kind: 'shensha', label: item.name, detail: item.text || '' });
			}
			if(item.branches){
				Object.keys(item.branches).forEach((key)=>{
					if(item.branches[key] === branch){
						hits.push({ kind: 'shensha', label: `${key}${item.name}`, detail: item.text || '' });
					}
				});
			}
		});
		if(showXingshen){
			(classic.xingshen && classic.xingshen.rows ? classic.xingshen.rows : []).forEach((row)=>{
				if(row.branch === branch){
					const flags = row.flags && row.flags.length ? `·${row.flags.join('')}` : '';
					hits.push({ kind: 'xingshen', label: `行${row.beast}${flags}`, detail: row.sanchen || '' });
				}
			});
		}
		const kw = classic.najia && classic.najia.kongwang ? classic.najia.kongwang : null;
		if(kw && (kw.branches || []).indexOf(branch) >= 0){
			hits.push({ kind: 'kongwang', label: '空亡', detail: kw.text || '' });
		}
		return hits;
	}

	renderRingCell(item){
		const hits = this.collectBranch(item.branch);
		const kongwang = hits.some((hit)=>hit.kind === 'kongwang');
		const body = (
			<div key={item.branch} className={`horosa-wuzhao-ring-cell${kongwang ? ' is-kongwang' : ''}`}
				style={{ gridRow: item.row + 1, gridColumn: item.col + 1 }}>
				<strong>{item.branch}</strong>
				{hits.length ? (
					<div className="horosa-wuzhao-ring-badges">
						{hits.slice(0, 4).map((hit, idx)=>(
							<em key={`${hit.label}_${idx}`} className={`is-${hit.kind}`}>{hit.label}</em>
						))}
						{hits.length > 4 ? <em className="is-more">+{hits.length - 4}</em> : null}
					</div>
				) : null}
			</div>
		);
		if(!hits.length){ return body; }
		const content = (
			<div className="horosa-wuzhao-popover">
				{hits.map((hit, idx)=>(
					<div key={`${hit.label}_${idx}`}>
						<strong>{hit.label}</strong>
						{hit.detail ? <span>{hit.detail}</span> : null}
					</div>
				))}
			</div>
		);
		return (
			<Popover key={item.branch} content={content} title={`${item.branch}位`}
				getPopupContainer={this.getPopupContainer} placement="top">
				{body}
			</Popover>
		);
	}

	renderCell(cell){
		const { positions, classic, beastView } = this.props;
		const pos = positions[cell.index] || {};
		const cls = (classic && classic.positions ? classic.positions[cell.index] : null) || {};
		const isZhao = cell.index === 0;
		const xiangElem = cls.xiangElem || '';
		const zhiElem = cls.elem || pos.element || '';
		// 乡侧标乡五行之纳甲干、支侧标支五行之纳甲干:文档兆局图中土乡书「戊己」而其支为火,
		// 二者各有所纳,不可混用(曾把支的纳甲错标在乡侧)。
		const xiangNajia = ((cls.xiangNajia && cls.xiangNajia.length ? cls.xiangNajia : cls.najia) || [])
			.map((item)=>item.stem).join('');
		const zhiNajia = (cls.najia || []).map((item)=>item.stem).join('');
		const x13 = cls.xiang13 || {};
		const xingshenHits = cls.xingshen || [];
		const showYougong = beastView !== 'xingshen';
		const showXingshen = beastView !== 'yougong';
		return (
			<div key={cell.index}
				className={`horosa-wuzhao-cell ${ELEM_CLASS[xiangElem] || ''}${isZhao ? ' is-zhao' : ''}`}
				style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}>
				<div className="horosa-wuzhao-cell-head">
					<span>{cell.palace}宫</span>
					<b>{pos.label || cls.label || ''}</b>
				</div>
				<div className="horosa-wuzhao-cell-body">
					<div className="horosa-wuzhao-cell-xiang">
						{xiangNajia ? <em className="horosa-wuzhao-najia">{xiangNajia}</em> : null}
						<strong className={ELEM_CLASS[xiangElem] || ''}>{xiangElem || '—'}</strong>
						<span>{isZhao ? '本兆' : (cls.xiangRole || '')}</span>
						{showYougong && cls.beast ? <i className="horosa-wuzhao-beast">{cls.beast}</i> : null}
					</div>
					{isZhao ? null : (
						<div className="horosa-wuzhao-cell-zhi">
							{zhiNajia ? <em className="horosa-wuzhao-najia">{zhiNajia}</em> : null}
							<strong className={ELEM_CLASS[zhiElem] || ''}>{zhiElem || '—'}</strong>
							<span>{cls.role || pos.relation || ''}</span>
							{textOf(pos.number) ? <i className="horosa-wuzhao-num">{textOf(pos.number)}</i> : null}
						</div>
					)}
				</div>
				<div className="horosa-wuzhao-cell-foot">
					{x13.name ? <em className={`horosa-wuzhao-tag ${LUCK_CLASS[x13.luck] || ''}`}>{x13.name}</em> : null}
					{cls.fuyi ? <em className="horosa-wuzhao-tag">{cls.fuyi}</em> : null}
					{cls.wangshuai ? <em className="horosa-wuzhao-tag is-qi">{cls.wangshuai}</em> : null}
					{(pos.flags || []).map((flag)=><em key={flag} className="horosa-wuzhao-tag is-flag">{flag}</em>)}
					{(cls.kongwang || []).length ? <em className="horosa-wuzhao-tag is-kong">空亡</em> : null}
					{showXingshen && xingshenHits.map((hit)=>(
						<em key={hit.beast} className="horosa-wuzhao-tag is-xingshen">
							行{hit.beast}{hit.flags && hit.flags.length ? `·${hit.flags.join('')}` : ''}
						</em>
					))}
				</div>
			</div>
		);
	}

	renderNajiaBand(){
		const { classic } = this.props;
		const najia = classic && classic.najia ? classic.najia : null;
		if(!najia || !najia.xunTable){ return null; }
		const table = najia.xunTable;
		const stems = Object.keys(table);
		if(!stems.length){ return null; }
		const kongwang = (najia.kongwang && najia.kongwang.branches) || [];
		// 乡与支两路纳甲都要标:只标支的话,土乡的乡纳甲(戊己)会显得没用到,
		// 而神煞、行神、空亡的命中本来就两路同查。
		const used = {};
		const mark = (gz, label)=>{
			if(!gz){ return; }
			if(used[gz] && used[gz].indexOf(label) < 0){ used[gz] = `${used[gz]}·${label}`; }
			else if(!used[gz]){ used[gz] = label; }
		};
		(classic.positions || []).forEach((pos, idx)=>{
			const isZhao = (pos.index !== undefined ? pos.index : idx) === 0;
			// 兆位的乡纳甲与支纳甲本是同一组,只标一次免出「兆乡·兆」重复标签
			// 乡侧标位名本身、支侧标「位名+支」——与右栏纳甲段的「乡土：…／支火：…」同措辞
			if(!isZhao){
				(pos.xiangNajia || []).forEach((item)=>mark(item.gz, pos.label));
			}
			(pos.najia || []).forEach((item)=>mark(item.gz, isZhao ? pos.label : `${pos.label}支`));
		});
		return (
			<div className="horosa-wuzhao-najia-band">
				<div className="horosa-wuzhao-najia-title">{najia.xun || '—'}</div>
				<div className="horosa-wuzhao-najia-list">
					{stems.map((stem)=>{
						const branch = table[stem];
						const gz = `${stem}${branch}`;
						const owner = used[gz];
						return (
							<div key={gz} className={`horosa-wuzhao-najia-item${owner ? ' is-used' : ''}`}>
								<strong>{gz}</strong>
								{owner ? <em>{owner}</em> : null}
							</div>
						);
					})}
					{kongwang.map((branch)=>(
						<div key={`kw_${branch}`} className="horosa-wuzhao-najia-item is-kongwang">
							<strong>{branch}</strong>
							<em>空亡</em>
						</div>
					))}
				</div>
			</div>
		);
	}

	render(){
		const { positions } = this.props;
		if(!positions || !positions.length){
			return <div className="horosa-huangji-empty">暂无五兆数据</div>;
		}
		return (
			<div className="horosa-wuzhao-classic-board" ref={this.boardRef}>
				<div className="horosa-wuzhao-grid">
					{RING.map((item)=>this.renderRingCell(item))}
					{CELLS.map((cell)=>this.renderCell(cell))}
				</div>
				{this.renderNajiaBand()}
			</div>
		);
	}
}

export default WuZhaoBoard;
