
# Set program names
CP = cp
MV = mv
ECHO = echo
NODE = node
NPM = sudo npm
MAKE = make
WWW_DIR = app/ios/www

# Make all
all: node-packages python-extension

# Install required node modules
# TODO: Probably should be local to avoid stepping on anyones toes.
node-packages:
	$(NPM) install chaos
	$(NPM) install connect
	$(NPM) install express
	$(NPM) install formidable
	$(NPM) install gently
	$(NPM) install gm
	$(NPM) install iconv
	$(NPM) install jade
	$(NPM) install log4js
	$(NPM) install node-dev
	$(NPM) install qs
	$(NPM) install socket.io
	$(NPM) install underscore
	$(NPM) install mailparser
	$(NPM) install email

# Make python extension
python-extension:
	$(MAKE) -C python all

# Convert jade templates html and copy needed files to phonegap
phonegap-www:
	$(NODE) app/jjapp.js private/index.jade $(WWW_DIR)/index.html
	$(CP) -r public/javascript/*.js public/css/*.css public/images $(WWW_DIR)
