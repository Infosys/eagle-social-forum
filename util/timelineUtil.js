/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
const request = require('request');
var cassDb = require("../CassandraUtil/cassandra")
const esDb = require("../ESUtil/elasticSearch")
const PropertiesReader = require('properties-reader')
const properties = PropertiesReader('./app.properties')

const aggsDisplayName = {
    "tagsAggs": "Tags",
    "hasAcceptedAnswerAggs" : "Accepted Answer",
    "hashTagsAggs" : "HashTags",
    "accessPathsAggs" : "Groups",
    "dtLastModifiedAggs" : "Published Date",
    "threadContributorsAggs" : "Contributors"
}

//to get the aggregation data
function aggegrationsData(aggsMetaData){
    aggsDataList = []
    try {
        //console.log(aggsMetaData)
        for(var obj in aggsMetaData){
            if(obj in aggsDisplayName){
                aggsFilter = {
                    "displayName" : "",
                    "type" : "",
                    "content" :[]
                }

                aggsFilter.type = obj.replace("Aggs","")
                aggsFilter.displayName = aggsDisplayName[obj]
                aggsData = aggsMetaData[obj][obj]
                
                //to handle nested aggs case
                if(aggsData.hasOwnProperty(obj)){
                    aggsData = aggsData[obj]
                    
                }
                aggsData = aggsData["buckets"]

                let contentList = []
                if(aggsData.length > 0){
                    for(let value of aggsData){
                        //console.log(value)
                        aggsContent={}

                        //for hasAcceptedAnswerAggs the key from aggs data is 0 or 1 , inorder to show the value as true
                            // or false we use key_as_string field in this case
                        if(obj == "hasAcceptedAnswerAggs"){
                            if(value['key_as_string'] == "false"){
                                aggsContent.displayName = "No"
                            }
                            else{
                                aggsContent.displayName = "Yes"
                            }
                            aggsContent.type = value['key_as_string']
                        }
                        else if(obj == "dtLastModifiedAggs"){
                            aggsContent.displayName = value['key']
                            aggsContent.from = value['from_as_string']
                            aggsContent.to = value['to_as_string']
                        }
                        else{
                            aggsContent.displayName = value['key']
                            aggsContent.type = value['key']
                        }
                        aggsContent.count = value['doc_count']
                        contentList.push(aggsContent)
                    }
                }
                if(contentList.length >0){
                  aggsFilter.content = contentList
                  aggsDataList.push(aggsFilter)
                }
                
            }
        }
        return aggsDataList
    } catch (error) {
        log.error('error', error)
      throw error.toString()
    }
}

 function getAccessPaths(userId,rootOrg){
    accessPaths=[]
    //console.log("getAccessPaths")
    try {
      const sbext_ip = process.env.sbext_ip || properties.get('sbext_ip')
      const sbext_port = process.env.sbext_port || properties.get('sbext_port')
      //get the access path of the user
      // envt variable to be set to take the url according to the envt
      let url = "http://"+sbext_ip+":"+sbext_port+"/accesscontrol/user/"+userId+"?rootOrg="+rootOrg
      //console.log(url)
      return new Promise((resolve, reject) => {
        request.get({
          url
        }, function (err, body) {
            if (err) {
                //console.log(err)
                reject(err)
            }
            else {
                let result = JSON.parse(body.body)
                //console.log(result)
                resolve(result.result.combinedAccessPaths)
            }
        })
    })
    } 
    catch (error) {
      //console.log(JSON.stringify(error))
      if(error.statuscode){
        throw error
      }
      else{
        log.error("Unexpected error : ",error)
        throw { statuscode: 500, err: "Internal server error", message: "Unable to fetch access path of user" }
      }
    }
  }

  //to fetch the post activity and user to post activity
async function fetchActivity(request) {
    try {
      let userActivityData = {
        "like": false,
        "upVote": false,
        "downVote": false,
        "flag": false
      }
  
      let activityCount = {
        "like": 0,
        "upVote": 0,
        "downVote": 0,
        "flag": 0
      }
      let result = new Map();
      let params = {}
      let successIds = []
      //get data from cassandra post_count table
      post_count_query = 'SELECT  post_id,up_vote,down_vote,flag,like,dislike from bodhi.post_count where root_org=? and org=? and post_id in ?'
      let post_count = await cassDb.executeQuery(post_count_query, [request['rootOrg'], request['org'], request['postId']])
      if (post_count.rowLength > 0) {
        params.sizeValue = request['postId'].length
        params.rootOrgValue = request['rootOrg']
        params.orgValue = request['org']
        params.mustuserIdstatus =true
        params.userIdValue = [request['userId']]
        params.mustpostidstatus = true
        params.postidValue = request['postId']
        let userActivity = await esDb.templateSearch(params, "userpostactivityType", "userpostactivityIndex", "userpostactivityTemplate")
        post_count.rows.forEach(element => {
          //user activity data
          userActivityData = {
            "like": false,
            "upVote": false,
            "downVote": false,
            "flag": false
          }
  
          activityCount = {
            "like": Number(element['like'])-Number(element['dislike']),
            "upVote": Number(element['up_vote']),
            "downVote": Number(element['down_vote']),
            "flag": Number(element['flag'])
          }
  
          if (userActivity['hits']['total'] > 0) {
            let userData = userActivity['hits']['hits']
            for (let userDataObj of userData) {
              source = userDataObj['_source']
              if (source['postid'] == element['post_id'].toString() && source['userId'] == request['userId']) {
                if ('like' in source) {
                  userActivityData['like'] = source['like']['isLiked']
                }
                if ('upVote' in source) {
                  userActivityData['upVote'] = source['upVote']['isupVoted']
                }
                if ('downVote' in source) {
                  userActivityData['downVote'] = source['downVote']['isdownVoted']
                }
                if ('flag' in source) {
                  userActivityData['flag'] = source['flag']['isFlagged']
                }
              }
            }
          }
          successIds.push(element['post_id'].toString())
          let postData = {
            "activityData": activityCount,
            "userActivity": userActivityData
          }
          result.set(element['post_id'].toString(),postData)
          //result.push(postData)
  
  
        });
        //console.log(successIds)
        if (successIds.length != request['postId'].length) {
          userActivityData = {
            "like": false,
            "upVote": false,
            "downVote": false,
            "flag": false
          }
  
          activityCount = {
            "like": 0,
            "upVote": 0,
            "downVote": 0,
            "flag": 0
          }
  
          request['postId'].forEach(element => {
            if (!(successIds.includes(element))) {
              postData = {
                "activityData": activityCount,
                "userActivity": userActivityData
              }
              result.set(element,postData)
              //result.push(postData)
            }
          });
        }
      }
      else{
        userActivityData = {
          "like": false,
          "upVote": false,
          "downVote": false,
          "flag": false
        }
  
        activityCount = {
          "like": 0,
          "upVote": 0,
          "downVote": 0,
          "flag": 0
        }
  
        request['postId'].forEach(element => {
          postData = {
            "activityData": activityCount,
            "userActivity": userActivityData
          }
          result.set(element,postData)
        });
      }
      //console.log(result1)
      return result
    } catch (error) {
      log.error('error', error)
      throw error.toString()
    }
  }
  

module.exports = {
    aggegrationsData,
    getAccessPaths,
    fetchActivity
}
