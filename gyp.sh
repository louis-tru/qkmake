#!/bin/sh

if [ `which python3` ]; then
	PYTHON=`which python3`
elif [ `which python2.7` ]; then
	PYTHON=`which python2.7`
elif [ `which python2` ]; then
	PYTHON=`which python2`
else
	PYTHON=`which python`
fi

if [ ! "$PYTHON" ]; then
	echo "\nError: python needs to be installed first\n";
	exit 1;
fi

set -e
base=$(dirname "$0")
exec $PYTHON "${base}/gyp-next/gyp_main.py" "$@"
