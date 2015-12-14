var expect = require("chai").expect;

var Targetprocess = require("../src/targetprocess");

describe("Targetprocess", function () {

    var tp = new Targetprocess({});
    describe('StringifySelect', ()=> {


        it("select parameter", function () {
            expect(tp.stringifySelect({id: 'id'})).to.equal('{id:id}');
        });

        it('nested selects', ()=> {
            expect(
                tp.stringifySelect({
                    name: 'name',
                    type: {
                        id: 'entityState.id',
                        name: 'entityState.name'
                    }
                })
            ).to.equal("{name:name,type:{id:entityState.id,name:entityState.name}}")
        })
    });

    describe('buildWhere', ()=> {
        it('should build filter', ()=> {

            expect(tp.buildWhere({
                since_id: 45,
                since_date: "2015-12-01",
                project: 9,
                'undefined': 45
            }))
                .to
                .equal('(createDate>=DateTime.Parse("2015-12-01") or ModifyDate>=DateTime.Parse("2015-12-01")) and (id>=45) and (project.id==9)');
        });

        it('should build filter for project name', ()=> {
            expect(tp.buildWhere({
                project: "x"
            })).to.equal('(project.name=="x")')
        });

        it('should build filter with or', ()=> {
            expect(tp.buildWhere({
                since_id: [1, 2],
                project: [4, "name"]
            })).to.equal('((id>=1) or (id>=2)) and ((project.id==4) or (project.name=="name"))')
        })
    })
});
