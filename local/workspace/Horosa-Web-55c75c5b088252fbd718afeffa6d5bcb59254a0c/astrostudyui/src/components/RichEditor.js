import * as forge from 'node-forge';
import { Component, } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import styles from '../css/styles.less';


class RichEditor extends Component{

	constructor(props){
		super(props);

		this.state = {

		};

		this.onChange = this.onChange.bind(this);
	}

	onChange(val){
		if(this.props.onChange){
			this.props.onChange(val);
		}
	}

	componentDidMount(){

	}


	render(){
		let height = this.props.height ? this.props.height : 400;
		let edheight = height - 20;
		let readonly = this.props.readOnly ? true : false;
		let val = this.props.value ? this.props.value : '';

		return (
			<div className={styles.scrollbar} style={{height: height, borderStyle:'inset'}}>
				<ReactQuill style={{height: edheight}}
					theme="snow" 
					readOnly={readonly}
					placeholder={this.props.placeholder}
					value={val}
					onChange={this.onChange}
				/>
			</div>
		);
	}
}


export default RichEditor;
