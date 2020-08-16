/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
var express = require('express');
var router = express.Router();
var catalog = require('./catalog.controller');

router.post('/fetch', function(req, res) {
    if(req.body.hasOwnProperty('rootOrg') == true && ((req.body.rootOrg == "" ||req.body.rootOrg == null))){
      res.status(400).send("RootOrg is empty")
    }
    else{
      catalog.fetchCatalog(req.body)
        .then(data=>res.send(data))
        .catch(err=>res.status(err.statuscode).send({error :err.err,message:err.message}))
    }
  });
  
  router.post('/getCatalog', function(req, res, next) {
    if(req.body.hasOwnProperty('rootOrg') == true && ((req.body.rootOrg == "" ||req.body.rootOrg == null))){
      res.status(400).send("RootOrg is empty")
    }
    else{
      catalog.getCatalog(req.body)
        .then(data=>res.send(data))
        .catch(err=>res.status(err.statuscode).send({error :err.err,message:err.message}))
    }
  });


  module.exports = router;
