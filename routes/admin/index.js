/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
var express = require('express');
var controller = require('./admin.controller');

var router = express.Router();

router.delete('/deletepost', function (req, res) {
    if (req.body.hasOwnProperty('id') == false || req.body.id == null || req.body.id == "") {
        res.status(400).send("bad request , id cannot be empty")
    }
    else if (req.body.hasOwnProperty('rootOrg') == false || req.body.rootOrg == null || req.body.rootOrg == "") {
        res.status(400).send("bad request , rootOrg cannot be empty")
    }
    else if (req.body.hasOwnProperty('org') == false || req.body.org == null || req.body.org == "") {
        res.status(400).send("bad request, org cannot be empty")
    }
    else if (req.body.hasOwnProperty('adminId') == false || req.body.adminId == null || req.body.adminId == "") {
        res.status(400).send("bad request, adminId cannot be empty")
    }
    else if (req.body.hasOwnProperty('userComment') == false || (req.body.hasOwnProperty('userComment') && req.body.userComment.hasOwnProperty('comment')==false)|| 
    (req.body.hasOwnProperty('userComment') && req.body.userComment.hasOwnProperty('comment') && (req.body.userComment.comment == null || req.body.userComment.comment == ""))) {
        res.status(400).send("bad request, userComment cannot be empty")
    }
    else{
    controller.deletePost(req.body)
        .then(data => res.status(data.status).send())
        .catch(err => res.status(err.statuscode).send(err))
    }
})

router.post('/reactivatepost', function (req, res) {
    if (req.body.hasOwnProperty('id') == false || req.body.id == null || req.body.id == "") {
        res.status(400).send("bad request , id cannot be empty")
    }
    else if (req.body.hasOwnProperty('rootOrg') == false || req.body.rootOrg == null || req.body.rootOrg == "") {
        res.status(400).send("bad request , rootOrg cannot be empty")
    }
    else if (req.body.hasOwnProperty('org') == false || req.body.org == null || req.body.org == "") {
        res.status(400).send("bad request, org cannot be empty")
    }
    else if (req.body.hasOwnProperty('adminId') == false || req.body.adminId == null || req.body.adminId == "") {
        res.status(400).send("bad request, adminId cannot be empty")
    }
    else if (req.body.hasOwnProperty('reactivateReason') == false ||(req.body.hasOwnProperty('reactivateReason') && (req.body.reactivateReason == null || req.body.reactivateReason == ""))) {
        res.status(400).send("bad request, reactivateReason cannot be empty")
    }
    else{
    controller.reactivatePost(req.body)
        .then(data => res.status(data.status).send())
        .catch(err => res.status(err.statuscode).send(err))
    }
})

router.post('/timeline', function (req, res) {
    //TODO: Basic checks
    if (req.body.hasOwnProperty('rootOrg') == false || req.body.rootOrg == null || req.body.rootOrg == "") {
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if (req.body.hasOwnProperty('org') == false || req.body.org == null || req.body.org == "") {
        res.status(400).send("bad request, org cannot be empty")
    }
    else if (req.body.hasOwnProperty('userId') == false || req.body.userId == null || req.body.userId == "") {
        res.status(400).send("bad request, userId cannot be empty")
    }
    else if (req.body.hasOwnProperty('type') == false || req.body.type == null || req.body.type == "") {
        res.status(400).send("bad request, type cannot be empty")
    }
    else if (req.body.hasOwnProperty('sessionId') == false || req.body.sessionId == null || req.body.sessionId == "") {
        res.status(400).send("bad request, sessionId cannot be empty")
    }
    else{
        if (req.body.hasOwnProperty('pgNo') == false || req.body.pgNo == "") {
            pgNo = 0
        }
        else {
            pgNo = Number(req.body.pgNo)
        }
        if (req.body.hasOwnProperty('pgSize') == false || req.body.pgSize == null) {
            pgSize = 10
        }
        else {
            pgSize = Number(req.body.pgSize)
        }
        controller.adminTimeline(req.body,pgNo,pgSize)
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send(err))
    }
})

router.post('/viewConversation',function (req,res) {
    if (req.body.hasOwnProperty('rootOrg') == false) {
        res.status(400).send("wrong request body")
    }
    else if (req.body.hasOwnProperty('org') == false) {
        res.status(400).send("wrong request body")
    }
    else if (req.body.hasOwnProperty('postId') == false) {
        res.status(400).send("wrong request body")
    }
    else if (req.body.hasOwnProperty('sessionId') == false) {
        res.status(400).send("wrong request body")
    }
    else if (req.body.hasOwnProperty('postKind') == false) {
        res.status(400).send("wrong request body")
    }
    else if (req.body.hasOwnProperty('userId') == false) {
        res.status(400).send("wrong request body")
    }
    else if (req.body.rootOrg == "" || req.body.rootOrg == null) {
        res.status(400).send('rootOrg is  empty')
    }
    else if (req.body.org == "" || req.body.org == null) {
        res.status(400).send('org is  empty')
    }
    else if(req.body.postId == "" || req.body.postId == null){
        res.status(400).send('Post id is empty')
    }
    else if(req.body.sessionId == "" || req.body.sessionId == null){
        res.status(400).send('sessionId is empty')
    }
    else if (req.body.userId == "" || req.body.userId == null) {
        res.status(400).send('userId is  empty')
    }
    else if(validator.isUUID(req.body.postId)==false){
        res.status(400).send('Post id is not a valid uuid')
    }
    else if(validator.isUUID(req.body.userId)==false){
        res.status(400).send('user id not a valid uuid')
    } 
    else{
        if (req.body.hasOwnProperty('pgNo') == false || req.body.pgNo == "") {
            pgNo = 0
        }
        else{
            pgNo = Number(req.body.pgNo)
        }
        if (req.body.hasOwnProperty('pgSize') == false || req.body.pgSize == null) {
            pgSize = 10
        }
        else{
            pgSize = Number(req.body.pgSize)
        }
        if (req.body.hasOwnProperty('sortOrder') == false || req.body.sortOrder == ""){
            sortOrder = 'latest-asc'
        }
        else{
            sortOrder = req.body.sortOrder
        }
        //console.log(req.body.postId)
        controller.viewConversation(req.body,pgNo,pgSize,sortOrder)
            .then(data => {
                res.send(data)})
                .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

module.exports = router;