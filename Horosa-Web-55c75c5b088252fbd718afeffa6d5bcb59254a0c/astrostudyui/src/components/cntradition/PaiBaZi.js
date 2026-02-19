import { Component } from 'react';
import { Row, Col, Divider, Button, } from 'antd';
import FourZhu from './FourZhu';
import { BaZiMsg } from '../../msg/bazimsg';
import { randomStr, printArea,} from '../../utils/helper';
import styles from '../../css/styles.less';


class PaiBaZi extends Component{
	constructor(props) {
		super(props);
		this.state = {
			id: 'div' + randomStr(8),
		};

		this.genDirDom = this.genDirDom.bind(this);
		this.genSubDirectDom = this.genSubDirectDom.bind(this);
	}

	genDirDom(dirs, directTime){
		let doms = [];
		if(dirs && dirs.length){
			for(let i = 0; i<dirs.length; i++){
				let dir = dirs[i];
				let age = dir.age;
				let startYear = dir.startYear;
				let mainDirect = dir.mainDirect;
				let subdir = this.genSubDirectDom(dir.subDirect, startYear, age, mainDirect, directTime);
				let maindirDom = (
					<div key={randomStr(8)}>
						<Divider orientation='left'>{startYear + ' ' + mainDirect.ganzi + ' ' + mainDirect.naying}</Divider>
						<Row>
							{subdir}
						</Row>
					</div>
				);
				doms.push(maindirDom);
			}	
		}

		return doms;
	}

	genSubDirectDom(dir, startYear, age, mainDirect, directTime){
		let dirdoms0 = [];
		let dirdoms1 = [];
		for(let i=0; i<dir.length; i++){
			let sub = dir[i];
			let y = startYear + i;
			let dirtm = y;
			let gancol = (<Col key={randomStr(8)} span={4}>{sub.ganzi}</Col>);
			let nayingcol = (<Col key={randomStr(8)} span={6}>{sub.naying}</Col>);
			let tmcol = (<Col key={randomStr(8)} span={14}>{dirtm}&emsp;{age + i}周岁</Col>);
			let dom = (
				<Col key={randomStr(8)} span={24}>
					<Row>
						{gancol}
						{nayingcol}
						{tmcol}
					</Row>
				</Col>
			);
			if(i < 5){
				dirdoms0.push(dom);
			}else{
				dirdoms1.push(dom);
			}
		}
		let row0 = (
			<Col key={randomStr(8)} span={12}>
				<Row>{dirdoms0}</Row>
			</Col>
		)
		let row1 = (
			<Col key={randomStr(8)} span={12}>
				<Row>{dirdoms1}</Row>
			</Col>
		)
		let dirdoms = [row0, row1];
		return dirdoms;
	}

	render(){
		let fields = this.props.fields ? this.props.fields : {};
		let name = fields.name ? fields.name.value : null;
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-100) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
			marginTop: 20,
		};

		let nongli = null;
		let realtm = null;
		let chef = null;
		let jiedelta = null;
		if(rec.nongli){
			let leap = rec.nongli.leap ? '闰' : '';
			nongli = `${rec.nongli.year}年${leap}${rec.nongli.month}${rec.nongli.day}`;
			realtm = '真太阳时:' + rec.nongli.birth;
			chef = rec.nongli.chef + '；';
			jiedelta = rec.nongli.jiedelta + '，';
		}

		let tiaohou = null;
		if(rec.tiaohou){
			tiaohou = '调候：' + rec.tiaohou.join('，');
		}

		let dirdoms = this.genDirDom(rec.direction, rec.directTime);

		return (
			<div className={styles.scrollbar} style={style} id={this.state.id}>
				<Row style={{marginBottom: 10}}>
					<Col span={20}>
						<span style={{fontSize: 16, fontWeight: 'bold'}}>{BaZiMsg[rec.gender]}</span>&nbsp;
						<span>{name}</span>&nbsp;
						<span>农历:</span>
						<span>{nongli}</span>&nbsp;
						<span>{realtm}</span><br />
						<span>{jiedelta}</span>
						<span>{chef}</span>&nbsp;
						<span>{tiaohou}</span>
					</Col>
					<Col span={4}>
						<a href={null} onClick={()=>{ printArea(this.state.id);}}>打印命盘</a>
					</Col>
				</Row>
				<FourZhu value={rec.fourColumns} baziOpt={this.props.baziOpt} gong12God={rec.gong12God} />
				<Divider />
				{dirdoms}
			</div>
		);
	}
}

export default PaiBaZi;
