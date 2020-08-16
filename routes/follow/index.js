/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
var express = require('express');
var controller = require('./follow.controller');
var validator = require('validator');

var router = express.Router();

router.post('/follow', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('followsourceid')==false ||req.body.followsourceid =='' || req.body.followsourceid == null){
        res.status(400).send("bad request, followsourceid cannot be empty")
    }
    else if(req.body.hasOwnProperty('followtargetid')==false ||req.body.followtargetid =='' || req.body.followtargetid == null){
        res.status(400).send("bad request, followtargetid cannot be empty")
    }
    else if(req.body.hasOwnProperty('type')==false ||req.body.type =='' || req.body.type == null){
        res.status(400).send("bad request, type cannot be empty")
    }
    else{
        controller.follow(req.body)
        .then(data => res.status(204).send("Follow Successfull"))
        .catch(err => res.send(err))
    }
    
})

router.post('/unfollow', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('followsourceid')==false ||req.body.followsourceid =='' || req.body.followsourceid == null){
        res.status(400).send("bad request, followsourceid cannot be empty")
    }
    else if(req.body.hasOwnProperty('followtargetid')==false ||req.body.followtargetid =='' || req.body.followtargetid == null){
        res.status(400).send("bad request, followtargetid cannot be empty")
    }
    else if(req.body.hasOwnProperty('type')==false ||req.body.type =='' || req.body.type == null){
        res.status(400).send("bad request, type cannot be empty")
    }
    else{
        controller.unfollow(req.body)
        .then(data => res.status(204).send("Unfollow Successfull"))
        .catch(err => res.send(err))
    }
})

router.post('/getall', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('userid')==false ||req.body.userid =='' || req.body.userid == null){
        res.status(400).send("bad request, userid cannot be empty")
    }
    else {
        controller.getall(req.body)
            .then(data => res.send(data))
            .catch(err => res.send(err))
    }
})

router.post('/getfollowing', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('userid')==false ||req.body.userid =='' || req.body.userid == null){
        res.status(400).send("bad request, userid cannot be empty")
    }
    else{
        controller.following(req.body)
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

router.post('/getfollowers', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('userid')==false ||req.body.userid =='' || req.body.userid == null){
        res.status(400).send("bad request, userid cannot be empty")
    }
    else{
        controller.followers(req.body)
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

router.post('/getfollowersrootOrg', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('userid')==false ||req.body.userid =='' || req.body.userid == null){
        res.status(400).send("bad request, userid cannot be empty")
    }
    else{
        controller.getfollowers(req.body)
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

router.post('/getallv2', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('id')==false ||req.body.id =='' || req.body.id == null){
        res.status(400).send("bad request, id cannot be empty")
    }
    else if(req.body.hasOwnProperty('fetchSize') && (req.body.hasOwnProperty('type') == false || req.body.type.length !== 1)) {
        res.status(400).send("bad request, if paginated result required then provide a single type in array")
    }
    else {
        controller.getallv2(req.body)
            .then(data => res.send(data))
            .catch(err => res.send(err))
    }
})

router.post('/getallv3', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('id')==false ||req.body.id =='' || req.body.id == null){
        res.status(400).send("bad request, id cannot be empty")
    }
    else if(req.body.hasOwnProperty('fetchSize') && (req.body.hasOwnProperty('type') == false || req.body.type.length !== 1)) {
        res.status(400).send("bad request, if paginated result required then provide a single type in array")
    }
    else {
        controller.getallv3(req.body)
            .then(data => res.send(data))
            .catch(err => res.send(err))
    }
})

router.post('/getfollowingv2', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('id')==false ||req.body.id =='' || req.body.id == null){
        res.status(400).send("bad request, id cannot be empty")
    }
    else if(req.body.hasOwnProperty('fetchSize') && (req.body.hasOwnProperty('type') == false || req.body.type.length !== 1)) {
        res.status(400).send("bad request, if paginated result required then provide a single type in array")
    }
    else{
        controller.followingv2(req.body)
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

router.post('/getfollowingv3', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('id')==false ||req.body.id =='' || req.body.id == null){
        res.status(400).send("bad request, id cannot be empty")
    }
    else if(req.body.hasOwnProperty('fetchSize') && (req.body.hasOwnProperty('type') == false || req.body.type.length !== 1)) {
        res.status(400).send("bad request, if paginated result required then provide a single type in array")
    }
    else if(req.query.hasOwnProperty('isInIntranet') && req.query['isInIntranet'] != 'true' && req.query['isInIntranet'] != 'false'){
        res.status(400).send("bad request, isInIntranet has to either be true or false")
    }
    else if(req.query.hasOwnProperty('isStandAlone') && req.query['isStandAlone'] != 'true' && req.query['isStandAlone'] != 'false'){
        res.status(400).send("bad request, isStandAlone has to either be true or false")
    }
    else{
        controller.followingv3(req.body, req.query['isInIntranet'], req.query['isStandAlone'])
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

router.post('/getfollowersv2', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('id')==false ||req.body.id =='' || req.body.id == null){
        res.status(400).send("bad request, id cannot be empty")
    }
    else{
        controller.followersv2(req.body)
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

router.post('/getfollowersv3', function (req, res) {
    if(req.body.hasOwnProperty('rootOrg')==false ||req.body.rootOrg =='' || req.body.rootOrg == null){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org')==false ||req.body.org =='' || req.body.org == null){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('id')==false ||req.body.id =='' || req.body.id == null){
        res.status(400).send("bad request, id cannot be empty")
    }
    else{
        controller.followersv3(req.body)
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

router.get('/getuserprofile/:rootOrg/:id',function(req,res){
    if(req.params.rootOrg == "" || req.params.rootOrg == null){
        res.status(400).send("Rootorg is empty")
    }
    else if (req.params.id == "" || req.params.id == null){
        res.status(400).send('id empty')
    }
    else{
        controller.getuserprofile(req.params.rootOrg,req.params.id)
        .then(data => res.send(data))
        .catch(err => res.status(err.statuscode).send({error:err.err,message:err.message}))
    }
})

module.exports = router;