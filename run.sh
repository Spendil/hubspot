#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

if [ ! -d "$SCRIPT_DIR/node_modules" ] 
then 
	cd $SCRIPT_DIR
	npm install	
fi
cd $SCRIPT_DIR
node index.js

