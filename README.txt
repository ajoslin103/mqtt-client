NOTE: to regenerate the ES-2015 version after good changes execute: npm run build 


ajoslin, july 2016
    This module is intended to be used in an Aurelia project, see the singleton & logging code

    The primary reason for this code is to support a router for incoming messages.
    MQTT standard is to send all topics to a single onMessage routine (usually contining a giant switch statement)

        This code creates a wrapper around the subscribe method to associate multiple callbacks with
            each subscribed topic, the internally assigned on_message call then calls all functions associated with the received topic.

    The secondary reason is to provide a promise-based private request-reply feature, the topicReply must be the topicRequest with a /reply suffix

ajoslin, november 2017
    encapsulated this code into a module for sharing across projects
    export an instantiation to make it a singleton

ajoslin, january 2018
    changes for use by both NodeJS & Web Browser
        logger via params to remove requirement for aurelia
        test for window before doing localhostReplacement
        setup a build command to pre-compile ES6 features
        send topic along with payload on mcb

ajoslin, january 2020
    default the appName to the internal guid when not supplied


sample usage -- connect from ES6 code
    import { mqttClient } from 'mqtt-client';
    mqttClient.connect('myStaticAppName');

sample usage -- connect from ES5 code
    var mqttClient = require('mqtt-client').mqttClient;
    mqttClient.connect('myStaticAppName');
