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

function copyFileIfNeeded(sourcePath, targetPath) {
	if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
		return false;
	}
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	fs.copyFileSync(sourcePath, targetPath);
	return true;
}

function ensureFrontendStaticLayout(relativeDir) {
	const distDir = path.resolve(process.cwd(), relativeDir);
	const indexPath = path.join(distDir, 'index.html');
	if (!fs.existsSync(indexPath)) {
		return;
	}

	const html = fs.readFileSync(indexPath, 'utf8');
	if (!html.includes('/static/umi.')) {
		return;
	}

	const staticDir = path.join(distDir, 'static');
	fs.mkdirSync(staticDir, { recursive: true });

	let changed = false;
	for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
		if (!entry.isFile() || !/^umi\./.test(entry.name)) {
			continue;
		}
		if (copyFileIfNeeded(path.join(distDir, entry.name), path.join(staticDir, entry.name))) {
			changed = true;
		}
	}

	const cssFiles = fs
		.readdirSync(staticDir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && /^umi\..*\.css$/.test(entry.name));
	const needsNestedStatic = cssFiles.some((entry) => {
		const cssText = fs.readFileSync(path.join(staticDir, entry.name), 'utf8');
		return cssText.includes('url(static/');
	});

	if (needsNestedStatic) {
		const nestedStaticDir = path.join(staticDir, 'static');
		fs.mkdirSync(nestedStaticDir, { recursive: true });
		for (const entry of fs.readdirSync(staticDir, { withFileTypes: true })) {
			if (!entry.isFile()) {
				continue;
			}
			if (copyFileIfNeeded(path.join(staticDir, entry.name), path.join(nestedStaticDir, entry.name))) {
				changed = true;
			}
		}
	}

	if (changed) {
		console.log(`[umi-runner] synced /static assets into ${relativeDir}`);
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
		if (result.status === 0 && mode !== 'dev') {
			ensureFrontendStaticLayout(forFile ? 'dist-file' : 'dist');
		}
		process.exit(result.status);
	}
	process.exit(1);
}

run();
