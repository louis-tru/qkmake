#!/usr/bin/env node

process.chdir(__dirname);

if (process.argv[2] == 'build') {
	const fs = require('qktool/node/fs');
	fs.mkdirpSync('out/qkmake');
	fs.copySync('LICENSE', 'out/qkmake/LICENSE');
	fs.copySync('README.md', 'out/qkmake/README.md');
	fs.copySync('marked', 'out/qkmake/marked');
	fs.copySync('export', 'out/qkmake/export');
	fs.copySync('package.json', 'out/qkmake/package.json');
	fs.copySync('gyp.sh', 'out/qkmake/gyp.sh');
	fs.copySync('gyp.bat', 'out/qkmake/gyp.bat');
	fs.copySync('quark', 'out/qkmake/quark');
	fs.copySync('quark.bat', 'out/qkmake/quark.bat');
	fs.chmodSync('quark', 0o755);
	if (! fs.existsSync(`out/qkmake/gyp-next`)) {
		fs.symlinkSync(`../../gyp-next`, `out/qkmake/gyp-next`)
	}
} else if (process.argv[2] == 'install') {
	const fs = require('fs');
	const platform = process.platform;
	const host_os = platform == 'darwin' ? 'mac': platform == 'win32' ? 'windows': platform;
	const host_arch = process.arch == 'x86_64' ? 'x64': process.arch;
	const isWin = host_os == 'windows';
	const quark = isWin ? 'quark.bat': 'quark';
	const exec = `product/${host_os}/${host_arch}/${quark}`;
	if (fs.existsSync(exec)) {
		if (isWin) {
			fs.writeFileSync(quark, `%~dp0product\\windows\\${host_arch}\\quark.exe %*`);
		} else {
			if (fs.existsSync(quark)) {
				fs.unlinkSync(quark);
			}
			fs.symlinkSync(exec, quark);
		}
	}
}