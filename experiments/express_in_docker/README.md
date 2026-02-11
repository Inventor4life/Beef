# Express In Docker
by Ethan Goode

## Description
This was a test to figure out how to put an express server written in typescript into a node docker container and get it running.
The dockerfile assumes that the typescript was already built. Building the typescript automatically may be subject to another test.

## Results
See the provided Dockerfile for an example. Overall the procedure was very simple.
To build: (start in project root)

`docker build . -t my_node_image`

To run:

`docker run -p 3000:3000 my_node_image`

Test the container:
Go to `http://127.0.0.1:3000`. It should say `Typescript with express!`

Go to `http://127.0.0.1:3000/test/hello`. It should say `Received wildcard hello`

For more fun, go to `http://127.0.0.1:3000/test/<script>alert("Hello World!")<%2fscript>`
