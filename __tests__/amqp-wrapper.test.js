const AmqpWrapper = require('../amqp-wrapper');
const amqplib = require('amqplib');

jest.genMockFromModule('amqplib');
jest.mock('amqplib');

describe('amqp-wrapper', () => {
  const hostname = 'foo';
  const username = 'uname';
  const password = 'passwd';
  const vhost = 'vhost';
  let amqp;
  let connect;
  let conn;

  beforeEach(() => {
    conn = {
      close: jest.fn(),
    };
    //amqplib.connect.mockImplementation(() => jest.fn().mockReturnValue(conn));
    amqplib.connect = jest.fn().mockReturnValue(conn);
    amqp = AmqpWrapper({
      hostname,
      username,
      password,
      vhost,
    });
  });

  test('default state', () => {
    expect(amqp.getState()).toEqual({
      ee: null,
      conn: null,
      closed: false,
      channels: [],
    });
  });

  test('default is not connected', () => {
    expect(amqp.isConnected()).toEqual(false);
  });

  test('default is not closed', () => {
    expect(amqp.isClosed()).toEqual(false);
  });

  describe('using mocked event emitter', () => {
    let ee;

    beforeEach(() => {
      ee = {
        on: jest.fn(),
        emit: jest.fn(),
      };
    });

    test('init', async () => {
      const ee = {
        on: jest.fn(),
        emit: jest.fn(),
      };
      await amqp.init(() => ee);
      expect(amqp.getState()).toEqual({
        ee,
        conn: null,
        closed: false,
        channels: [],
      });
    });

    test('connect', async () => {
      await amqp.init(() => ee);
      const channel = await amqp.connect();
      expect(channel).not.toBeNull();
      const expectedUrl = `amqp://${username}:${password}@${hostname}/${vhost}`;
      expect(amqplib.connect).toHaveBeenCalledWith(expectedUrl);
      expect(amqp.getState()).toEqual({
        conn,
        ee,
        closed: false,
        channels: [channel],
      });
    });
  });

  describe('using real event emitter', () => {
    test('emit close channel', async () => {
      await amqp.init();
      const { ee, channels } = amqp.getState();
      expect(channels).toEqual([]);

      const channel = await amqp.connect();
      const id = channel.getId();

      expect(amqp.getState().channels).toEqual([channel]);
      ee.emit('closedChannel', id);
      expect(amqp.getState().channels).toEqual([]);
    });

    test('conn close throws error', async () => {
      const err = new Error('mocked error');
      conn = {
        close: () => throw err,
      };
      amqplib.connect = jest.fn().mockReturnValue(conn);

      await amqp.init();
      const channel = await amqp.connect();
      const id = channel.getId();

      const { ee } = amqp.getState();
      ee.emit('closedChannel', id);

      let closeConnErr;
      ee.on('cannotCloseConn', (error) => {
        closeConnErr = error;
      });

      const result = await amqp.close();
      expect(result).toEqual(false);
      expect(closeConnErr).toEqual(err);
    });

    test('conn already closed error', async () => {
      conn = {
        close: jest.fn(),
      };
      amqplib.connect = jest.fn().mockReturnValue(conn);

      await amqp.init();
      const channel = await amqp.connect();
      const id = channel.getId();

      const { ee } = amqp.getState();
      ee.emit('closedChannel', id);

      let connAlreadyClosed = false;
      ee.on('connAlreadyClosed', () => (connAlreadyClosed = true));

      await amqp.close();
      const result = await amqp.close();
      expect(result).toEqual(false);
      expect(connAlreadyClosed).toEqual(true);
    });

    test('close with channels', async () => {
      await amqp.init();
      const channel = await amqp.connect();
      const id = channel.getId();

      const { ee, conn } = amqp.getState();
      expect(amqp.getState().channels.length).toEqual(1);
      expect(amqp.getState().conn).not.toBeNull();

      let result = await amqp.close();
      expect(result).toEqual(false);
      expect(amqp.getState().channels.length).toEqual(1);
      expect(amqp.getState().conn).not.toBeNull();

      ee.emit('closedChannel', id);
      result = await amqp.close();
      expect(amqp.getState().channels.length).toEqual(0);
      expect(amqp.getState().conn).toBeNull();
    });
  });
});
