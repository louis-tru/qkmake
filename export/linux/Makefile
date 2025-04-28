
TARGET_NAME ?=
BUILDTYPE   ?= Release
HOST_OS     ?= $(shell uname|tr '[A-Z]' '[a-z]')
OUTPUT      ?= $(shell sh -c 'cd ../../out && pwd')

builddir=$(OUTPUT)/linux/$(1).$(BUILDTYPE)
cc_prefix=$(if $(filter arm64,$(1)),aarch64-linux-gnu-)
arch_name=$(if $(filter arm64,$(1)),armv8-a,x86-64)

check=\
	if [ "$(1)" != "$(2)" ]; then \
		echo ;\
		echo Target \"$(3)\" can only build on $(2) system.;\
		echo ;\
		exit 1; \
	fi

.PHONY: all x64 arm64 clean

.SECONDEXPANSION:

all: x64 arm64

x64 arm64:
	@$(call check,$(HOST_OS),linux,$@)
	$(MAKE) -C mk -f Makefile \
		CC.target="$(call cc_prefix,$@)gcc" CXX.target="$(call cc_prefix,$@)g++" \
		LINK.target="$(call cc_prefix,$@)g++" AR.target="$(call cc_prefix,$@)ar" \
		BUILDTYPE=$(BUILDTYPE) builddir="$(call builddir,$@)" \
		ARCH=$@ ARCH_NAME="$(call arch_name,$@)" \
		LDFLAGS="-Wl,-rpath=\\$$\$$ORIGIN/run/linux/$@"
	mkdir -p $(OUTPUT)/small/run/linux/$@

	if [ -f "$(call builddir,$@)/*.so" ]; then \
		cp $(call builddir,$@)/*.so         $(OUTPUT)/small/run/linux/$@; fi
	cp $(OUTPUT)/usr/linux/$@/*.so        $(OUTPUT)/small/run/linux/$@
	cp $(call builddir,$@)/$(TARGET_NAME) $(OUTPUT)/small/run.linux.$@
	[ -f run.linux.$@ ] || ln -s          ../../out/small/run.linux.$@ .
	cp run.sh                             $(OUTPUT)/small
	echo Complete target "$(OUTPUT)/small/run.linux.$@"

clean:
	rm -rfv $(call builddir,x64)
	rm -rfv $(call builddir,arm64)