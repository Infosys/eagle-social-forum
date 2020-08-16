/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
var express = require('express');
var controller = require('./userActivity.controller');

var router = express.Router();

router.post('/create', function (req, res) {
    if (req.body.hasOwnProperty('rootOrg') == false || req.body.rootOrg == null || req.body.rootOrg == "") {
        res.status(400).send("bad request , rootOrg cannot be empty")
    }
    else if (req.body.hasOwnProperty('org') == false || req.body.org == null || req.body.org == "") {
        res.status(400).send("bad request, org cannot be empty")
    }
    else if (req.body.hasOwnProperty('activityType') == false || req.body.activityType == null || req.body.activityType == "") {
        res.status(400).send("bad request, activityType cannot be empty")
    }
    else if (req.body.hasOwnProperty('id') == false || req.body.id == null || req.body.id == "") {
        res.status(400).send("bad request, id cannot be empty")
    }
    else if (req.body.hasOwnProperty('userId') == false || req.body.userId == null || req.body.userId == "") {
        res.status(400).send("bad request, userId cannot be empty")
    }
    else {
        controller.createActivity(req.body)
            .then(data => res.status(data.status).send())
            .catch(err => res.status(err.statuscode).send(err))
    }
})

router.post('/acceptAnswer', function (req, res) {
    if (req.body.hasOwnProperty('rootOrg') == false || req.body.rootOrg == null || req.body.rootOrg == "") {
        res.status(400).send("bad request , rootOrg cannot be empty")
    }
    else if (req.body.hasOwnProperty('org') == false || req.body.org == null || req.body.org == "") {
        res.status(400).send("bad request, org cannot be empty")
    }
    else if (req.body.hasOwnProperty('acceptedAnswer') == false || req.body.acceptedAnswer == null || req.body.acceptedAnswer == "") {
        res.status(400).send("bad request, acceptedAnswer cannot be empty")
    }
    else if (req.body.hasOwnProperty('userId') == false || req.body.userId == null || req.body.userId == "") {
        res.status(400).send("bad request, userId cannot be empty")
    }
    else {
        controller.acceptAnswer(req.body)
            .then(data => res.status(data.status).send())
            .catch(err => res.status(err.statuscode).send(err))
    }
})

module.exports = router;