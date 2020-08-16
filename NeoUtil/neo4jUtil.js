/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const neo4j = require('neo4j-driver').v1;
let driver = null;
let neoSession = null;
const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

const neoUrl = process.env.neoUrl || properties.get('neoUrl')

function connectToNeo(){
    //var uri = "bolt://localhost"
    var uri = neoUrl
    driver = neo4j.driver(uri,neo4j.auth.basic('', ''))
    let session = driver.session();
    //console.log('Connected to driver : ',driver)
    return session;
}


function runQuery(query,params) {
    if (neoSession == null) {
        neoSession = connectToNeo();
    }
    return new Promise((resolve, reject) => {
        neoSession.run(query,params)
        .then((result) => {
            neoSession.close();
            //log.info('Results: ' + result);
            resolve(result)
        }).catch((err) => {
            //log.error('error: ' + err);
            reject(result)
        })
    })
}

function closeNeo(){
    driver.close();
}

module.exports = {
    connectToNeo,
    closeNeo,
    runQuery
}
