const Consumer = require('../consumer');
const { sleep } = require('../sleep');
const events = require('events');

jest.genMockFromModule('events');
jest.mock('events');

describe('Consumer', () => {
  const err = Error('mock error');

  let ee;
  let channel;
  let consumer;
  let objId;

  beforeEach(() => {
    channel = jest.fn();
    ee = {
      on: jest.fn(),
      emit: jest.fn(),
    };
    events.mockImplementation(() => ee);
    consumer = Consumer({ channel, ee });
    objId = consumer.init();
  });

  test('is closed by default', () => {
    expect(consumer.isClosed()).toEqual(false);
  });

  test('call close without consume', async () => {
    const result = await consumer.close();
    expect(result).toEqual(true);
    expect(ee.emit).toHaveBeenCalledWith('closedConsumer', objId);
    expect(consumer.isClosed()).toEqual(true);
  });

  test('cannot close consumer while consuming', async () => {
    consumer.isClosed = () => false;
    consumer.setConsuming(true);
    const result = await consumer.close();
    expect(result).toEqual(false);
    expect(consumer.getState()).toEqual({
      consuming: true,
      closed: false,
    });
  });

  test('set consuming', () => {
    expect(consumer.isConsuming()).toEqual(false);
    consumer.setConsuming(true);
    expect(consumer.isConsuming()).toEqual(true);
    expect(consumer.getState()).toEqual({
      consuming: true,
      closed: false,
    });
  });

  describe('consume', () => {
    const sleepSec = 0;
    const q = {
      queue: {},
    };

    const exchangeName = 'ex1';
    const queueName = 'q1';

    const consumeParams = {
      exchange: exchangeName,
      queueName,
    };

    beforeEach(() => {
      channel.assertExchange = jest.fn();
      channel.assertQueue = jest.fn().mockReturnValue(q);
      channel.bindQueue = jest.fn();
    });

    test('message callback', async () => {
      const theMessage = 'messageInTheBottle';
      const msg = {
        content: Buffer.from(theMessage, 'utf8'),
      };

      const msgHandler = jest.fn();
      channel.consume = jest.fn((queue, msgHandler) => {
        msgHandler(msg);
      });

      const result = await consumer.consume({
        ...consumeParams,
      });

      expect(result).toEqual(true);
      expect(ee.emit).toHaveBeenCalledWith(
        `${exchangeName}-${queueName}-consumer`,
        theMessage
      );
      expect(channel.assertExchange).toHaveBeenCalledWith(
        exchangeName,
        'fanout',
        {
          durable: false,
        }
      );
      expect(channel.assertQueue).toHaveBeenCalledWith(queueName, {
        exclusive: false,
      });
      expect(channel.bindQueue).toHaveBeenCalledWith(q.queue, exchangeName, '');
    });

    test('fail channel consume', async () => {
      channel.consume = jest.fn().mockImplementation(() => throw err);
      const result = await consumer.consume({
        ...consumeParams,
      });

      expect(result).toEqual(false);
      expect(ee.emit).toHaveBeenCalledWith(
        `${exchangeName}-${queueName}-consumer.err`,
        err
      );
    });

    test('call consume after closing', async () => {
      channel.consume = jest.fn();
      await consumer.close(sleepSec);
      const result = await consumer.consume({
        ...consumeParams,
      });

      expect(result).toEqual(false);
      expect(ee.emit).toHaveBeenCalledWith('closedConsumer', objId);
      expect(ee.emit).toHaveBeenCalledWith(
        'consumerConsumeAlreadyClosed',
        objId
      );
    });

    test('call close when consuming', async () => {
      channel.consume = jest.fn();
      await consumer.consume({
        ...consumeParams,
      });
      consumer.setConsuming(true);
      const result = await consumer.close(sleepSec);
      expect(result).toEqual(false);
      expect(consumer.getState()).toEqual({
        closed: false,
        consuming: true,
      });
      //expect(consumer.isClosed()).toEqual(false);
      expect(ee.emit).not.toHaveBeenCalledWith('closedConsumer', objId);
    });

    test('call close when consumer is already closed', async () => {
      channel.consume = jest.fn();
      await consumer.consume({
        ...consumeParams,
      });
      let result = await consumer.close(sleepSec);
      expect(result).toEqual(true);
      expect(consumer.isClosed()).toEqual(true);
      result = await consumer.close(sleepSec);
      expect(result).toEqual(false);
      expect(consumer.isClosed()).toEqual(true);

      expect(ee.emit).toHaveBeenCalledWith('closedConsumer', objId);
      expect(ee.emit).toHaveBeenCalledWith('consumerAlreadyClosed', objId);
    });
  });

  describe('failed assert consume', () => {
    const sleepSec = 0;
    const q = {
      queue: {},
    };

    const consumeParams = {
      exchange: 'ex1',
      queueName: 'q1',
      exclusive: false,
      durable: false,
      noAck: true,
    };

    beforeEach(() => {
      channel.consume = jest.fn();
    });

    afterEach(() => {
      expect(channel.consume).not.toHaveBeenCalled();
    });

    test('failled assert exchange', async () => {
      channel.assertExchange = jest.fn().mockImplementation(() => throw err);

      const result = await consumer.consume({
        ...consumeParams,
      });

      expect(result).toEqual(false);
      expect(ee.emit).toHaveBeenCalledWith('assertConsumerError', err, objId);
    });

    test('failed assert queue', async () => {
      channel.assertExchange = jest.fn();
      channel.assertQueue = jest.fn().mockImplementation(() => throw err);

      const result = await consumer.consume({
        ...consumeParams,
      });

      expect(result).toEqual(false);
      expect(channel.assertExchange).toHaveBeenCalled();
      expect(ee.emit).toHaveBeenCalledWith('assertConsumerError', err, objId);
    });

    test('failed assert bindQueue', async () => {
      channel.assertExchange = jest.fn();
      channel.assertQueue = jest.fn().mockReturnValue(() => q);
      channel.bindQueue = jest.fn().mockImplementation(() => throw err);

      const result = await consumer.consume({
        ...consumeParams,
      });

      expect(result).toEqual(false);
      expect(channel.assertExchange).toHaveBeenCalled();
      expect(ee.emit).toHaveBeenCalledWith('assertConsumerError', err, objId);
    });
  });
});
