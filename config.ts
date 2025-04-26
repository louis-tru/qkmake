export default {
	server: {
		temp: 'out/temp',
		port: 1026,
		autoIndex: true,
		// gzip: false,
		// agzip: false,
		// printLog: true,
		defaults: ['index.html', 'index.htm', 'default.html'],
		maxFileSize: 1024 * 1024 * 1024,
		maxFormDataSize: 50 * 1024 * 1024,
		maxUploadFileSize: 50 * 1024 * 1024,
		fileCacheTime: 0,
		// expires: 0,
		router: [
			{
				match: '/$console/{action}/{log}',
				service: 'Console',
			}, {
				match: '/$file/{action}/{pathname}',
				service: 'File',
			}, {
				match: '/{pathname}',
				service: 'File',
				action: 'siteFile',
			}
		],
	},
}