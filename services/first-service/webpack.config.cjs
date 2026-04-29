const path = require("path")

module.exports = {
  entry: './build/voice-client.js', // Where Webpack starts
  output: {
    filename: 'voice-client.js', // Name of output file
    path: path.resolve(__dirname, 'static'), // Folder for output
    clean: false, // Cleans the dist folder before each build
  },
};
