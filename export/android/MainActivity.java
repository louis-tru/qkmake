/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2015, xuewen.chu
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of xuewen.chu nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL xuewen.chu BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

package {id};

import org.quark.Activity;
import android.os.Bundle;

public class MainActivity extends Activity {

	private static final String LIBRARY = "quark";

	static {
		System.loadLibrary(LIBRARY);
	}

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
	}

	protected String startupArgv() {
		// This string is parsed into argc/argv and passed to Quark's native main entry.
		// In a debuggable build, an Intent extra can temporarily override the default
		// startup arguments without rebuilding the APK, for example:
		//   adb shell am start -n <package>/.MainActivity --es argv "jsapi --aaside"
		if (isDebugger()) {
			String argv = getIntent().getStringExtra("argv");
			if (argv != null && !argv.isEmpty())
				return argv;

			// Default debug startup: load the application from qkmake's development
			// server, watch for updates, and expose the JavaScript debugger. Start the
			// server from the Qk project directory before launching the application:
			//   qkmake watch
			return ARGV_DEBUG;

			// For offline debugging, use the application bundled in APK assets while
			// keeping the JavaScript debugger enabled:
			// return ARGV_DEBUG1;
		} else {
			// Release builds always start the application bundled in APK assets.
			return ARGV_RELEASE;
		}
	}

}
