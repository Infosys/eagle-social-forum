/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const esdb = require('../ESUtil/elasticSearch');

const log = require('../Logger/log');

const cassdb = require('../CassandraUtil/cassandra')
//uuid based on timestamp
const uuidv1 = require('uuid/v1');

//reusing the follow services
const followController = require('../routes/follow/follow.controller')

//importing the querybuilder to build cassandra and ElasticSearch queries
const queryBuilder = require('./queryBuilder')


async function fallback(fallbackObject) {
    try {
        if (fallbackObject.fallbackType == "update-cass-fail") {
            updateResult = await cassdb.executeBatch(fallbackObject.queries)
            log.info("successfully updated the parent" + updateResult)
        }
        if (fallbackObject.fallbackType == "insert-cass-fail") {
            insertResult = await cassdb.executeQuery(fallbackObject.queries[0], fallbackObject.queries[1])
            log.info("successfully inserted in cassandra" + insertResult)
        }

    } catch (error) {
        log.error("cassandra operation failed" + JSON.stringify(error))
    }

}

async function retry(retryObject) {
    try {
        if (retryObject.retryType == 'insert-post-thread-fail') {
            postInsertresult = retryObject.result[0]
            threadInsertResult = retryObject.result[1]

            if (postInsertresult.hasOwnProperty('status') == true && threadInsertResult.hasOwnProperty('status') == false) {
                let retryInsertResult = await esdb.createData(retryObject.queries[0], "postType", "postIndex")
                if (restryInsertResult.created == true) {
                    log.info("successfully inserted in the postIndex" + retryInsertResult)
                    return true
                }
                else {
                    cassDeleteQuery = 'delete from bodhi.post where root_org = ? and org=? and post_id=?'
                    cassDeleteParams = [retryObject.queries[0].rootOrg, retryObject.queries[0].org, retryObject.queries[0].id]
                    log.error('insertion fail in either post index after retry' + retryInsertResult)
                    let deleteResult = await Promise.all([
                        esdb.deleteData(retryObject.queries[1].id, "threadType", "threadIndex")
                            .then(result => result)
                            .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                        cassdb.executeQuery(cassDeleteQuery, cassDeleteParams)
                    ])
                    log.info("deleted data from thread index and cassandra" + deleteResult)
                    return false
                }
            }
            else if (postInsertresult.hasOwnProperty('status') == false && threadInsertResult.hasOwnProperty('status') == true) {
                let retryInsertResult = await esdb.createData(retryObject.queries[1], "threadType", "threadIndex")
                if (restryInsertResult.created == true) {
                    log.info("successfully inserted in the thread Index" + retryInsertResult)
                    return true
                }
                else {
                    cassDeleteQuery = 'delete from bodhi.post where root_org = ? and org=? and post_id=?'
                    cassDeleteParams = [retryObject.queries[1].rootOrg, retryObject.queries[1].org, retryObject.queries[1].id]
                    log.error('insertion fail in either thread index after retry' + retryInsertResult)
                    let deleteResult = await Promise.all([
                        esdb.deleteData(retryObject.queries[0].id, "postType", "postIndex")
                            .then(result => result)
                            .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                        cassdb.executeQuery(cassDeleteQuery, cassDeleteParams)
                    ])
                    log.info("deleted data from post index and cassandra" + deleteResult)
                    return false
                }
            }
            else {
                let retryInsertResult = await Promise.all([
                    esdb.createData(retryObject.queries[0], "postType", "postIndex")
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                    esdb.createData(retryObject.queries[1], "threadType", "threadIndex")
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                ])
                if (retryInsertResult[0].hasOwnProperty('status') == true || retryInsertResult[0].hasOwnProperty('status') == true) {
                    cassDeleteQuery = 'delete from bodhi.post where root_org = ? and org=? and post_id=?'
                    cassDeleteParams = [retryObject.queries[1].rootOrg, retryObject.queries[1].org, retryObject.queries[1].id]
                    log.error('insertion fail in either post or thread index after retry' + retryInsertResult)
                    let deleteResult = await cassdb.executeQuery(cassDeleteQuery, cassDeleteParams)
                    log.info("deleted data from cassandra" + deleteResult)
                    return false
                }
                else {
                    log.info("successfully inserted in postIndex and threadIndex" + retryInsertResult)
                    return true
                }
            }
        }

        if (retryObject.retryType == 'insert-post-fail') {
            postInsertresult = retryObject.result[0]

            let retryInsertResult = await esdb.createData(retryObject.queries[0], "postType", "postIndex")
            if (retryInsertResult.created == true) {
                log.info("successfully inserted in post Index" + retryInsertResult)
                return true
            }
            else {
                log.error("unsuccessfull insertion in post Index" + retryInsertResult)
                cassDeleteQuery = 'delete from bodhi.post where root_org = ? and org=? and post_id=?'
                cassDeleteParams = [retryObject.queries[0].rootOrg, retryObject.queries[0].org, retryObject.queries[0].id]
                let deleteResult = await cassdb.executeQuery(cassDeleteQuery,cassDeleteParams)
                log.info("deleted data from post index and cassandra" + deleteResult)
                return false
            }
        }

        if (retryObject.retryType == 'update-post-fail') {

            let retryUpdateResult = await esdb.updateData(retryObject.queries[0], "postType", "postIndex")
            if (retryUpdateResult.created == true) {
                log.info("successfully updation in post Index" + retryUpdateResult)
                return true
            }
            else {
                log.error("unsuccessfull updation in post Index" + retryUpdateResult)
                return false
            }
        }

        if (retryObject.retryType == 'update-post-thread-fail') {
            postUpdateResult = retryObject.result[0]
            threadUpdateResult = retryObject.result[1]

            if (postUpdateResult.hasOwnProperty('status') == true && threadUpdateResult.hasOwnProperty('status') == false) {
                let retryUpdateResult = await esdb.updateData(retryObject.queries[0], "postType", "postIndex")
                if (retryUpdateResult.result == 'updated') {
                    log.info("successfully updated in the post Index" + retryUpdateResult)
                    return true
                }
                else {
                    log.error("unsuccessfull updation of parent in post index" + retryUpdateResult)
                    return false
                }
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == true) {
                let retryUpdateResult = await esdb.updateData(retryObject.queries[1], "threadType", "ThreadIndex")
                if (retryUpdateResult.result == "updated") {
                    log.info("successfully updated parent in the thread Index" + retryUpdateResult)
                    return true
                }
                else {
                    log.error("unsuccessfull updation of parent in post index" + retryUpdateResult)
                    return false
                }
            }
            else {
                let retryUpdateResult = await Promise.all([
                    esdb.updateData(retryObject.queries[0], "postType", "postIndex")
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                    esdb.updateData(retryObject.queries[1], "threadType", "ThreadIndex")
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                ])

                if (retryUpdateResult[0].hasOwnProperty('status') == true || retryUpdateResult[1].hasOwnProperty('status') == true) {
                    log.error("unsuccessfull updation of parent in either post index or thread index" + retryUpdateResult)
                    return false
                }
                else {
                    log.info("successfull updation of parent in both post index and thread index" + retryUpdateResult)
                    return true
                }
            }
        }
        if(retryObject.retryType == 'bulk-update-insert-hashtag-failed'){
            let retryBulkResult = await esdb.bulkData(retryObject.queries[0])
            if (retryBulkResult.hasOwnProperty('errors')==true && retryBulkResult.errors == false) {
                log.info("successfully updation in hashtag Index" + retryBulkResult)
                return true
            }
            else {
                log.error("unsuccessfull updation in hashtag Index" + retryBulkResult)
                return false
            }
        }
    } catch (error) {
        log.error("unexpected error" + error)
        return false
    }
}



module.exports = {
    fallback,
    retry
}