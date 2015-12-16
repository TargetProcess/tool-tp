'use strict';

var tool = require('buildboard-tool-bootstrap');
var url = require('url');
var TP = require('./targetprocess.js');

var rootUrl = process.env["ROOT_URL"] || require('./getIp');


tool.bootstrap(
    {
        id: 'tp',
        settings: {
            url: {
                caption: 'Targetprocess URL',
                type: 'uri'
            },
            token: {
                caption: 'Targetprocess authentication token',
                type: 'string'
            },
            projects: {
                caption: 'Ids or names of projects to be monitored',
                type: 'list',
                optional: true
            },
            types: {
                caption: 'Names of entity types to be monitored',
                type: 'multiple selection',
                optional: true,
                values: ['UserStory', 'Bug', 'Feature', 'Epic'],
                defaultValue: ['UserStory', 'Bug']
            },


            *validation(config){
                 var tp = new TP(config);
                return yield tp.validate();
            }
        },

        methods: {
            '/tasks': {
                get: {
                    action: tasks
                }
            }
        }
    }
);

function *tasks() {

    var fullUrl = tool.getUrl(this);

    var tp = new TP(this.passport.user.config);
    this.body = yield tp.getAssignables(this.request.query);
    if (this.body.next) {
        fullUrl.query.page = (parseInt(fullUrl.query.page) || 1) + 1;
        fullUrl.search = undefined;
        this.body.next = url.format(fullUrl);
    }
}
