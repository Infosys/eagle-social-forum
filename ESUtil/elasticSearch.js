/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const elasticsearch = require('elasticsearch');

// const config = require('../ConfigReader/loader');
const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

const log = require('../Logger/log');

let elasticSearchClient = null;

// setting elasticsearch variable
// const es_host = config.getProperty('es_host');
// const es_port = config.getProperty('es_port');

//password enabling
// const userName = config.getProperty('es_username');
// const password = config.getProperty('es_password');
// const enable_password = config.getProperty('enable_es_password')

const es_host = process.env.es_host || properties.get('es_host')
const es_port = process.env.es_port || properties.get('es_port')

//password enabling
const userName = process.env.es_username || properties.get('es_username')
const password = process.env.es_password || properties.get('es_password')
const enable_password = process.env.enable_es_password || properties.get('enable_es_password').toString().toLowerCase()

const indexDict = {
    threadIndex: process.env.es_thread_index || properties.get('es_thread_index'),
    threadType: process.env.es_thread_type || properties.get('es_thread_type'),
    threadTimelineTemplate: process.env.es_threadTimelineTemplate || properties.get('es_threadTimelineTemplate'),
    threadTimelineTemplate_v1: process.env.es_threadTimelineTemplate_v1 || properties.get('es_threadTimelineTemplate_v1'),
    postIndex: process.env.es_post_index || properties.get('es_post_index'),
    postType: process.env.es_post_type || properties.get('es_post_type'),
    postTemplate: process.env.es_postTemplate || properties.get('es_postTemplate'),
    userpostactivityIndex: process.env.es_userpostactivityIndex || properties.get('es_userpostactivityIndex'),
    userpostactivityType: process.env.es_userpostactivityType || properties.get('es_userpostactivityType'),
    userpostactivityTemplate: process.env.es_userpostactivityTemplate || properties.get('es_userpostactivityTemplate'),
    tagsIndex: process.env.es_tagsIndex || properties.get('es_tagsIndex'),
    tagsType: process.env.es_tagsType || properties.get('es_tagsType'),
    tagsTemplate: process.env.es_tagsTemplate || properties.get('es_tagsTemplate'),
    hashtagsIndex: process.env.es_hashtagsIndex || properties.get('es_hashtagsIndex'),
    hashtagsType: process.env.es_hashtagsType || properties.get('es_hashtagsType'),
    hashtagsTemplate: process.env.es_hashtagsTemplate || properties.get('es_hashtagsTemplate'),
    searchIndex_en : process.env.es_searchIndex_en || properties.get('es_searchIndex_en'),
    searchIndex_de : process.env.es_searchIndex_de || properties.get('es_searchIndex_de'),
    searchType: process.env.es_searchType || properties.get('es_searchType'),
    searchTemplate: process.env.es_searchTemplate || properties.get('es_searchTemplate'),
    contentSearchIndex : process.env.es_contentSearchIndex || properties.get('es_contentSearchIndex'),
    contentSearchType : process.env.es_contentSearchType || properties.get('es_contentSearchType')
}

var auth = userName + ":" + password
const connstring = "http://" + es_host + ":" + es_port

function connectClient() {
    if (enable_password == "true") {
        elasticSearchClient = new elasticsearch.Client({
            host: [{
                host: es_host,
                port: es_port,
                protocol: "http",
                auth: auth,
                log: 'trace',
                requestTimeout: 60000
            }]

        });
    }
    else {
        elasticSearchClient = new elasticsearch.Client({
            host: connstring,
            log: 'trace',
            requestTimeout: 60000
        });
    }
    //to check whether connected to elasticsearch

    elasticSearchClient.ping({ requestTimeout: 30000, }, function (error) {
        if (error) {
            console.log('Elasticsearch is down :' + error);
        }
        else {
            console.log('Elasicsearch up and running!!')
        }
    });
}

function getData(queryBody, paramType, paramIndex) {
    //console.log("index : ",indexDict[paramIndex])
    //console.log("Type : ",indexDict[paramType])
    if (elasticSearchClient == null) {
        connectClient();
    }
    return new Promise((resolve, reject) => {
        elasticSearchClient.search({
            index: indexDict[paramIndex],
            type: indexDict[paramType],
            body: queryBody
        }).then((result) => {
            log.info('Results: ' + result);
            resolve(result)
        }).catch((err) => {
            log.error('error: ' + err);
            reject(err)
        })
    })
}

function createData(queryBody, paramType, paramIndex) {
    if (elasticSearchClient == null) {
        connectClient();
    }
    return new Promise((resolve, reject) => {
        elasticSearchClient.create({
            index: indexDict[paramIndex],
            type: indexDict[paramType],
            id: queryBody.id,
            body: queryBody
        }).then((result) => {
            log.info('Results: ' + result);
            return new Promise((resolve1,reject1) =>{
                elasticSearchClient.indices.flush(
                    {
                        index: [indexDict["postIndex"], indexDict['threadIndex'], indexDict["userpostactivityIndex"], indexDict["hashtagsIndex"]],
                        wait_if_ongoing: false
                    }
                )
                .then(result1=>{
                    log.info('Results: ' + result1);
                    resolve(result)
                })
                .catch((err1) =>{
                    log.error('error: ' + err1);
                    reject(err1)
                })
            })
            
           // resolve(result)
        }).catch((err) => {
            log.error('error: ' + err);
            reject(err)
        })
    })
}

function updateData(queryBody, paramType, paramIndex) {
    if (elasticSearchClient == null) {
        connectClient();
    }
    return new Promise((resolve, reject) => {
        elasticSearchClient.update({
            index: indexDict[paramIndex],
            type: indexDict[paramType],
            id: queryBody.id,
            body: queryBody.body
        }).then((result) => {
            log.info('Results: ' + result);
            return new Promise((resolve1,reject1) =>{
                elasticSearchClient.indices.flush(
                    {
                        index: [indexDict["postIndex"], indexDict['threadIndex'], indexDict["userpostactivityIndex"], indexDict["hashtagsIndex"]],
                        wait_if_ongoing: false
                    }
                )
                .then(result1=>{
                    log.info('Results: ' + result1);
                    resolve(result)
                })
                .catch((err1) =>{
                    log.error('error: ' + err1);
                    reject(err1)
                })
            })
        }).catch((err) => {
            log.error('error: ' + err);
            reject(result)
        })
    })
}

function updateDataByQuery(queryBody, paramType, paramIndex) {
    if (elasticSearchClient == null) {
        connectClient();
    }
    return new Promise((resolve, reject) => {
        elasticSearchClient.updateByQuery({
            index: paramIndex,
            type: paramType,
            body: queryBody
        }).then((result) => {
            log.info('Result :' + result);
            return new Promise((resolve1,reject1) =>{
                elasticSearchClient.indices.flush(
                    {
                        index: [indexDict["postIndex"], indexDict['threadIndex'], indexDict["userpostactivityIndex"], indexDict["hashtagsIndex"]],
                        wait_if_ongoing: false
                    }
                )
                .then(result1=>{
                    log.info('Results: ' + result1);
                    resolve(result)
                })
                .catch((err1) =>{
                    log.error('error: ' + err1);
                    reject(err1)
                })
            })
        }).catch((err) => {
            log.error('error: ' + err);
            reject(result)
        })
    })
}

function bulkData(queryBody) {
    if (elasticSearchClient == null) {
        connectClient();
    }
    return new Promise((resolve, reject) => {
        elasticSearchClient.bulk({
            body: queryBody
        })
            .then((result) => {
                log.info('Results: ' + result);
                return new Promise((resolve1,reject1) =>{
                    elasticSearchClient.indices.flush(
                        {
                            index: [indexDict["postIndex"], indexDict['threadIndex'], indexDict["userpostactivityIndex"], indexDict["hashtagsIndex"]],
                            wait_if_ongoing: false
                        }
                    )
                    .then(result1=>{
                        log.info('Results: ' + result1);
                        resolve(result)
                    })
                    .catch((err1) =>{
                        log.error('error: ' + err1);
                        reject(err1)
                    })
                })
            }).catch((err) => {
                log.error('error: ' + err);
                reject(result)
            })
    })
}

function deleteData(deleteId, paramType, paramIndex) {
    if (elasticSearchClient == null) {
        connectClient();
    }
    return new Promise((resolve, reject) => {
        elasticSearchClient.delete({
            index: indexDict[paramIndex],
            type: indexDict[paramType],
            id: deleteId,
        }).then((result) => {
            log.info('Results: ' + result);
            return new Promise((resolve1,reject1) =>{
                elasticSearchClient.indices.flush(
                    {
                        index: [indexDict["postIndex"], indexDict['threadIndex'], indexDict["userpostactivityIndex"], indexDict["hashtagsIndex"]],
                        wait_if_ongoing: false
                    }
                )
                .then(result1=>{
                    log.info('Results: ' + result1);
                    resolve(result)
                })
                .catch((err1) =>{
                    log.error('error: ' + err1);
                    reject(err1)
                })
            })
        }).catch((err) => {
            log.error('error: ' + err);
            reject(result)
        })
    })
}

function templateSearch(queryBody, paramType, paramIndex, paramsTemplate) {
    if (elasticSearchClient == null) {
        connectClient();
    }
    paramIndexList = paramIndex.split(',')
    indexNamesList = []
    paramIndexList.forEach(element => {
        indexNamesList.push(indexDict[element])
    });
    indexNames = indexNamesList.join(',')
    console.log(indexNames)
    return new Promise((resolve, reject) => {
        elasticSearchClient.searchTemplate({
            index: indexNames,
            type: indexDict[paramType],
            body: {
                "id": indexDict[paramsTemplate],
                "params": queryBody
            }
        }).then((result) => {
            log.info('Results: ' + result);
            resolve(result)
        }).catch((err) => {
            log.error('error: ' + err);
            reject(result)
        })
    })
}


module.exports = {
    getData,
    createData,
    updateData,
    deleteData,
    updateDataByQuery,
    templateSearch,
    bulkData
};