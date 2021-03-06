var request = require('request');
var app = require('electron').app;
var BrowserWindow = require('electron').BrowserWindow;
var fs = require('fs');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));
var chalk = require('chalk');
var injectServer = require('./injectServer');
var getOptions = require('./../lib/options');

var mainWindow = null;
argv.hostname = argv.hostname? argv.hostname: "localhost";

app.on('window-all-closed', function() {
	app.quit();
});

app.on('ready', function() {
    let port = argv.port;
    let hostname = argv.hostname? argv.hostname: "localhost";
    if(port){
        port = parseInt(port);
    }else {
	    port = 8000;
    }

    tryStartApp(hostname,port);
});

function tryStartApp(hostname,port) {
	request(`${(argv.protocol === 'https')? 'https': 'http'}://${hostname}:${port}`, function (error, response) {
		if (!error && (response.statusCode === 200 || response.statusCode === 304)) {
			// Create the browser window.
			mainWindow = new BrowserWindow({width: 800, height: 600});

			mainWindow.loadURL(`${(argv.protocol === 'https')? 'https': 'http'}://${hostname}:${port}`);

			// Emitted when the window is closed.
			mainWindow.on('closed', function() {
				mainWindow = null;
			});

			return;
		}

		setTimeout(function () {
			tryStartApp(hostname, port);
		},1000)
	});
}

function readFile(filePath) {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');
}

if (argv.protocol === 'https') {
  argv.key = argv.key ? readFile(argv.key) : null;
  argv.cert = argv.cert ? readFile(argv.cert) : null;
}

function log(pass, msg) {
  var prefix = pass ? chalk.green.bgBlack('PASS') : chalk.red.bgBlack('FAIL');
  var color = pass ? chalk.blue : chalk.red;
  console.log(prefix, color(msg));
}

function getModuleName(type) {
  switch (type) {
    case 'macos':
      return 'react-native-macos';
    // react-native-macos is renamed from react-native-desktop
    case 'desktop':
      return 'react-native-desktop';
    case 'reactnative':
    default:
      return 'react-native';
  }
}

function getModulePath(moduleName) {
  return path.join(process.cwd(), 'node_modules', moduleName);
}

function getModule(type) {
  var moduleName = getModuleName(type);
  var modulePath = getModulePath(moduleName);
  if (type === 'desktop' && !fs.existsSync(modulePath)) {
    moduleName = getModuleName('macos');
    modulePath = getModulePath(moduleName);
  }
  return {
    name: moduleName,
    path: modulePath
  };
}

if (argv.revert) {
  var module = getModule(argv.revert);
  var pass = injectServer.revert(module.path, module.name);
  var msg = 'Revert injection of RemoteDev server from React Native local server';
  log(pass, msg + (!pass ? ', the file `' + path.join(module.name, injectServer.fullPath) + '` not found.' : '.'));

  process.exit(pass ? 0 : 1);
}

if (argv.injectserver) {
  var options = getOptions(argv);
  var module = getModule(argv.injectserver);
  var pass = injectServer.inject(module.path, options, module.name);
  var msg = 'Inject RemoteDev server into React Native local server';
  log(pass, msg + (pass ? '.' : ', the file `' + path.join(module.name, injectServer.fullPath) + '` not found.'));

  process.exit(pass ? 0 : 1);
}

require('../index')(argv);
