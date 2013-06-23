#############################################################################
# Makefile for building: artoolkit_.so
# Hand generated.
#############################################################################

ARDIR   = ARToolKitPlus-2.3.0

CXX	= g++
CFLAGS	= -g -Wall -Wno-write-strings -I$(ARDIR)/include -I/usr/include -L$(ARDIR)/lib
LFLAGS	= 

UNAME := $(shell uname)
ifeq ($(UNAME), Darwin)
	CFLAGS := -msse3 $(CFLAGS)
	LFLAGS := -bundle -undefined dynamic_lookup $(LDFLAGS) -lARToolKitPlus
	LIB_EXT=dylib
else # Linux
	CFLAGS := -fPIC $(CFLAGS)
	LFLAGS := -shared $(LDFLAGS) -llibARToolKitPlus
	LIBEXT=so
endif

TARGET = lib/artoolkit_.so

all: artoolkit_.cpp $(ARDIR)/lib/libARToolKitPlus.$(LIBEXT)
	$(CXX) $(CFLAGS) $(LFLAGS) artoolkit_.cpp -o $(TARGET)

clean:
	/bin/rm -rf $(TARGET) $(TARGET).dSYM
	$(MAKE) -C $(ARDIR) clean

# Recursively call make on ARToolKitPlus
.PHONY : $(ARDIR)/lib/libARToolKitPlus.$(LIBEXT)
$(ARDIR)/lib/libARToolKitPlus.$(LIBEXT): 
	$(MAKE) -C $(ARDIR)
