import { Component } from 'react';
import { Upload, message, Row, Col, Select, Input} from 'antd';
import Modal from 'drag-modal';
import { DatabaseOutlined, InboxOutlined, } from '@ant-design/icons';
import { ServerRoot } from '../../utils/constants';
import * as Constants from '../../utils/constants';
import { signRequest, downloadUrl } from '../../utils/request';
import { randomStr } from '../../utils/helper';
import { decryptRSA, } from '../../utils/rsahelper';
import { Button } from 'antd-mobile';

const Dragger = Upload.Dragger;
const { Option } = Select;

class BookUpload extends Component{

	constructor(props) {
		super(props);

		this.state = {
			fileList: [],
			failUrl: null,
			encode: 'UTF-8',
			name: null,
			author: null,
		};

		this.onChange = this.onChange.bind(this);
		this.beforeUpload = this.beforeUpload.bind(this);
		this.uploaded = this.uploaded.bind(this);
		this.toBookshelf = this.toBookshelf.bind(this);
		this.changeEncode = this.changeEncode.bind(this);
		this.changeBookName = this.changeBookName.bind(this);
		this.changeBookAuthor = this.changeBookAuthor.bind(this);
	}


	beforeUpload(file){
		let parts = file.name.split('.');
		let ext = parts[parts.length - 1];
		if(file.type !== 'text/plain' && ext !== 'txt'){
			message.error('只能上传文本文件，并且扩展名必须为txt!');
			return false;
		}
		return true;
	}

	uploaded(books){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'user/save',
				payload: {
					bookshelf: books,
				}
			});
		}
	}

	onChange(e){
		let list = e.fileList.filter((file)=>{
			if(file.response && file.response.ResultCode !== undefined){
				return file.response.ResultCode === 0;
			}
			let parts = file.name.split('.');
			let ext = parts[parts.length - 1];
			return file.type === 'text/plain' && ext === 'txt';
		});

        if(e.file && e.file.response){
			let resp = e.file.response;
			if(Constants.NeedEncrypt){
				let plain = decryptRSA(resp);
				resp = JSON.parse(plain);
			}
            if(resp.ResultCode === 0){
				let res = resp.Result;
				Modal.success({
					title: `书籍${e.file.name}上传成功`,
					content: `现共有${res.Books.length}本书籍。`
				});
				if(this.props.onSuccess){
					this.uploaded(res.Books);
				}	
			}else{
                Modal.success({
					title: `书籍${e.file.name}上传失败`,
					content: resp.Result,
				});
			}
		}
		
		this.setState({
			fileList: list,
		});	
	}

	toBookshelf(){
		if(this.props.toBookshelf){
			this.props.toBookshelf();
		}
	}

	changeEncode(val){
		this.setState({
			encode: val,
		});
	}

	changeBookName(e){
		this.setState({
			name: e.target.value,
		});
	}

	changeBookAuthor(e){
		this.setState({
			author: e.target.value,
		});
	}

	render(){
		let uploadUrl = this.props.uploadUrl ? this.props.uploadUrl : ServerRoot + '/astroreader/upload';
		
		let body = {
			Encode: this.state.encode,
			Name: this.state.name,
			Author: this.state.author,
		};
		uploadUrl = downloadUrl(uploadUrl, {
			body: JSON.stringify(body),
		});

		let height = this.props.height - 300;

		return (
			<div>
				<Row gutter={8}>
					<Col span={3} style={{textAlign: 'right'}}>上传的文本编码</Col>
					<Col span={4}>
						<Select value={this.state.encode} onChange={this.changeEncode} style={{width: '100%'}} size='small'>
							<Option value='UTF-8'>UTF-8</Option>
							<Option value='GBK'>GBK</Option>
							<Option value='GB2312'>GB2312</Option>
						</Select>
					</Col>
					<Col span={4}>
						<Input placeholder='书名' value={this.state.name} onChange={this.changeBookName} style={{width: '100%'}} size='small'/>
					</Col>
					<Col span={4}>
						<Input placeholder='作者' value={this.state.author} onChange={this.changeBookAuthor} style={{width: '100%'}} size='small'/>
					</Col>
				</Row>
				<div style={{ height: height, marginTop: 10}}>
					<Dragger 
						name={this.props.name ? this.props.name : 'uploadfile'} 
						multiple={false}
						action={uploadUrl}
						onChange={this.onChange}
						beforeUpload={this.beforeUpload}
						fileList={this.state.fileList}
					>
						<p className="ant-upload-drag-icon">
							<InboxOutlined />
						</p>
						<p className="ant-upload-text">点击或拖放文件到此区域进行上传</p>
						<p className="ant-upload-hint">请尽量选择UTF-8编码的文本文件。若非UTF-8编码的文件，请先正确选择文本编码后，再上传文件。</p>
					</Dragger>
				</div>
				<div style={{marginTop: 50}}>
					<Row>
						<Col offset={8} span={8}>
							<Button onClick={this.toBookshelf}><DatabaseOutlined />我的书架</Button>
						</Col>
					</Row>
				</div>
			</div>

		);
	}
}

export default BookUpload;

