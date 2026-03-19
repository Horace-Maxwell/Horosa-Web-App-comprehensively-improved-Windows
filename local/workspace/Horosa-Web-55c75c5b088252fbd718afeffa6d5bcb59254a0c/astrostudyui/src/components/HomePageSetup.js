import { Component } from 'react';
import { List, } from 'antd';
import { ColorTheme, ReaderThemeKey, } from '../constants/ReaderConst';
import { HomePageKey, } from '../utils/constants';

const Pages = [{
	path: ['astrochart'],
	label: '星盘',
	key: 'astrochart',
},{
	path: ['guolao'],
	label: '七政四余',
	key: 'guolao',
},{
	path: ['cntradition', 'bazi'],
	label: '八字',
	key: 'bazi',
},{
	path: ['cntradition', 'ziwei'],
	label: '紫微斗数',
	key: 'ziwei',
},{
	path: ['astroreader'],
	label: '书籍阅读',
	key: 'astroreader',
}];

function normalizeHomePageRecord(home){
	if(!home || typeof home !== 'object'){
		return {
			...Pages[0],
		};
	}
	let nextKey = home.key;
	if(nextKey === '1'){
		nextKey = 'astrochart';
	}
	const found = Pages.find((item)=>item.key === nextKey);
	if(found){
		return {
			...found,
		};
	}
	return {
		...Pages[0],
	};
}

function safeParseJson(text, fallback){
	if(text === undefined || text === null || text === ''){
		return fallback;
	}
	try{
		return JSON.parse(text);
	}catch(e){
		return fallback;
	}
}


function getColorTheme(){
	let theme = localStorage.getItem(ReaderThemeKey);
	if(theme === undefined || theme === null){
		theme = ColorTheme[0];
	}else{
		theme = safeParseJson(theme, ColorTheme[0]);
	}

	return theme;
}

class HomePageSetup extends Component{

	constructor(props){
		super(props);

		let home = localStorage.getItem(HomePageKey);
		home = normalizeHomePageRecord(safeParseJson(home, null));

		this.state = {
			page: home,
		}

		this.genDom = this.genDom.bind(this);
		this.clickPage = this.clickPage.bind(this);
	}

	clickPage(rec){
		this.setState({
			page: rec,
		}, ()=>{
			let json = JSON.stringify(rec);
			localStorage.setItem(HomePageKey, json);	
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/setHomePage',
					payload: rec,
				});
			}
		});
	}

	genDom(){
		let theme = getColorTheme();
		let home = this.state.page;
		
		let dom = (
			<List
				size='default'
				dataSource={Pages}
				renderItem={(rec)=>{
					let style = {
						whiteSpace: 'nowrap', 
						textOverflow: 'ellipsis',
						overflowX: 'hidden',
						marginLeft: 10
					};
					let colorstyle = {};
					if(home.key === rec.key){
						style.backgroundColor = theme.bgColor;
						style.color = theme.color;				
						colorstyle.backgroundColor = theme.bgColor;
						colorstyle.color = theme.color;				
					}
					return (
						<List.Item key={rec.idx} onClick={()=>{ this.clickPage(rec); }}
							style={colorstyle}
						>
							<div style={style}>{rec.label}</div>
						</List.Item>
					)
				}}
			/>
		);
		return dom;
	}

	render(){
		let dom = this.genDom();
		return (
			<div>
				{dom}
			</div>
		);
	}

}

export default HomePageSetup;
