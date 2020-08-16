/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const kafka = require('kafka-node');
const config = require('./config');
const searchController = require('../routes/search/search.controller')

const Consumer = kafka.Consumer;
const client = new kafka.KafkaClient({kafkaHost:config.kafka_server});
let consumer = new Consumer(
    client,
    [{ topic: config.kafka_topic, partition: 0 }],
    {
        autoCommit: true,
        fetchMaxWaitMs: 1000,
        fetchMaxBytes: 1024 * 1024,
        encoding: 'utf8',
        fromOffset: false
    }
);

try{
    consumer.on("message",function(message){
        // console.log("IN CONSUMER :",message)
        // let messageList = []
        // messageList.push(message.value)
        searchController.searchElastcInsert(message)
        
    })
    consumer.on('error', function (err) {
        console.log('error', err);
    });
}
catch(err){
    console.log(err)
}