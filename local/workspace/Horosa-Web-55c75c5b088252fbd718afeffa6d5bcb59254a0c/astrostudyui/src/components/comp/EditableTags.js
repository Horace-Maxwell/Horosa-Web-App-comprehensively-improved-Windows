import { Component } from 'react';
import { Tag, Input,  Popconfirm, } from 'antd';
import { PlusOutlined,  } from '@ant-design/icons';
import {randomStr} from '../../utils/helper';


class EditableTags extends Component{

	constructor(props){
		super(props);

		this.state = {
			inputVisible: false,
			inputValue: '',
			tagObjects: [],
		};

		this.showInput = this.showInput.bind(this);
		this.inputChange = this.inputChange.bind(this);
		this.closeTag = this.closeTag.bind(this);
		this.confirmInput = this.confirmInput.bind(this);
		this.saveInputRef = this.saveInputRef.bind(this);

		this.newTag = this.newTag.bind(this);
	}

	inputChange(e){
		this.setState({
			inputValue: e.target.value,
		});
	}

	showInput(){
		this.setState({
			inputVisible: true,
		}, ()=>this.input.focus());
	}

	closeTag(removedTag){	
		const tags = this.props.value.filter((tag)=>{
			if(tag.label !== undefined){
				return tag.label !== removedTag.label;
			}else{
				return tag !== removedTag;
			}
		});
		
		if(this.props.onChange){
			this.props.onChange(tags);
		}
	}

	newTag(editable, tag, index){
		const txt = tag.label === undefined ? tag : tag.label;

		let tagdom = (
			<Tag key={randomStr(8)} closable={editable}
				onClose={(e) => this.closeTag(tag)}
			>
				{txt}
			</Tag>
		);

		if(this.props.needConfirm){
			if(editable){
				tagdom = (
					<Popconfirm
						key={randomStr(8)} 
						title={`确定删除 ${txt} 吗？`}
						onConfirm={(e)=>this.closeTag(tag)}
					>
						<Tag key={randomStr(8)} closable={false}>
							{txt}
						</Tag>
					</Popconfirm>
	
				);				
			}else{
				tagdom = (
					<Tag key={randomStr(8)} closable={false}>
						{txt}
					</Tag>
				);
			}
		}

		return tagdom;
	}

	confirmInput(){
		const state = this.state;
		const inputValue = state.inputValue;		
		let tags = this.props.value;
		if(tags === undefined || tags === null){
			tags = [];
		}
		let found = false;
		let isObj = false;
		if (inputValue){			
			for(let i=0; i<tags.length; i++){
				let tag = tags[i];
				if(tag.label !== undefined){
					isObj = true;
					if(tag.label === inputValue){
						found = true;
						break;
					}
				}else{
					if(tag === inputValue){
						found = true;
						break;
					}
				}
			}
		}

		if(!found){
			if(isObj){
				tags = [...tags, {label: inputValue}];
			}else{
				tags = [...tags, inputValue];
			}	
		}

	
		this.setState({
			inputVisible: false,
			inputValue: '',
		});

		if(this.props.onChange){
			this.props.onChange(tags);
		}
	}

	saveInputRef(input){
		this.input = input;
	}

	render(){
		const { inputVisible, inputValue, } = this.state;
		const editable = this.props.editable === undefined ? true : this.props.editable;
		let realtags = this.props.value ? this.props.value : [];

		return (
			<div>
				{
					realtags.map((tag, index)=>{
						return this.newTag(editable, tag, index);
					})
				}
				{
					editable && inputVisible && (
						<Input 
							ref={this.saveInputRef}
							type='text'
							size='small'
							style={{width:100}}
							value={inputValue}
							onChange={this.inputChange}
							onBlur={this.confirmInput}
							onPressEnter={this.confirmInput}
						/>
					)
				}
				{
					editable && !inputVisible && (
						<Tag key={randomStr(8)} onClick={this.showInput} style={{ background: '#fff', borderStyle: 'dashed' }}>
							<PlusOutlined /> {this.props.newTagLabel}
						</Tag>
					)
				}
			</div>
		);
	}
}


export default EditableTags;