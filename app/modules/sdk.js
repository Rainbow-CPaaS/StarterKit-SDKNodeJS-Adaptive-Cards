'use strict';

const NodeSDK = require('rainbow-node-sdk');
const logger = require('./logger');
const fs = require('fs');
const xmlescape = require('xml-escape');

const serialize = require('safe-stable-stringify');

const ACData = require('adaptivecards-templating');

const LOG_ID = 'STARTER/SDKN - ';

const TAGS = ['weather', 'weather2', 'reminder', 'agenda', 'activity', 'restaurant', 'video', 'food'];

class SDK {

  constructor() {
    logger.log('debug', LOG_ID + 'constructor()');
    this.nodeSDK = null;
  }

  start(bot, argv) {
    return new Promise((resolve) => {

      if (argv.length >= 4) {
        bot.credentials.login = argv[2];
        bot.credentials.password = argv[3];
        logger.log('info', LOG_ID + 'using ' + bot.credentials.login + ' (forced by CLI)');
      }

      // Start the SDK
      this.nodeSDK = new NodeSDK(bot);

      this.nodeSDK.events.on('rainbow_onmessagereceived', (message) => {
        // send manually a 'read' receipt to the sender
        this.nodeSDK.im.markMessageAsRead(message);

        let content = {};
        let msg = '';

        if (Array.isArray(message.alternativeContent) && message.alternativeContent.length) {
          const response = message.alternativeContent.find(value => ['rainbow/json'].includes(value.type));
          if (response) {
            //const message = JSON.parse( response.message);
            content = {
              type: 'text/markdown',
              message: 'Thank you!'
            };
          }
        } else if (message.content.startsWith('#')) {
          const tag = message.content.toLowerCase().substring(1)
          if (TAGS.includes(tag)) {
            content = {
              type: 'form/json',
              message: serialize.default(this.buildCard(tag))
            };
          } else {
            switch (tag) {
              case 'help':
                content = {
                  type: 'text/markdown',
                  message: `### The following tags are available:\n\n${TAGS.reduce((prev, current) => {
                    return prev + '* \\#' + current + '\n';
                  }, '')}`
                };
                msg = `The following tags are available:\n\n${TAGS.reduce((prev, current) => {
                  return prev + '#' + current + '\n';
                }, '# help\n')}`;
                break;
            }
          }
        }

        // send an answer
        if (message.type === 'chat') {
          this.nodeSDK.im.sendMessageToJid(msg || 'ok', message.fromJid, 'en', content);
        } else if (message.type === 'groupchat') {
          this.nodeSDK.im.sendMessageToBubbleJid(msg || 'ok', message.fromBubbleJid, 'en', content);
        }
      });

      this.nodeSDK.start().then(() => {
        logger.log('debug', LOG_ID + 'SDK started');
        resolve();
      });
    });
  }

  restart() {
    return new Promise((resolve, reject) => {
      this.nodeSDK.events.once('rainbow_onstopped', (data) => {
        logger.log('debug', LOG_ID + 'SDK - rainbow_onstopped - rainbow event received. data', data);

        logger.log('debug', LOG_ID + 'SDK - rainbow_onstopped rainbow SDK will re start');
        this.nodeSDK.start().then(() => {
          resolve();
        });
      });

      this.nodeSDK.stop();
    });
  }

  get state() {
    return this.nodeSDK.state;
  }

  get version() {
    return this.nodeSDK.version;
  }

  get sdk() {
    return this.nodeSDK;
  }

  buildCard(type) {
    const content = JSON.parse(fs.readFileSync(`app/templates/${type}.json`, 'utf8'));
    // Create a Template instance from the template payload
    const template = new ACData.Template(content);
    const context = {
      $root: JSON.parse(fs.readFileSync(`app/templates/samples/${type}-sample.json`, 'utf8'))
    };
    const card = template.expand(context);

    return card;

  }
}

module.exports = new SDK();
