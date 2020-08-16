/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const esdb = require('../../ESUtil/elasticSearch');

const log = require('../../Logger/log');

const cassdb = require('../../CassandraUtil/cassandra')
//uuid based on timestamp
const uuidv1 = require('uuid/v1');

//reusing the follow services
const followController = require('../follow/follow.controller')

const postController = require('../post/post.controller')

//importing the querybuilder to build cassandra and ElasticSearch queries
const queryBuilder = require('../../util/queryBuilder')

const fallbackRetryUtil = require('../../util/fallbackRetryUtil')
const searchController = require('../search/search.controller')

var request = require('request')
const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

const sbextIp = process.env.sbext_ip || properties.get('sbext_ip')
const sbextPort = process.env.sbext_port || properties.get('sbext_port')
//const defaultAccessPath = process.env.default_access_path || properties.get('default_access_path')

async function getAccessPaths(user_id, rootOrg) {
    let url = `http://${sbextIp}:${sbextPort}/accesscontrol/user/${user_id}?rootOrg=${rootOrg}`
    return new Promise((resolve, reject) => {
        request.get({
            url
        }, function (err, body) {
            if (err) {
                reject(err)
            }
            else {
                // console.log("Access Path",body)
                let result = JSON.parse(body.body)
                resolve(result.result.combinedAccessPaths)
            }
        })
    })
}

/**
 * gets the post based on the id, the index , type and the specified field names.
 * @param {*} identifier 
 * @param {*} paramType 
 * @param {*} paramIndex 
 * @param {*} source 
 * example call:-  getPostById(parentId, "postType", "postIndex", ['id', 'commentCount'])
 */
function getPostById(identifier, paramType, paramIndex, source) {
    try {
        let queryBody = {
            _source: source,
            query: {
                match: {
                    id: identifier
                }
            }
        }
        return esdb.getData(queryBody, paramType, paramIndex)
    } catch (error) {
        throw error
    }
}

function getHashTags(hashtags, paramType, paramIndex) {
    try {
        let result = []
        let hashTags_Lowercased = hashtags.map(v => v.toLowerCase());
        let checkhashtagsQuery = {
            "size": hashTags_Lowercased.length,
            "query": {
                "terms": {
                    "name.keyword": hashTags_Lowercased
                }
            }
        }

        return esdb.getData(checkhashtagsQuery, paramType, paramIndex)
        // console.log(hashTagsObj)
        // if(hashTagsObj.hits.total>0){
        //     result= hashTagsObj.hits.hits
        // }
        // return result
    } catch (error) {
        throw error
    }
}

/**
 * This function checks whether the given postid is the latest reply or not and returns the latestComment for date modifications
 * @param {*} parentId 
 * @param {*} postId 
 */
async function checkLatestReply(parentId, postId) {
    parentPost = await getPostById(parentId, "threadType", "threadIndex", ['latestReply'])
    latestReply = parentPost.hits.hits[0]._source['latestReply']

    if (latestReply.id == postId) {
        return { flag: true, result: latestReply }
    }
    else {
        return { flag: false }
    }

}

/**
 * This function takes in the parentid and postid and first checks if the given postid is latest reply or not, if yes then returns the next latest reply as well.
 * @param {*} parentId 
 * @param {*} postId 
 */
async function getLatestReply(parentId, postId) {
    try {
        var queryBody = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "parentId": {
                                    "value": parentId
                                }
                            }
                        },
                        {
                            "term": {
                                "postKind": {
                                    "value": "Reply"
                                }
                            }
                        },
                        {
                            "term": {
                                "status": {
                                    "value": "Active"
                                }
                            }
                        }
                    ]
                }
            },
            "sort": [
                {
                    "dtLastModified": {
                        "order": "desc"
                    }
                }
            ],
            size: 5
        }

        let result = await esdb.getData(queryBody, "postType", "postIndex")
        if (result.hits.hits.length != 0) {
            let latestReply = result.hits.hits[0]._source
            if (latestReply.id == postId) {
                if (result.hits.hits.length > 1) {
                    return { flag: true, nextLatestReply: result.hits.hits[1]._source }
                }
                else {
                    return { flag: true, nextLatestReply: {} }
                }
            }
            else {
                return { flag: false }
            }
        }
        else{
            return {flag : false}
        }



    } catch (error) {
        throw error
    }
}

/**
 * Gets the total thread contributor count of a user for a particular thread.
 * @param {*} postCreatorId 
 * @param {*} parentId 
 */
async function getThreadContributorCount(postCreatorId, parentId) {
    let query = {
        "size": 0,
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "parentId": {
                                "value": parentId
                            }
                        }
                    },
                    {
                        "nested": {
                            "path": "postCreator",
                            "query": {
                                "term": {
                                    "postCreator.postCreatorId": {
                                        "value": postCreatorId
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
    }

    result = await esdb.getData(query, "postType", "postIndex")

    return result.hits.total

}

/**
 * Gets the paramsbody from the request and then validates the users accessPaths based on whether it is from social or learning
 * @param {*} paramsBody 
 */
async function validateAccessPaths(paramsBody) {
    try {
        let finalAccessPaths = []

        let userAccessPath = await getAccessPaths(paramsBody.postCreator, paramsBody.rootOrg)
        if (paramsBody.hasOwnProperty('parentId') == false) {
            if (paramsBody.source.name.toLowerCase() == 'social') {
                for (let accessPath of paramsBody.accessPaths) {
                    if (userAccessPath.includes(accessPath)) {
                        finalAccessPaths.push(accessPath)
                    }
                }
            }
            else if (paramsBody.source.name.toLowerCase() == 'learning') {
                let result = await getPostById(paramsBody.source.id, "contentSearchType", "contentSearchIndex", ['accessPaths'])
                let learningIdAccessPath = result['hits']['hits'][0]['_source']['accessPaths']
                let commonPaths = []

                for (let accessPath of userAccessPath) {
                    if (learningIdAccessPath.includes(accessPath)) {
                        commonPaths.push(accessPath)
                    }
                }

                for (let accessPath of paramsBody.accessPaths) {
                    if (commonPaths.includes(accessPath)) {
                        finalAccessPaths.push(accessPath)
                    }
                }
            }
        }
        else {
            // let parentAccessPath = await getPostById(paramsBody.parentId,"postType","postIndex",['accessPaths'])
            let parentAccessPaths = paramsBody.parentAccessPaths
            for (let accessPath of userAccessPath) {
                if (parentAccessPaths.includes(accessPath)) {
                    finalAccessPaths.push(accessPath)
                }
            }
        }


        if (finalAccessPaths.length == 0) {
            throw { statuscode: 500, err: "access restricted", message: `There are no groups that match your access` }
        }
        else {
            return finalAccessPaths
        }
    }
    catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }

}
/**
 * publishes a new post or already drafted post
 * @param {*} paramsBody 
 */
async function publishPost(paramsBody) {
    try {
        let creatorDetails
        let accessPathsList = []
        let searchData = {
            "type": "",
            "postQuery": {},
            "threadQuery": {},
            "locale":"en"
        }
        if(paramsBody.hasOwnProperty('locale')==true && paramsBody.locale!=null && paramsBody.locale!=''){
            searchData.locale=paramsBody.locale.toLowerCase()
        }

        //to check wehther the post is a new post getting published or a drafted post getting published
        if (paramsBody.hasOwnProperty('id')) {
            id = paramsBody.id
            dateCreated = paramsBody.dateCreated
            //check userid and parentpost creator id to validate the authority
            authorValidation = await postController.validateAuthor(paramsBody.rootOrg, paramsBody.org, paramsBody.postCreator, paramsBody.id)
            //console.log(authorValidation)
        }
        else {
            id = uuidv1()
            dateCreated = new Date()
        }

        if (paramsBody.postKind.toLowerCase() == 'reply' || paramsBody.postKind.toLowerCase() == 'comment') {
            let parentResult = await getPostById(paramsBody.parentId, "postType", "postIndex", ['rootParentId', 'accessPaths', 'source', 'postKind'])

            if (parentResult['hits']['hits'][0]['_source']['postKind'] != 'Reply') {
                paramsBody.rootParentId = paramsBody.parentId
            }
            else {
                paramsBody.rootParentId = parentResult['hits']['hits'][0]['_source']['rootParentId']
            }
            paramsBody.parentAccessPaths = parentResult['hits']['hits'][0]['_source']['accessPaths']
            paramsBody.parentSource = parentResult['hits']['hits'][0]['_source']['source']
        }

        if (paramsBody.hasOwnProperty('accessPaths')) {
            accessPathsList = await validateAccessPaths(paramsBody)
        }
        else {
            // accessPaths = defaultAccessPath.split(',')
            // for (accessPath of accessPaths) {
            //     accessPathsList.push(accessPath.trim())
            // }
            //accessPathsList = await timelineUtilServices.getAccessPaths(request.userId, request.rootOrg)
            rootOrg_org_accesspath = paramsBody.rootOrg+"/"+paramsBody.org
            accessPathsList.push(paramsBody.rootOrg)
            accessPathsList.push(rootOrg_org_accesspath)
            //console.log(accessPathsList)
        }

        //get the creator details from the given uuid 
        creatorDetails = await followController.getuserprofile(paramsBody.rootOrg,paramsBody.postCreator)
        //console.log("***",creatorDetails)
        //get all the 3 query bodies from querybuilder 
        let postQueryBody = queryBuilder.getPostQueryBody(paramsBody, id, dateCreated, creatorDetails, accessPathsList, "Active")
        let threadQueryBody = queryBuilder.getThreadQueryBody(paramsBody, id, dateCreated, creatorDetails, accessPathsList, "Active")

        cassandraInsert = queryBuilder.getCassndraQuery(paramsBody, id, dateCreated, creatorDetails, accessPathsList, "Active")
        let cassandraInsertQuery = cassandraInsert[0]
        let cassandraInsertParams = cassandraInsert[1]

        //forming hashTagindex query
        let hashTagsQueryBody = []
        if (paramsBody.hasOwnProperty('hashTags') == true && paramsBody.hashTags.length > 0) {
            hashTagsData = await getHashTags(paramsBody.hashTags, "hashtagsType", "hashtagsIndex")
            let hashTagEsObj = []
            if (hashTagsData.hits.total > 0) {
                hashTagEsObj = hashTagsData.hits.hits
            }
            hashTagsQueryBody = queryBuilder.getHashTagQuery(paramsBody, hashTagEsObj)
        }

        //to check if a drafted post is getting published
        if (paramsBody.hasOwnProperty('id')) {
            let postUpdateQueryBody = {
                id: id,
                body: {
                    doc: postQueryBody
                }
            }

            let updateResult = await Promise.all([
                esdb.updateData(postUpdateQueryBody, "postType", "postIndex")
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                esdb.createData(threadQueryBody, "threadType", "threadIndex")
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                cassdb.executeQuery(cassandraInsertQuery, cassandraInsertParams)
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
            ])

            postResult = updateResult[0]
            threadResult = updateResult[1]
            cassResult = updateResult[2]

            /* 1. check the insertion result for any errors if there an insertion failure in post index or thread index
                  and there is no error in the cassandra post table then call the retry method and resolve the erro by retrying
                  the insertion if it still fails then delete the entry from cassndra
               2. if the insertion fails in cassandra and successful in both the indexes then call the fallback method to 
                  try to insert it again.
               3. if successfull in all 3 then send a 204 status 
             */
            if ((postResult.hasOwnProperty('status') == true || threadResult.hasOwnProperty('status') == true) && cassResult.hasOwnProperty('status') == false) {
                log.warn("error inserting in thread and post index caslling the retry funciton", [postResult, threadResult])
                retryObject = {
                    retryType: "insert-post-thread-fail",
                    queries: [postQueryBody, threadQueryBody],
                    result: updateResult
                }
                flag = await fallbackRetryUtil.retry(retryObject)
                if (flag) {
                    log.info("insertion successfully done")
                    if (paramsBody.hasOwnProperty('hashTags') == true && paramsBody.hashTags.length > 0) {
                        //let hashTagsQueryBody = queryBuilder.getHashTagQuery(paramsBody)
                        console.log("hashTagsQueryBody : ", hashTagsQueryBody)
    
                        // let hashTagResult = esdb.bulkData(hashTagsQueryBody)
                        // .then(esResult => esResult)
                        // .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                        let hashTagResult = await Promise.all([
                            esdb.bulkData(hashTagsQueryBody)
                                .then(esResult => esResult)
                                .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                        ])
                        console.log("hashTagResult : ", hashTagResult)
                        if (hashTagResult.hasOwnProperty('errors') == true && hashTagResult.errors == true) {
                            log.warn("error inserting in hashtag index calling the retry funciton", [hashTagResult])
                            retryObject = {
                                retryType: "bulk-update-insert-hashtag-failed",
                                queries: [hashTagsQueryBody],
                                result: hashTagResult
                            }
                            flag = await fallbackRetryUtil.retry(retryObject)
                            if (flag) {
                                log.info("insertion to hashtag index success")
                            }
                        }
                    }
                    result = { "id": id }
                    return result
                }
                else {
                    log.error("error inserting in post and thread index after retry")
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }

            }
            else if (postResult.hasOwnProperty('status') == false && threadResult.hasOwnProperty('status') == false && cassResult.hasOwnProperty('status') == true) {
                log.warn("insertion successfully done in both index but not in cassandra, calling fallback")

                if (paramsBody.hasOwnProperty('hashTags') == true && paramsBody.hashTags.length > 0) {
                    //let hashTagsQueryBody = queryBuilder.getHashTagQuery(paramsBody)
                    console.log("hashTagsQueryBody : ", hashTagsQueryBody)

                    // let hashTagResult = esdb.bulkData(hashTagsQueryBody)
                    // .then(esResult => esResult)
                    // .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    let hashTagResult = await Promise.all([
                        esdb.bulkData(hashTagsQueryBody)
                            .then(esResult => esResult)
                            .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    ])
                    console.log("hashTagResult : ", hashTagResult)
                    if (hashTagResult.hasOwnProperty('errors') == true && hashTagResult.errors == true) {
                        log.warn("error inserting in hashtag index calling the retry funciton", [hashTagResult])
                        retryObject = {
                            retryType: "bulk-update-insert-hashtag-failed",
                            queries: [hashTagsQueryBody],
                            result: hashTagResult
                        }
                        flag = await fallbackRetryUtil.retry(retryObject)
                        if (flag) {
                            log.info("insertion to hashtag index success")
                        }
                    }
                }
                fallbackObject = {
                    fallbackType: "insert-cass-fail",
                    queries: cassandraInsert,
                    result: null
                }
                fallbackRetryUtil.fallback(fallbackObject)
                result = { "id": id }
                searchData.type = 'insert-main-post'
                searchData.postQuery = postQueryBody
                searchData.threadQuery = threadQueryBody
                searchController.searchKafkaInsert(searchData)
                return result
            }
            else if (postResult.hasOwnProperty('status') == false && threadResult.hasOwnProperty('status') == false && cassResult.hasOwnProperty('status') == false) {
                log.info("insertion successfully done in all the three database")

                if (paramsBody.hasOwnProperty('hashTags') == true && paramsBody.hashTags.length > 0) {
                    //let hashTagsQueryBody = queryBuilder.getHashTagQuery(paramsBody)
                    console.log("hashTagsQueryBody : ", hashTagsQueryBody)

                    // let hashTagResult = esdb.bulkData(hashTagsQueryBody)
                    // .then(esResult => esResult)
                    // .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    let hashTagResult = await Promise.all([
                        esdb.bulkData(hashTagsQueryBody)
                            .then(esResult => esResult)
                            .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    ])
                    console.log("hashTagResult : ", hashTagResult)
                    if (hashTagResult.hasOwnProperty('errors') == true && hashTagResult.errors == true) {
                        log.warn("error inserting in hashtag index calling the retry funciton", [hashTagResult])
                        retryObject = {
                            retryType: "bulk-update-insert-hashtag-failed",
                            queries: [hashTagsQueryBody],
                            result: hashTagResult
                        }
                        flag = await fallbackRetryUtil.retry(retryObject)
                        if (flag) {
                            log.info("insertion to hashtag index success")
                        }
                    }
                }
                searchData.type = 'insert-main-post'
                searchData.postQuery = postQueryBody
                searchData.threadQuery = threadQueryBody
                searchController.searchKafkaInsert(searchData)
                result = { "id": id }
                return result
            }
            else {
                log.error("insertion unsuccessfull", updateResult)
                throw { statuscode: 500, err: "internal server error", message: "insertion error" }
            }

        }

        //see if the parentid is null i.e is it an intial post
        if (paramsBody.parentId == null && paramsBody.hasOwnProperty('id') == false) {

            let insertResult = await Promise.all([
                esdb.createData(postQueryBody, "postType", "postIndex")
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                esdb.createData(threadQueryBody, "threadType", "threadIndex")
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                cassdb.executeQuery(cassandraInsertQuery, cassandraInsertParams)
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
            ])

            postResult = insertResult[0]
            threadResult = insertResult[1]
            cassResult = insertResult[2]

            /* 1. check the insertion result for any errors if there an insertion failure in post index or thread index
                  and there is no error in the cassandra post table then call the retry method and resolve the erro by retrying
                  the insertion if it still fails then delete the entry from cassndra
               2. if the insertion fails in cassandra and successful in both the indexes then call the fallback method to 
                  try to insert it again.
               3. if successfull in all 3 then send a 204 status 
             */
            if ((postResult.hasOwnProperty('status') == true || threadResult.hasOwnProperty('status') == true) && cassResult.hasOwnProperty('status') == false) {
                log.warn("error inserting in thread and post index caslling the retry funciton", [postResult, threadResult])
                retryObject = {
                    retryType: "insert-post-thread-fail",
                    queries: [postQueryBody, threadQueryBody],
                    result: insertResult
                }
                flag = await fallbackRetryUtil.retry(retryObject)
                if (flag) {
                    log.info("insertion successfully done")
                    result = { "id": id }
                    return result
                    searchData.type = 'insert-main-post'
                    searchData.postQuery = postQueryBody
                    searchData.threadQuery = threadQueryBody
                    searchController.searchKafkaInsert(searchData)
                    //return { status: 204 , result :{"id" : id}}
                }
                else {
                    log.error("error inserting in post and thread index after retry")
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }

            }
            else if (postResult.hasOwnProperty('status') == false && threadResult.hasOwnProperty('status') == false && cassResult.hasOwnProperty('status') == true) {
                log.warn("insertion successfully done in both index but not in cassandra, calling fallback")
                if (paramsBody.hasOwnProperty('hashTags') == true && paramsBody.hashTags.length > 0) {
                    //let hashTagsQueryBody = queryBuilder.getHashTagQuery(paramsBody)
                    console.log("hashTagsQueryBody : ", hashTagsQueryBody)

                    // let hashTagResult = esdb.bulkData(hashTagsQueryBody)
                    // .then(esResult => esResult)
                    // .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    let hashTagResult = await Promise.all([
                        esdb.bulkData(hashTagsQueryBody)
                            .then(esResult => esResult)
                            .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    ])
                    console.log("hashTagResult : ", hashTagResult)
                    if (hashTagResult.hasOwnProperty('errors') == true && hashTagResult.errors == true) {
                        log.warn("error inserting in hashtag index calling the retry funciton", [hashTagResult])
                        retryObject = {
                            retryType: "bulk-update-insert-hashtag-failed",
                            queries: [hashTagsQueryBody],
                            result: hashTagResult
                        }
                        flag = await fallbackRetryUtil.retry(retryObject)
                        if (flag) {
                            log.info("insertion to hashtag index success")
                        }
                    }
                }
                fallbackObject = {
                    fallbackType: "insert-cass-fail",
                    queries: cassandraInsert,
                    result: null
                }
                fallbackRetryUtil.fallback(fallbackObject)
                result = { "id": id }
                searchData.type = 'insert-main-post'
                searchData.postQuery = postQueryBody
                searchData.threadQuery = threadQueryBody
                searchController.searchKafkaInsert(searchData)
                return result
                //return { status: 204 , result :{"id" : id}}
            }
            else if (postResult.hasOwnProperty('status') == false && threadResult.hasOwnProperty('status') == false && cassResult.hasOwnProperty('status') == false) {
                log.info("insertion successfully done")
                if (paramsBody.hasOwnProperty('hashTags') == true && paramsBody.hashTags.length > 0) {
                    //let hashTagsQueryBody = queryBuilder.getHashTagQuery(paramsBody)
                    console.log("hashTagsQueryBody : ", hashTagsQueryBody)

                    // let hashTagResult = esdb.bulkData(hashTagsQueryBody)
                    // .then(esResult => esResult)
                    // .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    let hashTagResult = await Promise.all([
                        esdb.bulkData(hashTagsQueryBody)
                            .then(esResult => esResult)
                            .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    ])
                    console.log("hashTagResult : ", hashTagResult)
                    if (hashTagResult.hasOwnProperty('errors') == true && hashTagResult.errors == true) {
                        log.warn("error inserting in hashtag index calling the retry funciton", [hashTagResult])
                        retryObject = {
                            retryType: "bulk-update-insert-hashtag-failed",
                            queries: [hashTagsQueryBody],
                            result: hashTagResult
                        }
                        flag = await fallbackRetryUtil.retry(retryObject)
                        if (flag) {
                            log.info("insertion to hashtag index success")
                        }
                    }
                }
                //return { status: 204 , result :{"id" : id}}
                searchData.type = 'insert-main-post'
                searchData.postQuery = postQueryBody
                searchData.threadQuery = threadQueryBody
                searchController.searchKafkaInsert(searchData)
                result = { "id": id }
                return result
            }
            else {
                log.error("insertion unsuccessfull", insertResult)
                throw { statuscode: 500, err: "internal server error", message: "insertion error" }
            }


        }
        //if parent id is not null i.e it is either an answer or a comment.
        if (paramsBody.postKind == 'Reply') {
            cassandraSelectQuery = 'select * from bodhi.post where root_org = ? and org=? and post_id =?'
            cassandraSelectParams = [paramsBody.rootOrg, paramsBody.org, paramsBody.parentId]

            /*fetch the particular parent post from all three storage to update the last modified timestamp and
              the thread contributors in the thread index and */
            let fetchResult = await Promise.all([
                getPostById(paramsBody.parentId, "postType", "postIndex", false)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                getPostById(paramsBody.parentId, "threadType", "threadIndex", true)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                cassdb.executeQuery(cassandraSelectQuery, cassandraSelectParams)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
            ])

            postFetchResult = fetchResult[0].hits.hits[0]
            threadFetchResult = fetchResult[1].hits.hits[0]
            cassFetchResult = fetchResult[2].rows

            /*check if anyone of the fetch has failed then throw error else insert the following post in all
              three storage. */
            if (postFetchResult.hasOwnProperty('status') == true || cassFetchResult.hasOwnProperty('status') == true || threadFetchResult.hasOwnProperty('status') == true) {
                log.error("error fetching post from DB for the given parentid", fetchResult)
                throw { statuscode: 500, err: "internal server error", message: "error fetching post from DB for the given parentid" }
            }
            else {
                /*insert the post in post index and post denorm table as it is a secondary post so no insertion
                  in the thread index */
                let updateObject = {
                    post: postFetchResult,
                    thread: { threadFetchResult, postQueryBody },
                    cassandra: null,
                    params: { paramsBody, dateCreated, creatorDetails }
                }
                let insertResult = await Promise.all([
                    esdb.createData(postQueryBody, "postType", "postIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                    cassdb.executeQuery(cassandraInsertQuery, cassandraInsertParams)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
                ])

                postInsertResult = insertResult[0]
                cassInsertResult = insertResult[1]

                let updateParentQuery = queryBuilder.getUpdateQueryBody(updateObject, "update")

                if (postInsertResult.hasOwnProperty('status') == true && cassInsertResult.hasOwnProperty('status') == false) {
                    retryObject = {
                        retryType: "insert-post-fail",
                        queries: [postQueryBody],
                        result: insertResult
                    }
                    flag = await fallbackRetryUtil.retry(retryObject)
                    if (flag) {
                        log.info("insertion successfully done")
                        updateFlag = await updateParent(updateParentQuery)
                        if (updateFlag) {
                            log.info("successfull inseriton of child and updation of parent")
                            //return { status: 204 , result :{"id" : id}}
                            searchData.type = 'insert-reply-post'
                            searchData.postQuery = postQueryBody
                            searchData.threadQuery = updateParentQuery[1]
                            searchController.searchKafkaInsert(searchData)
                            result = { "id": id }
                            return result
                        }
                        else {
                            log.error("post inserted in the post index but parent updation failed")
                            throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                        }
                    }
                    else {
                        log.error("error inserting in post index for child after retry")
                        throw { statuscode: 500, err: "internal server error", message: "error inserting in post index for child after retry" }
                    }
                }
                else if (postInsertResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == true) {
                    log.warn("unsuccessfull insert in cass post but successfull in post index , fallback function")
                    fallbackObject = {
                        fallbackType: "insert-cass-fail",
                        queries: cassandraInsert,
                        result: null
                    }
                    fallbackRetryUtil.fallback(fallbackObject);
                    updateFlag = await updateParent(updateParentQuery)
                    if (updateFlag) {
                        log.info("successfull inseriton of child and updation of parent")
                        //return { status: 204 , result :{"id" : id}}
                        searchData.type = 'insert-reply-post'
                        searchData.postQuery = postQueryBody
                        searchData.threadQuery = updateParentQuery[1]
                        searchController.searchKafkaInsert(searchData)
                        result = { "id": id }
                        return result

                    }
                    else {
                        log.error("post inserted in the post index but parent updation failed")
                        throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                    }
                }
                else if (postInsertResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == false) {
                    log.info("insertion of the child post successfully done")
                    updateFlag = await updateParent(updateParentQuery)
                    if (updateFlag) {
                        log.info("successfull inseriton of child and updation of parent")
                        //return { status: 204 , result :{"id" : id}}
                        searchData.type = 'insert-reply-post'
                        searchData.postQuery = postQueryBody
                        searchData.threadQuery = updateParentQuery[1]
                        searchController.searchKafkaInsert(searchData)
                        result = { "id": id }
                        return result
                    }
                    else {
                        log.error("post inserted in the post index but parent updation failed")
                        throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                    }
                }
                else {
                    log.error("insertion unsuccessfull", insertResult)
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
        }
        if (paramsBody.postKind == 'Comment') {
            let insertResult = addComment(paramsBody, postQueryBody, threadQueryBody, cassandraInsert, dateCreated, creatorDetails)
            if (insertResult) {
                //return { status: 204 , result :{"id" : id}}
                result = { "id": id }
                return result
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "could not add comment" }
            }
        }
    }
    catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

/**
 * this function puts a post to drafte stage or helps edit already drafted post.
 * @param {*} paramsBody 
 */
async function draftPost(paramsBody) {
    try {
        let creatorDetails
        let accessPathsList = []

    
        if (paramsBody.postKind.toLowerCase() == 'reply' || paramsBody.postKind.toLowerCase() == 'comment') {
            let parentResult = await getPostById(paramsBody.parentId, "postType", "postIndex", ['rootParentId', 'accessPaths', 'source', 'postKind'])

            if (parentResult['hits']['hits'][0]['_source']['postKind'] != 'Reply') {
                paramsBody.rootParentId = paramsBody.parentId
            }
            else {
                paramsBody.rootParentId = parentResult['hits']['hits'][0]['_source']['rootParentId']
            }
            paramsBody.parentAccessPaths = parentResult['hits']['hits'][0]['_source']['accessPaths']
            paramsBody.parentSource = parentResult['hits']['hits'][0]['_source']['source']
        }

        if (paramsBody.hasOwnProperty('accessPaths')) {
            accessPathsList = await validateAccessPaths(paramsBody)
        }
        else {
            // accessPaths = defaultAccessPath.split(',')
            // for (accessPath of accessPaths) {
            //     accessPathsList.push(accessPath.trim())
            // }
            rootOrg_org_accesspath = paramsBody.rootOrg+"/"+paramsBody.org
            accessPathsList.push(paramsBody.rootOrg)
            accessPathsList.push(rootOrg_org_accesspath)
        }

        //get the creator details from the given uuid 
        creatorDetails = await followController.getuserprofile(paramsBody.rootOrg,paramsBody.postCreator)

        //check if the post is a new post getting to draft or an already exissting post getting to draft again
        if (paramsBody.hasOwnProperty('id')) {
            id = paramsBody.id
            dateCreated = paramsBody.dateCreated

            let postUpdateQueryBody = {
                id: id,
                body: {
                    doc: {

                    }
                }
            }

            //check userid and parentpost creator id to validate the authority
            authorValidation = await postController.validateAuthor(paramsBody.rootOrg, paramsBody.org, paramsBody.postCreator, paramsBody.id)
            //console.log(authorValidation)

            postQueryBody = queryBuilder.getPostQueryBody(paramsBody, id, dateCreated, creatorDetails, accessPathsList, "Draft")
            postUpdateQueryBody.body.doc = postQueryBody

            cassandraInsert = queryBuilder.getCassndraQuery(paramsBody, id, dateCreated, creatorDetails, accessPathsList, "Draft")
            cassandraInsertQuery = cassandraInsert[0]
            cassandraInsertParams = cassandraInsert[1]

            /*as it going to the draft state there is no insert in the thread index, 
            insert only in the post index and the post cassandra table
            */
            let updateResult = await Promise.all([
                esdb.updateData(postUpdateQueryBody, "postType", "postIndex")
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                cassdb.executeQuery(cassandraInsertQuery, cassandraInsertParams)
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
            ])

            postUpdateResult = updateResult[0]
            cassUpdateResult = updateResult[1]

            /*
            1.check whether the insertion for post index has thrown an error and cassandra is successfull if yes then
              call the retry method and if that too fails then delete the record from cassandra
            2.If post index succeeds and cassandra has an error call the fallback function and send a 204
            3.if both gives success then send 204
             */
            if (postUpdateResult.hasOwnProperty('status') == true && cassUpdateResult.hasOwnProperty('status') == false) {
                log.warn("error updating in post index calling the retry funciton", postInsertResult)
                retryObject = {
                    retryType: "update-post-fail",
                    queries: [postQueryBody],
                    result: updateResult
                }
                flag = await fallbackRetryUtil.retry(retryObject)
                if (flag) {
                    log.info("updation successfully done")
                    return { status: 204 }
                }
                else {
                    log.error("error updating in post index after retry")
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
                log.warn("unsuccessfull insert in cass post but successfull in post index , calling fallback function : " + JSON.stringify(cassUpdateResult))

                var cassUpdateVal = {
                    query: cassandraInsert[0],
                    params: cassandraInsert[1]
                }

                fallbackObject = {
                    fallbackType: "update-cass-fail",
                    queries: [cassUpdateVal],
                    result: null
                }
                fallbackRetryUtil.fallback(fallbackObject);
                return { status: 204 }
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
                log.info("insertion of the post successfully done")
                return { status: 204 }
            }
            else {
                log.error("insertion unsuccessfull", insertResult)
                throw { statuscode: 500, err: "internal server error", message: "insertion error" }
            }
        }
        else {
            id = uuidv1()
            dateCreated = new Date()
            postQueryBody = queryBuilder.getPostQueryBody(paramsBody, id, dateCreated, creatorDetails, accessPathsList, "Draft")

            cassandraInsert = queryBuilder.getCassndraQuery(paramsBody, id, dateCreated, creatorDetails, accessPathsList, "Draft")
            let cassandraInsertQuery = cassandraInsert[0]
            let cassandraInsertParams = cassandraInsert[1]

            /*as it going to the draft state there is no insert in the thread index, 
            insert only in the post index and the post cassandra table
            */
            let insertResult = await Promise.all([
                esdb.createData(postQueryBody, "postType", "postIndex")
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                cassdb.executeQuery(cassandraInsertQuery, cassandraInsertParams)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "cassPost" }),
            ])

            let postInsertResult = insertResult[0]
            let cassInsertResult = insertResult[1]

            // /*
            // 1.check whether the insertion for post index has thrown an error and cassandra is successfull if yes then
            //   call the retry method and if that too fails then delete the record from cassandra
            // 2.If post index succeeds and cassandra has an error call the fallback function and send a 204
            // 3.if both gives success then send 204
            //  */
            if (postInsertResult.hasOwnProperty('status') == true && cassInsertResult.hasOwnProperty('status') == false) {
                log.warn("error inserting in post index calling the retry funciton", postInsertResult)
                retryObject = {
                    retryType: "insert-post-fail",
                    queries: [postQueryBody],
                    result: insertResult
                }
                flag = await fallbackRetryUtil.retry(retryObject)
                if (flag) {
                    log.info("insertion successfully done")
                    return { status: 204 }
                }
                else {
                    log.error("error inserting in post index after retry")
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
            else if (postInsertResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == true) {
                log.warn("unsuccessfull insert in cass post but successfull in post index , calling fallback function : " + JSON.stringify(cassInsertResult))
                fallbackObject = {
                    fallbackType: "insert-cass-fail",
                    queries: cassandraInsert,
                    result: null
                }
                fallbackRetryUtil.fallback(fallbackObject);
                return { status: 204 }
            }
            else if (postInsertResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == false) {
                log.info("insertion of the post successfully done")
                return { status: 204 }
            }
            else {
                log.error("insertion unsuccessfull", insertResult)
                throw { statuscode: 500, err: "internal server error", message: "insertion error" }
            }
        }


    }
    catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

/**
 * this fucntion takes in the updateQuery as parameter which is a list comprising of all the three db queries
 * and returns true if the parent for thread and post index have been updated 
 * example of updateQuery parameter :- 
 [postUpdateQuery,threadUpdateQuery,cassandraUpdateBatch]
 * @param {*} updateQuery 
 */
async function updateParent(updateQuery) {

    let postUpdateQuery = updateQuery[0]
    let threadUpdateQuery = updateQuery[1]
    let cassandraUpdateQuery = updateQuery[2]

    /* 1. check the insertion result for any errors if there an insertion failure in post index or thread index
          and there is no error in the cassandra post table then call the retry method and resolve the erro by retrying
          the insertion if it still fails then delete the entry from cassndra
       2. if the insertion fails in cassandra and successful in both the indexes then call the fallback method to 
          try to insert it again.
       3. if successfull in all 3 then send a 204 status 
    */
    if (threadUpdateQuery != null) {
        if (threadUpdateQuery.hasOwnProperty('id') == false) {
            let updateResult = await Promise.all([
                esdb.updateData(postUpdateQuery, "postType", "postIndex")
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                cassdb.executeBatch(cassandraUpdateQuery)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
            ])
            postUpdateResult = updateResult[0]
            cassUpdateResult = updateResult[1]

            if (postUpdateResult.hasOwnProperty('status') == true && cassUpdateResult.hasOwnProperty('status') == false) {
                log.warn("update of parent failed in either the post index or thread index, calling retry function")
                retryObject = {
                    retryType: "update-post-fail",
                    queries: [postUpdateQuery],
                    result: updateResult
                }
                flag = await fallbackRetryUtil.retry(retryObject)
                if (flag) {
                    return true
                }
                else {
                    return false
                }
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
                log.warn("updation of parent in cassandra post table failed but successfull updation of parent in post and thread index calling fallback funciton")
                fallbackObject = {
                    fallbackType: "update-cass-fail",
                    queries: cassandraUpdateQuery,
                    result: null
                }
                fallbackRetryUtil.fallback(fallbackObject)
                return true
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
                log.info("successfull updation of parent in all three db sources")
                return true
            }
            else {
                return false
            }
        }
        else {
            let updateResult = await Promise.all([
                esdb.updateData(postUpdateQuery, "postType", "postIndex")
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                esdb.updateData(threadUpdateQuery, "threadType", "threadIndex")
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                cassdb.executeBatch(cassandraUpdateQuery)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
            ])

            postUpdateResult = updateResult[0]
            threadUpdateResult = updateResult[1]
            cassUpdateResult = updateResult[2]

            if ((postUpdateResult.hasOwnProperty('status') == true || threadUpdateResult.hasOwnProperty('status') == true) && cassUpdateResult.hasOwnProperty('status') == false) {
                log.warn("update of parent failed in either the post index or thread index, calling retry function")
                retryObject = {
                    retryType: "update-post-thread-fail",
                    queries: [postUpdateQuery, threadUpdateQuery],
                    result: updateResult
                }
                flag = await retry(retryObject)
                if (flag) {
                    return true
                }
                else {
                    return false
                }
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
                log.warn("updation of parent in cassandra post table failed but successfull updation of parent in post and thread index calling fallback funciton")
                fallbackObject = {
                    fallbackType: "update-cass-fail",
                    queries: cassandraUpdateQuery,
                    result: null
                }
                return true
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
                log.info("successfull updation of parent in all three db sources")
                return true
            }
            else {
                return false
            }
        }

    }
    else {
        console.log(" in else")
        let updateResult = await Promise.all([
            esdb.updateData(postUpdateQuery, "postType", "postIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "postIndex" }),
            cassdb.executeCounterBatch(cassandraUpdateQuery)
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
        ])
        postUpdateResult = updateResult[0]
        cassUpdateResult = updateResult[1]

        if (postUpdateResult.hasOwnProperty('status') == true && cassUpdateResult.hasOwnProperty('status') == false) {
            log.warn("update of parent failed in either the post index or thread index, calling retry function")
            retryObject = {
                retryType: "update-post-fail",
                queries: [postUpdateQuery],
                result: updateResult
            }
            flag = await fallbackRetryUtil.retry(retryObject)
            if (flag) {
                return true
            }
            else {
                return false
            }
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
            log.warn("updation of parent in cassandra post table failed but successfull updation of parent in post and thread index calling fallback funciton")
            fallbackObject = {
                fallbackType: "update-cass-fail",
                queries: cassandraUpdateQuery,
                result: null
            }
            fallbackRetryUtil.fallback(fallbackObject)
            return true
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
            log.info("successfull updation of parent in all three db sources")
            return true
        }
        else {
            return false
        }
    }

}


async function addComment(paramsBody, postQueryBody, threadQueryBody, cassandraInsert, dateCreated, creatorDetails) {
    cassandraSelectQuery = 'select * from bodhi.post where root_org = ? and org=? and post_id =?'
    cassandraSelectParams = [paramsBody.rootOrg, paramsBody.org, paramsBody.parentId]
    try {
        /*fetch the particular parent post from all three storage to update the last modified timestamp and
              the thread contributors in the thread index and */
        let fetchResult = await Promise.all([
            getPostById(paramsBody.parentId, "postType", "postIndex", ['postKind'])
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "postIndex" }),
            cassdb.executeQuery(cassandraSelectQuery, cassandraSelectParams)
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
        ])

        let postFetchResult = fetchResult[0].hits.hits[0]
        let cassFetchResult = fetchResult[1].rows

        if (postFetchResult._source.postKind != 'Reply') {

            res = await getPostById(paramsBody.parentId, "threadType", "threadIndex", true)
            let threadFetchResult = res.hits.hits[0]

            /*check if anyone of the fetch has failed then throw error else insert the following post in all
              three storage. */
            if (postFetchResult.hasOwnProperty('status') == true || cassFetchResult.hasOwnProperty('status') == true || threadFetchResult.hasOwnProperty('status') == true) {
                log.error("error fetching post from DB for the given parentid", fetchResult)
                throw { statuscode: 500, err: "internal server error", message: "error fetching post from DB for the given parentid" }
            }
            else {
                /*insert the post in post index and post denorm table as it is a secondary post so no insertion
                  in the thread index */
                let updateObject = {
                    post: postFetchResult,
                    thread: { threadFetchResult, postQueryBody },
                    cassandra: null,
                    params: { paramsBody, dateCreated, creatorDetails }
                }
                let insertResult = await Promise.all([
                    esdb.createData(postQueryBody, "postType", "postIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                    cassdb.executeQuery(cassandraInsert[0], cassandraInsert[1])
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
                ])

                postInsertResult = insertResult[0]
                cassInsertResult = insertResult[1]

                let updateParentQuery = queryBuilder.getUpdateQueryBody(updateObject, "update")

                if (postInsertResult.hasOwnProperty('status') == true && cassInsertResult.hasOwnProperty('status') == false) {
                    retryObject = {
                        retryType: "insert-post-fail",
                        queries: [postQueryBody],
                        result: insertResult
                    }
                    flag = await fallbackRetryUtil.retry(retryObject)
                    if (flag) {
                        log.info("insertion successfully done")
                        updateFlag = await updateParent(updateParentQuery)
                        if (updateFlag) {
                            log.info("successfull inseriton of child and updation of parent")
                            return true
                        }
                        else {
                            log.error("post inserted in the post index but parent updation failed")
                            throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                        }
                    }
                    else {
                        log.error("error inserting in post index for child after retry")
                        throw { statuscode: 500, err: "internal server error", message: "error inserting in post index for child after retry" }
                    }
                }
                else if (postInsertResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == true) {
                    log.warn("unsuccessfull insert in cass post but successfull in post index , fallback function")
                    fallbackObject = {
                        fallbackType: "insert-cass-fail",
                        queries: cassandraInsert,
                        result: null
                    }
                    fallbackRetryUtil.fallback(fallbackObject);
                    updateFlag = await updateParent(updateParentQuery)
                    if (updateFlag) {
                        log.info("successfull inseriton of child and updation of parent")
                        return true
                    }
                    else {
                        log.error("post inserted in the post index but parent updation failed")
                        throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                    }
                }
                else if (postInsertResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == false) {
                    log.info("insertion of the child post successfully done")
                    updateFlag = await updateParent(updateParentQuery)
                    if (updateFlag) {
                        log.info("successfull inseriton of child and updation of parent")
                        return true
                    }
                    else {
                        log.error("post inserted in the post index but parent updation failed")
                        throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                    }
                }
                else {
                    log.error("insertion unsuccessfull", insertResult)
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
        }
        else {
            if (postFetchResult.hasOwnProperty('status') == true || cassFetchResult.hasOwnProperty('status') == true) {
                log.error("error fetching post from DB for the given parentid", fetchResult)
                throw { statuscode: 500, err: "internal server error", message: "error fetching post from DB for the given parentid" }
            }
            else {
                /*insert the post in post index and post denorm table as it is a secondary post so no insertion
                  in the thread index */
                let updateObject = {
                    post: postFetchResult,
                    cassandra: null,
                    thread: null,
                    params: { paramsBody, dateCreated, creatorDetails }
                }

                let insertResult = await Promise.all([
                    esdb.createData(postQueryBody, "postType", "postIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                    cassdb.executeQuery(cassandraInsert[0], cassandraInsert[1])
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
                ])

                postInsertResult = insertResult[0]
                cassInsertResult = insertResult[1]
                let updateParentQuery = queryBuilder.getUpdateQueryBody(updateObject, "update")
                if (postInsertResult.hasOwnProperty('status') == true && cassInsertResult.hasOwnProperty('status') == false) {
                    retryObject = {
                        retryType: "insert-post-fail",
                        queries: [postQueryBody],
                        result: insertResult
                    }
                    flag = await fallbackRetryUtil.retry(retryObject)
                    if (flag) {
                        log.info("insertion successfully done")
                        updateFlag = await updateParent(updateParentQuery)
                        if (updateFlag) {
                            log.info("successfull inseriton of child and updation of parent")
                            return true
                        }
                        else {
                            log.error("post inserted in the post index but parent updation failed")
                            throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                        }
                    }
                    else {
                        log.error("error inserting in post index for child after retry")
                        throw { statuscode: 500, err: "internal server error", message: "error inserting in post index for child after retry" }
                    }
                }
                else if (postInsertResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == true) {
                    log.warn("unsuccessfull insert in cass post but successfull in post index , fallback function")
                    fallbackObject = {
                        fallbackType: "insert-cass-fail",
                        queries: cassandraInsert,
                        result: null
                    }
                    fallbackRetryUtil.fallback(fallbackObject);
                    updateFlag = await updateParent(updateParentQuery)
                    if (updateFlag) {
                        log.info("successfull inseriton of child and updation of parent")
                        return true
                    }
                    else {
                        log.error("post inserted in the post index but parent updation failed")
                        throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                    }
                }
                else if (postInsertResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == false) {
                    log.info("insertion of the child post successfully done")
                    updateFlag = await updateParent(updateParentQuery)
                    if (updateFlag) {
                        log.info("successfull inseriton of child and updation of parent")
                        return true
                    }
                    else {
                        log.error("post inserted in the post index but parent updation failed")
                        throw { statuscode: 500, err: "internal server error", message: "post inserted in the post index but parent updation failed" }
                    }
                }
                else {
                    log.error("insertion unsuccessfull", insertResult)
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
        }
    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }

}

/**
 * this is the main edit fuction that handles whether to edit the tags or edit the meta
 * @param {*} paramsBody 
 */
async function edit(paramsBody) {
    try {
        authorValidation = await postController.validateAuthor(paramsBody.rootOrg, paramsBody.org, paramsBody.editor, paramsBody.id)
        if (paramsBody.hasOwnProperty('meta') == true && (paramsBody.hasOwnProperty('addTags') == false || paramsBody.addTags.length == 0) && (paramsBody.hasOwnProperty('removeTags') == false || paramsBody.removeTags.length == 0) && (paramsBody.hasOwnProperty('hashTags') == false)) {
            let editMetaResult = await editMeta(paramsBody)
            if (editMetaResult) {
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "updation error" }
            }
        }
        else if (((paramsBody.hasOwnProperty('addTags') == true && paramsBody.addTags.length > 0) || (paramsBody.hasOwnProperty('removeTags') == true && paramsBody.removeTags.length > 0)) && paramsBody.hasOwnProperty('meta') == false && paramsBody.hasOwnProperty('hashTags') == false) {
            console.log("Only tags")
            let editTagsResult = await editTags(paramsBody)
            if (editTagsResult) {
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "updation error" }
            }
        }
        else if ((paramsBody.hasOwnProperty('hashTags') == true) && ((paramsBody.hasOwnProperty('addTags') == false || paramsBody.addTags.length == 0) && (paramsBody.hasOwnProperty('removeTags') == false || paramsBody.removeTags.length == 0) && paramsBody.hasOwnProperty('meta') == false)) {
            console.log("Only hashTags")
            let editHashTagsResult = await editHashTags(paramsBody)
            if (editHashTagsResult) {
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "updation error" }
            }
        }
        else if (paramsBody.hasOwnProperty('meta') == true && ((paramsBody.hasOwnProperty('addTags') == true && paramsBody.addTags.length > 0) || (paramsBody.hasOwnProperty('removeTags') == true && paramsBody.removeTags.length > 0)) && (paramsBody.hasOwnProperty('hashTags') == false)) {
            console.log("Meta and Tags")
            let editResult = await Promise.all([
                editMeta(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "meta updation" }),
                editTags(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "tags updation" })
            ])

            let editMetaResult = editResult[0]
            let editTagsResult = editResult[1]

            if (editMetaResult == true && editTagsResult == true) {
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "updation error" }
            }
        }
        else if (paramsBody.hasOwnProperty('meta') == true && (paramsBody.hasOwnProperty('hashTags') == true) && ((paramsBody.hasOwnProperty('addTags') == false || paramsBody.addTags.length == 0) && (paramsBody.hasOwnProperty('removeTags') == false || paramsBody.removeTags.length == 0))) {
            console.log("Meta and hashTags")
            let editResult = await Promise.all([
                editMeta(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "meta updation" }),
                editHashTags(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "hashtags updation" })
            ])

            let editMetaResult = editResult[0]
            let editHashTagsResult = editResult[1]

            if (editMetaResult == true && editHashTagsResult == true) {
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "updation error" }
            }
        }
        else if ((paramsBody.hasOwnProperty('hashTags') == true) && ((paramsBody.hasOwnProperty('addTags') == true && paramsBody.addTags.length > 0) || (paramsBody.hasOwnProperty('removeTags') == true && paramsBody.removeTags.length > 0)) && paramsBody.hasOwnProperty('meta') == false) {
            console.log("tags and hashTags")
            let editResult = await Promise.all([
                editTags(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "tags updation" }),
                editHashTags(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "hashtags updation" })
            ])

            let editTagsResult = editResult[0]
            let editHashTagsResult = editResult[1]

            if (editTagsResult == true && editHashTagsResult == true) {
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "updation error" }
            }
        }
        else if (((paramsBody.hasOwnProperty('addTags') == true && paramsBody.addTags.length > 0) || (paramsBody.hasOwnProperty('removeTags') == true && paramsBody.removeTags.length > 0)) && paramsBody.hasOwnProperty('meta') == true && (paramsBody.hasOwnProperty('hashTags') == true)) {
            console.log("Meta, Tags and hashTags")
            let editResult = await Promise.all([
                editMeta(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "meta updation" }),
                editTags(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "tags updation" }),
                editHashTags(paramsBody)
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "hashtags updation" })
            ])

            let editMetaResult = editResult[0]
            let editTagsResult = editResult[1]
            let editHashTagsResult = editResult[2]

            if (editMetaResult == true && editTagsResult == true && editHashTagsResult == true) {
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "updation error" }
            }
        }
        else {
            console.log("Nothing")
            throw { statuscode: 400, err: "bad request", message: "bad request" }
        }
    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

/**
 * this funciton helps to edit the meta of a published post,
 * @param {*} paramsBody 
 */
async function editMeta(paramsBody) {
    let postcontent = {}
    let threadUpdateQuery = {}
    let isLatestReply = false
    let postUpdateQuery = {}
    let thumbnail = ""
    let searchData = {
        "type": "",
        "postQuery": {},
        "threadQuery": {},
        "locale" :"en"
    }
    try {
        if(paramsBody.hasOwnProperty('locale')==true && paramsBody.locale!=null && paramsBody.locale!=''){
            searchData.locale=paramsBody.locale.toLowerCase()
        }
        //check userid and parentpost creator id to validate the authority
        // authorValidation = await postController.validateAuthor(paramsBody.rootOrg, paramsBody.org, paramsBody.editor, paramsBody.id)
        //console.log(authorValidation)

        let dateEdited = new Date()

        let editDetails = {
            dtLastEdited: dateEdited,
            editorId: paramsBody.editor
        }

        //building the post content according to the changes made to the content.
        if (paramsBody.meta.hasOwnProperty('title')) {
            postcontent.title = paramsBody.meta.title
        }
        if (paramsBody.meta.hasOwnProperty('abstract')) {
            postcontent.abstract = paramsBody.meta.abstract
        }
        if (paramsBody.meta.hasOwnProperty('body')) {
            postcontent.body = paramsBody.meta.body
        }
        if (paramsBody.meta.hasOwnProperty('thumbnail')) {
            thumbnail = paramsBody.meta.thumbnail
        }

        //fetching the post that is being edited to get other details like parent id to updated the parent. 
        let post = await getPostById(paramsBody.id, "postType", "postIndex", ["parentId"])
        let parentId = post.hits.hits[0]._source['parentId']

        postUpdateQuery = {
            id: paramsBody.id,
            body: {
                doc: {
                    lastEdited: editDetails,
                    postContent: postcontent
                }
            }
        }
        if (paramsBody.meta.hasOwnProperty('thumbnail')) {
            postUpdateQuery.body.doc['thumbnail'] = thumbnail
        }

        //cassandra fetch to get the current meta for insertion into post history table.
        let cassFetchResult = await cassdb.executeQuery('select post_content from bodhi.post where root_org = ? and org = ? and post_id = ?', [paramsBody.rootOrg, paramsBody.org, paramsBody.id])
        let currentPostContent = cassFetchResult.rows[0].post_content

        let cassandraQuery = queryBuilder.getCassndraMetaQuery(paramsBody, currentPostContent, dateEdited)

        let cassandraUpdate = cassandraQuery.cassUpdate
        let cassandraInsert = cassandraQuery.cassInsert

        // if the postkind is poll or survey then it can not be edited.
        if (paramsBody.postKind == "Poll" || paramsBody.postKind == "Survey") {
            throw { status: 400, message: "poll or survey type posts cannot be edited" }
        }

        //if the post is the parent post i.e the initial post only update the meta and date_last_modified.
        if (parentId == null) {
            threadUpdateQuery = {
                id: paramsBody.id,
                body: {
                    doc: {
                        lastEdited: editDetails,
                        postContent: postcontent
                    }
                }
            }
            if (paramsBody.meta.hasOwnProperty('thumbnail')) {
                threadUpdateQuery.body.doc['thumbnail'] = thumbnail
            }
        }

        /**
         * if the post is a reply to an initaial post i.e its of postkind reply then check if it is the latest reply
         * if latest reply then update the post content to post index of post, to post table cassandra and to the thread index's latest reply part
        */
        if (paramsBody.postKind == "Reply") {
            let latestReply = await checkLatestReply(post.hits.hits[0]._source['parentId'], paramsBody.id)

            if (latestReply.flag == true) {
                let latestReplyMeta = latestReply.result
                isLatestReply = true
                latestReplyMeta.postContent = postcontent
                latestReplyMeta.lastEdited = editDetails

                threadUpdateQuery = {
                    id: parentId,
                    body: {
                        doc: {
                            latestReply: latestReplyMeta
                        }
                    }
                }
            }
        }

        //if the post is the inital post or a reply which is the latest reply
        if (parentId == null || isLatestReply == true) {
            let updateResult = await Promise.all([
                esdb.updateData(postUpdateQuery, "postType", "postIndex")
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                esdb.updateData(threadUpdateQuery, "threadType", "threadIndex")
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                cassdb.executeQuery(cassandraUpdate[0], cassandraUpdate[1])
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
            ])

            postUpdateResult = updateResult[0]
            threadUpdateResult = updateResult[1]
            cassUpdateResult = updateResult[2]

            if ((postUpdateResult.hasOwnProperty('status') == true || threadUpdateResult.hasOwnProperty('status') == true) && cassUpdateResult.hasOwnProperty('status') == false) {
                log.warn("update of meta failed in either the post index or thread index, calling retry function")
                retryObject = {
                    retryType: "update-post-thread-fail",
                    queries: [postUpdateQuery, threadUpdateQuery],
                    result: updateResult
                }
                flag = await fallbackRetryUtil.retry(retryObject)
                if (flag) {
                    cassInsertResult = await cassdb.executeQuery(cassandraInsert[0], cassandraInsert[1])
                    searchData.type = "update-main-post"
                    searchData.postQuery = postUpdateQuery
                    searchData.threadQuery = threadUpdateQuery
                    searchController.searchKafkaInsert(searchData)
                    return true
                }
                else {
                    return false
                }
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
                log.warn("updation of meta in cassandra post table failed but successfull updation of meta in post and thread index calling fallback funciton")
                fallbackObject = {
                    fallbackType: "update-cass-fail",
                    queries: [{ query: cassandraUpdate[0], params: cassandraUpdate[1] }],
                    result: null
                }
                cassInsertResult = await cassdb.executeQuery(cassandraInsert[0], cassandraInsert[1])
                fallbackRetryUtil.fallback(fallbackObject)
                searchData.type = "update-main-post"
                searchData.postQuery = postUpdateQuery
                searchData.threadQuery = threadUpdateQuery
                searchController.searchKafkaInsert(searchData)
                return true
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
                log.info("successfull updation of parent in all three db sources")
                cassInsertResult = await cassdb.executeQuery(cassandraInsert[0], cassandraInsert[1])
                searchData.type = "update-main-post"
                searchData.postQuery = postUpdateQuery
                searchData.threadQuery = threadUpdateQuery
                searchController.searchKafkaInsert(searchData)
                return true
            }
            else {
                return false
            }
        }

        //if the post is a reply which is not the latest reply or a comment then it will update only the cassandra post and post index and insert in the cassandra post history tbale
        else {
            let updateResult = await Promise.all([
                esdb.updateData(postUpdateQuery, "postType", "postIndex")
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                cassdb.executeQuery(cassandraUpdate[0], cassandraUpdate[1])
                    .then(result => result)
                    .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
            ])

            postUpdateResult = updateResult[0]
            cassUpdateResult = updateResult[1]

            if (postUpdateResult.hasOwnProperty('status') == true && cassUpdateResult.hasOwnProperty('status') == false) {
                log.warn("update of meta failed in either the post index or thread index, calling retry function")
                retryObject = {
                    retryType: "update-post-fail",
                    queries: [postUpdateQuery],
                    result: updateResult
                }
                flag = await fallbackRetryUtil.retry(retryObject)
                if (flag) {
                    cassInsertResult = await cassdb.executeQuery(cassandraInsert[0], cassandraInsert[1])
                    searchData.type = "update-reply-post"
                    searchData.postQuery = postUpdateQuery
                    searchData.postQuery.parentId = parentId
                    searchController.searchKafkaInsert(searchData)
                    return true
                }
                else {
                    return false
                }
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
                log.warn("updation of meta in cassandra post table failed but successfull updation of meta in post and thread index calling fallback funciton")
                fallbackObject = {
                    fallbackType: "update-cass-fail",
                    queries: [{ query: cassandraUpdate[0], params: cassandraUpdate[1] }],
                    result: null
                }
                cassInsertResult = await cassdb.executeQuery(cassandraInsert[0], cassandraInsert[1])
                fallbackRetryUtil.fallback(fallbackObject)
                searchData.type = "update-reply-post"
                searchData.postQuery = postUpdateQuery
                searchData.postQuery.parentId = parentId
                searchController.searchKafkaInsert(searchData)
                return true
            }
            else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
                log.info("successfull updation of parent in all three db sources")
                cassInsertResult = await cassdb.executeQuery(cassandraInsert[0], cassandraInsert[1])
                searchData.type = "update-reply-post"
                searchData.postQuery = postUpdateQuery
                searchData.postQuery.parentId = parentId
                searchController.searchKafkaInsert(searchData)
                return true
            }
            else {
                return false
            }
        }
    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

/**
 * this funciton either adds or removes tags to the already exisiting tags to a post and 
 * inserts an entry for every tag activity to user_tag_activity mapping table in cassandra
 * @param {*} paramsBody 
 */
async function editTags(paramsBody) {

    try {
        let searchData = {
            "type": "",
            "postQuery": {},
            "threadQuery": {},
            "locale" : "en"
        }
        if(paramsBody.hasOwnProperty('locale')==true && paramsBody.locale!=null && paramsBody.locale!=''){
            searchData.locale=paramsBody.locale.toLowerCase()
        }
        let dateEdited = new Date()
        let tagAdded = []
        let tagRemoved = []

        //check userid and parentpost creator id to validate the authority
        //authorValidation = await postController.validateAuthor(paramsBody.rootOrg, paramsBody.org, paramsBody.editor, paramsBody.id)
        //console.log(authorValidation)

        //fetch to the post index to get the existing tags for the updation
        let esFetchResult = await getPostById(paramsBody.id, "postType", "postIndex", ['tags'])
        var tags = esFetchResult.hits.hits[0]._source.tags

        //if the params body contains addTags property then add the tags to the existing tags list
        if (paramsBody.addTags != null && paramsBody.addTags.length > 0) {
            paramsBody.addTags.forEach(element => {
                let result = tags.filter(tag => tag.id === element.id)
                if (result.length == 0) {
                    tags.push(element)
                    tagAdded.push(element)
                }
            });
        }

        //if the params body contains removeTags property then remove the tags to the existing tags list
        if (paramsBody.removeTags != null && paramsBody.removeTags.length > 0) {
            paramsBody.removeTags.forEach(element => {
                let result = tags.filter(tag => tag.id === element.id)
                if (result.length != 0) {
                    let index = tags.findIndex(i => i.id == result[0].id)
                    tags.splice(index, 1)
                    tagRemoved.push(element)
                }
            });
        }

        let updateObject = {
            tags: tags,
            tagAdded: tagAdded,
            tagRemoved: tagRemoved,
            paramsBody: paramsBody,
            dates: dateEdited
        }


        let updateQuery = queryBuilder.getUpdateQueryBody(updateObject, "update-tag")

        let cassPostUpdateQuery = updateQuery[0]
        let cassTagPostQuery = updateQuery[1]
        let esUpdateQuery = updateQuery[2]

        let updateResult = await Promise.all([
            esdb.updateData(esUpdateQuery, "postType", "postIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "postIndex" }),
            esdb.updateData(esUpdateQuery, "threadType", "threadIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
            cassdb.executeQuery(cassPostUpdateQuery.query, cassPostUpdateQuery.params)
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "cassandraPost" }),
        ])

        postUpdateResult = updateResult[0]
        threadUpdateResult = updateResult[1]
        cassUpdateResult = updateResult[2]

        if ((postUpdateResult.hasOwnProperty('status') == true || threadUpdateResult.hasOwnProperty('status') == true) && cassUpdateResult.hasOwnProperty('status') == false) {
            log.warn("update of tags failed in either the post index or thread index, calling retry function")
            retryObject = {
                retryType: "update-post-thread-fail",
                queries: [esUpdateQuery, esUpdateQuery],
                result: updateResult
            }
            flag = await fallbackRetryUtil.retry(retryObject)
            if (flag) {
                cassInsertResult = await cassdb.executeBatch(cassTagPostQuery)
                searchData.type = "update-main-post"
                searchData.postQuery = esUpdateQuery
                searchData.threadQuery = esUpdateQuery
                searchController.searchKafkaInsert(searchData)
                return true
            }
            else {
                return false
            }
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
            log.warn("updation of tags in cassandra post table failed but successfull updation of tags in post and thread index calling fallback funciton")
            fallbackObject = {
                fallbackType: "update-cass-fail",
                queries: cassPostUpdateQuery,
                result: null
            }
            cassInsertResult = await cassdb.executeBatch(cassTagPostQuery)
            fallbackRetryUtil.fallback(fallbackObject)
            searchData.type = "update-main-post"
            searchData.postQuery = esUpdateQuery
            searchData.threadQuery = esUpdateQuery
            searchController.searchKafkaInsert(searchData)
            return true
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
            log.info("successfull updation of tags in all three db sources")
            cassInsertResult = await cassdb.executeBatch(cassTagPostQuery)
            searchData.type = "update-main-post"
            searchData.postQuery = esUpdateQuery
            searchData.threadQuery = esUpdateQuery
            searchController.searchKafkaInsert(searchData)
            return true
        }
        else {
            return false
        }

    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

/**
 * this function only deletes the comment and reduces the comment count of the parentid 
 * @param {*} post 
 * @param {*} paramsBody 
 */
async function deleteComment(post, paramsBody, flagDelete) {

    try {

        let parentId = post.hits.hits[0]._source['parentId']
        let deleteDate = new Date()

        //fetch to get the parent post
        let parentPost = await getPostById(parentId, "postType", "postIndex", ['id', 'commentCount'])
        let updateObject = {
            paramsBody: paramsBody,
            parentPost: parentPost,
            flagDelete,
            deleteDate
        }

        let updateQuery = queryBuilder.getUpdateQueryBody(updateObject, "delete-comment")

        let postUpdateQuery = updateQuery[0]
        let cassUpdate = updateQuery[1]
        let parentPostUpdate = updateQuery[2]
        let cassParentUpdate = updateQuery[3]

        //as it is a comment the status of post getting inacitve will be updated only on the post index and cassandra post table
        let deleteResult = await Promise.all([
            esdb.updateData(postUpdateQuery, "postType", "postIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "postIndex" }),
            cassdb.executeBatch(cassUpdate)
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
        ])

        let postDeleteResult = deleteResult[0]
        let cassDeleteResult = deleteResult[1]

        if (postDeleteResult.hasOwnProperty('status') == true && cassDeleteResult.hasOwnProperty('status') == false) {
            log.warn("deletion of comment failed in either the post index or thread index, calling retry function")
            retryObject = {
                retryType: "update-post-fail",
                queries: [postUpdateQuery],
                result: updateResult
            }
            flag = await retry(retryObject)
            if (flag) {
                let parentUpdate = await updateParent([parentPostUpdate, null, cassParentUpdate])
                if (parentUpdate) {
                    return true
                }
                else {
                    return false
                }
            }
            else {
                return false
            }
        }
        else if (postDeleteResult.hasOwnProperty('status') == false && cassDeleteResult.hasOwnProperty('status') == true) {
            log.warn("deletion of comment in cassandra post table failed but successfull deletion of comment in post and thread index calling fallback funciton")
            fallbackObject = {
                fallbackType: "update-cass-fail",
                queries: cassUpdate,
                result: null
            }
            fallbackRetryUtil.fallback(fallbackObject)
            let parentUpdate = await updateParent([parentPostUpdate, null, cassParentUpdate])
            if (parentUpdate) {
                return true
            }
            else {
                return false
            }
        }
        else if (postDeleteResult.hasOwnProperty('status') == false && cassDeleteResult.hasOwnProperty('status') == false) {
            log.info("successfull deletion of comment in all three db sources")
            let parentUpdate = await updateParent([parentPostUpdate, null, cassParentUpdate])
            if (parentUpdate) {
                return true
            }
            else {
                return false
            }
        }
        else {
            return false
        }
    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

/**
 * this function deletes the latest reply and then changes the latest reply section of the parent thread to the
 * next latest reply along with the modification of the thread contributors in the thread 
 * and also modifies the last_modified_date of the parent posts.
 * @param {*} post 
 * @param {*} paramsBody 
 * @param {*} nextLatestReply This is the next suitable latest reply based on the last modified date
 */
async function deleteLatestReply(post, paramsBody, nextLatestReply, flagDelete) {

    try {
        let searchData = {
            "type": "",
            "postQuery": {},
            "threadQuery": {},
            "locale" : "en"
        }
        if(paramsBody.hasOwnProperty('locale')==true && paramsBody.locale!=null && paramsBody.locale!=''){
            searchData.locale=paramsBody.locale.toLowerCase()
        }

        let parentId = post.hits.hits[0]._source['parentId']
        let contributorDeleteFlag = true

        //fetch for the thread contributors and the threadcontributors count
        let result = await Promise.all([
            getPostById(parentId, "threadType", "threadIndex", ['threadContributors', 'id', 'replyCount'])
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
            getThreadContributorCount(post.hits.hits[0]._source['postCreator']['postCreatorId'], post.hits.hits[0]._source['parentId'])
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "error in getting the thread contributor count" }),
        ])

        let parentPost = result[0]
        let threadContributorCount = result[1]

        /*
        if the user has contributed more replies than the one getting deleted then 
        do not delete the details from thread contributor list set contributorDeleteFlag to false 
        */
        if (threadContributorCount > 1) {
            contributorDeleteFlag = false
        }

        let dtLastModified = new Date()
        let deleteDate = dtLastModified

        if (nextLatestReply.hasOwnProperty('dtLastModified') == true) {
            dtLastModified = nextLatestReply.dtLastModified
        }

        let updateObject = {
            paramsBody: paramsBody,
            nextLatestReply: nextLatestReply,
            parentPost: parentPost,
            contributorDeleteFlag: contributorDeleteFlag,
            contributorId: post.hits.hits[0]._source['postCreator']['postCreatorId'],
            isAcceptedAnswer: post.hits.hits[0]._source['isAcceptedAnswer'],
            lastDateModified: dtLastModified,
            flagDelete,
            deleteDate
        }

        let updateQuery = queryBuilder.getUpdateQueryBody(updateObject, "delete-latestReply")

        let postUpdateQuery = updateQuery[0]
        let threadUpdateQuery = updateQuery[1]
        let cassUpdate = updateQuery[2]
        let parentPostUpdate = updateQuery[3]
        let cassParentPostQuery = updateQuery[4]

        //console.log("threadUpdateQuery: ",threadUpdateQuery)
        //see if the deletion of the post itself is successfull or not if yes then update parent else dont update the parent
        let updateResult = await Promise.all([
            esdb.updateData(postUpdateQuery, "postType", "postIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "postIndex" }),
            cassdb.executeBatch(cassUpdate)
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
        ])

        postUpdateResult = updateResult[0]
        cassUpdateResult = updateResult[1]

        if (postUpdateResult.hasOwnProperty('status') == true && cassUpdateResult.hasOwnProperty('status') == false) {
            log.warn("update of parent failed in either the post index or thread index, calling retry function")
            retryObject = {
                retryType: "update-post-fail",
                queries: [postUpdateQuery],
                result: updateResult
            }
            flag = await fallbackRetryUtil.retry(retryObject)
            if (flag) {
                parentUpdateQuery = [parentPostUpdate, threadUpdateQuery, cassParentPostQuery]
                let parentUpdate = updateParent(parentUpdateQuery)
                if (parentUpdate) {
                    searchData.type = "delete-reply-post"
                    searchData.postQuery = postUpdateQuery
                    searchData.threadQuery = threadUpdateQuery
                    searchData.postQuery.parentId = parentId
                    searchController.searchKafkaInsert(searchData)
                    return true
                }
                else {
                    return false
                }
            }
            else {
                return false
            }
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
            log.warn("updation of parent in cassandra post table failed but successfull updation of parent in post and thread index calling fallback funciton")
            fallbackObject = {
                fallbackType: "update-cass-fail",
                queries: cassUpdate,
                result: null
            }
            fallbackRetryUtil.fallback(fallbackObject)
            parentUpdateQuery = [parentPostUpdate, threadUpdateQuery, cassParentPostQuery]
            let parentUpdate = updateParent(parentUpdateQuery)
            if (parentUpdate) {
                searchData.type = "delete-reply-post"
                searchData.postQuery = postUpdateQuery
                searchData.threadQuery = threadUpdateQuery
                searchData.postQuery.parentId = parentId
                searchController.searchKafkaInsert(searchData)
                return true
            }
            else {
                return false
            }
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
            log.info("successfull updation of parent in all three db sources")
            parentUpdateQuery = [parentPostUpdate, threadUpdateQuery, cassParentPostQuery]
            let parentUpdate = updateParent(parentUpdateQuery)
            if (parentUpdate) {
                searchData.type = "delete-reply-post"
                searchData.postQuery = postUpdateQuery
                searchData.threadQuery = threadUpdateQuery
                searchData.postQuery.parentId = parentId
                searchController.searchKafkaInsert(searchData)
                return true
            }
            else {
                return false
            }
        }
        else {
            return false
        }
    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }

}

/**
 * this funciton is the master function which handles the deletion of either the main post,latest reply,
 * normal reply or a comment
 * @param {} paramsBody 
 */
async function deletePost(paramsBody, flagDelete) {
    try {
        let searchData = {
            "type": "",
            "postQuery": {},
            "threadQuery": {},
            "locale" : "en"
        }
        if(paramsBody.hasOwnProperty('locale')==true && paramsBody.locale!=null && paramsBody.locale!=''){
            searchData.locale=paramsBody.locale.toLowerCase()
        }
        let deleteDate = new Date()
        let contributorDeleteFlag = true
        //check userid and parentpost creator id to validate the authority
        if (!flagDelete) {
            authorValidation = await postController.validateAuthor(paramsBody.rootOrg, paramsBody.org, paramsBody.userId, paramsBody.id)
        }

        //fetch the post based on the postId passed as a parameter to know the post kind
        let post = await getPostById(paramsBody.id, "postType", "postIndex", ["parentId", "postKind", "postCreator", "isAcceptedAnswer", "status"])

        //deletes the main post i.e the initial post without any parent id
        if (post.hits.hits[0]._source['parentId'] == null) {
            let updateObject = {
                paramsBody: paramsBody,
                flagDelete,
                deleteDate
            }
            let updateQuery = []
            if (post.hits.hits[0]._source['status'] == 'Draft') {
                updateQuery = queryBuilder.getUpdateQueryBody(updateObject, "delete-post")
            }
            else {
                updateQuery = queryBuilder.getUpdateQueryBody(updateObject, "delete-post-thread")
            }
            let updateResult = await updateParent(updateQuery)
            if (updateResult) {
                searchData.type = "delete-main-post"
                searchData.postQuery = updateQuery[0]
                searchData.threadQuery = updateQuery[1]
                searchController.searchKafkaInsert(searchData)
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "deletion error" }
            }
        }

        /*
        deletes the reply by calling either the deleteLatestreply method if the islatestreply flag is true,
        else calls the deleteReply method
         */
        if (post.hits.hits[0]._source['postKind'] == 'Reply') {
            let isLatestReply = await getLatestReply(post.hits.hits[0]._source['parentId'], paramsBody.id)
            if (isLatestReply.flag) {
                let deleteResult = deleteLatestReply(post, paramsBody, isLatestReply.nextLatestReply, flagDelete)
                if (deleteResult) {
                    return { status: 204 }
                }
                else {
                    throw { statuscode: 500, err: "internal server error", message: "deletion error" }
                }
            }
            else {
                let parentId = post.hits.hits[0]._source['parentId']
                let result = await Promise.all([
                    getPostById(parentId, "threadType", "threadIndex", ['threadContributors', 'id', 'replyCount'])
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
                    getThreadContributorCount(post.hits.hits[0]._source['postCreator']['postCreatorId'], post.hits.hits[0]._source['parentId'])
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "error in getting the thread contributor count" }),
                ])
                let parentPost = result[0]
                let threadContributorCount = result[1]
                if (threadContributorCount > 1) {
                    contributorDeleteFlag = false
                }

                let updateObject = {
                    parentPost: parentPost.hits.hits[0]._source,
                    paramsBody: paramsBody,
                    isAcceptedAnswer: post.hits.hits[0]._source['isAcceptedAnswer'],
                    flagDelete,
                    deleteDate,
                    contributorDeleteFlag
                }

                let updateQuery = queryBuilder.getUpdateQueryBody(updateObject, "delete-reply")

                let postUpdateQuery = updateQuery[0]
                let threadUpdateQuery = updateQuery[1]
                let cassUpdate = updateQuery[2]


                let deleteResult = await updateParent([postUpdateQuery, threadUpdateQuery, cassUpdate])
                if (deleteResult) {
                    searchData.type = "delete-reply-post"
                    searchData.postQuery = postUpdateQuery
                    searchData.threadQuery = threadUpdateQuery
                    searchData.postQuery.parentId = parentId
                    searchController.searchKafkaInsert(searchData)
                    return { status: 204 }
                }
                else {
                    throw { statuscode: 500, err: "internal server error", message: "deletion error" }
                }
            }
        }

        // calls the deleteComment method
        if (post.hits.hits[0]._source['postKind'] == 'Comment') {
            let deleteResult = await deleteComment(post, paramsBody, flagDelete)
            if (deleteResult) {
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "deletion error" }
            }
        }

    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

/*
to edit the hashtags .
if a new hashtag is added , it will be added to hashtag index.
if existing hashtag removed ,count is to be reduced.
if existing hashtag is added, count is to be incremented.
if hashtag was already present, no action to be taken.
all the past data to be stored in cassandra
 */
async function editHashTags(paramsBody) {
    try {
        let searchData = {
            "type": "",
            "postQuery": {},
            "threadQuery": {},
            "locale" : "en"
        }
        if(paramsBody.hasOwnProperty('locale')==true && paramsBody.locale!=null && paramsBody.locale!=''){
            searchData.locale=paramsBody.locale.toLowerCase()
        }
        //fetching the post that is being edited to get existing hashtag details
        let result = true
        //console.log("paramsBody :", paramsBody)
        let post = await getPostById(paramsBody.id, "postType", "postIndex", ["hashTags"])
        let existinghashTags = post.hits.hits[0]._source['hashTags']
        //console.log("existinghashTags :", existinghashTags)
        let hashTagstocheck = [...existinghashTags, ...paramsBody.hashTags]

        //console.log("hashTagstocheck :", hashTagstocheck)
        hashTagstocheck = hashTagstocheck.map(v => v.toLowerCase());
        //console.log("hashTagstocheck :", hashTagstocheck)
        hashTagsData = await getHashTags(hashTagstocheck, "hashtagsType", "hashtagsIndex")
        //console.log("hashTagsData :", hashTagsData)
        let hashTagEsObj = []
        if (hashTagsData.hits.total > 0) {
            hashTagEsObj = hashTagsData.hits.hits
        }
        console.log("hashTagEsObj :", hashTagEsObj)
        let hashTagsQueryBody = queryBuilder.getHashTagQuery(paramsBody, hashTagEsObj, existinghashTags)
        console.log("hashTagsQueryBody :", hashTagsQueryBody)

        //update the index
        let dateEdited = new Date()
        let updateObject = {
            hashtags: paramsBody.hashTags,
            paramsBody: paramsBody,
            dates: dateEdited
        }

        let updateQuery = queryBuilder.getUpdateQueryBody(updateObject, 'update-hashtag')
        let cassUpdateQuery = updateQuery[0]
        let esUpdateQuery = updateQuery[1]


        let hashTagsUpdates = await Promise.all([
            esdb.updateData(esUpdateQuery, "postType", "postIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "postIndex" }),
            esdb.updateData(esUpdateQuery, "threadType", "threadIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
            cassdb.executeQuery(cassUpdateQuery.query, cassUpdateQuery.params)
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
        ])

        let postUpdateResult = hashTagsUpdates[0]
        let threadUpdateResult = hashTagsUpdates[1]
        let cassUpdateResult = hashTagsUpdates[2]

        if ((postUpdateResult.hasOwnProperty('status') == true || threadUpdateResult.hasOwnProperty('status') == true) && cassUpdateResult.hasOwnProperty('status') == false) {
            log.warn("update of hashtags failed in either the post index or thread index, calling retry function")
            retryObject = {
                retryType: "update-post-thread-fail",
                queries: [esUpdateQuery, esUpdateQuery],
                result: updateResult
            }
            flag = await fallbackRetryUtil.retry(retryObject)
            if (flag) {
                if (existinghashTags.length > 0 && hashTagsQueryBody.length > 0) {
                    let cassInsertQuery = queryBuilder.getCassandraHashTagQuery(paramsBody, existinghashTags, dateEdited)
                    console.log("cassInsertQuery :", cassInsertQuery)
                    hashTagResult = await Promise.all([
                        esdb.bulkData(hashTagsQueryBody)
                            .then(esResult => esResult)
                            .catch(err => err = { status: 500, error: err, location: "hashtagIndex" }),
                        cassdb.executeQuery(cassInsertQuery[0], cassInsertQuery[1])
                            .then(result => result)
                            .catch(err => err = { status: 500, error: err, location: "cassandraHashTags" })
                    ])
                }
                else if (existinghashTags.length > 0) {
                    let cassInsertQuery = queryBuilder.getCassandraHashTagQuery(paramsBody, existinghashTags, dateEdited)
                    hashTagResult = await Promise.all([
                        cassdb.executeQuery(cassInsertQuery[0], cassInsertQuery[1])
                            .then(result => result)
                            .catch(err => err = { status: 500, error: err, location: "cassandraHashTags" })
                    ])
                }
                else if(hashTagsQueryBody.length > 0) {
                    console.log("hashTagsQueryBody : ", hashTagsQueryBody)
                    hashTagResult = await Promise.all([
                        esdb.bulkData(hashTagsQueryBody)
                            .then(esResult => esResult)
                            .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                    ])
                }
                searchData.type = "update-main-post"
                searchData.postQuery = esUpdateQuery
                searchData.threadQuery = esUpdateQuery
                searchController.searchKafkaInsert(searchData)
                return true
            }
            else {
                return false
            }
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
            log.warn("updation of tags in cassandra post table failed but successfull updation of tags in post and thread index calling fallback funciton")
            fallbackObject = {
                fallbackType: "update-cass-fail",
                queries: cassUpdateQuery,
                result: null
            }
            fallbackRetryUtil.fallback(fallbackObject)
            if (existinghashTags.length > 0 && hashTagsQueryBody.length > 0) {
                let cassInsertQuery = queryBuilder.getCassandraHashTagQuery(paramsBody, existinghashTags, dateEdited)
                hashTagResult = await Promise.all([
                    esdb.bulkData(hashTagsQueryBody)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "hashtagIndex" }),
                    cassdb.executeQuery(cassInsertQuery[0], cassInsertQuery[1])
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "cassandraHashTags" })
                ])
            }
            else if (existinghashTags.length > 0) {
                let cassInsertQuery = queryBuilder.getCassandraHashTagQuery(paramsBody, existinghashTags, dateEdited)
                hashTagResult = await Promise.all([
                    cassdb.executeQuery(cassInsertQuery[0], cassInsertQuery[1])
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "cassandraHashTags" })
                ])
            }
            else if(hashTagsQueryBody.length > 0) {
                console.log("hashTagsQueryBody : ", hashTagsQueryBody)
                hashTagResult = await Promise.all([
                    esdb.bulkData(hashTagsQueryBody)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                ])
            }
            searchData.type = "update-main-post"
            searchData.postQuery = esUpdateQuery
            searchData.threadQuery = esUpdateQuery
            searchController.searchKafkaInsert(searchData)
            return true
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
            log.info("successfull updation of tags in all three db sources")
            if (existinghashTags.length > 0 && hashTagsQueryBody.length > 0) {
                let cassInsertQuery = queryBuilder.getCassandraHashTagQuery(paramsBody, existinghashTags, dateEdited)
                console.log("cassInsertQuery :", cassInsertQuery)
                hashTagResult = await Promise.all([
                    esdb.bulkData(hashTagsQueryBody)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "hashtagIndex" }),
                    cassdb.executeQuery(cassInsertQuery[0], cassInsertQuery[1])
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "cassandraHashTags" })
                ])
            }
            else if (existinghashTags.length > 0) {
                let cassInsertQuery = queryBuilder.getCassandraHashTagQuery(paramsBody, existinghashTags, dateEdited)
                hashTagResult = await Promise.all([
                    cassdb.executeQuery(cassInsertQuery[0], cassInsertQuery[1])
                        .then(result => result)
                        .catch(err => err = { status: 500, error: err, location: "cassandraHashTags" })
                ])
            }
            else if(hashTagsQueryBody.length > 0) {
                console.log("hashTagsQueryBody : ", hashTagsQueryBody)
                hashTagResult = await Promise.all([
                    esdb.bulkData(hashTagsQueryBody)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "hashtagIndex" })
                ])
            }
            searchData.type = "update-main-post"
            searchData.postQuery = esUpdateQuery
            searchData.threadQuery = esUpdateQuery
            searchController.searchKafkaInsert(searchData)
            return true
        }
        else {
            return false
        }



    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error" + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

module.exports = {
    publishPost,
    draftPost,
    editMeta,
    deletePost,
    editTags,
    getPostById,
    edit
}
