/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const esdb = require('../../ESUtil/elasticSearch');

const log = require('../../Logger/log');

const cassdb = require('../../CassandraUtil/cassandra')
//uuid based on timestamp
const uuidv1 = require('uuid/v1');

const fallbackRetryUtil = require('../../util/fallbackRetryUtil')

const authToolController = require('../authTool/authTool.controller')

const postController = require('../post/post.controller')

const queryBuilder = require('../../util/queryBuilder')

const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

const flag_threshold = properties.get('flag_threshold')
const searchController = require('../search/search.controller')

async function getUserActivity(postId, userId, paramType, paramIndex, source) {
    try {
        let queryBody = {
            _source: source,
            query: {
                bool: {
                    "must": [
                        {
                            "term": {
                                "postid": {
                                    "value": postId
                                }
                            }
                        },
                        {
                            "term": {
                                "userId": {
                                    "value": userId
                                }
                            }
                        }
                    ]
                }
            }
        }
        return esdb.getData(queryBody, paramType, paramIndex)
    } catch (error) {
        throw error
    }
}


async function createActivity(paramsBody) {
    try {
        let searchData = {
            "type": "",
            "postQuery": {},
            "threadQuery": {},
            "subType": ""
        }
        let postDeleteFlag = false
        let updatePostIndex = false
        let postUpdateQuery = {}

        //check if the postId on which the activity is happening is authored by userId provided in the request body,if yes disable the activity
        let params = {}


        params['sizeValue'] = 10
        params['fromValue'] = 0
        params['rootOrgValue'] = paramsBody.rootOrg
        params['orgValue'] = paramsBody.org
        params['mustfilterId'] = true
        params['mustfilterIdValue'] = [paramsBody.id.toString()]

        let postDataResult = await esdb.templateSearch(params, "postType", "postIndex", "postTemplate")
        let parentId = postDataResult['hits']['hits'][0]['_source']['parentId']
        searchData.postQuery.parentId = parentId
        searchData.postQuery.id = paramsBody.id
        //See if can be combined with above query
        let isFlaggedPost = await authToolController.getPostById(paramsBody.id, "postType", "postIndex", ['isFlagged'])

        if (postDataResult['hits']['total'] > 0) {
            sourceData = postDataResult["hits"]['hits']
            for (let data of sourceData) {
                data = data['_source']
                postCreator = data['postCreator']
                postEditor = data['postEditor']
                if (postCreator['postCreatorId'] == paramsBody.userId) {
                    throw { statuscode: 401, err: "UNAUTHORIZED", message: "User cannot do any activity on post created by them" }
                }
                else if (postEditor.length > 0) {
                    postEditor.forEach(element => {
                        if (element['postEditorId'] == paramsBody.userId) {
                            throw { statuscode: 401, err: "UNAUTHORIZED", message: "User cannot do any activity on post created by them" }
                        }
                    });
                }
            }
        }

        let activityDate = new Date()
        let id = uuidv1()

        let checkforExistingActivity = await getUserActivity(paramsBody.id, paramsBody.userId, "userpostactivityType", "userpostactivityIndex", true)
        //console.log(checkforExistingActivity)

        let activityType = paramsBody.activityType
        //if already any activity exist
        if (checkforExistingActivity.hits.total > 0) {
            let updateQuery = []
            let activityObject = {
                post: checkforExistingActivity.hits.hits[0]._source,
                paramsBody,
                activityDate
            }
            //console.log(" in if")
            if (activityType.toLowerCase() == 'like') {
                if (checkforExistingActivity.hits.hits[0]._source.like.hasOwnProperty('isLiked') && checkforExistingActivity.hits.hits[0]._source.like.isLiked == true) {
                    activityObject.paramsBody.activityType = 'unlike'
                    updateQuery = queryBuilder.getUpdateActivityQuery(activityObject)
                    searchData.type = 'update-post-activity'
                    searchData.subType = 'unlike'
                }
                else if (checkforExistingActivity.hits.hits[0]._source.like.hasOwnProperty('isLiked') && checkforExistingActivity.hits.hits[0]._source.like.isLiked == false) {
                    //activity type is like
                    updateQuery = queryBuilder.getExistingActivityBody(activityObject)
                    searchData.type = 'update-post-activity'
                    searchData.subType = 'like'
                }
                else {
                    //activity type is like
                    updateQuery = queryBuilder.getExistingActivityBody(activityObject)
                    searchData.type = 'update-post-activity'
                    searchData.subType = 'like'
                }
            }

            else if (activityType.toLowerCase() == 'upvote') {
                if (checkforExistingActivity.hits.hits[0]._source.upVote.hasOwnProperty('isupVoted') && checkforExistingActivity.hits.hits[0]._source.upVote.isupVoted == true) {
                    throw { statuscode: 405, err: "The content is already upvoted", message: "The content is already upvoted" }
                }
                else if (checkforExistingActivity.hits.hits[0]._source.upVote.hasOwnProperty('isupVoted') && checkforExistingActivity.hits.hits[0]._source.upVote.isupVoted == false) {
                    //activity type is upVote
                    if (checkforExistingActivity.hits.hits[0]._source.downVote.hasOwnProperty('isdownVoted') && checkforExistingActivity.hits.hits[0]._source.downVote.isdownVoted == true) {
                        activityObject.paramsBody.activityType = 'undownvote'
                        updateQuery = queryBuilder.getUpdateActivityQuery(activityObject)
                        searchData.type = 'update-post-activity'
                        searchData.subType = 'upvote'
                    }
                    else {
                        updateQuery = queryBuilder.getExistingActivityBody(activityObject)
                        searchData.type = 'update-post-activity'
                        searchData.subType = 'upvote'
                    }

                }
                else {

                    if (checkforExistingActivity.hits.hits[0]._source.downVote.hasOwnProperty('isdownVoted') && checkforExistingActivity.hits.hits[0]._source.downVote.isdownVoted == true) {
                        activityObject.paramsBody.activityType = 'undownvote'
                        updateQuery = queryBuilder.getUpdateActivityQuery(activityObject)
                        searchData.type = 'update-post-activity'
                        searchData.subType = 'upvote'
                    }
                    else {
                        updateQuery = queryBuilder.getExistingActivityBody(activityObject)
                        searchData.type = 'update-post-activity'
                        searchData.subType = 'upvote'
                    }
                }
            }

            else if (activityType.toLowerCase() == 'downvote') {
                if (checkforExistingActivity.hits.hits[0]._source.downVote.hasOwnProperty('isdownVoted') && checkforExistingActivity.hits.hits[0]._source.downVote.isdownVoted == true) {
                    //activity type is downVote
                    throw { statuscode: 405, err: "The content is already downvoted", message: "The content is already downvoted" }
                }
                else if (checkforExistingActivity.hits.hits[0]._source.downVote.hasOwnProperty('isdownVoted') && checkforExistingActivity.hits.hits[0]._source.downVote.isdownVoted == false) {
                    //activity type is downVote
                    if (checkforExistingActivity.hits.hits[0]._source.upVote.hasOwnProperty('isupVoted') && checkforExistingActivity.hits.hits[0]._source.upVote.isupVoted == true) {
                        activityObject.paramsBody.activityType = 'unupvote'
                        updateQuery = queryBuilder.getUpdateActivityQuery(activityObject)
                        searchData.type = 'update-post-activity'
                        searchData.subType = 'downvote'
                    }
                    else {
                        updateQuery = queryBuilder.getExistingActivityBody(activityObject)
                        searchData.type = 'update-post-activity'
                        searchData.subType = 'downvote'
                    }
                }
                else {
                    //activity type is downVote
                    if (checkforExistingActivity.hits.hits[0]._source.upVote.hasOwnProperty('isupVoted') && checkforExistingActivity.hits.hits[0]._source.upVote.isupVoted == true) {
                        activityObject.paramsBody.activityType = 'unupvote'
                        updateQuery = queryBuilder.getUpdateActivityQuery(activityObject)
                        searchData.type = 'update-post-activity'
                        searchData.subType = 'downvote'
                    }
                    else {
                        updateQuery = queryBuilder.getExistingActivityBody(activityObject)
                        searchData.type = 'update-post-activity'
                        searchData.subType = 'downvote'
                    }
                }
            }

            else if (activityType.toLowerCase() == 'flag') {
                if (checkforExistingActivity.hits.hits[0]._source.flag.hasOwnProperty('isFlagged') && checkforExistingActivity.hits.hits[0]._source.flag.isFlagged == true) {
                    //activity type is unflag
                    activityObject.paramsBody.activityType = 'unflag'
                    updateQuery = queryBuilder.getUpdateActivityQuery(activityObject)

                    let cassFlagCount = 0
                    cassSelectQuery = 'select flag from bodhi.post_count where root_org = ? and org = ? and post_id = ?;'
                    cassSelectParams = [paramsBody.rootOrg, paramsBody.org, paramsBody.id]
                    cassSelectResult = await cassdb.executeQuery(cassSelectQuery, cassSelectParams)
                    if (cassSelectResult.rowLength > 0) {
                        cassFlagCount = Number(cassSelectResult.rows[0].flag)
                    }

                    if (isFlaggedPost['hits']['hits'][0]['_source']['isFlagged'] == true && (cassFlagCount - 1 == 0)) {
                        updatePostIndex = true
                        postUpdateQuery = {
                            id: paramsBody.id,
                            body: {
                                doc: {
                                    isFlagged: false
                                }
                            }
                        }

                    }
                }
                else if (checkforExistingActivity.hits.hits[0]._source.flag.hasOwnProperty('isFlagged') && checkforExistingActivity.hits.hits[0]._source.flag.isFlagged == false) {
                    //activity type is flag ,call the flag handler method to check whether to delete a post or not
                    updateQuery = queryBuilder.getExistingActivityBody(activityObject)
                    postDeleteFlag = await flagActivityHandler(paramsBody)
                    if (isFlaggedPost['hits']['hits'][0]['_source']['isFlagged'] == false) {
                        updatePostIndex = true
                        postUpdateQuery = {
                            id: paramsBody.id,
                            body: {
                                doc: {
                                    isFlagged: true
                                }
                            }
                        }
                    }
                }
                else {
                    //activity type is flag ,call the flag handler method to check whether to delete a post or not
                    updateQuery = queryBuilder.getExistingActivityBody(activityObject)
                    postDeleteFlag = await flagActivityHandler(paramsBody)
                    if (isFlaggedPost['hits']['hits'][0]['_source']['isFlagged'] == false) {
                        updatePostIndex = true
                        postUpdateQuery = {
                            id: paramsBody.id,
                            body: {
                                doc: {
                                    isFlagged: true
                                }
                            }
                        }
                    }
                }
            }

            let userPostActivityQuery = updateQuery[0]
            let cassQuery = updateQuery[1]

            if (updatePostIndex) {
                let updateResult = await Promise.all([
                    esdb.updateData(postUpdateQuery, "postType", "postIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "post index" }),
                    esdb.updateData(userPostActivityQuery, "userpostactivityType", "userpostactivityIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "useractivity index" }),
                    cassdb.executeCounterBatch(cassQuery)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
                ])

                postUpdateResult = updateResult[0]
                userActivityResult = updateResult[1]
                cassUpdateResult = updateResult[2]

                if (postUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false && userActivityResult.hasOwnProperty('status') == false) {
                    if (postDeleteFlag) {
                        deleteResult = await authToolController.deletePost(paramsBody, true)
                        log.info("due to crossing of the threshold postid : " + paramsBody.id + "deleted")
                    }
                    if (paramsBody.activityType.toLowerCase() != 'flag') {
                        searchController.searchKafkaInsert(searchData)
                    }
                    log.info("updation of user activity successfully done")
                    return { status: 204 }
                }
                else {
                    log.error("updation unsuccessfull", updateResult)
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
            else {
                let updateResult = await Promise.all([
                    esdb.updateData(userPostActivityQuery, "userpostactivityType", "userpostactivityIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "useractivity index" }),
                    cassdb.executeCounterBatch(cassQuery)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
                ])

                userActivityResult = updateResult[0]
                cassUpdateResult = updateResult[1]

                if (cassUpdateResult.hasOwnProperty('status') == false && userActivityResult.hasOwnProperty('status') == false) {
                    if (postDeleteFlag) {
                        deleteResult = await authToolController.deletePost(paramsBody, true)
                        log.info("due to crossing of the threshold postid : " + paramsBody.id + "deleted")
                    }
                    log.info("updation of user activity successfully done")
                    if (paramsBody.activityType.toLowerCase() != 'flag') {
                        searchController.searchKafkaInsert(searchData)
                    }
                    return { status: 204 }
                }
                else {
                    log.error("updation unsuccessfull", updateResult)
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
        }
        else {
            if (activityType.toLowerCase() == 'flag') {
                postDeleteFlag = await flagActivityHandler(paramsBody)
            }

            if (isFlaggedPost['hits']['hits'][0]["_source"]['isFlagged'] == false && activityType.toLowerCase() == 'flag') {
                updatePostIndex = true
                postUpdateQuery = {
                    id: paramsBody.id,
                    body: {
                        doc: {
                            isFlagged: true
                        }
                    }
                }
            }

            let activityObject = {
                paramsBody,
                id,
                activityDate
            }

            let insertQuery = queryBuilder.getActivityQueryBody(activityObject)
            let postInsertQuery = insertQuery[0]
            let cassQuery = insertQuery[1]

            if (updatePostIndex) {

                let insertResult = await Promise.all([
                    esdb.updateData(postUpdateQuery, "postType", "postIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                    esdb.createData(postInsertQuery, "userpostactivityType", "userpostactivityIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "user activity index" }),
                    cassdb.executeCounterBatch(cassQuery)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
                ])

                let postUpdateResult = insertResult[0]
                let userActivityResult = insertResult[1]
                let cassInsertResult = insertResult[2]

                if (postUpdateResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == false && userActivityResult.hasOwnProperty('status') == false) {
                    if (postDeleteFlag) {
                        deleteResult = await authToolController.deletePost(paramsBody, true)
                        log.info("due to crossing of the threshold postid : " + paramsBody.id + "deleted")
                    }
                    if (paramsBody.activityType.toLowerCase() != 'flag') {
                        searchData.type = 'update-post-activity'
                        searchData.subType = paramsBody.activityType
                        searchController.searchKafkaInsert(searchData)
                    }
                    log.info("successfull insertion of user activity")
                    return { status: 204 }
                }
                else {
                    log.error("insertion unsuccessfull", insertResult)
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
            else {
                let insertResult = await Promise.all([
                    esdb.createData(postInsertQuery, "userpostactivityType", "userpostactivityIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "postIndex" }),
                    cassdb.executeCounterBatch(cassQuery)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
                ])

                let userActivityResult = insertResult[0]
                let cassInsertResult = insertResult[1]

                if (userActivityResult.hasOwnProperty('status') == false && cassInsertResult.hasOwnProperty('status') == false) {
                    log.info("insertion of user activity successfull")
                    if (postDeleteFlag) {
                        deleteResult = await authToolController.deletePost(paramsBody, true)
                        log.info("due to crossing of the threshold postid : " + paramsBody.id + "deleted")
                    }
                    if (paramsBody.activityType.toLowerCase() != 'flag') {
                        searchData.type = 'update-post-activity'
                        searchData.subType = paramsBody.activityType
                        searchController.searchKafkaInsert(searchData)
                    }
                    return { status: 204 }
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

//to accpet a post as an answer to its parent post
async function acceptAnswer(paramsBody) {
    try {
        let searchData = {
            "type": "",
            "postQuery": {},
            "threadQuery": {},
            "subType": ""
        }
        let updateSearchIndex = true
        //console.log("acceptAnswer")
        let parentId = ""
        //get the parent id from the post accepted answer
        let parentPost = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "rootOrg": {
                                    "value": paramsBody.rootOrg
                                }
                            }
                        },
                        {
                            "term": {
                                "org": {
                                    "value": paramsBody.org
                                }
                            }
                        },
                        {
                            "term": {
                                "id": {
                                    "value": paramsBody.acceptedAnswer
                                }
                            }
                        }
                    ]
                }
            }
        }

        let parentPostResult = await esdb.getData(parentPost, "postType", "postIndex")
        if (parentPostResult.hits.total > 0) {
            if (parentPostResult.hits.hits[0]._source.postKind == 'Reply') {
                parentId = parentPostResult.hits.hits[0]._source.parentId
            }
            else {
                //throw {status: 400 , message : "Bad Request, The content is not of type Reply"}
                throw { statuscode: 400, err: "Bad Request, The content is not of type Reply", message: "Bad Request, The content is not of type Reply" }
            }
        }
        else {
            throw { statuscode: 404, err: "POST_NOT_FOUND", message: "POST_NOT_FOUND" }
        }
        //console.log("xyz")
        if (parentId == "" || parentId == null) {
            throw { statuscode: 400, err: "Bad Request, Parent Id not found", message: "Bad Request, Parent Id not found" }
        }

        //check userid and parentpost creator id to validate the authority
        //console.log("xyz")
        authorValidation = await postController.validateAuthor(paramsBody.rootOrg, paramsBody.org, paramsBody.userId, parentId)
        //console.log("authorValidation:" ,authorValidation)
        // if (authorValidation.status != 200) {
        //     return authorValidation
        // }
        let existingAnswer = ""

        //check if any answer is already accepted. if yes change its isaccepted value to false
        let query = {
            "_source": ["acceptedAnswers", "hasAcceptedAnswer"],
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "rootOrg": {
                                    "value": paramsBody.rootOrg
                                }
                            }
                        },
                        {
                            "term": {
                                "org": {
                                    "value": paramsBody.org
                                }
                            }
                        },
                        {
                            "term": {
                                "id": {
                                    "value": parentId
                                }
                            }
                        }
                    ]
                }
            }
        }

        let existingAnswerResult = await esdb.getData(query, "threadType", "threadIndex")
        if (existingAnswerResult.hits.total > 0) {
            if (existingAnswerResult.hits.hits[0]._source.hasAcceptedAnswer) {
                existingAnswer = existingAnswerResult.hits.hits[0]._source.acceptedAnswers
            }
        }

        if(existingAnswer == paramsBody.acceptedAnswer) {
            throw {statuscode: 400, err: 'Already accepted answer', message: 'Given answer is already the accepted answer'}
        }

        //generating query for postIndex,cassndrapost table, thread index
        let updateQuery = queryBuilder.getUpdateAcceptedAnswer(paramsBody, existingAnswer, parentId)
        let cassQuery = updateQuery[0]
        let postQuery = updateQuery[1]
        let threadQuery = updateQuery[2]

        let updateResult = await Promise.all([
            esdb.updateData(postQuery, "postType", "postIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "postIndex" }),
            esdb.updateData(threadQuery, "threadType", "threadIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "threadIndex" }),
            cassdb.executeBatch(cassQuery)
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
        ])

        let postUpdateResult = updateResult[0]
        let threadUpdateResult = updateResult[1]
        let cassUpdateResult = updateResult[2]

        if ((postUpdateResult.hasOwnProperty('status') == true || threadUpdateResult.hasOwnProperty('status') == true) && cassUpdateResult.hasOwnProperty('status') == false) {
            log.warn("update of accepted answer failed in either the post index or thread index, calling retry function")
            retryObject = {
                retryType: "update-post-thread-fail",
                queries: [postQuery, threadQuery],
                result: updateResult
            }
            flag = await fallbackRetryUtil.retry(retryObject)
            if (flag) {
                if (existingAnswer != "" && existingAnswer != null) {
                    cassandraexistingAnswerUpdateQuery = updateQuery[3]
                    postexistingAnswerUpdateQuery = updateQuery[4]
                    updateExistingAnswer(cassandraexistingAnswerUpdateQuery, postexistingAnswerUpdateQuery)
                    updateSearchIndex = false
                }
                if (updateSearchIndex) {
                    searchData.type = 'update-post-activity'
                    searchData.subType = 'updateHasAcceptedAnswer'
                    searchData.postQuery.parentId = parentId
                    searchController.searchKafkaInsert(searchData)
                }
                return { status: 204 }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "updation error" }

            }
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == true) {
            log.warn("update of accepted answer failed in cassandra post table but successfull in the post and thread index calling fallback funciton")
            fallbackObject = {
                fallbackType: "update-cass-fail",
                queries: cassQuery,
                result: null
            }
            fallbackRetryUtil.fallback(fallbackObject)
            //updating existing answer meta data
            if (existingAnswer != "" && existingAnswer != null) {
                cassandraexistingAnswerUpdateQuery = updateQuery[3]
                postexistingAnswerUpdateQuery = updateQuery[4]
                updateExistingAnswer(cassandraexistingAnswerUpdateQuery, postexistingAnswerUpdateQuery)
                updateSearchIndex = false
            }
            if (updateSearchIndex) {
                searchData.type = 'update-post-activity'
                searchData.subType = 'updateHasAcceptedAnswer'
                searchData.postQuery.parentId = parentId
                searchController.searchKafkaInsert(searchData)
            }
            return { status: 204 }
        }
        else if (postUpdateResult.hasOwnProperty('status') == false && threadUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
            log.info("successfull updation of accepted answer in all three db sources")
            //updating existing answer meta data
            if (existingAnswer != "" && existingAnswer != null) {
                cassandraexistingAnswerUpdateQuery = updateQuery[3]
                postexistingAnswerUpdateQuery = updateQuery[4]
                updateExistingAnswer(cassandraexistingAnswerUpdateQuery, postexistingAnswerUpdateQuery)
                updateSearchIndex = false
            }
            if (updateSearchIndex) {
                searchData.type = 'update-post-activity'
                searchData.subType = 'updateHasAcceptedAnswer'
                searchData.postQuery.parentId = parentId
                searchController.searchKafkaInsert(searchData)
            }
            return { status: 204 }
        }
        else {
            throw { statuscode: 500, err: "internal server error", message: "updation error" }
        }

    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error " + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }



}


async function updateExistingAnswer(cassandraexistingAnswerUpdateQuery, postexistingAnswerUpdateQuery) {
    try {
        let updateResult1 = await Promise.all([
            esdb.updateData(postexistingAnswerUpdateQuery, "postType", "postIndex")
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "postIndex" }),
            cassdb.executeBatch(cassandraexistingAnswerUpdateQuery)
                .then(result => result)
                .catch(err => err = { status: 500, error: err, location: "cassandraPost" })
        ])

        let existingAnswerPostResult = updateResult1[0]
        let existingAnswerCassResult = updateResult1[1]
        if (existingAnswerPostResult.hasOwnProperty('status') == true && existingAnswerCassResult.hasOwnProperty('status') == false) {
            log.warn("update of existing accepted answer failed in the post index , calling retry function")
            let retryObject = {
                retryType: "update-post-fail",
                queries: [postexistingAnswerUpdateQuery],
                result: updateResult1
            }
            let flag = await fallbackRetryUtil.retry(retryObject)
            if (!flag) {
                log.error({ statuscode: 500, err: "internal server error", message: "updation error" })
            }
        }
        else if (existingAnswerPostResult.hasOwnProperty('status') == false && existingAnswerCassResult.hasOwnProperty('status') == true) {
            log.warn("update of existing accepted answer failed in cassandra post table but successfull in the post index calling fallback funciton")
            let fallbackObject = {
                fallbackType: "update-cass-fail",
                queries: cassandraexistingAnswerUpdateQuery,
                result: null
            }
            fallbackRetryUtil.fallback(fallbackObject)
        }
        else if (existingAnswerPostResult.hasOwnProperty('status') == false && existingAnswerCassResult.hasOwnProperty('status') == false) {
            log.info("successfull updation of existing accepted answer in all two db sources")
        }
        else {
            log.error({ statuscode: 500, err: "internal server error", message: "updation error" })
        }
    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error " + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}



async function flagActivityHandler(paramsBody) {
    cassSelectQuery = 'select flag from bodhi.post_count where root_org = ? and org = ? and post_id = ?;'
    cassSelectParams = [paramsBody.rootOrg, paramsBody.org, paramsBody.id]

    cassSelectResult = await cassdb.executeQuery(cassSelectQuery, cassSelectParams)

    if (cassSelectResult.rowLength > 0) {
        let currentFlagCount = cassSelectResult.rows[0].flag
        //TODO: Check if flagCount is reset if post gets restored
        if (Number(currentFlagCount) + 1 == Number(flag_threshold)) {
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



module.exports = {
    createActivity,
    acceptAnswer,
    getUserActivity
}