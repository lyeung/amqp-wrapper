const Channel = require('./channel');
const Consumer = require('./consumer');
const Publisher = require('./publisher');
const AmqpWrapper = require('./amqp-wrapper');

module.exports = {
  AmqpWrapper,
  Publisher,
  Consumer,
  Channel,
};
