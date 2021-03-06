module.exports = function(grunt) {
  'use strict';

  var webpack = require('webpack');
  const path = require('path');

  grunt.util.linefeed = '\n';
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*\n' +
    ' * OBS WebSocket Javascript API (<%= pkg.name %>) v<%= pkg.version %>\n' +
    ' * Author: <%= pkg.author %>\n' +
    ' * Repo: <%= pkg.repoUrl %>\n' +
    ' * SHA: <%= pkg.sha %>\n' +
    ' * Timestamp: <%= pkg.timestamp %>\n' +
    ' */\n\n',

    webpack: {
      options: require('./webpack.config.js'),
      obswebsocket: {
        failOnError: false/*,
        plugins: [
          new webpack.optimize.UglifyJsPlugin()
        ]*/
      },
      obswebsocket_watch: {
        failOnError: false,
        watch: true
      }
    },
    // jsdoc2md: {
    //   docs: {
    //     src: ['lib/OBSWebSocket.js', 'lib/OBSScene.js', 'lib/OBSSource.js', 'lib/Core.js', 'lib/Socket.js', 'lib/Requests.js', 'lib/Events.js'],
    //     dest: 'dist/DOCUMENTATION.md'
    //   }
    // },
    clean: {
      dist: 'dist'
    },
    concat: {
      options: {
        banner: '<%= banner %>',
        stripBanners: false
      },
      obswebsocket: {
        src: 'dist/obs-websocket.js',
        dest: 'dist/obs-websocket.js'
      }
    }
  });

  require('load-grunt-tasks')(grunt, { scope: 'devDependencies' });

  grunt.registerTask('build', ['clean:dist', 'webpack:obswebsocket', 'concat']);
  grunt.registerTask('watch', ['webpack:obswebsocket_watch']);
  grunt.registerTask('default', ['build', /*'jsdoc2md'*/]);
};
