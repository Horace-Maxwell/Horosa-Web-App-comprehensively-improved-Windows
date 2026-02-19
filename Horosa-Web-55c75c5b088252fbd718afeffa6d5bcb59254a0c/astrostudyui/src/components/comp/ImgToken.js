import { Component } from 'react';
import { Input, } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr} from '../../utils/helper';


class ImgToken extends Component{

	constructor(props){
		super(props);

		this.state = {
			tokenImg: null,
		};

		this.changeInput = this.changeInput.bind(this);
		this.clickTokenImg = this.clickTokenImg.bind(this);
	}

	changeInput(e){
		if(this.props.onChange){
			this.props.onChange(e.target.value);
		}
	}

	async clickTokenImg(){
		let params = {};
		const data = await request(`${Constants.ServerRoot}/common/imgToken`, {
			body: JSON.stringify(params),
		});
		const Result = data[Constants.ResultKey]

		this.setState({
			tokenImg: 'data:image/jpeg;base64,' + Result.TokenImg,
		}, ()=>{
			if(this.props.onGetToken){
				this.props.onGetToken({
					tokenImg: 'data:image/jpeg;base64,' + Result.TokenImg,
					imgTokenListName: Result.ImgTokenListName,
				});
			}	
		});

	}

	componentDidMount(){
		this.clickTokenImg();
	}

	render(){
		return (
			<div>
				<Input placeholder="验证码" style={{ width: '50%' }} onChange={this.changeInput} value={this.props.value} />
				<img style={{ width: '49%', height: 32, marginTop: -5, marginLeft: '1%' }} 
					alt='点击获取验证码图片'
					onClick={this.clickTokenImg}
					src={this.state.tokenImg} />

			</div>
		)
	}

}

export default ImgToken;
