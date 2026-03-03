const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function removeDirIfExists(relativeDir) {
	const absDir = path.resolve(process.cwd(), relativeDir);
	if (fs.existsSync(absDir)) {
		try {
			fs.rmSync(absDir, { recursive: true, force: true });
		} catch (error) {
			// Non-fatal on Windows/OneDrive lock races; Umi can still regenerate files.
			console.warn(`[umi-runner] skip removing ${relativeDir}: ${error.message}`);
		}
	}
}

function run() {
	const mode = process.argv[2] || 'build';
	const forFile = process.argv.includes('--for-file');

	if (mode !== 'dev') {
		// Avoid stale generated artifacts corrupting the next production build.
		removeDirIfExists('src/.umi-production');
	}

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
