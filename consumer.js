const { sleep } = require('./sleep');
const SLEEP_SEC = 3;

const Consumer = ({ channel, ee, id }) => {
  let state = {
    closed: false,
    consuming: false,
  };

  const init = () => {
    return id;
  };

  const isClosed = () => state.closed;
  const isConsuming = () => state.consuming;
  const setConsuming = (consumingFlag) => {
    state = {
      ...state,
      consuming: consumingFlag,
    };
  };
  const getId = () => id;
  const close = async (sleepSec = SLEEP_SEC) => {
    if (isClosed()) {
      ee.emit('consumerAlreadyClosed', id);
      return false;
    }

    let sleepCount = 0;

    while (sleepCount < 3) {
      if (!isConsuming()) {
        break;
      }
      sleep(sleepSec * (sleepCount + 1));
      sleepCount++;
    }

    if (sleepCount >= 3 && isConsuming()) {
      return false;
    }

    state = {
      ...state,
      closed: true,
    };
    ee.emit('closedConsumer', getId());
    return true;
  };

  const consume = async ({
    exchange,
    queueName,
    exclusive = false,
    durable = false,
    noAck = true,
  }) => {
    if (isClosed()) {
      ee.emit('consumerConsumeAlreadyClosed', id);
      return false;
    }
    let q;
    try {
      await channel.assertExchange(exchange, 'fanout', {
        durable,
      });
      q = await channel.assertQueue(queueName, {
        exclusive,
      });

      await channel.bindQueue(q.queue, exchange, '');
    } catch (err) {
      ee.emit('assertConsumerError', err, id);
      return false;
    }

    let successful = false;
    try {
      setConsuming(true);
      await channel.consume(
        q.queue,
        (msg) => {
          console.debug(
            `recieved message from ${exchange}: ${msg.content.toString()}`
          );
          ee.emit(`${exchange}-${queueName}-consumer`, msg.content.toString());
        },

        { noAck }
      );
      successful = true;
    } catch (err) {
      //console.error('failed to consume message', err);
      ee.emit(`${exchange}-${queueName}-consumer.err`, err);
    } finally {
      setConsuming(false);
    }

    return successful;
  };

  const getState = () => ({ ...state });

  return {
    getId,
    init,
    isClosed,
    isConsuming,
    setConsuming,
    consume,
    close,
    getState,
  };
};

module.exports = Consumer;
