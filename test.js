
const MQTTClient = require('mqtt-client');
console.log(MQTTClient);

let mqttClient = new MQTTClient();
console.log(mqttClient);

mqttClient.connect('testBackend'); // blocks until disconnect

mqttClient.subscribe('test/backend', { qos: 2 }, data => {
    let msg = data.toString();
    console.info('test/backend', msg);
    mqttClient.unsubscribe('test/backend');
    mqttClient.disconnect();
});


