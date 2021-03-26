const Publisher = require('./publisher');
const Consumer = require('./consumer');

const Channel = ({ conn, ee, id }) => {
  let counter = 0;
  let channel;

  let state = {
    closed: false,
    consumers: [],
    publishers: [],
  };

  const getId = () => id;

  const addPublisher = (publisher) => {
    state = {
      ...state,
      publishers: [...state.publishers, publisher],
    };
  };

  const addConsumer = (consumer) => {
    state = {
      ...state,
      consumers: [...state.consumers, consumer],
    };
  };

  const removePublisher = (id) => {
    state = {
      ...state,
      publishers: [...state.publishers.filter((e) => e.getId() !== id)],
    };
  };

  const removeConsumer = (id) => {
    state = {
      ...state,
      consumers: [...state.consumers.filter((e) => e.getId() !== id)],
    };
  };

  const init = () => {
    ee.on('closedPublisher', (id) => {
      removePublisher(id);
    });

    ee.on('closedConsumer', (id) => {
      removeConsumer(id);
    });
  };

  const createConsumer = async () => {
    channel = await conn.createChannel();
    const consumer = Consumer({ channel, ee, id: ++counter });
    addConsumer(consumer);
    return consumer;
  };

  const createPublisher = async ({ exchange }) => {
    channel = await conn.createChannel();
    const publisher = Publisher({ channel, ee, exchange, id: ++counter });
    addPublisher(publisher);
    return publisher;
  };

  const close = async () => {
    if (isClosed()) {
      ee.emit('channelAlreadyClosed', getId());
      return false;
    }

    if (isStateEmpty()) {
      await channel.close();
      state = {
        ...state,
        closed: true,
      };
      ee.emit('closedChannel', getId());
      //channel = null;
      return true;
    }

    ee.emit('cannotCloseChannel', getId());
    return false;
  };
  const isStateEmpty = () =>
    state.consumers.length === 0 && state.publishers.length === 0;

  const isClosed = () => {
    return channel && state.closed;
  };

  const getState = () => ({ ...state });

  const getInternalChannel = () => channel;
  return {
    getId,
    init,
    createPublisher,
    createConsumer,
    isStateEmpty,
    getState,
    getInternalChannel,
    isClosed,
    close,
  };
};

module.exports = Channel;
