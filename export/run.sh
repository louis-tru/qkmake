#!/bin/sh

base=$(dirname "$0")

cd $base

os=`uname|tr '[A-Z]' '[a-z]'`
arch=`arch`

if [ "$os" = "darwin" ]; then
	os="mac"
fi

if [ "$arch" = "x86_64" ]; then
	arch="x64"
elif [ "$arch" = "aarch64" ]; then
	arch="arm64"
fi

# run=`readlink -f run.$os.$arch`

./run.$os.$arch "$@"
