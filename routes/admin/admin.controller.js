/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const esdb = require('../../ESUtil/elasticSearch');
const cassdb = require('../../CassandraUtil/cassandra')

const log = require('../../Logger/log');

const uuidv1 = require('uuid/v1');
//reusing the follow services
const followController = require('../follow/follow.controller')
const authToolController = require('../authTool/authTool.controller')
const activityController = require('../userActivity/userActivity.controller')
const postController = require('../post/post.controller')
const searchController = require('../search/search.controller')

const timelineUtilServices = require("../../util/timelineUtil")
const queryBuilder = require('../../util/queryBuilder')

var request = require('request');

const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

const sbextIp = process.env.sbext_ip || properties.get('sbext_ip')
const sbextPort = process.env.sbext_port || properties.get('sbext_port')

function getFlagIds(postId, paramType, paramIndex, source) {
    try {
        let queryBody = {
            _source: source,
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "postid": {
                                    "value": postId
                                }
                            }
                        },
                        {
                            "nested": {
                                "path": "flag",
                                "query": {
                                    "term": {
                                        "flag.isFlagged": {
                                            "value": true
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        }
        return esdb.getData(queryBody, paramType, paramIndex)
    }
    catch (error) {
        throw error
    }
}

async function deletePost(paramsBody) {
    try {
        let deleteDate = new Date()
        let userData = await followController.getuserprofile(paramsBody.rootOrg,paramsBody.adminId)
        let roles = await getUserRoles(userData.id)
        if (roles.includes('social')) {
            let id = uuidv1()
            let userActivityQuery = queryBuilder.getAdminDeleteQuery(paramsBody, deleteDate, id)
            let deleteresult = await authToolController.deletePost(paramsBody, true)
            if (deleteresult.status == 204) {
                let userActivityResult = await
                    esdb.createData(userActivityQuery, "userpostactivityType", "userpostactivityIndex")
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "userpostactivity index" })
                if (userActivityResult.hasOwnProperty('status') == false) {
                    return { status: 204 }
                }
                else {
                    log.error("post deleted by admin ,could not insert in userpost activity index", insertResult)
                    throw { statuscode: 500, err: "internal server error", message: "insertion error" }
                }
            }
            else {
                throw { statuscode: 500, err: "internal server error", message: "could not delete the post" }
            }
        }
        else {
            throw { statuscode: 403, err: "access denied", message: "This functionality requires admin access" }
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

function getUserRoles(userid) {
    let url = `http://${sbextIp.toString()}:${sbextPort.toString()}/v0/user/roles?userid=${userid}`
    return new Promise((resolve, reject) => {
        request.get({
            url
        }, function (err, body) {
            if (err) {
                reject(err)
            }
            else {
                let result = JSON.parse(body.body)
                resolve(result.result.response)
            }
        })
    })
}

async function reactivatePost(paramsBody) {
    try {
        let searchData = {
            "type": "",
            "postQuery": {},
            "threadQuery": {},
            "subType": "",
            "locale":"en"
        }
        if(paramsBody.hasOwnProperty('locale')==true && paramsBody.locale!=null && paramsBody.locale!=''){
            searchData.locale=paramsBody.locale.toLowerCase()
        }
        let insertSearchFlag = false
        let userData = await followController.getuserprofile(paramsBody.rootOrg,paramsBody.adminId)
        let roles = await getUserRoles(userData.id)

        if (roles.includes('social')) {
            let reactivationDate = new Date()
            let id = uuidv1()
            let existingFlaggedObjects = []
            let cassFlag = 0
            let threadPost

            let cassFetchQuery = 'select flag from bodhi.post_count where root_org = ? and org = ? and post_id = ?;'
            let cassFetchParams = [paramsBody.rootOrg, paramsBody.org, paramsBody.id]

            let existingResult = await Promise.all([
                activityController.getUserActivity(paramsBody.id, paramsBody.adminId, "userpostactivityType", "userpostactivityIndex", true)
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "userpostactivity index" }),
                getFlagIds(paramsBody.id, "userpostactivityType", "userpostactivityIndex", ['id', 'flag'])
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "userpostactivity index" }),
                cassdb.executeQuery(cassFetchQuery, cassFetchParams)
                    .then(cassResult => cassResult)
                    .catch(err => err = { status: 500, error: err, location: "cassandra post_count table" }),
                authToolController.getPostById(paramsBody.id, "postType", "postIndex", true)
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "post index" }),

            ])

            let existingPost = existingResult[0].hits.hits
            let existingFlagged = existingResult[1].hits.hits
            let post = existingResult[3].hits.hits[0]

            if (post._source.postKind == 'Reply') {
                threadPost = await authToolController.getPostById(post._source.parentId, "threadType", "threadIndex", ['latestReply', 'id', 'replyCount', 'threadContributors'])
                    .then(esResult => esResult)
                    .catch(err => err = { status: 500, error: err, location: "thread Index" })

                threadPost = threadPost.hits.hits
            }

            //search index updates
            if (post._source.postKind != 'Comment') {
                searchData.postQuery = post._source
                if (post._source.postKind == 'Reply') {
                    searchData.type = 'reactivate-reply-post'
                    searchData.postQuery.parentId = post._source.parentId
                }
                else {
                    searchData.type = 'reactivate-main-post'
                }

                insertSearchFlag = true
            }

            if (existingResult[2].rows.length != 0) {
                if (Number(existingResult[2].rows[0].flag) > 0) {
                    cassFlag = Number(existingResult[2].rows[0].flag)
                }
            }

            if (existingFlagged.length != 0) {
                for (doc of existingFlagged) {
                    existingFlaggedObjects.push({
                        id: doc._source.id,
                        flag: doc._source.flag
                    })
                }
            }


            let reactivateQuery = queryBuilder.getAdminReativateQuery(existingPost, reactivationDate, paramsBody, existingFlaggedObjects, id, cassFlag, post, threadPost)
            let esUpdateQuery = reactivateQuery[0]
            let cassandraUpdate = reactivateQuery[1]
            let cassandraCounterUpdate = reactivateQuery[2]

            if (cassFlag != 0) {
                let updateResult = await Promise.all([
                    esdb.bulkData(esUpdateQuery)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "bulk update in es" }),
                    cassdb.executeCounterBatch(cassandraCounterUpdate)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandra post count" }),
                    cassdb.executeBatch(cassandraUpdate)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandra post table" }),
                ])

                let esUpdate = updateResult[0]
                let cassUpdate = updateResult[1]

                if (esUpdate.hasOwnProperty('status') == false && cassUpdate.hasOwnProperty('status') == false) {
                    log.info("successfull reactivation of the post")
                    if (insertSearchFlag) {
                        searchController.searchKafkaInsert(searchData)
                    }
                    return { status: 204 }
                }
                else {
                    log.error("update unsuccessfull", JSON.stringify(updateResult))
                    throw { statuscode: 500, err: "reactivation failed", message: "update failed in either post index,post table or useractivity index" }
                }
            }
            else {
                let updateResult = await Promise.all([
                    esdb.bulkData(esUpdateQuery)
                        .then(esResult => esResult)
                        .catch(err => err = { status: 500, error: err, location: "bulk update in es" }),
                    cassdb.executeBatch(cassandraUpdate)
                        .then(cassResult => cassResult)
                        .catch(err => err = { status: 500, error: err, location: "cassandra Post table" })
                ])

                let esUpdateResult = updateResult[0]
                let cassUpdateResult = updateResult[1]

                if (esUpdateResult.hasOwnProperty('status') == false && cassUpdateResult.hasOwnProperty('status') == false) {
                    log.info("successfull reactivation of the post")
                    if (insertSearchFlag == true) {
                        searchController.searchKafkaInsert(searchData)
                    }
                    return { status: 204 }
                }
                else {
                    log.error("update unsuccessfull", JSON.stringify(updateResult))
                    throw { statuscode: 500, err: "reactivation failed", message: "update failed in either post index,post table or useractivity index" }
                }
            }
        }
        else {
            throw { statuscode: 401, err: "access denied", message: "This functionality requires admin access" }
        }
    }
    catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            log.error("unexpected error " + error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}

async function adminTimeline(paramsBody, pgNo, pgSize) {
    try {
        if (paramsBody.type == 'adminFlaggedTimeline' || paramsBody.type == 'adminDeletedTimeline') {
            let userData = await followController.getuserprofile(paramsBody.rootOrg,paramsBody.userId)

            let roles = await getUserRoles(userData.id)

            if (roles.includes('social')) {
                let result = {}
                let hitCount = 0
                let newDataCount = 0
                let idsList = []
                let timelineContent = []

                let esType = "postType"
                let esIndex = "postIndex"
                let esTemplate = "postTemplate"

                let pageNo = pgNo * pgSize
                let userId = paramsBody['userId']
                let rootOrg = paramsBody['rootOrg']
                let org = paramsBody['org']

                let params = {}
                params['sizeValue'] = pgSize
                params['fromValue'] = pageNo
                params['sortField'] = "dtLastModified"
                params['sortOrder'] = "desc"
                params['rootOrgValue'] = rootOrg
                params['orgValue'] = org
                params['mustfilterdtLastModified'] = true
                params['mustfilterdtLastModifiedgteValue'] = 0
                params['mustfilterdtLastModifiedltValue'] = paramsBody['sessionId']
                params['mustfilteradmin'] = true

                if (paramsBody.type == 'adminFlaggedTimeline') {
                    params = postController.mustFilter(params, "isFlagged", true)
                    params = postController.mustFilter(params, "isAdminDeleted", false)
                }
                else {
                    params = postController.mustFilter(params, "isAdminDeleted", true)
                    params = postController.mustFilter(params, "isFlagged", true)
                }

                let adminTimelineResult = await esdb.templateSearch(params, esType, esIndex, esTemplate)
                let resultHits = adminTimelineResult['hits']
                if (resultHits["total"] > 0 && resultHits['hits'].length > 0) {
                    hitCount = resultHits["total"]
                    sourceData = resultHits["hits"]
                    for (let data of sourceData) {
                        data = data['_source']
                        idsList.push(data["id"])
                        timelineContent.push(data)
                    }
                }

                params['mustfilterdtLastModifiedgteValue'] = paramsBody['sessionId']
                params['mustfilterdtLastModifiedltValue'] = Date.now()
                let newDataResult = await esdb.templateSearch(params, esType, esIndex, esTemplate)
                newDataCount = newDataResult["hits"]["total"]

                if (idsList.length > 0 && paramsBody['type'] != 'myDrafts') {
                    activityObject = {
                        userId: paramsBody['userId'],
                        rootOrg: paramsBody['rootOrg'],
                        org: paramsBody['org'],
                        postId: idsList
                    }

                    let activityResult = await timelineUtilServices.fetchActivity(activityObject)
                    console.log(activityResult)
                    timelineContent.forEach(element => {
                        element.activity = activityResult.get(element['id'])
                    });
                }

                result = {
                    "hits": hitCount,
                    "result": timelineContent,
                    "sessionId": request['sessionId'],
                    "newDataCount": newDataCount,
                }
                return result
            }
            else {
                throw { statuscode: 401, err: "access denied", message: "This functionality requires admin access" }
            }
        }
        //TODO: Check if redirect to normal timeline with UI
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

async function viewConversation(paramsBody, pgno, pgsize, sortOrder) {
    try {
        let esPost = await authToolController.getPostById(paramsBody.postId,"postType","postIndex",['rootParentId'])
        let rootParentId = esPost['hits']['hits'][0]['_source']['rootParentId']
        if(rootParentId != null){
            paramsBody.postId = rootParentId
        }  
        
        return postController.viewConversation(paramsBody,pgno,pgsize,sortOrder)
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
    deletePost,
    reactivatePost,
    adminTimeline,
    viewConversation
}

















