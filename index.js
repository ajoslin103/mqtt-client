
// ajoslin, july 2016
// this module is intended to be used in an Aurelia project, see the singleton & logging code
// The primary reason for this code is to support a router for incoming messages.
// MQTT standard is to send all topics to a single onMessage routine (usually contining a giant switch statement)
//
// This code creates a wrapper around the subscribe method to associate multiple callbacks with
// 	each subscribed topic, the internally assigned on_message call then calls all functions associated with the received topic.
//
// The secondary reason is to provide a promise-based private request-reply feature, the topicReply must be the topicRequest with a /reply suffix

// ajoslin, november 2017
// encapsulated this code into a module for sharing across projects
// export an instantiation to make it a singleton

// ajoslin, january 2018
// changes for use by both NodeJS & Web Browser
//  logger via params to remove requirement for aurelia
//  test for window before doing localhostReplacement
//  get rid of ES6 features

// sample usage -- only connect once (from main)
// import mqttClient from 'mqtt-client';
// mqttClient.connect(environment.mqttAppName, Console);

var shortid = require('shortid');
var mqtt = require('mqtt');

class MQTTClient {

    constructor(logger) {
        this.multipleLevelWildcard = '#';
        this.singleLevelWildcard = '+';
        this.subscriptions = [];
        this.mqttBroker = 'mqtt://localhost:1883';
        this.logger = (logger) ? logger : console;
        this.id = (this.id) ? this.id : shortid.generate();
        try {
            this.mqttBroker = this.localhostReplacement('ws://localhost:8000', window.location);
        } catch (ignored) { }
    }

    // appName, [Console|brokerAddr], [Console|brokerAddr]
    connect(appName, opt1, opt2) {
        let allegedBroker = (typeof opt1 === 'string') ? opt1 : opt2
        let allegedLogger = (typeof opt1 !== 'string') ? opt1 : opt2
        allegedBroker = (allegedBroker !== 'localhost') ? allegedBroker : 'mqtt://localhost:1883';
        this.logger = (allegedLogger) ? allegedLogger : console;
        this.mqttBroker = allegedBroker || this.mqttBroker;
        let will = { topic: appName + '/died' };
        will.payload = JSON.stringify(will);
        this.logger.info('mqttClient.id', this.id);
        this.logger.debug('connect with broker as: ' + appName + ' at: ' + this.mqttBroker);
        this.mqttClient = mqtt.connect(this.mqttBroker, { will: will });
        this.mqttClient.once('connect', this.onConnected());
    };

    isReady() {
        return !!this.mqttClient;
    };

    disconnect(endHardFast = false) {
        try {
            this.logger.debug('disconnect from broker at: ' + this.mqttBroker);
            this.mqttClient.end(endHardFast);
        } catch (err) {
            this.logger.error('disconnect threw:', err);
        }
    };

    publish(topic, message, options, pcb) {
        try {
            this.mqttClient.publish(topic, message, options, (pcb) ? pcb : this.noop);
        } catch (err) {
            this.logger.error('publish threw:', err);
        }
    };

    subscribe(topic, options, mcb, scb) {
        try {
            if (!mcb) { throw new Error('messageCallback not supplied'); }
            if (!options) { throw new Error('topicOptions not supplied'); }
            this.mqttClient.subscribe(topic, options, this.onSubscribed(mcb, (scb) ? scb : this.noop));
        } catch (err) {
            this.logger.error('subscribe threw:', err);
        }
    };

    unsubscribe(topic, ucb) {
        try {
            this.mqttClient.unsubscribe(topic, this.onUnsubscribed((ucb) ? ucb : this.noop));
        } catch (err) {
            this.logger.error('unsubscribe threw:', err);
        }
    };

    noop() { };

    // reply is _always_ the topicRequest with /reply suffix
    requestReply(topicRequest, requestPayload, options = { qos: 2 }) {
        try {
            const uniqueRequest = topicRequest + shortid.generate();
            const topicReply = uniqueRequest + '/reply';
            return new Promise(function (resolve, reject) {
                options.timeLimit = (options.timeLimit || 25000);
                var overtime = setTimeout(function () {
                    resolve(JSON.stringify({ error: 'timeout on request-reply for topic: ' + uniqueRequest }))
                }, options.timeLimit);
                this.subscribe(topicReply, { qos: options.qos }, function (replyPayload) {
                    this.unsubscribe(topicReply, function (err) {
                        if (err) {
                            resolve(JSON.stringify({ msg: 'unsubscribe error, ' + err, payload: replyPayload }));
                        }
                    });
                    clearTimeout(overtime);
                    resolve(replyPayload);
                }, function (err) {
                    if (err) {
                        reject(JSON.stringify({ msg: 'subscribe error, ' + err, payload: requestPayload }));
                    } else {
                        this.publish(uniqueRequest, requestPayload, { qos: options.qos });
                    }
                });
            });
        } catch (err) {
            this.logger.error('requestReply threw:', err);
        }
    };

    onUnsubscribed(cb) {
        return function (error) {
            if (typeof cb === 'function') { cb(error); }
        };
    };

    onSubscribed(mcb, scb) {
        const that = this;
        return function (error, granted) {
            granted.forEach(function (sub) {
                var subRegStr = sub.topic.replace(that.singleLevelWildcard, '[^/]*').replace(that.multipleLevelWildcard, '.*');
                that.subscriptions.push({ regEx: new RegExp(subRegStr), cb: mcb });
            });
            scb();
        };
    };

    onConnected() {
        var mqttClient = this.mqttClient;
        var onMessageCB = this.onMessage();
        return function (packet) {
            mqttClient.on('message', onMessageCB);
        };
    };

    onMessage() {
        const that = this;
        return function (topic, payloadBuff) {
            that.subscriptions.forEach(function (sub) {
                if (sub.regEx.test(topic)) {
                    sub.cb(payloadBuff);
                }
            });
        };
    };

    localhostReplacement(givenUrl, windowLocation) {
        if (!windowLocation) {
            return givenUrl;
        }
        const windowURL = new URL(windowLocation);
        const substituteLocalhost = (windowURL.searchParams) ? windowURL.searchParams.get('localhost') : '';
        const allegedURL = new URL(givenUrl);
        if (substituteLocalhost && /localhost/i.test(allegedURL.hostname)) {
            allegedURL.hostname = substituteLocalhost; // preserve any port value
            return allegedURL.toString();
        }
        return givenUrl;
    }
}

module.exports = new MQTTClient();
