#!/bin/bash
repo_directory=$(git rev-parse --show-toplevel)
cd ${repo_directory}/services/first-service

if [ "$#" -ne 1 ]; then
	echo "Usage: ./first-service.sh <environment name>"
	exit
elif [[ $1 == "prod" ]]; then
	echo "Starting as production"
	export APP_ENV="PRODUCTION"
elif [[ $1 == "dev" ]]; then
	echo "Starting in development"
	export APP_ENV="DEVELOPMENT"
else
	echo "Current environments are 'prod' and 'dev'"
	exit
fi

echo "Starting first-service with environment ${APP_ENV}"

# Starts main.js, which sets its own name to "first-service". Redirects all output
#  to output.log and then resumes execution
# We will need to change the < /dev/null portion later if we wish to provide command line input to the running process
setsid node build/main.js > output.log 2>&1 < /dev/null &
