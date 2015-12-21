'use strict';

var request = require('koa-request');
var _ = require('lodash');
var url = require('url');
var crypto = require('crypto');

function md5(text) {
    return crypto.createHash('md5').update(text).digest("hex");
}

class Targetprocess {
    constructor(config) {
        this._config = config;

        var {token, url} = config;
        this._token = token;
        this._url = url;
    }

    stringifySelect(select) {
        var parts =
            _.map(select, (value, key)=>
                key + ':' + (_.isObject(value) ? this.stringifySelect(value) : value.toString())
            );
        return `{${parts.join(',')}}`;
    };


    _getOptions(resource, select, where, skip, take) {
        return {
            url: `${this._url}/api/v2/${resource}?select=${select || ""}&where=${where || "true"}&skip=${skip}&take=${take}&token=${this._token}`
        };
    }

    *_request(resource, select, where, skip, take) {
        if (!_.isString(select)) {
            select = this.stringifySelect(select);
        }

        let options = this._getOptions(resource, select, where, skip, take);
        let response = yield request(options);
        let body = JSON.parse(response.body);

        return {items: body.items || body, next: Targetprocess.buildNext(body.next)};
    }

    static buildNext(nextLink) {
        if (!nextLink) {
            return undefined;
        }
        var parsed = url.parse(nextLink, true);
        return {take: parsed.query.take, skip: parsed.query.skip};
    }

    static get filters() {
        return {
            'since_date': dateString=> {
                var date = `DateTime.Parse("${dateString}")`;
                return `createDate>=${date} or ModifyDate>=${date}`;
            },
            'since_id': id=>`id>=${id}`,
            'project': id=>_.isString(id) ? `project.name=="${id}"` : `project.id==${id}`,
            'entityType': id=>_.isString(id) ? `entityType.name=="${id}"` : `entityType.id==${id}`
        }
    }

    buildWhere(filter) {
        return _(Targetprocess.filters)
            .map((value, key)=> {
                var filterValue = filter[key];
                if (filterValue) {
                    var filterValueArray = _.isArray(filterValue) ? filterValue : [filterValue];

                    var result = _.map(filterValueArray, value);
                    if (!(!result || result.length === 0)) {
                        if (result.length == 1) {
                            return result[0];
                        }
                        else {
                            return _.map(result, x=>`(${x})`).join(' or ');
                        }
                    }
                }
            })
            .compact()
            .map(x=>`(${x})`)
            .value()
            .join(' and ');
    }

    *getUsers(query) {
        let take = parseInt(query.per_page) || 100;
        let skip = take * (parseInt(query.page) - 1) || 0;
        return yield this._request('user', {'id': 'email', 'email': 'email'},
            '',
            skip, take);
    }

    *getAssignables(query) {

        query.project = this._config.projects;
        query.entityType = this._config.types;

        var where = this.buildWhere(query);

        let take = parseInt(query.per_page) || 100;
        let skip = take * (parseInt(query.page) - 1) || 0;


        return yield this._request('assignable', {
                'id': 'id.ToString()',
                'type': 'entityType.name.ToLower()',
                'name': 'name',
                'state': {
                    'id': 'entityState.id',
                    'name': 'entityState.name'
                },
                users: 'Assignments.Select({user.id,user.email,name:user.fullName,role:role.name})',
                created: 'CreateDate.Value.ToString("o")',
                lastModified: 'ModifyDate.Value.ToString("o")'
            },
            where,
            skip, take);

    }

    *validate() {
        try {
            var loggedUserResponse = yield request({
                url: `${this._url}/api/v1/Users/loggedUser?token=${this._token}&format=json&include=[IsActive,DeleteDate,IsAdministrator]`
            });
        }
        catch (e) {
            return {error: [e]};
        }


        var statusCode = loggedUserResponse.statusCode;
        if (statusCode != 200) {
            var errorResult;

            if (statusCode == 401 || statusCode == 403) {
                errorResult = 'Authentication fails';
            } else if (statusCode >= 500 && statusCode < 600) {
                errorResult = 'Internal server error'
            } else if (statusCode >= 400 && statusCode < 500) {
                errorResult = 'Invalid request';
            } else {
                errorResult = 'Unknown error';
            }

            errorResult += ': ' + statusCode;

            console.error(loggedUserResponse.body);
            return {error: [errorResult]}
        }

        var result = [];


        var body = loggedUserResponse.body;
        if (_.isString(body)) {
            body = JSON.parse(body);
        }

        if (!body.IsActive) {
            result.push('User is no active');
        }
        if (body.DeleteDate != null) {
            result.push('User is deleted');
        }
        if (!body.IsAdministrator) {
            result.push('User is not an Administrator');
        }

        if (result.length > 0) {
            return {error: result};
        }
        else {
            return true;
        }
    }

    *createWebHook(toolToken, url) {
        var profileName = "Buildboard integration " + md5(toolToken);

        var profile = {
            "Name": profileName,
            "Settings": {
                "Uri": url,
                "ContentType": "application/json",
                "UseTemplate": false,
                "Template": "",
                "Filter": this._config.projects ? _.map(this._config.projects, project=>_.isString(project) ? `ProjectName == "${project}"` : `ProjectID == ${project}`).join(' or ') : '',
                "OnCreate": true,
                "OnUpdate": true,
                "OnDelete": true,
                "Types": this._config.types || ["UserStory", "Task", "Bug", "Feature", "Epic"]
            }
        };

        var hookUrl = `${this._url}/api/v1/Plugins/Web%20Hooks/Profiles/null?token=${this._token}`;


        var options = {
            url: hookUrl,
            method: 'post',
            json: profile
        };
        var result = yield request(options);
        return true;
    }
}

module.exports = Targetprocess;