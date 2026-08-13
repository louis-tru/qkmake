
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
		LDFLAGS="-Wl,-rpath=\\$$\$$ORIGIN/lib/linux/$@"
	mkdir -p $(OUTPUT)/small/lib/linux/$@

	if [ -f "$(call builddir,$@)/*.so" ]; then \
		cp $(call builddir,$@)/*.so         $(OUTPUT)/small/lib/linux/$@; fi
	cp $(OUTPUT)/usr/linux/$@/*.so        $(OUTPUT)/small/lib/linux/$@
	cp $(call builddir,$@)/$(TARGET_NAME) $(OUTPUT)/small/$(TARGET_NAME).linux.$@
	[ -f $(TARGET_NAME).linux.$@ ] || ln -s ../../out/small/$(TARGET_NAME).linux.$@ .
	cp $(TARGET_NAME).sh                  $(OUTPUT)/small/$(TARGET_NAME).sh
	echo Complete target "$(OUTPUT)/small/$(TARGET_NAME).linux.$@"

clean:
	rm -rfv $(call builddir,x64)
	rm -rfv $(call builddir,arm64)