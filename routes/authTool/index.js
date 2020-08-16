/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
var express = require('express');
var controller = require('./authTool.controller');

var router = express.Router();

function validate(req, res, next) {
    if (req.body.hasOwnProperty('id') && (req.body.id == null || req.body.id == "")) {
        res.status(400).send("bad request , id cannot be empty")
    }
    else if (req.body.hasOwnProperty('rootOrg') == false || req.body.rootOrg == null || req.body.rootOrg == "") {
        res.status(400).send("bad request , rootOrg cannot be empty")
    }
    else if (req.body.hasOwnProperty('org') == false || req.body.org == null || req.body.org == "") {
        res.status(400).send("bad request, org cannot be empty")
    }
    else {
        next();
    }
}

function validateTags(req) {
    if (req.body.hasOwnProperty('tags')) {
        let flag = false
        req.body.tags.forEach(element => {
            if (element.hasOwnProperty('id') == false || element.id == null) {
                flag = true
            }
            else if (element.hasOwnProperty('name') == false || element.name == null) {
                flag = true
            }
        })
        return flag
    }
    if (req.body.hasOwnProperty('addTags')) {
        let flag = false
        req.body.addTags.forEach(element => {
            if (element.hasOwnProperty('id') == false || element.id == null) {
                flag = true
            }
            if (element.hasOwnProperty('name') == false || element.name == null) {
                flag = true
            }
        });
        return flag
    }
    if (req.body.hasOwnProperty('removeTags')) {
        let flag = false
        req.body.removeTags.forEach(element => {
            if (element.hasOwnProperty('id') == false || element.id == null) {
                flag = true
            }
            if (element.hasOwnProperty('name') == false || element.name == null) {
                flag = true
            }
        });
        return flag
    }
    else {
        return false
    }
}

router.post('/publishpost', validate, function (req, res) {
    // res.set({"Cache-Control": "no-store","Pragma":"no-cache"})
    if (req.body.hasOwnProperty('postKind') == false || req.body.postKind == null || req.body.postKind == "") {
        res.status(400).send("bad request, postKind cannot be empty")
    }
    else if (req.body.hasOwnProperty('postContent') == false || req.body.postContent == null) {
        res.status(400).send('bad request, postContent cannot be empty')
    }
    else if (req.body.hasOwnProperty('postContent') && req.body.postContent.hasOwnProperty('title') && req.body.postContent.title == null) {
        res.status(400).send('bad request, post content title cannot be empty')
    }
    else if (req.body.hasOwnProperty('postContent') && req.body.postContent.hasOwnProperty('body') && req.body.postContent.body == null) {
        res.status(400).send('bad request, post content body cannot be empty')
    }
    else if (req.body.hasOwnProperty('postCreator') == false || req.body.postCreator == null) {
        res.status(400).send("bad request , postCreator cannot be empty")
    }
    else if (validateTags(req)) {
        res.status(400).send("bad request, tag object invalid")
    }
    else if (req.body.hasOwnProperty('parentId') == false && req.body.hasOwnProperty('postContent') && (req.body.postContent.hasOwnProperty('title') == false || (req.body.postContent.hasOwnProperty('title') && req.body.postContent.title == ""))) {
        // Question : body optional
        // parent post if null : Title mandatory
        // body optional for question/poll/survey
        res.status(400).send('bad request, post content title cannot be empty for a main post')
    }
    // else if(req.body.hasOwnProperty('id')== true && req.body.hasOwnProperty('source')==true){
    //     res.status(400).send("bad request , source is not editable")
    // }
    else if(req.body.hasOwnProperty('hashTags')== true && (req.body.hashTags.length<=0 || req.body.hashTags == null)){
        res.status(400).send("bad request , hashTag cannot be empty")
    }
    else if(req.body.hasOwnProperty('thumbnail') == true && (req.body.thumbnail =="" || req.body.thumbnail ==null)){
        res.status(400).send("bad request ,  thumbnail cannot be empty")
    }
    else {
        controller.publishPost(req.body)
            .then(data => res.send(data))
            .catch(err => res.status(err.statuscode).send(err))
        // .then(data => res.status(data.status).send())
        // .then(data => res.status(data.status).send(data))
        // .catch(err => res.status(err.statuscode).send(err))
    }
})

router.post('/draftpost', validate, function (req, res) {
    if (req.body.hasOwnProperty('postKind') == false || req.body.postKind == null || req.body.postKind == "") {
        res.status(400).send("bad request, postKind cannot be empty")
    }
    else if (req.body.hasOwnProperty('postContent') == false || req.body.postContent == null) {
        res.status(400).send('bad request, postContent cannot be empty')
    }
    else if (req.body.hasOwnProperty('postContent') && req.body.postContent.hasOwnProperty('title') && req.body.postContent.title == null) {
        res.status(400).send('bad request, post content title cannot be empty')
    }
    else if (req.body.hasOwnProperty('postContent') && req.body.postContent.hasOwnProperty('body') && req.body.postContent.body == null) {
        res.status(400).send('bad request, post content body cannot be empty')
    }
    else if (req.body.hasOwnProperty('postCreator') == false || req.body.postCreator == null) {
        res.status(400).send("bad request , postCreator cannot be empty")
    }
    else if (validateTags(req)) {
        res.status(400).send("bad request, tag object invalid")
    }
    // else if(req.body.hasOwnProperty('id')== true && req.body.hasOwnProperty('source')==true){
    //     res.status(400).send("bad request , source is not editable")
    // }
    else if(req.body.hasOwnProperty('hashTags')== true && (req.body.hashTags.length<=0 || req.body.hashTags == null)){
        res.status(400).send("bad request , hashTag cannot be empty")
    }
    else if(req.body.hasOwnProperty('thumbnail') == true && (req.body.thumbnail =="" || req.body.thumbnail ==null)){
        res.status(400).send("bad request ,  thumbnail cannot be empty")
    }
    else {
        controller.draftPost(req.body)
            .then(data => res.status(data.status).send())
            .catch(err => res.status(err.statuscode).send(err))
    }
})

// router.put('/editmeta', validate, function (req, res) {
//     if (req.body.hasOwnProperty('postKind') == false || req.body.postKind == null) {
//         res.status(400).send("bad request, postKind cannot be empty")
//     }
//     else if (req.body.hasOwnProperty('meta') == false || req.body.meta == null || Object.keys(req.body.meta).length == 0) {
//         res.status(400).send("bad request, meta cannot be empty")
//     }
//     else if (req.body.hasOwnProperty('meta') && req.body.meta.hasOwnProperty('title') == true && req.body.meta.title == null) {
//         res.status(400).send("bad request, post content title cannot be empty")
//     }
//     else if (req.body.hasOwnProperty('meta') && req.body.meta.hasOwnProperty('abstract') == true && req.body.meta.abstract == null) {
//         res.status(400).send("bad request, post content abstract cannot be empty")
//     }
//     else if (req.body.hasOwnProperty('meta') && req.body.meta.hasOwnProperty('body') == true && req.body.meta.body == null) {
//         res.status(400).send("bad request, post content body cannot be empty")
//     }
//     else {
//         controller.editMeta(req.body)
//             .then(data => res.status(data.status).send())
//             .catch(err => res.status(err.statuscode).send(err))
//     }
// })

// router.put('/edittags', validate, function (req, res) {
//     if (validateTags(req)) {
//         res.status(400).send("bad request, tag object invalid")
//     }
//     else {
//         controller.editTags(req.body)
//             // .then(data => res.status(data.status).send())
//             .then(data => res.status(data.status).send())
//             .catch(err => res.status(err.statuscode).send(err))
//     }
// })

router.put('/editmeta', validate, function (req, res) {
    if (req.body.hasOwnProperty('postKind') == false || req.body.postKind == null || req.body.postKind == "") {
        res.status(400).send("bad request, postKind cannot be empty")
    }
    else if (req.body.hasOwnProperty('meta') == true && (req.body.meta == null || Object.keys(req.body.meta).length == 0)){
        res.status(400).send("bad request, meta cannot be empty")
    }
    else if (req.body.hasOwnProperty('meta') && req.body.meta.hasOwnProperty('title') == true && req.body.meta.title == null) {
        res.status(400).send("bad request, post content title cannot be empty")
    }
    else if (req.body.hasOwnProperty('meta') && req.body.meta.hasOwnProperty('abstract') == true && req.body.meta.abstract == null) {
        res.status(400).send("bad request, post content abstract cannot be empty")
    }
    else if (req.body.hasOwnProperty('meta') && req.body.meta.hasOwnProperty('body') == true && req.body.meta.body == null) {
        res.status(400).send("bad request, post content body cannot be empty")
    }
    else if (req.body.hasOwnProperty('meta') && req.body.meta.hasOwnProperty('thumbnail') == true && req.body.meta.thumbnail == null) {
        res.status(400).send("bad request ,thumbnail cannot be empty")
    }
    else if (validateTags(req)) {
        res.status(400).send("bad request, tag object invalid")
    }
    else if (req.body.hasOwnProperty('meta') == false && req.body.hasOwnProperty('addTags') == false && req.body.hasOwnProperty('removeTags') == false && req.body.hasOwnProperty('hashTags') == false) {
        res.status(400).send("bad request")
    }
    else {
        controller.edit(req.body)
            .then(data => res.status(data.status).send())
            .catch(err => res.status(err.statuscode).send(err))
    }

})

router.delete('/deletepost', function (req, res) {
    //user id check to be done
    if (req.body.hasOwnProperty('id') == false || req.body.id == null || req.body.id == "") {
        res.status(400).send("bad request , id cannot be empty")
    }
    else if (req.body.hasOwnProperty('rootOrg') == false || req.body.rootOrg == null || req.body.rootOrg == "") {
        res.status(400).send("bad request , rootOrg cannot be empty")
    }
    else if (req.body.hasOwnProperty('org') == false || req.body.org == null || req.body.org == "") {
        res.status(400).send("bad request, org cannot be empty")
    }
    else {
        controller.deletePost(req.body,false)
            .then(data => res.status(data.status).send())
            .catch(err => res.status(err.statuscode).send(err))
    }

})
module.exports = router;