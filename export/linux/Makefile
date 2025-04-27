
TARGET_NAME ?=
BUILDTYPE   ?= Release
HOST_OS     ?= $(shell uname|tr '[A-Z]' '[a-z]')
OUTPUT      ?= $(shell sh -c 'cd ../../out && pwd')

libs_dir=$(OUTPUT)/linux/$(1).$(BUILDTYPE)

prefix=$(if $(filter arm64,$(1)),aarch64-linux-gnu-)

check=\
	if [ "$(1)" != "$(2)" ]; then \
		echo ;\
		echo Target \"$(3)\" can only build on $(2) system.;\
		echo ;\
		exit 1; \
	fi

.PHONY: all x64 arm64

.SECONDEXPANSION:

all: x64 arm64

x64 arm64:
	@$(call check,$(HOST_OS),linux,$@)
	$(MAKE) -C mk -f Makefile \
		CC_target="$(call prefix,$@)gcc" CXX_target="$(call prefix,$@)g++" \
		LINK_target="$(call prefix,$@)ld" AR_target="$(call prefix,$@)ar" \
		BUILDTYPE=$(BUILDTYPE) builddir="$(call libs_dir,$@)" LINUX_ARCH=$@
	mkdir -p $(OUTPUT)/small/run.libs/linux
	cp -rf $(OUTPUT)/usr/linux/*          $(OUTPUT)/small/run.libs/linux
	cp $(call libs_dir,$@)/*.so           $(OUTPUT)/small/run.libs/linux/$@
	cp $(call libs_dir,$@)/$(TARGET_NAME) $(OUTPUT)/small/run.linux.$@
	cp $(OUTPUT)/linux/run.sh             $(OUTPUT)/small
	echo Complete target "$(OUTPUT)/small/run.linux.$@"
