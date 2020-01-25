'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
// send topic along with payload on mcb

// sample usage -- connect from ES6 code
// import { mqttClient } from 'mqtt-client';
// mqttClient.connect('myStaticAppName');

// sample usage -- connect from ES5 code
// var mqttClient = require('mqtt-client').mqttClient;
// mqttClient.connect('myStaticAppName');

var shortid = require('shortid');
var mqtt = require('mqtt');

var MQTTClient = function () {
  function MQTTClient(logger) {
    _classCallCheck(this, MQTTClient);

    this.multipleLevelWildcard = '#';
    this.singleLevelWildcard = '+';
    this.subscriptions = [];
    this.id = this.id ? this.id : shortid.generate();
    this.options = {
      appName: this.id,
      logger: logger ? logger : console
    };
  }

  // [appName, [Logger|brokerAddr], [Logger|brokerAddr] | optionsObj]


  _createClass(MQTTClient, [{
    key: 'connect',
    value: function connect(param1, opt1, opt2) {
      if (typeof param1 === 'string') {
        this.options.appName = param1;
        this.logger = typeof opt1 !== 'string' ? opt1 : opt2;
        var allegedBroker = typeof opt1 === 'string' ? opt1 : opt2;
        allegedBroker = allegedBroker || 'localhost';
        if (/localhost/i.test(allegedBroker)) {
          allegedBroker = window ? 'localhost:8000' : 'localhost:1883';

          // allegedBroker = (window) ? this.localhostReplacement('ws://localhost:8000', window.location) : 'mqtt://localhost:1883';
          // this.options.logger.info('allegedBroker after localhostReplacement:' + allegedBroker);
          var _allegedBroker$split = allegedBroker.split(':');

          var _allegedBroker$split2 = _slicedToArray(_allegedBroker$split, 2);

          this.options.host = _allegedBroker$split2[0];
          this.options.port = _allegedBroker$split2[1];
        }
        this.options.mqttBroker = allegedBroker;
      }
      if ((typeof param1 === 'undefined' ? 'undefined' : _typeof(param1)) === 'object') {
        this.options = Object.assign(this.options, param1);
        this.options.mqttBroker = this.options.host + ':' + this.options.port;
      }
      this.options.appName = this.options.appName || this.id;
      this.options.will = { topic: 'died/' + this.options.appName };
      this.options.will.payload = JSON.stringify(this.options.will);
      this.options.logger.info('id: ', this.id, ' broker: ' + this.options.mqttBroker + ' as: ' + this.options.username || this.options.appName);
      this.mqttClient = mqtt.connect(this.options);
      this.mqttClient.on('connect', this.onConnected());
    }
  }, {
    key: 'isReady',
    value: function isReady() {
      return !!this.mqttClient;
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      var endHardFast = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      try {
        this.mqttClient.end(endHardFast);
      } catch (err) {
        this.options.logger.error('disconnect threw:', err);
      }
    }
  }, {
    key: 'publish',
    value: function publish(topic) {
      var message = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var pcb = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : this.noop;

      try {
        if (!topic) {
          throw new Error('topic not supplied');
        }
        this.mqttClient.publish(topic, message, options, pcb);
      } catch (err) {
        this.options.logger.error('publish threw:', err);
      }
    }
  }, {
    key: 'subscribe',
    value: function subscribe(topic, options, mcb) {
      var scb = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : this.noop;

      try {
        if (!topic) {
          throw new Error('topic not supplied');
        }
        if (!options) {
          throw new Error('topicOptions not supplied');
        }
        if (!mcb) {
          throw new Error('messageCallback not supplied');
        }
        if (!this.mqttClient) {
          throw new Error('this.mqttClient not defined');
        }
        this.mqttClient.subscribe(topic, options, this.onSubscribed(mcb, scb));
      } catch (err) {
        this.options.logger.error('subscribe threw:', err);
      }
    }
  }, {
    key: 'unsubscribe',
    value: function unsubscribe(topic) {
      var ucb = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.noop;

      try {
        if (!topic) {
          throw new Error('topic not supplied');
        }
        this.mqttClient.unsubscribe(topic, this.onUnsubscribed(ucb));
      } catch (err) {
        this.options.logger.error('unsubscribe threw:', err);
      }
    }
  }, {
    key: 'noop',
    value: function noop() {}
  }, {
    key: 'requestReply',


    // reply is _always_ the topicRequest with /reply suffix
    value: function requestReply(topicRequest, requestPayload) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : { qos: 2 };

      try {
        var that = this;
        if (!topicRequest) {
          throw new Error('topicRequest not supplied');
        }
        var uniqueRequest = topicRequest + (topicRequest.slice(-1) === '/' ? '' : '/') + shortid.generate();
        var topicReply = uniqueRequest + (uniqueRequest.slice(-1) === '/' ? '' : '/') + 'reply';
        return new Promise(function (resolve, reject) {
          options.timeLimit = options.timeLimit || 25000;
          var overtime = setTimeout(function () {
            reject(new Error(JSON.stringify({ error: 'timeout on request-reply for topic: ' + uniqueRequest })));
          }, options.timeLimit);
          that.subscribe(topicReply, { qos: options.qos }, function (replyPayload) {
            that.unsubscribe(topicReply, function (err) {
              if (err) {
                reject(new Error(JSON.stringify({ msg: 'unsubscribe error, ' + err, payload: replyPayload })));
              }
            });
            clearTimeout(overtime);
            resolve(replyPayload);
          }, function (err) {
            if (err) {
              reject(new Error(JSON.stringify({ msg: 'subscribe error, ' + err, payload: requestPayload })));
            } else {
              that.publish(uniqueRequest, requestPayload, { qos: options.qos });
            }
          });
        });
      } catch (err) {
        this.options.logger.error('requestReply threw:', err);
      }
    }
  }, {
    key: 'onUnsubscribed',
    value: function onUnsubscribed(cb) {
      return function (error) {
        if (typeof cb === 'function') {
          cb(error);
        }
      };
    }
  }, {
    key: 'onSubscribed',
    value: function onSubscribed(mcb, scb) {
      var that = this;
      return function (error, granted) {
        granted.forEach(function (sub) {
          var subRegStr = sub.topic.replace(that.singleLevelWildcard, '[^/]*').replace(that.multipleLevelWildcard, '.*');
          that.subscriptions.push({ regEx: new RegExp(subRegStr), cb: mcb });
        });
        scb();
      };
    }
  }, {
    key: 'onConnected',
    value: function onConnected() {
      var mqttClient = this.mqttClient;
      var onMessageCB = this.onMessage();
      return function (packet) {
        mqttClient.on('message', onMessageCB);
      };
    }
  }, {
    key: 'onMessage',
    value: function onMessage() {
      var that = this;
      return function (topic, payloadBuff) {
        that.subscriptions.forEach(function (sub) {
          if (sub.regEx.test(topic)) {
            sub.cb(payloadBuff, topic);
          }
        });
      };
    }
  }, {
    key: 'localhostReplacement',
    value: function localhostReplacement(givenUrl, windowLocation) {
      if (!windowLocation) {
        return givenUrl;
      }
      var windowURL = new URL(windowLocation);
      var substituteLocalhost = windowURL.searchParams ? windowURL.searchParams.get('localhost') : '';
      var allegedURL = new URL(givenUrl);
      if (substituteLocalhost && /localhost/i.test(allegedURL.hostname)) {
        allegedURL.hostname = substituteLocalhost; // preserve any port value
        return allegedURL.toString();
      }
      return givenUrl;
    }
  }]);

  return MQTTClient;
}();

module.exports = {
  mqttClient: new MQTTClient()
};