const Publisher = require('../publisher');
const { sleep } = require('../sleep');
const events = require('events');

jest.genMockFromModule('events');
jest.mock('events');

describe('Publisher', () => {
  const err = Error('mock error');

  const exchange = 'ex1';
  const durable = true;

  let ee;
  let channel;
  let assertExchange;
  let publish;
  let publisher;
  let objId;

  beforeEach(async () => {
    assertExchange = jest.fn();
    publish = jest.fn();
    ee = {
      on: jest.fn(),
      emit: jest.fn(),
    };
    events.mockImplementation(() => ee);
    channel = {
      assertExchange,
      publish,
    };
    publisher = Publisher({ channel, ee, exchange, durable });
  });

  test('default is closed', async () => {
    expect(publisher.isClosed()).toEqual(false);
    expect(publisher.getState()).toEqual({
      publishing: false,
      closed: false,
    });
  });

  test('is publishing', async () => {
    expect(publisher.isPublishing()).toEqual(false);
    publisher.setPublishing(true);
    expect(publisher.isPublishing()).toEqual(true);
    expect(publisher.getState()).toEqual({
      publishing: true,
      closed: false,
    });
  });

  describe('init', () => {
    test('default values', async () => {
      objId = await publisher.init();
      expect(channel.assertExchange).toHaveBeenCalledWith(exchange, 'fanout', {
        durable: true,
      });
      expect(publisher.getState()).toEqual({
        publishing: false,
        closed: false,
      });
    });

    test('use default value when durable is not assigned', async () => {
      publisher = Publisher({
        channel,
        ee,
        exchange,
      });
      objId = await publisher.init();
      expect(channel.assertExchange).toHaveBeenCalledWith(exchange, 'fanout', {
        durable: false,
      });
      expect(publisher.getState()).toEqual({
        publishing: false,
        closed: false,
      });
    });
  });

  test('assert publisher error', async () => {
    channel.assertExchange.mockImplementation(() => throw err);
    objId = await publisher.init();
    expect(ee.emit).toHaveBeenCalledWith('assertPublisherError', err, objId);
    expect(publisher.getState()).toEqual({
      publishing: false,
      closed: false,
    });
  });

  test('close successfully', async () => {
    objId = await publisher.init();
    const result = await publisher.close(0);
    expect(result).toEqual(true);
    expect(publisher.isClosed()).toEqual(true);
    expect(ee.emit).toHaveBeenCalledWith('closedPublisher', objId);
    expect(publisher.getState()).toEqual({
      publishing: false,
      closed: true,
    });
  });

  test('call close when publishing', async () => {
    objId = await publisher.init();
    publisher.setPublishing(true);
    const result = await publisher.close();
    expect(result).toEqual(false);
    expect(publisher.isClosed()).toEqual(false);
    expect(ee.emit).not.toHaveBeenCalledWith('closedPublisher', objId);
    expect(publisher.getState()).toEqual({
      publishing: true,
      closed: false,
    });
  });

  test('call close when publisher is already closed', async () => {
    objId = await publisher.init();
    let result = await publisher.close();
    expect(result).toEqual(true);
    result = await publisher.close();
    expect(result).toEqual(false);
    expect(ee.emit).toHaveBeenCalledWith('closedPublisher', objId);
    expect(ee.emit).toHaveBeenCalledWith('publisherAlreadyClosed', objId);
    expect(publisher.getState()).toEqual({
      publishing: false,
      closed: true,
    });
  });

  test('publish', async () => {
    const msg = 'foo bar';
    objId = await publisher.init();
    const result = await publisher.publish(msg);
    expect(result).toEqual(true);
    expect(channel.publish).toHaveBeenCalledWith(
      exchange,
      '',
      Buffer.from(msg)
    );
    expect(publisher.getState()).toEqual({
      publishing: false,
      closed: false,
    });
  });

  test('publish when publisher is already closed', async () => {
    objId = await publisher.init();
    await publisher.close(0);
    const result = await publisher.publish('');
    expect(result).toEqual(false);
    expect(ee.emit).toHaveBeenCalledWith('closedPublisher', objId);
    expect(publisher.getState()).toEqual({
      publishing: false,
      closed: true,
    });
  });

  test('publish throws exception', async () => {
    channel.publish.mockImplementation(() => throw err);
    objId = await publisher.init();
    const result = await publisher.publish('');
    expect(result).toEqual(false);
    expect(ee.emit).toHaveBeenCalledWith(`${exchange}-publisher.err`, err);
    expect(publisher.getState()).toEqual({
      publishing: false,
      closed: false,
    });
  });
});
