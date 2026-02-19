import { Component } from 'react';
import { Row, Col, } from 'antd';
import { randomStr } from '../../utils/helper';
import styles from '../../css/styles.less';

class LogQryDetail extends Component{
	constructor(props) {
		super(props);
	}

	render(){
		let { record, } = this.props;
	
		if(record === undefined || record === null){
			record = {};
		}

		let height = this.props.height - 120;
		let style = {
			height: height + 'px',
			overflowY:'auto', 
			overflowX: 'auto',
		};
		
		const colTitleStyle = {
			textAlign:'right', 
		};
		const colContentStyle = {
			textAlign:'left', 
		};
		const rowStyle = {
			marginBottom: 10,
			width: '100%'
		};
		const titleColSpan = 4;
		const contentColSpan = 20;
		const gutter = 24;

		return (
			<div className={styles.scrollbar} style={style}>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>用户登录id</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.userid}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>用户名</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.username}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>交易时间</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.time}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>交易码</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.transcode}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>交易执行时间</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.transtm}毫秒</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>应用</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.app}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>渠道</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.channel}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>版本</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.ver}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>server</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.serverip}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>clientip</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.clientip}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>远程地址</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.remoteaddr}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>错误码</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.errcode}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>错误消息</Col>
					<Col span={contentColSpan} style={colContentStyle}>{record.errcode}</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>请求参数</Col>
					<Col span={contentColSpan} style={colContentStyle}>
						<pre>{JSON.stringify(record.params, null, 4)}</pre>
					</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>请求头</Col>
					<Col span={contentColSpan} style={colContentStyle}>
						<pre className={styles.scrollbar} style={{height: 300}}>
							{JSON.stringify(record.head, null, 4) }
						</pre>
					</Col>
				</Row>
				<Row gutter={gutter} style={rowStyle}>
					<Col span={titleColSpan} style={colTitleStyle}>响应头</Col>
					<Col span={contentColSpan} style={colContentStyle}>
						<pre className={styles.scrollbar} >{JSON.stringify(record.respheaders, null, 4)}</pre>
					</Col>
				</Row>
				{
					record.errstack && (
					<Row gutter={gutter} style={rowStyle}>
						<Col span={titleColSpan} style={colTitleStyle}>错误堆栈</Col>
						<Col span={contentColSpan} style={colContentStyle}>
							<pre className={styles.scrollbar} style={{height: 300}}>
								{record.errstack}
							</pre>
						</Col>
					</Row>
	
					)
				}
			</div>

		);
	
	}

}

export default LogQryDetail;
