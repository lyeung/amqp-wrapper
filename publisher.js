const { sleep, SLEEP_SEC } = require('./sleep');

const Publisher = ({ id, channel, ee, exchange, durable = false }) => {
  let state = {
    closed: false,
    publishing: false,
  };

  const isPublishing = () => state.publishing;
  const isClosed = () => state.closed;

  const getId = () => id;
  const init = async () => {
    try {
      await channel.assertExchange(exchange, 'fanout', {
        durable,
      });
    } catch (err) {
      ee.emit('assertPublisherError', err, getId());
    } finally {
      return getId();
    }
  };

  const close = async (sleepSec = SLEEP_SEC) => {
    if (isClosed()) {
      ee.emit('publisherAlreadyClosed', getId());
      return false;
    }

    let sleepCount = 0;
    while (sleepCount < 3) {
      if (!isPublishing()) {
        break;
      }
      sleep(sleepSec * (sleepCount + 2));
      sleepCount++;
    }

    if (sleepCount >= 3 && isPublishing()) {
      return false;
    }

    state = {
      ...state,
      closed: true,
    };

    ee.emit('closedPublisher', getId());
    return state.closed;
  };

  const publish = async (msg) => {
    if (isClosed()) {
      return false;
    }

    let success = false;
    try {
      setPublishing(true);
      await channel.publish(exchange, '', Buffer.from(msg));
      success = true;
    } catch (err) {
      //console.error('failed to publish message', err);
      ee.emit(`${exchange}-publisher.err`, err);
    } finally {
      setPublishing(false);
    }

    return success;
  };

  const setPublishing = (publishing) => {
    state = {
      ...state,
      publishing,
    };
  };

  const getState = () => ({
    ...state,
  });

  return {
    getId,
    init,
    isClosed,
    isPublishing,
    setPublishing,
    getState,
    publish,
    close,
  };
};

module.exports = Publisher;
