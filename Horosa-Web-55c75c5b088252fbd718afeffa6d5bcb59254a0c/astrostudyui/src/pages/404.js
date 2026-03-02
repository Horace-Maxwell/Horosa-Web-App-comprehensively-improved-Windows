
import { useEffect } from 'react';
import { history } from 'umi';

export default ()=>{
	useEffect(()=>{
		const timer = setTimeout(()=>{
			const href = window.location.href || '';
			const hash = window.location.hash || '';
			const path = window.location.pathname || '';
			const isFile = window.location.protocol === 'file:';

			if(isFile){
				const entry = href.split('#')[0] || '';
				const base = entry.endsWith('/')
					? entry
					: entry.substring(0, entry.lastIndexOf('/') + 1);
				if(hash !== '#/'){
					window.location.replace(`${base}index.html#/`);
					return;
				}
			}

			if(hash && hash !== '#/'){
				window.location.replace('#/');
				return;
			}

			if(path && path !== '/'){
				window.location.replace('/');
				return;
			}

			history.replace('/');
		}, 80);
		return ()=>clearTimeout(timer);
	}, []);

	return (
		<div>
			<h2>404 page</h2>
			<p>路径不存在，正在返回首页...</p>
		</div>
	);
};
