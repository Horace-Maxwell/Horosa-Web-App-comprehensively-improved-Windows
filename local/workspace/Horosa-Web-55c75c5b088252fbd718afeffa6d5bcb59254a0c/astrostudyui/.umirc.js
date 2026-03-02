const buildForFile = process.env.BUILD_FOR_FILE === '1';

export default {
	publicPath: buildForFile ? './' : '/static/',
	outputPath: buildForFile ? 'dist-file' : 'dist',
	history: buildForFile ? { type: 'hash' } : undefined,
	hash: true,
	dva: {
		immer: false,
	},
	antd: {},
	dynamicImport: false,
	dll: false,
	hardSource: false,
	pwa: false,
	hd: false,
	fastClick: false,
	title: '星阙 - 玄学与星座云平台',
}
