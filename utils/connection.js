// this file provides helper functions to create, send and consume from queues

const amqp = require('amqplib');
require('dotenv').config();

let connection = null;
let channels = {};

/**
 * 
 * @returns {Promise<amqp.Connection>}
 */
async function getConnection() {
    if (!connection) {
        connection = await amqp.connect(process.env.RABBITMQ_IP);
        // connection = await amqp.connect('amqp://10.10.72.15:5672');
        // console.log(connection.connection.stream.localPort);
        console.log('connected to rabbitmq');
    }
    return connection;
}

/**
* Connect to a connection and channel to start sending messages
* @param {String} queueName: the name of the queue to be connected
* @return {amqp.Channel} an object with information of the current connection and channel
**/
async function connectToChannel(queueName) {
    if (!channels[queueName]) {
        const conn = await getConnection();
        const channel = await conn.createChannel();
        await channel.assertQueue(queueName);
        channels[queueName] = channel;
        console.log(`Channel created for queue: ${queueName}`);
        // console.log(channels);
    }
    return channels[queueName];
}

/**
 * Send a message to a queue with a queue name. This function based on amqp.Channel.sendToQueue() method.
 * @param {String} queueName the name of the queue to send the messages.
 * @param {Object} message message to be processed. Message can be an object to contain more information.
 */
async function sendToQueue(queueName, message) {
    const channel = await connectToChannel(queueName);
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
}

/**
 * Take a message out of the queue. This function based on amqp.Channel.consume() method. 
 * @param {String} queueName the name of the queue
 * @param {Function} onMessage a function to be executed after a message is taken out of the queue  
 */
async function consumeFromQueue(queueName, onMessage, prefetchLimit = 0) {
    const channel = await connectToChannel(queueName);

    // apply rate limiting
    channel.prefetch(prefetchLimit);
    
    console.log(`connected to ${queueName} with prefetch limit ${prefetchLimit}`);
    channel.consume(queueName, async (msg) => {
        // check if a message is received
        if (msg) {
            // parse the message to a JSON object
            const message = JSON.parse(msg.content.toString());

            // console.log('calling onMessage');
            const startTime = Date.now();
            // call the callback function to process the message, passed the parsed message as an argument
            await onMessage(message);
            const endTime = Date.now();

            if (queueName !== 'finishedPdfQueue') {
                console.log(`Elapsed time for processing ${message.id} in ${queueName}: ${endTime - startTime}ms`)
            }
            // console.log('acked');

            // acknowledge the message, prevent the message from being sent again
            channel.ack(msg);
        }
    })
}

module.exports = {
    sendToQueue,
    consumeFromQueue,
    connectToChannel
}
  