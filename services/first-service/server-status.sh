#!/bin/bash

# Prints status of the first-service process, including its APP_ENV variable.
# Returns 0 if it the service is running, 1 otherwise.

output=$(pgrep first-service);
if [ $? -eq 0 ]; then # True if GREP finds a match. This relies on the exit-code variable, will fail if anything goes between `output=...` and this line.
	app_env=$(xargs -n 1 -0 < /proc/${output}/environ | grep APP_ENV) # Get environment variables of process, locate the one labeled APP_ENV
	echo "Service running with PID ${output} and ${app_env}"
	exit 0
else
	echo "Service stopped"
	exit 1
fi
