/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2015, Louis.chu
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Louis.chu nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL Louis.chu BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

#include <quark/ui/app.h>
#include <quark/js/js.h>
#include <quark/util/fs.h>

using namespace qk;

// Application startup arguments are passed to js::Start() as a command-line string.
// Adjust the entry URL, debugger address, or render options here as needed.
Qk_Main() {
#if DEBUG
	// Default debug startup: load from the qkmake development server, watch for
	// updates, and expose the JavaScript debugger. Run `qkmake watch` first.
	// qkmake appends `--jitless` on iOS to disable V8 JIT: current iOS releases
	// can reject V8's generated executable code on a physical device. Inspector
	// debugging remains available; release builds use JavaScriptCore instead.
	return js::Start(ARGV_DEBUG);
	// Offline debug alternative; qkmake also appends `--jitless` to this command.
	// return js::Start(ARGV_DEBUG1);
#else
	// Release startup: load the application bundled in the app resources.
	return js::Start(ARGV_RELEASE);
#endif
}
