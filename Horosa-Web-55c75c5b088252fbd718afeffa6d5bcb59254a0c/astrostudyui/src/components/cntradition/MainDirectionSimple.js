import { Component } from 'react';
import { Row, Col, Card, Tabs, Divider, Popover} from 'antd';
import { randomStr } from '../../utils/helper';
import { BaZiMsg } from '../../msg/bazimsg';
import MDSDirect from './MDSDirect';
import MDSYear from './MDSYear';
import styles from '../../css/styles.less';


class MainDirectionSimple extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.genDoms = this.genDoms.bind(this);
	}


	genDoms(dirs){
		let dom = [];
		if(dirs && dirs.length){
			let sz = dirs.length;
			let span = Math.floor(24 / 8);
			for(let i=0; i<sz; i++){
				let dir = dirs[i];
				if(i !== 0 && (i % 8 == 0)) {
					let col = (
						<Col span={24} key={randomStr(8)}><hr /></Col>
					);
					dom.push(col);
				}
				let col = (
					<Col span={span} key={randomStr(8)}>
						<Row>
							<Col span={24}><MDSDirect value={dir} /></Col>
						</Row>
						<Row>
							<Col span={24}><MDSYear value={dir} /></Col>
						</Row>						
					</Col>
				)
				dom.push(col)
			}
		}

		return dom;
	}

	render(){
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let doms = this.genDoms(rec.direction);

		return (
			<div className={styles.scrollbar} style={style}>
				<Row gutter={6}>
					{doms}
				</Row>
			</div>
		);
	}
}

export default MainDirectionSimple;


