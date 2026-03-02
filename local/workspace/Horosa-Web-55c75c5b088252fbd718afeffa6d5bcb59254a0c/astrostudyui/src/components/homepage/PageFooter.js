import React from 'react';
import { Menu, Dropdown, Row, Col, } from 'antd';
import styles from './PageFooter.less';
import beian from '../../assets/beian.png';

function PageFooter(props){

	return (
		<div className={styles.globalFooter}>
			<Row>
				<Col span={24}>
					<span className={styles.copyright}>
						©2019 &nbsp; 
						<span>星阙<sup>TM</sup>&nbsp;&amp;&nbsp;astrostudy</span>&nbsp;
					</span>
				</Col>
				<Col span={24}>
					<span className={styles.copyright} style={{fontSize: 10}}>
						<span>
							<img 
								style={{width:20, height: 20}}
								alt='备案标识'
								src={beian}
							/>
							<a href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=50019002501591&token=2be051c1-22dd-44ec-9f4b-d41155f2d855" target='_blank'>渝公网安备 50019002501591号</a>
						</span>
						&nbsp;  &nbsp;
						<span><a href="http://www.miitbeian.gov.cn" target='_blank'>渝ICP备19003118号-1</a></span>
						&emsp;
						<a href="https://996.icu" target='_blank'><img src="https://img.shields.io/badge/link-996.icu-red.svg" alt="996.icu" /></a>
					</span>
				</Col>
			</Row>
		</div>
	);
}

export default PageFooter;