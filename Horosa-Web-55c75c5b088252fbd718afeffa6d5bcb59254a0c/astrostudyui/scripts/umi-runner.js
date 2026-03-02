const { spawnSync } = require('child_process');

function run() {
	const mode = process.argv[2] || 'build';
	const forFile = process.argv.includes('--for-file');

	const env = {
		...process.env,
		NODE_OPTIONS: '--openssl-legacy-provider',
	};
	if (forFile) {
		env.BUILD_FOR_FILE = '1';
	}

	const umiAction = mode === 'dev' ? 'dev' : 'build';
	const result = spawnSync('umi', [umiAction], {
		stdio: 'inherit',
		env,
		shell: true,
	});

	if (typeof result.status === 'number') {
		process.exit(result.status);
	}
	process.exit(1);
}

run();
