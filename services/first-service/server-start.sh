#!/bin/bash
repo_directory=$(git rev-parse --show-toplevel)
echo "Repo directory is ${repo_directory}. Starting first-service"
cd ${repo_directory}/services/first-service

# Starts main.js under the name "first-service". Redirects all output
#  to output.log and then resumes execution
exec -a first-service node build/main.js -- > output.log &
