import { Component } from 'react';
import numeral from 'numeral';
import { Row, Col, Popconfirm } from 'antd';
import {TableOddRowBgColor, ServerRoot, ResultKey} from '../../utils/constants';
import request from '../../utils/request';
import {downloadUrl} from '../../utils/request';
import { XQButton, XQInput, XQModal, XQPagination, XQSearch, XQTable } from '../xq-ui';
import XQIcon from '../xq-icons';

import { getLayoutViewportHeight } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
class MyBookList extends Component{

	constructor(props) {
		super(props);
		this.state = {
			name: null,
			pageSize: 50,
			pageIndex: 1,
			total: 0,
			books: [],
			book: null,
			editVisible: false,
		};

		this.clickAdd = this.clickAdd.bind(this);
		this.clickEdit = this.clickEdit.bind(this);
		this.clickRemove = this.clickRemove.bind(this);
		this.clickInfo = this.clickInfo.bind(this);
		this.genDownloadUrl = this.genDownloadUrl.bind(this);
		this.searchByName = this.searchByName.bind(this);

		this.changeShowSize = this.changeShowSize.bind(this);
		this.showTotal = this.showTotal.bind(this);
		this.changePage = this.changePage.bind(this);

		this.hideModalHandler = this.hideModalHandler.bind(this);
		this.saveBook = this.saveBook.bind(this);
		this.changeName = this.changeName.bind(this);
		this.changeAuthor = this.changeAuthor.bind(this);

		this.requestBooks = this.requestBooks.bind(this);
		this.requestRemoveBook = this.requestRemoveBook.bind(this);
		this.requestSaveBook = this.requestSaveBook.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				this.requestBooks();
			}
		}
	}

	async requestBooks(){
		const params = {
			PageSize: this.state.pageSize,
			PageIndex: this.state.pageIndex,
			Name: this.state.name,
		};
		const data = await request(`${ServerRoot}/astroreader/listbooks`, {
			body: JSON.stringify(params),
		});
		const result = data[ResultKey];
		result.Books.map((item, idx)=>{
			if(typeof item.catalog === 'string'){
				// 单本坏 catalog 不拖垮整个列表(与 models/user.js parseBookCatalogs 同口径)。
				try{ item.catalog = JSON.parse(item.catalog); }catch(e){ item.catalog = []; }
			}
		});

		this.setState({
			books: result.Books,
			total: result.Total,
			editVisible: false,
		});
	}

	async requestSaveBook(){
		let book = this.state.book;
		if(book === undefined || book === null){
			return;
		}
		const params = {
			BookId: book.bookId,
			Name: book.name,
			Author: book.author,
		};
		const data = await request(`${ServerRoot}/astroreader/updatebook`, {
			body: JSON.stringify(params),
		});
		const result = data[ResultKey];

		this.requestBooks();
	}

	async requestRemoveBook(rec){
		const params = {
			BookId: rec.bookId,
		};
		const data = await request(`${ServerRoot}/astroreader/deletebook`, {
			body: JSON.stringify(params),
		});
		const result = data[ResultKey];

		this.requestBooks();
	}

	changeShowSize(current, pSize){
		this.setState({
			PageIndex: 1, 
			PageSize: pSize,	
		}, ()=>{
			this.requestBooks();
		});
	}

	showTotal(total, range){
		return (
			<span>
				总共：{this.state.total}&nbsp;条记录
			</span>
		);
	}

	changePage(page, pSize){
		this.setState({
			PageIndex: page, 
			PageSize: pSize,	
		}, ()=>{
			this.requestBooks();
		});
	}

	hideModalHandler(){
		this.setState({
			editVisible: false,
		});
	}

	saveBook(){		
		this.requestSaveBook();
	}

	changeName(e){
		let val = e.target.value;
		let book = this.state.book;
		book.name = val;
		this.setState({
			book: book,
		});
	}

	changeAuthor(e){
		let val = e.target.value;
		let book = this.state.book;
		book.author = val;
		this.setState({
			book: book,
		});		
	}

	clickAdd(){
		if(this.props.toUpload){
			this.props.toUpload();
		}
	}

	clickEdit(rec){
		this.setState({
			book: rec,
			editVisible: true,
		});
	}

	clickRemove(rec){
		this.requestRemoveBook(rec);
	}

	clickInfo(rec){
		if(this.props.selectBook){
			this.props.selectBook(rec);
		}
	}

	genDownloadUrl(rec){
		let body = {
			BookId: rec.bookId,
		};

		let url = downloadUrl(`${ServerRoot}/astroreader/exportbook`, {
			body: JSON.stringify(body)
		}, true);
		return url;
	}

	searchByName(value, evt){
		this.setState({
			name: value,
		}, ()=>{
			this.requestBooks();
		});
	}

	componentDidMount(){
		this.requestBooks();
	}

	render(){
		let columns = [{
			title: '书名',
			dataIndex: 'name',
			key: 'name',
			width: '20%',
		},{
			title: '作者',
			dataIndex: 'author',
			key: 'author',
			width: '20%',
		},{
			title: '章节数',
			dataIndex: 'chapters',
			key: 'chapters',
			width: '15%',
			render: (text, record, index)=>{
				return numeral(text).format('0,0');
			},
		},{
			title: '总字数',
			dataIndex: 'words',
			key: 'words',
			width: '15%',
			render: (text, record, index)=>{
				return numeral(text).format('0,0');
			},
		},{
			title: '当前章节',
			dataIndex: 'currentOrd',
			key: 'currentOrd',
			width: '15%',
			render: (text, record, index)=>{
				let books = this.state.books;
				if(books && books.length){
					let book = books[index];
					let cata = book.catalog[book.currentOrd];
					if(cata){
						return cata.title;
					}
				}
				return null;
			}
		},{
			title: '操作',
			key: 'Action',
			render: (text, record, index)=>{
				let dom = (
					<span>
						<a href={null} onClick={()=>{this.clickInfo(record);}}><XQIcon name="select" /></a>&emsp;
					</span>
				);

				if(this.props.userInfo && this.props.userInfo.uid === record.user){
					let url = this.genDownloadUrl(record);
					dom = (
						<span>
							<a href={null} onClick={()=>{this.clickInfo(record);}}><XQIcon name="select" /></a>&emsp;
							<a href={null} onClick={()=>{this.clickEdit(record);}}><XQIcon name="edit" /></a>&emsp;
							<Popconfirm title={`确定删除书籍：${record.name} 吗?`} onConfirm={()=>{this.clickRemove(record);}}>
								<a href={null} ><XQIcon name="delete" /></a>
							</Popconfirm>&emsp;
							<a href={url} target='_blank'><XQIcon name="download" /></a>&emsp;
						</span>
					);
				}

				return dom;
			},
		}];

		let tbly = this.props.height ? this.props.height - 130 : getLayoutViewportHeight() - 130;

		let pageSize = this.state.pageSize;
		let pageIndex = this.state.pageIndex;
		let total = this.state.total;
		let ds = this.state.books;

		let book = this.state.book ? this.state.book : {};
		let title = '书籍编辑';
		if(book.name){
			title = `《${book.name}》编辑`;
		}

		return (
			<div style={{height: tbly}}>
				<XQModal open={this.state.editVisible}
					onCancel={this.hideModalHandler}
					onOk={this.saveBook}
					width={800} title={title}
					bodyStyle={{height: 500, width:800}}
				>
					<div>
						<Row gutter={16}>
							<Col span={8}>书名</Col>
							<Col span={8}><XQInput value={book.name} onChange={this.changeName} /></Col>
							<Col span={8}></Col>
						</Row>
						<Row gutter={16}>
							<Col span={8}>作者</Col>
							<Col span={8}><XQInput value={book.author} onChange={this.changeAuthor} /></Col>
							<Col span={8}></Col>
						</Row>
					</div>
				</XQModal>

				<Row gutter={12} style={{marginBottom: 10}}>
					<Col span={4}>
						<XQButton type="primary" onClick={this.clickAdd}>添加书籍</XQButton>
					</Col>

					<Col offset={10} span={10}>
						<XQSearch
							placeholder='以书名进行检索' enterButton
							onSearch={this.searchByName}
						/>
					</Col>
				</Row>
				<XQTable
					dataSource={ds} columns={columns}
					rowKey='shelfId'
					bordered size='small'
					scroll={{x: '100%', y: tbly }}
					pagination={false}
					onRow={(record, index)=>{
						let rowstyle = {};
						if(index % 2 === 1){
							rowstyle = {
								style: { backgroundColor: TableOddRowBgColor, },
							};
						}
						return {
							...rowstyle,
						}
					}}
				/>
				<XQPagination
					style={{marginTop:3, textAlign:'center',}}
					pageSizeOptions={['30', '50', '100']}
					showSizeChanger onShowSizeChange={this.changeShowSize}
					defaultPageSize={pageSize} defaultCurrent={pageIndex}
					total={total} showTotal={this.showTotal} onChange={this.changePage} />

			</div>
		);
	}
}

export default MyBookList;
