/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */

const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

var log = require('../Logger/log');

const Pool=require('pg').Pool
var client = null;

const pg_host = process.env.pg_host || properties.get('pg_host')
const pg_port = process.env.pg_port || properties.get('pg_port')
const username = process.env.pg_username || properties.get('pg_username')
const password = process.env.pg_password || properties.get('pg_password')
const enable_password = process.env.enable_pg_password || properties.get('enable_pg_password').toString()
const pg_db = process.env.pg_db || properties.get('pg_db')

function connectClient() {
    if(enable_password.toLowerCase()=="true"){
            client=new Pool({
            host: pg_host,
            database: pg_db,
            port: pg_port,
            password: password,
            user: username
        })
    }
    else{
            client=new Pool({
            host: pg_host,
            database: pg_db,
            port: pg_port
        })
    }
}
function executeQuery(query, params) {
	if (client === null) {
		connectClient();
	}
	return new Promise((resolve,reject)=>{
        client.query(query, params)
        .then((result) => {
			log.info('Results: ' + result);
			resolve(result)
		}).catch((err) => {
			log.error('error: ' + err);
			reject(err);
		})
	})
}
module.exports = {executeQuery}