/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
//logger to log
var log = require('../Logger/log');

const cassandra = require('cassandra-driver');

var config = require('../ConfigReader/loader');

const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

var client = null;


// const cassandraHost = config.getProperty('cassandra_host');
// const cassandraKeyspace = config.getProperty('cassandra_keyspace');

//password enabling
// const userName = config.getProperty('cassandra_username');
// const password = config.getProperty('cassandra_password');
// const port = config.getProperty('cassandra_port');
// const enable_password = config.getProperty('enable_cassandra_password')

//for localhost
const cassandraHost = process.env.cassandra_host || properties.get('cassandra_host')
const cassandraKeyspace = process.env.cassandra_keyspace || properties.get('cassandra_keyspace')

//password enabling
const userName = process.env.cassandra_username || properties.get('cassandra_username')
const password = process.env.cassandra_password || properties.get('cassandra_password')
const port = process.env.cassandra_port || properties.get('cassandra_port')
const enable_password = process.env.enable_cassandra_password || properties.get('enable_cassandra_password').toString().toLowerCase()

var authProvider = new cassandra.auth.PlainTextAuthProvider(userName,password);


function connectClient() {
	if(enable_password == "true"){
		client = new cassandra.Client({
			contactPoints: [cassandraHost],
			localDataCenter: 'datacenter1',
		keyspace: cassandraKeyspace,
		authProvider : authProvider,
		protocolOptions :{
			port : port
		}
		});
	}
	else{
		client = new cassandra.Client({
			contactPoints: [cassandraHost],
			localDataCenter: 'datacenter1',
		keyspace: cassandraKeyspace
		});
	}
}

function executePaginatedQuery(query, params, fetchSize, pageState) {
	if (client === null) {
		connectClient();
	}
	options = {
		prepare: true,
		fetchSize: fetchSize
	}
	if(pageState != null) {
		options['pageState'] = pageState
	}
	return new Promise((resolve,reject)=>{
		client.execute(query, params, options)
		.then((result) => {
			log.info('Results: ' + result);
			resolve(result)
		}).catch((err) => {
			log.error('error: ' + err);
			reject(err);
		})
	})
}

function executeQuery(query, params) {
	if (client === null) {
		connectClient();
	}
	return new Promise((resolve,reject)=>{
		client.execute(query, params, {
			prepare: true
		}).then((result) => {
			log.info('Results: ' + result);
			resolve(result)
		}).catch((err) => {
			log.error('error: ' + err);
			reject(err);
		})
	})
}

/**
 * Will execute the queries supplied as a batch.
 * @param {queriesArray} queriesWithParamsObjArr
 * @param {*} callback
 */

function executeBatch(queriesWithParamsObjArr) {
	if (validateBatchQueries(queriesWithParamsObjArr)) {
		if (client === null) {
			connectClient();
		}
		return new Promise ((resolve,reject)=>{
			client.batch(queriesWithParamsObjArr, {
				prepare: true
			}).then(result => {
				resolve(result)
			}).catch((err) => {
				log.error('error' + err)
				reject(err);
			});
		})
	} else {
		return new Promise((_resolve,reject) => {
			reject({'err': 'Internal Server Error','msg': 'Batch queries were not properly structured'})
		})
	}
}

function executeCounterBatch(queriesWithParamsObjArr) {
	if (validateBatchQueries(queriesWithParamsObjArr)) {
		if (client === null) {
			connectClient();
		}
		return new Promise ((resolve,reject)=>{
			client.batch(queriesWithParamsObjArr, {
				prepare: true,counter:true
			}).then(result => {
				resolve(result)
			}).catch((err) => {
				log.error('error' + err)
				reject(err);
			});
		})
	} else {
		return new Promise((_resolve,reject) => {
			reject({'err': 'Internal Server Error','msg': 'Batch queries were not properly structured'})
		})
	}
}
/**
 * Validates the input for the queries arrays.
 * Sample structure for queries array
 * queries = [
  {
    query: 'UPDATE user_profiles SET email=? WHERE key=?',
    params: [ emailAddress, 'hendrix' ]
  },
  {
    query: 'INSERT INTO user_track (key, text, date) VALUES (?, ?, ?)',
    params: [ 'hendrix', 'Changed email', new Date() ]
  }
]
 * @param {Array of query objects} queriesArr
 */

function validateBatchQueries(queriesArr) {
	if (queriesArr instanceof Array) {
		for (var i = 0; i < queriesArr; i++) {
			if (queriesArr[i].query && typeof queriesArr[i].query == 'string' && queriesArr[i].params && queriesArr[i].params instanceof Array) {
				// Valid structure, can make come changes to data here later
			} else {
				return false;
			}
		}
		return true;
	} else {
		return false;
	}
}
module.exports = {
	executeQuery, executeBatch, executeCounterBatch, executePaginatedQuery
}