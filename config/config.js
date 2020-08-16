/*               "Copyright 2020 Infosys Ltd.
               Use of this source code is governed by GPL v3 license that can be found in the LICENSE file or at https://opensource.org/licenses/GPL-3.0
               This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License version 3" */
var env = process.env;

function getEnvConfig(envVariable) {
    // console.log(process.env);
    // console.log(env)
    if(envVariable=="" || envVariable==null){
        return null;
    }
    else{
        // console.log(env[envVariable.toString()]);
        return env[envVariable.toString()];
    }
}

module.exports = {getEnvConfig}