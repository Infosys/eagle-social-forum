/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
var express = require('express');
var controller = require('./search.controller');
var router = express.Router();

router.post('/searchv1',function(req,res){
    if(req.body.hasOwnProperty('rootOrg') == false || req.body.rootOrg == null || req.body.rootOrg == ""){
        res.status(400).send("bad request, rootOrg cannot be empty")
    }
    else if(req.body.hasOwnProperty('org') == false || req.body.org == null || req.body.org == ""){
        res.status(400).send("bad request, org cannot be empty")
    }
    else if(req.body.hasOwnProperty('userId') == false || req.body.userId == null || req.body.userId == ""){
        res.status(400).send("bad request, userId cannot be empty")
    }
    else{
        if (req.body.hasOwnProperty('pageNo') == false || req.body.pageNo == "") {
            pageNo = 0
        }
        else{
            pageNo = Number(req.body.pageNo)
        }
        if (req.body.hasOwnProperty('pageSize') == false || req.body.pageSize == null) {
            pageSize = 10
        }
        else{
            pageSize = Number(req.body.pageSize)
        }
        controller.searchv1(req.body,pageNo,pageSize)
        .then(data => res.send(data))
        .catch(err => res.status(err.statuscode).send(err))
    }
});


module.exports = router;