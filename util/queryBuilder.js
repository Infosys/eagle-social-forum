/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const postSchema = require('../routes/authTool/postSchema.js')

const threadSchema = require('../routes/authTool/threadSchema.js')

const userActivitySchema = require('../routes/userActivity/userActivitySchema.js')

const searchSchema = require('../routes/search/searchSchema')

const log = require('../Logger/log');

const uuidv1 = require('uuid/v1');

const flagging_values = {
    'INAPPROPRIATE_CONTENT': 'Inappropriate content',
    'CONTENT_NOT_ORIGINAL': 'Content Not Original',
    'IRRELEVANT_CONTENT': 'Irrelevant Content',
    'SPAM': 'Spam'
}

function getPostQueryBody(paramsBody, id, dateCreated, creatorDetails, accessPathsList, status) {
    let queryBody = postSchema()
    let sourceId = ""
    let sourceName = ""
    if (paramsBody.hasOwnProperty('source')) {
        sourceId = paramsBody.source.id
        sourceName = paramsBody.source.name
    }
    else if (paramsBody.hasOwnProperty('id') == false) {
        sourceId = ""
        //sourceId = paramsBody.rootOrg.replace(/ /g, "_") + "_" + paramsBody.org + "_SocialForum"
        sourceName = "Social"
    }


    let postContent = {
        body: paramsBody.postContent.body
    }

    if (paramsBody.postContent.hasOwnProperty('title')) {
        postContent.title = paramsBody.postContent.title
    }
    if (paramsBody.postContent.hasOwnProperty('abstract')) {
        postContent.abstract = paramsBody.postContent.abstract
    }

    if (status == 'Active') {
        if (paramsBody.hasOwnProperty('id')) {
            queryBody.dtPublished = new Date()
        }
        else {
            queryBody.dtPublished = dateCreated
        }
    }

    if (paramsBody.hasOwnProperty('thumbnail')) {
        queryBody.thumbnail = paramsBody.thumbnail
    }

    //creating post query body for initial post 
    if (paramsBody.hasOwnProperty('parentId') == false) {
        if (paramsBody.postKind == 'Leadership-Blog') {
            queryBody.activityEndDate = paramsBody.activityEndDate
        }
        if (paramsBody.postKind == 'Poll' || paramsBody.postKind == 'Survey') {
            queryBody.activityEndDate = paramsBody.activityEndDate
            queryBody.options = paramsBody.options
        }

        if (paramsBody.hasOwnProperty('tags')) {
            queryBody.tags = paramsBody.tags
        }

        if (paramsBody.hasOwnProperty('hashTags')) {
            queryBody.hashTags = paramsBody.hashTags
        }

        queryBody.rootOrg = paramsBody.rootOrg
        queryBody.org = paramsBody.org
        queryBody.id = id
        queryBody.postKind = paramsBody.postKind
        queryBody.dtCreated = dateCreated
        queryBody.dtLastModified = dateCreated
        queryBody.postCreator.postCreatorId = creatorDetails.id
        queryBody.postCreator.name = creatorDetails.name
        queryBody.accessPaths = accessPathsList
        queryBody.postContent = postContent
        queryBody.status = status
        queryBody.source.id = sourceId
        queryBody.source.name = sourceName

        return queryBody
    }
    //creating post query body for postkind reply and comment
    else {
        queryBody.rootOrg = paramsBody.rootOrg
        queryBody.org = paramsBody.org
        queryBody.id = id
        queryBody.parentId = paramsBody.parentId
        if (paramsBody.postKind.toLowerCase() == 'reply') {
            queryBody.rootParentId = paramsBody.parentId
        }
        else {
            queryBody.rootParentId = paramsBody.rootParentId
        }
        queryBody.postKind = paramsBody.postKind
        queryBody.postCreator.postCreatorId = creatorDetails.id
        queryBody.postCreator.name = creatorDetails.name
        queryBody.dtCreated = dateCreated
        queryBody.dtLastModified = dateCreated
        queryBody.status = status
        queryBody.postContent = postContent
        queryBody.source.id = paramsBody.parentSource.id
        queryBody.source.name = paramsBody.parentSource.name
        queryBody.accessPaths = accessPathsList

        return queryBody
    }

}

function getThreadQueryBody(paramsBody, id, dateCreated, creatorDetails, accessPathsList, status) {

    let threadQueryBody = threadSchema()

    let postContent = {
        body: paramsBody.postContent.body
    }

    if (paramsBody.postContent.hasOwnProperty('title')) {
        postContent.title = paramsBody.postContent.title
    }
    if (paramsBody.postContent.hasOwnProperty('abstract')) {
        postContent.abstract = paramsBody.postContent.abstract
    }

    if (paramsBody.postKind == 'Leadership-Blog') {
        threadQueryBody.activityEndDate = paramsBody.activityEndDate
    }
    if (paramsBody.postKind == 'Poll' || paramsBody.postKind == 'Survey') {
        threadQueryBody.activityEndDate = paramsBody.activityEndDate
        threadQueryBody.options = paramsBody.options
    }
    if (status == 'Active') {
        if (paramsBody.hasOwnProperty('id')) {
            threadQueryBody.dtPublished = new Date()
        }
        else {
            threadQueryBody.dtPublished = dateCreated
        }
    }
    if (paramsBody.hasOwnProperty('tags')) {
        threadQueryBody.tags = paramsBody.tags
    }

    if (paramsBody.hasOwnProperty('hashTags')) {
        threadQueryBody.hashTags = paramsBody.hashTags
    }

    if (paramsBody.hasOwnProperty('thumbnail')) {
        threadQueryBody.thumbnail = paramsBody.thumbnail
    }

    let threadContributors = [{
        threadContributorId: creatorDetails.id,
        name: creatorDetails.name
    }]

    let sourceId = ""
    let sourceName = ""
    if (paramsBody.hasOwnProperty('source')) {
        sourceId = paramsBody.source.id
        sourceName = paramsBody.source.name
    }
    else if (paramsBody.hasOwnProperty('id') == false) {
        sourceId = ""
        //sourceId = paramsBody.rootOrg.replace(/ /g, "_") + "_" + paramsBody.org + "_SocialForum"
        sourceName = "Social"
    }

    threadQueryBody.rootOrg = paramsBody.rootOrg
    threadQueryBody.org = paramsBody.org
    threadQueryBody.id = id
    threadQueryBody.postKind = paramsBody.postKind
    threadQueryBody.dtCreated = dateCreated
    threadQueryBody.dtLastModified = dateCreated
    threadQueryBody.postCreator.postCreatorId = creatorDetails.id
    threadQueryBody.postCreator.name = creatorDetails.name
    threadQueryBody.threadContributors = threadContributors
    threadQueryBody.accessPaths = accessPathsList
    threadQueryBody.status = status
    threadQueryBody.postContent = postContent
    threadQueryBody.source.id = sourceId
    threadQueryBody.source.name = sourceName

    return threadQueryBody
    // else {
    //     let threadQueryBody = {}

    //     threadQueryBody.id = id
    //     threadQueryBody.postKind = paramsBody.postKind
    //     threadQueryBody.dtCreated = dateCreated
    //     threadQueryBody.dtLastModified = dateCreated
    //     threadQueryBody.dtPublished = dateCreated
    //     threadQueryBody.lastEdited = {}
    //     threadQueryBody.postContent = {
    //         title: paramsBody.postContent.title,
    //         body: paramsBody.postContent.body,
    //         abstract: paramsBody.postContent.abstract
    //     }

    //     return threadQueryBody
    // }

}

function getCassndraQuery(paramsBody, id, dateCreated, creatorDetails, accessPathsList, status) {

    let dtPublished = null
    let tags = null
    let hashTags = null
    let postContent = {}
    let thumbnail = ""
    let rootParentId = null

    if (paramsBody.postContent.hasOwnProperty('title')) {
        postContent.title = paramsBody.postContent.title
    }

    if (paramsBody.postContent.hasOwnProperty('body')) {
        postContent.body = paramsBody.postContent.body
    }

    if (paramsBody.postContent.hasOwnProperty('abstract')) {
        postContent.abstract = paramsBody.postContent.abstract
    }

    let postCreator = {
        postCreatorId: creatorDetails.id,
        name: creatorDetails.name
        
    }

    let source = {}
    if (paramsBody.hasOwnProperty('source')) {
        source = {
            id: paramsBody.source.id,
            name: paramsBody.source.name
        }
    }
    else if (paramsBody.hasOwnProperty('id') == false) {
        source = {
            id:"",
            name: "Social"
        }
    }

    if (paramsBody.parentId != null) {
        source = {
            id: paramsBody.parentSource.id,
            name: paramsBody.parentSource.name
        }
    }

    if (paramsBody.postKind.toLowerCase() == 'reply') {
        rootParentId = paramsBody.parentId
    }
    else {
        rootParentId = paramsBody.rootParentId
    }

    if (status == 'Active') {
        if (paramsBody.hasOwnProperty('id')) {
            dtPublished = new Date()
        }
        else {
            dtPublished = dateCreated
        }
    }
    if (paramsBody.hasOwnProperty('tags')) {
        tags = paramsBody.tags
    }

    if (paramsBody.hasOwnProperty('hashTags')) {
        hashTags = paramsBody.hashTags
    }

    if (paramsBody.hasOwnProperty('thumbnail')) {
        thumbnail = paramsBody.thumbnail
    }

    if (paramsBody.hasOwnProperty('id') && status == 'Active') {
        let cassandraUpdateQuery = 'update bodhi.post set date_published = ?, post_content =? ,status = ?, tags = ?,hashtags=?, thumbnail=? where root_org =? and org =? and post_id =?'
        let paramsList = [dtPublished, postContent, status, tags, hashTags, thumbnail, paramsBody.rootOrg, paramsBody.org, paramsBody.id]

        return [cassandraUpdateQuery, paramsList]
    }
    else if (paramsBody.hasOwnProperty('id') && status == 'Draft') {
        let cassandraUpdateQuery = 'update bodhi.post set  post_content =? ,status = ?, tags = ?, hashtags=?,thumbnail=? where root_org =? and org =? and post_id =?'
        let paramsList = [postContent, status, tags, hashTags, thumbnail, paramsBody.rootOrg, paramsBody.org, paramsBody.id]

        return [cassandraUpdateQuery, paramsList]
    }
    else {
        let cassandraPostInsertQuery = 'INSERT INTO bodhi.post(root_org,org,post_id,date_created,date_last_modified,date_published,post_content,post_creator,post_kind,accessPaths,source,status,tags,hashtags,thumbnail) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        let paramsList = [paramsBody.rootOrg, paramsBody.org, id, dateCreated, dateCreated, dtPublished, postContent, postCreator, paramsBody.postKind, accessPathsList, source, status, tags, hashTags, thumbnail]

        if (paramsBody.hasOwnProperty('parentId')) {
            cassandraPostInsertQuery = 'INSERT INTO bodhi.post(root_org,org,post_id,date_created,date_last_modified,date_published,post_content,post_creator,post_kind,source,status,parent_id,root_parent_id,accesspaths) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            paramsList = [paramsBody.rootOrg, paramsBody.org, id, dateCreated, dateCreated, dtPublished, postContent, postCreator, paramsBody.postKind, source, status, paramsBody.parentId, rootParentId, accessPathsList]
        }
        if (paramsBody.postKind == 'Leadership-Blog') {
            cassandraPostInsertQuery = 'INSERT INTO bodhi.post(root_org,org,post_id,date_created,date_last_modified,date_published,post_content,post_creator,post_kind,accessPaths,source,status,activity_end_date,tags,hashtags,thumbnail) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            paramsList = [paramsBody.rootOrg, paramsBody.org, id, dateCreated, dateCreated, dtPublished, postContent, postCreator, paramsBody.postKind, accessPathsList, source, status, paramsBody.activityEndDate, tags, hashTags, thumbnail]
        }
        if (paramsBody.postKind == 'Poll' || paramsBody.postKind == 'Survey') {
            cassandraPostInsertQuery = 'INSERT INTO bodhi.post(root_org,org,post_id,date_created,date_last_modified,date_published,post_content,post_creator,post_kind,accessPaths,source,status,activity_end_date,options,tags,hashtags,thumbnail) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            paramsList = [paramsBody.rootOrg, paramsBody.org, id, dateCreated, dateCreated, dtPublished, postContent, postCreator, paramsBody.postKind, accessPathsList, source, status, paramsBody.activityEndDate, paramsBody.options, tags, hashTags, thumbnail]
        }
        return [cassandraPostInsertQuery, paramsList]
    }
}

function getCassndraMetaQuery(paramsBody, currentPostContent, dateEdited) {

    let body = currentPostContent.body || null;
    let abstract = currentPostContent.abstract || null;
    let title = currentPostContent.title || null;

    let cassInsertQuery = 'insert into bodhi.post_history(root_org,org,post_history_id,abstract,body,date_edited,editor,post_id,title) VALUES(?,?,?,?,?,?,?,?,?)'
    let cassInsertParams = [paramsBody.rootOrg, paramsBody.org, uuidv1(), abstract, body, dateEdited, paramsBody.editor, paramsBody.id, title]

    let updatedPostContent = currentPostContent

    let lastEdited = {
        dtLastEdited: dateEdited,
        editorId: paramsBody.editor
    }

    if (paramsBody.meta.hasOwnProperty('title')) {
        updatedPostContent.title = paramsBody.meta.title
    }
    if (paramsBody.meta.hasOwnProperty('abstract')) {
        updatedPostContent.abstract = paramsBody.meta.abstract
    }
    if (paramsBody.meta.hasOwnProperty('body')) {
        updatedPostContent.body = paramsBody.meta.body
    }

    if (paramsBody.meta.hasOwnProperty('thumbnail')) {
        cassandraUpdateQuery = 'update bodhi.post set post_content = ? , thumbnail = ? where root_org = ? and org=? and post_id = ?'
        cassandraUpdateParams = [updatedPostContent, paramsBody.meta.thumbnail, paramsBody.rootOrg, paramsBody.org, paramsBody.id]
    }
    else {
        cassandraUpdateQuery = 'update bodhi.post set post_content = ? where root_org = ? and org=? and post_id = ?'
        cassandraUpdateParams = [updatedPostContent, paramsBody.rootOrg, paramsBody.org, paramsBody.id]
    }


    return { cassUpdate: [cassandraUpdateQuery, cassandraUpdateParams], cassInsert: [cassInsertQuery, cassInsertParams] }

}

function getUpdateQueryBody(updateObject, updateType) {
    let postUpdateQuery = {}
    let threadUpdateQuery = {}
    let cassandraUpdateQuery = []

    if (updateType == "update") {

        postUpdateQuery = {
            id: updateObject.params.paramsBody.parentId,
            body: {
                script: {
                    params: {

                    },
                    inline: {

                    }
                }
            }
        }

        threadUpdateQuery = {
            id: updateObject.params.paramsBody.parentId,
            body: {
                script: {
                    params: {

                    },
                    inline: {

                    }
                }
            }
        }

        if (updateObject.params.paramsBody.postKind == 'Comment') {
            postUpdateQuery.body.script.inline = "ctx._source['commentCount']+=1"
            cassandraUpdateQuery.push({ query: 'update bodhi.post_count SET comment_count = comment_count + ? where root_org=? and org=? and post_id =?', params: [1, updateObject.params.paramsBody.rootOrg, updateObject.params.paramsBody.org, updateObject.params.paramsBody.parentId] })

            return [postUpdateQuery, null, cassandraUpdateQuery]
        }

        let lastEdited = {
            dtLastEdited: updateObject.params.dateCreated,
            editorId: updateObject.thread.postQueryBody.postCreator.postCreatorId
        }

        let latestReply = {
            activityEndDate: updateObject.thread.postQueryBody.activityEndDate,
            dtCreated: updateObject.thread.postQueryBody.dtCreate,
            dtPublished: updateObject.thread.postQueryBody.dtPublished,
            dtLastModified: updateObject.thread.postQueryBody.dtLastModified,
            id: updateObject.thread.postQueryBody.id,
            lastEdited: lastEdited,
            postContent: updateObject.thread.postQueryBody.postContent,
            postKind: updateObject.thread.postQueryBody.postKind
        }


        if (updateObject.params.paramsBody.postKind == 'Reply') {
            cassandraUpdateQuery.push({ query: 'update bodhi.post SET date_last_modified = ? where root_org=? and org=? and post_id =?', params: [dateCreated, updateObject.params.paramsBody.rootOrg, updateObject.params.paramsBody.org, updateObject.params.paramsBody.parentId] })

            postUpdateQuery.body.script.params.dtLastModified = updateObject.params.dateCreated
            postUpdateQuery.body.script.inline = "ctx._source['dtLastModified'] = params.dtLastModified"

            threadUpdateQuery.body.script.params.latestReply = latestReply
            threadUpdateQuery.body.script.params.dtLastModified = updateObject.params.dateCreated
            threadUpdateQuery.body.script.inline = "ctx._source['dtLastModified'] = params.dtLastModified; ctx._source['replyCount']+=1; ctx._source['latestReply'] = params.latestReply"

            let threadContributors = updateObject.thread.threadFetchResult._source.threadContributors
            let flag = false
            threadContributors.forEach(element => {
                if (element.threadContributorId == updateObject.params.creatorDetails.id) {
                    flag = true
                }
            });

            if (flag == false) {
                threadUpdateQuery.body.script.inline = "ctx._source['dtLastModified'] = params.dtLastModified; ctx._source['replyCount']+=1; ctx._source['latestReply'] = params.latestReply; ctx._source['threadContributors'].add(params.threadContributors)"
                threadUpdateQuery.body.script.params.threadContributors = {
                    threadContributorId: updateObject.params.creatorDetails.id,
                    name: updateObject.params.creatorDetails.name
                }
            }
            return [postUpdateQuery, threadUpdateQuery, cassandraUpdateQuery]
        }

    }

    if (updateType == "update-tag") {

        let editDetails = {
            dtLastEdited: updateObject.dates.toString(),
            editorId: updateObject.paramsBody.editor
        }
        let cassTagMapQuery = []

        let cassPostQuery = {
            query: 'update bodhi.post set tags=?,last_edited=? where root_org=? and org=? and post_id=? ',
            params: [updateObject.tags, editDetails, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
        }

        if (updateObject.tagAdded.length > 0) {
            updateObject.tagAdded.forEach(element => {
                cassTagMapQuery.push({
                    query: 'insert into bodhi.user_tag_post_mapping(root_org,org,post_id,tag_id,date_activity_performed,activity,user_id) values(?,?,?,?,?,?,?)',
                    params: [updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id, element.id, updateObject.dates, "added", updateObject.paramsBody.editor]
                })
            })
        }

        if (updateObject.tagRemoved.length > 0) {
            updateObject.tagRemoved.forEach(element => {
                cassTagMapQuery.push({
                    query: 'insert into bodhi.user_tag_post_mapping(root_org,org,post_id,tag_id,date_activity_performed,activity,user_id) values(?,?,?,?,?,?,?)',
                    params: [updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id, element.id, updateObject.dates, "removed", updateObject.paramsBody.editor]
                })
            })
        }

        let esUpdateQuery = {
            id: updateObject.paramsBody.id,
            body: {
                doc: {
                    lastEdited: {
                        dtLastEdited: updateObject.dates,
                        editorId: updateObject.paramsBody.editor
                    },
                    tags: updateObject.tags
                }
            }
        }

        return [cassPostQuery, cassTagMapQuery, esUpdateQuery]
    }

    if (updateType == "delete-post-thread") {
        threadUpdateQuery = {
            id: updateObject.paramsBody.id,
            body: {
                doc: {
                    status: "Inactive"
                }
            }
        }
        if (updateObject.flagDelete) {
            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status = ?, is_admin_deleted = ? ,is_flagged = ? ,admin_date_deletion = ? where root_org =? and org = ? and post_id = ?',
                params: ["Inactive", true, true, updateObject.deleteDate, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })

            postUpdateQuery = {
                id: updateObject.paramsBody.id,
                body: {
                    doc: {
                        status: "Inactive",
                        adminDateDeletion: updateObject.deleteDate,
                        isFlagged: true,
                        isAdminDeleted: true
                    }
                }
            }
        }
        else {
            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status = ? where root_org =? and org = ? and post_id = ?',
                params: ["Inactive", updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })
            postUpdateQuery = {
                id: updateObject.paramsBody.id,
                body: {
                    doc: {
                        status: "Inactive"
                    }
                }
            }
        }

        return [postUpdateQuery, threadUpdateQuery, cassandraUpdateQuery]
    }

    if (updateType == "delete-post") {
        cassandraUpdateQuery.push({
            query: 'update bodhi.post set status = ? where root_org =? and org = ? and post_id = ?',
            params: ["Inactive", updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
        })
        postUpdateQuery = {
            id: updateObject.paramsBody.id,
            body: {
                doc: {
                    status: "Inactive"
                }
            }
        }
        return [postUpdateQuery, threadUpdateQuery, cassandraUpdateQuery]
    }

    if (updateType == "delete-reply") {
        let threadContributors = updateObject.parentPost.threadContributors
        let threadUpdateQuery = {
            id: updateObject.parentPost.id,
            body: {
                doc: {
                    replyCount: updateObject.parentPost.replyCount - 1
                }
            }
        }

        if (updateObject.isAcceptedAnswer == true) {
            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status = ?,is_accepted_answer = ?  where root_org =? and org = ? and post_id = ?',
                params: ["Inactive", false, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })
            if (updateObject.flagDelete) {
                cassandraUpdateQuery.push({
                    query: 'update bodhi.post set status = ?,is_accepted_answer = ?, is_admin_deleted = ? ,is_flagged = ? ,admin_date_deletion = ? where root_org =? and org = ? and post_id = ?',
                    params: ["Inactive", false, true, true, updateObject.deleteDate, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
                })
            }

            postUpdateQuery.body.doc.isAcceptedAnswer = false
            threadUpdateQuery.body.doc.hasAcceptedAnswer = false
            threadUpdateQuery.body.doc.acceptedAnswers = null

        }
        else if (updateObject.flagDelete) {
            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status = ?, is_admin_deleted = ? ,is_flagged = ? ,admin_date_deletion = ? where root_org =? and org = ? and post_id = ?',
                params: ["Inactive", true, true, updateObject.deleteDate, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })
            postUpdateQuery = {
                id: updateObject.paramsBody.id,
                body: {
                    doc: {
                        status: "Inactive",
                    }
                }
            }
        }
        else {
            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status = ? where root_org =? and org = ? and post_id = ?',
                params: ["Inactive", updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })

            postUpdateQuery = {
                id: updateObject.paramsBody.id,
                body: {
                    doc: {
                        status: "Inactive",
                        adminDateDeletion: updateObject.deleteDate,
                        isFlagged: true,
                        isAdminDeleted: true
                    }
                }
            }
        }

        if (updateObject.contributorDeleteFlag) {
            let index = threadContributors.findIndex(i => i.threadContributorId == updateObject.paramsBody.userId)
            threadContributors.splice(index, 1)
            threadUpdateQuery.body.doc.threadContributors = threadContributors
        }

        return [postUpdateQuery, threadUpdateQuery, cassandraUpdateQuery]
    }

    if (updateType == "delete-latestReply") {
        let threadContributors = updateObject.parentPost.hits.hits[0]._source.threadContributors
        let parentPostQuery = {
            id: updateObject.parentPost.hits.hits[0]._source.id,
            body: {
                doc: {
                    dtLastModified: updateObject.lastDateModified,
                }
            }
        }

        let cassParentPostQuery = [{
            query: 'update bodhi.post set date_last_modified =? where root_org=? and org=? and post_id =?',
            params: [updateObject.lastDateModified, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.parentPost.hits.hits[0]._source.id]
        }]
        let latestReplyToUpdate = {}

        if (updateObject.nextLatestReply.hasOwnProperty('id')) {
            latestReplyToUpdate = {
                activityEndDate: updateObject.nextLatestReply.activityEndDate,
                dtCreated: updateObject.nextLatestReply.dtCreate,
                dtPublished: updateObject.nextLatestReply.dtPublished,
                dtLastModified: updateObject.nextLatestReply.dtLastModified,
                id: updateObject.nextLatestReply.id,
                lastEdited: updateObject.nextLatestReply.lastEdited,
                postContent: updateObject.nextLatestReply.postContent,
                postKind: updateObject.nextLatestReply.postKind
            }
            threadUpdateQuery = {
                id: updateObject.parentPost.hits.hits[0]._source.id,
                body: {
                    doc: {
                        replyCount: updateObject.parentPost.hits.hits[0]._source.replyCount - 1,
                        dtLastModified: updateObject.lastDateModified,
                        latestReply: latestReplyToUpdate
                    }
                }
            }
        }

        threadUpdateQuery = {
            id: updateObject.parentPost.hits.hits[0]._source.id,
            body: {
                script: {
                    params: {

                    },
                    inline: {

                    }
                }
            }
        }

        threadUpdateQuery.body.script.inline = "ctx._source['dtLastModified'] = params.dtLastModified; ctx._source['replyCount']=params.replyCount; ctx._source['latestReply'] = params.latestReply;"
        threadUpdateQuery.body.script.params.latestReply = latestReplyToUpdate
        threadUpdateQuery.body.script.params.dtLastModified = updateObject.lastDateModified
        threadUpdateQuery.body.script.params.replyCount = updateObject.parentPost.hits.hits[0]._source.replyCount - 1

        if (updateObject.flagDelete) {
            postUpdateQuery = {
                id: updateObject.paramsBody.id,
                body: {
                    doc: {
                        status: "Inactive",
                        adminDateDeletion: updateObject.deleteDate,
                        isFlagged: true,
                        isAdminDeleted: true
                    }
                }
            }

            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status = ?, is_admin_deleted = ? ,is_flagged = ? ,admin_date_deletion = ? where root_org =? and org = ? and post_id = ?',
                params: ["Inactive", true, true, updateObject.deleteDate, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })
        }
        else {
            postUpdateQuery = {
                id: updateObject.paramsBody.id,
                body: {
                    doc: {
                        status: "Inactive"
                    }
                }
            }
            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status =? where root_org=? and org=? and post_id =?',
                params: ["Inactive", updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })
        }

        if (updateObject.isAcceptedAnswer == true) {

            threadUpdateQuery.body.script.inline = "ctx._source['dtLastModified'] = params.dtLastModified; ctx._source['replyCount']=params.replyCount; ctx._source['latestReply'] = params.latestReply;ctx._source['hasAcceptedAnswer'] = false;ctx._source['acceptedAnswers'] = null;"

            postUpdateQuery.body.doc.isAcceptedAnswer = false

            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status =? ,is_accepted_answer = ? where root_org=? and org=? and post_id =?',
                params: ["Inactive", false, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })

        }


        if (updateObject.contributorDeleteFlag == true) {
            let index = threadContributors.findIndex(i => i.threadContributorId == updateObject.contributorId)
            threadContributors.splice(index, 1)
            threadUpdateQuery.body.script.inline = threadUpdateQuery.body.script.inline + "ctx._source['threadContributors'] = params.threadContributors;"
            threadUpdateQuery.body.script.params.threadContributors = threadContributors

        }

        return [postUpdateQuery, threadUpdateQuery, cassandraUpdateQuery, parentPostQuery, cassParentPostQuery]
    }

    if (updateType == 'delete-comment') {

        if (updateObject.flagDelete) {
            postUpdateQuery = {
                id: updateObject.paramsBody.id,
                body: {
                    doc: {
                        status: "Inactive",
                        adminDateDeletion: updateObject.deleteDate,
                        isFlagged: true,
                        isAdminDeleted: true
                    }
                }
            }

            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status =? ,is_accepted_answer = ? where root_org=? and org=? and post_id =?',
                params: ["Inactive", true, true, updateObject.deleteDate, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })
        }
        else {
            postUpdateQuery = {
                id: updateObject.paramsBody.id,
                body: {
                    doc: {
                        status: "Inactive"
                    }
                }
            }

            cassandraUpdateQuery.push({
                query: 'update bodhi.post set status =? where root_org=? and org=? and post_id =?',
                params: ["Inactive", updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
            })
        }

        let cassParentPostQuery = [{
            query: 'update bodhi.post_count SET comment_count = comment_count - ? where root_org=? and org=? and post_id =?',
            params: [1, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.parentPost.hits.hits[0]._source.id]
        }]

        let parentPostQuery = {
            id: updateObject.parentPost.hits.hits[0]._source.id,
            body: {
                script: {
                    inline: "ctx._source['commentCount']-=1"
                }
            }
        }

        return [postUpdateQuery, cassandraUpdateQuery, parentPostQuery, cassParentPostQuery]
    }
    if (updateType == "update-hashtag") {

        let editDetails = {
            dtLastEdited: updateObject.dates.toString(),
            editorId: updateObject.paramsBody.editor
        }

        let cassPostQuery = {
            query: 'update bodhi.post set hashtags=?,last_edited=? where root_org=? and org=? and post_id=? ',
            params: [updateObject.hashtags, editDetails, updateObject.paramsBody.rootOrg, updateObject.paramsBody.org, updateObject.paramsBody.id]
        }

        let esUpdateQuery = {
            id: updateObject.paramsBody.id,
            body: {
                doc: {
                    lastEdited: {
                        dtLastEdited: updateObject.dates,
                        editorId: updateObject.paramsBody.editor
                    },
                    hashTags: updateObject.hashtags
                }
            }
        }

        return [cassPostQuery, esUpdateQuery]
    }
}

function getActivityQueryBody(activityObject) {
    let postQueryBody = userActivitySchema()
    let cassUserActivity = []
    let cassuserActivityQuery = ""

    let cassUserActivityParams = [1, activityObject.paramsBody.rootOrg, activityObject.paramsBody.org, activityObject.paramsBody.id]

    //console.log("postQueryBody : " , postQueryBody)
    postQueryBody.rootOrg = activityObject.paramsBody.rootOrg
    postQueryBody.org = activityObject.paramsBody.org
    postQueryBody.postid = activityObject.paramsBody.id
    postQueryBody.userId = activityObject.paramsBody.userId
    postQueryBody.id = activityObject.id

    if (activityObject.paramsBody.activityType.toLowerCase() == 'like') {
        //console.log("in like")
        //console.log(activityObject.activityDate)
        postQueryBody.like.dtActivity = activityObject.activityDate
        postQueryBody.like.isLiked = true

        cassuserActivityQuery = 'update bodhi.post_count set like = like + ? where root_org = ? and org = ? and post_id = ?'

    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'upvote') {
        postQueryBody.upVote.dtActivity = activityObject.activityDate
        postQueryBody.upVote.isupVoted = true

        cassuserActivityQuery = 'update bodhi.post_count set up_vote = up_vote + ? where root_org = ? and org = ? and post_id = ?'

    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'downvote') {
        postQueryBody.downVote.dtActivity = activityObject.activityDate
        postQueryBody.downVote.isdownVoted = true

        cassuserActivityQuery = 'update bodhi.post_count set down_vote = down_vote + ? where root_org = ? and org = ? and post_id = ?'

    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'flag') {
        postQueryBody.flag.dtActivity = activityObject.activityDate
        postQueryBody.flag.isFlagged = true
        postQueryBody.flag.commentType = activityObject.paramsBody.userComment.commentType
        postQueryBody.flag.comment = flagging_values[activityObject.paramsBody.userComment.comment]

        cassuserActivityQuery = 'update bodhi.post_count set flag = flag + ? where root_org = ? and org = ? and post_id = ?'
    }

    cassUserActivity.push({
        query: cassuserActivityQuery,
        params: cassUserActivityParams
    })

    return [postQueryBody, cassUserActivity]

}

function getUpdateActivityQuery(activityObject) {
    let postUpdateQuery = {
        id: activityObject.post.id,
        body: {
            doc: {

            }
        }
    }

    let cassUserActivity = []
    let cassuserActivityQuery = ""
    let cassUserActivityParams = [1, activityObject.paramsBody.rootOrg, activityObject.paramsBody.org, activityObject.paramsBody.id]

    if (activityObject.paramsBody.activityType.toLowerCase() == 'unlike') {
        postUpdateQuery.body.doc.like = {
            dtActivity: activityObject.activityDate,
            isLiked: false
        }
        cassuserActivityQuery = 'update bodhi.post_count set dislike = dislike + ? where root_org = ? and org = ? and post_id = ?'
    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'undownvote') {
        postUpdateQuery.body.doc.downVote = {
            dtActivity: activityObject.activityDate,
            isdownVoted: false
        }
        cassuserActivityQuery = 'update bodhi.post_count set down_vote = down_vote - ? where root_org = ? and org = ? and post_id = ?'
    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'unupvote') {
        postUpdateQuery.body.doc.upVote = {
            dtActivity: activityObject.activityDate,
            isupVoted: false
        }
        cassuserActivityQuery = 'update bodhi.post_count set up_vote = up_vote - ? where root_org = ? and org = ? and post_id = ?'
    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'unflag') {
        postUpdateQuery.body.doc.flag = {
            dtActivity: activityObject.activityDate,
            isFlagged: false
        }
        cassuserActivityQuery = 'update bodhi.post_count set flag = flag - ? where root_org = ? and org = ? and post_id = ?'
    }

    cassUserActivity.push({
        query: cassuserActivityQuery,
        params: cassUserActivityParams
    })

    return [postUpdateQuery, cassUserActivity]
}

function getExistingActivityBody(activityObject) {
    //console.log(JSON.stringify(activityObject,null,'\t'))
    let postQueryBody = {
        id: activityObject.post.id,
        body: {
            doc: {

            }
        }
    }

    let cassuserActivityQuery = ""
    let cassUserActivity = []

    let cassUserActivityParams = [1, activityObject.paramsBody.rootOrg, activityObject.paramsBody.org, activityObject.paramsBody.id]

    if (activityObject.paramsBody.activityType.toLowerCase() == 'like') {
        postQueryBody.body.doc.like = {
            dtActivity: activityObject.activityDate,
            isLiked: true
        }
        cassuserActivityQuery = 'update bodhi.post_count set like = like + ? where root_org = ? and org = ? and post_id = ?'

    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'upvote') {
        postQueryBody.body.doc.upVote = {
            dtActivity: activityObject.activityDate,
            isupVoted: true
        }
        cassuserActivityQuery = 'update bodhi.post_count set up_vote = up_vote + ? where root_org = ? and org = ? and post_id = ?'

    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'downvote') {
        postQueryBody.body.doc.downVote = {
            dtActivity: activityObject.activityDate,
            isdownVoted: true
        }
        cassuserActivityQuery = 'update bodhi.post_count set down_vote = down_vote + ? where root_org = ? and org = ? and post_id = ?'

    }
    else if (activityObject.paramsBody.activityType.toLowerCase() == 'flag') {
        console.log("in the get exisisting query function")
        console.log(JSON.stringify(activityObject))
        postQueryBody.body.doc.flag = {
            dtActivity: activityObject.activityDate,
            isFlagged: true,
            commentType: activityObject.paramsBody.userComment.commentType,
            comment: flagging_values[activityObject.paramsBody.userComment.comment]
        }

        cassuserActivityQuery = 'update bodhi.post_count set flag = flag + ? where root_org = ? and org = ? and post_id = ?'
    }

    cassUserActivity.push({
        query: cassuserActivityQuery,
        params: cassUserActivityParams
    })

    return [postQueryBody, cassUserActivity]
}

//to update the acceptedAnswer value for a post
function getUpdateAcceptedAnswer(acceptedAnswerObject, existingAnswer, parentId) {
    let postUpdateQuery = {}
    let threadUpdateQuery = {}
    let cassandraUpdateQuery = []
    let cassandraexistingAnswerUpdateQuery = []
    let postexistingAnswerUpdateQuery = {}

    let dtModified = new Date()
    cassandraUpdateQuery.push({
        query: 'update bodhi.post set is_accepted_answer = ?,date_last_modified=? where root_org =? and org = ? and post_id = ?',
        params: [true, dtModified, acceptedAnswerObject.rootOrg, acceptedAnswerObject.org, acceptedAnswerObject.acceptedAnswer]
    })

    postUpdateQuery = {
        id: acceptedAnswerObject.acceptedAnswer,
        body: {
            doc: {
                isAcceptedAnswer: true,
                dtLastModified: dtModified
            }
        }
    }

    threadUpdateQuery = {
        id: parentId,
        body: {
            doc: {
                hasAcceptedAnswer: true,
                acceptedAnswers: acceptedAnswerObject.acceptedAnswer,
                dtLastModified: dtModified
            }
        }
    }

    if (existingAnswer != "" && existingAnswer != null) {
        cassandraexistingAnswerUpdateQuery.push({
            query: 'update bodhi.post set is_accepted_answer = ?,date_last_modified=? where root_org =? and org = ? and post_id = ?',
            params: [false, dtModified, acceptedAnswerObject.rootOrg, acceptedAnswerObject.org, existingAnswer]
        })

        postexistingAnswerUpdateQuery = {
            id: existingAnswer,
            body: {
                doc: {
                    isAcceptedAnswer: false,
                    dtLastModified: dtModified
                }
            }
        }
    }
    return [cassandraUpdateQuery, postUpdateQuery, threadUpdateQuery, cassandraexistingAnswerUpdateQuery, postexistingAnswerUpdateQuery]
}

//paramsBody.hashTags = new hashtags from ui
//hashTagData = hahstags found in es
//existingList = if any hashtag is already present in the index
function getHashTagQuery(paramsBody, hashTagData, existingList = null) {
    //convert the hashtag to lowercase
    //check for its presence in the index
    //if present add ,increment the count
    //if not add it to index

    //convert the tags to lowercase
    let updateObjList = []
    let hashTagsList_ToInsert = paramsBody.hashTags.map(v => v.toLowerCase());
    let hashTagsList_currentList = paramsBody.hashTags.map(v => v.toLowerCase());
    //forming the update query for existing hashtags
    if (hashTagData.length > 0) {
        if (existingList == null || existingList.length == 0) {
            for (let data of hashTagData) {
                data = data._source
                hashTagsList_ToInsert = hashTagsList_ToInsert.filter(v => v !== data.name)
                let updateIndexObj = {
                    update: {
                        _index: "hashtags",
                        _type: "hashtags",
                        _id: data.id
                    }
                }
                let updateDataObj = {
                    doc: {
                        count: data.count + 1
                    }
                }
                updateObjList.push(updateIndexObj)
                updateObjList.push(updateDataObj)
            }
        }
        else {
            let hashTagsList_existingList = existingList.map(v => v.toLowerCase());
            for (let data of hashTagData) {
                data = data._source
                hashTagsList_ToInsert = hashTagsList_ToInsert.filter(v => v !== data.name)
                //if the hashtag is there in both existing list and list shared by ui no action to be taken
                //if hashtag is there in existing list not in list shared by ui decrement
                //if hashtag is there in list shared by ui but not in exitsing list,increment
                //if not in hashtag index , add to hashtag index
                let updateDataObj = {}
                let updateIndexObj = {
                    update: {
                        _index: "hashtags",
                        _type: "hashtags",
                        _id: data.id
                    }
                }
                if (hashTagsList_existingList.includes(data.name) == true && hashTagsList_currentList.includes(data.name) == false) {
                    updateDataObj = {
                        doc: {
                            count: data.count - 1
                        }
                    }
                    updateObjList.push(updateIndexObj)
                    updateObjList.push(updateDataObj)
                }
                if (hashTagsList_existingList.includes(data.name) == false && hashTagsList_currentList.includes(data.name) == true) {
                    updateDataObj = {
                        doc: {
                            count: data.count + 1
                        }
                    }
                    updateObjList.push(updateIndexObj)
                    updateObjList.push(updateDataObj)
                }

            }
        }
    }

    //generating insert objects
    hashTagsList_ToInsert.forEach(element => {
        let hashTagId = uuidv1()
        let insertIndexObj = {
            create: {
                _index: "hashtags",
                _type: "hashtags",
                _id: hashTagId
            }
        }
        let insertDataObj = {
            id: hashTagId,
            name: element,
            count: 1
        }
        updateObjList.push(insertIndexObj)
        updateObjList.push(insertDataObj)
    });

    return updateObjList
}

function getCassandraHashTagQuery(paramsBody, existingTags, dtActivityPerformed) {
    let cassHashTagInsertQuery = 'insert into bodhi.user_hashtag_post_mapping(root_org,org,hashtag_history_id,post_id,hashtag,date_activity_performed,user_id) VALUES(?,?,?,?,?,?,?)'
    let cassHashTagInsertParams = [paramsBody.rootOrg, paramsBody.org, uuidv1(), paramsBody.id, existingTags, dtActivityPerformed, paramsBody.editor]
    return [cassHashTagInsertQuery, cassHashTagInsertParams]
}

function getAdminDeleteQuery(paramsBody, deleteDate, id) {
    let userActivityQuery = userActivitySchema()

    userActivityQuery.rootOrg = paramsBody.rootOrg
    userActivityQuery.org = paramsBody.org
    userActivityQuery.postid = paramsBody.id
    userActivityQuery.userId = paramsBody.adminId
    userActivityQuery.id = id
    userActivityQuery.adminActivity.dateDeleted = deleteDate
    userActivityQuery.adminActivity.deletionReason = flagging_values[paramsBody.userComment.comment]
    userActivityQuery.adminActivity.dateReactivated = null
    userActivityQuery.adminActivity.reactivationReason = null

    return userActivityQuery
}

function getSearchIndexQuerybody(data) {
    if (data.type == 'insert-main-post') {
        let queryBody = searchSchema()

        if (data.postQuery.postContent.hasOwnProperty('abstract') == true) {
            queryBody.abstract = data.postQuery.postContent.abstract
        }

        if (data.postQuery.postKind == 'Poll' || data.postQuery.postKind == 'Survey') {
            queryBody.activityEndDate = data.postQuery.activityEndDate
            queryBody.options = data.postQuery.options
        }

        if (data.postQuery.hasOwnProperty('thumbnail') == true) {
            queryBody.thumbnail = data.postQuery.thumbnail
        }

        if (data.postQuery.hasOwnProperty('tags')) {
            let tags = []
            for (tag of data.postQuery.tags) {
                tags.push(tag.name)
            }
            queryBody.tags = tags
        }

        if (data.postQuery.hasOwnProperty('hashTags')) {
            queryBody.hashTags = data.postQuery.hashTags
        }

        queryBody.id = data.postQuery.id
        queryBody.body = data.postQuery.postContent.body
        queryBody.title = data.postQuery.postContent.title
        queryBody.org = data.postQuery.org
        queryBody.rootOrg = data.postQuery.rootOrg
        queryBody.dtLastModified = data.postQuery.dtCreated
        queryBody.dtCreated = data.postQuery.dtCreated
        queryBody.dtPublished = data.postQuery.dtCreated
        queryBody.postCreator = data.postQuery.postCreator
        queryBody.postKind = data.postQuery.postKind
        queryBody.source = data.postQuery.source
        queryBody.status = data.postQuery.status
        queryBody.threadContributors = data.threadQuery.threadContributors
        queryBody.accessPaths = data.postQuery.accessPaths

        return { type: "insert", queryBody: queryBody ,locale:data.locale.toLowerCase()}
    }
    else if (data.type == 'insert-reply-post') {
        let searchUpdateQuery = {
            id: data.postQuery.parentId,
            body: {
                script: {
                    params: {

                    },
                    inline: {

                    }
                }
            }
        }

        let reply = {}
        reply.id = data.postQuery.id
        reply.body = data.postQuery.postContent.body

        searchUpdateQuery.body.script.params.reply = reply
        searchUpdateQuery.body.script.params.dtLastModified = data.postQuery.dtPublished
        searchUpdateQuery.body.script.inline = "ctx._source['dtLastModified'] = params.dtLastModified; ctx._source['replyCount']+=1; ctx._source['reply'].add(params.reply)"

        if (data.threadQuery.body.script.params.hasOwnProperty('threadContributors')) {
            searchUpdateQuery.body.script.params.threadContributors = data.threadQuery.body.script.params.threadContributors
            searchUpdateQuery.body.script.inline = "ctx._source['dtLastModified'] = params.dtLastModified; ctx._source['replyCount']+=1;ctx._source['reply'].add(params.reply);ctx._source['threadContributors'].add(params.threadContributors)"
        }

        return { type: "update", queryBody: searchUpdateQuery ,locale:data.locale.toLowerCase()}
    }
    else if (data.type == 'update-main-post') {
        let searchUpdateQuery = {
            id: data.postQuery.id,
            body: {
                doc: {
                }
            }
        }

        if (data.postQuery.body.doc.hasOwnProperty('postContent') == true) {
            if (data.postQuery.body.doc.postContent.hasOwnProperty('body') == true) {
                searchUpdateQuery.body.doc.body = data.postQuery.body.doc.postContent.body
            }
            if (data.postQuery.body.doc.postContent.hasOwnProperty('abstract') == true) {
                searchUpdateQuery.body.doc.abstract = data.postQuery.body.doc.postContent.abstract
            }
            if (data.postQuery.body.doc.postContent.hasOwnProperty('title') == true) {
                searchUpdateQuery.body.doc.title = data.postQuery.body.doc.postContent.title
            }
            if (data.postQuery.body.doc.hasOwnProperty('thumbnail') == true) {
                searchUpdateQuery.body.doc.thumbnail = data.postQuery.body.doc.thumbnail
            }
        }

        if (data.postQuery.body.doc.hasOwnProperty('tags') == true) {
            let tags = []
            for (tag of data.postQuery.body.doc.tags) {
                tags.push(tag.name)
            }
            searchUpdateQuery.body.doc.tags = tags
        }

        if (data.postQuery.body.doc.hasOwnProperty('hashTags') == true) {
            searchUpdateQuery.body.doc.hashTags = data.postQuery.body.doc.hashTags
        }

        return { type: "update", queryBody: searchUpdateQuery,locale:data.locale.toLowerCase() }

    }
    else if (data.type == 'update-reply-post') {
        let parentReplyList = data.parentPost['reply']
        let searchUpdateQuery = {
            id: data.postQuery.parentId,
            body: {
                doc: {

                }
            }
        }

        for (reply of parentReplyList) {
            if (reply.id == data.postQuery.id) {
                reply.body = data.postQuery.body.doc.postContent.body
            }
        }

        searchUpdateQuery.body.doc.reply = parentReplyList

        return { type: "update", queryBody: searchUpdateQuery,locale:data.locale.toLowerCase() }
    }
    else if (data.type == 'delete-main-post') {
        let searchUpdateQuery = {
            id: data.postQuery.id,
            body: {
                doc: {
                    status: "Inactive"
                }
            }
        }

        return { type: "update", queryBody: searchUpdateQuery,locale:data.locale.toLowerCase() }
    }
    else if (data.type == 'delete-reply-post') {
        let parentReplyList = data.parentPost.reply
        let searchUpdateQuery = {
            id: data.postQuery.parentId,
            body: {
                script: {
                    params: {

                    },
                    inline: {

                    }
                }
            }
        }

        if (data.threadQuery.body.hasOwnProperty("script")) {
            searchUpdateQuery.body.script.params.threadContributors = data.threadQuery.body.script.params.threadContributors
            searchUpdateQuery.body.script.params.replyCount = data.parentPost.replyCount - 1

            let index = parentReplyList.findIndex(i => i.id == data.postQuery.id)
            parentReplyList.splice(index, 1)
            searchUpdateQuery.body.script.params.reply = parentReplyList
            searchUpdateQuery.body.script.inline = "ctx._source['threadContributors'] = params.threadContributors; ctx._source['replyCount']=params.replyCount; ctx._source['reply'] = params.reply"

            if (data.threadQuery.body.script.params.hasOwnProperty('dtLastModified') == true) {
                searchUpdateQuery.body.script.params.dtLastModified = data.threadQuery.body.script.params.dtLastModified
                searchUpdateQuery.body.script.inline = "ctx._source['threadContributors'] = params.threadContributors; ctx._source['replyCount']=params.replyCount; ctx._source['reply'] = params.reply ; ctx._source['dtLastModified'] = params.dtLastModified"
                if (data.threadQuery.body.script.params.hasOwnProperty('isAcceptedAnswer') == true) {
                    searchUpdateQuery.body.script.inline = "ctx._source['threadContributors'] = params.threadContributors; ctx._source['replyCount']=params.replyCount; ctx._source['reply'] = params.reply ; ctx._source['dtLastModified'] = params.dtLastModified ; ctx._source['hasAcceptedAnswer'] = false"
                }
            }
            if (data.threadQuery.body.script.params.hasOwnProperty('isAcceptedAnswer') == true && data.threadQuery.body.script.params.hasOwnProperty('dtLastModified') == false) {
                searchUpdateQuery.body.script.inline = "ctx._source['threadContributors'] = params.threadContributors; ctx._source['replyCount']=params.replyCount; ctx._source['reply'] = params.reply ; ctx._source['hasAcceptedAnswer'] = false"
            }

            return { type: "update", queryBody: searchUpdateQuery }
        }
        else {
            searchUpdateQuery.body.script.params.threadContributors = data.threadQuery.body.doc.threadContributors
            searchUpdateQuery.body.script.params.replyCount = data.parentPost['replycount'] - 1

            let index = parentReplyList.findIndex(i => i.id == data.postQuery.id)
            parentReplyList.splice(index, 1)
            searchUpdateQuery.body.script.params.reply = parentReplyList
            searchUpdateQuery.body.script.inline = "ctx._source['threadContributors'] = params.threadContributors; ctx._source['replyCount']=params.replyCount; ctx._source['reply'] = params.reply"

            if (data.threadQuery.body.doc.hasOwnProperty('isAcceptedAnswer') == true) {
                searchUpdateQuery.body.script.inline = "ctx._source['threadContributors'] = params.threadContributors; ctx._source['replyCount']=params.replyCount; ctx._source['reply'] = params.reply; ctx._source['hasAcceptedAnswer'] = false"
            }

            searchUpdateQuery.body.script.inline = inline

            return { type: "update", queryBody: searchUpdateQuery,locale:data.locale.toLowerCase() }
        }

    }
    else if (data.type == 'update-post-activity') {
        if (data.postQuery.parentId == null) {
            id = data.postQuery.id
        }
        else {
            id = data.postQuery.parentId
        }
        let searchUpdateQuery = {
            id: id,
            body: {
                script: {
                    params: {

                    },
                    inline: {

                    }
                }
            }
        }


        if (data.subType.toLowerCase() == 'like') {
            searchUpdateQuery.body.script.inline = "ctx._source['likeCount']+=1"
        }
        else if (data.subType.toLowerCase() == 'unlike') {
            searchUpdateQuery.body.script.inline = "ctx._source['likeCount']-=1"
        }
        else if (data.subType.toLowerCase() == 'upvote') {
            searchUpdateQuery.body.script.inline = "ctx._source['upVoteCount']+=1"
        }
        else if (data.subType.toLowerCase() == 'downvote') {
            searchUpdateQuery.body.script.inline = "ctx._source['upVoteCount']-=1"
        }
        else if (data.subType == 'updateHasAcceptedAnswer') {
            searchUpdateQuery.body.script.inline = "ctx._source['hasAcceptedAnswer'] = true"
        }

        return { type: "update", queryBody: searchUpdateQuery,locale:data.locale.toLowerCase() }

    }
    else if (data.type == 'reactivate-main-post') {
        let searchUpdateQuery = {
            id: data.postQuery.id,
            body: {
                doc: {
                    status: "Active"
                }
            }
        }

        return { type: "update", queryBody: searchUpdateQuery ,locale:data.locale.toLowerCase()}

    }
    else if (data.type = 'reactivate-reply-post') {
        let searchUpdateQuery = {
            id: data.postQuery.parentId,
            body: {
                script: {
                    params: {

                    },
                    inline: {

                    }
                }
            }
        }


        let reply = {}
        let threadContributor = {}
        reply.id = data.postQuery.id
        reply.body = data.postQuery.postContent.body
        searchUpdateQuery.body.script.params.reply = reply

        searchUpdateQuery.body.script.inline = "ctx._source['replyCount']+=1; ctx._source['reply'].add(params.reply)"

        let currentThreadContributors = []

        for (contributor of data.parentPost.threadContributors) {
            currentThreadContributors.push(contributor.threadContributorId)
        }

        if (currentThreadContributors.includes(data.postQuery.postCreator.postCreatorId) == false) {
            threadContributor.threadContributorId = data.postQuery.postCreator.postCreatorId
            threadContributor.name = data.postQuery.postCreator.name
            searchUpdateQuery.body.script.params.threadContributor = threadContributor
            searchUpdateQuery.body.script.inline = "ctx._source['replyCount']+=1; ctx._source['reply'].add(params.reply); ctx._source['threadContributors'].add(params.threadContributor)"
        }

        return { type: "update", queryBody: searchUpdateQuery ,locale:data.locale.toLowerCase()}
    }
}
function getAdminReativateQuery(existingPost, reactivationDate, paramsBody, existingFlaggedObjects, id, cassFlag, post, threadPost) {

    let updateObjList = []
    let cassandraUpdate = []
    let cassandraCounterUpdate = []

    if (existingPost.length != 0) {
        if (Object.keys(existingPost[0]._source.adminActivity).length != 0) {
            updateObjList.push({
                update: {
                    _index: "userpostactivity",
                    _type: "userpostactivity",
                    _id: existingPost[0]._source.id
                }
            })
            updateObjList.push({
                doc: {
                    adminActivity: {
                        dateDeleted: existingPost[0]._source.adminActivity.dateDeleted,
                        deletionReason: existingPost[0]._source.adminActivity.deletionReason,
                        dateReactivated: reactivationDate,
                        reactivationReason: paramsBody.reactivateReason
                    }
                }
            })
        }
        else {
            updateObjList.push({
                update: {
                    _index: "userpostactivity",
                    _type: "userpostactivity",
                    _id: existingPost[0]._source.id
                }
            })
            updateObjList.push({
                doc: {
                    adminActivity: {
                        dateDeleted: null,
                        deletionReason: null,
                        dateReactivated: reactivationDate,
                        reactivationReason: paramsBody.reactivateReason
                    }
                }
            })
        }

    }
    else {
        let adminActivity = {}

        updateObjList.push({
            create: {
                _index: "userpostactivity",
                _type: "userpostactivity",
                _id: id
            }
        })

        adminActivity.dateDeleted = null
        adminActivity.deletionReason = null
        adminActivity.dateReactivated = reactivationDate
        adminActivity.reactivationReason = paramsBody.reactivateReason

        updateObjList.push({
            id: id,
            rootOrg: paramsBody.rootOrg,
            org: paramsBody.org,
            postid: paramsBody.id,
            userId: paramsBody.adminId,
            adminActivity: adminActivity,
            flag: {},
            downVote: {},
            upVote: {},
            like: {}
        })
    }

    updateObjList.push({
        update: {
            _index: "post",
            _type: "post",
            _id: paramsBody.id
        }
    })
    updateObjList.push({
        doc: {
            isFlagged: false,
            isAdminDeleted: false,
            status: "Active"
        }
    })

    if (post._source.postKind == 'Reply') {
        let replyCount = Number(threadPost[0]._source.replyCount) + 1
        let threadId = threadPost[0]._source.id
        let threadContributor = {}
        let currentThreadContributors = []

        for (contributor of threadPost[0]._source.threadContributors) {
            currentThreadContributors.push(contributor.threadContributorId)
        }

        if (currentThreadContributors.includes(post._source.postCreator.postCreatorId) == false) {
            threadContributor.threadContributorId = post._source.postCreator.postCreatorId
            threadContributor.name = post._source.postCreator.name
            threadPost[0]._source.threadContributors.push(threadContributor)
        }

        if (threadPost.length > 0) {
            if (threadPost[0]._source.latestReply.dtPublished < post._source.dtPublished) {
                console.log("in the change of latest reply")
                let latestReply = {
                    activityEndDate: post._source.activityEndDate,
                    dtCreated: post._source.dtCreated,
                    dtPublished: post._source.dtPublished,
                    dtLastModified: post._source.dtLastModified,
                    id: post._source.id,
                    lastEdited: post._source.lastEdited,
                    postContent: post._source.postContent,
                    postKind: post._source.postKind
                }

                updateObjList.push({
                    update: {
                        _index: "thread",
                        _type: "thread",
                        _id: threadId
                    }
                })
                updateObjList.push({
                    doc: {
                        latestReply: latestReply,
                        replyCount: replyCount,
                        threadContributors: threadPost[0]._source.threadContributors
                    }
                })
            }
            else {
                updateObjList.push({
                    update: {
                        _index: "thread",
                        _type: "thread",
                        _id: threadId
                    }
                })
                updateObjList.push({
                    doc: {
                        replyCount: replyCount,
                        threadContributors: threadPost[0]._source.threadContributors
                    }
                })
            }
        }
        else {
            let latestReply = {
                activityEndDate: post._source.activityEndDate,
                dtCreated: post._source.dtCreated,
                dtPublished: post._source.dtPublished,
                dtLastModified: post._source.dtLastModified,
                id: post._source.id,
                lastEdited: lastEdited,
                postContent: post._source.postContent,
                postKind: post._source.postKind
            }

            updateObjList.push({
                update: {
                    _index: "thread",
                    _type: "thread",
                    _id: threadId
                }
            })
            updateObjList.push({
                doc: {
                    latestReply: latestReply,
                    replyCount: replyCount,
                    threadContributors: threadPost[0]._source.threadContributors
                }
            })
        }
    }
    else {
        updateObjList.push({
            update: {
                _index: "thread",
                _type: "thread",
                _id: paramsBody.id
            }
        })
        updateObjList.push({
            doc: {
                status: "Active"
            }
        })
    }

    if (existingFlaggedObjects.length != 0) {
        for (flagObject of existingFlaggedObjects) {
            let updateIndexObj = {
                update: {
                    _index: "userpostactivity",
                    _type: "userpostactivity",
                    _id: flagObject.id
                }
            }
            let updateDataObj = {
                doc: {
                    flag: {
                        dtActivity: reactivationDate,
                        isFlagged: false,
                        commentType: flagObject.flag.commentType,
                        comment: flagObject.flag.comment
                    }
                }
            }

            updateObjList.push(updateIndexObj)
            updateObjList.push(updateDataObj)
        }
    }

    if (cassFlag > 0) {
        cassandraCounterUpdate.push({
            query: 'update bodhi.post_count set flag = flag - ? where root_org = ? and org = ? and post_id = ?;',
            params: [cassFlag, paramsBody.rootOrg, paramsBody.org, paramsBody.id]
        })
    }

    cassandraUpdate.push({
        query: 'update bodhi.post set status = ? where root_org = ? and org = ? and post_id = ?;',
        params: ["Active", paramsBody.rootOrg, paramsBody.org, paramsBody.id]
    })

    return [updateObjList, cassandraUpdate, cassandraCounterUpdate]

}
module.exports = {
    getCassndraQuery,
    getPostQueryBody,
    getThreadQueryBody,
    getCassndraMetaQuery,
    getUpdateQueryBody,
    getActivityQueryBody,
    getUpdateActivityQuery,
    getExistingActivityBody,
    getUpdateAcceptedAnswer,
    getHashTagQuery,
    getCassandraHashTagQuery,
    getAdminDeleteQuery,
    getSearchIndexQuerybody,
    getAdminReativateQuery
}