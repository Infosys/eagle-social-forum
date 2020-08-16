/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
/**
 * GET     /getfollowers/:id
 * GET     /getfollowing/:id
 * POST    /:sourceid/follow/:targetid
 * PUT     /:sourceid/unfollow/:targetid
 */

const uuid = require('cassandra-driver').types.TimeUuid
const cassdb = require('../../CassandraUtil/cassandra')
const log = require('../../Logger/log');
var validator = require('validator');
const esDb = require('../../ESUtil/elasticSearch');
const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')
const api_request = require('request');

//common function to execute all the other cassandra queries
function runQuery(queryText, param) {
    log.info("executing query" + JSON.stringify({ query: queryText, params: param }))
    return cassdb.executeQuery(queryText, param);
}

function runPaginatedQuery(queryText, param, fetchSize, pageState = null) {
    log.info("executing query" + JSON.stringify({ query: queryText, params: param, fetchSize: fetchSize }))
    return cassdb.executePaginatedQuery(queryText, param, fetchSize, pageState);
}

/*function to follow a particular function 
eg. A wants to follow B
followsourceid : A's UUID
followtargetid : B's UUID
*/
async function follow(request) {
    try {
        //const insert_query = 'INSERT INTO bodhi.follow_master(root_org,org,sourceid,targetid,status,type,follow_date,id) VALUES(?,?,?,?,?,?,?,?) '
        follow_date = new Date()
        //let result = await runQuery(insert_query, [request.rootOrg,request.org,request.followsourceid, request.followtargetid, 'follow',request.type,follow_date,uuid.now()])
        const upsert_query = 'UPDATE bodhi.follow_master SET status = ?, follow_date = ?, id = ? WHERE root_org = ? and org = ? AND sourceid = ? AND targetid = ? AND type=?'
        let result = await runQuery(upsert_query, ['follow',follow_date,uuid.now(),request.rootOrg,request.org,request.followsourceid, request.followtargetid,request.type])
        return result
    } catch (error) {
        log.error('error', error)
        throw error.toString()
    }

}

/*function to follow a particular function 
eg. A wants to  ow B
followsourceid : A's UUID
followtargetid : B's UUID
*/
async function unfollow(request) {
    try {
        lastmodifieddate = new Date()
        const update_query = 'UPDATE bodhi.follow_master SET status = ?, last_modified_date = ? WHERE root_org = ? and org = ? AND sourceid = ? AND targetid = ? AND type=?'
        let result = await runQuery(update_query, ['unfollow',lastmodifieddate,request.rootOrg,request.org,request.followsourceid, request.followtargetid,request.type])
        return result
    } catch (error) {
        log.error('error', error)
        throw error.toString()
    }

}

//function to get all the following of a user
async function following(request) {
    try { 
        let following_query = ""
        let params = []
        let followData = {}
        let contentTypeList = ["Learning Path","Course","Collection","Resource","Knowledge Artifact","Knowledge Board","Channel","Learning Journeys","Playlist"]
        if(request.hasOwnProperty('type')==false || request.type.length==0 || request.type == null){
            following_query = 'SELECT type,targetid FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ?'
            params = [request.rootOrg,request.org,request.userid, 'follow']
        }
        else{
            following_query = 'SELECT type,targetid FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ? and type in ?'
            params= [request.rootOrg,request.org,request.userid, 'follow',request.type]
        }
        let result = await runQuery(following_query, params)
        let following_ids_list = []
        if (result.rowLength > 0) {
            result.rows.forEach(element => {
                //console.log("element : ",element)
                value = []
                if(element["type"] == "tags"){
                    if("tags" in followData){
                        value = followData["tags"]
                    }
                    value.push(element['targetid'].toString())
                    followData["tags"] = value
                }
                else if(element["type"] == "person"){
                    if("person" in followData){
                        value = followData["person"]
                    }
                    value.push(element['targetid'].toString())
                    followData["person"] = value
                }
                else if(contentTypeList.includes(element["type"])) {
                    //console.log(element["type"])
                    if("content" in followData){
                        value = followData["content"]
                    }
                    value.push(element['targetid'].toString())
                    followData["content"] = value
                }
                
            });
            //console.log("followData :",followData)
            let list1= {}
            let list2 = {}
            let list3 = {}
            if("person" in followData){
                list1 =await getPersonData(request.rootOrg,request.org,followData["person"])
                //console.log(list1)
                if(Object.keys(list1).length>0){
                    following_ids_list.push(list1)
                }
            }
            if("tags" in followData){
                list2 =await getTagsData(request.rootOrg,request.org,followData["tags"])
                //console.log(list2)
                if(Object.keys(list2).length>0){
                    following_ids_list.push(list2)
                }
            }
            if("content" in followData){
                list3 =await getData(request.rootOrg,request.org,followData["content"])
                //console.log("list3 : ",list3)
                if(Object.keys(list3).length>0){
                    following_ids_list.push(list3)
                }
                //console.log("following_ids_list  :",following_ids_list)
            }
            //console.log(following_ids_list)
            // if(list1.length>0){
            //     following_ids_list =following_ids_list.concat(list1)
            // }
            // if(list2.length>0){
            //     following_ids_list = following_ids_list.concat(list2)
            // }
            // if(list3.length>0){
            //     following_ids_list = following_ids_list.concat(list3)
            // }
            //following_ids_list = list1.concat(list2,list3)
            
        }
        return following_ids_list
        // else {
        //     //throw { statuscode: 404, message: "no followings found for the user", err: 'internal server error' }
        //     fo
        // }

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

async function followingv2(request) {
    try { 
        let following_query = ""
        let count_query = ""
        let params = []
        let followData = {}
        let pageState = null
        if(request.hasOwnProperty('followingPageState') == true) {
            pageState = request.followingPageState
        }
        // let tagsCount = 0
        // let personCount = 0
        // let contentCount = 0
        let contentTypeList = ["Learning Path","Course","Collection","Resource","Knowledge Artifact","Knowledge Board","Channel","Learning Journeys","Playlist"]
        if(request.hasOwnProperty('type')==false || request.type.length==0 || request.type == null){
            following_query = 'SELECT type,targetid FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ?'
            count_query = 'SELECT type, count(*) FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ? GROUP BY type'
            params = [request.rootOrg,request.org,request.id, 'follow']
        }
        else{
            following_query = 'SELECT type,targetid FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ? and type in ?'
            count_query = 'SELECT type, count(*) FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ? and type in ? GROUP BY type'
            params= [request.rootOrg,request.org,request.id, 'follow',request.type]
        }
        let result
        if(request.hasOwnProperty('fetchSize') && request.fetchSize != "" && request.fetchSize != null){
            result = await runPaginatedQuery(following_query, params, request.fetchSize, pageState)
        }else {
            result = await runQuery(following_query, params)
        }
        countResult = await runQuery(count_query, params)
        let countDict = {}
        countResult.rows.forEach(element => {
            countDict[element["type"]] = parseInt(element["count"])
        })
        // console.log(countDict)
        let following_ids_list = []
        if (result.rowLength > 0) {
            result.rows.forEach(element => {
                //console.log("element : ",element)
                value = []
                if(element["type"] == "tags"){
                    // tagsCount += 1
                    if("tags" in followData){
                        value = followData["tags"]
                    }
                    value.push(element['targetid'].toString())
                    followData["tags"] = value
                }
                else if(element["type"] == "person"){
                    // personCount += 1
                    if("person" in followData){
                        value = followData["person"]
                    }
                    value.push(element['targetid'].toString())
                    followData["person"] = value
                }
                else if(contentTypeList.includes(element["type"])) {
                    // contentCount += 1
                    //console.log(element["type"])
                    if("content" in followData){
                        value = followData["content"]
                    }
                    value.push(element['targetid'].toString())
                    followData["content"] = value
                }
                
            });
            //console.log("followData :",followData)
            let list1= {}
            let list2 = {}
            let list3 = {}
            if("person" in followData){
                list1 =await getPersonData(request.rootOrg,request.org,followData["person"])
                list1.count = countDict["person"]
                delete countDict['person'] 
                //console.log(list1)
                if(Object.keys(list1).length>0){
                    following_ids_list.push(list1)
                }
            }
            if("tags" in followData){
                list2 =await getTagsData(request.rootOrg,request.org,followData["tags"])
                list2.count = countDict["tags"]
                delete countDict['tags']
                //console.log(list2)
                if(Object.keys(list2).length>0){
                    following_ids_list.push(list2)
                }
            }
            if("content" in followData){
                list3 =await getData(request.rootOrg,request.org,followData["content"])
                list3.count = countDict
                //console.log("list3 : ",list3)
                if(Object.keys(list3).length>0){
                    following_ids_list.push(list3)
                }
                //console.log("following_ids_list  :",following_ids_list)
            }
            if(result.pageState != null){ 
                following_ids_list.push({
                    'pageState': result.pageState
                })
            }
            // following_ids_list.push(list4)
            //console.log(following_ids_list)
            // if(list1.length>0){
            //     following_ids_list =following_ids_list.concat(list1)
            // }
            // if(list2.length>0){
            //     following_ids_list = following_ids_list.concat(list2)
            // }
            // if(list3.length>0){
            //     following_ids_list = following_ids_list.concat(list3)
            // }
            //following_ids_list = list1.concat(list2,list3)
            
        }
        return following_ids_list
        // else {
        //     //throw { statuscode: 404, message: "no followings found for the user", err: 'internal server error' }
        //     fo
        // }

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

async function followingv3(request, isInIntranet, isStandAlone) {
    try {
        let following_query = ""
        let count_query = ""
        let params = []
        let followData = {}
        let pageState = null

        if(request.hasOwnProperty('followingPageState') == true) {
            pageState = request.followingPageState
        }

        let contentTypeList = ["Learning Path","Course","Collection","Resource","Knowledge Artifact","Knowledge Board","Channel","Learning Journeys","Playlist"]
        if(request.hasOwnProperty('type')==false || request.type.length==0 || request.type == null){
            following_query = 'SELECT type,targetid FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ?'
            count_query = 'SELECT type, count(*) FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ? GROUP BY type'
            params = [request.rootOrg,request.org,request.id, 'follow']
        }
        else{
            following_query = 'SELECT type,targetid FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ? and type in ?'
            count_query = 'SELECT type, count(*) FROM bodhi.follow_by_sourceid WHERE root_org= ? and org=? and sourceid= ? and status = ? and type in ? GROUP BY type'
            params= [request.rootOrg,request.org,request.id, 'follow',request.type]
        }

        let following_ids = {}
        let result
        let personData = {}
        let tagsData = {}
        let contentData = {}
        do{
            if(request.hasOwnProperty('fetchSize') && request.fetchSize != "" && request.fetchSize != null){
                result = await runPaginatedQuery(following_query, params, request.fetchSize, pageState)
            }else {
                result = await runQuery(following_query, params)
            }

            countResult = await runQuery(count_query, params)
            let countDict = {}
            countResult.rows.forEach(element => {
                countDict[element["type"]] = parseInt(element["count"])
            })

            following_ids = {}
            if (result.rowLength > 0) {
                result.rows.forEach(element => {
                    //console.log("element : ",element)
                    value = []
                    if(element["type"] == "tags"){
                        if("tags" in followData){
                            value = followData["tags"]
                        }
                        value.push(element['targetid'].toString())
                        followData["tags"] = value
                    }
                    else if(element["type"] == "person"){
                        if("person" in followData){
                            value = followData["person"]
                        }
                        value.push(element['targetid'].toString())
                        followData["person"] = value
                    }
                    else if(contentTypeList.includes(element["type"])) {
                        if("content" in followData){
                            value = followData["content"]
                        }
                        value.push(element['targetid'].toString())
                        followData["content"] = value
                    }
                    
                });
                personData = []
                tagsData = []
                contentData = {}
                if("person" in followData){
                    personData = (await getPersonData(request.rootOrg,request.org,followData["person"]))["person"]
                    // console.log(personData)
                    if(personData.length>0){
                        if(following_ids.hasOwnProperty('person') == false) {
                            following_ids['person'] = {}
                        }
                        if(following_ids['person'].hasOwnProperty('count') == false){
                            following_ids['person'].count = countDict["person"]
                        }
                        if(following_ids['person'].hasOwnProperty('data') == false){
                            following_ids['person']['data'] = personData    
                        }else{
                            following_ids['person']['data'] += personData
                        }
                    }
                }
                if("tags" in followData){
                    tagsData = (await getTagsData(request.rootOrg,request.org,followData["tags"]))["tags"]
                    // tagsData.count = countDict["tags"]
                    //console.log(list2)
                    if(tagsData.length>0){
                        if(following_ids.hasOwnProperty('tags') == false) {
                            following_ids['tags'] = {}
                        }
                        if(following_ids['tags'].hasOwnProperty('count') == false){
                            following_ids['tags'].count = countDict["tags"]
                        }
                        if(following_ids['tags'].hasOwnProperty('data') == false){
                            following_ids['tags']['data'] = tagsData    
                        }else{
                            following_ids['tags']['data'] += tagsData
                        }
                    }
                }
                if("content" in followData){
                    contentData = await getData(request.rootOrg,request.org,followData["content"], 
                                                isInIntranet, isStandAlone)
                    //console.log("list3 : ",list3)
                    if(Object.keys(contentData).length>0){
                        for(contentType in contentData) {
                            if(following_ids.hasOwnProperty(contentType) == false){
                                following_ids[contentType] = {'data': contentData[contentType]}
                                following_ids[contentType]['count'] = countDict[contentType]
                            }else{
                                following_ids[contentType]['data'] += contentData[contentType]
                            }
                        }
                    }
                }
                if(result.pageState != null){ 
                    following_ids['pageState'] = result.pageState
                }
                pageState = result.pageState
            }
        }while(request.hasOwnProperty('type')==true && request.type.length == 1 
                && request.hasOwnProperty('fetchSize') && following_ids.hasOwnProperty(request.type[0])
                && request.fetchSize > following_ids[request.type[0]]['data'].length)
        return following_ids
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

// async function getPersonData(rootOrg,org,ids){
//     try {
//         let userList = []
//         let findMapping_query = "SELECT id,firstname,lastname FROM sunbird.user where id in ? "
//         let mapped_result = await runQuery(findMapping_query,[ids])
//         if (mapped_result.rowLength > 0) {
//             mapped_result.rows.forEach(element=>{
//                 //console.log(element)
//                 userobj = {
//                     'id' : element['id'].toString(),
//                     "value" : element['firstname'].toString() + ' ' + element['lastname'].toString(),
//                     "type":"person"
//                 }
//                 userList.push(userobj)
//                 //userList[element['id'].toString()] = element['firstname'].toString() + ' ' + element['lastname'].toString()              
//               });
//             //return mapped_result.rows
//         }
//         else {
//             log.warn("no user id to email id mapping found in cassandra")
//             throw { statuscode: 500, message: "no user id to email mapping found", err: 'internal server error' }
//         }
//         return userList
//     } catch (error) {
//         if (error.statuscode) {
//             throw error
//         }
//         else {
//             log.error("unexpected error" + error)
//             throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
//         }
//     }
// }

async function getPersonData(rootOrg,org,ids){
    try {
        let userList = []
        let resultObj = {}
        let findUserDataSourceQuery = 'select value from bodhi.app_config where root_org=? and key=?;        '
        let params = [rootOrg,'user_data_source']
        let findUserDataSourceResult = await runQuery(findUserDataSourceQuery,params)
        // console.log(findUserDataSourceResult.rowLength)
        if(findUserDataSourceResult.rowLength>0){
            userDataSource = findUserDataSourceResult.rows[0].value.toString()
            // console.log(userDataSource)
            if(userDataSource=='SU'){
                //console.log("in if")
                let findMapping_query = "SELECT id,firstname,lastname FROM sunbird.user where id in ? "
                let mapped_result = await runQuery(findMapping_query,[ids])
                // console.log(mapped_result.rowLength)
                if (mapped_result.rowLength > 0) {
                    mapped_result.rows.forEach(element=>{
                        //console.log(element)
                        let user_id = element['id'].toString()
                        let first_name = element['firstname']!=null ? element['firstname'].toString() : ""
                        let last_name = element['lastname']!=null ? element['lastname'].toString() : ""
                        userobj = {
                            "identifier" : user_id,
                            "name" : (first_name + ' ' + last_name).toString().trim()
                        }
                        userList.push(userobj)
                        ids.splice(ids.indexOf(user_id), 1)
                        //userList[element['id'].toString()] = element['firstname'].toString() + ' ' + element['lastname'].toString()              
                    });    
                    //return mapped_result.rows
                }
                else {
                    log.warn("no user id to name mapping found in cassandra")
                }
                if (ids.length > 0){
                    for (id of ids) {
                        if(validator.isUUID(id)){
                            userObj = {
                                "identifier": id,
                                "name": "Anonymous"
                            }
                            userList.push(userObj)
                        }else {
                            throw { statuscode: 500, message: "Invalid uuid", err: 'internal server error' }
                        }
                    }
                }
                resultObj['person'] = userList
                return resultObj
            }
            else if(userDataSource == 'PID'){
                //api call
                const usermeta_ip = process.env.usermeta_ip || properties.get('usermeta_ip')
                const usermeta_port = process.env.usermeta_port || properties.get('usermeta_port')
                let userMetaUrl = "http://"+usermeta_ip+":"+usermeta_port+"/user/multi-fetch/wid"
                // console.log(ids)
                var options = { 
                    method: 'POST',
                    url: userMetaUrl,
                    headers: 
                    { 
                        'Content-Type': 'application/json' 
                    },
                    body: 
                    { 
                        source_fields: [ 'wid', 'first_name', 'last_name' ],
                        conditions: { root_org: rootOrg },
                        values: ids
                    },
                    json: true 
                };

                return new Promise((resolve,reject)=>{
                    api_request(options, function (error, response, body) {
                        if (error) reject(error);
                        // console.log(body)
                        if(body.length>0){
                            body.forEach(element => {
                                let user_id = element["wid"]
                                let first_name = element['first_name']!=null ? element['first_name'].toString() : ""
                                let last_name = element['last_name']!=null ? element['last_name'].toString() : ""
                        
                                userobj ={
                                    "identifier" :user_id,
                                    "name" : (first_name + ' ' + last_name).toString().trim()
                                }
                                userList.push(userobj)
                                ids.splice(ids.indexOf(user_id), 1)
                            });
                        }
                        else {
                            log.warn("no user id to name mapping found from API")
                        }
                        if (ids.length > 0){
                            for (id of ids) {
                                if(validator.isUUID(id)){
                                    userObj = {
                                        "identifier": id,
                                        "name": "Anonymous"
                                    }
                                    userList.push(userObj)
                                }else {
                                    throw { statuscode: 500, message: "Invalid uuid", err: 'internal server error' }
                                }
                            }
                        }
                        resultObj["person"] = userList
                        resolve(resultObj)
                        //console.log(body);
                    });
                })  
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

async function getTagsData(rootOrg,org,ids){
    try {
        //console.log(ids)
        let esType= "tagsIndex"
        let esIndex = "tagsType"
        let resultObj = {}
        let query = {
            "size":ids.length,
            "_source": ["id","name"], 
            "query": {
              "bool": {
                "must": [
                  {
                    "terms": {
                      "id": ids
                    }
                  }
                ]
              }
            }
          }
          let dataResult = await esDb.getData(query,esType,esIndex)
          let dataList = []
          //console.log(query)
          if(dataResult.hits.total>0){
              //console.log("in if")
            let sourceData = dataResult.hits.hits
            for(let data of sourceData){
                dataObj = {
                    "identifier" : data._source.id,
                    "name" : data._source.name
                }
                dataList.push(dataObj)
                //dataList[data._source.id] = data._source.name
            }
          }
          resultObj["tags"] = dataList
          return resultObj
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

async function getData(rootOrg,org,ids,isInIntranet=null, isStandAlone=null){
    try {
        //console.log("ids : ",ids)
        let resultObj = {}
        let esType= "contentSearchType"
        let esIndex = "contentSearchIndex"
        let query = {
            "size":ids.length,
            "_source": ["identifier", "name", "contentType", "appIcon", "artifactUrl", "complexityLevel", "description", "duration", "learningMode", "mimeType", "resourceType", "status", "expiryData", "dimension", "category", "categoryType", "viewCount", "averageRating", "isInIntranet", "isStandAlone"], 
            "query": {  
              "bool": {
                "must": [
                  {
                    "term": {
                      "rootOrg": {
                        "value": rootOrg
                      }
                    }
                  },
                  {
                    "nested": {
                      "path": "org",
                      "query": {
                        "term": {
                          "org.org": {
                            "value": org
                          }
                        }
                      }
                    }
                  },
                  {
                    "terms": {
                      "identifier": ids
                    }
                  },
                  {
                    "terms": {
                      "status": ["Live","Expired","Deleted","Marked For Deletion"]
                    }
                  }
                ]
              }
            }
        }

        if(isInIntranet != null) {
            query['query']['bool']['must'].push({
                "term":{
                    "isInIntranet": {
                        "value": isInIntranet
                    }
                }
            })
        }

        if(isStandAlone != null) {
            query['query']['bool']['must'].push({
                "term":{
                    "isStandAlone": {
                        "value": isStandAlone
                    }
                }
            })
        }

        // console.log(query['query']['bool']['must'])

        let dataResult = await esDb.getData(query,esType,esIndex)
        
        if(dataResult.hits.total>0){
            let sourceData = dataResult.hits.hits
            //console.log("sourceData : ",sourceData)
            for(let data of sourceData){
                let value = []
                //console.log("data : ",data)
                //dataList[data._source.identifier] = data._source.name
                if(data._source.contentType in resultObj){
                    value = resultObj[data._source.contentType]
                }
                // console.log(data._source)
                let dataObj = {}
                dataObj.identifier = "identifier" in data._source ? data._source.identifier : ""
                dataObj.name = "name" in data._source ? data._source.name : ""
                dataObj.appIcon = "appIcon" in data._source ? data._source.appIcon : ""
                dataObj.artifactUrl = "artifactUrl" in data._source ? data._source.artifactUrl : ""
                dataObj.complexityLevel = "complexityLevel" in data._source ? data._source.complexityLevel : ""
                dataObj.contentType = "contentType" in data._source ? data._source.contentType : ""
                dataObj.description = "description" in data._source ? data._source.description : ""
                dataObj.duration = "duration" in data._source ? data._source.duration : 0
                dataObj.learningMode = "learningMode" in data._source ? data._source.learningMode : ""
                dataObj.mimeType = "mimeType" in data._source ? data._source.mimeType : ""
                dataObj.resourceType = "resourceType" in data._source ? data._source.resourceType : ""
                dataObj.status = "status" in data._source ? data._source.status : ""
                dataObj.expiryDate = "expiryDate" in data._source ? data._source.expiryDate : ""
                dataObj.dimension = "dimension" in data._source ? data._source.dimension : ""
                dataObj.category = "category" in data._source ? data._source.category : ""
                dataObj.categoryType = "categoryType" in data._source ? data._source.categoryType : ""
                dataObj.isInIntranet = "isInIntranet" in data._source ? data._source.isInIntranet : ""
                dataObj.isStandAlone = "isStandAlone" in data._source ? data._source.isStandAlone : ""
                dataObj.viewCount = 0
                if(data._source.hasOwnProperty("viewCount") && data._source.viewCount.hasOwnProperty(rootOrg)){
                    dataObj.viewCount = data._source.viewCount[rootOrg]
                }
                dataObj.averageRating = 0
                if(data._source.hasOwnProperty("averageRating") && data._source.averageRating.hasOwnProperty(rootOrg)){
                    dataObj.averageRating = data._source.averageRating[rootOrg]
                }
                //console.log("dataObj : ",dataObj)
                value.push(dataObj)
                //console.log("value : ",value)
                resultObj[data._source.contentType] = value 
                //console.log("resultObj : ",resultObj)
            }
        }
        //console.log("finalresult : ",resultObj)
        return resultObj
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

//function to get all the followers of a user
async function followers(request) {
    try {
        let followers_query = ""
        let contentTypeList = ["Learning Path","Course","Collection","Resource","Knowledge Artifact","Knowledge Board","Channel","Learning Journeys","Playlist"]
        let params = []
        let followData = {}
        if(request.hasOwnProperty('type')==false || request.type.length==0 || request.type == null){
            followers_query='SELECT type,sourceid FROM bodhi.follow_by_targetid WHERE root_org= ? and org=? and targetid= ? and status = ?'
            params = [request.rootOrg,request.org,request.userid, 'follow']
        }
        else{
            followers_query='SELECT type,sourceid FROM bodhi.follow_by_targetid WHERE root_org= ? and org=? and targetid= ? and status = ? and type = ?'
            params= [request.rootOrg,request.org,request.userid, 'follow',request.type]
        }
        
        let result = await runQuery(followers_query, params)
        let followers_ids_list = []
        //console.log(result)
        if (result.rowLength > 0) {
            result.rows.forEach(element => {
                value = []
                //console.log(element)
                if("person" in followData){
                    value = followData["person"]
                }
                value.push(element['sourceid'].toString())
                followData["person"] = value
                
            });
            let list1= {}
            let list2 = {}
            let list3 = {}
            //console.log(followData)
            if("person" in followData){
                list1 = await getPersonData(request.rootOrg,request.org,followData["person"])
                //console.log(list1)
                if(Object.keys(list1).length>0){
                    followers_ids_list.push(list1)
                }
                //console.log(list1)
            }
            // if(list1.length>0){
            //     followers_ids_list = followers_ids_list.concat(list1)
            // }
            // if(list2.length>0){
            //     followers_ids_list = followers_ids_list.concat(list2)
            // }
            // if(list3.length>0){
            //     followers_ids_list = followers_ids_list.concat(list3)
            // }
            //followers_ids_list = list1.concat(list2,list3)
            //return followers_ids_list
        }
        // else {
        //     throw { statuscode: 404, message: "no followings found for the user", err: 'internal server error' }
        //     //return { status: 204 }
        // }
        return followers_ids_list

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

//function to get followers of a user using pagination
async function followersv2(request) {
    try {
        // let followers_query = ""
        // let contentTypeList = ["Learning Path","Course","Collection","Resource","Knowledge Artifact","Knowledge Board","Channel","Learning Journeys","Playlist"]
        // let params = []
        let followData = {}
        // let totalCount = 0
        let pageState = null
        if(request.hasOwnProperty('followersPageState') == true) {
            pageState = request.followersPageState
        }
        // if(request.hasOwnProperty('type')==false || request.type.length==0 || request.type == null){
        let followers_query='SELECT type,sourceid FROM bodhi.follow_by_targetid WHERE root_org= ? and org=? and targetid= ? and status = ?'
        let count_query = 'SELECT type, count(*) FROM bodhi.follow_by_targetid WHERE root_org= ? and org=? and targetid= ? and status = ?'
        let params = [request.rootOrg,request.org,request.id, 'follow']
        // else{
        //     followers_query='SELECT type,sourceid FROM bodhi.follow_by_targetid WHERE root_org= ? and org=? and targetid= ? and status = ? and type = ?'
        //     count_query = 'SELECT count(*) FROM bodhi.follow_by_targetid WHERE root_org= ? and org=? and targetid= ? and status = ? and type = ?'
        //     params= [request.rootOrg,request.org,request.userid, 'follow',request.type]
        // }
        let result
        if(request.hasOwnProperty('fetchSize') && request.fetchSize != "" && request.fetchSize != null){
            result = await runPaginatedQuery(followers_query, params, request.fetchSize, pageState)
        }else {
            result = await runQuery(followers_query, params)
        }
        let countResult = await runQuery(count_query, params)
        let totalCount = parseInt(countResult.rows[0]['count'])
        let followers_ids_list = []
        // console.log(result)
        if (result.rowLength > 0) {
            result.rows.forEach(element => {
                value = []
                //console.log(element)
                if("person" in followData){
                    value = followData["person"]
                }
                value.push(element['sourceid'].toString())
                followData["person"] = value
            });
            let list1= {}
            //console.log(followData)
            if("person" in followData){
                list1 =await getPersonData(request.rootOrg,request.org,followData["person"])
                //console.log(list1)
                list1['count'] = totalCount
                if(Object.keys(list1).length>0){
                    followers_ids_list.push(list1)
                }
                //console.log(list1)
            }
            if(result.pageState != null){ 
                followers_ids_list.push({
                    'pageState': result.pageState
                })
            }
        // if(list1.length>0){
        //     followers_ids_list = followers_ids_list.concat(list1)
        // }
        // if(list2.length>0){
        //     followers_ids_list = followers_ids_list.concat(list2)
        // }
        // if(list3.length>0){
        //     followers_ids_list = followers_ids_list.concat(list3)
        // }
        //followers_ids_list = list1.concat(list2,list3)
        //return followers_ids_list
        }
    // else {
    //     throw { statuscode: 404, message: "no followings found for the user", err: 'internal server error' }
    //     //return { status: 204 }
    // }
    return followers_ids_list
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

//function to get followers of a user using pagination with a simplified return json
async function followersv3(request) {
    try {
        let followData = {}
        let pageState = null
        if(request.hasOwnProperty('followersPageState') == true) {
            pageState = request.followersPageState
        }

        let followers_query='SELECT type,sourceid FROM bodhi.follow_by_targetid WHERE root_org= ? and org=? and targetid= ? and status = ?'
        let count_query = 'SELECT type, count(*) FROM bodhi.follow_by_targetid WHERE root_org= ? and org=? and targetid= ? and status = ?'
        let params = [request.rootOrg,request.org,request.id, 'follow']

        let result = ""
        if(request.hasOwnProperty('fetchSize') && request.fetchSize != "" && request.fetchSize != null){
            result = await runPaginatedQuery(followers_query, params, request.fetchSize, pageState)
        }else {
            result = await runQuery(followers_query, params)
        }

        let countResult = await runQuery(count_query, params)
        let totalCount = parseInt(countResult.rows[0]['count'])
        let followers_ids = {}

        if (result.rowLength > 0) {
            result.rows.forEach(element => {
                value = []
                //console.log(element)
                if("person" in followData){
                    value = followData["person"]
                }
                value.push(element['sourceid'].toString())
                followData["person"] = value
            });

            let personList= {}
            //console.log(followData)
            if("person" in followData){
                personList['data'] = (await getPersonData(request.rootOrg,request.org,followData["person"]))["person"]
                //console.log(list1)
                personList['count'] = totalCount
                if(Object.keys(personList).length>0){
                    followers_ids['person'] = personList
                }
                //console.log(list1)
            }
            if(result.pageState != null){ 
                followers_ids["pageState"] = result.pageState
            }
        }

        return followers_ids
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

// written to get followers using rootOrg and userid,without org
async function getfollowers(request) {
    try {
        let followers_query = ""
        let params = []
        let followData = {}
        if(request.hasOwnProperty('type')==false || request.type.length==0 || request.type == null){
            followers_query='SELECT type,sourceid FROM bodhi.follow_by_targetid WHERE root_org= ? and targetid= ? and status = ? ALLOW FILTERING'
            params = [request.rootOrg,request.userid, 'follow']
        }
        else{
            followers_query='SELECT type,sourceid FROM bodhi.follow_by_targetid WHERE root_org= ? and targetid= ? and status = ? and type = ? ALLOW FILTERING'
            params= [request.rootOrg,request.userid, 'follow',request.type]
        }
        let result = await runQuery(followers_query, params)
        let followers_ids_list = []
        //console.log(result)
        if (result.rowLength > 0) {
            result.rows.forEach(element => {
                value = []
                //console.log(element)
                if("person" in followData){
                    value = followData["person"]
                }
                value.push(element['sourceid'].toString())
                followData["person"] = value
                
            });
            let list1= {}
            let list2 = {}
            let list3 = {}
            // console.log(followData)
            if("person" in followData){
                list1 =await getPersonData(request.rootOrg,null,followData["person"])
                //console.log(list1)
                if(Object.keys(list1).length>0){
                    followers_ids_list.push(list1)
                }
                //console.log(list1)
            }
        }
        return followers_ids_list
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

//function to get both the followers and the following of a user
async function getall(request) {
    try {
        let result = await Promise.all([
            followers(request)
                .then(result => result)
                .catch(_err => []),
            following(request)
                .then(result => result)
                .catch(_err => [])
        ]);
        let followers_result = result[0];
        let following_result = result[1];

        allResult = { followers: followers_result, following: following_result }

        return allResult
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

async function getallv2(request) {
    try {
        let result = await Promise.all([
            followersv2(request)
                .then(result => result)
                .catch(_err => []),
            followingv2(request)
                .then(result => result)
                .catch(_err => [])
        ]);
        let followers_result = result[0];
        let following_result = result[1];

        allResult = { followers: followers_result, following: following_result }

        return allResult
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

async function getallv3(request) {
    try {
        let result = await Promise.all([
            followersv3(request)
                .then(result => result)
                .catch(_err => []),
            followingv3(request)
                .then(result => result)
                .catch(_err => [])
        ]);
        let followers_result = result[0];
        let following_result = result[1];

        allResult = { followers: followers_result, following: following_result }

        return allResult
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

//fucntion to get the user profile containing (email,id,firstname) of a user based on either the UUId or emailid
async function getuserprofile(rootOrg,id) {
    // return {
    //     "id": "a79abc9b-3675-448a-8e65-245f75af1d93",
    //     "name": "user 2"
    // }
    try { 
        let userDataSource = ''
        let findUserDataSourceQuery = 'select value from bodhi.app_config where root_org=? and key=?;        '
        let params = [rootOrg,'user_data_source']
        let findUserDataSourceResult = await runQuery(findUserDataSourceQuery,params)
        if(findUserDataSourceResult.rowLength>0){
            userDataSource = findUserDataSourceResult.rows[0].value.toString()
            if(userDataSource=='SU'){
                findMapping_query = "SELECT id,firstname,lastname FROM sunbird.user where id = ? "
                mapped_result = await runQuery(findMapping_query,[id])
                if (mapped_result.rowLength > 0) {
                    log.verbose('user data found :' + mapped_result.rows)
                    let user_id = mapped_result.rows[0].id
                    let first_name = mapped_result.rows[0].firstname!=null ? mapped_result.rows[0].firstname.toString() : ""
                    let last_name = mapped_result.rows[0].lastname!=null ? mapped_result.rows[0].lastname.toString() : ""
                    let result = {
                        "id" : user_id,
                        "name" : (first_name + ' ' + last_name).toString().trim()
                    }
                    //console.log(result)
                    return result
                }
                else {
                    throw { statuscode: 500, message: "User not found", err: 'internal server error' }
                }
            }
            else if (userDataSource == 'PID'){
                //api call
                const usermeta_ip = process.env.usermeta_ip || properties.get('usermeta_ip')
                const usermeta_port = process.env.usermeta_port || properties.get('usermeta_port')
                let userMetaUrl = "http://"+usermeta_ip+":"+usermeta_port+"/user"
                var options = { 
                    method: 'POST',
                    url: userMetaUrl,
                    headers: 
                    { 
                        'Content-Type': 'application/json' 
                    },
                    body: 
                    { 
                        source_fields: [ 'wid', 'first_name', 'last_name' ],
                        conditions: 
                        { 
                            root_org: rootOrg,
                            wid: id 
                        } 
                    },
                    json: true 
                };

                return new Promise((resolve,reject) => {
                    api_request(options, function (error, response, body) {
                        if (error) throw new reject(error);
                        if(body.length>0){
                            let user_id = body[0].wid
                            let first_name = body[0].first_name!=null ? body[0].first_name.toString() : ""
                            let last_name = body[0].last_name!=null ? body[0].last_name.toString() : ""
                            let result = {
                                "id":user_id,
                                "name" : (first_name + ' ' + last_name).toString().trim()
                            }
                            resolve(result)
                        }
                        else {
                            throw { statuscode: 500, message: "User not found", err: 'internal server error' }
                        }
                    });
                })

                
            }
        }
        else{
            throw { statuscode: 500, message: "no data found", err: 'internal server error' }
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

module.exports = { followers, followersv2, followersv3, following, followingv2, followingv3, 
                    follow, unfollow, getall, getallv2, getallv3, getuserprofile, getPersonData, 
                    getfollowers}
