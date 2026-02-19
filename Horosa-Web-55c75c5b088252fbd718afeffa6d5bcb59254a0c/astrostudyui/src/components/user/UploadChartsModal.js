import { Component } from 'react';
import { Modal, Upload,  message, } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { ServerRoot } from '../../utils/constants';
import * as Constants from '../../utils/constants';
import { signRequest } from '../../utils/request';
import { randomStr } from '../../utils/helper';

const Dragger = Upload.Dragger;

class UploadChartsModal extends Component{

	constructor(props) {
		super(props);

		this.state = {
			visible: false,
			fileList: [],
			failList: null,
		};

		this.showModalHandler = this.showModalHandler.bind(this);
		this.hideModalHandler = this.hideModalHandler.bind(this);

		this.onChange = this.onChange.bind(this);
		this.beforeUpload = this.beforeUpload.bind(this);
	}

	showModalHandler(e) {
		if(e){
			e.preventDefault();
		}
		this.setState({
			visible: true,
		});
	}

	hideModalHandler(e) {
		if(e){
			e.stopPropagation();
		}
		this.setState({
			visible: false,
		});
	}

	beforeUpload(file){
		let fname = file.name;
		let parts = fname.split('.');
		let ext = parts[parts.length - 1];

		if(file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && 
			ext !== 'xlsx' && ext !== 'xls'){
			message.error('只能上传xlsx文件!');
			return false;
		}
		return true;
	}

	onChange(e){
		let list = e.fileList.filter((file)=>{
			if(file.response && file.response.ResultCode !== undefined){
				return file.response.ResultCode === 0;
			}
			let fname = file.name;
			let parts = fname.split('.');
			let ext = parts[parts.length - 1];
	
				return (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === 'xlsx' || ext === 'xls');
		});

       if(list && list.length && e.file && e.file.response && e.file.response.ResultCode !== undefined){
            if(e.file.response.ResultCode === 0){
				let res = e.file.response.Result;
				if(res.FailCount === 0){
					Modal.success({
						title: `星盘数据${e.file.name}上传成功`,
						content: `共处理${res.Total}条记录。`
					});
					if(this.props.onSuccess){
						this.props.onSuccess();
					}	
				}else{
					Modal.success({
						title: `星盘数据${e.file.name}上传成功，`,
						content: `成功处理${res.Total - res.FailCount}条记录，失败${res.FailCount}条记录。`
					});
					this.setState({
						failList: res.FailList,
					}, ()=>{
						if(this.props.onSuccess){
							this.props.onSuccess();
						}		
					});
				}
            }else{
                Modal.error({
					title: `星盘数据${e.file.name}上传失败`,
					content: e.file.response.Result,
				});
			}
			list = [];
		}
		
		this.setState({
			fileList: list,
		});	
	}


	render(){
		let uploadUrl = this.props.uploadUrl ? this.props.uploadUrl : ServerRoot + '/user/charts/import';
		if(this.props.type){
			uploadUrl = `${uploadUrl}?type=${this.props.type}`;
		}else{
			uploadUrl = `${uploadUrl}?type=0`;
		}
		
		let uploadheaders = {
			ClientChannel: Constants.ClientChannel,
			ClientApp: Constants.ClientApp,
			ClientVer: Constants.ClientVer,
			Token: localStorage.getItem('Token'),
			Signature: signRequest(),
		};
		if(this.props.headers){
			uploadheaders = {
				...this.props.headers,
				...uploadheaders,
			}
		}

		let failList = this.state.failList;
		let faildom = null;
		if(failList){
			faildom = failList.map((item, idx)=>{
				return (
					<span key={idx}>
						{item.name}&nbsp;
					</span>
				)
			});
		}

		return (
			<span>
				<span onClick={this.showModalHandler}>
					{ this.props.children }
				</span>
				<Modal open={this.state.visible} 
					onCancel={this.hideModalHandler}					
					onOk={this.clickOk}
					footer={null}
					width={800} title='星盘数据上传'
					bodyStyle={{height: 500, width:800}}
					>
					<div style={{ marginBottom: 20,}}>
						<Dragger 
							name={this.props.name ? this.props.name : 'uploadfile'} 
							multiple={false}
							action={uploadUrl}
							headers={uploadheaders}
							onChange={this.onChange}
							beforeUpload={this.beforeUpload}
							fileList={this.state.fileList}
						>
							<p className="ant-upload-drag-icon">
								<InboxOutlined />
							</p>
							<p className="ant-upload-text">点击或拖放文件到此区域进行上传</p>
							<p className="ant-upload-hint">选择含有星盘数据的xlsx文件</p>
							{ 
								failList && (
									<div>
									<p className="ant-upload-text">
										失败的记录：faildom
									</p>
									<p>
										{faildom}
									</p>	
									</div>
								)
							}
						</Dragger>,
					</div>

				</Modal>
			</span>

		);
	}
}

export default UploadChartsModal;

