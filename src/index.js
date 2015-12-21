var tool = require('buildboard-tool-bootstrap');
var url = require('url');
var TP = require('./targetprocess.js');
var request = require('koa-request');

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
            'tasks': {
                get: {
                    action: requestToResource('getAssignables')
                }
            },
            'users': {
                get: {
                    action: requestToResource('getUsers')
                }
            }
        },

        account: function ({generalSettings}) {
            return {
                *onCreate(account){
                    var tp = new TP(account.config);
                    yield tp.createWebHook(account.toolToken, generalSettings.url + '/webhook?token=' + account.toolToken);
                },
                *onDelete(account){
                    var tp = new TP(account.config);
                    //tp.deleteWebhook(account.toolToken);
                    console.log('deleted', account);
                },
                *onUpdate(account, oldAccount){
                    // new TP(oldAccount.config).deleteWebhook(oldAccount.toolToken);
                    yield new TP(account.config).createWebHook(account.toolToken, generalSettings.url + '/webhook?token=' + account.toolToken);
                }
            }
        }
    },
    ({router, generalSettings})=> {
        router.post('/webhook', function *() {
            var entity = this.request.body.Entity;
            var task = {
                id: entity.ID.toString(),
                url: this.passport.user.config.url + '/entity/' + entity.ID,
                type: entity.EntityTypeName.replace('Tp.BusinessObjects.', '').toLowerCase(),
                name: entity.Name,
                state: {id: entity.EntityStateID, name: entity.EntityStateName},
                users: [],
                createdAt: entity.CreateDate,
                lastModified: entity.ModifyDate
            };
            var options;
            switch (this.request.body.Modification) {
                case 'Created':
                case 'Updated':
                    options = {
                        url: generalSettings.buildboardUrl + '/api/tasks/' + this.passport.user.toolToken,
                        method: 'post',
                        json: task
                    };
                    break;
                case 'Deleted':

                    options = {
                        url: generalSettings.buildboardUrl + '/api/tasks/' + this.passport.user.toolToken + '/' + entity.ID,
                        method: 'delete'
                    };
                    break;
            }
            if (options) {
                var result = yield request(options);
                this.body = {ok: true};
                this.status = 200;
            }
            else {
                this.body = {ok: false, error: 'unknown modification'};
                this.status = 500;
            }

        });
    });

function requestToResource(resource) {
    return function*() {
        var fullUrl = tool.getUrl(this);
        var tp = new TP(this.passport.user.config);
        this.body = yield tp[resource](this.request.query);
        if (this.body.next) {
            fullUrl.query.page = (parseInt(fullUrl.query.page) || 1) + 1;
            fullUrl.search = undefined;
            this.body.next = url.format(fullUrl);
        }
    }
}
