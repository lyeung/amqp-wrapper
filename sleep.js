const MILLIS_TO_SEC = 1000;
const SLEEP_SEC = 3;

const sleepInterval = (sec) => {
  return new Promise((resolve) => setTimeout(resolve, sec * MILLIS_TO_SEC));
};

const sleep = async (secs = 1) => {
  await sleepInterval(secs);
};

module.exports = {
  sleep,
  sleepInterval,
};
