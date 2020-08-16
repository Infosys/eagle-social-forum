/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const kafka = require('kafka-node');
const bp = require('body-parser');
const config = require('./config')

const Producer = kafka.Producer;
const client = new kafka.KafkaClient({kafkaHost:config.kafka_server});
const producer = new Producer(client);

const KafkaService = {
    sendRecord: (message) => {
        const event = {
            data:message
        };
 
        const buffer = new Buffer.from(JSON.stringify(event));
 
        // Create a new payload
        const record = [
            {
                topic: config.kafka_topic,
                messages: buffer,
            }
        ];

        //Send record to Kafka and log result/error
        return new Promise ((resolve,reject) => {
            producer.send(record ,function(err,data){
                if(err){
                    reject(err)
                }
                else{
                    resolve(data)
                }
            })
        })
    }
};

module.exports = {
    KafkaService
}