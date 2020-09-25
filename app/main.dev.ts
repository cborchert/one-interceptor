/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import _get from 'lodash/get';

import ipcEventTypes from './shared/ipcEventTypes';
import MenuBuilder from './main/menu';
import InterceptorServer from './main/interceptorServer/interceptorServer';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let server: InterceptorServer | null = null;
let responseCount = 0;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map((name) => installer.default(installer[name], forceDownload))
  ).catch(console.log);
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    webPreferences:
      (process.env.NODE_ENV === 'development' ||
        process.env.E2E_BUILD === 'true') &&
      process.env.ERB_SECURE !== 'true'
        ? {
            nodeIntegration: true,
          }
        : {
            preload: path.join(__dirname, 'dist/renderer.prod.js'),
          },
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Event listeners...
 */

/**
 * Handle Renderer request to open a file
 */
ipcMain.on(ipcEventTypes.FILE_SELECT_PROMPT, (event, context) => {
  // if there is  main window we cannot fulfill the request
  if (!mainWindow) {
    event.returnValue = undefined;
    return;
  }

  const filters = _get(context, 'filters', []);
  const files = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openFile'],
    filters,
  });

  // if no files selected, quit
  if (!files) {
    event.returnValue = undefined;
    return;
  }

  // send the renderer process the file path
  const filePath = files[0];
  event.returnValue = filePath;
});

/**
 * Handle Renderer request to open a directory
 */
ipcMain.on(ipcEventTypes.DIRECTORY_OPEN_PROMPT, (event, context) => {
  console.log('Opening window');
  // if there is  main window we cannot fulfill the request
  if (!mainWindow) {
    event.reply(ipcEventTypes.DIRECTORY_OPEN_RESPONSE, {
      context,
      path: undefined,
    });
    return;
  }

  // show the directory open dialog
  const directory = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openDirectory'],
  });

  // if no directory, quit
  if (!directory) {
    event.reply(ipcEventTypes.DIRECTORY_OPEN_RESPONSE, {
      context,
      path: undefined,
    });
    return;
  }

  // send a directory open event to the renderer process
  event.reply(ipcEventTypes.DIRECTORY_OPEN_RESPONSE, {
    context,
    path: directory[0],
  });
});

const responseHandler = (origin) => (body, req, res) => {
  const event =
    origin === 'proxy'
      ? ipcEventTypes.SERVER_ON_PROXY_RESPONSE
      : ipcEventTypes.SERVER_ON_MOCK_RESPONSE;
  responseCount += 1;

  // let the renderer process know about the reponse if possible
  if (mainWindow) {
    const { method, url, headers } = req || {};
    const { statusCode } = res || {};
    mainWindow.webContents.send(event, {
      body,
      req: {
        method,
        url,
        headers,
      },
      res: {
        statusCode,
      },
      id: responseCount,
      origin,
    });
  }
  // return the body to the user without modification
  return body;
};

/**
 * Handle Renderer request to start the server
 */
ipcMain.on(ipcEventTypes.SERVER_START_PROMPT, (event) => {
  console.log('Starting servers...');

  // TODO
  // onProxy = defaultCallback,
  // onMock = defaultCallback,
  // serviceHost = SERVICE_HOST,
  // servicePort = SERVICE_PORT,
  // proxyPort = PROXY_PORT,
  // mocksPort = MOCKS_PORT,
  // mocksDirectory = MOCKS_DIRECTORY,
  const serverParams = {
    onProxy: responseHandler('proxy'),
    onMock: responseHandler('mocks'),
  };

  // if there is a server, kill it
  if (server) {
    server.restart(serverParams);
  } else {
    // start a new server
    server = new InterceptorServer(serverParams);
  }

  // send a directory open event to the renderer process
  event.reply(ipcEventTypes.SERVER_START_RESPONSE, true);
});

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

if (process.env.E2E_BUILD === 'true') {
  // eslint-disable-next-line promise/catch-or-return
  app.whenReady().then(createWindow);
} else {
  app.on('ready', createWindow);
}

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
