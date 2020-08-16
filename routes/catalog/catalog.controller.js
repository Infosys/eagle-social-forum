/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
var neoUtil = require('../../NeoUtil/neo4jUtil')
var config = require('../../NeoUtil/config')
let catalogPathList = []

//fetching catalog : get tree structure of catalog
async function fetchCatalog(request){
    try {
        //console.log("test")
        let dimensions = []
        if(request.hasOwnProperty('org')==true && request.org.length>0){
            dimensions = Array.from(request.org)
        }
        if(request.hasOwnProperty('isUserPref')==false || (request.hasOwnProperty('isUserPref')==true && request.isUserPref==false)){
            dimensions.push(config.commonCatalogName)
        }
        //console.log("dimen in fetch :",dimensions)
        //let dimensions = ["Common","Healthineer"]
        let idToNodeMapping = {}
        let relationToLexIdMap = {}
        let hierarchyMap = {}
        let visitedMap = {}

        lang ='en'
        relationList = []
        nodeDict= {}
        let records = []
        //const session = neoUtil.connectToNeo();
        //let query = 'MATCH(start:WingspanDimension)-[rel:IS_PARENT_OF*1..10]->(end:TaxonomyNode) WHERE start.name IN $dimension  RETURN start,rel,end'
        let query = 'MATCH(r:RootOrg)-[:IS_PARENT_OF]->(start:WingspanDimension)-[rel:IS_PARENT_OF*1..10]->(end:TaxonomyNode) WHERE start.name IN $dimension and r.name=$rootOrg RETURN start,rel,end'
        params = {dimension : dimensions,rootOrg:request.rootOrg}
        let fetchData = await neoUtil.runQuery(query,params)
        records = fetchData.records

        records.forEach(element => {
            let path = ""
            let startNode = element._fields[0]
            let relations = element._fields[1]
            let endNode = element._fields[2]
            let dimensionName = startNode.properties.name

            //path = path + dimensionName +">"

            let sourceId = startNode.identity.low
            let destinationId = endNode.identity.low

            
            let startNodeMeta = {}
            //let endNodeMeta = {}
            if(dimensions.includes(dimensionName)){
                startNodeMeta = {
                    "child":[],
                    "path" : dimensionName
                }
            }
            else{
                startNodeMeta = {
                    "identifier": startNode.properties.identifier,
                    "name": startNode.properties[lang] ? startNode.properties[lang] :startNode.properties.name,
                    "isFromPref": startNode.properties[lang] ? true : false,
                    "nodeId" : startNode.properties.nodeId,
                    "path" : "",
                    "level":startNode.properties.level.low,
                    "child":[]
                }
            }
            


            let endNodeMeta = {
                "identifier": endNode.properties.identifier,
                "name": endNode.properties[lang] ? endNode.properties[lang] :endNode.properties.name,
                "isFromPref": endNode.properties[lang] ? true : false,
                "nodeId":endNode.properties.nodeId,
                "path" : "",
                "level":endNode.properties.level.low,
                "child":[]
            }

            idToNodeMapping[sourceId] = startNodeMeta
            idToNodeMapping[destinationId] = endNodeMeta
            let immediateParentId = sourceId
            relations.forEach(relationObject => {

                if(!(relationObject.identity.low in relationToLexIdMap)){
                    relationToLexIdMap[relationObject.identity.low] = destinationId
                    let parentMap = {}

                    if(!(immediateParentId in visitedMap)){
                        parentMap = idToNodeMapping[immediateParentId]
                        //path = path + parentMap.path +">"
                        hierarchyMap[dimensionName] =parentMap
                        visitedMap[immediateParentId] = parentMap
                    }
                    else {
                        parentMap = visitedMap[immediateParentId];
                        //path = path + parentMap.path +">"
                    }
                    let children = parentMap.child
                    //console.log("children** :",children)
                    //console.log("parentMap",parentMap)
                    let child = {}         
                      
                    child = idToNodeMapping[destinationId]
                    path = parentMap.path +">" +idToNodeMapping[destinationId].name
                    child.path = path
                    //console.log(path)
                    visitedMap[destinationId] = child
                    //console.log("child :",child)
                    children.push(child)
                    //console.log("children :",children)
                    parentMap.child = children
                    
                }
                else{
                    immediateParentId = relationToLexIdMap[relationObject.identity.low]
                    //console.log(immediateParentId)
                }
            });
        });
        //console.log(hierarchyMap)
        return hierarchyMap

        
    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
    finally{
        neoUtil.closeNeo()
    }
}



//get flat list of the catalog
async function getCatalog(request){
    try {
        //console.log("in catalog")
        data = await fetchCatalog(request)
        //console.log(data)
        let dimensions = []
        //console.log("dimensions1: ",dimensions)

        if(request.hasOwnProperty('org')==true && request.org.length>0){
            dimensions = Array.from(request.org)
        }
        if(request.hasOwnProperty('isUserPref')==false || (request.hasOwnProperty('isUserPref')==true && request.isUserPref==false)){
            dimensions.push(config.commonCatalogName)
        }
        //dimensions.push(config.commonCatalogName)
        //console.log("dimensions:", dimensions)
        
        //console.log(dimensions)
        dimensions.forEach(element => {
            if(data.hasOwnProperty(element)==true){
                //console.log(element)
                getPath(data[element].child,element+">")
            }
            //console.log(data[element])
        });
        //console.log(catalogPathList)
        return catalogPathList

    } catch (error) {
        if (error.statuscode) {
            throw error
        }
        else {
            console.log(error)
            throw { statuscode: 500, err: "internal server error", message: "unexpected error" }
        }
    }
}


function getPath(children,path){
    path = path || ">"
    children.forEach(childElement => {
        if(childElement.child.length>0){
            catalogPathList.push(path + childElement.name);
            getPath(childElement.child,path + childElement.name + '>')
        }
        else{
            catalogPathList.push(path + childElement.name);
            //console.log(path + childElement.name );
        }
    });
}


module.exports = {
    fetchCatalog,
    getCatalog
}