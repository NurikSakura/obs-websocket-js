var WebSocket = require('ws');
var EventEmitter = require('events');
var AuthHashing = require('./AuthHashing');
var Status = require('./Status');
var url = require('url');
var log = require('loglevel');
log.setLevel('info');

var NOP = function() {};

var DEFAULT_PORT = 4444;

var AUTH = {
  required: true,
  salt: undefined,
  challenge: undefined
};

function camelCaseKeys(obj) {
  obj = obj || {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      var camelCasedKey = key.replace( /-([a-z])/gi, function ( $0, $1 ) { return $1.toUpperCase(); } );
      obj[camelCasedKey] = obj[key];
    }
  }

  return obj;
}

class Socket extends EventEmitter {
  constructor(address = 'localhost', password = '') {
    super();
    this._connected = false;
    this._socket = undefined;

    var originalEmit = this.emit;
    this.emit = function() {
      log.debug('[Socket:emit]', arguments[0], arguments[1]);
      originalEmit.apply(this, arguments);
    }

    this.connect({ address: address })
      .then(() => { this.authenticate({ 'password': password }); })
      .catch((err) => { log.error('Connection or Authentication failed.', err); });
  }

  _doCallback(callback, err, data) {
    callback = callback || NOP;

    try {
      callback(err, data);
    } catch (e) {
      log.error('Unable to resolve callback.', e);
    }
  }

  // TODO: Break this up a bit.
  // TODO: Clean up callbacks.
  connect(args = {}, callback) {
    args = args || {};
    var address = args.address || 'localhost';

    if (!url.parse(address).port) {
      address += ':' + DEFAULT_PORT;
    }

    if (this._connected) {
      this._socket.close();
      this._connected = false;
    }

    return new Promise((resolve, reject) => {
      log.info('Attempting to connect to:', address);
      this._socket = new WebSocket('ws://' + address);

      this._socket.onopen = () => {
        this._connected = true;
        log.info('Connection opened:', address);
        this.emit('obs:internal:event', { updateType: 'ConnectionOpened' });
        this._doCallback(callback, null, true);
        resolve();
      };

      this._socket.onclose = () => {
        this._connected = false;
        log.info('Connection closed:', address);
        this.emit('obs:internal:event', { updateType: 'ConnectionClosed' });
      };

      this._socket.onerror = (evt) => {
        this._connected = false;
        log.error('Connected failed.', evt.code);
        this._doCallback(callback, true, null);
        reject(evt);
      };

      this._socket.onmessage = (msg) => {
        log.debug('[Socket:OnMessage]', msg);

        var data = camelCaseKeys(JSON.parse(msg.data));

        // Emit the message with ID if available, otherwise default to a non-messageId driven event.
        if (data.messageId) {
          this.emit('obs:internal:message:id-' + data.messageId, data);
        } else {
          this.emit('obs:internal:event', data);
        }
      };
    });
  }

  authenticate(args = {}, callback) {
    args = args || {};
    args.password = args.password || '';

    if (!this._connected) {
      this._doCallback(callback, Status.wrap(Status.NOT_CONNECTED), null);
      return Promise.reject(Status.wrap(Status.NOT_CONNECTED));
    }

    return this.GetAuthRequired()
      .then((data) => {
        AUTH = {
          required: data.authRequired,
          salt: data.salt,
          challenge: data.challenge
        };

        // Return early if authentication is not necessary.
        if (!AUTH.required) {
          this.emit('obs:internal:event', { updateType: 'AuthenticationSuccess' });
          this._doCallback(callback, null, Status.wrap(Status.AUTH_NOT_REQUIRED));
          return Promise.resolve(Status.wrap(Status.AUTH_NOT_REQUIRED));
        }

        var params = {
          'auth': new AuthHashing(AUTH.salt, AUTH.challenge).hash(args.password)
        };

        return this.send('Authenticate', params, callback)
          .then(() => {
            log.debug('Authentification Success.');
            this.emit('obs:internal:event', { updateType: 'AuthenticationSuccess' });
          })
          .catch(() => {
            log.error('Authentication Failure.');
            this.emit('obs:internal:event', { updateType: 'AuthenticationFailure' });
          });
      });
  }

  /**
   * Close and disconnect the WebSocket connection.
   *
   * @function
   * @category request
   */
  disconnect() {
    log.debug('Disconnect requested.');
    this._socket.close();
  }
}

module.exports = Socket;
