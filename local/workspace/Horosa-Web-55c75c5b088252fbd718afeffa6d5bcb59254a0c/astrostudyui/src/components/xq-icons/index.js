import React from 'react';

const lineProps = {
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.8,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
};

const boldLineProps = {
	...lineProps,
	strokeWidth: 2.2,
};

function Svg({children, viewBox = '0 0 24 24', className = '', ...rest}){
	return (
		<svg
			className={`xq-icon ${className}`}
			viewBox={viewBox}
			width="1em"
			height="1em"
			aria-hidden="true"
			focusable="false"
			{...rest}
		>
			{children}
		</svg>
	);
}

const iconMap = {
	navigation: (
		<Svg>
			<path {...lineProps} d="M4 11.4 12 4l8 7.4" />
			<path {...lineProps} d="M6.5 10.2V20h11V10.2" />
			<path {...lineProps} d="M9.5 20v-6h5v6" />
		</Svg>
	),
	database: (
		<Svg>
			<ellipse {...lineProps} cx="12" cy="6" rx="7" ry="2.6" />
			<path {...lineProps} d="M5 6v12c0 1.44 3.13 2.6 7 2.6s7-1.16 7-2.6V6" />
			<path {...lineProps} d="M5 12c0 1.44 3.13 2.6 7 2.6s7-1.16 7-2.6" />
		</Svg>
	),
	note: (
		<Svg>
			<path {...lineProps} d="M5 5.5h14v10.2H9.6L5 19.4z" />
			<path {...lineProps} d="M8.4 9h7.2M8.4 12.2h4.8" />
		</Svg>
	),
	tools: (
		<Svg>
			<path {...lineProps} d="M14.2 5.2a4 4 0 0 0 4.6 4.6L9.2 19.4 5 15.2z" />
			<path {...lineProps} d="m6.7 13.5 3.8 3.8" />
		</Svg>
	),
	newChart: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.5" />
			<path {...lineProps} d="M12 8v8M8 12h8" />
		</Svg>
	),
	aiExport: (
		<Svg>
			<path {...lineProps} d="M7 4.5h7l3 3V19.5H7z" />
			<path {...lineProps} d="M14 4.5V8h3" />
			<path {...lineProps} d="M9.4 13.2h5.2M9.4 16h3.7" />
		</Svg>
	),
	aiSettings: (
		<Svg>
			<path {...lineProps} d="M12 3.8v3M12 17.2v3M4.9 7.9l2.6 1.5M16.5 14.6l2.6 1.5M19.1 7.9l-2.6 1.5M7.5 14.6l-2.6 1.5" />
			<circle {...lineProps} cx="12" cy="12" r="3.2" />
		</Svg>
	),
	diagnostics: (
		<Svg>
			<path {...lineProps} d="M7 5.5h10v4.2a5 5 0 0 1 2 4.1c0 3.4-2.8 6.2-7 6.2s-7-2.8-7-6.2a5 5 0 0 1 2-4.1z" />
			<path {...lineProps} d="M9.2 5.5V3.8M14.8 5.5V3.8M8 11.5h8M8.2 15.2h7.6" />
		</Svg>
	),
	search: (
		<Svg>
			<circle {...lineProps} cx="10.5" cy="10.5" r="5.8" />
			<path {...lineProps} d="m15 15 4 4" />
		</Svg>
	),
	bookmark: (
		<Svg>
			<path {...lineProps} d="M7 4.8h10v14.4l-5-3.1-5 3.1z" />
		</Svg>
	),
	history: (
		<Svg>
			<path {...lineProps} d="M5.8 8.4a7.2 7.2 0 1 1-.8 5.1" />
			<path {...lineProps} d="M4.8 5.2v4h4" />
			<path {...lineProps} d="M12 8.2V12l3 2" />
		</Svg>
	),
	settings: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="3.1" />
			<path {...lineProps} d="M12 3.8v2.1M12 18.1v2.1M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M3.8 12h2.1M18.1 12h2.1M5.9 18.1l1.5-1.5M16.6 7.4l1.5-1.5" />
		</Svg>
	),
	// 星盘设置(盘面组件抽屉):天宫图双环 + 右下调节滑杆 —— 「盘上画什么」的面板语义。
	chartPanel: (
		<Svg>
			<circle {...lineProps} cx="10.4" cy="10.4" r="6.8" />
			<circle {...lineProps} cx="10.4" cy="10.4" r="3.2" />
			<path {...lineProps} d="M10.4 3.6v3.6M10.4 13.6v3.6M3.6 10.4h3.6M13.6 10.4h3.6" />
			<path {...lineProps} d="M15.2 17.6h6M18.9 15.9v3.4" />
			<circle {...lineProps} cx="18.9" cy="17.6" r="1.15" fill="currentColor" stroke="none" />
		</Svg>
	),
	// 相位设置:圆周三点连出三角相位线(合冲刑拱的几何本相)。
	aspectGeo: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.4" />
			<path {...lineProps} d="M12 3.6L4.9 16.2h14.2z" />
			<circle cx="12" cy="3.6" r="1.3" fill="currentColor" stroke="none" />
			<circle cx="4.9" cy="16.2" r="1.3" fill="currentColor" stroke="none" />
			<circle cx="19.1" cy="16.2" r="1.3" fill="currentColor" stroke="none" />
		</Svg>
	),
	// 容许度(orb):星点外的容许圈——内实点+中圈+外虚圈,由紧到松的度距语义。
	orbRange: (
		<Svg>
			<circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
			<circle {...lineProps} cx="12" cy="12" r="5.2" />
			<circle {...lineProps} cx="12" cy="12" r="8.6" strokeDasharray="2.6 3.4" />
		</Svg>
	),
	help: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.5" />
			<path {...lineProps} d="M9.6 9.4a2.6 2.6 0 1 1 3.2 2.5c-.7.3-.8.8-.8 1.7" />
			<path {...lineProps} d="M12 17.1h.1" />
		</Svg>
	),
	chevronDown: (
		<Svg>
			<path {...lineProps} d="m7 9.5 5 5 5-5" />
		</Svg>
	),
	clock: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.2" />
			<path {...lineProps} d="M12 7.5V12l3.1 1.9" />
		</Svg>
	),
	globe: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.2" />
			<path {...lineProps} d="M4 12h16M12 3.8c2.1 2.2 3.2 5 3.2 8.2S14.1 18 12 20.2M12 3.8C9.9 6 8.8 8.8 8.8 12s1.1 6 3.2 8.2" />
		</Svg>
	),
	sphere3d: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.2" />
			<ellipse {...lineProps} cx="12" cy="12" rx="8.2" ry="3.4" />
			<ellipse {...lineProps} cx="12" cy="12" rx="3.4" ry="8.2" />
		</Svg>
	),
	sliders: (
		<Svg>
			<path {...lineProps} d="M5 7h14M5 12h14M5 17h14" />
			<circle {...lineProps} cx="9" cy="7" r="1.7" />
			<circle {...lineProps} cx="15" cy="12" r="1.7" />
			<circle {...lineProps} cx="11" cy="17" r="1.7" />
		</Svg>
	),
	target: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.2" />
			<circle {...lineProps} cx="12" cy="12" r="4.4" />
			<circle cx="12" cy="12" r="1.4" fill="currentColor" />
		</Svg>
	),
	quickPrimary: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.4" />
			<circle {...lineProps} cx="12" cy="12" r="5.4" />
			<circle {...lineProps} cx="12" cy="12" r="2" />
			<path {...lineProps} d="M16.9 5.1a8.4 8.4 0 0 1 2.7 4.4" strokeDasharray="1 1.8" />
			<circle cx="19" cy="8.4" r="1.5" fill="currentColor" />
		</Svg>
	),
	quickFirdaria: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8" strokeDasharray="2.2 1.5" />
			<circle {...lineProps} cx="12" cy="12" r="5.1" />
			<path {...boldLineProps} d="M12 8.7V12l-2.5 2.3" />
			<path {...lineProps} d="M16.8 5.6a8 8 0 0 1 2.6 4" />
			<circle cx="19" cy="9.1" r="1.4" fill="currentColor" />
		</Svg>
	),
	quickProfection: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8" />
			<circle {...lineProps} cx="12" cy="12" r="5.4" strokeDasharray="1.4 1.7" />
			<circle {...lineProps} cx="12" cy="12" r="2.2" />
			<circle cx="12" cy="12" r="1" fill="currentColor" />
		</Svg>
	),
	quickReturn: (
		<Svg>
			<circle {...lineProps} cx="12" cy="10.8" r="4.5" />
			<path {...lineProps} d="M12 2.6v2.2M12 16.8V19M4.6 10.8h2.2M17.2 10.8h2.2M6.8 5.6l1.5 1.5M15.7 14.5l1.5 1.5M17.2 5.6l-1.5 1.5M8.3 14.5 6.8 16" />
			<path {...lineProps} d="M5.3 15.1a8.4 8.4 0 0 0 4.9 3.5" />
			<path {...lineProps} d="m5.3 15.1 3-.3M5.3 15.1l1.4-2.6M18.7 15.1a8.4 8.4 0 0 1-4.9 3.5" />
			<path {...lineProps} d="m18.7 15.1-3-.3M18.7 15.1l-1.4-2.6" />
		</Svg>
	),
	quickComposite: (
		<Svg>
			<circle {...lineProps} cx="9.2" cy="12" r="4.9" />
			<circle {...lineProps} cx="14.8" cy="12" r="4.9" />
		</Svg>
	),
	quickTransit: (
		<Svg>
			<ellipse {...lineProps} cx="12" cy="12" rx="8.6" ry="3.4" transform="rotate(-25 12 12)" />
			<path {...lineProps} d="M5.2 12.7a7 7 0 0 1 9.4-6.6" />
			<path {...lineProps} d="M18.8 11.3a7 7 0 0 1-9.4 6.6" />
		</Svg>
	),
	quickNote: (
		<Svg>
			<path {...lineProps} d="M7.3 4.8H17a1.5 1.5 0 0 1 1.5 1.5v10" />
			<path {...lineProps} d="M5.5 7h9.7a1.5 1.5 0 0 1 1.5 1.5v10.7H5.5z" />
			<path {...lineProps} d="M8.5 10.4h5.6M8.5 13.5h4.3" />
			<path {...lineProps} d="m13.7 18.2 4.2-4.2 1.8 1.8-4.2 4.2-2.3.5z" />
		</Svg>
	),
	quickAi: (
		<Svg>
			<path {...boldLineProps} d="M11.3 6.2 13 10.3l4.1 1.7-4.1 1.7-1.7 4.1-1.7-4.1L5.5 12l4.1-1.7z" />
			<path {...boldLineProps} d="M17.6 3.4l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
			<path {...boldLineProps} d="M6.8 4.6l.5 1.2 1.2.5-1.2.5L6.8 8l-.5-1.2-1.2-.5 1.2-.5z" />
		</Svg>
	),
	sidePlanets: (
		<Svg>
			<path {...lineProps} d="M12 6.2c2 0 3.6 1.6 3.6 3.6 0 2.8-3.6 5.2-3.6 5.2s-3.6-2.4-3.6-5.2c0-2 1.6-3.6 3.6-3.6z" />
			<path {...lineProps} d="M12 3.7v2.2M9.5 4.4l1.2 1.8M14.5 4.4l-1.2 1.8" />
			<path {...lineProps} d="M7.2 18.8c1.2-2 2.8-3 4.8-3s3.6 1 4.8 3" />
			<path {...lineProps} d="M5.7 18.8h12.6" />
		</Svg>
	),
	sideHouses: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="7.6" />
			<path {...lineProps} d="M4.7 12h14.6M12 4.4v15.2M7 6.6c2.8 1.6 5.5 3.4 10 10.8M17 6.6c-2.8 1.6-5.5 3.4-10 10.8" />
			<path {...lineProps} d="M8.8 18.8h6.4" />
		</Svg>
	),
	sideStyle: (
		<Svg>
			<path {...lineProps} d="m5.1 18.9 8.6-8.6" />
			<path {...lineProps} d="m10.7 7.3 6 6" />
			<path {...lineProps} d="m16.6 5 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" />
			<path {...lineProps} d="M6.7 6.2v3.2M5.1 7.8h3.2M8 12.7v2.4M6.8 13.9h2.4" />
		</Svg>
	),
	sideSwitch: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="3.1" />
			<path {...lineProps} d="M8.1 6.1a7.1 7.1 0 0 1 9.6 2.1" />
			<path {...lineProps} d="m17.7 8.2-3.1-.4M17.7 8.2l-.4-3.1M15.9 17.9a7.1 7.1 0 0 1-9.6-2.1" />
			<path {...lineProps} d="m6.3 15.8 3.1.4M6.3 15.8l.4 3.1" />
		</Svg>
	),
	plus: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.2" />
			<path {...lineProps} d="M12 8v8M8 12h8" />
		</Svg>
	),
	minus: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.2" />
			<path {...lineProps} d="M8 12h8" />
		</Svg>
	),
	theme: (
		<Svg>
			<path {...lineProps} d="M17.8 14.8A7 7 0 0 1 9.2 6.2 7 7 0 1 0 17.8 14.8z" />
			<path {...lineProps} d="M16 4.2v2.2M20.2 8.4H18M18.8 5.6l-1.6 1.6" />
		</Svg>
	),
	locastro: (
		<Svg>
			<path {...lineProps} d="M12 20.2s6-5.1 6-10.1A6 6 0 0 0 6 10.1c0 5 6 10.1 6 10.1z" />
			<circle {...lineProps} cx="12" cy="10.1" r="2.3" />
		</Svg>
	),
	user: (
		<Svg>
			<circle {...lineProps} cx="12" cy="8.6" r="3.3" />
			<path {...lineProps} d="M5.8 20a6.2 6.2 0 0 1 12.4 0" />
		</Svg>
	),
	lock: (
		<Svg>
			<rect {...lineProps} x="6.2" y="10.2" width="11.6" height="9" rx="1.6" />
			<path {...lineProps} d="M8.8 10.2V7.8a3.2 3.2 0 0 1 6.4 0v2.4" />
			<path {...lineProps} d="M12 14.1v2.1" />
		</Svg>
	),
	inbox: (
		<Svg>
			<path {...lineProps} d="M5.2 13.2 7.5 5h9l2.3 8.2v5.3H5.2z" />
			<path {...lineProps} d="M5.2 13.2h4.2a2.6 2.6 0 0 0 5.2 0h4.2" />
		</Svg>
	),
	astro: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.6" />
			<path {...lineProps} d="M12 3.4v17.2M3.4 12h17.2M5.9 5.9l12.2 12.2M18.1 5.9 5.9 18.1" opacity=".55" />
			<circle cx="12" cy="12" r="1.6" fill="currentColor" />
		</Svg>
	),
	direction: (
		<Svg>
			<path {...lineProps} d="M4 16.5 9 11l3.3 2.8L19.5 5.5" />
			<path {...lineProps} d="M15.5 5.5h4v4" />
		</Svg>
	),
	bazi: (
		<Svg>
			<rect {...lineProps} x="5" y="5" width="14" height="14" rx="1.2" />
			<path {...lineProps} d="M12 5v14M5 12h14" />
			<path {...lineProps} d="M8.2 8.2h.1M15.7 8.2h.1M8.2 15.8h.1M15.7 15.8h.1" />
		</Svg>
	),
	ziwei: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="7.5" />
			<path {...lineProps} d="M12 4.5v15M4.5 12h15" />
			<path {...lineProps} d="M12 8.2 14.1 12 12 15.8 9.9 12z" />
		</Svg>
	),
	qizheng: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.5" />
			<path {...lineProps} d="M12 4.8 14 12l-2 7.2L10 12zM4.8 12H19.2" />
		</Svg>
	),
	vedic: (
		<Svg>
			<rect {...lineProps} x="4" y="4" width="16" height="16" />
			<path {...lineProps} d="M4 12h16M12 4v16M4 4l16 16M20 4 4 20" opacity=".72" />
		</Svg>
	),
	aux: (
		<Svg>
			<path {...lineProps} d="M5 18V9M12 18V5M19 18v-6" />
			<path {...lineProps} d="M4 18h16" />
		</Svg>
	),
	composite: (
		<Svg>
			<circle {...lineProps} cx="9" cy="10" r="4.5" />
			<circle {...lineProps} cx="15" cy="14" r="4.5" />
		</Svg>
	),
	sanshi: (
		<Svg>
			<path {...lineProps} d="M12 3.8 19.1 8v8L12 20.2 4.9 16V8z" />
			<path {...lineProps} d="M12 3.8v16.4M4.9 8 19.1 16M19.1 8 4.9 16" />
		</Svg>
	),
	liureng: (
		<Svg>
			<path {...lineProps} d="M12 4.2 18.8 8v8L12 19.8 5.2 16V8z" />
			<circle {...lineProps} cx="12" cy="12" r="3" />
		</Svg>
	),
	qimen: (
		<Svg>
			<rect {...lineProps} x="4" y="4" width="16" height="16" />
			<path {...lineProps} d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" />
		</Svg>
	),
	liuyao: (
		<Svg>
			<path {...lineProps} d="M6 6h12M6 9.2h12M6 12.4h12M6 15.6h12M6 18.8h12" />
		</Svg>
	),
	taiyi: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="7.8" />
			<path {...lineProps} d="M12 4.2v15.6M4.2 12h15.6" />
			<path {...lineProps} d="M8.4 8.4h7.2v7.2H8.4z" />
		</Svg>
	),
	solstice: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="4.2" />
			<path {...lineProps} d="M12 3.8v2M12 18.2v2M3.8 12h2M18.2 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4" />
		</Svg>
	),
	fengshui: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.5" />
			<path {...lineProps} d="M12 6.2a5.8 5.8 0 0 0 0 11.6M12 6.2a2.9 2.9 0 0 1 0 5.8M12 12a2.9 2.9 0 0 0 0 5.8" />
		</Svg>
	),
	other: (
		<Svg>
			<path {...lineProps} d="M6 6h5v5H6zM13 6h5v5h-5zM6 13h5v5H6zM13 13h5v5h-5z" />
		</Svg>
	),
	ai: (
		<Svg>
			<path {...lineProps} d="M12 3.8 13.8 9l5.2 1.8-5.2 1.8L12 17.8l-1.8-5.2L5 10.8 10.2 9z" />
			<path {...lineProps} d="M18 4.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
		</Svg>
	),
	threeD: (
		<Svg>
			<path {...lineProps} d="M12 3.8 19 8v8l-7 4.2L5 16V8z" />
			<path {...lineProps} d="M12 12 5 8M12 12l7-4M12 12v8.2" />
		</Svg>
	),
	calendar: (
		<Svg>
			<rect {...lineProps} x="4.5" y="6" width="15" height="13.5" rx="1.5" />
			<path {...lineProps} d="M8 4.5V8M16 4.5V8M4.5 10h15" />
		</Svg>
	),
	support: (
		<Svg>
			<path {...lineProps} d="M5 7.5h14M5 12h14M5 16.5h14" />
			<path {...lineProps} d="M8 5v14M16 5v14" />
		</Svg>
	),
	book: (
		<Svg>
			<path {...lineProps} d="M5 5.5h6.2A2.8 2.8 0 0 1 14 8.3v10.2a2.8 2.8 0 0 0-2.8-2.8H5z" />
			<path {...lineProps} d="M19 5.5h-5a2.8 2.8 0 0 0-2.8 2.8" />
		</Svg>
	),
	live: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.5" />
			<path fill="currentColor" d="M10 8.2v7.6l5.8-3.8z" />
		</Svg>
	),
	admin: (
		<Svg>
			<path {...lineProps} d="M12 4.5 18.5 7v5.2c0 4.2-2.6 6.7-6.5 7.8-3.9-1.1-6.5-3.6-6.5-7.8V7z" />
			<path {...lineProps} d="M9.2 12.2 11.2 14l3.8-4" />
		</Svg>
	),
	save: (
		<Svg>
			<path {...lineProps} d="M6 4.8h9.2L18 7.6v11.6H6z" />
			<path {...lineProps} d="M8.5 4.8v5h6.2v-5M8.4 19.2v-5h7.2v5" />
		</Svg>
	),
	file: (
		<Svg>
			<path {...lineProps} d="M7 4.5h6.7L17 7.8v11.7H7z" />
			<path {...lineProps} d="M13.7 4.5v3.6H17M9.4 12.5h5.2M9.4 15.4h4.2" />
		</Svg>
	),
	refresh: (
		<Svg>
			<path {...lineProps} d="M18.3 9.2A6.5 6.5 0 0 0 6.4 7.4L5 9.2" />
			<path {...lineProps} d="M5 5.4v3.8h3.8M5.7 14.8a6.5 6.5 0 0 0 11.9 1.8l1.4-1.8" />
			<path {...lineProps} d="M19 18.6v-3.8h-3.8" />
		</Svg>
	),
	sync: (
		<Svg>
			<path {...lineProps} d="M7.2 7.5h7.1c2.5 0 4.5 2 4.5 4.5 0 1-.3 1.9-.8 2.6" />
			<path {...lineProps} d="M10 4.8 7.2 7.5 10 10.2M16.8 16.5H9.7c-2.5 0-4.5-2-4.5-4.5 0-1 .3-1.9.8-2.6" />
			<path {...lineProps} d="m14 19.2 2.8-2.7L14 13.8" />
		</Svg>
	),
	copy: (
		<Svg>
			<rect {...lineProps} x="9" y="9" width="10" height="11" rx="2" />
			<path {...lineProps} d="M6.5 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5v1" />
		</Svg>
	),
	delete: (
		<Svg>
			<path {...lineProps} d="M5 7h14M9 7V4.8h6V7M8 10v8.5h8V10" />
			<path {...lineProps} d="M10.6 11.8v4.6M13.4 11.8v4.6" />
		</Svg>
	),
	edit: (
		<Svg>
			<path {...lineProps} d="M5.5 18.5h4.1L18 10.1 13.9 6 5.5 14.4z" />
			<path {...lineProps} d="m12.8 7.1 4.1 4.1" />
		</Svg>
	),
	select: (
		<Svg>
			<path {...lineProps} d="M5 5h14v14H5z" />
			<path {...lineProps} d="m8.2 12.2 2.4 2.4 5.2-5.2" />
		</Svg>
	),
	export: (
		<Svg>
			<path {...lineProps} d="M7 12.8v5.7h10v-5.7" />
			<path {...lineProps} d="M12 15.5V4.8M8.4 8.2 12 4.8l3.6 3.4" />
		</Svg>
	),
	import: (
		<Svg>
			<path {...lineProps} d="M7 12.8v5.7h10v-5.7" />
			<path {...lineProps} d="M12 4.8v10.7M8.4 12.1l3.6 3.4 3.6-3.4" />
		</Svg>
	),
	download: (
		<Svg>
			<path {...lineProps} d="M6 18.5h12M12 4.8v10.1M8.4 11.6l3.6 3.4 3.6-3.4" />
		</Svg>
	),
	folder: (
		<Svg>
			<path {...lineProps} d="M4.8 7.2h6l1.6 2H19v9H4.8z" />
			<path {...lineProps} d="M4.8 9.2h14.2" />
		</Svg>
	),
	star: (
		<Svg>
			<path {...lineProps} d="m12 4.5 2 4.2 4.6.7-3.3 3.2.8 4.6-4.1-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.7z" />
		</Svg>
	),
	play: (
		<Svg>
			<circle {...lineProps} cx="12" cy="12" r="8.5" />
			<path fill="currentColor" d="M10 8.4v7.2l5.7-3.6z" />
		</Svg>
	),
	send: (
		<Svg>
			<path {...lineProps} d="M4.5 12 19 5.2l-4.2 13.6-3.1-5.2z" />
			<path {...lineProps} d="m11.7 13.6 3.8-4" />
		</Svg>
	),
	stop: (
		<Svg>
			<rect {...lineProps} x="7" y="7" width="10" height="10" rx="1.2" />
		</Svg>
	),
	list: (
		<Svg>
			<path {...lineProps} d="M8.5 7h10M8.5 12h10M8.5 17h10" />
			<path {...lineProps} d="M5.4 7h.1M5.4 12h.1M5.4 17h.1" />
		</Svg>
	),
	zoomIn: (
		<Svg>
			<circle {...lineProps} cx="10.5" cy="10.5" r="5.8" />
			<path {...lineProps} d="m15 15 4 4M10.5 7.8v5.4M7.8 10.5h5.4" />
		</Svg>
	),
	zoomOut: (
		<Svg>
			<circle {...lineProps} cx="10.5" cy="10.5" r="5.8" />
			<path {...lineProps} d="m15 15 4 4M7.8 10.5h5.4" />
		</Svg>
	),
	prev: (
		<Svg>
			<path {...lineProps} d="M13.2 6.2 7.4 12l5.8 5.8" />
			<path {...lineProps} d="M18 6.2 12.2 12l5.8 5.8" />
		</Svg>
	),
	next: (
		<Svg>
			<path {...lineProps} d="m10.8 6.2 5.8 5.8-5.8 5.8" />
			<path {...lineProps} d="m6 6.2 5.8 5.8L6 17.8" />
		</Svg>
	),
	voice: (
		<Svg>
			<path {...lineProps} d="M5 14V10h3l4-3.4v10.8L8 14z" />
			<path {...lineProps} d="M15.2 9.2a4 4 0 0 1 0 5.6M17.8 6.8a7.5 7.5 0 0 1 0 10.4" />
		</Svg>
	),
	tool: (
		<Svg>
			<path {...lineProps} d="M14.3 5.1a4 4 0 0 0 4.6 4.6l-8.6 8.6a2.4 2.4 0 0 1-3.4-3.4z" />
			<path {...lineProps} d="M7.4 15.6l1 1" />
		</Svg>
	),
	back: (
		<Svg>
			<path {...lineProps} d="M15.8 5.8 9.6 12l6.2 6.2" />
			<path {...lineProps} d="M10 12h9" />
		</Svg>
	),
};

export function XQIcon({name, className = '', ...rest}){
	return React.cloneElement(iconMap[name] || iconMap.astro, {
		className: `xq-icon ${className}`.trim(),
		...rest,
	});
}

export default XQIcon;
