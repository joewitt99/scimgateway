//=================================================================================
// File:    plugin-testmode.js
//
// Author:  Jarle Elshaug
//
// Purpose: Example code showing how to build an endpoint plugin for the ScimGateway
//          - SCIM endpoint simulation (in-memory, no physical endpoint)
//          - Two predefined users
//          - Supporting explore, create, delete, modify and list users (including groups)
//
// Note:    Assign user to groups are supported, but groups to users are not supported
//
// Supported attributes:
//
// GlobalUser   Template            Scim        Endpoint
// ------------------------------------------------------
// All attributes are supported, note multivalue "type" must be unique
//
//=================================================================================

'use strict';

var pluginName = require('path').basename(__filename, '.js'); // current file prefix (config file must have same prefix)
var ScimGateway = require('./scimgateway');
var scimgateway = new ScimGateway(pluginName);
var testmodeusers = [];
var testmodegroups = [];
testmodeusers = require('./scimdef').TestmodeUsers.Resources
testmodegroups = require('./scimdef').TestmodeGroups.Resources

//
// plugins needs endpoint configuration, but not plugin-testmode
// plugin-testmode use in-memory emulation and therefore do not need any physical endpoint connetion 
// Here are some examples how to read endpoint settings defined in plugin configuration file
//
var pwCrypt = require("../lib/utils");
var configFile = __dirname + '/../config/' + pluginName + '.json';
var config = require(configFile).endpoint;
var endpointHost = config.host;
var endpointPort = config.port;
var endpointUsername = config.username;
var endpointPassword = pwCrypt.getPassword('endpoint.password', configFile);
/*
scimgateway.logger.debug('endpointHost = ' + endpointHost);
scimgateway.logger.debug('endpointPort = ' + endpointPort);
scimgateway.logger.debug('endpointUsername = ' + endpointUsername);
scimgateway.logger.debug('endpointPassword = ' + endpointPassword);
*/

var validScimAttr = []; // empty array - all attrbutes are supported by endpoint
/*
var validScimAttr = [   // array containing scim attributes supported by our plugin code
    "userName",         // userName is mandatory
    "active",           // active is mandatory
    "password",
    "name.givenName",
    "name.middleName",
    "name.familyName",
    "name.formatted",
    "name.honorificPrefix",
    "name.honorificSuffix",
    "displayName",
    "nickName",
    "profileUrl",
    "title",
    "userType",
    "preferredLanguage",
    "locale",
    "timezone",
    "externalId",
    "x509Certificates.0",
    "emails",               //accepts all multivalues for this key

    "emails.[].type=home",  //accepts multivalues if type value equal home (lowercase)
    "emails.[].type=work",  //accepts multivalues if type value equal work (lowercase) 
      
    "phoneNumbers",         //accepts all multivalues for this key
    "ims",                  //accepts all multivalues for this key       
    "photos",               //accepts all multivalues for this key
    "addresses",            //accepts all multivalues for this key
    "entitlements",         //accepts all multivalues for this key
    "roles"                 //accepts all multivalues for this key
];
*/


//==========================================
//             EXPLORE USERS
//
// startIndex = Pagination - The 1-based index of the first result in the current set of search results
// count      = Pagination - Number of elements to be returned in the current set of search results
// callback   = Resources array to be filled with objects containing userName and id
//              (userName and id set to the same value)
//              e.g [{"userName":"bjensen","id":"bjensen"},{"userName":"jsmith","id":"jsmith"}]
//
// If endpoint paging support: totalResults and startIndex should also be set.
// totalResults is the total numbers of elements (users) at endpoint.
// 
//==========================================
scimgateway.on('explore-users', function (startIndex, count, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "explore-user"');
    var ret = { // itemsPerPage will be set by scimgateway
        "totalResults": null,
        "startIndex": null,
        "Resources": []
    };

    if (!startIndex && !count) { // client request without paging
        startIndex = 1;
        count = testmodeusers.length;
    }
    for (var index = startIndex - 1; index < testmodeusers.length && (index + 1 - startIndex) < count; ++index) {
        if (testmodeusers[index].id && testmodeusers[index].userName) {
            var scimUser = { // userName and id is mandatory, note: we set id=userName (because update user sends scim id and not userName) - scimdef have both set to the same value
                "userName": testmodeusers[index].userName,
                "id": testmodeusers[index].id
            };
            ret.Resources.push(scimUser);
        }
    }
    //not needed if client or endpoint do not support paging
    ret.totalResults = testmodeusers.length;
    ret.startIndex = startIndex;

    callback(null, ret); // all explored users
});


//==========================================
//             EXPLORE GROUPS
//
// startIndex = Pagination - The 1-based index of the first result in the current set of search results
// count      = Pagination - Number of elements to be returned in the current set of search results
// callback = Resources array to be filled with objects containing group displayName and id
//            (displayName and id set to the same value)
//            e.g [{"displayName":"Admins","id":"Admins"},{"displayName":"Employees","id":"Employees"}]
//            If endpoint paging support: totalResults, itempsPerPage and startIndex should also be set
//
// If endpoint paging support: totalResults and startIndex should also be set.
// totalResults is the total numbers of elements (groups) at endpoint.
//
// If we do not support groups, callback(null, null) with no additional code lines
//==========================================
scimgateway.on('explore-groups', function (startIndex, count, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "explore-groups"');

    var ret = { // itemsPerPage will be set by scimgateway
        "totalResults": null,
        "startIndex": null,
        "Resources": []
    };

    if (!startIndex && !count) { // client request without paging
        startIndex = 1;
        count = testmodegroups.length;
    }
    for (var index = startIndex - 1; index < testmodegroups.length && (index + 1 - startIndex) < count; ++index) {
        if (testmodegroups[index].id && testmodegroups[index].displayName) {
            var scimGroup = { //displayName and id is mandatory, note: we set id=displayName (scimdef have both set to the same value)
                "displayName": testmodegroups[index].displayName,
                "id": testmodegroups[index].id
            };
            ret.Resources.push(scimGroup);
        }
    }
    //not needed if client or endpoint do not support paging
    ret.totalResults = testmodegroups.length;
    ret.startIndex = startIndex;

    callback(null, ret); // all explored groups
});


//==========================================
//             GET USER
//
// userName   = user id (eg. bjensen)
// attributes = scim attributes to be returned in callback
// callback = user object containing the scim userattributes/values
//      eg: {"id":"bjensen","name":{"formatted":"Ms. Barbara J Jensen III","familyName":"Jensen","givenName":"Barbara"}}
//==========================================
scimgateway.on('get-user', function (userName, attributes, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "get-user" userName=' + userName + ' attributes=' + attributes);
    var retObj = {};
    var userObj = testmodeusers.find(function (element) { // Verify user exist
        return element.userName === userName;
    });
    if (!userObj) {
        var err = new Error('Could not find user with userName ' + userName);
        return callback(err);
    }
    else {
        var arrAttributes = attributes.split(',');
        for (var i = 0; i < arrAttributes.length; i++) {
            var arrSub = arrAttributes[i].split('.');
            if (arrSub.length === 2) { // eg. name.givenName
                if (userObj[arrSub[0]]) {
                    retObj[arrSub[0]] = userObj[arrSub[0]];
                    if (userObj[arrSub[0]][arrSub[1]]) {
                        retObj[arrSub[0]][arrSub[1]] = userObj[arrSub[0]][arrSub[1]]
                    }
                }
            }
            else if (arrAttributes[i] === 'password') { } // not returning password (normally not included in attributes)
            else retObj[arrAttributes[i]] = userObj[arrAttributes[i]]
        }
        callback(null, retObj);
    }
});


//==========================================
//           CREATE USER
//
// userObj = user object containing userattributes according to scim standard
// callback = null (OK) or error object
//==========================================
scimgateway.on('create-user', function (userObj, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "create-user" userObj=' + JSON.stringify(userObj));
    var notValid = scimgateway.notValidAttributes(userObj, validScimAttr); // We should check for unsupported endpoint attributes
    if (notValid) {
        var err = new Error('unsupported scim attributes: ' + notValid
            + ' (supporting only these attributes: ' + validScimAttr.toString() + ')'
        );
        return callback(err);
    }
    userObj.id = userObj.userName; //for testmode-plugin (scim endpoint) id is mandatory and set to userName
    try {
        testmodeusers.push(userObj);
    } catch (err) {
        return callback(err);
    }
    callback(null);
});


//==========================================
//           DELETE USER
//
// id       = user id
// callback = null (OK) or error object
// Note, if groups are supported, provisioning will also do get-group-members and remove user from groups before deleting user
//==========================================
scimgateway.on('delete-user', function (id, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "delete-user" id=' + id);
    var userObj = testmodeusers.find(function (element, index) {
        if (element.id === id) {
            testmodeusers.splice(index, 1); // delete user
            return true;
        }
        else return false;
    });
    if (!userObj) {
        var err = new Error('Failed to delete user with id=' + id);
        return callback(err);
    }
    else {
        callback(null);
    }
});


//==========================================
//          MODIFY USER
//
// id       = user id
// attrObj  = object containing userattributes according to scim standard (but multi-value attributes includes additional operation value create/delete/modify)
// callback = null (OK) or error object
//==========================================
scimgateway.on('modify-user', function (id, attrObj, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "modify-user" id=' + id + ' attrObj=' + JSON.stringify(attrObj));
    var notValid = scimgateway.notValidAttributes(attrObj, validScimAttr); // We should check for unsupported endpoint attributes
    if (notValid) {
        var err = new Error('unsupported scim attributes: ' + notValid
            + ' (supporting only these attributes: ' + validScimAttr.toString() + ')'
        );
        return callback(err);
    }

    var userObj = testmodeusers.find(function (element) {
        if (element.id === id) return true;
        else return false;
    });

    if (!userObj) {
        var err = new Error('Failed to find user with id=' + id);
        return callback(err);
    }
    else {
        var arrUser = [];
        arrUser = userObj;
        for (var key in attrObj) {
            //Special handling for multivalue attributes (arrays) eg. mail/phonenumber
            if (Array.isArray(attrObj[key])) {
                attrObj[key].forEach(function (el) {
                    //
                    // Create multivalue
                    // (using modify if type exist)
                    //
                    if (el.operation === 'create') {
                        delete el['operation'];
                        if (!arrUser[key]) arrUser[key] = [];
                        var found = arrUser[key].find(function (e, i) {
                            if (e.type === el.type) {
                                arrUser[key][i] = el; //modify instead of create - we want to type to be unique
                                return true;
                            }
                            else return false;
                        });
                        if (!found) arrUser[key].push(el); //create
                    }
                    //
                    // Delete multivalue
                    //
                    else if (el.operation === 'delete') {
                        delete el['operation'];
                        arrUser[key].find(function (e, i) {
                            if (e.type === el.type) {
                                arrUser[key].splice(i, 1); //delete
                                if (arrUser[key].length < 1) delete arrUser[key];
                                return true;
                            }
                            else return false;
                        });
                    }
                    //
                    // Modify multivalue
                    //
                    else if (el.operation === 'modify') {
                        delete el['operator'];
                        arrUser[key].find(function (e, i) {
                            if (e.type === el.type) {
                                arrUser[key][i] = el;
                                return true;
                            }
                            else return false;
                        });
                    }
                });
            }
            else {
                //None multi value attribute
                if (typeof (attrObj[key]) !== 'object') arrUser[key] = attrObj[key];
                else {
                    //name.formatted=Mary Lee Bianchi
                    //name.givenName=Mary
                    //name.middleName=Lee
                    //name.familyName=Bianchi
                    for (var sub in attrObj[key]) {
                        // attributes to be cleard located in meta.attributes eg: {"meta":{"attributes":["name.familyName","profileUrl","title"]}
                        if (sub === 'attributes' && Array.isArray(attrObj[key][sub])) {
                            attrObj[key][sub].forEach(function (element) {
                                var arrSub = element.split('.');
                                if (arrSub.length === 2) arrUser[arrSub[0]][arrSub[1]] = ''; // eg. name.familyName
                                else arrUser[element] = '';
                            });
                        }
                        else {
                            var value = attrObj[key][sub];
                            arrUser[key][sub] = value;
                        }
                    }
                }
            }
        }
        callback(null);
    }
});


//==========================================
//             GET GROUP
//
// displayName   = group name
// attributes = scim attributes to be returned in callback (displayName and members is mandatory)
// callback = object containing the scim group information including members
//      eg: {"displayName":"Admins","id":"Admins","members":[{"value":"bjensen","display":"bjensen"}
//
// // If we do not support groups, callback(null, null) with no additional code lines
//==========================================
scimgateway.on('get-group', function (displayName, attributes, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "get-group" group displayName=' + displayName + ' attributes=' + attributes);
    var retObj = {};
    var groupObj = testmodegroups.find(function (element) { // Verify group exist
        return element.displayName === displayName;
    });
    if (!groupObj) {
        var err = new Error('Could not find group with displayName ' + displayName);
        return callback(err);
    }
    else {
        retObj.displayName = groupObj.displayName; // displayName is mandatory
        retObj.id = groupObj.id;
        retObj.members = groupObj.members; // members must also be included
    }
    callback(null, retObj)
});


//==========================================
//             GET GROUP MEMBERS
//
// id         = user id (eg. bjensen)
// attributes = attributes to be returned in callback (we only return the name of groups - displayName and current user as member)
// callback   = array of objects containing groups with current user as member to be returned 
//      e.g [{"displayName":"Admins","members": [{ "value": bjensen}]}, {"displayName":"Employees", "members": [{ "value": bjensen}]}]
//
// If we do not support groups, callback(null, []) with no additional code lines
//==========================================
scimgateway.on('get-group-members', function (id, attributes, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "get-group-members" user id=' + id + ' attributes=' + attributes);
    var arrRet = [];
    // find all groups user is member of
    testmodegroups.forEach(function (el) {
        if (el.members) {
            var userFound = el.members.find(function (element) {
                if (element.value === id) return true;
                else return false;
            });
            if (userFound) {
                var userGroup = {
                    "displayName": el.displayName, // displayName is mandatory
                    "members": [{ "value": id }]    // only includes current user (not all members)
                }
                arrRet.push(userGroup);
            }
        }
    });
    callback(null, arrRet);
});


//==========================================
//          MODIFY GROUP MEMBERS
//
// id       = group name (eg. Admins)
// members = array of objects containing groupmembers eg: {"value":"bjensen"}, {"operation":"delete","value":"jsmith"}
// callback = null (OK) or error object
// 
// If we do not support groups, callback(null) with no additional code lines
//==========================================
scimgateway.on('modify-group-members', function (id, members, callback) {
    scimgateway.logger.debug(pluginName + ' handling event "modify-group-members" id=' + id + ' members=' + JSON.stringify(members));

    var groupObj = testmodegroups.find(function (element) {
        if (element.id === id) return true;
        else return false;
    });

    if (!groupObj) {
        var err = new Error('Failed to find group with id=' + id);
        return callback(err);
    } else {
        if (Array.isArray(members)) {
            members.forEach(function (el) {
                if (el.operation && el.operation === 'delete') {
                    // delete member from group
                    groupObj.members.find(function (element, index) {
                        if (element.value === el.value) {
                            groupObj.members.splice(index, 1);  // delete
                            if (groupObj['members'].length < 1) delete groupObj['members'];
                            return true;
                        }
                        else return false;
                    });
                }
                else {
                    // Add member to group
                    var newMember = {
                        "display": el.value,
                        "value": el.value
                    }
                    if (!groupObj.members) groupObj.members = [];
                    groupObj.members.push(newMember);
                }
            });
        }
    }
    callback(null);
});