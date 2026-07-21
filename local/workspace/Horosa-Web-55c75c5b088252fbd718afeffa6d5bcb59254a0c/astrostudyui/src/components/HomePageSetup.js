import { Component } from 'react';
import XQIcon from './xq-icons';
import { preloadNavByKey } from '../utils/navPreload';

const Pages = [{
	path: ['astrochart'],
	label: '占星',
	key: 'astrochart',
},{
	path: ['bazi'],
	label: '八字',
	key: 'bazi',
},{
	path: ['ziwei'],
	label: '紫微',
	key: 'ziwei',
},{
	path: ['astroreader'],
	label: '书籍阅读',
	key: 'astroreader',
}];

// 导航搜索匹配：模块标题 + 分组 + 模块内术法关键词（rec.keywords，见 pages/index.js navigationPages）。
// 空 query → 全部命中（默认行为不变）。导出供单测。
export function pageMatchesQuery(rec, query){
	const q = `${query || ''}`.trim().toLowerCase();
	if(!q){
		return true;
	}
	const hay = `${rec.label || ''} ${rec.group || ''} ${rec.keywords || ''}`.toLowerCase();
	return hay.indexOf(q) >= 0;
}

// 命中是靠 keywords（卡片标题不含 query）时，返回命中的那个术法词，供卡片标注「含 卜卦盘」让用户知道为何出现；
// 标题直接命中或无 query → 返回 ''（不标注）。
export function matchedKeyword(rec, query){
	const q = `${query || ''}`.trim().toLowerCase();
	if(!q || `${rec.label || ''}`.toLowerCase().indexOf(q) >= 0){
		return '';
	}
	const words = `${rec.keywords || ''}`.split(/\s+/).filter(Boolean);
	return words.find((w)=>w.toLowerCase().indexOf(q) >= 0) || '';
}


class HomePageSetup extends Component{

	constructor(props){
		super(props);

		this.state = {
			page: this.getInitialPage(props),
			activeGroup: null,
			searchValue: '',
		}

		this.searchInput = null;
		this.genDom = this.genDom.bind(this);
		this.clickPage = this.clickPage.bind(this);
		this.clickTools = this.clickTools.bind(this);
		this.changeSearch = this.changeSearch.bind(this);
		this.selectGroup = this.selectGroup.bind(this);
		this.focusSearch = this.focusSearch.bind(this);
	}

	componentDidMount(){
		this.focusSearch();
	}

	focusSearch(){
		if(this.searchInput){
			setTimeout(()=>{
				if(this.searchInput){
					this.searchInput.focus();
					this.searchInput.select();
				}
			}, 80);
		}
	}

	getInitialPage(props){
		const pages = props.pages && props.pages.length ? props.pages : Pages;
		const key = props.currentKey;
		const current = pages.find((rec)=>rec.key === key);
		return current || pages[0];
	}

		clickPage(rec){
			this.setState({
				page: rec,
		}, ()=>{
			if(this.props.onNavigate){
				this.props.onNavigate(rec.key);
			}
			if(this.props.onClose){
				this.props.onClose();
			}
			});
		}

		clickTools(){
			if(this.props.onOpenTools){
				this.props.onOpenTools();
				return;
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/openDrawer',
					payload: {
						key: 'commtools',
					},
				});
			}
		}

	changeSearch(e){
		this.setState({
			searchValue: e && e.target ? e.target.value : '',
		});
	}

	selectGroup(groupName){
		this.setState({
			activeGroup: groupName,
			searchValue: '',
		});
	}

	genDom(){
		const pages = this.props.pages && this.props.pages.length ? this.props.pages : Pages;
		const currentKey = this.props.currentKey || (this.state.page ? this.state.page.key : '');
		const currentPage = pages.find((rec)=>rec.key === currentKey) || this.state.page || pages[0];
		const currentGroup = this.state.activeGroup || (currentPage ? currentPage.group : null) || '命';
		const searchValue = `${this.state.searchValue || ''}`.trim();
		const visiblePages = searchValue ? pages.filter((rec)=>pageMatchesQuery(rec, searchValue)) : pages;
		const groupedPages = visiblePages.reduce((groups, rec)=>{
			const groupName = rec.group || '其他';
			if(!groups[groupName]){
				groups[groupName] = [];
			}
			groups[groupName].push(rec);
			return groups;
		}, {});
		const allGroupedPages = pages.reduce((groups, rec)=>{
			const groupName = rec.group || '其他';
			if(!groups[groupName]){
				groups[groupName] = [];
			}
			groups[groupName].push(rec);
			return groups;
		}, {});
		const groupOrder = ['命', '卜', '工具', '内容与管理', '其他'].filter((name)=>allGroupedPages[name]);
		const contentGroupOrder = searchValue ? groupOrder.filter((name)=>groupedPages[name]) : groupOrder;
		const railLabels = {
			'命': '命盘与推运',
			'卜': '易与三式',
			'工具': '工具工作台',
			'内容与管理': '内容与管理',
			'其他': '其他模块',
		};
		const railMarks = {
			'命': '命',
			'卜': '卜',
			'工具': '工',
			'内容与管理': '管',
			'其他': '其',
		};
		const recentKeys = [currentKey, 'aianalysis', 'sanshiunited'];
		const recentPages = recentKeys.map((key)=>pages.find((rec)=>rec.key === key)).filter(Boolean).filter((item, idx, arr)=>{
			return arr.findIndex((rec)=>rec.key === item.key) === idx;
		});
		
		let dom = (
			<>
				<div className="xq-nav-popup-header">
					<div className="xq-nav-popup-heading">
						<div className="xq-nav-popup-kicker">导航</div>
						<div className="xq-nav-popup-title">选择功能模块</div>
					</div>
					<label className="xq-nav-popup-search">
						<XQIcon name="search" />
						<input
							ref={(node)=>{ this.searchInput = node; }}
							value={this.state.searchValue}
							onChange={this.changeSearch}
							placeholder="搜索模块或术法"
						/>
						<kbd>⌘ K</kbd>
					</label>
					<button
						type="button"
						className="xq-nav-popup-close"
						onClick={this.props.onClose}
						aria-label="关闭导航"
					>
						×
					</button>
				</div>
				<div className="xq-nav-popup-body">
					<aside className="xq-nav-popup-rail">
						{groupOrder.map((groupName)=>(
							<button
								type="button"
								key={groupName}
								className={`xq-nav-rail-item ${currentGroup === groupName && !searchValue ? 'xq-nav-rail-item-active' : ''}`}
								onClick={()=>this.selectGroup(groupName)}
							>
								<span>{railMarks[groupName] || groupName.slice(0, 1)}</span>
								<span>{railLabels[groupName] || groupName}</span>
							</button>
						))}
						<div className="xq-nav-recent">
							<div className="xq-nav-recent-title">最近使用</div>
							{recentPages.map((rec)=>(
								<button type="button" className="xq-nav-recent-chip" key={rec.key} onClick={()=>this.clickPage(rec)} onMouseEnter={()=>preloadNavByKey(rec.key)}>
									{rec.label}
								</button>
							))}
						</div>
					</aside>
					<main className="xq-nav-popup-content">
						{contentGroupOrder.map((groupName)=>(
							<section className={`xq-nav-section xq-nav-section-${groupName}`} key={groupName}>
								<div className="xq-nav-section-title">{groupName}</div>
								<div className="xq-nav-card-grid">
									{(groupedPages[groupName] || []).map((rec)=>{
										const hit = searchValue ? matchedKeyword(rec, searchValue) : '';
										return (
											<button
												type="button"
												key={rec.key}
												className={`xq-nav-card ${currentKey === rec.key ? 'xq-nav-card-active' : ''}`}
												onClick={()=>{ this.clickPage(rec); }}
													onMouseEnter={()=>preloadNavByKey(rec.key)}
												title={hit ? `${rec.label} · 含 ${hit}` : rec.label}
											>
												<span className="xq-nav-card-label">
													<small>{rec.group || groupName}</small>
													<strong>{rec.label}</strong>
													{hit ? <em className="xq-nav-card-hit">含 {hit}</em> : null}
												</span>
											</button>
										);
									})}
									{groupName === '工具' ? (
										<div className="xq-nav-tool-launcher">
											<button
												type="button"
												className="xq-nav-tool-button"
												onClick={this.clickTools}
													onMouseEnter={()=>preloadNavByKey('commtools')}
											>
												<span>小工具</span>
											</button>
										</div>
									) : null}
								</div>
							</section>
						))}
						{contentGroupOrder.length === 0 ? (
							<div className="xq-nav-empty">没有找到匹配的模块</div>
						) : null}
						<div className="xq-nav-micro-note">高频入口支持搜索、分组扫视与最近使用</div>
					</main>
				</div>
			</>
		);
		return dom;
	}

	render(){
		let dom = this.genDom();
		return (
			<div className="xq-nav-popup-inner">
				{dom}
			</div>
		);
	}

}

export default HomePageSetup;
