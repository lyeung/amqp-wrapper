const Channel = require('../channel');
const Consumer = require('../consumer');

const { sleep } = require('../sleep');
const events = require('events');

describe('channel', () => {
  const CHANNEL_ID = 100;
  let ee;
  let conn;
  let ch;
  let channel;

  beforeEach(() => {
    conn = jest.fn();
    ch = jest.fn();
    ch.close = jest.fn();
    ee = new events.EventEmitter();
    channel = Channel({ conn, ee, id: CHANNEL_ID });
    channel.init();
    conn.createChannel = jest.fn().mockReturnValue(ch);
  });

  afterEach(() => {
    ee.removeAllListeners();
  });

  function mockCreateChan() {}

  describe('create consumer', () => {
    test('is closed is undefined by default', () => {
      expect(channel.isClosed()).toBeUndefined();
    });

    test('create consumer', async () => {
      mockCreateChan();
      const consumer = await channel.createConsumer();
      expect(consumer).not.toBeNull();
    });

    test('create and emit close consumer events', async () => {
      mockCreateChan();
      const consumer = await channel.createConsumer();
      const id = consumer.getId();

      ee.emit('closedConsumer', id);
      expect(channel.getState()).toEqual({
        closed: false,
        publishers: [],
        consumers: [],
      });
    });

    test('create and emit close publisher events', async () => {
      mockCreateChan();
      const exchange = 'ex1';
      const publisher = await channel.createPublisher({ exchange });
      const id = publisher.getId();
      ee.emit('closedPublisher', id);

      expect(channel.getState()).toEqual({
        closed: false,
        publishers: [],
        consumers: [],
      });
    });

    test('is closed is false after calling create consumer', async () => {
      mockCreateChan();
      await channel.createConsumer();
      expect(channel.isClosed()).toEqual(false);
    });

    test('throws error when consumer length is more than 0', async () => {
      mockCreateChan();
      const consumer = await channel.createConsumer();
      const id = consumer.getId();

      let cannotCloseChannelInstance = null;
      ee.once(
        'cannotCloseChannel',
        (param) => (cannotCloseChannelInstance = param)
      );
      const result = await channel.close();
      expect(result).toEqual(false);
      expect(channel.getState()).toEqual({
        closed: false,
        consumers: [consumer],
        publishers: [],
      });

      expect(cannotCloseChannelInstance).toEqual(CHANNEL_ID);
    });
  });

  describe('close', () => {
    test('when consumers and publishers are empty', async () => {
      mockCreateChan();
      const consumer = await channel.createConsumer();
      const id = consumer.getId();

      ee.emit('closedConsumer', id);
      const result = await channel.close();
      expect(result).toEqual(true);
    });

    test('close when channel is already closed', async () => {
      mockCreateChan();
      const consumer = await channel.createConsumer();
      const id = consumer.getId();

      let channelClosed = false;
      ee.once('channelAlreadyClosed', () => {
        channelClosed = true;
      });
      ee.emit('closedConsumer', id);

      let result = await channel.close();
      expect(result).toEqual(true);
      result = await channel.close();
      expect(result).toEqual(false);
      expect(channelClosed).toEqual(true);
    });
  });
});
