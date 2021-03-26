const amqplib = require('amqplib');
const events = require('events');
const Channel = require('./channel');

const AmqpWrapper = ({ hostname, username, password, vhost, eventEmitter }) => {
  let counter = 0;
  let state = {
    ee: null,
    conn: null,
    closed: false,
    channels: [],
  };

  const eeFactory = () => eventEmitter || new events.EventEmitter();

  const addChannel = (channel) => {
    state = {
      ...state,
      channels: [...state.channels, channel],
    };
  };

  const removeChannel = (id) => {
    state = {
      ...state,
      channels: [...state.channels.filter((e) => e.getId() !== id)],
    };
  };

  const init = (eeFn = eeFactory) => {
    const ee = eeFn();
    state = {
      ...state,
      ee,
    };
    ee.on('closedChannel', (id) => {
      removeChannel(id);
    });
  };

  const isConnected = () => !!state.conn;
  const isClosed = () => !!(state.conn === null && state.closed);

  const close = async () => {
    if (isClosed()) {
      state.ee.emit('connAlreadyClosed');
      return false;
    }

    if (state.channels.length === 0) {
      try {
        await state.conn.close();
        state = {
          ...state,
          closed: true,
          conn: null,
        };
        return true;
      } catch (err) {
        console.error(
          `cannot close conn: channels: ${state.channels.length}`,
          err
        );
        state.ee.emit('cannotCloseConn', err);
        return false;
      }
    }

    return false;
  };

  const connect = async function () {
    const url = `amqp://${username}:${password}@${hostname}/${vhost}`;

    const conn = await amqplib.connect(url);
    state = {
      ...state,
      conn,
    };
    const channel = Channel({ conn, ee: state.ee, id: ++counter });
    addChannel(channel);
    return channel;
  };

  const getState = () => ({ ...state });

  return {
    init,
    connect,
    getState,
    isConnected,
    isClosed,
    close,
  };
};

module.exports = AmqpWrapper;
