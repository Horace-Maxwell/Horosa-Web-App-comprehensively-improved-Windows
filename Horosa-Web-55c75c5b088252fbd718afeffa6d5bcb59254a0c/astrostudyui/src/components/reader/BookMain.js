import { Component } from 'react';
import { Row, Col, Popconfirm, Button,  Input, Select, Tabs, } from 'antd';
import { EditOutlined, DeleteOutlined, SelectOutlined, UnorderedListOutlined } from '@ant-design/icons';
import {TableOddRowBgColor, ServerRoot, ResultKey} from '../../utils/constants';
import {randomStr} from '../../utils/helper';
import BookReader from './BookReader';
import BookList from './BookList';
import MyBookList from './MyBookList';
import BookUpload from './BookUpload';

const TabPane = Tabs.TabPane;

class BookMain extends Component{

	constructor(props) {
		super(props);

		this.currentDom = 'mybooklist';

		this.state = {
			book: null,
			domType: 0,
			hook: {
				mybooklist: {
					fun: null,
				},
				booklist: {
					fun: null,
				},
				bookreader: {
					fun: null,
				},
				bookupload: {
					fun: null,
				},
			}
		};

		this.selectBook = this.selectBook.bind(this);
		this.toBookshelf = this.toBookshelf.bind(this);
		this.toUpload = this.toUpload.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				let hook = this.state.hook[this.currentDom];
				if(hook.fun){
					hook.fun();
				} 
			};
		}
	}

	selectBook(rec){
		localStorage.setItem('readerBook', JSON.stringify(rec));
		this.setState({
			book: rec,
			domType: 1,
		});
	}

	toBookshelf(){
		this.setState({
			book: null,
			domType: 0,
		});
	}

	toUpload(){
		this.setState({
			book: null,
			domType: 2,
		});
	}

	render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 80;

		this.currentDom = 'mybooklist';
		let bookdom = (
			<MyBookList 
				height={height}
				userInfo={this.props.userInfo}
				dispatch={this.props.dispatch}
				selectBook={this.selectBook}
				toUpload={this.toUpload}
				hook={this.state.hook.mybooklist}
			/>
		);
		if(this.props.bookmgmt){
			this.currentDom = 'booklist';
			bookdom = (
				<BookList 
					height={height}
					userInfo={this.props.userInfo}
					dispatch={this.props.dispatch}
					selectBook={this.selectBook}
					toUpload={this.toUpload}
					hook={this.state.hook.booklist}
				/>
			);
		}

		let domtype = this.state.domType;

		if(domtype === 1 && this.state.book){
			this.currentDom = 'bookreader';
			bookdom = (
				<BookReader
					height={height}
					book={this.state.book}
					dispatch={this.props.dispatch}
					toBookshelf={this.toBookshelf}
				/>
			);
		}else if(domtype === 2){
			this.currentDom = 'bookupload';
			bookdom = (
				<BookUpload 
					height={height}
					dispatch={this.props.dispatch}
					toBookshelf={this.toBookshelf}
				/>
			);
		}


		return (
			<div>
				{bookdom}
			</div>
		)
	}

}

export default BookMain;



