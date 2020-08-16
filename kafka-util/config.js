/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

//const kafka_topic =  process.env.kafka_topic || properties.get('kafka_topic')
//const kafka_topic  = 'social'
//const kafka_host = process.env.kafka_host || properties.get('kafka_host')
//const kafka_port = process.env.kafka_port || properties.get('kafka_port')

//const kafka_server =  kafka_host + ":" + kafka_port

const kafka_topic  = process.env.kafka_topic || properties.get('kafka_topic')
const kafka_server = process.env.kafka_server || properties.get('kafka_server')

module.exports = {
  kafka_topic,
  kafka_server
  };
