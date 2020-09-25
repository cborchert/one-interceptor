import path from 'path';
import dyson from 'dyson';
import express from 'express';
import mung from 'express-mung';
import proxy from 'express-http-proxy';
import decompress from 'decompress-response';

// TODO: get from settings or inject in constructor

// our created mock server (dyson) props
const MOCKS_PORT = 8082;
const MOCKS_DIRECTORY = path.join(__dirname, 'mocks');

// our created proxy props
const PROXY_HOST = 'http://localhost';
const PROXY_PORT = 8081;

// service (target app)
const SERVICE_HOST = 'http://localhost';
const SERVICE_PORT = 8080;

/**
 * Simply log out the response by default
 */
const defaultCallback = (body, req, res) => {
  console.log(`${req.method} ${req.url} - ${res.statusCode}`);

  // tag the body before passing it forward, if possibl
  try {
    body.modified = true;
  } catch {
    // do not modify the body
  }
  return body;
};

/**
 * Get a specific header
 * NOTE: headers are case insensitive.
 * @see https://stackoverflow.com/questions/5258977/are-http-headers-case-sensitive
 */
const getHeader = (headers = {}, headerName) => {
  const key = Object.keys(headers).find(
    (h) => h.toLowerCase() === headerName.toLowerCase()
  );
  return (key && headers[key]) || null;
};

/**
 * We can't accept brotli for the moment since express-http-proxy does not support it
 * @see https://github.com/villadora/express-http-proxy/issues/360#issuecomment-670939843
 */
const removeBrotliFromOpts = (proxyReqOpts = {}) => {
  const BR = 'br';
  const acceptedEncodings = (
    getHeader(proxyReqOpts.headers, 'accept-encoding') || ''
  ).split(/, ?/);
  proxyReqOpts.headers['accept-encoding'] = acceptedEncodings
    .filter((encoding) => encoding !== BR)
    .join(', ');
  return proxyReqOpts;
};

// Create the proxy middleware
const getProxyMiddleware = ({ host, port, interceptor }) =>
  proxy(`${host}${port ? `:${port}` : ''}`, {
    // catch the response before going back to the client to modify, record things
    userResDecorator(proxyRes, proxyResData, userReq, userRes) {
      // console.log(userRes);
      // return proxyResData;
      try {
        // get, parse, and transform the data if possible

        const dataString = proxyResData.toString('utf8');
        let data;
        try {
          // try for json data
          data = JSON.parse(proxyResData.toString('utf8'));
        } catch {
          console.log("couldn't parse data");
          // otherwise just use the stringified data
          data = proxyResData.toString('utf8');
        }
        const modified = interceptor(data, userReq, userRes);
        // return transformed data to client
        return JSON.stringify(modified);
      } catch (e) {
        console.log("couldn't parse data, again! recieved error", e);
        // on error, pass the data forward
        return proxyResData;
      }
    },
    userResHeaderDecorator(headers) {
      // recieves an Object of headers, returns an Object of headers.
      const { host: hostHeader, ...hostlessHeaders } = headers || {};
      return hostlessHeaders || {};
    },
    proxyReqOptDecorator: removeBrotliFromOpts,
  });

export default class InterceptorServer {
  /**
   * @param {?Object} params
   */
  constructor(params) {
    // start the servers on creation
    this.init(params);
  }

  /**
   * Init the servers
   * @param {?Object} param0
   */
  init({
    onProxy = defaultCallback,
    onMock = defaultCallback,
    serviceHost = SERVICE_HOST,
    servicePort = SERVICE_PORT,
    proxyPort = PROXY_PORT,
    mocksPort = MOCKS_PORT,
    mocksDirectory = MOCKS_DIRECTORY,
  } = {}) {
    // create the proxy server which sits between our mock server and the service
    const proxyMiddleware = getProxyMiddleware({
      interceptor: onProxy,
      host: serviceHost,
      port: servicePort,
    });
    const proxyApp = express();
    proxyApp.use(proxyMiddleware);
    const proxyServer = proxyApp.listen(proxyPort);

    // create the mock server
    const mocksApp = express();
    const mocksServer = mocksApp.listen(mocksPort);

    // apply middlewares to the server before applying the mocks
    // BEFORE anything else, apply the express-mung middleware to get access (and possibly modify) to all
    //   responses sent from our own endpoints before they are sent down to the client
    const interceptorMiddleware = mung.json(onMock);
    mocksApp.use(interceptorMiddleware);

    // create the mocks using dyson from our config directory and apply to them to the server
    //   dyson configures our mock express server for us
    const options = {
      // the mocks will live in MOCKS_DIRECTORY
      configDir: mocksDirectory,
      // it will be served from MOCKS_PORT
      port: mocksPort,
      // and it will fall back to the interceptor proxy server
      proxy: true,
      proxyHost: PROXY_HOST,
      proxyPort,
    };
    const configs = dyson.getConfigurations(options);
    dyson.registerServices(mocksApp, options, configs);

    this.mocksApp = mocksApp;
    this.mocksServer = mocksServer;
    console.log(`Interceptor mock server listening on port ${mocksPort}`);
    console.log(
      `Interceptor mock server using the directory ${mocksDirectory}`
    );
    this.proxyApp = proxyApp;
    this.proxyServer = proxyServer;
    console.log(`Interceptor proxy server listening on port ${proxyPort}`);
  }

  /**
   * Restart the servers with the given params
   * @param {?Object} params
   */
  restart(params) {
    this.start(params);
  }

  /**
   * (re)start the servers with the given params
   * @param {?Object} params
   */
  start(params) {
    // kill the existing servers
    this.stop();
    // and start new ones
    this.init(params);
  }

  /**
   * Kill the existing servers
   */
  stop() {
    if (this.proxyServer) {
      console.log('killing interceptor proxy server');
      this.proxyServer.close();
      delete this.proxyApp;
    }
    if (this.mocksServer) {
      console.log('killing interceptor mock server');
      this.mocksServer.close();
      delete this.mocksApp;
    }
  }
}
