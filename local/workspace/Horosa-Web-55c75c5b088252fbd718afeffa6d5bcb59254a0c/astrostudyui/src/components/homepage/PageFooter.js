import React from 'react';
import styles from './PageFooter.less';

function PageFooter(props){
	return (
		<div className={styles.globalFooter}>
			<span className={styles.copyright}>
				©2019&nbsp;
				<span>星阙<sup>TM</sup>&nbsp;&amp;&nbsp;astrostudy</span>
				<span className={styles.footerSep}>·</span>
				<a href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=50019002501591&token=2be051c1-22dd-44ec-9f4b-d41155f2d855" target="_blank" rel="noreferrer">渝公网安备 50019002501591号</a>
				<span className={styles.footerSep}>·</span>
				<a href="http://www.miitbeian.gov.cn" target="_blank" rel="noreferrer">渝ICP备19003118号-1</a>
			</span>
		</div>
	);
}

export default PageFooter;
