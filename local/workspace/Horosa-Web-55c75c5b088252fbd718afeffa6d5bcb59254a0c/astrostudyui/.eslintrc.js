// ESLint 配置单源:编辑器提示与 scripts/lint-ratchet.js(静态检查棘轮)共用这一份。
// 只开高信号规则 —— 每条都对应一类「打包不报错、运行到那一行才出事 / 读屏用不了」的问题;格式与风格一律不管(交给 prettier)。
//   没定义的名字(no-undef / react/jsx-no-undef):忘了 import 的函数 / 组件,webpack 照样打包,点到那里才 ReferenceError
//   没用的变量与引用(no-unused-vars;JSX 里用到的算用到):删功能后留下的死引用会把整块模块继续拖进分包
//   Hook 两条(rules-of-hooks / exhaustive-deps):条件里调 Hook = 渲染次序错乱;依赖漏项 = 读到旧值
//   无障碍五条(jsx-a11y):图片缺替代文字 / 写错的 aria-* / 不存在的 role / 角色缺必填属性 / 角色不支持的属性
// 计数与只许减少的语义见 scripts/lint-ratchet.js 头注。
const BABEL_SYNTAX = ['jsx', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'decorators-legacy', 'exportDefaultFrom',
	'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator', 'numericSeparator', 'logicalAssignment', 'topLevelAwait'];

module.exports = {
	root: true,
	parser: '@babel/eslint-parser',
	parserOptions: {
		requireConfigFile: false,
		sourceType: 'module',
		ecmaVersion: 2021,
		babelOptions: { babelrc: false, configFile: false, parserOpts: { plugins: BABEL_SYNTAX } },
	},
	// node:process.env 由构建注入、少数工具文件用 require;JSX 走自动运行时(不显式引 React 的文件不报)
	env: { browser: true, es2021: true, node: true },
	plugins: ['react', 'react-hooks', 'jsx-a11y'],
	settings: { react: { version: '17.0' } },
	rules: {
		'no-undef': 'error',
		'react/jsx-no-undef': 'error',
		'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none', varsIgnorePattern: '^_' }],
		'react/jsx-uses-vars': 'error',
		'react/jsx-uses-react': 'error',
		'react-hooks/rules-of-hooks': 'error',
		'react-hooks/exhaustive-deps': 'warn',
		'jsx-a11y/alt-text': 'error',
		'jsx-a11y/aria-props': 'error',
		'jsx-a11y/aria-role': 'error',
		'jsx-a11y/role-has-required-aria-props': 'error',
		'jsx-a11y/role-supports-aria-props': 'error',
	},
	overrides: [{ files: ['**/__tests__/**', '**/*.test.js'], env: { jest: true } }],
	ignorePatterns: ['src/.umi/**', 'src/.umi-production/**', 'src/.umi-test/**', 'dist/**', 'dist-file/**', 'node_modules/**'],
};
