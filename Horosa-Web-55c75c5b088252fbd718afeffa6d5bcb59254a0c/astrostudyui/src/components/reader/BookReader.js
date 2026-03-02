import { Component } from 'react';
import { message, Row, Col, Drawer, List, Typography, Button, Select, Dropdown, Menu, Slider, Popover} from 'antd';
import { UnorderedListOutlined, ZoomOutOutlined, ZoomInOutlined, DoubleRightOutlined, DoubleLeftOutlined, DatabaseOutlined, ToolOutlined, CustomerServiceOutlined, } from '@ant-design/icons';
import { ServerRoot } from '../../utils/constants';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import { requestRaw, } from '../../utils/request';
import { randomStr, launchFullScreen, exitFullScreen, checkFullScreen, selectText } from '../../utils/helper';
import { decryptRSA, } from '../../utils/rsahelper';
import { ColorTheme, ReaderThemeKey, ReaderFontSizeKey,ReaderScrollTopKey, ReaderBookKey, TTSOptKey,} from '../../constants/ReaderConst';
import styles from '../../css/styles.less';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;


class BookReader extends Component{

	constructor(props) {
		super(props);

		let sz = localStorage.getItem(ReaderFontSizeKey);
		if(sz === undefined || sz === null){
			sz = 18;
		}else{
			sz = parseInt(sz + '');
			if(sz > 30){
				sz = 30;
			}else if(sz < 18){
				sz = 18;
			}
		}

		let theme = localStorage.getItem(ReaderThemeKey);
		if(theme === undefined || theme === null){
			theme = ColorTheme[0];
		}else{
			theme = JSON.parse(theme);
		}

		let ttsopt = localStorage.getItem(TTSOptKey);
		if(ttsopt){
			ttsopt = JSON.parse(ttsopt);
			if(ttsopt.voice === undefined || ttsopt.voice === null){
				ttsopt.voice = 'pinyin-huang';
			}
		}else{
			ttsopt = {
				speed: 100,
				pitch: 0,
				voice: 'pinyin-huang',
				overlap: 0,
			};
		}

		this.state = {
			showCatalog: false,
			theme: theme,
			fontSize: sz,
			chapter: null,
			book: this.props.book,
			divId: 'div' + randomStr(8),
			cataId: 'cata' + randomStr(8),
			tts: false,
			ttsId: 'tts' + randomStr(8),
			ttsOpt: ttsopt,
			ttsText: null,
			ttsoptVisible: false,
			ttsoptVisibleDown: false,
		};

		this.chapterPos = [];
		this.lineNo = 0;

		this.readerHeight = 0;
		this.readerWidth = 0;
		this.orgHeight = 0;
		this.orgWidth = 0;
		this.fullScreen = false;

		this.timer = null;
		this.t1 = 0;
		this.t2 = 0;	

		this.openCatalog = this.openCatalog.bind(this);
		this.closeCatalog = this.closeCatalog.bind(this);
		this.genCatalogDom = this.genCatalogDom.bind(this);
		this.clickCatalog = this.clickCatalog.bind(this);
		this.prevChapter = this.prevChapter.bind(this);
		this.nextChapter = this.nextChapter.bind(this);
		this.sizeDown = this.sizeDown.bind(this);
		this.sizeUp = this.sizeUp.bind(this);

		this.requestChapter = this.requestChapter.bind(this);
		this.updateReadProgress = this.updateReadProgress.bind(this);
		this.genChapterDom = this.genChapterDom.bind(this);
		this.readLocalStorage = this.readLocalStorage.bind(this);
		this.genThemeSelector = this.genThemeSelector.bind(this);
		this.changeTheme = this.changeTheme.bind(this);
		this.toBookshelf = this.toBookshelf.bind(this);
		this.afterDrawVisible = this.afterDrawVisible.bind(this);
		this.doubleClick = this.doubleClick.bind(this);
		this.setupChapterPos = this.setupChapterPos.bind(this);
		this.touchHandle = this.touchHandle.bind(this);
		this.saveChapter = this.saveChapter.bind(this);
		this.handleResize = this.handleResize.bind(this);

		this.requestTTS = this.requestTTS.bind(this);
		this.clickTTS = this.clickTTS.bind(this);
		this.getLineNo = this.getLineNo.bind(this);
		this.getTTSText = this.getTTSText.bind(this);
		this.clickLine = this.clickLine.bind(this);
		this.ttsEnd = this.ttsEnd.bind(this);
		this.scrollToLine = this.scrollToLine.bind(this);

		this.genTTSOptDom = this.genTTSOptDom.bind(this);
		this.changePitch = this.changePitch.bind(this);
		this.changeSpeed = this.changeSpeed.bind(this);
		this.changeOverlap = this.changeOverlap.bind(this);
		this.hideTTSOpt = this.hideTTSOpt.bind(this);
		this.showTTSOpt = this.showTTSOpt.bind(this);
		this.changeVoice = this.changeVoice.bind(this);
		this.isScrollEnd = this.isScrollEnd.bind(this);
		this.handleScroll = this.handleScroll.bind(this);
	}

	readLocalStorage(bookid, ord){
		let str = localStorage.getItem(bookid);
		if(str){
			let rec = JSON.parse(str);
			let chapter = rec.chapter;
			if(chapter){
				if(bookid === chapter.bookId && ord === chapter.ord){
					const st = {
						chapter: chapter,
						showCatalog: false,
					};
			
					this.setState(st, ()=>{
						document.getElementById(this.state.divId).scrollTop = rec.scroll;
						this.lineNo = this.getLineNo();
					});
					return true;
				}
	
			}
		}
		return false;
	}

	async requestChapter(bookid, ord){
		const params = {
			BookId: bookid,
			Ord: ord,
		};

		const data = await request(`${Constants.ServerRoot}/astroreader/getchapter`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
		let chapter = result.Chapter;
		if(chapter){
			if(chapter.content){
				if(typeof chapter.content === 'string'){
					chapter.content = JSON.parse(chapter.content);
				}
				let rec = {
					chapter: chapter,
					scroll: 0,
				}
				localStorage.setItem(bookid, JSON.stringify(rec));	
			}
			this.props.book.currentOrd = ord;	
		}

		const st = {
			chapter: chapter,
			showCatalog: false,
			book: this.props.book,
		};

		this.setState(st, ()=>{
			this.updateReadProgress(bookid, ord);
			document.getElementById(this.state.divId).scrollTop = 0;
			this.lineNo = 0;
			if(this.state.tts){
				let txt = this.getTTSText(0);
				if(txt){
					this.setState({
						ttsText: txt,
					}, ()=>{
						this.requestTTS();
					});	
				}
			}	
		});
	}

	async updateReadProgress(bookid, ord){
		const params = {
			BookId: bookid,
			Ord: ord,
		};

		const data = await request(`${Constants.ServerRoot}/astroreader/readprogress`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
		result.Books.map((book, idx)=>{
			if(typeof book.catalog === 'string'){
				book.catalog = JSON.parse(book.catalog);
			}
		});
		let books = result.Books;

		this.props.book.currentOrd = ord;
		localStorage.setItem(ReaderBookKey, JSON.stringify(this.props.book));

		if(this.props.dispatch){
			this.props.dispatch({
				type: 'user/save',
				payload: {
					bookshelf: books,
				}
			})
		}
	}

	clickCatalog(rec){
		let book = this.props.book;
		if(book === undefined || book === null || rec === undefined || rec === null){
			this.setState({
				showCatalog: false,
			});
			return;
		}

		if(this.readLocalStorage(book.bookId, rec.ord)){
			return;
		}
		
		this.requestChapter(book.bookId, rec.ord);
	}

	prevChapter(){
		let book = this.props.book;
		if(book){
			let bookid = book.bookId;
			let ord = book.currentOrd;
			if(ord > 0){
				this.requestChapter(bookid, ord - 1);
			}
		}
	}

	nextChapter(){
		let book = this.props.book;
		if(book){
			let bookid = book.bookId;
			let ord = book.currentOrd;
			if(ord < book.catalog.length){
				this.requestChapter(bookid, ord + 1);
			}
		}		
	}

	sizeUp(){
		let sz = this.state.fontSize;
		let size = sz + 2;
		if(size > 30){
			size = 30;
		}
		localStorage.setItem(ReaderFontSizeKey, size);
		this.setState({
			fontSize: size,
		});
	}

	sizeDown(){
		let sz = this.state.fontSize;
		if(sz <= 18){
			return;
		}

		let size = sz - 2;
		localStorage.setItem(ReaderFontSizeKey, size);
		this.setState({
			fontSize: size,
		});
	}

	genChapterDom(){
		if(this.state.chapter === null){
			return null;
		}

		let chatper = this.state.chapter;

		let chappos = [];
		let parag = [];
		if(chatper.content){
			parag = chatper.content.map((item, idx)=>{
				let chapid = 'chap' + randomStr(8);
				chappos.push({id: chapid, pos: -1});

				if(idx === 0){
					return (
						<Title key={idx} id={chapid}
							style={{			
								backgroundColor: this.state.theme.bgColor,
								color: this.state.theme.color,
							}}
						>{item}</Title>
					)
				}

				return (
					<Paragraph key={idx} id={chapid}
						style={{			
							backgroundColor: this.state.theme.bgColor,
							color: this.state.theme.color,
							fontSize: this.state.fontSize,
						}}
					>
						{item}
					</Paragraph>
				)
			});
		}

		let dom = (
			<Typography>
				<Paragraph key={randomStr(8)}>
					&emsp;
					<span><Text onClick={this.prevChapter}><a href={null}>上一章</a></Text></span>
					<span style={{float: 'right'}}><Text onClick={this.nextChapter}><a href={null}>下一章</a></Text>&emsp;</span>
				</Paragraph>	
				{parag}
				<Paragraph key={randomStr(8)}>
					&emsp;
					<span><Text onClick={this.prevChapter}><a href={null}>上一章</a></Text></span>
					<span style={{float: 'right'}}><Text onClick={this.nextChapter}><a href={null}>下一章</a></Text>&emsp;</span>
				</Paragraph>	
			</Typography>
		);

		this.chapterPos = chappos;
		return dom;
	}

	openCatalog(){
		this.setState({
			showCatalog: true,
		});
	}

	closeCatalog(){
		this.setState({
			showCatalog: false,
		})
	}

	afterDrawVisible(visible){
		let chapter = this.state.chapter;
		if(chapter && visible){
			let cata = document.getElementById(this.state.cataId);
			let scroll = 38 * chapter.ord;
			if(scroll>0 && cata){
				cata.parentNode.scrollTop = scroll;
			}
		}
	}

	genCatalogDom(){
		if(this.props.book === undefined || this.props.book === null){
			return null;
		}

		let cata = this.props.book.catalog;

		let chapter = this.state.chapter;
		let theme = this.state.theme;
		
		let dom = (
			<List id={this.state.cataId}
				size="small"
				dataSource={cata}
				renderItem={(rec)=>{
					let style = {
						whiteSpace: 'nowrap', 
						textOverflow: 'ellipsis',
						overflowX: 'hidden',
					};
					let colorstyle = {};
					if(chapter && chapter.ord === rec.ord){
						style.backgroundColor = theme.bgColor;
						style.color = theme.color;				
						colorstyle.backgroundColor = theme.bgColor;
						colorstyle.color = theme.color;				
					}
					return (
						<List.Item key={rec.ord} onClick={()=>{ this.clickCatalog(rec); }}
							style={colorstyle}
						>
							<div style={style}>{rec.title}</div>
						</List.Item>
					)
				}}
			/>
		);

		return dom;
	}

	changeTheme(rec){
		localStorage.setItem(ReaderThemeKey, JSON.stringify(rec));
		this.setState({
			theme: rec,
		});
	}

	genThemeSelector(){
		let opts = ColorTheme.map((item, idx)=>{
			return (
				<Menu.Item key={idx}>
					<div 
						style={{
							width: '100%', 
							height: 20,
							backgroundColor: item.bgColor,
							color: item.color,
							textAlign: 'center',
						}}
						onClick={()=>{ this.changeTheme(item); }}
					>{item.bgColor}</div>
				</Menu.Item>
			);
		});

		let overlay = (
			<Menu>{opts}</Menu>
		)

		let dom = (
			<Dropdown 				
				size='small'
				menu={overlay} 
				trigger={['click', 'hover']}
			>
				<div
					style={{
						width: '100%',
						height: 20,
						backgroundColor: this.state.theme.bgColor,	
						color: this.state.theme.color,	
						textAlign: 'center',			
					}}
				>{this.state.theme.bgColor}</div>
			</Dropdown>
		);

		return dom;
	}

	toBookshelf(){
		if(this.props.toBookshelf){
			this.props.toBookshelf();
		}
	}

	doubleClick(){
		let divdom = document.getElementById(this.state.divId);
		if(divdom === undefined || divdom === null){
			return;
		}

		if(this.fullScreen){
			this.fullScreen = false;
			exitFullScreen();
			let w = this.readerWidth;
			let h = this.readerHeight;
			divdom.style.width = w + 'px';
			divdom.style.height = h + 'px';	
		}else{
			this.orgHeight = this.readerHeight;
			this.orgWidth = this.readerWidth;
			this.fullScreen = true;
			launchFullScreen(divdom);
			let w = window.screen.width;
			let h = window.screen.height;
			divdom.style.width = w + 'px';
			divdom.style.height = h + 'px';	
			this.flip = true;
		}
	}

	handleResize(){
		let divdom = document.getElementById(this.state.divId);
		if(divdom === undefined || divdom === null){
			return;
		}

		let w = divdom.clientWidth;
		let h = divdom.clientHeight;

		let flag = checkFullScreen();
		if(!this.fullScreen){
			this.readerWidth = w;
			this.readerHeight = h;	
		}else{
			if(flag){
				setTimeout(()=>{
					w = this.orgWidth;
					h = this.orgHeight;	
					if(this.flip){
						w = window.screen.width;
						h = window.screen.height;
						this.flip = false;
						this.waitEsc = true;
					}
					divdom.style.width = w + 'px';
					divdom.style.height = h + 'px';
				}, 100);
			}else{
				setTimeout(()=>{
					if(this.waitEsc){
						w = this.readerWidth;
						h = this.readerHeight;
						this.waitEsc = false;
					}
					divdom.style.width = w + 'px';
					divdom.style.height = h + 'px';
				}, 100);
			}
			return;
		}

	}

	isScrollEnd(){
		this.t2 = document.getElementById(this.state.divId).scrollTop;
		if(this.t2 === this.t1){
			this.saveChapter();
		}
	}

	handleScroll(e){
		clearTimeout(this.timer);
		this.timer = setTimeout(this.isScrollEnd, 1000);
		this.t1 = document.getElementById(this.state.divId).scrollTop;

		this.setupChapterPos(e);
	}

	setupChapterPos(e){
		if(this.chapterPos.length === 0){
			return;
		}

		if(this.chapterPos.length > 0){
			let item = this.chapterPos[0];
			if(item.pos >= 0){
				return;
			}
		}

		for(let i=0; i<this.chapterPos.length; i++){
			let item = this.chapterPos[i];
			let id = item.id;
			let div = document.getElementById(id);
			if(div === undefined || div === null){
				return;
			}
			item.pos = div.offsetTop;
		}
	}

	saveChapter(){
		if(this.props.book){
			let scroll = document.getElementById(this.state.divId).scrollTop;
			let rec = {
				chapter: this.state.chapter,
				scroll: document.getElementById(this.state.divId).scrollTop,
			}
			localStorage.setItem(this.props.book.bookId, JSON.stringify(rec));	
		}
	}

	touchHandle(e){
		this.saveChapter();
	}

	async requestTTS(){
		let txt = this.state.ttsText;
		if(txt === undefined || txt === null || txt === ''){
			return;
		}

		const params = {
			Text: txt,
			Speed: this.state.ttsOpt.speed,
			Pitch: this.state.ttsOpt.pitch,
			Voice: this.state.ttsOpt.voice,
			Overlap: this.state.ttsOpt.overlap,
		}

		const blob = await requestRaw(`${Constants.ServerRoot}/astroreader/tts`, {
			body: JSON.stringify(params),
		});

		let audio = document.getElementById(this.state.ttsId);
		if(audio){
			audio.pause();
			audio.type = "audio/mpeg";
			audio.src = window.webkitURL.createObjectURL(blob)|| URL.createObjectURL(blob);
			audio.currentTime = 0;
			audio.load();
			audio.play();
		}
	}

	getLineNo(){
		let scroll = document.getElementById(this.state.divId).scrollTop;
		for(let i=0; i<this.chapterPos.length; i++){
			let posobj = this.chapterPos[i];
			if(posobj.pos < 0){
				return 0;
			}
			if(posobj.pos >= scroll){
				return i;
			}
		}
		return 0;
	}

	scrollToLine(){
		if(this.lineNo >= this.chapterPos.length){
			return;
		}
		let line = this.chapterPos[this.lineNo];
		let chapterdiv = document.getElementById(line.id);
		line.pos = chapterdiv.offsetTop;
		let div = document.getElementById(this.state.divId);
		div.scrollTop = line.pos;
		this.saveChapter();
	}

	getTTSText(lineno){
		let no = lineno;
		if(lineno === undefined || lineno === null){
			no = 0;
		}
		let posobj = this.chapterPos[no];
		let txt = null;
		if(this.state.chapter){
			txt = this.state.chapter.content[no];	
			while(txt === undefined || txt === null || txt === ''){
				no++;
				if(no >= this.chapterPos.length){
					txt = null;
					break;
				}
				this.lineNo = no;
				posobj = this.chapterPos[no];
				txt = this.state.chapter.content[no];	
			}
			if(txt){
				selectText(posobj.id);	
				this.scrollToLine();	
			}
		}
		return txt;
	}

	clickLine(txt, idx){
		this.lineNo = idx;
		if(this.state.tts){
			let txt = this.getTTSText(idx);
			if(txt){
				this.setState({
					ttsText: txt,
				}, ()=>{
					this.requestTTS();
				});	
			}
		}
	}

	clickTTS(){
		this.setupChapterPos();
		let flag = !this.state.tts;

		let st = {tts: flag};
		if(flag && this.state.chapter){
			let lineno = this.getLineNo();
			this.lineNo = lineno;
			let txt = this.getTTSText(lineno);
			if(txt){
				st.ttsText = txt;
			}
			this.setState(st, ()=>{
				this.requestTTS();
			});	
		}else{
			this.setState(st);
		}
	}

	ttsEnd(e){
		this.lineNo++;
		let txt = this.getTTSText(this.lineNo);
		if(txt){
			this.setState({
				ttsText: txt,
			}, ()=>{
				this.requestTTS();
			});	
		}else{
			this.nextChapter();
		}
	}

	genTTSOptDom(){
		let dom = (
			<div>
			<Row>
				<Col span={24}>朗读速度</Col>
				<Col span={24}>
					<Slider max={300} min={-50} value={this.state.ttsOpt.speed} onChange={this.changeSpeed} />
				</Col>
			</Row>
			<Row>
				<Col span={24}>Pitch</Col>
				<Col span={24}>
					<Slider max={100} min={-100} value={this.state.ttsOpt.pitch} onChange={this.changePitch} />
				</Col>
			</Row>
			<Row>
				<Col span={24}>重叠阀值</Col>
				<Col span={24}>
					<Slider max={32766} min={0} value={this.state.ttsOpt.pitch} onChange={this.changeOverlap} />
				</Col>
			</Row>
			<Row>
				<Col span={24}>
					<Select size='small' style={{width: '100%'}} value={this.state.ttsOpt.voice} onChange={this.changeVoice}>
						<Option value='pinyin-huang'>男声</Option>
						<Option value='pinyin-yali'>女声</Option>
					</Select>
				</Col>
			</Row>
			<Row style={{marginTop: 5}}>
				<Col style={{textAlign: 'center'}} span={24}><a href={null} onClick={(e)=>{this.hideTTSOpt(0)}}>关闭</a></Col>
			</Row>
			</div>
		);

		return dom
	}

	changeSpeed(val){
		let opt = this.state.ttsOpt;
		opt.speed = val;
		localStorage.setItem(TTSOptKey, JSON.stringify(opt));
		this.setState({
			ttsOpt: opt,
		});
	}

	changePitch(val){
		let opt = this.state.ttsOpt;
		opt.pitch = val;
		localStorage.setItem(TTSOptKey, JSON.stringify(opt));
		this.setState({
			ttsOpt: opt,
		});
	}

	changeOverlap(val){
		let opt = this.state.ttsOpt;
		opt.overlap = val;
		localStorage.setItem(TTSOptKey, JSON.stringify(opt));
		this.setState({
			ttsOpt: opt,
		});
	}

	changeVoice(val){
		let opt = this.state.ttsOpt;
		opt.voice = val;
		localStorage.setItem(TTSOptKey, JSON.stringify(opt));
		this.setState({
			ttsOpt: opt,
		});
	}

	hideTTSOpt(num){
		this.setState({
			ttsoptVisible: false,
			ttsoptVisibleDown: false,
		});	
	}

	showTTSOpt(num){
		if(num === 0){
			this.setState({
				ttsoptVisible: true,
			});	
		}else{
			this.setState({
				ttsoptVisibleDown: true,
			});	
		}
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
		let readerdom = document.getElementById(this.state.divId);
		if(readerdom){
			this.readerWidth = readerdom.clientWidth;
			this.readerHeight = readerdom.clientHeight;
			this.orgWidth = this.readerWidth;
			this.orgHeight = this.readerHeight;
		}

		if(this.props.book){
			let bookid = this.props.book.bookId;
			let ord = this.props.book.currentOrd;

			if(this.readLocalStorage(bookid, ord)){
				return;
			}
	
			this.requestChapter(bookid, ord);
		}

	}

	componentWillUnmount(){
		window.removeEventListener('resize', this.handleResize);
		this.saveChapter();
	}

	render(){
		let height = this.props.height - 80;
		let style = {
			height: height + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
			padding: 5,
			backgroundColor: this.state.theme.bgColor,
			color: this.state.theme.color,
			fontSize: this.state.fontSize,
		};

		let catadom = this.genCatalogDom();
		let chapterdom = this.genChapterDom();
		let themeselector = this.genThemeSelector();

		let percent = 0;
		let words = null;
		if(this.state.chapter){
			percent = Math.round(this.state.chapter.percent * 1000) / 1000;
			percent = `${this.state.chapter.title} -- ${percent}`;
			words = `${this.state.chapter.words} 字`;
		}
		let title = null;
		if(this.state.book){
			title = this.state.book.name;
		}

		let ttsoptdom = this.genTTSOptDom();

		return (
			<div style={{marginLeft: 10}}>
				<Row gutter={16}>
					<Col span={2}>
						<UnorderedListOutlined onClick={this.openCatalog} />
					</Col>
					<Col span={2}>
						<DoubleLeftOutlined onClick={this.prevChapter} />
					</Col>
					<Col span={2}>
						<DoubleRightOutlined onClick={this.nextChapter} />
					</Col>
					<Col span={2}>
						<ZoomOutOutlined onClick={this.sizeDown} />
					</Col>
					<Col span={2}>
						<ZoomInOutlined onClick={this.sizeUp} />
					</Col>
					<Col span={1}>
						<CustomerServiceOutlined onClick={this.clickTTS} />
					</Col>
					<Col span={1}>
						<Popover
							title='TTS设置'
							trigger="click"
							content={ttsoptdom}
							open={this.state.ttsoptVisible}
						>
							<ToolOutlined onClick={(e)=>{this.showTTSOpt(0);}} />
						</Popover>
					</Col>

					<Col span={8}>
						{title}
					</Col>
					<Col span={3}>
						{themeselector}
					</Col>
					<Col span={1}>
						<DatabaseOutlined onClick={this.toBookshelf} />
					</Col>
				</Row>
				{
					this.state.tts && (
						<Row>
							<Col span={24}>
								<audio id={this.state.ttsId} controls
									style={{width: '100%'}}
									onEnded={this.ttsEnd}
								/>									
							</Col>
						</Row>
					)
				}
				<Row>
					<Col span={24}>
						<div className={styles.scrollbar} style={style} id={this.state.divId}
							onDoubleClick={(e)=>{
								setTimeout(()=>{
									this.doubleClick();
								}, 200);			
							}}
							onScroll={this.handleScroll}
							onTouchEnd={this.touchHandle}
						>
							{chapterdom}
						</div>
					</Col>
				</Row>
				<Row gutter={16} style={{marginTop: 5}}>
				<Col span={2}>
						<UnorderedListOutlined onClick={this.openCatalog} />
					</Col>
					<Col span={2}>
						<DoubleLeftOutlined onClick={this.prevChapter} />
					</Col>
					<Col span={2}>
						<DoubleRightOutlined onClick={this.nextChapter} />
					</Col>
					<Col span={2}>
						<ZoomOutOutlined onClick={this.sizeDown} />
					</Col>
					<Col span={2}>
						<ZoomInOutlined onClick={this.sizeUp} />
					</Col>
					<Col span={2}>
						<CustomerServiceOutlined onClick={this.clickTTS} />
					</Col>
					<Col span={2}>
						<Popover
							title='TTS设置'
							trigger="click"
							content={ttsoptdom}
							open={this.state.ttsoptVisibleDown}
						>
							<ToolOutlined onClick={(e)=>{this.showTTSOpt(1);}} />
						</Popover>
					</Col>
					<Col span={8} style={{textAlign: 'center'}}>
						{percent}% &nbsp; {words}
					</Col>
					<Col span={2}>
						<DatabaseOutlined onClick={this.toBookshelf} />
					</Col>
				</Row>

				<Drawer
					title='目录'
					width={520}
					placement="left"
					onClose={this.closeCatalog}
					afterVisibleChange={this.afterDrawVisible}
					maskClosable={true}
					destroyOnClose={true}
					open={this.state.showCatalog}
					style={{
						height: 'calc(100% - 0px)',
						overflow: 'auto',
						paddingBottom: 53,
						backgroundColor: 'transparent',
					}}        
				>
					{catadom}
				</Drawer>
			</div>
		)
	}
}

export default BookReader;

